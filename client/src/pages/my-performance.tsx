// At the top of MyPerformance.tsx, define an interface for the props
interface MyPerformanceProps {
  id: string; // The rideId from the route
  userId: string; // The userId from the route
}

import { useLocation } from "wouter"; // Keep useLocation for navigation
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGPXStats } from "@/hooks/use-gpx-stats";
import { authManager } from "@/lib/auth";
import GPXMapPreview from "@/components/gpx-map-preview";
import { ArrowLeft, Clock, Route, Mountain, Zap, Heart, MapPin, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { type Ride, type SoloActivity, type ActivityMatch } from "@shared/schema"; // Import necessary types
import { Trophy } from "lucide-react";


// Define a type that represents a completed ride with user activity data
type CompletedRideWithUserData = Ride & {
  organizerName: string;
  participantCount: number;
  completedAt: Date;
  userActivityData?: ActivityMatch; // Could be participant match or mapped organizer GPX
  userParticipationData?: { xpJoiningBonus: number }; // Include participation data if needed
};

// Define a type for the data returned by /api/completed-activities
type CompletedActivitiesResponse = {
  completedRides: CompletedRideWithUserData[];
  soloActivities: SoloActivity[];
};


// MODIFY THE COMPONENT SIGNATURE TO ACCEPT PROPS
export default function MyPerformance({ id: rideId, userId: routeUserId }: MyPerformanceProps) {
  // REMOVE OR COMMENT OUT THE useParams HOOK CALL
  // const { id, userId: routeUserId } = useParams<{ id: string; userId: string }>();

  const [location, navigate] = useLocation();
  const user = authManager.getUser();

  // Determine if this is a solo activity based on URL path
  // You might need to adjust this logic if solo activities use a different route format now
  const isSolo = location.includes('/my-performance/solo/');

  // Fetch all completed activities (rides with user data and solo activities)
  const { data: completedActivities, isLoading: isLoadingActivities } = useQuery<CompletedActivitiesResponse>({
    queryKey: ['/api/completed-activities'],
    enabled: !!user, // Only fetch if user is authenticated
  });

  // Find the specific activity based on the received rideId and routeUserId
  const activity = isSolo
    ? completedActivities?.soloActivities.find(sa => sa.id.toString() === rideId) // Use rideId here
    : completedActivities?.completedRides.find(cr => cr.id.toString() === rideId && cr.userActivityData?.userId.toString() === routeUserId); // Use rideId and routeUserId here


  // Define separate variables for solo and ride activity data
  const soloActivityData: SoloActivity | undefined = isSolo ? (activity as SoloActivity) : undefined;
  const rideActivityData: ActivityMatch | undefined = !isSolo ? (activity as CompletedRideWithUserData)?.userActivityData : undefined;

  // Get user participation data for rides
  const userParticipationData = !isSolo ? (activity as CompletedRideWithUserData)?.userParticipationData : undefined;


  const isLoading = isLoadingActivities; // Use isLoadingActivities as the main loading state

  // Determine which GPX path to use for the main map preview and stats
  const userGpxPath = isSolo ? soloActivityData?.gpxFilePath : rideActivityData?.gpxFilePath;

  // Use the GPX stats hook with the correct GPX path
  const { stats } = useGPXStats(userGpxPath);

  // For route comparison, use the planned route's GPX path from the activity (if it's a ride)
  const plannedRouteGpxPath = !isSolo ? (activity as CompletedRideWithUserData)?.gpxFilePath : undefined;
  const { stats: plannedRouteStats } = useGPXStats(plannedRouteGpxPath);


  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  // Check if activity and at least one type of activity data are found
  if (!activity || (!soloActivityData && !rideActivityData)) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Performance data not found</h1>
        <Button onClick={() => navigate('/activities')} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to activities
        </Button>
      </div>
    );
  }

  // Determine the activity data source for displaying stats and details
  const displayedActivityData = soloActivityData || rideActivityData;

  // Format time from seconds to readable format
  const formatTime = (seconds: number | null | undefined) => { // Allow null or undefined input
    const validSeconds = seconds || 0; // Treat null/undefined as 0
    const hours = Math.floor(validSeconds / 3600);
    const minutes = Math.floor((validSeconds % 3600) / 60);
    const remainingSeconds = validSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button onClick={() => navigate('/activities')} variant="outline" className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to activities
        </Button>

        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Performance</h1>
            <p className="text-lg text-gray-600">{activity.name}</p>
            <div className="flex gap-2 mt-2">
              {isSolo && activity ? ( // Add check for activity being defined
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {(activity as SoloActivity).activityType || 'cycling'} {/* Explicitly cast to SoloActivity */}
                </Badge>
              ) : !isSolo && activity ? ( // Add check for activity being defined
                <>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {(activity as CompletedRideWithUserData).rideType}
                  </Badge>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {(activity as CompletedRideWithUserData).surfaceType}
                  </Badge>
                </>
              ) : null // Render nothing if activity is undefined
              }
              <Badge variant="default" className="bg-green-600 text-white">
                Completed
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Completed on</p>
            {(() => {
              // Use displayedActivityData.completedAt if available, otherwise fallback to activity.completedAt
              const completedDate = displayedActivityData?.completedAt || (activity as CompletedRideWithUserData)?.completedAt || (activity as SoloActivity)?.completedAt || (activity as CompletedRideWithUserData)?.createdAt;
              const date = completedDate ? new Date(completedDate) : new Date();

              // Check if date is valid
              if (isNaN(date.getTime())) {
                return (
                  <>
                    <p className="font-medium">Date not available</p>
                    <p className="text-sm text-gray-600">-</p>
                  </>
                );
              }

              return (
                <>
                  <p className="font-medium">
                    {format(date, 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-sm text-gray-600">
                    {format(date, 'h:mm a')}
                  </p>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Only render the grid if activity and displayedActivityData are available */}
      {activity && displayedActivityData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Route className="w-5 h-5" />
                  {isSolo ? 'My Route' : 'Route Comparison'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <GPXMapPreview
                  gpxUrl={userGpxPath}
                  secondaryGpxUrl={plannedRouteGpxPath}
                  className="h-96"
                  interactive={true}
                  showFullscreen={true}
                />
                {!isSolo && rideActivityData?.routeMatchPercentage && ( // Use rideActivityData here
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-1 bg-green-500 rounded"></div>
                        <span>My Route</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-1 bg-blue-500 rounded"></div>
                        <span>Planned Route</span>
                      </div>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-sm font-medium text-green-800">
                        Route Match: {rideActivityData.routeMatchPercentage}% {/* Use rideActivityData */}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Your route closely matched the planned ride route
                      </p>
                    </div>
                  </div>
                )}
                {!isSolo && rideActivityData?.organizerGpxId && ( // Use rideActivityData here
                   <div className="mt-4 text-sm text-gray-600 italic">
                      Note: Your route is being compared against the organizer's uploaded GPX for this ride.
                   </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Use displayedActivityData for all stats */}
                <div className="flex items-center gap-3">
                  <Route className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="font-medium">Distance</p>
                    <p className="text-lg font-bold text-blue-600">
                      {parseFloat(displayedActivityData.distance?.toString() || '0').toFixed(2)} km
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="font-medium">Active Time</p>
                    <p className="text-lg font-bold text-purple-600">
                      {formatTime(displayedActivityData.movingTime || displayedActivityData.duration)} {/* Use combined fields, formatTime handles null/undefined */}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  <div>
                    <p className="font-medium">Average Speed</p>
                    <p className="text-lg font-bold text-yellow-600">
                      {parseFloat(displayedActivityData.averageSpeed?.toString() || '0').toFixed(1)} km/h
                    </p>
                  </div>
                </div>

                {displayedActivityData.elevationGain && (
                  <div className="flex items-center gap-3">
                    <Mountain className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-medium">Elevation Gain</p>
                      <p className="text-lg font-bold text-green-600">
                        {parseFloat(displayedActivityData.elevationGain.toString()).toFixed(0)} m
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Heart className="w-5 h-5 text-red-500" />
                  <div>
                    <p className="font-medium">Average Heart Rate</p>
                    <p className="text-lg font-bold text-red-600">
                      {displayedActivityData.averageHeartRate ? `${displayedActivityData.averageHeartRate} bpm` : 'N/A'}
                    </p>
                    {displayedActivityData.maxHeartRate && (
                      <p className="text-sm text-gray-600">
                        Max: {displayedActivityData.maxHeartRate} bpm
                      </p>
                    )}
                  </div>
                </div>
                {/* XP Section: Conditionally render based on data source */}
                {isSolo && soloActivityData ? (
                  // Render XP for Solo Activity
                   <div>
                      <div className="flex items-center gap-3">
                         <Trophy className="w-5 h-5 text-yellow-500" /> {/* Using Trophy icon for XP */}
                         <div>
                            <p className="font-medium">Total Activity XP Earned</p>
                            <p className="text-lg font-bold text-yellow-600">
                             {/* Ensure xpEarned is treated as a number and format it */}
                             {parseFloat(soloActivityData.xpEarned?.toString() || '0').toFixed(2)} XP
                            </p>
                         </div>
                       </div>
                       {/* Solo XP Breakdown */}
                       {(soloActivityData.xpDistance != null || soloActivityData.xpElevation != null || soloActivityData.xpSpeed != null) && (
                           <div className="ml-8 mt-2 text-sm text-gray-600 space-y-1">
                               {soloActivityData.xpDistance != null && soloActivityData.xpDistance > 0 && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4 text-green-600" />
                                  <span>Distance: <span className="text-green-600">+{soloActivityData.xpDistance} XP</span></span>
                                </div>
                            )}
                              {soloActivityData.xpElevation != null && soloActivityData.xpElevation > 0 && (
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="w-4 h-4 text-green-600" />
                                  <span>Elevation: <span className="text-green-600">+{soloActivityData.xpElevation} XP</span></span>
                                </div>
                            )}
                              {soloActivityData.xpSpeed != null && soloActivityData.xpSpeed > 0 && (
                                <div className="flex items-center gap-1">
                                  <Zap className="w-4 h-4 text-green-600" />
                                  <span>Speed: <span className="text-green-600">+{soloActivityData.xpSpeed} XP</span></span>
                              </div>
                            )}
                          </div>
                       )}
                   </div>
                ) : !isSolo && rideActivityData ? (
                  // Render XP for Ride Activity Match (Participant or Organizer GPX)
                   <div>
                      <div className="flex items-center gap-3">
                         <Trophy className="w-5 h-5 text-yellow-500" /> {/* Using Trophy icon for XP */}
                         <div>
                            <p className="font-medium">Total Activity XP Earned</p>
                            <p className="text-lg font-bold text-yellow-600">
                            {
                            (parseFloat(rideActivityData.xpEarned?.toString() || '0') + (userParticipationData?.xpJoiningBonus || 0))
                            .toFixed(2)
                            }XP
                            </p>
                         </div>
                       </div>
                       {/* Ride XP Breakdown */}
                       {(rideActivityData.xpDistance != null || rideActivityData.xpElevation != null || rideActivityData.xpSpeed != null) && (
                           <div className="ml-8 mt-2 text-sm text-gray-600 space-y-1">
                               {rideActivityData.xpDistance != null && rideActivityData.xpDistance > 0 && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4 text-green-600" />
                                  <span>Distance: <span className="text-green-600">+{rideActivityData.xpDistance} XP</span></span>
                                </div>
                            )}
                              {rideActivityData.xpElevation != null && rideActivityData.xpElevation > 0 && (
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="w-4 h-4 text-green-600" />
                                  <span>Elevation: <span className="text-green-600">+{rideActivityData.xpElevation} XP</span></span>
                                </div>
                            )}
                              {rideActivityData.xpSpeed != null && rideActivityData.xpSpeed > 0 && (
                                <div className="flex items-center gap-1">
                                  <Zap className="w-4 h-4 text-green-600" />
                                  <span>Speed: <span className="text-green-600">+{rideActivityData.xpSpeed} XP</span></span>
                              </div>
                            )}
                            {/* Organizing Bonus (only for organizer's GPX within ride activity) */}
                              {rideActivityData.xpOrganizingBonus != null && rideActivityData.xpOrganizingBonus > 0 && ( // Use != null check
                                <div className="flex items-center gap-1">
                                  <Trophy className="w-4 h-4 text-blue-500" /> 
                                  <span>Organizing Bonus: <span className="text-green-600">+{rideActivityData.xpOrganizingBonus} XP</span></span>
                              </div>
                       )}
                          {/* Joining Bonus (only for participant's participation) */}
                              {userParticipationData?.xpJoiningBonus !== undefined && userParticipationData.xpJoiningBonus > 0 && (
                                <div className="flex items-center gap-1"> {/* Add spacing */}
                                  <Trophy className="w-4 h-4 text-blue-500" /> {/* Using Trophy icon for Joining Bonus */}
                                  <span>Joining Bonus: <span className="text-green-600">+{userParticipationData.xpJoiningBonus} XP</span></span>
                              </div>
                          )}
                      </div>
                 )}

                   </div>
                ) : null /* No activity data to display XP */ }




              </CardContent>
            </Card>

            {/* Modify the condition to check if it's a ride and if plannedRouteStats exist */}
            {!isSolo && plannedRouteStats && (activity as CompletedRideWithUserData) && (
              <Card>
                <CardHeader>
                  <CardTitle>Route Comparison</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Planned Distance:</span>
                    <span className="font-medium">{plannedRouteStats.distance.toFixed(2)} km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Your Distance:</span>
                    <span className="font-medium">{parseFloat(displayedActivityData.distance?.toString() || '0').toFixed(2)} km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Planned Elevation:</span>
                    <span className="font-medium">{plannedRouteStats.elevationGain.toFixed(0)} m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Your Elevation:</span>
                    <span className="font-medium">
                      {displayedActivityData.elevationGain ? parseFloat(displayedActivityData.elevationGain.toString()).toFixed(0) : '0'} m
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Activity Details</CardTitle> {/* Changed title */}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {/* Display Device/Source based on whether it's solo or ride activity data */}
                   <div className="flex justify-between">
                      <span className="text-sm text-gray-600">{isSolo ? 'Device:' : 'Source:'}</span>
                      <span className="font-medium">
                         {isSolo && soloActivityData ? soloActivityData.deviceName :
                          !isSolo && rideActivityData ? (rideActivityData.organizerGpxId ? 'Organizer Upload' : rideActivityData.deviceId || 'Participant Upload') : 'Unknown'} {/* Handle undefined cases */}
                      </span>
                   </div>
                   {/* Display Match Accuracy only for ride activities with match data */}
                   {!isSolo && rideActivityData?.routeMatchPercentage && ( // Use rideActivityData here
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Match Accuracy:</span>
                        <span className="font-medium">{rideActivityData.routeMatchPercentage}%</span> {/* Use rideActivityData */}
                      </div>
                   )}
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Uploaded:</span>
                    <span className="font-medium">
                      {(() => {
                        const matchedDate = rideActivityData?.matchedAt || displayedActivityData?.completedAt; // Use rideActivityData for matchedAt, displayedActivityData for completedAt as fallback
                        if (matchedDate) {
                          const date = new Date(matchedDate);
                          return !isNaN(date.getTime()) ? format(date, 'MMM d, h:mm a') : 'Unknown';
                        }
                        return 'Unknown';
                      })()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )} {/* Close the conditional rendering for the grid */}
    </div>
  );
}
