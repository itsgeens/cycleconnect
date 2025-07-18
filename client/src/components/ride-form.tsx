import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authManager } from "../lib/auth";
import { Upload, MapPin } from "lucide-react";

interface RideFormProps {
  onSuccess?: () => void;
}

export default function RideForm({ onSuccess }: RideFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    dateTime: "",
    rideType: "",
    surfaceType: "",
    meetupLocation: "",
    meetupCoords: { lat: 0, lng: 0 },
  });
  const [gpxFile, setGpxFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createRideMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const headers = authManager.getAuthHeaders();
      const response = await fetch("/api/rides", {
        method: "POST",
        headers,
        body: data,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create ride");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Ride created!",
        description: "Your ride has been successfully created.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create ride",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!gpxFile) {
      toast({
        title: "GPX file required",
        description: "Please upload a GPX file for your route.",
        variant: "destructive",
      });
      return;
    }

    const formDataToSend = new FormData();
    formDataToSend.append("name", formData.name);
    formDataToSend.append("description", formData.description);
    formDataToSend.append("dateTime", formData.dateTime);
    formDataToSend.append("rideType", formData.rideType);
    formDataToSend.append("surfaceType", formData.surfaceType);
    formDataToSend.append("meetupLocation", formData.meetupLocation);
    formDataToSend.append("meetupCoords", JSON.stringify(formData.meetupCoords));
    formDataToSend.append("gpxFile", gpxFile);

    createRideMutation.mutate(formDataToSend);
  };

  const handleLocationClick = () => {
    // Simulate location selection - in a real app, this would open a map
    const locations = [
      { name: "Central Park", lat: 40.7829, lng: -73.9654 },
      { name: "Golden Gate Park", lat: 37.7694, lng: -122.4862 },
      { name: "Millennium Park", lat: 41.8826, lng: -87.6226 },
    ];
    const randomLocation = locations[Math.floor(Math.random() * locations.length)];
    setFormData(prev => ({
      ...prev,
      meetupLocation: randomLocation.name,
      meetupCoords: { lat: randomLocation.lat, lng: randomLocation.lng },
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a New Ride</CardTitle>
        <CardDescription>Organize your next group cycling adventure</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="name">Ride Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Morning Coffee Ride"
                required
              />
            </div>

            <div>
              <Label htmlFor="dateTime">Date & Time *</Label>
              <Input
                id="dateTime"
                type="datetime-local"
                value={formData.dateTime}
                onChange={(e) => setFormData(prev => ({ ...prev, dateTime: e.target.value }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="rideType">Ride Type *</Label>
              <Select value={formData.rideType} onValueChange={(value) => setFormData(prev => ({ ...prev, rideType: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select ride type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coffee">Coffee</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="threshold">Threshold</SelectItem>
                  <SelectItem value="zone2">Zone 2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="surfaceType">Surface Type *</Label>
              <Select value={formData.surfaceType} onValueChange={(value) => setFormData(prev => ({ ...prev, surfaceType: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select surface type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paved">Paved</SelectItem>
                  <SelectItem value="gravel">Gravel</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="gpxFile">Route GPX File *</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-cycling-blue transition-colors">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <div className="text-sm text-gray-600">
                <label htmlFor="gpxFile" className="cursor-pointer">
                  <span className="font-medium text-cycling-blue hover:text-blue-500">
                    Upload a GPX file
                  </span>
                  <input
                    id="gpxFile"
                    type="file"
                    className="sr-only"
                    accept=".gpx"
                    onChange={(e) => setGpxFile(e.target.files?.[0] || null)}
                  />
                </label>
                <p className="mt-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {gpxFile ? `Selected: ${gpxFile.name}` : "GPX files up to 10MB"}
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="meetupLocation">Meetup Location *</Label>
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <div 
                className="h-64 bg-gray-200 relative cursor-pointer hover:bg-gray-300 transition-colors"
                onClick={handleLocationClick}
              >
                <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
                  <div className="text-white text-center">
                    <MapPin className="mx-auto h-8 w-8 mb-2" />
                    <p className="text-sm">
                      {formData.meetupLocation ? `Selected: ${formData.meetupLocation}` : "Click to select meetup location"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white">
                <Input
                  value={formData.meetupLocation}
                  onChange={(e) => setFormData(prev => ({ ...prev, meetupLocation: e.target.value }))}
                  placeholder="Search for a location or click on the map"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Ride Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Tell riders what to expect on this ride..."
              rows={4}
            />
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={createRideMutation.isPending}
          >
            {createRideMutation.isPending ? "Creating Ride..." : "Create Ride"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
