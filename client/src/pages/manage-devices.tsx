import { useState } from "react";
import Navbar from "@/components/navbar";
import DeviceConnectionPanel from "@/components/device-connection-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  Smartphone, 
  Watch, 
  Cpu, 
  Zap, 
  Info,
  CheckCircle,
  Bluetooth
} from "lucide-react";
import { DeviceConnection } from "@shared/device-schema";

export default function ManageDevices() {
  const [connectedDevices, setConnectedDevices] = useState<DeviceConnection[]>([]);

  const handleDeviceConnected = (device: DeviceConnection) => {
    setConnectedDevices(prev => [...prev, device]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Settings className="w-8 h-8" />
            Manage Devices
          </h1>
          <p className="text-gray-600">
            Connect and manage your cycling computers and smartwatches for automatic ride tracking
          </p>
        </div>

        <div className="grid gap-6">
          {/* Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                How Automatic Ride Completion Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium">Supported Devices</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-blue-600" />
                      <span className="text-sm">Cycling Computers (Garmin Edge, Wahoo Elemnt)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Watch className="w-4 h-4 text-green-600" />
                      <span className="text-sm">Smartwatches (Garmin Fenix, Forerunner)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-purple-600" />
                      <span className="text-sm">Smartphones with GPS tracking</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium">Automatic Completion Requirements</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm">85% route similarity match</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm">Start within 1 hour of planned time</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm">Valid GPX track data</span>
                    </div>
                  </div>
                </div>
              </div>

              <Alert>
                <Bluetooth className="w-4 h-4" />
                <AlertDescription>
                  <strong>Browser Requirements:</strong> Web Bluetooth is supported in Chrome, Edge, and Opera. 
                  Make sure you're using a compatible browser and have granted device permissions.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Device Connection Panel */}
          <DeviceConnectionPanel 
            onDeviceConnected={handleDeviceConnected}
          />

          {/* Connected Devices Summary */}
          {connectedDevices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Session Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="secondary">
                    {connectedDevices.length} device{connectedDevices.length !== 1 ? 's' : ''} connected this session
                  </Badge>
                </div>
                <div className="space-y-2">
                  {connectedDevices.map((device, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex items-center gap-2">
                        {device.deviceType === 'cycling_computer' && <Cpu className="w-4 h-4" />}
                        {device.deviceType === 'smartwatch' && <Watch className="w-4 h-4" />}
                        {device.deviceType === 'phone' && <Smartphone className="w-4 h-4" />}
                        <span className="text-sm font-medium">{device.deviceName}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {device.protocol.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tips and Troubleshooting */}
          <Card>
            <CardHeader>
              <CardTitle>Tips for Best Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium">Connection Tips</h4>
                  <ul className="text-sm space-y-1 text-gray-600">
                    <li>• Keep your device close to your computer during setup</li>
                    <li>• Ensure your device is in pairing mode</li>
                    <li>• Check that Bluetooth is enabled on both devices</li>
                    <li>• Try refreshing the page if connection fails</li>
                  </ul>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium">Tracking Tips</h4>
                  <ul className="text-sm space-y-1 text-gray-600">
                    <li>• Start recording before the planned ride time</li>
                    <li>• Follow the planned route as closely as possible</li>
                    <li>• Keep GPS enabled throughout the ride</li>
                    <li>• Save the activity after completing the ride</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}