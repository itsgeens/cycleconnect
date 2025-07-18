import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authManager } from "../lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Calendar, MapPin, Users } from "lucide-react";
import { format } from "date-fns";

interface RideCardProps {
  ride: {
    id: number;
    name: string;
    description: string;
    dateTime: string;
    rideType: string;
    surfaceType: string;
    meetupLocation: string;
    organizerName: string;
    participantCount: number;
  };
}

export default function RideCard({ ride }: RideCardProps) {
  const [isJoined, setIsJoined] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const joinRideMutation = useMutation({
    mutationFn: async (rideId: number) => {
      const headers = authManager.getAuthHeaders();
      const response = await fetch(`/api/rides/${rideId}/join`, {
        method: "POST",
        headers,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to join ride");
      }
      
      return response.json();
    },
    onSuccess: () => {
      setIsJoined(true);
      toast({
        title: "Joined ride!",
        description: "You've successfully joined this ride.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to join ride",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleJoinRide = () => {
    joinRideMutation.mutate(ride.id);
  };

  const getRideTypeColor = (type: string) => {
    switch (type) {
      case "coffee":
        return "bg-amber-100 text-amber-800";
      case "casual":
        return "bg-cycling-blue text-white";
      case "threshold":
        return "bg-energy-red text-white";
      case "zone2":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getSurfaceTypeColor = (type: string) => {
    switch (type) {
      case "paved":
        return "bg-nature-green text-white";
      case "gravel":
        return "bg-amber-600 text-white";
      case "mixed":
        return "bg-blue-600 text-white";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-shadow">
      <div className="relative">
        <div className="w-full h-48 bg-gradient-to-br from-cycling-blue to-blue-700"></div>
        <div className="absolute top-4 left-4 flex space-x-2">
          <Badge className={getRideTypeColor(ride.rideType)}>
            {ride.rideType.charAt(0).toUpperCase() + ride.rideType.slice(1)}
          </Badge>
          <Badge className={getSurfaceTypeColor(ride.surfaceType)}>
            {ride.surfaceType.charAt(0).toUpperCase() + ride.surfaceType.slice(1)}
          </Badge>
        </div>
      </div>
      
      <CardContent className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">{ride.name}</h3>
        <p className="text-gray-600 mb-4 line-clamp-2">
          {ride.description || "Join us for this exciting ride!"}
        </p>
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="w-4 h-4 mr-1" />
            <span>{format(new Date(ride.dateTime), "EEE, MMM dd • h:mm a")}</span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <MapPin className="w-4 h-4 mr-1" />
            <span>{ride.meetupLocation}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Users className="w-4 h-4 mr-2 text-gray-600" />
            <span className="text-sm text-gray-600">
              {ride.participantCount} {ride.participantCount === 1 ? "participant" : "participants"}
            </span>
          </div>
          <Button
            onClick={handleJoinRide}
            disabled={joinRideMutation.isPending || isJoined}
            className={isJoined ? "bg-nature-green hover:bg-nature-green" : ""}
          >
            {joinRideMutation.isPending 
              ? "Joining..." 
              : isJoined 
                ? "Joined!" 
                : "Join Ride"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
