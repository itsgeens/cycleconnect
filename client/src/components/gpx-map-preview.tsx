import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface GPXMapPreviewProps {
  gpxData?: string;
  gpxUrl?: string;
  secondaryGpxUrl?: string; // For showing organizer's route
  className?: string;
  interactive?: boolean;
  showFullscreen?: boolean;
}

interface GPXStats {
  distance: number;
  elevationGain: number;
  coordinates: [number, number][];
}

export default function GPXMapPreview({ gpxData, gpxUrl, secondaryGpxUrl, className = "h-48", interactive = false, showFullscreen = false }: GPXMapPreviewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current, {
      zoomControl: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      dragging: interactive,
      touchZoom: interactive,
    }).setView([37.7749, -122.4194], 13);

    // Create custom panes for proper layering
    map.createPane('plannedRoute');
    map.getPane('plannedRoute')!.style.zIndex = '400';
    
    map.createPane('actualRoute');
    map.getPane('actualRoute')!.style.zIndex = '450';

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    mapInstanceRef.current = map;

    // Load and display GPX data
    const loadGPXData = async () => {
      let gpxContent = gpxData;
      
      if (gpxUrl && !gpxContent) {
        try {
          // Handle both absolute and relative URLs
          const API_BASE_URL = import.meta.env.VITE_API_URL || '';
          const fullGpxUrl = gpxUrl.startsWith('http') ? gpxUrl : `${API_BASE_URL}${gpxUrl}`;
          
          const response = await fetch(fullGpxUrl);
          if (response.ok) {
            gpxContent = await response.text();
          }
        } catch (error) {
          console.error('Failed to load primary GPX file:', error);
        }
      }

      // Load secondary GPX (organizer's route)
      let secondaryGpxContent = '';
      if (secondaryGpxUrl) {
        try {
          // Handle both absolute and relative URLs
          const API_BASE_URL = import.meta.env.VITE_API_URL || '';
          const fullSecondaryUrl = secondaryGpxUrl.startsWith('http') ? secondaryGpxUrl : `${API_BASE_URL}${secondaryGpxUrl}`;
          
          const response = await fetch(fullSecondaryUrl);
          if (response.ok) {
            secondaryGpxContent = await response.text();
          }
        } catch (error) {
          console.error('Failed to load secondary GPX file:', error);
        }
      }

      // Display primary route in blue (planned route)
      if (gpxContent) {
        console.log('GPX Content:', gpxContent); // Log GPX content
        const stats = parseGPXData(gpxContent);
        console.log('Parsed GPX Stats:', stats); // Log parsed stats
        if (stats.coordinates.length > 0) {
          displayGPXRoute(map, stats.coordinates, '#3b82f6', 'Planned Route');
        }
      }

      // Display secondary route in green (organizer's actual route)
      if (secondaryGpxContent) {
        console.log('Secondary GPX Content:', secondaryGpxContent); // Log secondary GPX content
        const secondaryStats = parseGPXData(secondaryGpxContent);
        console.log('Parsed Secondary GPX Stats:', secondaryStats); // Log parsed secondary stats
        if (secondaryStats.coordinates.length > 0) {
          displayGPXRoute(map, secondaryStats.coordinates, '#22c55e', 'Organizer\\\'s Actual Route');
        }
      }

       // Fit map to route bounds with a small delay
       if ((gpxContent || secondaryGpxContent) && mapInstanceRef.current) {
        setTimeout(() => {
          const allCoordinates = [];
          if (gpxContent) {
            const primaryStats = parseGPXData(gpxContent); // Re-parse to get coordinates for bounds
            if (primaryStats.coordinates.length > 0) {
              allCoordinates.push(...primaryStats.coordinates);
            }
          }
          if (secondaryGpxContent) {
            const secondaryStats = parseGPXData(secondaryGpxContent); // Re-parse to get coordinates for bounds
            if (secondaryStats.coordinates.length > 0) {
              allCoordinates.push(...secondaryStats.coordinates);
            }
          }

          if (allCoordinates.length > 0) {
            const bounds = L.latLngBounds(allCoordinates);
            mapInstanceRef.current?.fitBounds(bounds, { padding: [20, 20] });
          }
        }, 100);
      }
    };

    loadGPXData();

    return () => {
      // Clean up layers
      layersRef.current.forEach(layer => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(layer);
        }
      });
      layersRef.current = [];
      
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [gpxData, gpxUrl, secondaryGpxUrl, interactive]);

  const parseGPXData = (gpxContent: string): GPXStats => {
    console.log('Parsing GPX data...'); // Log start of parsing
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');

    const coordinates: [number, number][] = [];
    let totalDistance = 0;
    let elevationGain = 0;
    let previousElevation: number | null = null; // Use null for initial previousElevation

    // Define the GPX namespace URI (optional, but good for clarity if needed elsewhere)
    // const gpxNamespace = 'http://www.topografix.com/GPX/1/1'; // You can keep this commented out

    // Extract track points using null for the default namespace
    const trackPoints = xmlDoc.getElementsByTagNameNS(null, 'trkpt'); // Use null here

    console.log('parseGPXData (DOMParser): Number of track points found:', trackPoints.length); // Log number found by DOMParser

    Array.from(trackPoints).forEach((point) => {
      const lat = parseFloat(point.getAttribute('lat') || '0');
      const lon = parseFloat(point.getAttribute('lon') || '0');
      // Use getElementsByTagNameNS with null for child elements in the default namespace
      const eleElement = point.getElementsByTagNameNS(null, 'ele')[0]; // Use null here
      const elevation = eleElement ? parseFloat(eleElement.textContent || '0') : null;

      if (!isNaN(lat) && !isNaN(lon)) { // Check if parsing was successful
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

    console.log('parseGPXData (DOMParser): Final coordinates array length:', coordinates.length); // Log final coordinates length
    console.log('parseGPXData (DOMParser): Calculated total distance (km):', totalDistance); // Log total distance
    console.log('parseGPXData (DOMParser): Calculated elevation gain (m):', elevationGain); // Log elevation gain


    return {
      distance: totalDistance > 0 ? Math.round(totalDistance * 100) / 100 : 0, // Ensure 0 if no points
      elevationGain: elevationGain > 0 ? Math.round(elevationGain) : 0, // Ensure 0 if no points
      coordinates
    };
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const displayGPXRoute = (map: L.Map, coordinates: [number, number][], color: string = '#3b82f6', label?: string) => {
    console.log('displayGPXRoute: Received coordinates:', coordinates); // Add this logger
    console.log('displayGPXRoute: Number of coordinates received:', coordinates.length); // Add this logger

    if (coordinates.length === 0) return;

    // Determine if this is the organizer's actual route (green) or planned route (blue)
    const isOrganizerRoute = color === '#22c55e';
    
    // Create route polyline with appropriate z-index
    const polyline = L.polyline(coordinates, {
      color: color,
      weight: isOrganizerRoute ? 4 : 3, // Thicker line for organizer's route
      opacity: isOrganizerRoute ? 0.9 : 0.7, // More opaque for organizer's route
      pane: isOrganizerRoute ? 'actualRoute' : 'plannedRoute' // Higher pane for organizer's route
    }).addTo(map);

    // Store layer for cleanup
    layersRef.current.push(polyline);

    // Add label if provided
    if (label && coordinates.length > 0) {
      const midPoint = coordinates[Math.floor(coordinates.length / 2)];
      const labelMarker = L.marker(midPoint, {
        icon: L.divIcon({
          className: 'route-label',
          html: `<div style="background: ${color}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 12px; font-weight: bold;">${label}</div>`,
          iconSize: [100, 20],
          iconAnchor: [50, 10]
        })
      }).addTo(map);
      
      // Store label marker for cleanup
      layersRef.current.push(labelMarker);
    }

    // Fit map to route bounds (only for the first route)
    if (coordinates.length > 0 && layersRef.current.length <= 2) {
      const bounds = L.latLngBounds(coordinates);
      map.fitBounds(bounds, { padding: [20, 20] });
    }

    // Add start and end markers (only for the first route)
    if (coordinates.length > 1 && layersRef.current.length <= 2) {
      const startIcon = L.divIcon({
        html: '<div class="w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>',
        className: 'custom-marker',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });

      const endIcon = L.divIcon({
        html: '<div class="w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>',
        className: 'custom-marker',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });

      const startMarker = L.marker(coordinates[0], { icon: startIcon }).addTo(map);
      const endMarker = L.marker(coordinates[coordinates.length - 1], { icon: endIcon }).addTo(map);
      
      // Store markers for cleanup
      layersRef.current.push(startMarker, endMarker);
    }
  };

  if (!gpxData && !gpxUrl) {
    return (
      <div className={`${className} bg-gray-100 rounded-lg flex items-center justify-center`}>
        <p className="text-gray-500 text-sm">No route data available</p>
      </div>
    );
  }

  return (
    <div className={`${className} rounded-lg overflow-hidden relative`}>
      <div ref={mapRef} className="w-full h-full" />
      {showFullscreen && (
        <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded text-xs text-gray-600">
          {interactive ? 'Interactive Map' : 'Route Preview'}
        </div>
      )}
    </div>
  );
}

export { type GPXStats };