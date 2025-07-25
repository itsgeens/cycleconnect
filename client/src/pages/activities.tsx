import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Navbar from "@/components/navbar";
import RideCard from "@/components/ride-card";
import ActivityCard from "@/components/activity-card";
import LeaveRideModal from "@/components/leave-ride-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { authManager } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Trophy, Clock, MapPin, Users, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ParticipantActivityMatch } from "@/components/activity-card"; // Import ParticipantActivityMatch explicitly

// Define interfaces for ride data in "My Rides"
interface UserRide {
  id: number;
  name: string;
  description: string | null;
  dateTime: string; // Or Date if you parse it
  rideType: string;
  surfaceType: string;
  gpxFilePath: string | null;
  meetupLocation: string | null;
  meetupCoords: { lat: number; lng: number } | null;
  organizerId: number;
  isCompleted: boolean;
  completedAt: string | null; // Or Date if you parse it
  createdAt: string; // Or Date
  weatherData: any; // You might want to define a specific type for weather data
  organizerName: string;
  participantCount: number;
  // Properties specific to the 'all' array
  isOrganizer?: boolean;
  isParticipant?: boolean;
}

interface MyRidesData {
  all: UserRide[];
  organized: UserRide[];
  joined: UserRide[];
}

// Define interfaces for completed activities data
// Reuse ParticipantActivityMatch or define a similar interface if needed
interface CompletedRideWithUserData extends UserRide {
  userActivityData?: ParticipantActivityMatch; // Assuming structure from storage.ts
  userParticipationData?: { xpJoiningBonus?: number | null } | null; // Assuming structure from storage.ts
}

interface SoloActivityData {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  activityType: string;
  gpxFilePath: string | null;
  distance: string | null; // Or number
  duration: number | null;
  movingTime: number | null;
  elevationGain: string | null; // Or number
  averageSpeed: string | null; // Or number
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  calories: number | null;
  deviceName: string | null;
  deviceType: string | null;
  completedAt: string | Date; // Or Date
  createdAt: string | Date; // Or Date
  xpEarned: number | null;
  xpDistance: number | null;
  xpElevation: number | null;
  xpSpeed: number | null;
  xpOrganizingBonus: number | null;
}


interface CompletedActivitiesData {
  completedRides: CompletedRideWithUserData[];
  soloActivities: SoloActivityData[];
}

