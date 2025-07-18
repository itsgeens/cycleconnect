import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface GPXMapPreviewProps {
  gpxData?: string;
  gpxUrl?: string;
  className?: string;
  interactive?: boolean;
  showFullscreen?: boolean;
}

interface GPXStats {
  distance: number;
  elevationGain: number;
  coordinates: [number, number][];
}

export default function GPXMapPreview({ gpxData, gpxUrl, className = "h-48", interactive = false, showFullscreen = false }: GPXMapPreviewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const gpxLayerRef = useRef<L.Polyline | null>(null);

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

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    mapInstanceRef.current = map;

    // Load and display GPX data
    const loadGPXData = async () => {
      let gpxContent = gpxData;
      
      if (gpxUrl && !gpxContent) {
        try {
          const response = await fetch(gpxUrl);
          if (response.ok) {
            gpxContent = await response.text();
          }
        } catch (error) {
          console.error('Failed to load GPX file:', error);
          return;
        }
      }

      if (gpxContent) {
        const stats = parseGPXData(gpxContent);
        if (stats.coordinates.length > 0) {
          displayGPXRoute(map, stats.coordinates);
        }
      }
    };

    loadGPXData();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [gpxData, gpxUrl, interactive]);

  const parseGPXData = (gpxContent: string): GPXStats => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');
    
    const coordinates: [number, number][] = [];
    let totalDistance = 0;
    let elevationGain = 0;
    let previousElevation = 0;

    // Extract track points
    const trackPoints = xmlDoc.querySelectorAll('trkpt');
    
    trackPoints.forEach((point, index) => {
      const lat = parseFloat(point.getAttribute('lat') || '0');
      const lon = parseFloat(point.getAttribute('lon') || '0');
      const eleElement = point.querySelector('ele');
      const elevation = eleElement ? parseFloat(eleElement.textContent || '0') : 0;

      if (lat && lon) {
        coordinates.push([lat, lon]);
        
        // Calculate elevation gain
        if (index > 0 && elevation > previousElevation) {
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
      distance: totalDistance,
      elevationGain: elevationGain,
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

  const displayGPXRoute = (map: L.Map, coordinates: [number, number][]) => {
    if (coordinates.length === 0) return;

    // Remove existing layer
    if (gpxLayerRef.current) {
      map.removeLayer(gpxLayerRef.current);
    }

    // Create route polyline
    gpxLayerRef.current = L.polyline(coordinates, {
      color: '#3b82f6',
      weight: 3,
      opacity: 0.8
    }).addTo(map);

    // Fit map to route bounds
    const bounds = L.latLngBounds(coordinates);
    map.fitBounds(bounds, { padding: [20, 20] });

    // Add start and end markers
    if (coordinates.length > 1) {
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

      L.marker(coordinates[0], { icon: startIcon }).addTo(map);
      L.marker(coordinates[coordinates.length - 1], { icon: endIcon }).addTo(map);
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