import * as fs from 'fs';
import * as path from 'path';

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
  trackPoints: Array<{
    lat: number;
    lon: number;
    elevation?: number;
    time?: Date;
    heartRate?: number;
  }>;
}

export async function parseGPXFile(filePath: string): Promise<GpxData> {
  try {
    const gpxContent = await fs.promises.readFile(filePath, 'utf-8');
    return parseGPXContent(gpxContent);
  } catch (error) {
    console.error('Error reading GPX file:', error);
    throw new Error('Failed to read GPX file');
  }
}

export function parseGPXContent(gpxContent: string): GpxData {
  const trackPoints: GpxData['trackPoints'] = [];
  let totalDistance = 0;
  let totalElevationGain = 0;
  let heartRates: number[] = [];
  let minTime: Date | null = null;
  let maxTime: Date | null = null;

  // Simple XML parsing for GPX files
  // Extract track points
  const trkptRegex = /<trkpt[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  let match;

  while ((match = trkptRegex.exec(gpxContent)) !== null) {
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
  }

  // Calculate heart rate metrics
  let averageHeartRate: number | undefined;
  let maxHeartRate: number | undefined;
  
  if (heartRates.length > 0) {
    averageHeartRate = Math.round(heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length);
    maxHeartRate = Math.max(...heartRates);
  }

  return {
    distance: totalDistance > 0 ? totalDistance : undefined,
    duration,
    movingTime: movingTime > 0 ? Math.floor(movingTime) : undefined,
    elevationGain: totalElevationGain > 0 ? totalElevationGain : undefined,
    averageSpeed,
    averageHeartRate,
    maxHeartRate,
    calories: undefined, // Will be calculated separately if needed
    startTime: minTime,
    trackPoints,
  };
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

// Simple route matching algorithm
export function calculateRouteMatch(gpxData1: GpxData, gpxData2: GpxData): number {
  if (!gpxData1.trackPoints.length || !gpxData2.trackPoints.length) {
    return 0;
  }

  // Simplified route matching based on distance similarity and key waypoints
  const distance1 = gpxData1.distance || 0;
  const distance2 = gpxData2.distance || 0;
  
  // Distance similarity (within 5% considered similar)
  const distanceRatio = Math.min(distance1, distance2) / Math.max(distance1, distance2);
  const distanceScore = distanceRatio > 0.95 ? 1 : distanceRatio;
  
  // Simple waypoint matching - compare start and end points
  const startPoint1 = gpxData1.trackPoints[0];
  const endPoint1 = gpxData1.trackPoints[gpxData1.trackPoints.length - 1];
  const startPoint2 = gpxData2.trackPoints[0];
  const endPoint2 = gpxData2.trackPoints[gpxData2.trackPoints.length - 1];
  
  const startDistance = calculateDistance(startPoint1.lat, startPoint1.lon, startPoint2.lat, startPoint2.lon);
  const endDistance = calculateDistance(endPoint1.lat, endPoint1.lon, endPoint2.lat, endPoint2.lon);
  
  // Points within 1km are considered matching, but be more lenient for nearby routes
  const startScore = startDistance < 1 ? 1 : Math.max(0, 1 - startDistance / 10);
  const endScore = endDistance < 1 ? 1 : Math.max(0, 1 - endDistance / 10);
  
  const waypointScore = (startScore + endScore) / 2;
  
  // For routes in the same general area (within 5km), boost the score
  const sameAreaBonus = startDistance < 5 ? 0.2 : 0;
  
  // Combined score (weighted average)
  const totalScore = (distanceScore * 0.4) + (waypointScore * 0.6) + sameAreaBonus;
  
  console.log('Route matching debug:', {
    distance1: distance1?.toFixed(0),
    distance2: distance2?.toFixed(0),
    distanceScore: distanceScore.toFixed(2),
    startDistance: startDistance.toFixed(0) + 'm',
    endDistance: endDistance.toFixed(0) + 'm',
    startScore: startScore.toFixed(2),
    endScore: endScore.toFixed(2),
    waypointScore: waypointScore.toFixed(2),
    sameAreaBonus: sameAreaBonus.toFixed(2),
    totalScore: totalScore.toFixed(2)
  });
  
  return Math.max(0, Math.min(1, totalScore));
}