import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useGPXStats } from "@/hooks/use-gpx-stats";
import { authManager } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import GPXMapPreview from "@/components/gpx-map-preview";
import LeaveRideModal from "@/components/leave-ride-modal";
import { ArrowLeft, Edit, Trash2, Users, Calendar, MapPin, Mountain, Route, User, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { type Ride } from "@shared/schema";
import { useState, useEffect } from "react";

export default function RideDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = authManager.getUser();
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { data: ride, isLoading, error } = useQuery<Ride>({
    queryKey: ['/api/rides', id],
    enabled: !!id,
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache the data
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Debug logging
  useEffect(() => {
    if (ride) {
      console.log('Ride data:', ride);
    }
    if (error) {
      console.error('Ride query error:', error);
    }
  }, [ride, error]);

  const { stats } = useGPXStats(ride?.gpxFilePath);

  const joinRideMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/rides/${id}/join`),
    onSuccess: () => {
      toast({
        title: "Successfully joined the ride!",
        description: "You'll receive updates about this ride.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rides', id] });
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
    mutationFn: () => apiRequest('POST', `/api/rides/${id}/leave`),
    onSuccess: () => {
      toast({
        title: "Left the ride",
        description: "You're no longer part of this ride.",
      });
      // Invalidate multiple related queries and clear cache
      queryClient.clear(); // Clear all cache
      queryClient.invalidateQueries({ queryKey: ['/api/rides', id] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-rides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-stats"] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/rides' });
      // Force immediate refetch with fresh data
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ["/api/my-rides"] });
        queryClient.refetchQueries({ queryKey: ["/api/my-stats"] });
      }, 100);
      setShowLeaveModal(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to leave ride",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLeaveClick = () => {
    setShowLeaveModal(true);
  };

  const confirmLeave = () => {
    leaveRideMutation.mutate();
  };

  const deleteRideMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', `/api/rides/${id}`),
    onSuccess: () => {
      toast({
        title: "Ride deleted",
        description: "The ride has been successfully deleted.",
      });
      // Invalidate all rides queries to refresh the home page
      queryClient.invalidateQueries({ queryKey: ['/api/rides'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/rides' });
      navigate('/');
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete ride",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const completeRideMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/rides/${id}/complete`),
    onSuccess: () => {
      toast({
        title: "Ride completed!",
        description: "The ride has been marked as completed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rides', id] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/rides' });
      setShowCompleteModal(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to complete ride",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

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

  if (!ride) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Ride not found</h1>
        <Button onClick={() => navigate('/')} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to rides
        </Button>
      </div>
    );
  }

  const isOwner = user?.id === ride.organizerId;
  const isParticipant = ride.participants?.some(p => p.id === user?.id);
  const rideDate = new Date(ride.dateTime);
  const now = new Date();
  const canComplete = isOwner && !ride.isCompleted && rideDate < now;
  
  // Debug logging for date comparison
  console.log('Date comparison debug:', {
    rideDate: rideDate.toISOString(),
    now: now.toISOString(),
    isOwner,
    isCompleted: ride.isCompleted,
    canComplete
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button onClick={() => navigate('/')} variant="outline" className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to rides
        </Button>
        
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{ride.name}</h1>
            <div className="flex gap-2 mb-4">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {ride.rideType}
              </Badge>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {ride.surfaceType}
              </Badge>
            </div>
          </div>
          
          {isOwner && (
            <div className="flex gap-2">
              {canComplete && (
                <Dialog open={showCompleteModal} onOpenChange={setShowCompleteModal}>
                  <DialogTrigger asChild>
                    <Button variant="default" size="sm">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Complete Ride
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Complete Ride</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to mark this ride as completed? This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button 
                        variant="outline" 
                        onClick={() => setShowCompleteModal(false)}
                        disabled={completeRideMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => completeRideMutation.mutate()}
                        disabled={completeRideMutation.isPending}
                      >
                        {completeRideMutation.isPending ? "Completing..." : "Complete Ride"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Ride</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete this ride? This action cannot be undone and will remove all associated data.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowDeleteModal(false)}
                      disabled={deleteRideMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={() => {
                        deleteRideMutation.mutate();
                        setShowDeleteModal(false);
                      }}
                      disabled={deleteRideMutation.isPending}
                    >
                      {deleteRideMutation.isPending ? "Deleting..." : "Delete Ride"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Route className="w-5 h-5" />
                Route Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GPXMapPreview
                gpxUrl={ride.gpxFilePath}
                className="h-96"
                interactive={true}
                showFullscreen={true}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">
                {ride.description || 'No description provided for this ride.'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ride Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-medium">
                    {(() => {
                      try {
                        const date = new Date(ride.dateTime);
                        return isNaN(date.getTime()) ? 'Invalid date' : format(date, 'EEEE, MMMM d, yyyy');
                      } catch (error) {
                        return 'Invalid date';
                      }
                    })()}
                  </p>
                  <p className="text-sm text-gray-600">
                    {(() => {
                      try {
                        const date = new Date(ride.dateTime);
                        return isNaN(date.getTime()) ? 'Invalid time' : format(date, 'h:mm a');
                      } catch (error) {
                        return 'Invalid time';
                      }
                    })()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-medium">Meetup Location</p>
                  <p className="text-sm text-gray-600">
                    {ride.meetupLocation || 'Meetup location TBD'}
                  </p>
                </div>
              </div>

              {stats && (
                <>
                  <div className="flex items-center gap-3">
                    <Route className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium">Distance</p>
                      <p className="text-sm text-gray-600">{stats.distance} km</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Mountain className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium">Elevation Gain</p>
                      <p className="text-sm text-gray-600">{stats.elevationGain} m</p>
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-medium">Organized by</p>
                  <p className="text-sm text-gray-600">{ride.organizer?.name}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Participants ({ride.participants?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {ride.participants?.map((participant) => (
                  <div key={participant.id} className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-cycling-blue rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {participant.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm">{participant.name}</span>
                    {participant.id === ride.organizerId && (
                      <Badge variant="secondary" className="text-xs">Organizer</Badge>
                    )}
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              {!isOwner && (
                <div>
                  {isParticipant ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleLeaveClick}
                      disabled={leaveRideMutation.isPending}
                    >
                      Leave Ride
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => joinRideMutation.mutate()}
                      disabled={joinRideMutation.isPending}
                    >
                      Join Ride
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Leave Ride Confirmation Modal */}
      <LeaveRideModal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        onConfirm={confirmLeave}
        isLoading={leaveRideMutation.isPending}
        rideName={ride?.name}
      />
    </div>
  );
}