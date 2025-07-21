import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css'; // Import Leaflet CSS
import 'leaflet-gpx'; // Import leaflet-gpx

// You might still need calculateDistance if leaflet-gpx doesn't provide total distance easily
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

    // Load and display GPX data
    const loadGPXData = async () => {
      // Function to add a GPX layer to the map
      const addGpxLayer = (url: string, color: string, pane: string, label?: string) => {
        if (!mapInstanceRef.current) return;

        // Use L.GPX from leaflet-gpx
        const gpxLayer = new L.GPX(url, {
          async: true,
          polyline_options: {
            color: color,
            weight: pane === 'actualRoute' ? 4 : 3,
            opacity: pane === 'actualRoute' ? 0.9 : 0.7,
            pane: pane
          },
          marker_options: {
            startIconUrl: '', // leaflet-gpx has default markers, you can customize or disable
            endIconUrl: '',
            shadowUrl: '',
          },
          // You can use this callback to get data after parsing if needed
          // gpx_loaded_callback: function(e) {
          //   const gpx = e.target;
          //   console.log('leaflet-gpx: Loaded GPX data:', gpx);
          //   console.log('leaflet-gpx: Total distance:', gpx.getDistance()); // Distance in meters
          //   console.log('leaflet-gpx: Elevation gain:', gpx.getElevationGain()); // Elevation gain in meters
          // }
        }); // Remove the .on('loaded', ...) here

        // Add event listener separately, accessing gpxLayer directly
        gpxLayer.on('loaded', function() {
           console.log(`leaflet-gpx (${label || ''}): Loaded GPX data. Distance: ${gpxLayer.get_distance()}m, Elevation Gain: ${gpxLayer.get_elevation_gain()}m`);
    
            // Add label if provided
            if (label && gpxLayer.getLayers().length > 0) { // Use gpxLayer here too
              const layers = gpxLayer.getLayers(); // Get individual layers
              const polylineLayer = layers.find((layer: L.Layer) => layer instanceof L.Polyline);
    
              if (polylineLayer) {
                const coordinates = (polylineLayer as L.Polyline).getLatLngs(); // Cast to L.Polyline to access getLatLngs
    
                 if (coordinates && coordinates.length > 0) {
                  const midPoint = coordinates[Math.floor(coordinates.length / 2)] as L.LatLng; // Type assertion
                    const labelMarker = L.marker(midPoint, {
                      icon: L.divIcon({
                        className: 'route-label',
                        html: `<div style=\"background: ${color}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 12px; font-weight: bold;\">${label}</div>`,
                        iconSize: [100, 20],
                        iconAnchor: [50, 10]
                      })
                    }).addTo(mapInstanceRef.current!);
                     layersRef.current.push(labelMarker); // Store label marker for cleanup
                  }
              }
            }
    
    
             // Fit map to route bounds after both layers are potentially added
            setTimeout(() => {
              const bounds = new L.LatLngBounds([]);
               layersRef.current.forEach(layer => {
                  if (layer instanceof L.Polyline) {
                     bounds.extend((layer as L.Polyline).getBounds()); // Cast for getBounds
                  }
               });
    
              if (bounds.isValid()) {
                 mapInstanceRef.current?.fitBounds(bounds, { padding: [50, 50] });
              } else {
                 console.warn('leaflet-gpx: Bounds are not valid, cannot fit map.');
              }
            }, 200);
    
    
        }); // Add the event listener here
    
        // Store layer for cleanup
        layersRef.current.push(gpxLayer);    

      // Load primary GPX
      if (gpxUrl) {
         const API_BASE_URL = import.meta.env.VITE_API_URL || '';
         const backendGpxUrl = `${API_BASE_URL}/api/gpx/${encodeURIComponent(gpxUrl)}`;
         addGpxLayer(backendGpxUrl, '#3b82f6', 'plannedRoute', 'Planned Route');
      } else if (gpxData) {
         // leaflet-gpx can also load from a string, but it's less common in examples.
         // You might need to save gpxData to a Blob or a temporary URL first if direct string loading isn't supported or straightforward.
         console.error("Direct loading of gpxData string with leaflet-gpx is not straightforward. Please use gpxUrl.");
         // As a workaround for gpxData, you might have to fetch it from a temporary URL on your backend if you can't use gpxUrl directly.
      }


      // Load secondary GPX
      if (secondaryGpxUrl) {
         const API_BASE_URL = import.meta.env.VITE_API_URL || '';
         const backendSecondaryGpxUrl = `${API_BASE_URL}/api/gpx/${encodeURIComponent(secondaryGpxUrl)}`;
         addGpxLayer(backendSecondaryGpxUrl, '#22c55e', 'actualRoute', 'Organizer\'s Actual Route');
      }

    };

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
  }, [gpxData, gpxUrl, secondaryGpxUrl, interactive]; // Re-run effect if these change


   // Removed parseGPXData function as leaflet-gpx handles parsing for display


  // Removed displayGPXRoute function as leaflet-gpx handles adding layer to map


  // You might still need calculateDistance if you need it elsewhere or for fallback distance calculation in useGPXStats

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

export { type GPXStats }

}