import * as fs from 'fs';
import * as path from 'path';
import { supabase } from './supabase'; // Import your Supabase client
import { GPXProximityMatcher } from './gpx-proximity-matcher'; // Import GPXProximityMatcher


export interface GpxData {
  distance?: number; // in km
  duration?: number; // total elapsed time in seconds
  movingTime?: number; // active time (excluding stops) in seconds
  elevationGain?: number; // in meters
  averageSpeed?: number; // in km/h (based on moving time)
  averageHeartRate?: number; // in bpm
  maxHeartRate?: number; // in bpm
  calories?: number;
  startTime?: Date; // start time of the activity
  name?: string; // ADDED: Name of the track or route
  trackPoints: Array<{
    lat: number;
    lon: number;
    elevation?: number;
    time?: Date;
    heartRate?: number;
  }>;
}

export async function parseGPXFile(supabaseFilePath: string): Promise<GpxData> {
  try {
    // Download the file content from Supabase Storage
    const { data, error } = await supabase.storage
      .from('gpx-uploads') // Replace 'gpx-uploads' with your actual Supabase bucket name if different
      .download(supabaseFilePath);

    if (error) {
      console.error('Error downloading GPX from Supabase:', error);
      throw new Error('Failed to download GPX file from storage');
    }

    if (!data) {
        throw new Error('Downloaded GPX file data is empty');
    }

    // Read the file content as text
    const fileContent = await data.text();

    // Now parse the fileContent (the XML string)
    // ... your existing GPX parsing logic using fileContent
    const trackPoints: GpxData['trackPoints'] = [];
    let totalDistance = 0;
    let totalElevationGain = 0;
    let heartRates: number[] = [];
    let minTime: Date | null = null;
    let maxTime: Date | null = null;

    // Simple XML parsing for GPX files
    // Extract track points
    const trkptRegex = /<trkpt[^>]*lat=\"([^\"]+)\"[^>]*lon=\"([^\"]+)\"[^>]*>([\s\S]*?)<\/trkpt>/g;
    let match;

    while ((match = trkptRegex.exec(fileContent)) !== null) { // Use fileContent here
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      const content = match[3];

      let elevation: number | undefined;
      let time: Date | undefined;
      let heartRate: number | undefined;

      // Extract elevation
      const eleMatch = content.match(/<ele>([^<]+)<\/ele>/);
      if (eleMatch) {
        elevation = parseFloat(eleMatch[1]);
      }

      // Extract time
      const timeMatch = content.match(/<time>([^<]+)<\/time>/);
      if (timeMatch) {
        time = new Date(timeMatch[1]);
        if (!minTime || time < minTime) minTime = time;
        if (!maxTime || time > maxTime) maxTime = time;
      }

      // Extract heart rate (support multiple Garmin extensions)
      const hrMatch = content.match(/<ns3:hr>([^<]+)<\/ns3:hr>/) ||
                   content.match(/<hr>([^<]+)<\/hr>/) ||
                   content.match(/<gpxtpx:hr>([^<]+)<\/gpxtpx:hr>/) ||
                   content.match(/<TrackPointExtension>[\s\S]*?<hr>([^<]+)<\/hr>/);
      if (hrMatch) {
        heartRate = parseInt(hrMatch[1]);
        if (!isNaN(heartRate) && heartRate > 0) {
          heartRates.push(heartRate);
        }
      }

      trackPoints.push({
        lat,
        lon,
        elevation,
        time,
        heartRate,
      });
    }
    console.log('Parsed trackPoints:', trackPoints); // Add this line

    let trackName: string | undefined;
    // Extract track name
    const trkNameMatch = fileContent.match(/<trk>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/trk>/);
    if (trkNameMatch) {
      trackName = trkNameMatch[1];
    } else {
      // If no track name, try looking for a route name
      const rteNameMatch = fileContent.match(/<rte>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/rte>/);
      if (rteNameMatch) {
        trackName = rteNameMatch[1];
      }
    }

    // Calculate distance using Haversine formula
    for (let i = 1; i < trackPoints.length; i++) {
      const prevPoint = trackPoints[i - 1];
      const currentPoint = trackPoints[i];

      const distance = calculateDistance(
        prevPoint.lat,
        prevPoint.lon,
        currentPoint.lat,
        currentPoint.lon
      );

      totalDistance += distance;
    }

    // Calculate elevation gain
    for (let i = 1; i < trackPoints.length; i++) {
      const prevElevation = trackPoints[i - 1].elevation;
      const currentElevation = trackPoints[i].elevation;

      if (prevElevation !== undefined && currentElevation !== undefined) {
        const elevationDiff = currentElevation - prevElevation;
        if (elevationDiff > 0) {
          totalElevationGain += elevationDiff;
        }
      }
    }

    // Calculate total elapsed time (duration)
    let duration: number | undefined;
    if (minTime && maxTime) {
      duration = Math.floor((maxTime.getTime() - minTime.getTime()) / 1000);
    }

    // Calculate moving time (active time, excluding stops)
    let movingTime = 0;
    const STOP_THRESHOLD = 0.5; // km/h - speed below this is considered stopped

    for (let i = 1; i < trackPoints.length; i++) {
      const prevPoint = trackPoints[i - 1];
      const currentPoint = trackPoints[i];

      if (prevPoint.time && currentPoint.time) {
        const timeDiff = (currentPoint.time.getTime() - prevPoint.time.getTime()) / 1000; // seconds
        const distance = calculateDistance(prevPoint.lat, prevPoint.lon, currentPoint.lat, currentPoint.lon);
        const speed = distance / (timeDiff / 3600); // km/h

        // Only count time when moving above threshold speed
        if (speed > STOP_THRESHOLD) {
          movingTime += timeDiff;
        }
      }
    }

    // Calculate average speed based on moving time
    let averageSpeed: number | undefined;
    if (movingTime > 0 && totalDistance > 0) {
      averageSpeed = (totalDistance / (movingTime / 3600)); // km/h

     // ADDED: Detailed logging for calculated averageSpeed
     console.log('Calculated raw averageSpeed:', averageSpeed);
     console.log('Type of calculated averageSpeed:', typeof averageSpeed);
     console.log('Is calculated averageSpeed finite:', Number.isFinite(averageSpeed));
     // END ADDED logging
     
    }

    // Calculate heart rate metrics
    let averageHeartRate: number | undefined;
    let maxHeartRate: number | undefined;

    if (heartRates.length > 0) {
      averageHeartRate = Math.round(heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length);
      maxHeartRate = Math.max(...heartRates);
    }


    return {
      name: trackName, // ADDED: Include the extracted name
      distance: totalDistance > 0 ? totalDistance : undefined,
      duration,
      movingTime: movingTime > 0 ? Math.floor(movingTime) : undefined,
      elevationGain: totalElevationGain > 0 ? totalElevationGain : undefined,
      averageSpeed,
      averageHeartRate,
      maxHeartRate,
      calories: undefined, // Will be calculated separately if needed
      startTime: minTime !== null ? minTime : undefined,
      trackPoints,
    };
  } catch (error) {
    console.error('Error parsing GPX file:', error);
    // Re-throw with a clear message that indicates parsing failed
    throw new Error('Failed to parse GPX file content');
  }
}

