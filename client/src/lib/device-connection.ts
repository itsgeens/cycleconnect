// Web Bluetooth API integration for cycling computers and smartwatches
import { DeviceConnection, GpxData } from "@shared/device-schema";

export class DeviceConnectionManager {
  private connectedDevices: Map<string, BluetoothDevice> = new Map();
  private activeConnections: Map<string, BluetoothRemoteGATTServer> = new Map();

  // Standard Bluetooth GATT services for cycling devices
  private static readonly CYCLING_SERVICES = {
    CYCLING_SPEED_CADENCE: '00001816-0000-1000-8000-00805f9b34fb',
    CYCLING_POWER: '00001818-0000-1000-8000-00805f9b34fb',
    HEART_RATE: '0000180d-0000-1000-8000-00805f9b34fb',
    DEVICE_INFORMATION: '0000180a-0000-1000-8000-00805f9b34fb',
    BATTERY_SERVICE: '0000180f-0000-1000-8000-00805f9b34fb',
  };

  // Check if Web Bluetooth is supported
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 
           'bluetooth' in navigator && 
           typeof navigator.bluetooth.requestDevice === 'function';
  }

  // Connect to a cycling computer or smartwatch
  async connectToCyclingDevice(): Promise<DeviceConnection | null> {
    if (!DeviceConnectionManager.isSupported()) {
      throw new Error('Web Bluetooth not supported in this browser');
    }

    try {
      // Request device with cycling-specific services
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [DeviceConnectionManager.CYCLING_SERVICES.CYCLING_SPEED_CADENCE] },
          { services: [DeviceConnectionManager.CYCLING_SERVICES.CYCLING_POWER] },
          { services: [DeviceConnectionManager.CYCLING_SERVICES.HEART_RATE] },
        ],
        optionalServices: [
          DeviceConnectionManager.CYCLING_SERVICES.DEVICE_INFORMATION,
          DeviceConnectionManager.CYCLING_SERVICES.BATTERY_SERVICE,
        ]
      });

      // Connect to the device
      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error('Failed to connect to device GATT server');
      }

      // Store the connection
      this.connectedDevices.set(device.id, device);
      this.activeConnections.set(device.id, server);

      // Get device information
      const deviceInfo = await this.getDeviceInformation(server);
      const batteryLevel = await this.getBatteryLevel(server);

      const connection: DeviceConnection = {
        deviceId: device.id,
        deviceName: device.name || 'Unknown Device',
        deviceType: this.detectDeviceType(device.name || ''),
        protocol: 'ble',
        manufacturer: deviceInfo.manufacturer,
        model: deviceInfo.model,
        batteryLevel,
        lastSeen: new Date(),
      };

      return connection;

    } catch (error) {
      console.error('Error connecting to device:', error);
      return null;
    }
  }

  // Detect device type based on name
  private detectDeviceType(deviceName: string): DeviceConnection['deviceType'] {
    const name = deviceName.toLowerCase();
    
    if (name.includes('edge') || name.includes('garmin') || name.includes('wahoo')) {
      return 'cycling_computer';
    } else if (name.includes('watch') || name.includes('fenix') || name.includes('forerunner')) {
      return 'smartwatch';
    } else {
      return 'phone';
    }
  }

  // Get device information
  private async getDeviceInformation(server: BluetoothRemoteGATTServer): Promise<{
    manufacturer?: string;
    model?: string;
  }> {
    try {
      const service = await server.getPrimaryService(DeviceConnectionManager.CYCLING_SERVICES.DEVICE_INFORMATION);
      
      const manufacturerChar = await service.getCharacteristic('00002a29-0000-1000-8000-00805f9b34fb');
      const modelChar = await service.getCharacteristic('00002a24-0000-1000-8000-00805f9b34fb');
      
      const manufacturerData = await manufacturerChar.readValue();
      const modelData = await modelChar.readValue();
      
      return {
        manufacturer: new TextDecoder().decode(manufacturerData),
        model: new TextDecoder().decode(modelData),
      };
    } catch (error) {
      console.warn('Could not read device information:', error);
      return {};
    }
  }

  // Get battery level
  private async getBatteryLevel(server: BluetoothRemoteGATTServer): Promise<number | undefined> {
    try {
      const service = await server.getPrimaryService(DeviceConnectionManager.CYCLING_SERVICES.BATTERY_SERVICE);
      const characteristic = await service.getCharacteristic('00002a19-0000-1000-8000-00805f9b34fb');
      const value = await characteristic.readValue();
      return value.getUint8(0);
    } catch (error) {
      console.warn('Could not read battery level:', error);
      return undefined;
    }
  }

  // Start monitoring for activity data
  async startActivityMonitoring(deviceId: string, onDataReceived: (data: Partial<GpxData>) => void): Promise<void> {
    const server = this.activeConnections.get(deviceId);
    if (!server) {
      throw new Error('Device not connected');
    }

    try {
      // Monitor cycling speed and cadence
      const cscService = await server.getPrimaryService(DeviceConnectionManager.CYCLING_SERVICES.CYCLING_SPEED_CADENCE);
      const cscCharacteristic = await cscService.getCharacteristic('00002a5b-0000-1000-8000-00805f9b34fb');
      
      await cscCharacteristic.startNotifications();
      cscCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
        const data = this.parseCSCData(event.target as BluetoothRemoteGATTCharacteristic);
        onDataReceived(data);
      });

      // Monitor heart rate if available
      try {
        const hrService = await server.getPrimaryService(DeviceConnectionManager.CYCLING_SERVICES.HEART_RATE);
        const hrCharacteristic = await hrService.getCharacteristic('00002a37-0000-1000-8000-00805f9b34fb');
        
        await hrCharacteristic.startNotifications();
        hrCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
          const heartRate = this.parseHeartRateData(event.target as BluetoothRemoteGATTCharacteristic);
          onDataReceived({ trackPoints: [{ heartRate, timestamp: new Date() } as any] });
        });
      } catch (error) {
        console.warn('Heart rate monitoring not available:', error);
      }

    } catch (error) {
      console.error('Error starting activity monitoring:', error);
      throw error;
    }
  }

  // Parse cycling speed and cadence data
  private parseCSCData(characteristic: BluetoothRemoteGATTCharacteristic): Partial<GpxData> {
    const value = characteristic.value;
    if (!value) return {};

    const flags = value.getUint8(0);
    let offset = 1;

    const data: any = {
      timestamp: new Date(),
    };

    // Wheel revolution data present
    if (flags & 0x01) {
      const wheelRevolutions = value.getUint32(offset, true);
      const lastWheelEventTime = value.getUint16(offset + 4, true);
      offset += 6;
      
      // Calculate speed (simplified)
      data.speed = this.calculateSpeed(wheelRevolutions, lastWheelEventTime);
    }

    // Crank revolution data present
    if (flags & 0x02) {
      const crankRevolutions = value.getUint16(offset, true);
      const lastCrankEventTime = value.getUint16(offset + 2, true);
      
      // Calculate cadence
      data.cadence = this.calculateCadence(crankRevolutions, lastCrankEventTime);
    }

    return { trackPoints: [data] };
  }

  // Parse heart rate data
  private parseHeartRateData(characteristic: BluetoothRemoteGATTCharacteristic): number {
    const value = characteristic.value;
    if (!value) return 0;

    const flags = value.getUint8(0);
    
    // Heart rate format (8-bit or 16-bit)
    if (flags & 0x01) {
      return value.getUint16(1, true);
    } else {
      return value.getUint8(1);
    }
  }

  // Calculate speed from wheel data
  private calculateSpeed(wheelRevolutions: number, lastWheelEventTime: number): number {
    // Implementation would track previous values and calculate speed
    // This is a simplified version
    return 0; // km/h
  }

  // Calculate cadence from crank data
  private calculateCadence(crankRevolutions: number, lastCrankEventTime: number): number {
    // Implementation would track previous values and calculate cadence
    // This is a simplified version
    return 0; // rpm
  }

  // Disconnect from device
  async disconnectDevice(deviceId: string): Promise<void> {
    const server = this.activeConnections.get(deviceId);
    if (server) {
      server.disconnect();
      this.activeConnections.delete(deviceId);
    }
    this.connectedDevices.delete(deviceId);
  }

  // Get all connected devices
  getConnectedDevices(): DeviceConnection[] {
    return Array.from(this.connectedDevices.entries()).map(([deviceId, device]) => ({
      deviceId,
      deviceName: device.name || 'Unknown Device',
      deviceType: this.detectDeviceType(device.name || ''),
      protocol: 'ble',
      lastSeen: new Date(),
    }));
  }
}

// Singleton instance
export const deviceManager = new DeviceConnectionManager();