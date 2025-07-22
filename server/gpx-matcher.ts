import { GpxData, RouteMatchingConfig } from "@shared/device-schema";
import fs from 'fs';
import path from 'path';

export interface TrackPoint {
  latitude: number;
  longitude: number;
  elevation?: number;
  timestamp: Date;
  speed?: number;
}

export interface RouteMatchResult {
  similarity: number;
  matchedPoints: number;
  totalPoints: number;
  timeWindowMatch: boolean;
  isValid: boolean;
  details: {
    geometricSimilarity: number;
    temporalAlignment: number;
    elevationCorrelation: number;
  };
}

export class GPXRouteMatcher {
  private config: RouteMatchingConfig;

  constructor(config: RouteMatchingConfig = {
    similarityThreshold: 85,
    timeWindowMinutes: 60,
    minimumTrackPoints: 50,
    maxDistanceDeviation: 100,
  }) {
    this.config = config;
  }

  // Main function to compare uploaded GPX with planned route
  async compareRoutes(
    plannedRouteGpxPath: string,
    uploadedActivity: GpxData,
    plannedStartTime: Date
  ): Promise<RouteMatchResult> {
    // Parse planned route from GPX file
    const plannedRoute = await this.parseGPXFile(plannedRouteGpxPath);
    
    // Validate minimum track points
    if (uploadedActivity.trackPoints.length < this.config.minimumTrackPoints) {
      return this.createFailedResult('Insufficient track points in uploaded activity');
    }

    // Check time window
    const timeWindowMatch = this.checkTimeWindow(
      uploadedActivity.startTime,
      plannedStartTime,
      this.config.timeWindowMinutes
    );

    // Calculate geometric similarity
    const geometricSimilarity = this.calculateGeometricSimilarity(
      plannedRoute,
      uploadedActivity.trackPoints
    );

    // Calculate temporal alignment
    const temporalAlignment = this.calculateTemporalAlignment(
      plannedRoute,
      uploadedActivity.trackPoints
    );

    // Calculate elevation correlation
    const elevationCorrelation = this.calculateElevationCorrelation(
      plannedRoute,
      uploadedActivity.trackPoints
    );

    // Overall similarity score
    const overallSimilarity = (
      geometricSimilarity * 0.6 +
      temporalAlignment * 0.25 +
      elevationCorrelation * 0.15
    );

    const matchedPoints = Math.round(
      (overallSimilarity / 100) * uploadedActivity.trackPoints.length
    );

    const isValid = overallSimilarity >= this.config.similarityThreshold && timeWindowMatch;

    return {
      similarity: overallSimilarity,
      matchedPoints,
      totalPoints: uploadedActivity.trackPoints.length,
      timeWindowMatch,
      isValid,
      details: {
        geometricSimilarity,
        temporalAlignment,
        elevationCorrelation,
      },
    };
  }

  // Parse GPX file to extract track points
  private async parseGPXFile(gpxPath: string): Promise<TrackPoint[]> {
    try {
      const gpxContent = fs.readFileSync(gpxPath, 'utf8');
      
      // Simple GPX parsing (in production, use a proper GPX parser like gpxpy equivalent)
      const trackPoints: TrackPoint[] = [];
      
      // Extract track points using regex (simplified)
      const trkptRegex = /<trkpt lat="([^"]+)" lon="([^"]+)"[^>]*>[\s\S]*?(?:<ele>([^<]+)<\/ele>)?[\s\S]*?(?:<time>([^<]+)<\/time>)?[\s\S]*?<\/trkpt>/g;
      
      let match;
      while ((match = trkptRegex.exec(gpxContent)) !== null) {
        const [, lat, lon, ele, time] = match;
        
        trackPoints.push({
          latitude: parseFloat(lat),
          longitude: parseFloat(lon),
          elevation: ele ? parseFloat(ele) : undefined,
          timestamp: time ? new Date(time) : new Date(),
        });
      }

      return trackPoints;
    } catch (error) {
      console.error('Error parsing GPX file:', error);
      return [];
    }
  }

  // Check if activity start time is within acceptable window
  private checkTimeWindow(
    activityStartTime: Date,
    plannedStartTime: Date,
    windowMinutes: number
  ): boolean {
    const timeDiff = Math.abs(activityStartTime.getTime() - plannedStartTime.getTime());
    const windowMs = windowMinutes * 60 * 1000;
    return timeDiff <= windowMs;
  }

  // Calculate geometric similarity using Hausdorff distance
  private calculateGeometricSimilarity(
    plannedRoute: TrackPoint[],
    uploadedRoute: TrackPoint[]
  ): number {
    if (plannedRoute.length === 0 || uploadedRoute.length === 0) {
      return 0;
    }

    // Use simplified Hausdorff distance calculation
    const hausdorffDistance = this.calculateHausdorffDistance(plannedRoute, uploadedRoute);
    
    // Convert distance to similarity percentage
    const maxAcceptableDistance = this.config.maxDistanceDeviation;
    const similarity = Math.max(0, 100 - (hausdorffDistance / maxAcceptableDistance) * 100);
    
    return Math.min(100, similarity);
  }

