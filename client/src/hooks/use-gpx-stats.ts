import { useState, useEffect } from 'react';
    // Removed import GpxJs from 'gpx-js';
import { type GPXStats } from 'shared/gpx-types';


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

    // DOMParser based parsing with querySelectorAll
    function parseGPXData(gpxContent: string): GPXStats {
      console.log('Parsing GPX data using DOMParser with querySelectorAll...');
      console.log('parseGPXData: Received gpxContent length:', gpxContent.length);

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');

      // --- Add Error Checking ---
      const errorNode = xmlDoc.querySelector('parsererror');
      if (errorNode) {
        console.error('parseGPXData: XML Parsing Error:', errorNode.textContent);
        // Return empty stats if parsing failed
        return {
          distance: 0,
          elevationGain: 0,
          coordinates: []
        };
      }
      // --- End Error Checking ---


      const coordinates: [number, number][] = [];
      let totalDistance = 0;
      let elevationGain = 0;
      let previousElevation: number | null = null;

      // Use querySelectorAll to find trkpt elements regardless of namespace
      const trackPoints = xmlDoc.querySelectorAll('trkpt'); // Use querySelectorAll

      console.log('parseGPXData (DOMParser/querySelectorAll): Number of track points found:', trackPoints.length);


      Array.from(trackPoints).forEach((point) => {
        const lat = parseFloat(point.getAttribute('lat') || '0');
        const lon = parseFloat(point.getAttribute('lon') || '0');
        // Find the 'ele' element within the track point using querySelector
        const eleElement = point.querySelector('ele');
        const elevation = eleElement ? parseFloat(eleElement.textContent || '0') : null;

        if (!isNaN(lat) && !isNaN(lon)) {
          coordinates.push([lat, lon]);

          if (elevation !== null && previousElevation !== null && elevation > previousElevation) {
            elevationGain += elevation - previousElevation;
          }
          previousElevation = elevation;
        }
      });

      // Calculate total distance manually
      for (let i = 1; i < coordinates.length; i++) {
        const distance = calculateDistance(
          coordinates[i - 1][0], coordinates[i - 1][1],
          coordinates[i][0], coordinates[i][1]
        );
        totalDistance += distance;
      }

      const startCoords = coordinates.length > 0 ? { lat: coordinates[0][0], lng: coordinates[0][1] } : undefined;
      const endCoords = coordinates.length > 0 ? { lat: coordinates[coordinates.length - 1][0], lng: coordinates[coordinates.length - 1][1] } : undefined;


      console.log('parseGPXData (DOMParser/querySelectorAll): Final coordinates array length:', coordinates.length);
      console.log('parseGPXData (DOMParser/querySelectorAll): Calculated total distance (km):', totalDistance > 0 ? Math.round(totalDistance * 100) / 100 : 0);
      console.log('parseGPXData (DOMParser/querySelectorAll): Calculated elevation gain (m):', elevationGain > 0 ? Math.round(elevationGain) : 0);


      return {
        distance: totalDistance > 0 ? Math.round(totalDistance * 100) / 100 : 0,
        elevationGain: elevationGain > 0 ? Math.round(elevationGain) : 0,
        coordinates,
        startCoords,
        endCoords
      };
    }
