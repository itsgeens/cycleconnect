import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Smartphone, 
  Watch, 
  Cpu, 
  Bluetooth, 
  Battery, 
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wifi
} from "lucide-react";
import { deviceManager, DeviceConnectionManager } from "@/lib/device-connection";
import { DeviceConnection } from "@shared/device-schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DeviceConnectionPanelProps {
  rideId?: number;
  onDeviceConnected?: (device: DeviceConnection) => void;
}

export default function DeviceConnectionPanel({ 
  rideId, 
  onDeviceConnected 
}: DeviceConnectionPanelProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState<DeviceConnection[]>([]);
  const [webBluetoothSupported, setWebBluetoothSupported] = useState(false);
  const { toast } = useToast();

  // Check Web Bluetooth support on mount
  useEffect(() => {
    setWebBluetoothSupported(DeviceConnectionManager.isSupported());
  }, []);

  // Query for user's saved devices
  const { data: savedDevices, isLoading } = useQuery({
    queryKey: ["/api/my-devices"],
    queryFn: async () => {
      const response = await fetch("/api/my-devices");
      if (!response.ok) throw new Error("Failed to fetch devices");
      return response.json();
    },
  });

  // Mutation to save device connection
  const saveDeviceMutation = useMutation({
    mutationFn: (device: DeviceConnection) => 
      apiRequest('POST', '/api/devices', device),
    onSuccess: () => {
      toast({
        title: "Device saved",
        description: "Your device connection has been saved for future use.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save device",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Connect to new device
  const handleConnectDevice = async () => {
    setIsConnecting(true);
    
    try {
      const device = await deviceManager.connectToCyclingDevice();
      
      if (device) {
        setConnectedDevices(prev => [...prev, device]);
        onDeviceConnected?.(device);
        
        // Save device to database
        saveDeviceMutation.mutate(device);
        
        toast({
          title: "Device connected",
          description: `Successfully connected to ${device.deviceName}`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Connection failed",
        description: error.message || "Failed to connect to device. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect from device
  const handleDisconnectDevice = async (deviceId: string) => {
    try {
      await deviceManager.disconnectDevice(deviceId);
      setConnectedDevices(prev => prev.filter(d => d.deviceId !== deviceId));
      
      toast({
        title: "Device disconnected",
        description: "Device has been disconnected",
      });
    } catch (error: any) {
      toast({
        title: "Disconnection failed",
        description: error.message || "Failed to disconnect device.",
        variant: "destructive",
      });
    }
  };

  // Get device icon
  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'cycling_computer':
        return <Cpu className="w-5 h-5" />;
      case 'smartwatch':
        return <Watch className="w-5 h-5" />;
      case 'phone':
        return <Smartphone className="w-5 h-5" />;
      default:
        return <Bluetooth className="w-5 h-5" />;
    }
  };

  // Get device type label
  const getDeviceTypeLabel = (deviceType: string) => {
    switch (deviceType) {
      case 'cycling_computer':
        return 'Cycling Computer';
      case 'smartwatch':
        return 'Smart Watch';
      case 'phone':
        return 'Phone';
      default:
        return 'Device';
    }
  };

  // Get protocol icon
  const getProtocolIcon = (protocol: string) => {
    switch (protocol) {
      case 'ble':
        return <Bluetooth className="w-4 h-4" />;
      case 'ant_plus':
        return <Zap className="w-4 h-4" />;
      default:
        return <Wifi className="w-4 h-4" />;
    }
  };

  if (!webBluetoothSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-destructive" />
            Device Connection Not Supported
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Opera 
              to connect cycling computers and smartwatches for automatic ride tracking.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bluetooth className="w-5 h-5" />
          Device Connections
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Connect your cycling computer or smartwatch for automatic ride completion
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Button */}
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleConnectDevice}
            disabled={isConnecting}
            size="sm"
          >
            {isConnecting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Connecting...
              </>
            ) : (
              <>
                <Bluetooth className="w-4 h-4 mr-2" />
                Connect Device
              </>
            )}
          </Button>
          
          <Badge variant="secondary" className="text-xs">
            {connectedDevices.length} active
          </Badge>
        </div>

        <Separator />

        {/* Connected Devices */}
        {connectedDevices.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Active Connections</h4>
            {connectedDevices.map((device) => (
              <div 
                key={device.deviceId}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getDeviceIcon(device.deviceType)}
                  <div>
                    <div className="font-medium text-sm">{device.deviceName}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      {getProtocolIcon(device.protocol)}
                      {getDeviceTypeLabel(device.deviceType)}
                      {device.batteryLevel && (
                        <>
                          <Battery className="w-3 h-3 ml-1" />
                          {device.batteryLevel}%
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnectDevice(device.deviceId)}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Saved Devices */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : savedDevices?.length > 0 ? (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Saved Devices</h4>
            {savedDevices.map((device: DeviceConnection) => (
              <div 
                key={device.deviceId}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getDeviceIcon(device.deviceType)}
                  <div>
                    <div className="font-medium text-sm">{device.deviceName}</div>
                    <div className="text-xs text-muted-foreground">
                      {device.manufacturer} {device.model}
                      {device.lastSeen && (
                        <span className="ml-2">
                          Last seen: {new Date(device.lastSeen).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <Badge variant="outline" className="text-xs">
                  {device.isActive ? 'Available' : 'Inactive'}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Bluetooth className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No devices connected yet</p>
            <p className="text-xs">Connect your cycling computer or smartwatch to get started</p>
          </div>
        )}

        {/* Information */}
        <Alert>
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="text-xs">
            <strong>Automatic Ride Completion:</strong> When you upload a GPX file from your device that matches 
            the planned route (85%+ similarity) and starts within 1 hour of the scheduled time, 
            your ride participation will be automatically marked as completed.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}