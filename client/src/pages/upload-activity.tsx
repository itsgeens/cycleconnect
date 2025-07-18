import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, FileText, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Navbar from "@/components/navbar";

export default function UploadActivityPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showNoMatchModal, setShowNoMatchModal] = useState(false);
  const [uploadedActivityData, setUploadedActivityData] = useState<any>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Get planned activities to check for matches
  const { data: myRides } = useQuery({
    queryKey: ["/api/my-rides"],
  });

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
      if (data.matchedRide) {
        toast({
          title: "Activity uploaded successfully!",
          description: `Matched with planned ride: ${data.matchedRide.name}`,
        });
        navigate("/activities");
      } else if (data.soloActivity) {
        toast({
          title: "Solo activity created!",
          description: "Your activity has been saved.",
        });
        navigate("/activities");
      } else {
        // Fallback for old response format
        setUploadedActivityData(data.activityData);
        setShowNoMatchModal(true);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const createSoloActivityMutation = useMutation({
    mutationFn: (activityData: any) => apiRequest('POST', '/api/solo-activities', activityData),
    onSuccess: () => {
      toast({
        title: "Solo activity created!",
        description: "Your activity has been saved.",
      });
      setShowNoMatchModal(false);
      setUploadedActivityData(null);
      navigate("/activities");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create solo activity",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleUpload = () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a GPX file to upload",
        variant: "destructive",
      });
      return;
    }

    uploadActivityMutation.mutate(file);
  };

  const handleCreateSoloActivity = () => {
    if (uploadedActivityData) {
      // Send the activity data as-is, the schema will handle date conversion
      createSoloActivityMutation.mutate(uploadedActivityData);
    }
  };

  const handleCancelUpload = () => {
    setShowNoMatchModal(false);
    setUploadedActivityData(null);
    setFile(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Upload Activity</h1>
          <p className="text-gray-600 max-w-2xl">
            Upload your GPX file to track your cycling activity. We'll automatically try to match it with your planned rides.
          </p>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload GPX File
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="gpx-file">Select GPX File</Label>
              <Input
                id="gpx-file"
                type="file"
                accept=".gpx,application/gpx+xml"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {file && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                  <FileText className="w-4 h-4" />
                  <span>{file.name}</span>
                  <span className="text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">How it works:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• We'll check if your activity matches any past planned rides (85% similarity)</li>
                <li>• If matched, it will be marked as completed automatically</li>
                <li>• If no match, you can save it as a solo activity</li>
              </ul>
            </div>

            <div className="flex gap-4">
              <Button 
                onClick={handleUpload} 
                disabled={!file || uploadActivityMutation.isPending}
                className="flex-1"
              >
                {uploadActivityMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Activity
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate("/activities")}
                disabled={uploadActivityMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* No Match Modal */}
        <Dialog open={showNoMatchModal} onOpenChange={setShowNoMatchModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                No Matching Planned Activity
              </DialogTitle>
              <DialogDescription>
                Your uploaded activity doesn't match any of your planned rides (85% similarity threshold). 
                Would you like to save it as a solo activity instead?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleCancelUpload}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateSoloActivity}
                disabled={createSoloActivityMutation.isPending}
              >
                {createSoloActivityMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  "Upload Solo Activity"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}