// Haversine formula to calculate distance between two points
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Simple route matching algorithm - Now uses GPXProximityMatcher's track point overlap
export function calculateRouteMatch(gpxData1: GpxData, gpxData2: GpxData): number {
  console.log('Inside calculateRouteMatch (using GPXProximityMatcher) - gpxData1:', gpxData1);
  console.log('Inside calculateRouteMatch (using GPXProximityMatcher) - gpxData2:', gpxData2);

  // Create a GPXProximityMatcher instance (using default config)
  const proximityMatcher = new GPXProximityMatcher();

  // Use the compareProximity logic for the match score
  // We need to call compareProximity with the participant data first, then organizer data
  // as compareProximity is designed to check participant points against organizer points
  const proximityResult = proximityMatcher.compareProximity(gpxData1, gpxData2);

  // The match score is the proximity score calculated by GPXProximityMatcher
  const matchScore = proximityResult.proximityScore / 100; // Convert percentage back to 0-1 scale

  console.log('calculateRouteMatch result (from ProximityMatcher):', matchScore.toFixed(2));

  return Math.max(0, Math.min(1, matchScore)); // Ensure score is between 0 and 1
}


export function checkParticipantProximity(
  organizerGpxPath: string,
  participantGpxPath: string
): {
  proximityScore: number;
  matchedPoints: number;
  totalOrganizerPoints: number;
  isCompleted: boolean;
} {
  // This is a placeholder implementation. You would need to implement a real proximity matching algorithm here.
  // It should compare the track points of the participant's GPX against the organizer's GPX.
  // The output should indicate a proximity score (e.g., percentage of matched points) and whether the participant completed the route.

  // For demonstration purposes, return a dummy result.
  return {
    proximityScore: 0.75, // 75% proximity
    matchedPoints: 100,
    totalOrganizerPoints: 130,
    isCompleted: true,
  };
}



