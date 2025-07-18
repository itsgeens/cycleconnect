import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import GPXMapPreview from "@/components/gpx-map-preview";
import { 
  Clock, 
  MapPin, 
  TrendingUp, 
  Zap, 
  Heart, 
  Users,
  Trophy,
  Calendar,
  Target,
  Activity
} from "lucide-react";
import { format } from "date-fns";

interface ActivityCardProps {
  activity: any;
  type: 'group' | 'solo';
}

export default function ActivityCard({ activity, type }: ActivityCardProps) {
  const [, navigate] = useLocation();

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatDistance = (km: number) => {
    return km ? `${parseFloat(km.toString()).toFixed(1)} km` : 'N/A';
  };

  const formatSpeed = (kmh: number) => {
    return kmh ? `${parseFloat(kmh.toString()).toFixed(1)} km/h` : 'N/A';
  };

  // Calculate average speed based on active time if available
  const getAverageSpeed = () => {
    if (activity.averageSpeed) {
      return activity.averageSpeed;
    }
    // Fallback: calculate from distance and moving time
    if (activity.distance && activity.movingTime) {
      const distanceKm = parseFloat(activity.distance.toString());
      const timeHours = activity.movingTime / 3600;
      return distanceKm / timeHours;
    }
    return null;
  };

  const formatElevation = (meters: number) => {
    return meters ? `${Math.round(parseFloat(meters.toString()))} m` : 'N/A';
  };

  const handleCardClick = () => {
    if (type === 'group') {
      navigate(`/ride/${activity.id}`);
    }
  };

  const completedDate = activity.completedAt || activity.createdAt;
  const isGroup = type === 'group';

  return (
    <Card 
      className={`w-full transition-all duration-200 ${
        isGroup ? 'hover:shadow-md cursor-pointer' : ''
      } hover:border-gray-300`}
      onClick={isGroup ? handleCardClick : undefined}
    >
      <div className="relative">
        {/* GPX Map Preview */}
        <GPXMapPreview
          gpxUrl={activity.gpxFilePath}
          className="h-48"
          interactive={false}
        />
        
        {/* Activity Type Badge */}
        <div className="absolute top-2 left-2 flex gap-1">
          <Badge variant="secondary" className={`text-xs ${
            isGroup ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
          }`}>
            {isGroup ? 'Group Ride' : 'Solo Activity'}
          </Badge>
          {activity.activityType && (
            <Badge variant="secondary" className="bg-gray-100 text-gray-800 text-xs">
              {activity.activityType}
            </Badge>
          )}
        </div>
      </div>
      
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {isGroup ? (
                <Users className="w-5 h-5 text-blue-600" />
              ) : (
                <Activity className="w-5 h-5 text-green-600" />
              )}
              <h3 className="font-semibold text-lg text-gray-900">
                {activity.name}
              </h3>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <Calendar className="w-4 h-4" />
              <span>
                Completed on {format(new Date(completedDate), 'MMM dd, yyyy')}
              </span>
            </div>

            {activity.description && (
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                {activity.description}
              </p>
            )}
          </div>

          {isGroup && (
            <Trophy className="w-6 h-6 text-yellow-500 ml-4 flex-shrink-0" />
          )}
        </div>

        {/* Activity Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-xs text-gray-500">Distance</p>
              <p className="font-medium">
                {formatDistance(activity.distance)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-xs text-gray-500">Active Time</p>
              <div className="font-medium">
                {activity.movingTime ? (
                  <div>
                    <div className="text-green-600 font-semibold">{formatDuration(activity.movingTime)}</div>
                    {activity.duration && activity.duration !== activity.movingTime && (
                      <div className="text-xs text-gray-500">Total: {formatDuration(activity.duration)}</div>
                    )}
                  </div>
                ) : activity.duration ? (
                  formatDuration(activity.duration)
                ) : (
                  'N/A'
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-xs text-gray-500">Elevation</p>
              <p className="font-medium">
                {formatElevation(activity.elevationGain)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-xs text-gray-500">Avg Speed</p>
              <p className="font-medium">
                {formatSpeed(getAverageSpeed())}
              </p>
              {activity.movingTime && (
                <p className="text-xs text-gray-500">Based on active time</p>
              )}
            </div>
          </div>

          {activity.averageHeartRate && (
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-500" />
              <div>
                <p className="text-xs text-gray-500">Heart Rate</p>
                <p className="font-medium">
                  Avg: {activity.averageHeartRate} bpm
                </p>
                {activity.maxHeartRate && (
                  <p className="text-xs text-gray-500">Max: {activity.maxHeartRate} bpm</p>
                )}
              </div>
            </div>
          )}

          {activity.deviceName && (
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-xs text-gray-500">Device</p>
                <p className="font-medium text-xs">
                  {activity.deviceName}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {isGroup && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {activity.rideType || 'casual'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {activity.surfaceType || 'paved'}
                </Badge>
              </div>
            )}
            {!isGroup && activity.activityType && (
              <Badge variant="outline" className="text-xs">
                {activity.activityType}
              </Badge>
            )}
          </div>

          {isGroup && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/ride/${activity.id}`);
              }}
            >
              View Ride Details
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}