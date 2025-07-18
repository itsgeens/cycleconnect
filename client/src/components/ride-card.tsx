import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGPXStats } from "@/hooks/use-gpx-stats";
import GPXMapPreview from "@/components/gpx-map-preview";
import { Calendar, Route, Mountain, Users, MapPin } from "lucide-react";
import { format } from "date-fns";
import { type Ride } from "@shared/schema";

interface RideCardProps {
  ride: Ride;
  onJoin: (rideId: number) => void;
  onLeave: (rideId: number) => void;
  onCardClick: (rideId: number) => void;
  isJoining?: boolean;
  isLeaving?: boolean;
  currentUserId?: number;
}

export default function RideCard({ 
  ride, 
  onJoin, 
  onLeave, 
  onCardClick,
  isJoining = false, 
  isLeaving = false,
  currentUserId 
}: RideCardProps) {
  const { stats } = useGPXStats(ride.gpxFilePath);
  
  const isParticipant = ride.participants?.some(p => p.id === currentUserId);
  const isOwner = ride.organizerId === currentUserId;

  const handleJoinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onJoin(ride.id);
  };

  const handleLeaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLeave(ride.id);
  };

  return (
    <Card 
      className="hover:shadow-md transition-all duration-200 cursor-pointer group"
      onClick={() => onCardClick(ride.id)}
    >
      <div className="relative">
        {/* GPX Map Preview */}
        <GPXMapPreview
          gpxUrl={ride.gpxFilePath}
          className="h-48"
          interactive={false}
        />
        
        {/* Tags overlaid on top left */}
        <div className="absolute top-2 left-2 flex gap-1">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
            {ride.rideType}
          </Badge>
          <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
            {ride.surfaceType}
          </Badge>
        </div>

        {/* Participant count overlaid on top right */}
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded px-2 py-1 flex items-center gap-1">
          <Users className="w-3 h-3 text-gray-600" />
          <span className="text-xs font-medium">{ride.participants?.length || 0}</span>
        </div>
      </div>

      <CardContent className="p-4">
        <div className="mb-3">
          <h3 className="font-semibold text-lg mb-1 group-hover:text-cycling-blue transition-colors">
            {ride.name}
          </h3>
          {ride.description && (
            <p className="text-sm text-gray-600 line-clamp-2">
              {ride.description}
            </p>
          )}
        </div>

        <div className="space-y-2 mb-4">
          {/* Date and Time */}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="font-medium">
              {ride.dateTime ? format(new Date(ride.dateTime), 'MMM d, yyyy') : 'Date TBD'}
            </span>
            <span className="text-gray-600">
              {ride.dateTime ? format(new Date(ride.dateTime), 'h:mm a') : ''}
            </span>
          </div>

          {/* Distance */}
          {stats && (
            <div className="flex items-center gap-2 text-sm">
              <Route className="w-4 h-4 text-gray-500" />
              <span className="font-medium">{stats.distance} km</span>
            </div>
          )}

          {/* Elevation Gain */}
          {stats && (
            <div className="flex items-center gap-2 text-sm">
              <Mountain className="w-4 h-4 text-gray-500" />
              <span className="font-medium">{stats.elevationGain} m</span>
            </div>
          )}

          {/* Location */}
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600 truncate">{ride.meetupLocation}</span>
          </div>
        </div>

        {/* Join/Leave Button */}
        {!isOwner && (
          <div className="flex justify-end">
            {isParticipant ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLeaveClick}
                disabled={isLeaving}
                className="text-sm"
              >
                {isLeaving ? 'Leaving...' : 'Leave Ride'}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleJoinClick}
                disabled={isJoining}
                className="text-sm"
              >
                {isJoining ? 'Joining...' : 'Join Ride'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}