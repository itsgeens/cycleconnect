import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Navbar from "@/components/navbar";
import RideCard from "@/components/ride-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authManager } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users } from "lucide-react";

export default function MyRides() {
  const user = authManager.getState().user;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedRideId, setSelectedRideId] = useState<number | null>(null);

  const { data: myRides, isLoading } = useQuery({
    queryKey: ["/api/my-rides"],
  });

  const leaveRideMutation = useMutation({
    mutationFn: (rideId: number) => apiRequest('POST', `/api/rides/${rideId}/leave`),
    onSuccess: () => {
      toast({
        title: "Left the ride",
        description: "You're no longer part of this ride.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/my-rides"] });
      setShowLeaveModal(false);
      setSelectedRideId(null);
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
    setSelectedRideId(rideId);
    setShowLeaveModal(true);
  };

  const confirmLeave = () => {
    if (selectedRideId) {
      leaveRideMutation.mutate(selectedRideId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Rides</h1>
          <p className="text-gray-600">View all the rides you've joined or organized</p>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All Rides</TabsTrigger>
            <TabsTrigger value="organized">Organized</TabsTrigger>
            <TabsTrigger value="joined">Joined</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-full mb-4" />
                    <Skeleton className="h-3 w-1/2 mb-2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                ))
              ) : myRides?.all?.length > 0 ? (
                myRides.all.map((ride: any) => (
                  <RideCard 
                    key={ride.id} 
                    ride={ride} 
                    onJoin={() => {}} // No join functionality needed in My Rides
                    onLeave={handleLeaveClick}
                    onCardClick={(rideId) => navigate(`/ride/${rideId}`)}
                    isLeaving={leaveRideMutation.isPending && selectedRideId === ride.id}
                    currentUserId={user?.id}
                  />
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No rides yet</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    You haven't joined or organized any rides yet.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="organized" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-full mb-4" />
                    <Skeleton className="h-3 w-1/2 mb-2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                ))
              ) : myRides?.organized?.length > 0 ? (
                myRides.organized.map((ride: any) => (
                  <RideCard 
                    key={ride.id} 
                    ride={ride} 
                    onJoin={() => {}} // No join functionality needed in My Rides
                    onLeave={handleLeaveClick}
                    onCardClick={(rideId) => navigate(`/ride/${rideId}`)}
                    isLeaving={leaveRideMutation.isPending && selectedRideId === ride.id}
                    currentUserId={user?.id}
                  />
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No organized rides</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    You haven't organized any rides yet.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="joined" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-full mb-4" />
                    <Skeleton className="h-3 w-1/2 mb-2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                ))
              ) : myRides?.joined?.length > 0 ? (
                myRides.joined.map((ride: any) => (
                  <RideCard 
                    key={ride.id} 
                    ride={ride} 
                    onJoin={() => {}} // No join functionality needed in My Rides
                    onLeave={handleLeaveClick}
                    onCardClick={(rideId) => navigate(`/ride/${rideId}`)}
                    isLeaving={leaveRideMutation.isPending && selectedRideId === ride.id}
                    currentUserId={user?.id}
                  />
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No joined rides</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    You haven't joined any rides yet.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Leave Ride Confirmation Modal */}
      <Dialog open={showLeaveModal} onOpenChange={setShowLeaveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Ride</DialogTitle>
            <DialogDescription>
              Are you sure you want to leave this ride? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowLeaveModal(false)}
              disabled={leaveRideMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmLeave}
              disabled={leaveRideMutation.isPending}
            >
              {leaveRideMutation.isPending ? "Leaving..." : "Leave Ride"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}