#!/bin/bash

echo "🚴 Building CycleConnect Android APK..."

# Build the web app first
echo "Building web assets..."
npm run build

# Sync assets to Android project  
echo "Syncing assets to Android..."
npx cap sync android

echo "✅ Build process complete!"
echo ""
echo "📱 To generate the APK file:"
echo "1. Run: npx cap open android"
echo "2. This will open Android Studio"
echo "3. Wait for Gradle sync to complete (may take 5-10 minutes first time)"
echo "4. Go to Build → Build Bundle(s) / APK(s) → Build APK(s)"
echo "5. Click 'locate' when build completes to find your APK file"
echo ""
echo "🔗 The APK will be at: android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "📋 Bluetooth permissions have been added for testing device connections"