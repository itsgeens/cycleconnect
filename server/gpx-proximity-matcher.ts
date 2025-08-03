import { parseGPXFile, type GpxData } from './gpx-parser';
import { calculateDistance } from './gpx-parser';
import { calculateRouteMatch } from './gpx-parser'; // Make sure calculateRouteMatch is imported here



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
    timeWindow: 60, // 60 seconds
    minMatchPercentage: 50, // 80% completion threshold
  }) {
    this.config = config;
    console.log('GPXProximityMatcher constructor called with config:', this.config); // Add this log
  }

  /**
   * Check if participant was near organizer for >= 80% of organizer's moving time
   */
  async checkParticipantProximity(
    organizerGpxPath: string,
    participantGpxPath: string
  ): Promise<ProximityResult> {
    console.log('checkParticipantProximity called with paths:', { organizerGpxPath, participantGpxPath }); // Add this log
    // Parse both GPX files
    const organizerData = await parseGPXFile(organizerGpxPath);
    console.log('checkParticipantProximity - organizerData after parsing:', organizerData); // Add this log
    const participantData = await parseGPXFile(participantGpxPath);
    console.log('checkParticipantProximity - participantData after parsing:', participantData); // Add this log

    return this.compareProximity(organizerData, participantData);
  }

  public compareProximity(organizerData: GpxData, participantData: GpxData): ProximityResult {
    console.log('Inside compareProximity - organizerData:', organizerData); // Add this log
    console.log('Inside compareProximity - participantData:', participantData); // Add this log
    const organizerPoints = organizerData.trackPoints.filter(p => p.time); // Only points with timestamps
    console.log('Inside compareProximity - organizerPoints after filter:', organizerPoints); // Add this log
    const participantPoints = participantData.trackPoints.filter(p => p.time);
    console.log('Inside compareProximity - participantPoints after filter:', participantPoints); // Add this log

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
    const activityDate = organizerGpxData.startTime ? new Date(organizerGpxData.startTime) : new Date(); // Provide a fallback Date
    
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
        const matchScore = calculateRouteMatch(organizerGpxData, plannedGpxData);

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
}