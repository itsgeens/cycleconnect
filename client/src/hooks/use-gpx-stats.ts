import { useState, useEffect } from 'react';
import GpxParser from 'gpxparser';

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
  console.log('Parsing GPX data using gpx-parser-browser...');
  console.log('parseGPXData: Received gpxContent length:', gpxContent.length);

  try {
    const parser = new GpxParser();
    parser.parse(gpxContent);

    // The parsed data is available in parser.tracks
    const tracks = parser.tracks;

    if (!tracks || tracks.length === 0) {
      console.warn('parseGPXData: No tracks found in GPX data.');
      return {
        distance: 0,
        elevationGain: 0,
        coordinates: []
      };
    }

    // Assuming you are interested in the first track and its segments
    const firstTrack = tracks[0];
    const coordinates: [number, number][] = [];
    let totalDistance = 0;
    let elevationGain = 0;
    let previousElevation: number | null = null;

    if (firstTrack.segments && firstTrack.segments.length > 0) {
      firstTrack.segments.forEach(segment => {
        segment.points.forEach(point => {
          const lat = point.lat;
          const lon = point.lon;
          const elevation = point.ele !== undefined ? point.ele : null; // Use point.ele for elevation

          if (lat !== undefined && lon !== undefined) {
            coordinates.push([lat, lon]);

            // Calculate elevation gain
            if (elevation !== null && previousElevation !== null && elevation > previousElevation) {
              elevationGain += elevation - previousElevation;
            }
            previousElevation = elevation;
          }
        });
      });
    } else {
         console.warn('parseGPXData: No segments or points found in the first track.');
    }


    // Calculate total distance (using the library's calculated distance if available, otherwise calculate manually)
    totalDistance = parser.tracks[0]?.distance?.total || 0; // Use library's distance

     // If library's distance is 0, fall back to manual calculation
    if (totalDistance === 0 && coordinates.length > 1) {
        for (let i = 1; i < coordinates.length; i++) {
            const distance = calculateDistance(
                coordinates[i - 1][0], coordinates[i - 1][1],
                coordinates[i][0], coordinates[i][1]
            );
            totalDistance += distance;
        }
         console.log('parseGPXData: Calculated distance manually as library distance was 0.');
    }


    console.log('parseGPXData (Library): Number of coordinates found:', coordinates.length);
    console.log('parseGPXData (Library): Calculated total distance (km):', totalDistance > 0 ? Math.round(totalDistance / 1000 * 100) / 100 : 0); // Convert meters to km and round
    console.log('parseGPXData (Library): Calculated elevation gain (m):', elevationGain > 0 ? Math.round(elevationGain) : 0);


    return {
      distance: totalDistance > 0 ? Math.round(totalDistance / 1000 * 100) / 100 : 0, // Convert meters to km and round
      elevationGain: elevationGain > 0 ? Math.round(elevationGain) : 0,
      coordinates
    };

  } catch (error) {
    console.error('parseGPXData: Error parsing GPX with gpx-parser-browser:', error);
    // Return empty stats on parsing error
    return {
      distance: 0,
      elevationGain: 0,
      coordinates: []
    };
  }
}

// Keep your existing calculateDistance function as a fallback if the library's distance is zero
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