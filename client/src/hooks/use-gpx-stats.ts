import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export interface GPXStats {
  distance: number;
  elevationGain: number;
  coordinates: [number, number][];
  startCoords?: { lat: number; lng: number };
  endCoords?: { lat: number; lng: number };
}

export function useGPXStats(gpxUrl?: string) {
  const [stats, setStats] = useState<GPXStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gpxUrl) { // gpxUrl will now be the Supabase storage path
      setStats(null);
      return;
    }

    const fetchAndParseGPX = async () => {
      setLoading(true);
      setError(null);

      try {
        // Construct the URL to your backend's GPX endpoint
        const API_BASE_URL = import.meta.env.VITE_API_URL || '';
        const backendGpxUrl = `${API_BASE_URL}/api/gpx/${encodeURIComponent(gpxUrl)}`; // Pass the Supabase storage path as filename

        // Fetch from your backend endpoint (it will handle the redirection to Supabase signed URL)
        const response = await fetch(backendGpxUrl);

        if (!response.ok) {
          // Check if the response is a redirect (status 2xx, but not 200)
          // In a browser, fetch automatically follows redirects.
          // If running in a Node.js environment or if fetch doesn't follow redirect automatically,
          // you might need to handle it manually here by checking response.headers.get('Location')
          // However, in most browser environments, fetch follows redirects automatically.
           if (response.status >= 400) {
             throw new Error(`Failed to fetch GPX file from backend: ${response.status} ${response.statusText}`);
           }
        }

        // Get the final URL after potential redirects
        const finalGpxUrl = response.url;

        // Fetch the content from the final (signed) URL
        const gpxResponse = await fetch(finalGpxUrl);

         if (!gpxResponse.ok) {
           throw new Error(`Failed to fetch GPX content from signed URL: ${gpxResponse.status} ${gpxResponse.statusText}`);
         }


        const gpxContent = await gpxResponse.text();
        const parsedStats = parseGPXData(gpxContent);
        setStats(parsedStats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load or parse GPX data');
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAndParseGPX();
  }, [gpxUrl]);

  return { stats, loading, error };
}

function parseGPXData(gpxContent: string): GPXStats {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');
  
  const coordinates: [number, number][] = [];
  let totalDistance = 0;
  let elevationGain = 0;
  let previousElevation: number | null = null;

  // Extract track points
  const trackPoints = xmlDoc.querySelectorAll('trkpt');
  
  trackPoints.forEach((point, index) => {
    const lat = parseFloat(point.getAttribute('lat') || '0');
    const lon = parseFloat(point.getAttribute('lon') || '0');
    const eleElement = point.querySelector('ele');
    const elevation = eleElement ? parseFloat(eleElement.textContent || '0') : null;

    if (lat && lon) {
      coordinates.push([lat, lon]);
      
      // Calculate elevation gain
      if (elevation !== null && previousElevation !== null && elevation > previousElevation) {
        elevationGain += elevation - previousElevation;
      }
      previousElevation = elevation;
    }
  });

  // Calculate total distance
  for (let i = 1; i < coordinates.length; i++) {
    const distance = calculateDistance(
      coordinates[i - 1][0], coordinates[i - 1][1],
      coordinates[i][0], coordinates[i][1]
    );
    totalDistance += distance;
  }

  return {
    distance: Math.round(totalDistance * 100) / 100, // Round to 2 decimal places
    elevationGain: Math.round(elevationGain),
    coordinates,
    startCoords: coordinates.length > 0 ? { lat: coordinates[0][0], lng: coordinates[0][1] } : undefined,
    endCoords: coordinates.length > 0 ? { lat: coordinates[coordinates.length - 1][0], lng: coordinates[coordinates.length - 1][1] } : undefined
  };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}