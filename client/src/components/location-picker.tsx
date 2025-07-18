import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Search, Navigation } from "lucide-react";

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
          } catch (error) {
            onLocationSelect(`${lat.toFixed(4)}, ${lng.toFixed(4)}`, { lat, lng });
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
      <div className="h-64 bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center relative">
        <div className="absolute inset-0 bg-black bg-opacity-10"></div>
        <div className="relative z-10 text-center">
          <MapPin className="mx-auto h-12 w-12 text-cycling-blue mb-4" />
          <p className="text-gray-700 font-medium mb-2">
            {selectedLocation ? `Selected: ${selectedLocation}` : "Select a meetup location"}
          </p>
          <p className="text-sm text-gray-600">
            Search below or choose from popular locations
          </p>
        </div>
      </div>
      
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
        </div>
        
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Popular Cycling Locations:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {POPULAR_LOCATIONS.map((location, index) => (
              <Button
                key={index}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleLocationSelect(location)}
                className="text-left justify-start p-2 h-auto"
              >
                <MapPin className="w-3 h-3 mr-2 flex-shrink-0" />
                <span className="text-xs">{location.name}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}