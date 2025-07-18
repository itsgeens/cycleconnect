import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RideFiltersProps {
  onFiltersChange: (filters: any) => void;
}

export default function RideFilters({ onFiltersChange }: RideFiltersProps) {
  const [filters, setFilters] = useState({
    distance: "any",
    date: "any",
    time: "any",
    rideType: "any",
    surfaceType: "any",
  });

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    // Remove empty filters and "any" values
    const cleanFilters = Object.fromEntries(
      Object.entries(newFilters).filter(([_, v]) => v !== "" && v !== "any")
    );
    
    onFiltersChange(cleanFilters);
  };

  return (
    <div className="bg-gray-50 rounded-xl p-6 mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-2">Distance from me</Label>
          <Select value={filters.distance} onValueChange={(value) => handleFilterChange("distance", value)}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Any distance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any distance</SelectItem>
              <SelectItem value="0-5">Within 5 km</SelectItem>
              <SelectItem value="0-10">Within 10 km</SelectItem>
              <SelectItem value="0-20">Within 20 km</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm font-medium text-gray-700 mb-2">Date</Label>
          <Select value={filters.date} onValueChange={(value) => handleFilterChange("date", value)}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Any date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any date</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="tomorrow">Tomorrow</SelectItem>
              <SelectItem value="this-week">This week</SelectItem>
              <SelectItem value="next-week">Next week</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm font-medium text-gray-700 mb-2">Time</Label>
          <Select value={filters.time} onValueChange={(value) => handleFilterChange("time", value)}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Any time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any time</SelectItem>
              <SelectItem value="morning">Morning (6-12 PM)</SelectItem>
              <SelectItem value="afternoon">Afternoon (12-6 PM)</SelectItem>
              <SelectItem value="evening">Evening (6-10 PM)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm font-medium text-gray-700 mb-2">Ride Type</Label>
          <Select value={filters.rideType} onValueChange={(value) => handleFilterChange("rideType", value)}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">All types</SelectItem>
              <SelectItem value="coffee">Coffee</SelectItem>
              <SelectItem value="casual">Casual</SelectItem>
              <SelectItem value="threshold">Threshold</SelectItem>
              <SelectItem value="zone2">Zone 2</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm font-medium text-gray-700 mb-2">Surface</Label>
          <Select value={filters.surfaceType} onValueChange={(value) => handleFilterChange("surfaceType", value)}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="All surfaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">All surfaces</SelectItem>
              <SelectItem value="paved">Paved</SelectItem>
              <SelectItem value="gravel">Gravel</SelectItem>
              <SelectItem value="mixed">Mixed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
