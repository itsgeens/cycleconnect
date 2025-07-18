import { useState, useEffect, useRef } from "react";
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
  Wifi,
  Upload,
  FileText
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
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Check Web Bluetooth support on mount
  useEffect(() => {
    setWebBluetoothSupported(DeviceConnectionManager.isSupported());
  }, []);

  // Check if we're on a secure connection
  const isSecureConnection = window.location.protocol === 'https:' || window.location.hostname === 'localhost';

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
      
      setConnectedDevices(prev => [...prev, device]);
      onDeviceConnected?.(device);
      
      // Save device to database
      saveDeviceMutation.mutate(device);
      
      toast({
        title: "Device connected",
        description: `Successfully connected to ${device.deviceName}`,
      });
    } catch (error: any) {
      console.error('Connection error:', error);
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

  // Handle manual GPX upload
  const handleGpxUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.gpx')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a GPX file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('gpx', file);
      formData.append('deviceName', 'Manual Upload');
      formData.append('deviceType', 'cycling_computer');

      const response = await fetch('/api/upload-activity', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload GPX file');
      }

      const result = await response.json();
      
      toast({
        title: "GPX uploaded successfully",
        description: `Activity uploaded and ready for route matching. ${result.matches ? `Found ${result.matches} potential ride matches.` : ''}`,
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload GPX file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
        {/* Connection Options */}
        <div className="space-y-3">
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

          {/* Alternative Connection Method */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <h4 className="font-medium text-sm mb-2">Can't Connect Your Garmin Device?</h4>
            <p className="text-xs text-muted-foreground mb-2">
              Most Garmin Edge devices can't connect directly to laptops via Bluetooth. Here are your options:
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-amber-400 text-white text-xs flex items-center justify-center mt-0.5">1</div>
                <div className="flex-1">
                  <p className="text-xs font-medium">Manual GPX Upload</p>
                  <p className="text-xs text-muted-foreground mb-2">After your ride, upload your GPX file manually for automatic completion matching</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".gpx"
                      onChange={handleGpxUpload}
                      ref={fileInputRef}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="text-xs h-7"
                    >
                      {isUploading ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent mr-1" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3 h-3 mr-1" />
                          Upload GPX
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-amber-400 text-white text-xs flex items-center justify-center mt-0.5">2</div>
                <div>
                  <p className="text-xs font-medium">Smartphone Bridge</p>
                  <p className="text-xs text-muted-foreground">Use your phone's Garmin Connect app to sync, then upload from there</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-amber-400 text-white text-xs flex items-center justify-center mt-0.5">3</div>
                <div>
                  <p className="text-xs font-medium">ANT+ Dongle (Coming Soon)</p>
                  <p className="text-xs text-muted-foreground">Future support for ANT+ USB dongles for direct connection</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Connection Methods */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Direct Bluetooth Connection */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Bluetooth className="w-4 h-4" />
              Direct Connection
            </h4>
            <ul className="text-xs space-y-1 text-muted-foreground">
              <li>• Smartphones and some smartwatches</li>
              <li>• Newer Wahoo devices</li>
              <li>• Some Garmin watches (Fenix, Forerunner)</li>
              <li>• Make device discoverable first</li>
            </ul>
          </div>

          {/* Alternative Methods */}
          <div className="bg-orange-50 p-3 rounded-lg">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Alternative Methods
            </h4>
            <ul className="text-xs space-y-1 text-muted-foreground">
              <li>• Upload GPX files manually</li>
              <li>• Use Garmin Connect mobile app</li>
              <li>• Connect via smartphone bridge</li>
              <li>• ANT+ USB dongle (future support)</li>
            </ul>
          </div>
        </div>

        {/* Device Compatibility Guide */}
        <Alert>
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            <strong>Device Compatibility</strong>
            <div className="mt-2 space-y-1 text-xs">
              <p><strong>✅ Direct Bluetooth:</strong> Smartphones, some smartwatches, newer Wahoo devices</p>
              <p><strong>❌ Limited Support:</strong> Most Garmin Edge cycling computers (use manual GPX upload instead)</p>
              <p><strong>Browser:</strong> Chrome, Edge, or Opera required (Firefox/Safari not supported)</p>
              {!isSecureConnection && (
                <p className="text-red-600 font-medium">
                  <strong>⚠️ Secure connection required:</strong> Web Bluetooth only works with HTTPS
                </p>
              )}
            </div>
          </AlertDescription>
        </Alert>

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