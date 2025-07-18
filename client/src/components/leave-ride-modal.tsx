import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface LeaveRideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
  rideName?: string;
}

export default function LeaveRideModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isLoading = false,
  rideName
}: LeaveRideModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="modal-content z-[10001]">
        <DialogHeader>
          <DialogTitle>Leave Ride</DialogTitle>
          <DialogDescription>
            Are you sure you want to leave {rideName ? `"${rideName}"` : "this ride"}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Leaving..." : "Leave Ride"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}