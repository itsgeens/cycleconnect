import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useGPXStats } from "@/hooks/use-gpx-stats";
import { authManager } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import GPXMapPreview from "@/components/gpx-map-preview";
import LeaveRideModal from "@/components/leave-ride-modal";
import { ArrowLeft, Edit, Trash2, Users, Calendar, MapPin, Mountain, Route, User, CheckCircle, Upload, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { type Ride } from "@shared/schema";
import { useState, useEffect, useRef } from "react";

export default function RideDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = authManager.getUser();
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [gpxFile, setGpxFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    mutationFn: () => apiRequest(`/api/rides/${id}/join`, { method: 'POST' }),
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
    mutationFn: () => apiRequest(`/api/rides/${id}/leave`, { method: 'POST' }),
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
    mutationFn: () => apiRequest(`/api/rides/${id}`, { method: 'DELETE' }),
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
    mutationFn: () => apiRequest(`/api/rides/${id}/complete`, { method: 'POST' }),
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

  const uploadGpxMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('gpxFile', file);
      formData.append('deviceId', 'manual');
      
      return fetch(`/api/rides/${id}/complete-with-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authManager.getSessionId()}`,
        },
        body: formData,
      }).then(res => {
        if (!res.ok) {
          throw new Error('Failed to upload GPX file');
        }
        return res.json();
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Activity uploaded successfully!",
        description: `Your personal ride data has been recorded. Distance: ${data.activityData.distance?.toFixed(1) || 'N/A'} km`,
      });
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['/api/rides', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/completed-activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-stats'] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/rides' });
      setShowUploadModal(false);
      setGpxFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to upload activity",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.gpx')) {
        setGpxFile(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select a GPX file.",
          variant: "destructive",
        });
      }
    }
  };

  const handleUploadSubmit = () => {
    if (gpxFile) {
      uploadGpxMutation.mutate(gpxFile);
    }
  };

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
  const rideDateTime = new Date(ride.dateTime);
  const now = new Date();
  const hasRidePassed = rideDateTime.getTime() < now.getTime();
  const canComplete = isOwner && !ride.isCompleted && hasRidePassed;
  const userActivityData = (ride as any)?.userActivityData;
  const hasUploadedActivity = userActivityData && userActivityData.userId === user?.id;
  
  // Debug logging for datetime comparison
  console.log('DateTime comparison debug:', {
    rideDateTime: rideDateTime.toISOString(),
    now: now.toISOString(),
    hasRidePassed,
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
              {ride.isCompleted ? (
                <Badge variant="default" className="bg-green-600 text-white">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Completed
                </Badge>
              ) : hasRidePassed ? (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  Ride Finished
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                  Planned
                </Badge>
              )}
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
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  toast({
                    title: "Edit functionality",
                    description: "Ride editing feature coming soon!",
                  });
                }}
              >
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
                <div className="space-y-2">
                  {isParticipant ? (
                    <>
                      {ride.isCompleted && (
                        hasUploadedActivity ? (
                          <Button
                            variant="default"
                            className="w-full"
                            onClick={() => navigate(`/ride/${id}/my-performance`)}
                          >
                            <TrendingUp className="w-4 h-4 mr-2" />
                            View My Performance
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            className="w-full"
                            onClick={() => setShowUploadModal(true)}
                            disabled={uploadGpxMutation.isPending}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Your Activity
                          </Button>
                        )
                      )}
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleLeaveClick}
                        disabled={leaveRideMutation.isPending}
                      >
                        Leave Ride
                      </Button>
                    </>
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

      {/* GPX Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Your Activity</DialogTitle>
            <DialogDescription>
              Share your GPX file from this ride to record your personal performance data.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="gpx-file">Select GPX File</Label>
              <Input
                id="gpx-file"
                type="file"
                accept=".gpx"
                onChange={handleFileSelect}
                ref={fileInputRef}
              />
            </div>
            
            {gpxFile && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium">Selected file:</p>
                <p className="text-sm text-gray-600">{gpxFile.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Size: {(gpxFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowUploadModal(false);
                setGpxFile(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              disabled={uploadGpxMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUploadSubmit}
              disabled={!gpxFile || uploadGpxMutation.isPending}
            >
              {uploadGpxMutation.isPending ? "Uploading..." : "Upload Activity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}