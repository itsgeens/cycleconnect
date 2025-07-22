import { useState } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/navbar";
import RideFilters from "@/components/ride-filters";
import RideCard from "@/components/ride-card";
import LeaveRideModal from "@/components/leave-ride-modal";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { authManager } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Users, MapPin, Activity, UserPlus, Calendar, Trophy } from "lucide-react";

export default function Home() {
  const [filters, setFilters] = useState({});
  const [showAllRides, setShowAllRides] = useState(false);
  const [showAllFriends, setShowAllFriends] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = authManager.getState().user;
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedRide, setSelectedRide] = useState<any>(null);

  const { data: rides, isLoading } = useQuery({
    queryKey: ["/api/rides", filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters as any);
      const response = await fetch(`/api/rides?${params}`);
      if (!response.ok) throw new Error("Failed to fetch rides");
      const allRides = await response.json();
      // Filter out completed rides
      const nonCompletedRides = allRides.filter((ride: any) => !ride.isCompleted);
      return nonCompletedRides;
    },
  });

  const { data: riders, isLoading: isLoadingRiders } = useQuery({
    queryKey: ["/api/riders"],
    queryFn: async () => {
      const sessionId = localStorage.getItem("sessionId");
      const response = await fetch("/api/riders", {
        headers: {
          "Authorization": `Bearer ${sessionId}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch riders");
      return response.json();
    },
  });

  const joinRideMutation = useMutation({
    mutationFn: (rideId: number) => apiRequest(`/api/rides/${rideId}/join`, { method: 'POST' }),
    onSuccess: (_, rideId) => {
      toast({
        title: "Successfully joined the ride!",
        description: "You'll receive updates about this ride.",
      });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/rides' });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to join ride",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const leaveRideMutation = useMutation({
    mutationFn: (rideId: number) => apiRequest(`/api/rides/${rideId}/leave`, { method: 'POST' }),
    onSuccess: (_, rideId) => {
      toast({
        title: "Left the ride",
        description: "You're no longer part of this ride.",
      });
      // Invalidate multiple related queries and clear cache
      queryClient.clear(); // Clear all cache
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/rides' });
      queryClient.invalidateQueries({ queryKey: ["/api/my-rides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-stats"] });
      // Force immediate refetch with fresh data
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ["/api/my-rides"] });
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

  const followMutation = useMutation({
    mutationFn: (userId: number) => apiRequest(`/api/users/${userId}/follow`, { method: 'POST' }),
    onSuccess: () => {
      toast({
        title: "Followed user",
        description: "You're now following this rider.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/riders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to follow",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: (userId: number) => apiRequest(`/api/users/${userId}/unfollow`, { method: 'POST' }),
    onSuccess: () => {
      toast({
        title: "Unfollowed user",
        description: "You're no longer following this rider.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/riders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to unfollow",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLeaveClick = (rideId: number) => {
    const ride = rides?.find((r: any) => r.id === rideId);
    setSelectedRide(ride);
    setShowLeaveModal(true);
  };

  const confirmLeave = () => {
    if (selectedRide) {
      leaveRideMutation.mutate(selectedRide.id);
    }
  };



  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Discover Rides Section */}
        <section className="mb-12">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Discover Rides</h2>
            <p className="text-gray-600 max-w-2xl">
              Find the perfect group ride that matches your style and schedule
            </p>
          </div>

          <RideFilters onFiltersChange={setFilters} />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <Skeleton className="w-full h-48" />
                  <div className="p-6">
                    <Skeleton className="h-6 w-3/4 mb-4" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-2/3 mb-4" />
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-10 w-24" />
                    </div>
                  </div>
                </div>
              ))
            ) : rides?.length > 0 ? (
              (showAllRides ? rides : rides.slice(0, 8)).map((ride: any) => (
                <RideCard 
                  key={ride.id} 
                  ride={ride} 
                  onJoin={(rideId) => joinRideMutation.mutate(rideId)}
                  onLeave={handleLeaveClick}
                  onCardClick={(rideId) => navigate(`/ride/${rideId}`)}
                  isJoining={joinRideMutation.isPending}
                  isLeaving={leaveRideMutation.isPending && selectedRide?.id === ride.id}
                  currentUserId={user?.id}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <div className="text-gray-500 mb-4">
                  <MapPin className="w-12 h-12 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold">No rides found</h3>
                  <p>Try adjusting your filters or create a new ride to get started!</p>
                </div>
                <Button onClick={() => navigate("/create")} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Ride
                </Button>
              </div>
            )}
          </div>
          
          {/* See more rides button */}
          {rides && rides.length > 8 && !showAllRides && (
            <div className="text-center mt-8">
              <Button 
                variant="outline" 
                onClick={() => setShowAllRides(true)}
                className="px-8"
              >
                See More Rides ({rides.length - 8} more)
              </Button>
            </div>
          )}
        </section>

        {/* Discover Friends Section */}
        <section className="mb-12">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Discover Friends</h2>
            <p className="text-gray-600 max-w-2xl">
              Connect with other riders in your community
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {isLoadingRiders ? (
              Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="text-center pb-4">
                    <Skeleton className="w-16 h-16 rounded-full mx-auto mb-4" />
                    <Skeleton className="h-6 w-3/4 mx-auto mb-2" />
                    <Skeleton className="h-4 w-1/2 mx-auto" />
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-3 gap-2 text-center mb-4">
                      <div>
                        <Skeleton className="h-6 w-8 mx-auto mb-1" />
                        <Skeleton className="h-3 w-12 mx-auto" />
                      </div>
                      <div>
                        <Skeleton className="h-6 w-8 mx-auto mb-1" />
                        <Skeleton className="h-3 w-12 mx-auto" />
                      </div>
                      <div>
                        <Skeleton className="h-6 w-8 mx-auto mb-1" />
                        <Skeleton className="h-3 w-12 mx-auto" />
                      </div>
                    </div>
                    <Skeleton className="h-9 w-full" />
                  </CardContent>
                </Card>
              ))
            ) : riders?.length > 0 ? (
              (showAllFriends ? riders : riders.slice(0, 8)).map((rider: any) => (
                <Card 
                  key={rider.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/stats/${rider.id}`)}
                >
                  <CardHeader className="text-center pb-4">
                    <Avatar className="w-16 h-16 mx-auto mb-4">
                      <AvatarFallback className="bg-cycling-blue text-white text-lg">
                        {rider.name?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <CardTitle className="text-lg">{rider.name}</CardTitle>
                    <p className="text-sm text-gray-500">@{rider.username}</p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-3 gap-2 text-center mb-4">
                      <div>
                        <div className="text-2xl font-bold text-cycling-blue">{rider.followersCount || 0}</div>
                        <div className="text-xs text-gray-500">Followers</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-nature-green">{rider.completedRides || 0}</div>
                        <div className="text-xs text-gray-500">Completed</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-energy-red">{rider.hostedRides || 0}</div>
                        <div className="text-xs text-gray-500">Hosted</div>
                      </div>
                    </div>
                    {rider.id !== user?.id && (
                      <Button 
                        className="w-full"
                        variant={rider.isFollowing ? "outline" : "default"}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent card click when clicking button
                          if (rider.isFollowing) {
                            unfollowMutation.mutate(rider.id);
                          } else {
                            followMutation.mutate(rider.id);
                          }
                        }}
                        disabled={followMutation.isPending || unfollowMutation.isPending}
                      >
                        {rider.isFollowing ? (
                          <>
                            <UserPlus className="w-4 h-4 mr-2" />
                            Following
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 mr-2" />
                            Follow
                          </>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <div className="text-gray-500 mb-4">
                  <Users className="w-12 h-12 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold">No riders found</h3>
                  <p>Be the first to join the community!</p>
                </div>
              </div>
            )}
          </div>
          
          {/* See more friends button */}
          {riders && riders.length > 8 && !showAllFriends && (
            <div className="text-center mt-8">
              <Button 
                variant="outline" 
                onClick={() => setShowAllFriends(true)}
                className="px-8"
              >
                See More Friends ({riders.length - 8} more)
              </Button>
            </div>
          )}
        </section>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button 
          onClick={() => navigate("/create")}
          size="icon"
          className="w-14 h-14 rounded-full shadow-lg bg-cycling-blue hover:bg-blue-600"
        >
          <Plus className="w-6 h-6" />
        </Button>
      

      {/* Leave Ride Confirmation Modal */}
      <LeaveRideModal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        onConfirm={confirmLeave}
        isLoading={leaveRideMutation.isPending}
        rideName={selectedRide?.name}
      />
    </div>
    </div> 
  );
}
