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
import ManualLinkModal from "@/components/manual-link-modal"; // ADD this line


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

interface ParticipantPromptData {
  type: 'participant_manual_prompt';
  message: string;
  gpxData: {
    distance: number;
    duration: number;
    movingTime: number;
    elevationGain: number;
    // Add other relevant GPX data properties
  };
  joinedRides: Array<{ // Use joinedRides instead of plannedRides
    id: number;
    name: string;
    dateTime: string;
    description: string;
    organizerName: string; // Include organizerName for clarity
  }>;
  tempFilePath: string;
}

export default function UploadActivityPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showOrganizerPrompt, setShowOrganizerPrompt] = useState(false);
  const [organizerPromptData, setOrganizerPromptData] = useState<OrganizerPromptData | null>(null);
  //const [ridesForLinking, setRidesForLinking] = useState<any[]>([]); // To store the list of rides
  //const [tempFilePathForLinking, setTempFilePathForLinking] = useState<string | null>(null); // Store the temp file path
  //const [gpxDataForLinking, setGpxDataForLinking] = useState<any>(null); // Store the parsed gpxData
  const [isLinking, setIsLinking] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showParticipantPrompt, setShowParticipantPrompt] = useState(false);
    const [participantPromptData, setParticipantPromptData] = useState<ParticipantPromptData | null>(null);
  const [showParticipantAutoMatchConfirm, setShowParticipantAutoMatchConfirm] = useState(false);
    const [participantAutoMatchConfirmData, setParticipantAutoMatchConfirmData] = useState<any>(null);



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
        // This is a participant auto-match confirmation from the backend's perspective
        // Set the auto-match data and show the NEW prompt modal for participant confirmation
        setParticipantAutoMatchConfirmData(data);
        setShowParticipantAutoMatchConfirm(true);
      } else if (data.type === 'organizer_manual_prompt') {
        setOrganizerPromptData(data);
        setShowOrganizerPrompt(true);
      } else if (data.type === 'participant_manual_prompt') { // ADDED this case
        setParticipantPromptData(data);
        setShowParticipantPrompt(true);
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
    mutationFn: async ({ rideId, tempFilePath }: { 
      rideId: number; 
      tempFilePath: string; 
    }) => {
      const response = await apiRequest('/api/link-organizer-gpx', {
        method: 'POST',
        data: { rideId, tempFilePath,} 
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

  const linkParticipantActivityMutation = useMutation({
    mutationFn: async ({ rideId, tempFilePath }: {
      rideId: number;
      tempFilePath: string;
    }) => {
      setIsLinking(true); // Set isLinking to true when linking starts
      // *** IMPORTANT: Replace '/api/link-participant-activity' with your actual backend endpoint for participant linking ***
      const response = await apiRequest('/api/link-participant-gpx', {
        method: 'POST', // Or PUT/PATCH depending on your backend
        data: { rideId, tempFilePath, }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Participant linking failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Activity linked successfully!",
        description: data.message || `Linked to joined ride.`, // Use backend message if available
      });
      // Close relevant participant prompt modals and clear data on success
      setShowParticipantPrompt(false);
      setParticipantPromptData(null);
      setShowParticipantAutoMatchConfirm(false); // Close auto-match modal
      setParticipantAutoMatchConfirmData(null); // Clear auto-match data
      // Navigate to the activities page or the specific ride page
      navigate("/activities"); // Or navigate(`/rides/${data.linkedRideId}`) if you want to go to the ride page
      setIsLinking(false); // Set isLinking back to false
    },
    onError: (error: any) => {
      // ... (keep existing error handling) ...
      setIsLinking(false); // Set isLinking back to false on error
      // Consider also closing the modals on error if you want the user to retry the upload
       setShowParticipantPrompt(false);
       setParticipantPromptData(null);
       setShowParticipantAutoMatchConfirm(false);
       setParticipantAutoMatchConfirmData(null);
    },
  });
// END ADDED Participant Linking Mutation

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
    });
  };

   // ADDED: Handler for participant linking
   const handleLinkParticipantToRide = (rideId: number) => {
    if (!participantPromptData) {
      console.error("Participant prompt data is missing when trying to link.");
      toast({
         title: "Error",
         description: "Activity data missing. Please try linking again.",
         variant: "destructive",
      });
      return;
    }

    // Call the participant linking mutation
    linkParticipantActivityMutation.mutate({
      rideId,
      tempFilePath: participantPromptData.tempFilePath,
    });
  };
// END ADDED Participant Linking Handler


  const handleUploadAsSolo = async () => { // Make the function async
    // Determine which data source to use (manual prompt or auto-match confirmation)
    const sourceData = organizerPromptData || autoMatchConfirmationData || participantPromptData;

    if (!sourceData || !file) { // Add file check here
      toast({
        title: "Error",
        description: "Activity data missing. Please try uploading again.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true); // Use isUploading state for the solo upload

    try {
      // Prepare the data to send to the solo activities endpoint
      const soloActivityData = {
        // Include all the necessary fields for insertSoloActivitySchema
        name: `Manual Activity - ${new Date().toLocaleDateString()}`, // Or allow user to name it
        description: `Solo cycling activity uploaded manually`,
        activityType: 'cycling', // Or allow user to select
        gpxFilePath: sourceData.tempFilePath, // Use the temporary file path from the prompt/auto-match response
        distance: sourceData.gpxData.distance?.toString(), // Ensure it's a string if needed
        duration: sourceData.gpxData.duration,
        movingTime: sourceData.gpxData.movingTime,
        elevationGain: sourceData.gpxData.elevationGain?.toString(), // Ensure it's a string if needed
        averageSpeed: sourceData.gpxData.averageSpeed?.toString(), // Ensure it's a string if needed
        averageHeartRate: sourceData.gpxData.averageHeartRate,
        maxHeartRate: sourceData.gpxData.maxHeartRate,
        calories: sourceData.gpxData.calories,
        deviceName: sourceData.gpxData.deviceName || 'Manual Upload', // Get from gpxData if available
        deviceType: sourceData.gpxData.deviceType || 'manual',     // Get from gpxData if available
        completedAt: sourceData.gpxData.startTime ? new Date(sourceData.gpxData.startTime) : new Date(), // Use GPX start time or current date
        // userId will be added on the backend via requireAuth
      };

      // Call the /api/solo-activities endpoint directly
      const response = await apiRequest('/api/solo-activities', {
        method: 'POST',
        data: soloActivityData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create solo activity");
      }

      const soloActivity = await response.json();

      toast({
        title: "Solo activity created!",
        description: "Your GPX file has been uploaded as a solo activity.",
      });
      setShowOrganizerPrompt(false);
      setOrganizerPromptData(null);
      setAutoMatchConfirmationData(null); // Clear auto-match data
      navigate("/activities");

    } catch (error: any) {
      console.error("Upload as solo activity failed:", error); // Log the error
      toast({
        title: "Upload failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
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
          {/* ... DialogHeader (Keep this) ... */}
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                {autoMatchConfirmationData ? 'Confirm Ride Link?' : 'Link to Organized Ride?'} {/* Keep this dynamic title */}
              </DialogTitle>
              <DialogDescription>
                  {autoMatchConfirmationData ? 
                    `The system automatically matched this activity to your organized ride: "${autoMatchConfirmationData.rideName}". Is this correct?` 
                    : 
                  'I noticed you organized a ride today. Would you like this GPX file to serve as the actual route for your planned ride? Select the ride below.' // Update description for manual prompt
                  }
              </DialogDescription>

      {/* Content based on whether it's auto-match confirmation or manual prompt */}
          {autoMatchConfirmationData ? (
          // Auto-match Confirmation Content (KEEP THIS PART for now)
            <div className="space-y-4">
            {/* ... Alert with Activity Data ... */}
            {/* Display the automatically matched ride details here */}
            <Card className="p-4 border-green-500 bg-green-50">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h5 className="font-medium">Matched Ride: {autoMatchConfirmationData.rideName}</h5>
                  {/* Include other relevant matched ride details if available */}
                </div>
              </div>
            </Card>
          </div>
        ) : organizerPromptData ? (
          // Manual Prompt Content (REPLACED with ManualLinkModal)
          <ManualLinkModal
            isOpen={showOrganizerPrompt} // Use the existing state
              onClose={() => {
                setShowOrganizerPrompt(false);
                setOrganizerPromptData(null); // Clear data when closing
                setAutoMatchConfirmationData(null); // Also clear auto-match data here for safety
              }}
            rides={organizerPromptData.plannedRides.map(ride => ({ // Map to the expected RideToLink format
               id: ride.id,
               name: ride.name,
               dateTime: ride.dateTime,
               description: ride.description,
          }))}
          onLinkRide={(rideId) => handleLinkToRide(rideId)} // Pass the organizer linking handler
          isLoading={linkOrganizerGpxMutation.isPending}
          modalTitle="Link Organizer GPX to Planned Ride" // Title will be handled by the main DialogTitle, but pass for consistency if needed
          modalDescription="" // Description will be handled by the main DialogDescription
          manualPromptText="We didn't find any matched planned rides, but noticed that you have planned rides on the same day as your uploaded GPX. Would you want to link your GPX to any of these rides?" // ADDED: Specific text
          confirmButtonText="Link GPX"
          onUploadAsSolo={handleUploadAsSolo} // Pass the solo upload handler
          isUploadingSolo={isUploading} // Pass the solo upload loading state
      />
    ) : null}

        <DialogFooter className="gap-2">
         {/* Footer buttons - ADJUST based on which state is active */}
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
              {/* ADDED: Button to switch to manual linking */}
              <Button
                variant="ghost" // Use a less prominent style
                onClick={() => {
                   // Close auto-match confirmation
                   setAutoMatchConfirmationData(null);
                   // Open manual prompt modal with the data received in the auto-match response
                   if (autoMatchConfirmationData?.plannedRides) {
                       setOrganizerPromptData({
                           type: 'organizer_manual_prompt', // Set type for the manual prompt state
                           message: 'Select the planned ride to link your GPX to:', // You can customize this message
                           gpxData: autoMatchConfirmationData.gpxData,
                           plannedRides: autoMatchConfirmationData.plannedRides, // Use the plannedRides from the auto-match response
                           tempFilePath: autoMatchConfirmationData.tempFilePath,
                       });
                       // setShowOrganizerPrompt(true); // This state is already true for the main dialog
                   } else {
                       console.error("Planned rides list missing in auto-match response.");
                       toast({
                            title: "Error",
                            description: "Could not load planned rides for manual selection.",
                            variant: "destructive",
                       });
                       // Optionally close the modal if plannedRides is missing
                       setShowOrganizerPrompt(false);
                   }
                }}
                disabled={isLinking || isUploading} // Disable while linking/uploading
              >
                Choose from a list instead
              </Button>
            </>
         ) : (organizerPromptData && (
            // Buttons for Manual Prompt (Solo Upload button only, as linking is handled per ride)
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



      {/* Participant Prompt Dialog */}
    <Dialog open={showParticipantPrompt} onOpenChange={setShowParticipantPrompt}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Link to Joined Ride?
          </DialogTitle>
          <DialogDescription>
            The system couldn't automatically match your activity, but found some joined rides around the same time. Would you like to link this activity to one of them?
          </DialogDescription>
        </DialogHeader>

        {participantPromptData && ( // Ensure participantPromptData is available
          // Replaced content with ManualLinkModal
          <ManualLinkModal
              isOpen={showParticipantPrompt} // Use the existing state
              onClose={() => {
                setShowParticipantPrompt(false);
                setParticipantPromptData(null); // Clear data when closing
              }}
              rides={participantPromptData.joinedRides.map(ride => ({ // Map to the expected RideToLink format
                  id: ride.id,
                  name: ride.name,
                  dateTime: ride.dateTime,
                  description: ride.description,
                  organizerName: ride.organizerName, // Include organizerName
              }))}
              onLinkRide={(rideId) => handleLinkParticipantToRide(rideId)} // Pass the participant linking handler
              isLoading={linkParticipantActivityMutation.isPending}
              modalTitle="Link Activity to Joined Ride" // Title will be handled by the main DialogHeader
              modalDescription="" // Description will be handled by the main DialogHeader
              manualPromptText="The system couldn't automatically match your activity, but found some joined rides around the same time. Would you like to link this activity to one of them? Select the ride below." // ADDED: Specific text
              confirmButtonText="Link This Activity"
              onUploadAsSolo={handleUploadAsSolo} // Pass the solo upload handler
              isUploadingSolo={isUploading} // Pass the solo upload loading state
            />
        )}

        {/* Dialog Footer with Solo Upload Option */}
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            // Connect this button to the solo upload handler
            onClick={handleUploadAsSolo}
            disabled={isUploading} // Keep disabled state for solo upload
          >
            Upload as Solo Activity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {/* END ADDED Participant Prompt Dialog */}
    {/* Participant Auto-Match Confirmation Dialog */}
    <Dialog open={showParticipantAutoMatchConfirm} onOpenChange={setShowParticipantAutoMatchConfirm}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" /> {/* Use a confirmation icon */}
            Confirm Activity Match?
          </DialogTitle>
          {participantAutoMatchConfirmData && (
              <DialogDescription>
                The system automatically matched this activity to your joined ride: "{participantAutoMatchConfirmData.rideName}" with {(participantAutoMatchConfirmData.matchScore as number).toFixed(1)}% similarity. Is this correct?
              </DialogDescription>
          )}
        </DialogHeader>

        {/* Display the automatically matched ride details here */}
        {participantAutoMatchConfirmData && (
            <Card className="p-4 border-green-500 bg-green-50">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h5 className="font-medium">Matched Ride: {participantAutoMatchConfirmData.rideName}</h5>
                  {/* Add other relevant matched ride details from participantAutoMatchConfirmData if available */}
                  {/* Example: */}
                  {/* <p className="text-sm text-gray-500">Date: {formatDate(participantAutoMatchConfirmData.rideDateTime)}</p> */}
                  {/* <p className="text-sm text-gray-500">Organizer: {participantAutoMatchConfirmData.organizerName}</p> */}
                </div>
                <div className="font-bold text-green-700">
                   {(participantAutoMatchConfirmData.matchScore as number).toFixed(1)}% Match
                </div>
              </div>
            </Card>
        )}

        <DialogFooter className="gap-2">
          {/* Button to confirm auto-match */}
          <Button
            onClick={() => {
               if (participantAutoMatchConfirmData) {
                   handleLinkParticipantToRide(participantAutoMatchConfirmData.rideId);
               }
            }}
            disabled={linkParticipantActivityMutation.isPending}
          >
            {linkParticipantActivityMutation.isPending ? 'Linking...' : 'Yes, Link Activity'}
          </Button>

          {/* Button to switch to manual linking */}
          <Button
            variant="outline"
            onClick={() => {
               // Close auto-match confirmation modal
               setShowParticipantAutoMatchConfirm(false);
               setParticipantAutoMatchConfirmData(null);

               // Open the manual participant prompt modal
               if (participantAutoMatchConfirmData?.joinedRides) { // Use joinedRides from auto-match data
                   setParticipantPromptData({
                       type: 'participant_manual_prompt', // Set type for the manual prompt state
                       message: 'Select the joined ride to link your activity to:', // Customize message
                       gpxData: participantAutoMatchConfirmData.gpxData,
                       joinedRides: participantAutoMatchConfirmData.joinedRides.map((ride: any) => ({ // Map to expected format
                           id: ride.id,
                           name: ride.name,
                           dateTime: ride.dateTime,
                           description: ride.description,
                           organizerName: ride.organizerName, // Assuming organizerName is available
                       })),
                       tempFilePath: participantAutoMatchConfirmData.tempFilePath,
                   });
                   setShowParticipantPrompt(true);
               } else {
                   console.error("Joined rides list missing in auto-match response.");
                   toast({
                        title: "Error",
                        description: "Could not load joined rides for manual selection.",
                        variant: "destructive",
                   });
                   // Optionally upload as solo if list is missing
                   handleUploadAsSolo(); // Call solo upload handler if list is missing
               }
            }}
            disabled={isLinking || isUploading} // Disable while linking/uploading
          >
            Choose from a list instead
          </Button>

           {/* Option to upload as solo directly from here */}
           <Button
            variant="ghost" // Use a less prominent style
            onClick={() => {
               setShowParticipantAutoMatchConfirm(false);
               setParticipantAutoMatchConfirmData(null);
               handleUploadAsSolo(); // Call solo upload handler
            }}
            disabled={isLinking || isUploading} // Disable while linking/uploading
          >
            Upload as Solo Activity
          </Button>

        </DialogFooter>
      </DialogContent>
    </Dialog>


Refining the Existing Organizer Prompt Dialog:

Your existing Dialog controlled by showOrganizerPrompt is currently trying to handle both organizer manual prompts and participant auto-match confirmations.
Now that we have a dedicated dialog for participant auto-match confirmation, the showOrganizerPrompt dialog should only handle organizer-related prompts ('organizer_manual_prompt').
Remove the logic within this dialog that specifically checks autoMatchConfirmationData for rendering content and buttons.
In the Dialog component controlled by showOrganizerPrompt:

Simplify the DialogTitle and DialogDescription to only reflect the organizer manual prompt.
In the DialogFooter, remove the conditional rendering for buttons based on autoMatchConfirmationData. Keep only the "Upload as Solo Activity" button if that's the only fallback option for an organizer who doesn't link to a planned ride. The linking action itself is handled within the ManualLinkModal for the organizer manual prompt case.
Modify the Dialog component controlled by showOrganizerPrompt:

jsx
    {/* Organizer Manual Prompt Dialog (Adjusted) */}
    <Dialog open={showOrganizerPrompt} onOpenChange={setShowOrganizerPrompt}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Link Organizer GPX to Planned Ride? {/* Simplified title */}
              </DialogTitle>
              {organizerPromptData && ( // Only show description if organizerPromptData is available
                  <DialogDescription>
                      {organizerPromptData.message} {/* Use the message from the backend */}
                  </DialogDescription>
              )}
        </DialogHeader>

      {/* Content using ManualLinkModal for organizer manual prompt */}
          {organizerPromptData ? ( // Only render ManualLinkModal if organizerPromptData is available
          <ManualLinkModal
            isOpen={showOrganizerPrompt} // Use the existing state
              onClose={() => {
                setShowOrganizerPrompt(false);
                setOrganizerPromptData(null); // Clear data when closing
              }}
            rides={organizerPromptData.plannedRides.map(ride => ({ // Map to the expected RideToLink format
               id: ride.id,
               name: ride.name,
               dateTime: ride.dateTime,
               description: ride.description,
          }))}
          onLinkRide={(rideId) => handleLinkToRide(rideId)} // Pass the organizer linking handler
          isLoading={linkOrganizerGpxMutation.isPending}
          modalTitle="" // Title handled by main DialogTitle
          modalDescription="" // Description handled by main DialogDescription
          manualPromptText="Select the planned ride below to link your GPX as the actual route." // Customize text for organizer
          confirmButtonText="Link GPX"
          onUploadAsSolo={handleUploadAsSolo} // Pass the solo upload handler
          isUploadingSolo={isUploading} // Pass the solo upload loading state
      />
    ) : null}

        <DialogFooter className="gap-2">
         {/* Footer buttons - Only show solo upload option here */}
          {organizerPromptData && ( // Only show button if organizerPromptData is available
            <Button
              variant="outline"
              onClick={handleUploadAsSolo}
              disabled={isUploading}
            >
              Upload as Solo Activity
            </Button>
         )}
    </DialogFooter>
    </DialogContent>
  </Dialog>


    </div>
  );
}