  // Calculate Hausdorff distance between two track sets
  private calculateHausdorffDistance(route1: TrackPoint[], route2: TrackPoint[]): number {
    const distance1to2 = this.calculateDirectedHausdorffDistance(route1, route2);
    const distance2to1 = this.calculateDirectedHausdorffDistance(route2, route1);
    
    return Math.max(distance1to2, distance2to1);
  }

  // Calculate directed Hausdorff distance
  private calculateDirectedHausdorffDistance(route1: TrackPoint[], route2: TrackPoint[]): number {
    let maxDistance = 0;
    
    for (const point1 of route1) {
      let minDistance = Infinity;
      
      for (const point2 of route2) {
        const distance = this.calculateHaversineDistance(point1, point2);
        minDistance = Math.min(minDistance, distance);
      }
      
      maxDistance = Math.max(maxDistance, minDistance);
    }
    
    return maxDistance;
  }

  // Calculate temporal alignment using Dynamic Time Warping
  private calculateTemporalAlignment(
    plannedRoute: TrackPoint[],
    uploadedRoute: TrackPoint[]
  ): number {
    // Simplified temporal alignment based on speed patterns
    const plannedSpeeds = this.calculateSpeeds(plannedRoute);
    const uploadedSpeeds = this.calculateSpeeds(uploadedRoute);
    
    if (plannedSpeeds.length === 0 || uploadedSpeeds.length === 0) {
      return 50; // Default score when speed data is unavailable
    }

    // Calculate correlation between speed patterns
    const correlation = this.calculateCorrelation(plannedSpeeds, uploadedSpeeds);
    
    // Convert correlation to percentage
    return Math.max(0, Math.min(100, (correlation + 1) * 50));
  }

  // Calculate elevation correlation
  private calculateElevationCorrelation(
    plannedRoute: TrackPoint[],
    uploadedRoute: TrackPoint[]
  ): number {
    console.log('plannedRoute:', plannedRoute); // Add this line
    console.log('uploadedRoute:', uploadedRoute); // Add this line
    const plannedElevations = plannedRoute
      .map(p => p.elevation)
      .filter(e => e !== undefined) as number[];
    
    const uploadedElevations = uploadedRoute
      .map(p => p.elevation)
      .filter(e => e !== undefined) as number[];

    if (plannedElevations.length === 0 || uploadedElevations.length === 0) {
      return 50; // Default score when elevation data is unavailable
    }

    const correlation = this.calculateCorrelation(plannedElevations, uploadedElevations);
    return Math.max(0, Math.min(100, (correlation + 1) * 50));
  }

  // Calculate speeds between consecutive points
  private calculateSpeeds(route: TrackPoint[]): number[] {
    const speeds: number[] = [];
    
    for (let i = 1; i < route.length; i++) {
      const prev = route[i - 1];
      const curr = route[i];
      
      const distance = this.calculateHaversineDistance(prev, curr);
      const timeDiff = (curr.timestamp.getTime() - prev.timestamp.getTime()) / 1000; // seconds
      
      if (timeDiff > 0) {
        const speed = (distance / timeDiff) * 3.6; // km/h
        speeds.push(speed);
      }
    }
    
    return speeds;
  }

  // Calculate correlation between two arrays
  private calculateCorrelation(array1: number[], array2: number[]): number {
    const n = Math.min(array1.length, array2.length);
    if (n === 0) return 0;

    // Normalize arrays to same length
    const normalized1 = this.normalizeArray(array1, n);
    const normalized2 = this.normalizeArray(array2, n);

    // Calculate Pearson correlation coefficient
    const mean1 = normalized1.reduce((sum, val) => sum + val, 0) / n;
    const mean2 = normalized2.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let denominator1 = 0;
    let denominator2 = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = normalized1[i] - mean1;
      const diff2 = normalized2[i] - mean2;
      
      numerator += diff1 * diff2;
      denominator1 += diff1 * diff1;
      denominator2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(denominator1 * denominator2);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  // Normalize array to specified length
  private normalizeArray(array: number[], targetLength: number): number[] {
    if (array.length === targetLength) return array;
    
    const result: number[] = [];
    const ratio = (array.length - 1) / (targetLength - 1);
    
    for (let i = 0; i < targetLength; i++) {
      const index = i * ratio;
      const lowerIndex = Math.floor(index);
      const upperIndex = Math.ceil(index);
      
      if (lowerIndex === upperIndex) {
        result.push(array[lowerIndex]);
      } else {
        const weight = index - lowerIndex;
        const value = array[lowerIndex] * (1 - weight) + array[upperIndex] * weight;
        result.push(value);
      }
    }
    
    return result;
  }

  // Calculate Haversine distance between two points
  private calculateHaversineDistance(point1: TrackPoint, point2: TrackPoint): number {
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = point1.latitude * Math.PI / 180;
    const lat2Rad = point2.latitude * Math.PI / 180;
    const deltaLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const deltaLon = (point2.longitude - point1.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  // Create a failed result
  private createFailedResult(reason: string): RouteMatchResult {
    return {
      similarity: 0,
      matchedPoints: 0,
      totalPoints: 0,
      timeWindowMatch: false,
      isValid: false,
      details: {
        geometricSimilarity: 0,
        temporalAlignment: 0,
        elevationCorrelation: 0,
      },
    };
  }
}

// Export singleton instance
export const gpxMatcher = new GPXRouteMatcher();