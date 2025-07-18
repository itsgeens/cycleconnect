import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Search, Navigation } from "lucide-react";
import L from 'leaflet';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface LocationPickerProps {
  onLocationSelect: (location: string, coords: { lat: number; lng: number }) => void;
  selectedLocation: string;
}

// Popular cycling locations for quick selection
const POPULAR_LOCATIONS = [
  { name: "Central Park, New York", lat: 40.7829, lng: -73.9654 },
  { name: "Golden Gate Park, San Francisco", lat: 37.7694, lng: -122.4862 },
  { name: "Millennium Park, Chicago", lat: 41.8826, lng: -87.6226 },
  { name: "Griffith Park, Los Angeles", lat: 34.1365, lng: -118.2940 },
  { name: "Discovery Park, Seattle", lat: 47.6553, lng: -122.4035 },
  { name: "Balboa Park, San Diego", lat: 32.7341, lng: -117.1537 },
];

export default function LocationPicker({ onLocationSelect, selectedLocation }: LocationPickerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (showMap && mapRef.current && !mapInstanceRef.current) {
      initializeMap();
    }
  }, [showMap]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const initializeMap = () => {
    if (!mapRef.current) return;

    const map = L.map(mapRef.current).setView([37.7749, -122.4194], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    mapInstanceRef.current = map;

    // Add click handler to map
    map.on('click', (e) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      
      // Reverse geocode to get address
      reverseGeocode(lat, lng);
      setSelectedCoords({ lat, lng });
      addMarker(lat, lng);
    });

    // Try to get user's location for initial map center
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          map.setView([lat, lng], 13);
        },
        () => {
          // If geolocation fails, keep default location
        }
      );
    }
  };

  const addMarker = (lat: number, lng: number) => {
    if (!mapInstanceRef.current) return;

    // Remove existing marker
    if (markerRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current);
    }

    // Add new marker
    markerRef.current = L.marker([lat, lng]).addTo(mapInstanceRef.current);
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await response.json();
      const address = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      onLocationSelect(address, { lat, lng });
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      onLocationSelect(`${lat.toFixed(4)}, ${lng.toFixed(4)}`, { lat, lng });
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    
    try {
      // Use OpenStreetMap Nominatim API for geocoding (free alternative to Google Maps)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&limit=1`
      );
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        
        onLocationSelect(result.display_name, { lat, lng });
        setSelectedCoords({ lat, lng });
        
        // Update map if it's visible
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 15);
          addMarker(lat, lng);
        }
      } else {
        // If no results, show a message
        alert("Location not found. Please try a different search term.");
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      alert("Error searching for location. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleLocationSelect = (location: { name: string; lat: number; lng: number }) => {
    onLocationSelect(location.name, { lat: location.lat, lng: location.lng });
    setSelectedCoords({ lat: location.lat, lng: location.lng });
    
    // Update map if it's visible
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([location.lat, location.lng], 15);
      addMarker(location.lat, location.lng);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          try {
            // Reverse geocode to get address
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
            );
            
            const data = await response.json();
            const address = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            
            onLocationSelect(address, { lat, lng });
            setSelectedCoords({ lat, lng });
            
            // Update map if it's visible
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setView([lat, lng], 15);
              addMarker(lat, lng);
            }
          } catch (error) {
            const coords = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            onLocationSelect(coords, { lat, lng });
            setSelectedCoords({ lat, lng });
            
            // Update map if it's visible
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setView([lat, lng], 15);
              addMarker(lat, lng);
            }
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          alert("Unable to get your location. Please search for a location instead.");
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {!showMap ? (
        <div className="h-64 bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center relative">
          <div className="absolute inset-0 bg-black bg-opacity-10"></div>
          <div className="relative z-10 text-center">
            <MapPin className="mx-auto h-12 w-12 text-cycling-blue mb-4" />
            <p className="text-gray-700 font-medium mb-2">
              {selectedLocation ? `Selected: ${selectedLocation}` : "Select a meetup location"}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Search below or choose from popular locations
            </p>
            <Button 
              type="button" 
              onClick={() => setShowMap(true)}
              variant="outline"
              size="sm"
              className="bg-white/80 hover:bg-white"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Show Map Preview
            </Button>
          </div>
        </div>
      ) : (
        <div className="h-64 relative">
          <div ref={mapRef} className="h-full w-full" />
          <Button
            type="button"
            onClick={() => setShowMap(false)}
            variant="outline"
            size="sm"
            className="absolute top-2 right-2 bg-white/90 hover:bg-white z-[1000]"
          >
            Hide Map
          </Button>
        </div>
      )}
      
      <div className="p-4 bg-white space-y-4">
        <div className="flex space-x-2">
          <Input
            type="text"
            placeholder="Search for a location (e.g., Central Park, NYC)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button 
            type="button" 
            onClick={handleSearch} 
            size="sm"
            disabled={isSearching}
          >
            <Search className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex justify-between items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={getCurrentLocation}
            className="flex items-center space-x-2"
          >
            <Navigation className="w-4 h-4" />
            <span>Use My Location</span>
          </Button>
          {showMap && (
            <p className="text-xs text-gray-500">
              Click on the map to select a location
            </p>
          )}
        </div>
        
        
      </div>
    </div>
  );
}