export default function Activities() {
  const user = authManager.getState().user;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedRide, setSelectedRide] = useState<any>(null);
  const [showRidesWithoutData, setShowRidesWithoutData] = useState(false);

  const { data: myRides, isLoading } = useQuery({
    queryKey: ["/api/my-rides"],
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: completedActivities, isLoading: isLoadingActivities } = useQuery({
    queryKey: ["/api/completed-activities"],
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Clear cache and force fresh data fetch
  const invalidateActivities = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/completed-activities"] });
    queryClient.removeQueries({ queryKey: ["/api/completed-activities"] });
  };

  const leaveRideMutation = useMutation({
    mutationFn: (rideId: number) => apiRequest(`/api/rides/${rideId}/leave`, { method: 'POST' }),
    onSuccess: () => {
      toast({
        title: "Left the ride",
        description: "You're no longer part of this ride.",
      });
      queryClient.clear();
      queryClient.invalidateQueries({ queryKey: ["/api/my-rides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/completed-activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ["/api/my-rides"] });
        queryClient.refetchQueries({ queryKey: ["/api/completed-activities"] });
        queryClient.refetchQueries({ queryKey: ["/api/my-stats"] });
      }, 100);
      setShowLeaveModal(false);
      setSelectedRide(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to leave ride",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLeaveClick = (rideId: number) => {
    // Access myRides only if it's not null or undefined
    const ride = myRides
      ? myRides.all.find((r) => r.id === rideId) ||
        myRides.joined.find((r) => r.id === rideId) ||
        myRides.organized.find((r) => r.id === rideId)
      : undefined; // Return undefined if myRides is null or undefined

    setSelectedRide(ride);
    setShowLeaveModal(true);
  };

  const confirmLeave = () => {
    if (selectedRide) {
      leaveRideMutation.mutate(selectedRide.id);
    }
  };

  if (isLoading || isLoadingActivities) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-6xl mx-auto p-6">
          <div className="space-y-6">
            <div className="text-center">
              <Skeleton className="h-8 w-48 mx-auto mb-4" />
              <Skeleton className="h-4 w-64 mx-auto" />
            </div>
            <div className="grid gap-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
// Safely access data from myRides and completedActivities
const plannedActivities = myRides
? [...(myRides.organized ?? []), ...(myRides.joined ?? [])].filter(
    (ride) => !ride.isCompleted
  )
: []; // Provide an empty array if myRides is undefined

const allCompletedActivities = completedActivities
? [ 
    ...(completedActivities.completedRides ?? []),
    ...(completedActivities.soloActivities ?? []),
  ].sort((a, b) => {
    // Add checks for null or undefined completedAt/createdAt
    const dateA = a.completedAt || a.createdAt;
    const dateB = b.completedAt || b.createdAt;

    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;

    return new Date(dateB).getTime() - new Date(dateA).getTime();
  })
: []; // Provide an empty array if completedActivities is undefined


  // Filter completed activities based on user data availability
  const filteredCompletedActivities = showRidesWithoutData 
    ? allCompletedActivities 
    : allCompletedActivities.filter(activity => {
        // Include solo activities (they always have user data)
        if (activity.gpxFilePath && !activity.organizerId) {
          return true;
        }
        // Include group rides only if user has uploaded GPX data
        return activity.userActivityData && activity.userActivityData.gpxFilePath;
      });

  const activitiesWithUserData = allCompletedActivities.filter(activity => {
    // Solo activities always have user data
    if (activity.gpxFilePath && !activity.organizerId) {
      return true;
    }
    // Group rides only if user has uploaded GPX data
    return activity.userActivityData && activity.userActivityData.gpxFilePath;
  });

  const activitiesWithoutUserData = allCompletedActivities.filter(activity => {
    // Skip solo activities
    if (activity.gpxFilePath && !activity.organizerId) {
      return false;
    }
    // Include group rides only if user has NOT uploaded GPX data
    return !activity.userActivityData || !activity.userActivityData.gpxFilePath;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Activities</h1>
          <p className="text-gray-600">
            Track your cycling journey with planned rides and completed activities
          </p>
        </div>

        <Tabs defaultValue="completed" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="planned" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Planned Activities
              <Badge variant="secondary" className="ml-2">
                {plannedActivities.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Completed Activities
              <Badge variant="secondary" className="ml-2">
                {filteredCompletedActivities.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="planned" className="space-y-4">
            {plannedActivities.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No planned activities</h3>
                <p className="text-gray-600 mb-4">
                  Join a ride or create your own to see them here
                </p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => navigate("/")}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Discover Rides
                  </button>
                  <button
                    onClick={() => navigate("/create")}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Create Ride
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plannedActivities.map((ride: any) => (
                  <RideCard
                    key={ride.id}
                    ride={ride}
                    showLeaveButton={ride.organizerId !== user?.id}
                    onLeaveClick={() => handleLeaveClick(ride.id)}
                    onCardClick={(rideId) => navigate(`/ride/${rideId}`)}
                    currentUserId={user?.id}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {/* Always show the upload button */}
            <div className="flex justify-end mb-4">
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate("/upload-activity")}
                className="flex items-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                Upload Activity
              </Button>
            </div>

            {allCompletedActivities.length === 0 ? (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No completed activities</h3>
                <p className="text-gray-600 mb-4">
                  Upload your first GPX file or complete a ride to see your activity history here
                </p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => navigate("/")}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Find Rides to Join
                  </button>
                  <button
                    onClick={() => navigate("/upload-activity")}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Upload Solo Activity
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Filter Controls */}
                <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      Showing {filteredCompletedActivities.length} of {allCompletedActivities.length} completed activities
                    </div>
                    {activitiesWithoutUserData.length > 0 && (
                      <div className="text-sm text-gray-500">
                        ({activitiesWithoutUserData.length} rides without your data)
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {activitiesWithoutUserData.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRidesWithoutData(!showRidesWithoutData)}
                        className="flex items-center gap-2"
                      >
                        {showRidesWithoutData ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        {showRidesWithoutData ? 'Hide' : 'Show'} joined rides with no user data uploaded
                      </Button>
                    )}
                  </div>
                </div>

                {/* Activities List */}
                <div className="space-y-4">
                  {filteredCompletedActivities.map((activity: any) => (
                    <ActivityCard
                      key={activity.gpxFilePath && !activity.organizerId ? `solo-${activity.id}` : `group-${activity.id}`}
                      activity={activity}
                      type={activity.gpxFilePath && !activity.organizerId ? 'solo' : 'group'}
                      queryClient={queryClient} // Pass queryClient as a prop
                    />
                  ))}
                </div>

                {/* No activities message after filtering */}
                {filteredCompletedActivities.length === 0 && !showRidesWithoutData && (
                  <div className="text-center py-12">
                    <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No activities with your data</h3>
                    <p className="text-gray-600 mb-4">
                      Upload your GPX files to completed rides to see them here
                    </p>
                    <p className="text-sm text-gray-500">
                      You can use the toggle above to show rides where you haven't uploaded data yet
                    </p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <LeaveRideModal
          isOpen={showLeaveModal}
          onClose={() => setShowLeaveModal(false)}
          onConfirm={confirmLeave}
          rideName={selectedRide?.name || ""}
          isLoading={leaveRideMutation.isPending}
        />
      </div>
    </div>
  );
}