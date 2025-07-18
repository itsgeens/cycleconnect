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
    if (!gpxUrl) {
      setStats(null);
      return;
    }

    const fetchAndParseGPX = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(gpxUrl);
        if (!response.ok) {
          throw new Error('Failed to fetch GPX file');
        }

        const gpxContent = await response.text();
        const parsedStats = parseGPXData(gpxContent);
        setStats(parsedStats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse GPX file');
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