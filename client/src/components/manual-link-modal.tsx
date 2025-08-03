// src/components/manual-link-modal.tsx

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
  import { Button } from "@/components/ui/button";
  import { Card } from "@/components/ui/card";
  import { Clock, MapPin } from "lucide-react";
  
  interface RideToLink {
    id: number;
    name: string;
    dateTime: string;
    description: string;
    organizerName?: string; // Optional, for participant joined rides
  }
  
  interface ManualLinkModalProps {
    isOpen: boolean;
    onClose: () => void;
    rides: RideToLink[]; // List of rides to display
    onLinkRide: (rideId: number) => void; // Function to call when a ride is linked
    isLoading: boolean; // Loading state from the mutation
    modalTitle: string;
    modalDescription: string;
    confirmButtonText: string;
    onUploadAsSolo?: () => void; // Optional: Handler for uploading as solo
    isUploadingSolo?: boolean; // Optional: Loading state for solo upload
    manualPromptText?: string; // ADDED: Optional text for manual prompt scenario

  }
  
  const formatDuration = (seconds: number) => {
      // ... (copy from upload-activity.tsx)
       const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    };
  
    const formatDate = (dateString: string) => {
      // ... (copy from upload-activity.tsx)
       return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    };
  
  
  export default function ManualLinkModal({
    isOpen,
    onClose,
    rides,
    onLinkRide,
    isLoading,
    modalTitle,
    modalDescription,
    confirmButtonText,
    onUploadAsSolo,
    isUploadingSolo,
    manualPromptText, // ADDED: Destructure manualPromptText from props
  }: ManualLinkModalProps) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              {modalTitle}
            </DialogTitle>
            {manualPromptText ? (
            <DialogDescription>{manualPromptText}</DialogDescription>
          ) : (
            <DialogDescription>{modalDescription}</DialogDescription>
          )}
          </DialogHeader>
  
          <div className="space-y-4">
            {/* Optional: Display activity data if available in props */}
            {/* You might want to pass activity data as a prop to the modal */}
  
            <div>
              <h4 className="font-medium mb-3">Available Rides:</h4>
              <div className="space-y-2">
                {rides.map((ride) => (
                  <Card key={ride.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h5 className="font-medium">{ride.name}</h5>
                         {ride.organizerName && ( // Display organizer name for participant rides
                             <p className="text-sm text-gray-600">Organized by: {ride.organizerName}</p>
                         )}
                        <p className="text-sm text-gray-600">{ride.description}</p> {/* Display ride description */}
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Clock className="w-3 h-3" />
                          {formatDate(ride.dateTime)}
                        </div>
                      </div>
                      <Button
                        onClick={() => onLinkRide(ride.id)}
                        disabled={isLoading}
                        variant="outline"
                        size="sm"
                      >
                        {isLoading ? (
                          <>
                            <Clock className="w-3 h-3 mr-1 animate-spin" />
                            Linking...
                          </>
                        ) : (
                          confirmButtonText
                        )}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
  
          <DialogFooter className="gap-2">
             {onUploadAsSolo && ( // Only show solo upload if handler is provided
                 <Button
                  variant="outline"
                  onClick={onUploadAsSolo}
                  disabled={isUploadingSolo}
                >
                  {isUploadingSolo ? 'Uploading Solo...' : 'Upload as Solo Activity'}
                </Button>
             )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  