import { parseGPXFile, type GpxData, type TrackPoint } from './gpx-parser';
import { calculateDistance } from './gpx-parser';

interface ProximityMatchConfig {
  proximityRadius: number; // meters
  timeWindow: number; // seconds
  minMatchPercentage: number; // minimum % of organizer points to match
}

interface ProximityResult {
  matchedPoints: number;
  totalOrganizerPoints: number;
  proximityScore: number; // percentage
  isCompleted: boolean; // meets 80% threshold
  matchedSegments: Array<{
    startTime: Date;
    endTime: Date;
    duration: number; // seconds
  }>;
}

export class GPXProximityMatcher {
  private config: ProximityMatchConfig;

  constructor(config: ProximityMatchConfig = {
    proximityRadius: 50, // 50 meters
    timeWindow: 15, // 15 seconds
    minMatchPercentage: 80, // 80% completion threshold
  }) {
    this.config = config;
  }

  /**
   * Check if participant was near organizer for >= 80% of organizer's moving time
   */
  async checkParticipantProximity(
    organizerGpxPath: string,
    participantGpxPath: string
  ): Promise<ProximityResult> {
    // Parse both GPX files
    const organizerData = await parseGPXFile(organizerGpxPath);
    const participantData = await parseGPXFile(participantGpxPath);

    return this.compareProximity(organizerData, participantData);
  }

  private compareProximity(organizerData: GpxData, participantData: GpxData): ProximityResult {
    const organizerPoints = organizerData.trackPoints.filter(p => p.time); // Only points with timestamps
    const participantPoints = participantData.trackPoints.filter(p => p.time);

    if (organizerPoints.length === 0 || participantPoints.length === 0) {
      return {
        matchedPoints: 0,
        totalOrganizerPoints: organizerPoints.length,
        proximityScore: 0,
        isCompleted: false,
        matchedSegments: [],
      };
    }

    let matchedPoints = 0;
    const matchedSegments: Array<{ startTime: Date; endTime: Date; duration: number }> = [];
    let currentSegmentStart: Date | null = null;
    let currentSegmentEnd: Date | null = null;

    // For each organizer point, find if participant was nearby within time window
    for (const orgPoint of organizerPoints) {
      if (!orgPoint.time) continue;

      const orgTime = new Date(orgPoint.time);
      let isMatched = false;

      // Look for participant points within time window
      for (const partPoint of participantPoints) {
        if (!partPoint.time) continue;

        const partTime = new Date(partPoint.time);
        const timeDiff = Math.abs(partTime.getTime() - orgTime.getTime()) / 1000; // seconds

        if (timeDiff <= this.config.timeWindow) {
          // Check distance
          const distance = calculateDistance(
            orgPoint.lat,
            orgPoint.lon,
            partPoint.lat,
            partPoint.lon
          ) * 1000; // convert to meters

          if (distance <= this.config.proximityRadius) {
            isMatched = true;
            matchedPoints++;

            // Track segments
            if (!currentSegmentStart) {
              currentSegmentStart = orgTime;
            }
            currentSegmentEnd = orgTime;
            break;
          }
        }
      }

      // If not matched and we had a segment, close it
      if (!isMatched && currentSegmentStart && currentSegmentEnd) {
        matchedSegments.push({
          startTime: currentSegmentStart,
          endTime: currentSegmentEnd,
          duration: (currentSegmentEnd.getTime() - currentSegmentStart.getTime()) / 1000,
        });
        currentSegmentStart = null;
        currentSegmentEnd = null;
      }
    }

    // Close final segment if exists
    if (currentSegmentStart && currentSegmentEnd) {
      matchedSegments.push({
        startTime: currentSegmentStart,
        endTime: currentSegmentEnd,
        duration: (currentSegmentEnd.getTime() - currentSegmentStart.getTime()) / 1000,
      });
    }

    const proximityScore = (matchedPoints / organizerPoints.length) * 100;
    const isCompleted = proximityScore >= this.config.minMatchPercentage;

    console.log('Proximity matching results:', {
      organizerPoints: organizerPoints.length,
      participantPoints: participantPoints.length,
      matchedPoints,
      proximityScore: proximityScore.toFixed(2) + '%',
      isCompleted,
      segmentCount: matchedSegments.length,
    });

    return {
      matchedPoints,
      totalOrganizerPoints: organizerPoints.length,
      proximityScore,
      isCompleted,
      matchedSegments,
    };
  }

  /**
   * Auto-match organizer's uploaded GPX to their planned rides
   */
  async matchOrganizerGpx(
    organizerGpxData: GpxData,
    plannedRides: Array<{ id: number; dateTime: Date; gpxFilePath: string; name: string }>
  ): Promise<{ rideId: number; matchScore: number; rideName: string } | null> {
    const activityDate = new Date(organizerGpxData.startTime);
    
    // Filter rides on same calendar date
    const sameDateRides = plannedRides.filter(ride => {
      const rideDate = new Date(ride.dateTime);
      return (
        rideDate.getFullYear() === activityDate.getFullYear() &&
        rideDate.getMonth() === activityDate.getMonth() &&
        rideDate.getDate() === activityDate.getDate()
      );
    });

    console.log(`Found ${sameDateRides.length} rides on same date as GPX activity`);

    let bestMatch: { rideId: number; matchScore: number; rideName: string } | null = null;
    let bestScore = 0;

    // Compare against planned routes
    for (const ride of sameDateRides) {
      try {
        const plannedGpxData = await parseGPXFile(ride.gpxFilePath);
        const matchScore = this.calculateRouteMatch(organizerGpxData, plannedGpxData);

        console.log(`Route similarity for "${ride.name}": ${(matchScore * 100).toFixed(1)}%`);

        if (matchScore >= 0.7 && matchScore > bestScore) {
          bestMatch = {
            rideId: ride.id,
            matchScore: matchScore * 100, // convert to percentage
            rideName: ride.name,
          };
          bestScore = matchScore;
        }
      } catch (error) {
        console.warn(`Could not parse planned route for ride ${ride.id}:`, error);
      }
    }

    return bestMatch;
  }

  private calculateRouteMatch(gpxData1: GpxData, gpxData2: GpxData): number {
    if (!gpxData1.trackPoints.length || !gpxData2.trackPoints.length) {
      return 0;
    }

    // Distance similarity (within 5% considered good match)
    const distance1 = gpxData1.distance || 0;
    const distance2 = gpxData2.distance || 0;
    const distanceRatio = Math.min(distance1, distance2) / Math.max(distance1, distance2);
    const distanceScore = distanceRatio > 0.95 ? 1 : Math.max(0, distanceRatio - 0.1);

    // Start/end point similarity
    const start1 = gpxData1.trackPoints[0];
    const end1 = gpxData1.trackPoints[gpxData1.trackPoints.length - 1];
    const start2 = gpxData2.trackPoints[0];
    const end2 = gpxData2.trackPoints[gpxData2.trackPoints.length - 1];

    const startDistance = calculateDistance(start1.lat, start1.lon, start2.lat, start2.lon) * 1000; // meters
    const endDistance = calculateDistance(end1.lat, end1.lon, end2.lat, end2.lon) * 1000; // meters

    // Points within 500m are considered matching
    const startScore = startDistance < 500 ? 1 : Math.max(0, 1 - startDistance / 2000);
    const endScore = endDistance < 500 ? 1 : Math.max(0, 1 - endDistance / 2000);
    const waypointScore = (startScore + endScore) / 2;

    // Combined score with higher weight on waypoints for accuracy
    const totalScore = (distanceScore * 0.3) + (waypointScore * 0.7);

    return Math.min(1, totalScore);
  }
}