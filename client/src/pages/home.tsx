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
import { Plus, Users, MapPin, Activity } from "lucide-react";

export default function Home() {
  const [filters, setFilters] = useState({});
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
      return response.json();
    },
  });

  const joinRideMutation = useMutation({
    mutationFn: (rideId: number) => apiRequest('POST', `/api/rides/${rideId}/join`),
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
    mutationFn: (rideId: number) => apiRequest('POST', `/api/rides/${rideId}/leave`),
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
      
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-cycling-blue to-blue-700 py-20">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Connect. Ride. Explore.
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Join the cycling community and discover amazing group rides in your area. From casual coffee rides to intense training sessions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-white text-cycling-blue hover:bg-gray-100"
                onClick={() => document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" })}
              >
                Discover Rides
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white text-white hover:bg-white hover:text-cycling-blue"
                onClick={() => navigate("/create")}
              >
                Create a Ride
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-cycling-blue mb-2">
                {rides?.length || 0}
              </div>
              <div className="text-gray-600">Upcoming Rides</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-nature-green mb-2">
                {rides?.reduce((sum: number, ride: any) => sum + ride.participantCount, 0) || 0}
              </div>
              <div className="text-gray-600">Total Participants</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-energy-red mb-2">∞</div>
              <div className="text-gray-600">Adventures Await</div>
            </div>
          </div>
        </div>
      </section>



      {/* Ride Discovery */}
      <section id="discover" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Discover Rides</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
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
              rides.map((ride: any) => (
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
        </div>
      </section>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button 
          onClick={() => navigate("/create")}
          size="icon"
          className="w-14 h-14 rounded-full shadow-lg bg-cycling-blue hover:bg-blue-600"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      {/* Leave Ride Confirmation Modal */}
      <LeaveRideModal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        onConfirm={confirmLeave}
        isLoading={leaveRideMutation.isPending}
        rideName={selectedRide?.name}
      />
    </div>
  );
}
