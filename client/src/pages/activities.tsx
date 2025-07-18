import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Navbar from "@/components/navbar";
import RideCard from "@/components/ride-card";
import ActivityCard from "@/components/activity-card";
import LeaveRideModal from "@/components/leave-ride-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authManager } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Trophy, Clock, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Activities() {
  const user = authManager.getState().user;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedRide, setSelectedRide] = useState<any>(null);

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

  const leaveRideMutation = useMutation({
    mutationFn: (rideId: number) => apiRequest('POST', `/api/rides/${rideId}/leave`),
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
    const ride = myRides?.all?.find((r: any) => r.id === rideId) || 
                 myRides?.joined?.find((r: any) => r.id === rideId) || 
                 myRides?.organized?.find((r: any) => r.id === rideId);
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

  const plannedActivities = [
    ...(myRides?.organized || []),
    ...(myRides?.joined || [])
  ].filter(ride => !ride.isCompleted);

  const completedRides = [
    ...(myRides?.organized || []),
    ...(myRides?.joined || [])
  ].filter(ride => ride.isCompleted);

  const allCompletedActivities = [
    ...completedRides,
    ...(completedActivities?.soloActivities || [])
  ].sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime());

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

        <Tabs defaultValue="planned" className="w-full">
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
                {allCompletedActivities.length}
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
            {allCompletedActivities.length === 0 ? (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No completed activities</h3>
                <p className="text-gray-600 mb-4">
                  Complete your first ride to see your activity history here
                </p>
                <button
                  onClick={() => navigate("/")}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Find Rides to Join
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {allCompletedActivities.map((activity: any) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    type={activity.gpxFilePath && !activity.organizerId ? 'solo' : 'group'}
                  />
                ))}
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