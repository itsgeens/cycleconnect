import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Activity,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGPXStats } from "@/hooks/use-gpx-stats";

interface ActivityCardProps {
  activity: any;
  type: 'group' | 'solo';
}
// Helper function to calculate user level based on XP
const calculateLevel = (xp: number): number => {
  // Simple leveling formula: 100 XP per level starting at level 1
  // Adjust the divisor (100) for faster or slower leveling
  return Math.floor(xp / 100) + 1;
};

export default function ActivityCard({ activity, type }: ActivityCardProps) {
  const [, navigate] = useLocation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { stats } = useGPXStats(activity.gpxFilePath);

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
    // First try to calculate from distance and moving time for accuracy
    if (activity.distance && activity.movingTime) {
      const distanceKm = parseFloat(activity.distance.toString());
      const timeHours = activity.movingTime / 3600;
      const calculatedSpeed = distanceKm / timeHours;
      return calculatedSpeed;
    }
    // Fallback to stored average speed
    if (activity.averageSpeed) {
      return parseFloat(activity.averageSpeed.toString());
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

  const deleteActivityMutation = useMutation({
    mutationFn: (activityId: number) => apiRequest(`/api/activities/${activityId}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Activity deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete activity",
        variant: "destructive",
      });
    },
  });

  const handleDeleteActivity = () => {
    deleteActivityMutation.mutate(activity.id);
    setShowDeleteDialog(false);
  };

  const completedDate = activity.completedAt || activity.createdAt;
  const isGroup = type === 'group';

  // Query to get activity matches for group rides
  const { data: activityMatches, isLoading: isLoadingMatches } = useQuery({
    queryKey: ["/api/rides", activity.id, "activity-matches"],
    enabled: isGroup && showParticipantsModal,
  });

  // Helper function to safely parse date
  const formatCompletedDate = (date: string | Date) => {
    try {
      const parsedDate = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(parsedDate.getTime())) {
        return 'Unknown date';
      }
      return format(parsedDate, 'MMM dd, yyyy');
    } catch (error) {
      console.error('Date parsing error:', error);
      return 'Unknown date';
    }
  };

  // Debug log to see if userActivityData is being populated
  if (isGroup && activity.id === 9) {
    console.log('Activity data for ride 9 (FRESH):', {
      activityId: activity.id,
      userActivityData: activity.userActivityData,
      distance: activity.distance,
      hasUserData: !!activity.userActivityData,
      userDistance: activity.userActivityData?.distance,
      userMovingTime: activity.userActivityData?.movingTime,
      fullActivity: activity
    });
  }

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
          gpxUrl={activity.gpxFilePath?.split('/').pop()} // Removed '/api/gpx/' and template literal
          className="h-48"
          interactive={false}
          stats={stats}
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
                Completed on {formatCompletedDate(completedDate)}
              </span>
            </div>

            {activity.user?.xp !== undefined && ( // Check if user and xp exist
              <>
                <div className="flex items-center gap-2 text-sm text-gray-600"> {/* Reduced bottom margin for closer placement */}
                  <Trophy className="w-4 h-4 text-yellow-500" /> {/* Using Trophy icon for XP */}
                  <span>XP: {activity.user.xp}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3"> {/* Added bottom margin to space before description */}
                  <TrendingUp className="w-4 h-4 text-purple-500" /> {/* Using TrendingUp for Level */}
                  <span>Level: {calculateLevel(activity.user.xp)}</span>
                </div>
              </>
            )}

            {activity.xpEarned !== undefined && ( // Check if xpEarned exists
              <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" /> {/* Using Trophy icon for XP */}
                  <div>
                    <p className="text-xs text-gray-500">XP Earned</p>
                    <p className="font-medium">
                  {/* Ensure xpEarned is treated as a number and format it */}
                  {parseFloat(activity.xpEarned.toString()).toFixed(2)} XP
                    </p>
                  </div>
              </div>
        )}

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
                {formatDistance(
                  isGroup && activity.userActivityData?.distance 
                    ? activity.userActivityData.distance 
                    : activity.distance
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-xs text-gray-500">Active Time</p>
              <div className="font-medium">
                {(() => {
                  const userMovingTime = isGroup && activity.userActivityData?.movingTime;
                  const userDuration = isGroup && activity.userActivityData?.duration;
                  const movingTime = userMovingTime || activity.movingTime;
                  const duration = userDuration || activity.duration;
                  
                  return movingTime ? (
                    <div>
                      <div className="text-green-600 font-semibold">{formatDuration(movingTime)}</div>
                      {duration && duration !== movingTime && (
                        <div className="text-xs text-gray-500">Total: {formatDuration(duration)}</div>
                      )}
                    </div>
                  ) : duration ? (
                    formatDuration(duration)
                  ) : (
                    'N/A'
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-xs text-gray-500">Elevation</p>
              <p className="font-medium">
                {formatElevation(
                  isGroup && activity.userActivityData?.elevationGain 
                    ? activity.userActivityData.elevationGain 
                    : activity.elevationGain
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-xs text-gray-500">Avg Speed</p>
              <p className="font-medium">
                {formatSpeed(
                  isGroup && activity.userActivityData?.averageSpeed 
                    ? activity.userActivityData.averageSpeed 
                    : getAverageSpeed()
                )}
              </p>
              {(activity.movingTime || activity.userActivityData?.movingTime) && (
                <p className="text-xs text-gray-500">Based on active time</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-red-500" />
            <div>
              <p className="text-xs text-gray-500">Heart Rate</p>
              <p className="font-medium">
                Avg: {(() => {
                  const avgHR = isGroup && activity.userActivityData?.averageHeartRate 
                    ? activity.userActivityData.averageHeartRate 
                    : activity.averageHeartRate;
                  return avgHR ? `${avgHR} bpm` : 'N/A';
                })()}
              </p>
              <p className="text-xs text-gray-500">
                Max: {(() => {
                  const maxHR = isGroup && activity.userActivityData?.maxHeartRate 
                    ? activity.userActivityData.maxHeartRate 
                    : activity.maxHeartRate;
                  return maxHR ? `${maxHR} bpm` : 'N/A';
                })()}
              </p>
            </div>
          </div>

          {(activity.deviceName || activity.userActivityData?.deviceId) && (
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-xs text-gray-500">Device</p>
                <p className="font-medium text-xs">
                  {isGroup && activity.userActivityData?.deviceId 
                    ? activity.userActivityData.deviceId 
                    : activity.deviceName}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowParticipantsModal(true);
                  }}
                  className="text-xs"
                >
                  <Users className="w-3 h-3 mr-1" />
                  View All Participants
                </Button>
              </div>
            )}
            {!isGroup && activity.activityType && (
              <Badge variant="outline" className="text-xs">
                {activity.activityType}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isGroup && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/my-performance/${activity.id}`);
                  }}
                  className="mr-2"
                >
                  <Activity className="w-3 h-3 mr-1" />
                  View Performance Details
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/ride/${activity.id}`);
                  }}
                >View Event Details</Button>
              </>
            )}
            {!isGroup && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/my-performance/solo/${activity.id}`);
                  }}
                  className="mr-2"
                >
                  <Activity className="w-3 h-3 mr-1" />
                  View Performance Details
                </Button>
                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => e.stopPropagation()}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Activity</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this activity? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteActivity}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      </CardContent>
      {/* Participants Modal for Group Rides */}
      {isGroup && (
        <Dialog open={showParticipantsModal} onOpenChange={setShowParticipantsModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Participants ({activity.participantCount || 0})
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {isLoadingMatches ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : activityMatches?.length > 0 ? (
                activityMatches.map((participant: any) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => {
                      toast({
                        title: "User Profile",
                        description: `View ${participant.userName}'s profile - coming soon!`,
                      });
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {participant.userName?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{participant.userName}</p>
                        <p className="text-xs text-gray-500">
                          {participant.distance ? `${formatDistance(participant.distance)}` : 'No data uploaded'}
                        </p>
                      </div>
                    </div>
                    
                    {participant.distance && (
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Moving Time</p>
                        <p className="text-sm font-medium">
                          {participant.movingTime ? formatDuration(participant.movingTime) : 'N/A'}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No participant data available</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}