import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, FileText, AlertCircle, CheckCircle, Clock, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Navbar from "@/components/navbar";

interface OrganizerPromptData {
  type: 'organizer_manual_prompt';
  message: string;
  gpxData: {
    distance: number;
    duration: number;
    movingTime: number;
    elevationGain: number;
  };
  plannedRides: Array<{
    id: number;
    name: string;
    dateTime: string;
    description: string;
  }>;
  tempFilePath: string;
}

export default function UploadActivityPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showOrganizerPrompt, setShowOrganizerPrompt] = useState(false);
  const [organizerPromptData, setOrganizerPromptData] = useState<OrganizerPromptData | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [autoMatchConfirmationData, setAutoMatchConfirmationData] = useState<any>(null); // Added this state

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "application/gpx+xml" && !selectedFile.name.endsWith('.gpx')) {
        toast({
          title: "Invalid file type",
          description: "Please select a GPX file",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const uploadActivityMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("gpx", file);
      
      const response = await fetch("/api/upload-activity", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("sessionId") || ""}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.type === 'organizer_auto_matched') {
        // Set the auto-match data and show the prompt modal for confirmation
        setAutoMatchConfirmationData(data);
        setShowOrganizerPrompt(true); // Reuse the existing modal state
      } else if (data.type === 'organizer_manual_prompt') {
        setOrganizerPromptData(data);
        setShowOrganizerPrompt(true);
      } else if (data.matchedRide) {
        toast({
          title: "Activity uploaded successfully!",
          description: `Matched with planned ride: ${data.matchedRide.name}`,
        });
        navigate("/activities");
      } else if (data.soloActivity) {
        toast({
          title: "Solo activity created!",
          description: "Your GPX file has been uploaded as a solo activity.",
        });
        navigate("/activities");
      }
      setIsUploading(false);
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      setIsUploading(false);
    },
  });

  const linkOrganizerGpxMutation = useMutation({
    mutationFn: async ({ rideId, tempFilePath, gpxData }: { 
      rideId: number; 
      tempFilePath: string; 
      gpxData: any; 
    }) => {
      const response = await apiRequest('/api/link-organizer-gpx', {
        method: 'POST',
        data: { rideId, tempFilePath, gpxData }
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "GPX linked successfully!",
        description: `Linked to your organized ride: ${data.rideName}`,
      });
      setShowOrganizerPrompt(false);
      setOrganizerPromptData(null);
      setAutoMatchConfirmationData(null); // Clear auto-match data
      navigate("/activities");
      setIsLinking(false);
    },
    onError: (error: any) => {
      toast({
        title: "Linking failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      setIsLinking(false);
    },
  });

  const handleUpload = () => {
    if (!file) return;
    setIsUploading(true);
    uploadActivityMutation.mutate(file);
  };

  const handleLinkToRide = (rideId: number) => {
    // Determine which data source to use (manual prompt or auto-match confirmation)
    const sourceData = organizerPromptData || autoMatchConfirmationData;

    if (!sourceData) return;

    setIsLinking(true);
    linkOrganizerGpxMutation.mutate({
      rideId,
      tempFilePath: sourceData.tempFilePath,
      gpxData: sourceData.gpxData,
    });
  };

  const handleUploadAsSolo = () => {
    if (!file) return;
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append("gpx", file);
    formData.append("isOrganizerOverride", "true");
    
    fetch("/api/upload-activity", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("sessionId") || ""}`,
      },
      body: formData,
    })
    .then(response => response.json())
    .then(data => {
      toast({
        title: "Solo activity created!",
        description: "Your GPX file has been uploaded as a solo activity.",
      });
      setShowOrganizerPrompt(false);
      setOrganizerPromptData(null);
      setAutoMatchConfirmationData(null); // Clear auto-match data
      navigate("/activities");
    })
    .catch(error => {
      toast({
        title: "Upload failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    })
    .finally(() => {
      setIsUploading(false);
    });
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="gpx-file">GPX File</Label>
              <div className="mt-2">
                <Input
                  id="gpx-file"
                  type="file"
                  accept=".gpx,application/gpx+xml"
                  onChange={handleFileChange}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            </div>

            {file && (
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  Ready to upload: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                </AlertDescription>
              </Alert>
            )}

            <Button 
              onClick={handleUpload} 
              disabled={!file || isUploading}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Activity
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Organizer Prompt Dialog */}
      <Dialog open={showOrganizerPrompt} onOpenChange={setShowOrganizerPrompt}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              {autoMatchConfirmationData ? 'Confirm Ride Link?' : 'Link to Organized Ride?'}
            </DialogTitle>
            <DialogDescription>
              {autoMatchConfirmationData ? 
                `The system automatically matched this activity to your organized ride: "${autoMatchConfirmationData.rideName}". Is this correct?` 
                : 
                'I noticed you organized a ride today. Would you like this GPX file to serve as the actual route for your planned ride?'
              }
            </DialogDescription>
          </DialogHeader>

          {/* Content based on whether it's auto-match confirmation or manual prompt */}
          {autoMatchConfirmationData ? (
            // Auto-match Confirmation Content
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Your Activity Data:</strong><br />
                  Distance: {autoMatchConfirmationData.gpxData?.distance?.toFixed(1) || 'N/A'} km | 
                  Duration: {formatDuration(autoMatchConfirmationData.gpxData?.duration || 0)} | 
                  Elevation: {autoMatchConfirmationData.gpxData?.elevationGain?.toFixed(0) || 'N/A'}m
                </AlertDescription>
              </Alert>
            </div>
          ) : organizerPromptData ? (
            // Manual Prompt Content
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Your Activity Data:</strong><br />
                  Distance: {organizerPromptData.gpxData.distance?.toFixed(1)} km | 
                  Duration: {formatDuration(organizerPromptData.gpxData.duration)} | 
                  Elevation: {organizerPromptData.gpxData.elevationGain?.toFixed(0)}m
                </AlertDescription>
              </Alert>

              <div>
                <h4 className="font-medium mb-3">Your Organized Rides Today:</h4>
                <div className="space-y-2">
                  {organizerPromptData.plannedRides.map((ride) => (
                    <Card key={ride.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h5 className="font-medium">{ride.name}</h5>
                          <p className="text-sm text-gray-600">{ride.description}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Clock className="w-3 h-3" />
                            {formatDate(ride.dateTime)}
                          </div>
                        </div>
                        <Button
                          onClick={() => handleLinkToRide(ride.id)}
                          disabled={isLinking}
                          variant="outline"
                          size="sm"
                        >
                          {isLinking ? (
                            <>
                              <Clock className="w-3 h-3 mr-1 animate-spin" />
                              Linking...
                            </>
                          ) : (
                            'Link This Ride'
                          )}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            {autoMatchConfirmationData ? (
              // Buttons for Auto-match Confirmation
              <>
                <Button
                  onClick={() => handleLinkToRide(autoMatchConfirmationData.rideId)}
                  disabled={isLinking}
                >
                  {isLinking ? 'Linking...' : 'Yes, Link'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleUploadAsSolo}
                  disabled={isUploading}
                >
                  No, Upload as Solo Activity
                </Button>
              </>
            ) : (organizerPromptData && (
              // Buttons for Manual Prompt
              <Button
                variant="outline"
                onClick={handleUploadAsSolo}
                disabled={isUploading}
              >
                Upload as Solo Activity
              </Button>
            ))}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}