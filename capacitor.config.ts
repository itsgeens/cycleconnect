import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'com.cycleconnect.app',
  appName: 'CycleConnect',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: "Scanning for cycling devices...",
        cancel: "Cancel",
        availableDevices: "Available cycling devices",
        noDeviceFound: "No cycling devices found"
      }
    }
  }
};

export default config;