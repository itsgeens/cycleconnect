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

// Assuming GPXStats interface is defined in shared/gpx-types.ts
// You might need to adjust the import path based on your project structure
// import { type GPXStats } from '../../shared/gpx-types'; // Example import path

// Assuming GPXStats interface is defined in shared/gpx-types.ts
import { type GPXStats } from '@shared/gpx-types'; // ADJUST IMPORT PATH IF NECESSARY

interface GPXMapPreviewProps {
  gpxData?: string; // Although leaflet-gpx prefers URL, keeping for potential future use or fallback
  gpxUrl?: string;
  secondaryGpxUrl?: string; // For showing organizer's route
  className?: string;
  interactive?: boolean;
  showFullscreen?: boolean;
  stats?: GPXStats | null; // <--- ADD THIS PROP
}

export default function GPXMapPreview({ gpxData, gpxUrl, secondaryGpxUrl, className = "h-48", interactive = false, showFullscreen = false, stats }: GPXMapPreviewProps) { // <--- INCLUDE stats in destructuring
  console.log('GPXMapPreview component rendered.');
  console.log('GPXMapPreview props:', { gpxData, gpxUrl, secondaryGpxUrl, className, interactive, showFullscreen });

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]); // To keep track of layers for cleanup

  // Load and display GPX data - Defined inside component, but outside useEffect
  const loadGPXData = async () => {
    // Function to add a GPX layer to the map
  } // closes load gpx data
  const addGpxLayer = (url: string, color: string, pane: string, label?: string) => {
    console.log(`GPXMapPreview: addGpxLayer called for URL: ${url}`);
    if (!mapInstanceRef.current) {
      console.log('GPXMapPreview: mapInstanceRef.current is null in addGpxLayer, returning.');
      return;
    }

    // Use L.GPX from leaflet-gpx
    const gpxLayer = new L.GPX(url, {
      async: true, // Load asynchronously
      polyline_options: {
        color: color,
        weight: pane === 'actualRoute' ? 4 : 3,
        opacity: pane === 'actualRoute' ? 0.9 : 0.7,
        pane: pane // Assign to custom pane for layering
      },
      marker_options: {
        startIconUrl: '', // Use default markers, or provide URLs to customize/disable
        endIconUrl: '',
        shadowUrl: '',
      }
    });

    // Add event listener separately, accessing gpxLayer directly
    gpxLayer.on('loaded', function(this: L.GPX) { // Added 'this: L.GPX'
        console.log('leaflet-gpx (' + (label || 'Layer') + '): Loaded GPX data.');

        // Added a setTimeout to allow leaflet-gpx to process bounds after loading
        setTimeout(() => {
            if (mapInstanceRef.current && this.getBounds().isValid()) {
                console.log('GPXMapPreview: Attempting to fit map bounds.');
                mapInstanceRef.current.fitBounds(this.getBounds());
            } else {
                console.log('leaflet-gpx: Bounds are not valid, cannot fit map.');
                // Fallback: if primary GPX bounds are invalid, try secondary or a default view
                // You might need to add logic here to get bounds from the secondary layer if it exists
                // For now, just log a warning
                console.warn('GPXMapPreview: Primary GPX bounds invalid. Consider adding fallback logic.');
            }
        }, 0); // Use a small delay, 0ms should be sufficient in most cases


    }); // Closes the gpxLayer.on('loaded', ...) call
    
    // Add label if provided
    if (label && gpxLayer.getLayers().length > 0) { // Use gpxLayer here too
      const layers = gpxLayer.getLayers(); // Get individual layers
      const polylineLayer = layers.find((layer: L.Layer) => layer instanceof L.Polyline);

      if (polylineLayer) {
        const coordinates = (polylineLayer as L.Polyline).getLatLngs(); // Cast to L.Polyline to access getLatLngs

         if (coordinates && coordinates.length > 0) {
          // Safely get the middle point - assuming coordinates is at least 1 level deep array of LatLng
          const midPointCoords = Array.isArray(coordinates[0]) ? coordinates[0][Math.floor(coordinates[0].length / 2)] : coordinates[Math.floor(coordinates.length / 2)];

          if (midPointCoords && 'lat' in midPointCoords && 'lng' in midPointCoords) {
               const midPoint = midPointCoords as L.LatLng; // Type assertion
                const labelMarker = L.marker(midPoint, {
                  icon: L.divIcon({
                    className: 'route-label',
                    html: `<div style="background: ${color}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 12px; font-weight: bold;">${label}</div>`,
                    iconSize: [100, 20],
                    iconAnchor: [50, 10]
                  })
                }).addTo(mapInstanceRef.current!);
                 layersRef.current.push(labelMarker); // Store label marker for cleanup
            }
          }
        }
    }

     // Add the GPX layer to the map
    gpxLayer.addTo(mapInstanceRef.current!);
    // Store layer for cleanup
    layersRef.current.push(gpxLayer);


     // Fit map to route bounds after both layers are potentially added
    // Using a small timeout to ensure rendering is done
    setTimeout(() => {
      console.log('GPXMapPreview: Attempting to fit map bounds using gpxLayer.getBounds().');
      const bounds = gpxLayer.getBounds(); // <--- Use gpxLayer.getBounds() directly

      if (bounds.isValid()) {
         mapInstanceRef.current?.fitBounds(bounds, { padding: [50, 50] });
         console.log('GPXMapPreview: Map bounds are valid, fitted map.');
      } else {
         console.warn('leaflet-gpx: Bounds are not valid from gpxLayer.getBounds(), cannot fit map.');
         // Optional: Try collecting bounds from all layers in layersRef.current as a fallback
         const fallbackBounds = new L.LatLngBounds([]);
          layersRef.current.forEach(layer => {
             if (layer instanceof L.Polyline) {
                fallbackBounds.extend((layer as L.Polyline).getBounds());
             } else if (layer instanceof L.GPX) { // Also check GPX layers in the ref
                fallbackBounds.extend(layer.getBounds());
             }
          });
         if (fallbackBounds.isValid()) {
            mapInstanceRef.current?.fitBounds(fallbackBounds, { padding: [50, 50] });
            console.log('GPXMapPreview: Fallback bounds are valid, fitted map.');
         } else {
            console.warn('leaflet-gpx: Fallback bounds are also not valid, cannot fit map.');
         }
      }
    }, 200); // Keep the timeout for now, might help with rendering timing


  }; // Closes the addGpxLayer function

  // Fetch and add GPX layers based on provided URLs
  const fetchAndAddGpxLayers = async () => {
    console.log('GPXMapPreview: fetchAndAddGpxLayers called.');
    const API_BASE_URL = import.meta.env.VITE_API_URL || '';

    if (gpxUrl) {
       const backendGpxUrl = `${API_BASE_URL}/api/gpx/${encodeURIComponent(gpxUrl)}`;
       addGpxLayer(backendGpxUrl, '#3b82f6', 'plannedRoute', 'Planned Route');
    } else if (gpxData) {
       // Direct loading of gpxData string with leaflet-gpx might require saving to a temp URL/Blob
       console.error("Direct loading of gpxData string with leaflet-gpx is not straightforward. Please use gpxUrl.");
       // As a workaround for gpxData, you might have to fetch it from a temporary URL on your backend if you can't use gpxUrl directly.
    }

    if (secondaryGpxUrl) {
       const backendSecondaryGpxUrl = `${API_BASE_URL}/api/gpx/${encodeURIComponent(secondaryGpxUrl)}`;
       addGpxLayer(backendSecondaryGpxUrl, '#22c55e', 'actualRoute', `Organizer's Actual Route`); // Used template literal
    }
  }; // Closes the fetchAndAddGpxLayers function

  // Effect hook for map initialization and cleanup
  useEffect(() => {
    console.log('GPXMapPreview useEffect running.');
    if (!mapRef.current) {
      console.log('GPXMapPreview: mapRef.current is null, returning.');
      return;
    }
    console.log('GPXMapPreview: mapRef.current is available, initializing map.');

    // Initialize map
    const map = L.map(mapRef.current, {
      zoomControl: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      dragging: interactive,
      touchZoom: interactive,
    }).setView([37.7749, -122.4194], 13); // Default view, will be adjusted by fitBounds

    // Create custom panes for proper layering
    map.createPane('plannedRoute');
    map.getPane('plannedRoute')!.style.zIndex = '400';

    map.createPane('actualRoute');
    map.getPane('actualRoute')!.style.zIndex = '450';

    // Add base tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    mapInstanceRef.current = map; // Store map instance in ref

    // Call the function to fetch and add GPX layers
    fetchAndAddGpxLayers();

    // Cleanup function to remove map and layers
    return () => {
      console.log('GPXMapPreview useEffect cleanup running.');
      // Clean up layers
      layersRef.current.forEach(layer => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(layer);
        }
      });
      layersRef.current = []; // Clear the layers ref

      // Remove the map instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null; // Clear the map instance ref
      }
    };
  }, [gpxUrl, secondaryGpxUrl, interactive]); // Re-run effect if these change

  // Conditional rendering: Show message if no data, otherwise show map container
  if (!gpxUrl && !gpxData) {
    return (
      <div className={`${className} bg-gray-100 rounded-lg flex items-center justify-center`}>
        <p className="text-gray-500 text-sm">No route data available</p>
      </div>
    );
  }

  // Render the map container
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

// Removed export of GPXStats from here as it should be in a shared file

// Optional: Re-export GPXStats from a shared file if needed elsewhere
// export { type GPXStats } from '../../shared/gpx-types'
