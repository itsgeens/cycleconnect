import { useState, useEffect } from 'react';
import GpxJs from 'gpx-js'; // Import gpx-js

interface GpxPoint {
  lat: number;
  lon: number;
  ele?: number; // ele is optional and can be undefined
  // Add other properties if you use them from gpx-js points
}

export interface GPXStats {
  distance: number;
  elevationGain: number;
  coordinates: [number, number][];
  startCoords?: { lat: number; lng: number };
  endCoords?: { lat: number; lng: number };
}

// Keep your calculateDistance function
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Returns distance in km
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

    console.log("useGPXStats: Fetching GPX from path:", gpxUrl);
    const loadStats = async () => {
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || '';
        const backendGpxUrl = `${API_BASE_URL}/api/gpx/${encodeURIComponent(gpxUrl)}`;

        const response = await fetch(backendGpxUrl);

        console.log("useGPXStats: Fetch response status:", response.status);
        console.log("useGPXStats: Fetch response headers:", response.headers);

        if (!response.ok) {
           if (response.status >= 400) {
             throw new Error(`Failed to fetch GPX file from backend: ${response.status} ${response.statusText}`);
           }
        }

        const gpxContent = await response.text(); // Fetch content directly

        console.log("useGPXStats: Fetched GPX content (first 500 chars):", gpxContent.substring(0, 500));
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

  }, [gpxUrl]);

  return { stats, loading, error };
}


function parseGPXData(gpxContent: string): GPXStats {
  console.log('Parsing GPX data using gpx-js...');
  console.log('parseGPXData: Received gpxContent length:', gpxContent.length);

  try {
    // Use GpxJs from gpx-js
    const gpx = new GpxJs(gpxContent);

    const coordinates: [number, number][] = [];
    let totalDistance = 0;
    let elevationGain = 0;
    let previousElevation: number | null = null;

    // gpx-js parses tracks and points
    if (gpx.tracks && gpx.tracks.length > 0) {
      gpx.tracks.forEach(track => {
        if (track.points && track.points.length > 0) {
          track.points.forEach((point: GpxPoint) => { // Explicitly type point as GpxPoint
            const lat = point.lat;
            const lon = point.lon;
            const elevation = point.ele !== undefined ? point.ele : null;

             if (lat !== undefined && lon !== undefined) {
              coordinates.push([lat, lon]);

               // Calculate elevation gain
              if (elevation !== null && previousElevation !== null && elevation > previousElevation) {
                elevationGain += elevation - previousElevation;
              }
              previousElevation = elevation;
            }
          });
        }
      });
    } else {
       console.warn('parseGPXData (gpx-js): No tracks or points found.');
    }


    // Calculate total distance manually using calculateDistance
    if (coordinates.length > 1) {
        for (let i = 1; i < coordinates.length; i++) {
            const distance = calculateDistance(
                coordinates[i - 1][0], coordinates[i - 1][1],
                coordinates[i][0], coordinates[i][1]
            );
            totalDistance += distance;
        }
         console.log('parseGPXData (gpx-js): Calculated distance manually.');
    }


     const startCoords = coordinates.length > 0 ? { lat: coordinates[0][0], lng: coordinates[0][1] } : undefined;
     const endCoords = coordinates.length > 0 ? { lat: coordinates[coordinates.length - 1][0], lng: coordinates[coordinates.length - 1][1] } : undefined;


    console.log('parseGPXData (gpx-js): Number of coordinates found:', coordinates.length);
    console.log('parseGPXData (gpx-js): Calculated total distance (km):', totalDistance > 0 ? Math.round(totalDistance * 100) / 100 : 0);
    console.log('parseGPXData (gpx-js): Calculated elevation gain (m):', elevationGain > 0 ? Math.round(elevationGain) : 0);


    return {
      distance: totalDistance > 0 ? Math.round(totalDistance * 100) / 100 : 0,
      elevationGain: elevationGain > 0 ? Math.round(elevationGain) : 0,
      coordinates,
      startCoords,
      endCoords
    };

  } catch (error) {
    console.error('parseGPXData: Error parsing GPX with gpx-js:', error);
    return {
      distance: 0,
      elevationGain: 0,
      coordinates: []
    };
  }
}