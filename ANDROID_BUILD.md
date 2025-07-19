# CycleConnect Android APK Build Guide

## Overview
Your CycleConnect cycling app has been packaged for Android using Capacitor. This allows you to install and test the app on your Android device, including bluetooth device connections.

## What's Been Set Up

✅ **Capacitor Android Platform** - Your web app wrapped in native Android container  
✅ **Bluetooth Permissions** - Full bluetooth and location permissions for device connections  
✅ **Bluetooth LE Plugin** - Community plugin for connecting to cycling devices  
✅ **Build Configuration** - Ready to generate APK files  

## Quick Build Process

### Option 1: Command Line (Fastest)
```bash
# Run the build script
./build-android.sh

# Open Android Studio to build APK
npx cap open android
```

### Option 2: Manual Steps
```bash
# 1. Build web assets
npm run build

# 2. Sync to Android project
npx cap sync android

# 3. Open Android Studio
npx cap open android
```

## Building the APK in Android Studio

1. **Wait for Setup** (5-10 minutes first time)
   - Gradle will sync and download dependencies
   - Don't interrupt this process

2. **Build APK**
   - Go to **Build → Build Bundle(s) / APK(s) → Build APK(s)**
   - Wait for build to complete (2-5 minutes)

3. **Find Your APK**
   - Click **"locate"** when build finishes
   - APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

## Installing on Your Device

### Method 1: USB Transfer
1. Connect Android device to computer
2. Copy `app-debug.apk` to device
3. Open file and install (enable "Install from unknown sources" if needed)

### Method 2: Direct from Android Studio
1. Connect device via USB
2. Enable USB debugging in Developer Options
3. Click the "Run" button in Android Studio

## Bluetooth Testing Features

Your app now includes:
- **Device Discovery** - Scan for nearby cycling devices
- **Connection Management** - Connect/disconnect from devices  
- **Data Streaming** - Receive real-time data from connected devices
- **Activity Matching** - Automatic ride completion based on device data

## Permissions Included

The app requests these permissions for bluetooth functionality:
- `BLUETOOTH` - Basic bluetooth access
- `BLUETOOTH_ADMIN` - Device discovery and pairing
- `BLUETOOTH_CONNECT` - Connect to known devices (Android 12+)
- `BLUETOOTH_SCAN` - Scan for devices (Android 12+)
- `ACCESS_FINE_LOCATION` - Required for bluetooth device discovery
- `ACCESS_COARSE_LOCATION` - Fallback location permission

## Troubleshooting

**Build Fails:**
- Ensure you have Android SDK installed
- Check Java version (JDK 17+ required)
- Run `./gradlew clean` in android/ folder

**App Won't Install:**
- Enable "Install from unknown sources" in Android settings
- Check device has enough storage space
- Try uninstalling any previous versions

**Bluetooth Not Working:**
- Grant location permissions when prompted
- Enable bluetooth on device
- Check device compatibility with bluetooth LE

## Next Steps

Once installed, you can test:
1. **Device Connection** - Try connecting to your cycling computer/smartwatch
2. **Data Reception** - Verify heart rate, speed, cadence data comes through
3. **Automatic Completion** - Test if rides auto-complete when you finish

The app will work exactly like the web version but with native bluetooth access for testing device connections.