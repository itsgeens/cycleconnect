import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGPXStats } from "@/hooks/use-gpx-stats";
import { authManager } from "@/lib/auth";
import GPXMapPreview from "@/components/gpx-map-preview";
import { ArrowLeft, Clock, Route, Mountain, Zap, Heart } from "lucide-react";
import { format } from "date-fns";
import { type Ride } from "@shared/schema";
import { Trophy } from "lucide-react";


export default function MyPerformance() {
  const { id } = useParams<{ id: string }>();
  const [location, navigate] = useLocation();
  const user = authManager.getUser();

  // Determine if this is a solo activity based on URL path
  const isSolo = location.includes('/my-performance/solo/');

  const { data: ride, isLoading: isLoadingRide } = useQuery<Ride>({
    queryKey: ['/api/rides', id],
    enabled: !!id && !isSolo,
  });

  const { data: soloActivity, isLoading: isLoadingSolo } = useQuery({
    queryKey: ['/api/solo-activities', id],
    enabled: !!id && isSolo,
  });

  const isLoading = isLoadingRide || isLoadingSolo;
  const activity = isSolo ? soloActivity : ride;
  const userActivityData = isSolo ? soloActivity : (ride as any)?.userActivityData;
  const { stats } = useGPXStats(userActivityData?.gpxFilePath);
  const { stats: organizerStats } = useGPXStats(!isSolo ? activity?.gpxFilePath : null);

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

  if (!activity || !userActivityData) {
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

  // Format time from seconds to readable format
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
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
              {isSolo ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {activity.activityType || 'cycling'}
                </Badge>
              ) : (
                <>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {activity.rideType}
                  </Badge>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {activity.surfaceType}
                  </Badge>
                </>
              )}
              <Badge variant="default" className="bg-green-600 text-white">
                Completed
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Completed on</p>
            {(() => {
              const completedDate = userActivityData.completedAt || activity.completedAt || activity.createdAt;
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
                gpxUrl={userActivityData.gpxFilePath}
                secondaryGpxUrl={!isSolo ? activity.gpxFilePath : undefined}
                className="h-96"
                interactive={true}
                showFullscreen={true}
              />
              {!isSolo && (
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
                  {userActivityData.routeMatchPercentage && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-sm font-medium text-green-800">
                        Route Match: {userActivityData.routeMatchPercentage}%
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Your route closely matched the planned ride route
                      </p>
                    </div>
                  )}
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
              <div className="flex items-center gap-3">
                <Route className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="font-medium">Distance</p>
                  <p className="text-lg font-bold text-blue-600">
                    {parseFloat(userActivityData.distance || '0').toFixed(2)} km
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="font-medium">Active Time</p>
                  <p className="text-lg font-bold text-purple-600">
                    {formatTime(userActivityData.movingTime || userActivityData.duration || 0)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="font-medium">Average Speed</p>
                  <p className="text-lg font-bold text-yellow-600">
                    {parseFloat(userActivityData.averageSpeed || '0').toFixed(1)} km/h
                  </p>
                </div>
              </div>

              {userActivityData.elevationGain && (
                <div className="flex items-center gap-3">
                  <Mountain className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="font-medium">Elevation Gain</p>
                    <p className="text-lg font-bold text-green-600">
                      {parseFloat(userActivityData.elevationGain).toFixed(0)} m
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Heart className="w-5 h-5 text-red-500" />
                <div>
                  <p className="font-medium">Average Heart Rate</p>
                  <p className="text-lg font-bold text-red-600">
                    {userActivityData.averageHeartRate ? `${userActivityData.averageHeartRate} bpm` : 'N/A'}
                  </p>
                  {userActivityData.maxHeartRate && (
                    <p className="text-sm text-gray-600">
                      Max: {userActivityData.maxHeartRate} bpm
                    </p>
                  )}
                </div>
              </div>
              {userActivityData.xpEarned !== undefined && ( // Check if xpEarned exists
                 <div className="flex items-center gap-3">
                    <Trophy className="w-5 h-5 text-yellow-500" /> {/* Using Trophy icon for XP */}
                    <div>
                       <p className="font-medium">XP Earned</p>
                       <p className="text-lg font-bold text-yellow-600">
                        {/* Ensure xpEarned is treated as a number and format it */}
                        {parseFloat(userActivityData.xpEarned.toString()).toFixed(2)} XP
                       </p>
                    </div>
                  </div>
          )}
            </CardContent>
          </Card>

          {!isSolo && organizerStats && (
            <Card>
              <CardHeader>
                <CardTitle>Route Comparison</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Planned Distance:</span>
                  <span className="font-medium">{organizerStats.distance.toFixed(2)} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Your Distance:</span>
                  <span className="font-medium">{parseFloat(userActivityData.distance || '0').toFixed(2)} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Planned Elevation:</span>
                  <span className="font-medium">{organizerStats.elevationGain.toFixed(0)} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Your Elevation:</span>
                  <span className="font-medium">
                    {userActivityData.elevationGain ? parseFloat(userActivityData.elevationGain).toFixed(0) : '0'} m
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Device Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Device:</span>
                  <span className="font-medium">{userActivityData.deviceId || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Match Accuracy:</span>
                  <span className="font-medium">{userActivityData.routeMatchPercentage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Uploaded:</span>
                  <span className="font-medium">
                    {(() => {
                      const matchedDate = userActivityData.matchedAt || userActivityData.completedAt;
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
    </div>
  );
}