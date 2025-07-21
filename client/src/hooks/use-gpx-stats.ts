import { useState, useEffect } from 'react';

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
    // Use gpxUrl here, as it's the prop received by the hook
    if (!gpxUrl) {
      setStats(null);
      return;
    }
  
    console.log("useGPXStats: Fetching GPX from path:", gpxUrl); // Use gpxUrl here
    const loadStats = async () => {
      try {
        // Construct the URL to your backend's GPX endpoint using gpxUrl
        const API_BASE_URL = import.meta.env.VITE_API_URL || '';
        const backendGpxUrl = `${API_BASE_URL}/api/gpx/${encodeURIComponent(gpxUrl)}`; // Use gpxUrl here
  
        // Fetch from your backend endpoint
        const response = await fetch(backendGpxUrl);
  
        console.log("useGPXStats: Fetch response status:", response.status);
        console.log("useGPXStats: Fetch response headers:", response.headers);
  
        if (!response.ok) {
           if (response.status >= 400) {
             throw new Error(`Failed to fetch GPX file from backend: ${response.status} ${response.statusText}`);
           }
        }
  
        // Get the final URL after potential redirects (though with proxying, this might be your backend URL again)
        const finalGpxUrl = response.url;
  
        // Fetch the content from the final URL (which is now your backend proxying endpoint)
        const gpxResponse = await fetch(finalGpxUrl); // This fetch might be redundant if backend already sent content
  
         if (!gpxResponse.ok) {
           throw new Error(`Failed to fetch GPX content from URL: ${gpxResponse.status} ${gpxResponse.statusText}`);
         }
  
        const gpxContent = await gpxResponse.text();
        console.log("useGPXStats: Fetched GPX content (first 500 chars):", gpxContent.substring(0, 500));
        
        // log to console
        console.log("Raw GPX content:", gpxContent);

        const parsedStats = parseGPXData(gpxContent);
        console.log("useGPXStats: Parsed stats:", parsedStats);
  
        setStats(parsedStats);
      } catch (error) {
        console.error("useGPXStats: Error fetching or parsing GPX:", error);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };
    console.log("useGPXStats: Calling loadStats()");
    loadStats();
  
  }, [gpxUrl]); // Use gpxUrl in the dependency array    

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
  const gpxNamespace = 'http://www.topografix.com/GPX/1/1'; // Common GPX 1.1 namespace
    const trackPoints = xmlDoc.getElementsByTagNameNS(null, 'trkpt'); // Use null here for the default namespace
  
    Array.from(trackPoints).forEach((point) => { 
    const lat = parseFloat(point.getAttribute('lat') || '0');
    const lon = parseFloat(point.getAttribute('lon') || '0');
    const eleElement = point.getElementsByTagNameNS(null, 'ele')[0]; // Use null here
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
    // Add console logs for debugging the parsing process
      console.log("parseGPXData: Number of track points found:", trackPoints.length);
      console.log("parseGPXData: Final coordinates array length:", coordinates.length);
      console.log("parseGPXData: Calculated total distance (km):", totalDistance);
      console.log("parseGPXData: Calculated elevation gain (m):", elevationGain);
    return {
      distance: totalDistance > 0 ? Math.round(totalDistance * 100) / 100 : 0, // Ensure 0 if no points
      elevationGain: elevationGain > 0 ? Math.round(elevationGain) : 0, // Ensure 0 if no points
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