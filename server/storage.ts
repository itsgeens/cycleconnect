import { users, rides, rideParticipants, follows, deviceConnections, activityMatches, soloActivities, organizerGpxFiles, participantMatches, type User, type InsertUser, type Ride, type InsertRide, type RideParticipant, type RideFilters, type Follow, type DeviceConnection, type InsertDeviceConnection, type ActivityMatch, type InsertActivityMatch, type SoloActivity, type InsertSoloActivity, type OrganizerGpxFile, type InsertOrganizerGpxFile, type ParticipantMatch, type InsertParticipantMatch } from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, asc } from "drizzle-orm";
import { supabase } from './supabase'; // MODIFIED: Added this import


export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>; // Add alias for consistency
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Ride operations
  createRide(ride: InsertRide & { organizerId: number, gpxFilePath: string }): Promise<Ride>;
  getRides(filters?: RideFilters): Promise<Array<Ride & { organizerName: string; participantCount: number; participants?: Array<{ id: number; name: string }> }>>;
  getRide(id: number): Promise<Ride | undefined>;
  deleteRide(id: number): Promise<void>;
  
  // Participant operations
  joinRide(rideId: number, userId: number): Promise<void>;
  leaveRide(rideId: number, userId: number): Promise<void>;
  getRideParticipants(rideId: number): Promise<Array<RideParticipant & { userName: string }>>;
  isUserJoined(rideId: number, userId: number): Promise<boolean>;
  
  // User rides operations
  getUserRides(userId: number): Promise<{
    all: Array<Ride & { organizerName: string; participantCount: number; isOrganizer: boolean; isParticipant: boolean }>;
    organized: Array<Ride & { organizerName: string; participantCount: number }>;
    joined: Array<Ride & { organizerName: string; participantCount: number }>;
  }>;
  
  // Ride completion operations
  completeRide(rideId: number, userId: number): Promise<void>;
  
  // Stats operations
  getUserStats(userId: number, timeframe: string): Promise<{
    ridesJoined: number;
    ridesHosted: number;
    totalDistance: number;
    totalElevation: number;
    ridesJoinedChange: number;
    ridesHostedChange: number;
    totalDistanceChange: number;
    totalElevationChange: number;
    followersCount: number;
    followingCount: number;
  }>;
  
  // Completed rides
  getUserCompletedRides(userId: number, limit?: number): Promise<Array<Ride & { organizerName: string; participantCount: number; completedAt: Date }>>;
  
  // Rider operations
  getRiders(currentUserId: number): Promise<Array<User & { followersCount: number; completedRides: number; hostedRides: number; isFollowing: boolean }>>;
  
  // Follow operations
  followUser(followerId: number, followingId: number): Promise<void>;
  unfollowUser(followerId: number, followingId: number): Promise<void>;
  isFollowing(followerId: number, followingId: number): Promise<boolean>;
  getFollowerCount(userId: number): Promise<number>;
  getFollowingCount(userId: number): Promise<number>;
  getFollowers(userId: number): Promise<Array<User & { followersCount: number; completedRides: number; hostedRides: number }>>;
  getFollowing(userId: number): Promise<Array<User & { followersCount: number; completedRides: number; hostedRides: number }>>;

  // Device operations
  getUserDevices(userId: number): Promise<DeviceConnection[]>;
  createDeviceConnection(device: InsertDeviceConnection): Promise<DeviceConnection>;
  updateDeviceConnection(deviceId: string, userId: number, updates: Partial<DeviceConnection>): Promise<void>;
  deleteDeviceConnection(deviceId: string, userId: number): Promise<void>;

  // Activity matching operations
  createActivityMatch(match: InsertActivityMatch): Promise<ActivityMatch>;
  getActivityMatches(rideId: number): Promise<ActivityMatch[]>;
  getUserActivityMatches(userId: number): Promise<ActivityMatch[]>;
  getUserActivityForRide(rideId: number, userId: number): Promise<ActivityMatch | undefined>;
  
  // Organizer operations
  getOrganizerPlannedRides(organizerId: number, date: Date): Promise<Array<Ride>>;
  getOrganizerGpxForRide(rideId: number): Promise<OrganizerGpxFile | undefined>;

  // Solo activities operations
  createSoloActivity(activity: InsertSoloActivity): Promise<SoloActivity>;
  getSoloActivity(id: number): Promise<SoloActivity | undefined>;
  deleteSoloActivity(id: number): Promise<void>;
  getUserSoloActivities(userId: number): Promise<SoloActivity[]>;
  getUserCompletedActivities(userId: number): Promise<{
    completedRides: Array<Ride & { organizerName: string; participantCount: number; completedAt: Date }>;
    soloActivities: SoloActivity[];
    
  }>;
  // ADDED: Function to increment and decrement user XP
  incrementUserXP(userId: number, amount: number): Promise<void>;
  decrementUserXP(userId: number, amount: number): Promise<void>;
  // END ADDED

  // Organizer GPX operations
  createOrganizerGpx(gpxFile: InsertOrganizerGpxFile): Promise<OrganizerGpxFile>;
  getOrganizerGpx(rideId: number): Promise<OrganizerGpxFile | undefined>;
  getOrganizerGpxById(id: number): Promise<OrganizerGpxFile | undefined>;
  linkOrganizerGpx(rideId: number, gpxId: number, isManual: boolean): Promise<void>;
  updateOrganizerGpx(id: number, updates: Partial<OrganizerGpxFile>): Promise<void>;

  // Participant proximity matching operations
  createParticipantMatch(match: InsertParticipantMatch): Promise<ParticipantMatch>;
  getParticipantMatches(rideId: number): Promise<ParticipantMatch[]>;
  getParticipantMatch(rideId: number, participantId: number): Promise<ParticipantMatch | undefined>;
  updateParticipantMatch(id: number, updates: Partial<ParticipantMatch>): Promise<void>;

  // Advanced matching operations
  getOrganizerPlannedRides(organizerId: number, dateFilter?: Date): Promise<Array<Ride & { organizerName: string }>>;
  getRideParticipantIds(rideId: number): Promise<number[]>;
  getPendingParticipantGpxFiles(rideId: number, participantIds: number[]): Promise<Array<{
    userId: number;
    gpxFilePath: string;
    activityDate: Date;
  }>>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserById(id: number): Promise<User | undefined> {
    return this.getUser(id); // Alias to getUser for consistency
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createRide(rideData: InsertRide & { organizerId: number, gpxFilePath: string, weatherData?: any }): Promise<Ride> {
    const [ride] = await db
      .insert(rides)
      .values(rideData)
      .returning();
    
    // Automatically join the organizer to their own ride
    await db.insert(rideParticipants).values({
      rideId: ride.id,
      userId: ride.organizerId,
    });
    
    return ride;
  }

  async getRides(filters?: RideFilters): Promise<Array<Ride & { organizerName: string; participantCount: number; participants?: Array<{ id: number; name: string }> }>> {
    // Build the conditions array - only show non-completed rides
    const conditions = [eq(rides.isCompleted, false)];

    if (filters?.rideType) {
      conditions.push(eq(rides.rideType, filters.rideType));
    }
    if (filters?.surfaceType) {
      conditions.push(eq(rides.surfaceType, filters.surfaceType));
    }

    const result = await db
      .select({
        id: rides.id,
        name: rides.name,
        description: rides.description,
        dateTime: rides.dateTime,
        rideType: rides.rideType,
        surfaceType: rides.surfaceType,
        gpxFilePath: rides.gpxFilePath, // gpxFilePath IS being selected here
        meetupLocation: rides.meetupLocation,
        meetupCoords: rides.meetupCoords,
        organizerId: rides.organizerId,
        createdAt: rides.createdAt,
        organizerName: users.name,
        participantCount: sql<number>`COALESCE(COUNT(${rideParticipants.id}), 0)`.as('participantCount'),
      })
      .from(rides)
      .leftJoin(users, eq(rides.organizerId, users.id))
      .leftJoin(rideParticipants, eq(rides.id, rideParticipants.rideId))
      .where(and(...conditions))
      .groupBy(rides.id, users.id)
      .orderBy(asc(rides.dateTime));

    // ADDED CHECK: Ensure result is an array
    if (!Array.isArray(result)) {
      console.error("Database query for getRides returned non-array result:", result); // Log the unexpected result
      return []; // Return an empty array to satisfy the type
    }
    // Get participants for each ride (This section is not directly relevant to gpxFilePath)
    const ridesWithParticipants = await Promise.all(
      result.map(async (ride) => {
        const participants = await db
          .select({
            id: users.id,
            name: users.name,
          })
          .from(rideParticipants)
          .innerJoin(users, eq(rideParticipants.userId, users.id))
          .where(eq(rideParticipants.rideId, ride.id));

        console.log(`Ride ID: ${ride.id}, gpxFilePath: ${ride.gpxFilePath}`); // ADDED LOGGING

        return {
          ...ride,
          organizerName: ride.organizerName || 'Unknown',
          participantCount: Number(ride.participantCount),
          participants,
        };
      })
    );

    console.log(`Returning ${ridesWithParticipants.length} rides from storage.getRides`); // ADDED LOGGING
    return ridesWithParticipants; // Returns the rides including gpxFilePath
  }


  async getRide(id: number): Promise<(Ride & { organizer?: { name: string }; participants?: Array<{ id: number; name: string }> }) | undefined> {
    const [ride] = await db
      .select({
        id: rides.id,
        name: rides.name,
        description: rides.description,
        dateTime: rides.dateTime,
        rideType: rides.rideType,
        surfaceType: rides.surfaceType,
        gpxFilePath: rides.gpxFilePath,
        meetupLocation: rides.meetupLocation,
        meetupCoords: rides.meetupCoords,
        organizerId: rides.organizerId,
        isCompleted: rides.isCompleted,
        completedAt: rides.completedAt,
        createdAt: rides.createdAt,
        organizerName: users.name,
      })
      .from(rides)
      .leftJoin(users, eq(rides.organizerId, users.id))
      .where(eq(rides.id, id));
    
    if (!ride) return undefined;
    
    // Get participants for this ride
    const participants = await db
      .select({
        id: users.id,
        name: users.name,
      })
      .from(rideParticipants)
      .innerJoin(users, eq(rideParticipants.userId, users.id))
      .where(eq(rideParticipants.rideId, id));
    
    return {
      ...ride,
      organizer: ride.organizerName ? { name: ride.organizerName } : undefined,
      participants,
    };
  }

  async joinRide(rideId: number, userId: number): Promise<void> {
    await db.insert(rideParticipants).values({
      rideId,
      userId,
    });
  }

  async leaveRide(rideId: number, userId: number): Promise<void> {
    await db.delete(rideParticipants).where(
      and(
        eq(rideParticipants.rideId, rideId),
        eq(rideParticipants.userId, userId)
      )
    );
  }

  async isUserJoined(rideId: number, userId: number): Promise<boolean> {
    const [participant] = await db
      .select()
      .from(rideParticipants)
      .where(
        and(
          eq(rideParticipants.rideId, rideId),
          eq(rideParticipants.userId, userId)
        )
      )
      .limit(1);
    
    return !!participant;
  }

  async getRideParticipants(rideId: number): Promise<Array<RideParticipant & { userName: string }>> {
    const result = await db
      .select({
        id: rideParticipants.id,
        rideId: rideParticipants.rideId,
        userId: rideParticipants.userId,
        joinedAt: rideParticipants.joinedAt,
        userName: users.name,
      })
      .from(rideParticipants)
      .leftJoin(users, eq(rideParticipants.userId, users.id))
      .where(eq(rideParticipants.rideId, rideId));

    return result.map(row => ({
      ...row,
      userName: row.userName || 'Unknown',
    }));
  }

  async deleteRide(rideId: number): Promise<void> {
    console.log(`Attempting to delete ride with ID: ${rideId}`);

    await db.transaction(async (tx) => {
      console.log(`Starting database transaction for ride deletion: ${rideId}`);

      // 1. Get the ride details
      console.log(`Fetching ride details for deletion: ${rideId}`);
      const [rideToDelete] = await tx.select().from(rides).where(eq(rides.id, rideId)).limit(1);
      console.log(`Fetched ride details: ${JSON.stringify(rideToDelete)}`);

      if (!rideToDelete) {
        console.log(`Ride with ID ${rideId} not found. Aborting deletion.`);
        return;
      }

      // 2. Check for and handle organizer's uploaded GPX file (convert to solo activity if needed)
      console.log(`Checking for organizer_gpx_files for ride: ${rideId}`);
      const [organizerGpxToDelete] = await tx.select().from(organizerGpxFiles).where(eq(organizerGpxFiles.rideId, rideId)).limit(1);
      console.log(`Fetched organizer_gpx_files: ${JSON.stringify(organizerGpxToDelete)}`);

      if (organizerGpxToDelete) {
        console.log(`Organizer GPX found. Converting to solo activity.`);
        try {
          // Decrement organizer's XP earned from this GPX before converting - ADDED
          const organizerXpEarned = organizerGpxToDelete.xpEarned || 0;
          if (organizerXpEarned > 0) {
              await this.decrementUserXP(organizerGpxToDelete.organizerId, organizerXpEarned);
              console.log(`Decremented organizer ${organizerGpxToDelete.organizerId} XP by ${organizerXpEarned} for deleted organizer GPX ${organizerGpxToDelete.id}.`);
          }

          const soloActivityData = {
            userId: organizerGpxToDelete.organizerId,
            name: `Former Group Ride: ${rideToDelete.name} (Organizer)`,
            description: `Activity from deleted group ride: ${rideToDelete.name} (Organizer's route)`,
            activityType: 'cycling',
            gpxFilePath: organizerGpxToDelete.gpxFilePath,
            distance: organizerGpxToDelete.distance,
            duration: organizerGpxToDelete.duration,
            movingTime: organizerGpxToDelete.movingTime,
            elevationGain: organizerGpxToDelete.elevationGain,
            averageSpeed: organizerGpxToDelete.averageSpeed,
            averageHeartRate: organizerGpxToDelete.averageHeartRate,
            maxHeartRate: organizerGpxToDelete.maxHeartRate,
            calories: organizerGpxToDelete.calories,
            completedAt: organizerGpxToDelete.linkedAt || rideToDelete.completedAt || new Date(),
            deviceName: organizerGpxToDelete.deviceName || 'Converted from Group Ride',
            deviceType: organizerGpxToDelete.deviceType || 'manual',
            // Set XP earned to 0 for the converted solo activity to avoid double decrement - ADDED
            xpEarned: 0,
            xpDistance: 0,
            xpElevation: 0,
            xpSpeed: 0,
            xpOrganizingBonus: 0, // Ensure this is 0 for solo activity
          };

          console.log(`Creating solo activity from organizer GPX: ${JSON.stringify(soloActivityData)}`);
          await tx.insert(soloActivities).values(soloActivityData);
          console.log(`Solo activity created for organizer.`);

          console.log(`Deleting organizer_gpx_files record: ${organizerGpxToDelete.id}`);
          await tx.delete(organizerGpxFiles).where(eq(organizerGpxFiles.id, organizerGpxToDelete.id));
          console.log(`Organizer_gpx_files record deleted.`);

        } catch (conversionError) {
          console.error('Error converting organizer GPX to solo activity:', conversionError);
          // Log and continue, or handle as appropriate
        }
      } else if (rideToDelete.gpxFilePath) {
         // No organizer_gpx_files record, but there's a planned route GPX file. Delete it from storage.
         console.log(`No organizer GPX found. Found planned route GPX: ${rideToDelete.gpxFilePath}. Attempting to delete from Supabase.`);
         try {
           const { data, error } = await supabase.storage
             .from('gpx-uploads')
             .remove([rideToDelete.gpxFilePath]);

           if (error) {
             console.error('Supabase delete planned route GPX error:', error);
           } else {
             console.log(`Successfully deleted planned route GPX file: ${rideToDelete.gpxFilePath}`);
           }
         } catch (fileError) {
           console.error('Error deleting planned route GPX file from Supabase:', fileError);
         }
      } else {
        console.log(`No GPX file paths found for ride: ${rideId}`);
      }

      // 3. Check for and handle participant activity matches (convert to solo activities)
      console.log(`Checking for activity_matches for ride: ${rideId}`); // ADDED LOGGING
      const participantActivityMatches = await tx.select().from(activityMatches).where(eq(activityMatches.rideId, rideId));
      console.log(`Fetched ${participantActivityMatches.length} activity_matches.`); // ADDED LOGGING


      for (const activityMatch of participantActivityMatches) {
        console.log(`Converting activity_match ${activityMatch.id} for user ${activityMatch.userId} to solo activity.`); // ADDED LOGGING
        try {
          // Decrement participant's XP earned from this activity match before converting - ADDED
          const participantXpEarned = activityMatch.xpEarned || 0;
          if (participantXpEarned > 0) {
              await this.decrementUserXP(activityMatch.userId, participantXpEarned);
              console.log(`Decremented participant ${activityMatch.userId} XP by ${participantXpEarned} for deleted activity match ${activityMatch.id}.`);
          }

         const soloActivityData = {
           userId: activityMatch.userId,
           name: `Former Group Ride: ${rideToDelete.name}`,
           description: `Activity from deleted group ride: ${rideToDelete.name}`,
           activityType: 'cycling',
           gpxFilePath: activityMatch.gpxFilePath,
           distance: activityMatch.distance,
           duration: activityMatch.duration,
           movingTime: activityMatch.movingTime,
           elevationGain: activityMatch.elevationGain,
           averageSpeed: activityMatch.averageSpeed,
           averageHeartRate: activityMatch.averageHeartRate,
           maxHeartRate: activityMatch.maxHeartRate,
           calories: activityMatch.calories,
           completedAt: activityMatch.completedAt || rideToDelete.completedAt || new Date(),
           deviceName: activityMatch.deviceName || 'Converted from Group Ride',
           deviceType: activityMatch.deviceType || 'manual',
           // Set XP earned to 0 for the converted solo activity to avoid double decrement - ADDED
           xpEarned: 0,
           xpDistance: 0,
           xpElevation: 0,
           xpSpeed: 0,
           xpOrganizingBonus: 0, // Ensure this is 0 for solo activity
         }; 

          console.log(`Creating solo activity from activity match: ${JSON.stringify(soloActivityData)}`); // ADDED LOGGING
          await tx.insert(soloActivities).values(soloActivityData);
          console.log(`Solo activity created for user ${activityMatch.userId}.`); // ADDED LOGGING

          // Delete the activity_match record after converting it
          console.log(`Deleting activity_match record: ${activityMatch.id}`); // ADDED LOGGING
          await tx.delete(activityMatches).where(eq(activityMatches.id, activityMatch.id));
          console.log(`Activity_match record deleted.`); // ADDED LOGGING


          // The actual GPX file in storage (activityMatch.gpxFilePath) is NOT deleted here.
          // It remains in storage and is now linked to the new solo activity.

        } catch (conversionError) {
          console.error(`Error converting activity match ${activityMatch.id} to solo activity:`, conversionError);
          // Decide how to handle this error
        }
      }
      // 4. Decrement participant joining bonus XP - ADDED
      console.log(`Checking for participant joining bonus XP to decrement for ride: ${rideId}`);
      const rideParticipantsToDelete = await tx.select().from(rideParticipants).where(eq(rideParticipants.rideId, rideId));
      console.log(`Found ${rideParticipantsToDelete.length} participants to check for joining bonus.`);

      for (const participant of rideParticipantsToDelete) {
         const joiningBonus = participant.xpJoiningBonus || 0;
         if (joiningBonus > 0) {
             await this.decrementUserXP(participant.userId, joiningBonus);
             console.log(`Decremented participant ${participant.userId} XP by joining bonus ${joiningBonus} for deleted ride ${rideId}.`);
         }
      }
      // Note: The rideParticipants records themselves are deleted in the next step by the cascade.


      // 5. Delete all participants associated with the ride
      console.log(`Deleting participants for ride: ${rideId}`);
      await tx.delete(rideParticipants).where(eq(rideParticipants.rideId, rideId));
      console.log(`Participants deleted for ride: ${rideId}`);


      // 6. Then delete the ride record from the database
      console.log(`Deleting ride record from database: ${rideId}`);
      await tx.delete(rides).where(eq(rides.id, rideId));
      console.log(`Ride record deleted from database: ${rideId}`);

      console.log(`Database transaction completed for ride deletion: ${rideId}`);
    });
  }

  async getUserRides(userId: number): Promise<{
    all: Array<Ride & { organizerName: string; participantCount: number; isOrganizer: boolean; isParticipant: boolean }>;
    organized: Array<Ride & { organizerName: string; participantCount: number }>;
    joined: Array<Ride & { organizerName: string; participantCount: number }>;
  }> {
    // Get all rides user is involved in (organized or joined)
    const allRides = await db
      .select({
        id: rides.id,
        name: rides.name,
        description: rides.description,
        dateTime: rides.dateTime,
        rideType: rides.rideType,
        surfaceType: rides.surfaceType,
        gpxFilePath: rides.gpxFilePath,
        meetupLocation: rides.meetupLocation,
        meetupCoords: rides.meetupCoords,
        organizerId: rides.organizerId,
        isCompleted: rides.isCompleted,
        completedAt: rides.completedAt,
        createdAt: rides.createdAt,
        organizerName: users.name,
        weatherData: rides.weatherData, // Added weatherData
        participantCount: sql<number>`COUNT(DISTINCT ${rideParticipants.userId})`,
      })
      .from(rides)
      .leftJoin(users, eq(rides.organizerId, users.id))
      .leftJoin(rideParticipants, eq(rides.id, rideParticipants.rideId))
      .where(
        sql`${rides.organizerId} = ${userId} OR ${rides.id} IN (
          SELECT DISTINCT ${rideParticipants.rideId} 
          FROM ${rideParticipants} 
          WHERE ${rideParticipants.userId} = ${userId}
        )`
      )
      .groupBy(rides.id, users.name)
      .orderBy(desc(rides.dateTime));

    const organized = allRides.filter(ride => ride.organizerId === userId);
    const joined = allRides.filter(ride => ride.organizerId !== userId);

    const all = allRides.map(ride => ({
      id: ride.id,
      name: ride.name,
      description: ride.description, // description can be null
      dateTime: ride.dateTime,
      rideType: ride.rideType,
      surfaceType: ride.surfaceType,
      gpxFilePath: ride.gpxFilePath,
      meetupLocation: ride.meetupLocation,
      meetupCoords: ride.meetupCoords, // Corrected to ride.meetupCoords
      organizerId: ride.organizerId,
      isCompleted: ride.isCompleted,
      completedAt: ride.completedAt, // completedAt can be null for non-completed rides
      createdAt: ride.createdAt,
      organizerName: ride.organizerName || 'Unknown',
      participantCount: Number(ride.participantCount),
      weatherData: ride.weatherData as any, // Explicitly cast weatherData
      isOrganizer: ride.organizerId === userId,
      isParticipant: ride.organizerId !== userId, // This logic seems reversed based on the comment
    }))as Array<Ride & { organizerName: string; participantCount: number; isOrganizer: boolean; isParticipant: boolean }>;

    return {
      all,
      organized: organized.map(ride => ({
        id: ride.id,
        name: ride.name,
        description: ride.description,
        dateTime: ride.dateTime,
        rideType: ride.rideType,
        surfaceType: ride.surfaceType,
        gpxFilePath: ride.gpxFilePath,
        meetupLocation: ride.meetupLocation,
        meetupCoords: ride.meetupCoords as { lat: number; lng: number }, // Explicitly cast
        organizerId: ride.organizerId,
        isCompleted: ride.isCompleted,
        completedAt: ride.completedAt,
        createdAt: ride.createdAt,
        weatherData: ride.weatherData as any, // Explicitly cast weatherData
        organizerName: ride.organizerName || 'Unknown',
        participantCount: Number(ride.participantCount),
      })) as Array<Ride & { organizerName: string; participantCount: number }>,
    };
  }

  async completeRide(rideId: number, userId: number): Promise<void> {
    console.log(`[completeRide] Attempting to complete ride ${rideId} by user ${userId}`);

    // Check if user is the organizer
    const [ride] = await db.select().from(rides).where(eq(rides.id, rideId));
    if (!ride) {
         console.warn(`[completeRide] Ride ${rideId} not found.`);
         throw new Error("Ride not found.");
    }
    
    // Keep the organizer check here as only organizer can manually complete the ride
    if (ride.organizerId !== userId) {
        console.warn(`[completeRide] User ${userId} is not the organizer of ride ${rideId}. Organizer is ${ride.organizerId}.`);
        throw new Error("Only the organizer can complete a ride");
    }
    console.log(`[completeRide] User ${userId} verified as organizer for ride ${rideId}. Proceeding.`);


    // --- Process Participant Matching and Activity XP ---

    console.log(`[completeRide] Starting XP calculation and distribution for ride ${rideId}.`);

    // 1. Fetch participant activity data for this ride
    const participantActivities = await db
      .select()
      .from(activityMatches)
      .where(eq(activityMatches.rideId, rideId));

    console.log(`[completeRide] Found ${participantActivities.length} participant activities for ride ${rideId}.`);

    // 2. Calculate and add XP for each participant with activity data
    for (const activity of participantActivities) {
        console.log(`[completeRide] Processing activity match ${activity.id} for participant ${activity.userId}.`);
        // Calculate XP based on participant's activity data
        const distance = typeof activity.distance === 'string' ? parseFloat(activity.distance) : activity.distance || 0;
        const elevationGain = typeof activity.elevationGain === 'string' ? parseFloat(activity.elevationGain) : activity.elevationGain || 0;
        const averageSpeed = typeof activity.averageSpeed === 'string' ? parseFloat(activity.averageSpeed) : activity.averageSpeed || 0;

        // Calculate XP contribution from each metric (rounded) - ADDED
        const xpFromDistance = Math.round(distance * 0.05);
        const xpFromElevation = Math.round(elevationGain * 0.01);
        const xpFromSpeed = Math.round(averageSpeed * 0.1);

        // Calculate total earned XP by summing the rounded breakdown values - MODIFIED
        const earnedXp = xpFromDistance + xpFromElevation + xpFromSpeed;
        const roundedEarnedXp = earnedXp; // Use earnedXp directly as it's already summed from rounded values


        if (roundedEarnedXp > 0) {
          console.log(`[completeRide] Calculated ${roundedEarnedXp.toFixed(2)} XP for participant ${activity.userId} (Activity ${activity.id}). Breakdown: D=${xpFromDistance}, E=${xpFromElevation}, S=${xpFromSpeed}`); 
             
            // Update the activity match record with the calculated XP breakdown and total.
             await db.update(activityMatches)
                     .set({ 
                        xpEarned: roundedEarnedXp,
                        xpDistance: xpFromDistance, // ADDED
                        xpElevation: xpFromElevation, // ADDED
                        xpSpeed: xpFromSpeed, // ADDED
                        xpOrganizingBonus: 0, // Added to ensure consistency
                      })
                     .where(eq(activityMatches.id, activity.id));
                     console.log(`[completeRide] Saved ${roundedEarnedXp} XP and breakdown to activityMatches record ${activity.id}.`); // MODIFIED log message
             
             // Increment the user's total XP *only if* XP was just awarded (optional check)
             // Let's rely on incrementUserXP handling 0 for simplicity.
             await this.incrementUserXP(activity.userId, roundedEarnedXp);
             console.log(`[completeRide] Added ${roundedEarnedXp.toFixed(2)} XP to user ${activity.userId}.`);
        }
    }
    console.log(`[completeRide] Finished participant matching and activity XP processing for ride ${rideId}.`);
    // --- End Participant XP Processing ---

    
    console.log(`[completeRide] Processing participant joining bonus XP for ride ${rideId}.`);

    // Fetch all participants for this ride
    const participants = await db
        .select()
        .from(rideParticipants)
        .where(eq(rideParticipants.rideId, rideId));

    console.log(`[completeRide] Found ${participants.length} participants for joining bonus calculation.`);

    // Calculate and award joining bonus for each participant
    const joiningBonusPerParticipant = 1; // Example fixed joining bonus per participant

    for (const participant of participants) {
        console.log(`[completeRide] Processing joining bonus for participant ${participant.userId}.`);

        // Check if joining bonus has already been awarded for this participant and ride
        // This prevents awarding the bonus multiple times if completeRide is called again
        if (participant.xpJoiningBonus === 0) { // Assuming default value is 0 and only updated when awarded
             console.log(`[completeRide] Awarding joining bonus to participant ${participant.userId}.`);

             // Update the rideParticipants record with the joining bonus
             await db.update(rideParticipants)
                     .set({ xpJoiningBonus: joiningBonusPerParticipant })
                     .where(eq(rideParticipants.id, participant.id));
                 console.log(`[completeRide] Saved ${joiningBonusPerParticipant} Joining Bonus XP to rideParticipants record ${participant.id}.`);

             // Increment the user's total XP with the joining bonus
             if (joiningBonusPerParticipant > 0) { // Only increment if joining bonus is positive
                await this.incrementUserXP(participant.userId, joiningBonusPerParticipant);
                console.log(`[completeRide] Added ${joiningBonusPerParticipant} Joining Bonus XP to user ${participant.userId}.`);
             }
        } else {
            console.log(`[completeRide] Joining bonus already awarded to participant ${participant.userId}. Skipping.`);
        }
    }

    console.log(`[completeRide] Finished participant joining bonus XP processing.`);
    // --- End Participant Joining Bonus XP Processing ---


    // --- Calculate and Add Incremental Organizer XP ---

    console.log(`[completeRide] Calculating incremental organizer XP for ride ${rideId}.`);

    // 1. Fetch all activity matches for this ride again to count participants with GPX
    const allActivityMatchesForRide = await db
        .select()
        .from(activityMatches)
        .where(eq(activityMatches.rideId, rideId));

    // 2. Count participants with uploaded GPX files
    const participantsWithGpxCount = allActivityMatchesForRide.filter(
        activity => activity.gpxFilePath !== null && activity.gpxFilePath !== undefined
    ).length;

    console.log(`[completeRide] Found ${participantsWithGpxCount} participants with uploaded GPX for ride ${rideId}.`);

    // 3. Define incremental XP per participant
    const incrementalXpPerParticipant = 5; // Example: 5 XP per participant with GPX

    // 4. Calculate total incremental XP for the organizer
    const totalIncrementalOrganizerXp = participantsWithGpxCount * incrementalXpPerParticipant;

    console.log(`[completeRide] Calculated total incremental organizer XP: ${totalIncrementalOrganizerXp}.`);

    // 5. Add the incremental XP to the organizer's total XP
    if (totalIncrementalOrganizerXp > 0) {
        // Fetch the ride again to get the organizerId
        const [ride] = await db.select().from(rides).where(eq(rides.id, rideId)).limit(1);
        if (ride?.organizerId) {
            await this.incrementUserXP(ride.organizerId, totalIncrementalOrganizerXp);
            console.log(`[completeRide] Added ${totalIncrementalOrganizerXp} incremental XP to organizer ${ride.organizerId} for ride ${rideId}.`);

            // Optionally, update the organizerGpxFiles record with this bonus if it exists
            const [organizerGpx] = await db.select().from(organizerGpxFiles).where(eq(organizerGpxFiles.rideId, rideId)).limit(1);
            if (organizerGpx) {
                const currentOrganizingBonus = organizerGpx.xpOrganizingBonus || 0;
                await db.update(organizerGpxFiles)
                        .set({ xpOrganizingBonus: currentOrganizingBonus + totalIncrementalOrganizerXp })
                        .where(eq(organizerGpxFiles.id, organizerGpx.id));
                console.log(`[completeRide] Updated organizerGpxFiles record ${organizerGpx.id} with incremental bonus.`);
            }

        } else {
            console.warn(`[completeRide] Could not find organizerId for ride ${rideId} to award incremental XP.`);
        }
    } else {
        console.log(`[completeRide] No incremental organizer XP to add for ride ${rideId}.`);
    }

    // --- End Calculate and Add Incremental Organizer XP ---


    // --- Organizer XP Calculation Removed ---
    // The XP calculation for the organizer's GPX or the organizing bonus
    // is removed from here. It will happen in the /api/upload-activity
    // or /api/link-organizer-gpx routes when the organizer's GPX is processed.
    console.log(`[completeRide] Organizer XP calculation skipped in completeRide. Handled during organizer GPX upload/linking.`);

    // Mark the ride as completed
    // Add a check if it's already completed to avoid unnecessary updates
    if (!ride.isCompleted) {
      console.log(`[completeRide] Marking ride ${rideId} as completed.`);
      await db
        .update(rides)
        .set({
          isCompleted: true,
          completedAt: new Date()
        })
        .where(eq(rides.id, rideId));
      console.log(`[completeRide] Ride ${rideId} marked as completed.`);
  } else {
      console.log(`[completeRide] Ride ${rideId} was already completed. Skipping update.`);
  }
}

  async getUserStats(userId: number, timeframe: string): Promise<{
    ridesJoined: number;
    ridesHosted: number;
    soloRides: number;
    totalDistance: number;
    totalElevation: number;
    ridesJoinedChange: number;
    ridesHostedChange: number;
    soloRidesChange: number;
    totalDistanceChange: number;
    totalElevationChange: number;
    xp: number;
  }> {
    const now = new Date();
    let startDate = new Date();
    let previousStartDate = new Date();

    // Calculate date ranges based on timeframe
    switch (timeframe) {
      case 'last-month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        previousStartDate = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
        break;
      case 'last-3-months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        previousStartDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      case 'last-6-months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        previousStartDate = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
        break;
      case 'last-year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        previousStartDate = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
        break;
      default: // all-time
        startDate = new Date(0);
        previousStartDate = new Date(0);
    }

    // Get current period stats (only count rides where user has uploaded GPX data)
    const currentStats = await db
      .select({
        ridesJoined: sql<number>`COUNT(DISTINCT CASE 
          WHEN ${rides.organizerId} != ${userId} 
          AND ${rideParticipants.userId} = ${userId} 
          AND ${activityMatches.userId} = ${userId} 
          AND ${activityMatches.gpxFilePath} IS NOT NULL 
          THEN ${rides.id} 
          END)`,
        ridesHosted: sql<number>`COUNT(DISTINCT CASE 
          WHEN ${rides.organizerId} = ${userId} 
          AND ${rides.isCompleted} = true 
          THEN ${rides.id} 
          END)`,
          totalDistance: sql<number>`SUM(COALESCE(
            CASE WHEN ${activityMatches.userId} = ${userId} THEN CAST(${activityMatches.distance} AS DECIMAL) ELSE 0 END,
            CASE WHEN ${organizerGpxFiles.organizerId} = ${userId} THEN CAST(${organizerGpxFiles.distance} AS DECIMAL) ELSE 0 END,
            0
          ))`,
          totalElevation: sql<number>`SUM(COALESCE(
            CASE WHEN ${activityMatches.userId} = ${userId} THEN CAST(${activityMatches.elevationGain} AS DECIMAL) ELSE 0 END,
            CASE WHEN ${organizerGpxFiles.organizerId} = ${userId} THEN CAST(${organizerGpxFiles.elevationGain} AS DECIMAL) ELSE 0 END,
            0
          ))`,          
      })
      .from(rides)
      .leftJoin(rideParticipants, eq(rides.id, rideParticipants.rideId))
      .leftJoin(activityMatches, and(
        eq(rides.id, activityMatches.rideId),
        eq(activityMatches.userId, userId)
      ))
      .leftJoin(organizerGpxFiles, and( // ADDED: Join organizerGpxFiles
        eq(rides.id, organizerGpxFiles.rideId),
        eq(organizerGpxFiles.organizerId, userId)
      ))
      .where(
        and(
          sql`${rides.createdAt} >= ${startDate}`,
          sql`${rides.createdAt} <= ${now}`,
          sql`(${rides.organizerId} = ${userId} OR ${rideParticipants.userId} = ${userId})`
        )
      );

    // Get previous period stats for comparison (only count rides where user has uploaded GPX data)
    const previousStats = await db
      .select({
        ridesJoined: sql<number>`COUNT(DISTINCT CASE 
          WHEN ${rides.organizerId} != ${userId} 
          AND ${rideParticipants.userId} = ${userId} 
          AND ${activityMatches.userId} = ${userId} 
          AND ${activityMatches.gpxFilePath} IS NOT NULL 
          THEN ${rides.id} 
          END)`,
        ridesHosted: sql<number>`COUNT(DISTINCT CASE 
          WHEN ${rides.organizerId} = ${userId} 
          AND ${rides.isCompleted} = true 
          THEN ${rides.id} 
          END)`,
          totalDistance: sql<number>`SUM(COALESCE(
            CASE WHEN ${activityMatches.userId} = ${userId} THEN CAST(${activityMatches.distance} AS DECIMAL) ELSE 0 END,
            CASE WHEN ${organizerGpxFiles.organizerId} = ${userId} THEN CAST(${organizerGpxFiles.distance} AS DECIMAL) ELSE 0 END,
            0
          ))`,
          totalElevation: sql<number>`SUM(COALESCE(
            CASE WHEN ${activityMatches.userId} = ${userId} THEN CAST(${activityMatches.elevationGain} AS DECIMAL) ELSE 0 END,
            CASE WHEN ${organizerGpxFiles.organizerId} = ${userId} THEN CAST(${organizerGpxFiles.elevationGain} AS DECIMAL) ELSE 0 END,
            0
          ))`,          
      })
      .from(rides)
      .leftJoin(rideParticipants, eq(rides.id, rideParticipants.rideId))
      .leftJoin(activityMatches, and(
        eq(rides.id, activityMatches.rideId),
        eq(activityMatches.userId, userId)
      ))
      .leftJoin(organizerGpxFiles, and( // ADDED: Join organizerGpxFiles
        eq(rides.id, organizerGpxFiles.rideId),
        eq(organizerGpxFiles.organizerId, userId)
      ))
      .where(
        and(
          sql`${rides.createdAt} >= ${previousStartDate}`,
          sql`${rides.createdAt} < ${startDate}`,
          sql`(${rides.organizerId} = ${userId} OR ${rideParticipants.userId} = ${userId})`
        )
      );

    const current = currentStats[0] || { ridesJoined: 0, ridesHosted: 0, totalDistance: 0, totalElevation: 0 };
    const previous = previousStats[0] || { ridesJoined: 0, ridesHosted: 0, totalDistance: 0, totalElevation: 0 };

    // Get solo activities stats for current period
    const currentSoloStats = await db
      .select({
        soloRidesCount: sql<number>`COUNT(*)`,
        soloDistance: sql<number>`SUM(CASE 
          WHEN ${soloActivities.distance} IS NOT NULL 
          THEN CAST(${soloActivities.distance} AS DECIMAL) 
          ELSE 0 
          END)`,
        soloElevation: sql<number>`SUM(CASE 
          WHEN ${soloActivities.elevationGain} IS NOT NULL 
          THEN CAST(${soloActivities.elevationGain} AS DECIMAL) 
          ELSE 0 
          END)`,
      })
      .from(soloActivities)
      .where(
        and(
          eq(soloActivities.userId, userId),
          sql`${soloActivities.completedAt} >= ${startDate}`,
          sql`${soloActivities.completedAt} <= ${now}`
        )
      );

    // Get solo activities stats for previous period
    const previousSoloStats = await db
      .select({
        soloRidesCount: sql<number>`COUNT(*)`,
        soloDistance: sql<number>`SUM(CASE 
          WHEN ${soloActivities.distance} IS NOT NULL 
          THEN CAST(${soloActivities.distance} AS DECIMAL) 
          ELSE 0 
          END)`,
        soloElevation: sql<number>`SUM(CASE 
          WHEN ${soloActivities.elevationGain} IS NOT NULL 
          THEN CAST(${soloActivities.elevationGain} AS DECIMAL) 
          ELSE 0 
          END)`,
      })
      .from(soloActivities)
      .where(
        and(
          eq(soloActivities.userId, userId),
          sql`${soloActivities.completedAt} >= ${previousStartDate}`,
          sql`${soloActivities.completedAt} < ${startDate}`
        )
      );

    const currentSolo = currentSoloStats[0] || { soloRidesCount: 0, soloDistance: 0, soloElevation: 0 };
    const previousSolo = previousSoloStats[0] || { soloRidesCount: 0, soloDistance: 0, soloElevation: 0 };

    // Calculate totals including solo activities
    const totalCurrentDistance = Number(current.totalDistance) + Number(currentSolo.soloDistance);
    const totalCurrentElevation = Number(current.totalElevation) + Number(currentSolo.soloElevation);
    const [user] = await db.select({ xp: users.xp }).from(users).where(eq(users.id, userId));
    const currentXP = user?.xp || 0;
    const totalPreviousDistance = Number(previous.totalDistance) + Number(previousSolo.soloDistance);
    const totalPreviousElevation = Number(previous.totalElevation) + Number(previousSolo.soloElevation);

    // Get follower/following counts
    const followersCount = await this.getFollowerCount(userId);
    const followingCount = await this.getFollowingCount(userId);

    return {
      ridesJoined: Number(current.ridesJoined),
      ridesHosted: Number(current.ridesHosted),
      soloRides: Number(currentSolo.soloRidesCount),
      totalDistance: Number(totalCurrentDistance.toFixed(2)),
      totalElevation: totalCurrentElevation,
      ridesJoinedChange: Number(current.ridesJoined) - Number(previous.ridesJoined),
      ridesHostedChange: Number(current.ridesHosted) - Number(previous.ridesHosted),
      soloRidesChange: Number(currentSolo.soloRidesCount) - Number(previousSolo.soloRidesCount),
      totalDistanceChange: Number((totalCurrentDistance - totalPreviousDistance).toFixed(2)),
      totalElevationChange: totalCurrentElevation - totalPreviousElevation,
      followersCount,
      followingCount,
      xp: currentXP, 
    };
  }

  async getUserCompletedRides(userId: number, limit?: number): Promise<Array<Ride & { organizerName: string; participantCount: number; completedAt: Date }>> {
    const query = db
      .select({
        id: rides.id,
        name: rides.name,
        description: rides.description,
        dateTime: rides.dateTime,
        rideType: rides.rideType,
        surfaceType: rides.surfaceType,
        gpxFilePath: rides.gpxFilePath,
        meetupLocation: rides.meetupLocation,
        meetupCoords: rides.meetupCoords,
        organizerId: rides.organizerId,
        isCompleted: rides.isCompleted,
        completedAt: rides.completedAt,
        createdAt: rides.createdAt,
        organizerName: users.name,
        participantCount: sql<number>`COUNT(DISTINCT ${rideParticipants.userId})`,
      })
      .from(rides)
      .leftJoin(users, eq(rides.organizerId, users.id))
      .leftJoin(rideParticipants, eq(rides.id, rideParticipants.rideId))
      .where(
        and(
          eq(rides.isCompleted, true),
          sql`(${rides.organizerId} = ${userId} OR ${rides.id} IN (
            SELECT DISTINCT ${rideParticipants.rideId} 
            FROM ${rideParticipants} 
            WHERE ${rideParticipants.userId} = ${userId}
          ))`
        )
      )
      .groupBy(rides.id, users.name)
      .orderBy(desc(rides.completedAt));

    const result = limit ? await query.limit(limit) : await query;
    
    return result.map(ride => ({
      ...ride,
      organizerName: ride.organizerName || 'Unknown',
      participantCount: Number(ride.participantCount),
      completedAt: ride.completedAt!,
    }));
  }

  async getRiders(currentUserId: number): Promise<Array<User & { followersCount: number; completedRides: number; hostedRides: number; isFollowing: boolean }>> {
    // Get all users except current user
    const allUsers = await db
      .select()
      .from(users)
      .where(sql`${users.id} != ${currentUserId}`);

    // Get stats for each user and filter out already following users
    const ridersWithStats = await Promise.all(
      allUsers.map(async (user) => {
        const followersCount = await this.getFollowerCount(user.id);
        const followingCount = await this.getFollowingCount(user.id);
        const isFollowing = await this.isFollowing(currentUserId, user.id);
        
        // Get completed rides count
        const completedRides = await db
          .select({ count: sql<number>`count(*)` })
          .from(rideParticipants)
          .leftJoin(rides, eq(rides.id, rideParticipants.rideId))
          .where(
            and(
              eq(rideParticipants.userId, user.id),
              eq(rides.isCompleted, true)
            )
          );
        
        // Get hosted rides count
        const hostedRides = await db
          .select({ count: sql<number>`count(*)` })
          .from(rides)
          .where(eq(rides.organizerId, user.id));
        
        return {
          ...user,
          followersCount,
          completedRides: completedRides[0]?.count || 0,
          hostedRides: hostedRides[0]?.count || 0,
          isFollowing,
        };
      })
    );

    // Filter out users that are already being followed and sort by followers count descending
    const unfollowedRiders = ridersWithStats.filter(rider => !rider.isFollowing);
    return unfollowedRiders.sort((a, b) => b.followersCount - a.followersCount);
  }

  async followUser(followerId: number, followingId: number): Promise<void> {
    await db.insert(follows).values({
      followerId,
      followingId
    });
  }

  async unfollowUser(followerId: number, followingId: number): Promise<void> {
    await db.delete(follows).where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId)
      )
    );
  }

  async isFollowing(followerId: number, followingId: number): Promise<boolean> {
    const [result] = await db
      .select()
      .from(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.followingId, followingId)
        )
      );
    return !!result;
  }

  async getFollowerCount(userId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followingId, userId));
    return result.count;
  }

  async getFollowingCount(userId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followerId, userId));
    return result.count;
  }

  async getFollowers(userId: number): Promise<Array<User & { followersCount: number; completedRides: number; hostedRides: number }>> {
    // First get the basic follower users
    const followerUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        password: users.password,
        name: users.name,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(follows, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, userId));

    // Add stats for each user
    const followersWithStats = await Promise.all(
      followerUsers.map(async (user) => {
        const [followerCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(follows)
          .where(eq(follows.followingId, user.id));
        
        const [completedRidesCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(rideParticipants)
          .innerJoin(rides, eq(rides.id, rideParticipants.rideId))
          .where(and(
            eq(rideParticipants.userId, user.id),
            eq(rides.isCompleted, true)
          ));

        const [hostedRidesCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(rides)
          .where(eq(rides.organizerId, user.id));

        return {
          ...user,
          followersCount: followerCount.count || 0,
          completedRides: completedRidesCount.count || 0,
          hostedRides: hostedRidesCount.count || 0
        };
      })
    );

    return followersWithStats;
  }

  async getFollowing(userId: number): Promise<Array<User & { followersCount: number; completedRides: number; hostedRides: number }>> {
    // First get the basic following users
    const followingUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        password: users.password,
        name: users.name,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(follows, eq(follows.followingId, users.id))
      .where(eq(follows.followerId, userId));

    // Add stats for each user
    const followingWithStats = await Promise.all(
      followingUsers.map(async (user) => {
        const [followerCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(follows)
          .where(eq(follows.followingId, user.id));
        
        const [completedRidesCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(rideParticipants)
          .innerJoin(rides, eq(rides.id, rideParticipants.rideId))
          .where(and(
            eq(rideParticipants.userId, user.id),
            eq(rides.isCompleted, true)
          ));

        const [hostedRidesCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(rides)
          .where(eq(rides.organizerId, user.id));

        return {
          ...user,
          followersCount: followerCount.count || 0,
          completedRides: completedRidesCount.count || 0,
          hostedRides: hostedRidesCount.count || 0
        };
      })
    );

    return followingWithStats;
  }

  // Device operations
  async getUserDevices(userId: number): Promise<DeviceConnection[]> {
    const devices = await db
      .select()
      .from(deviceConnections)
      .where(eq(deviceConnections.userId, userId))
      .orderBy(desc(deviceConnections.lastConnectedAt));
    
    return devices;
  }

  async createDeviceConnection(device: InsertDeviceConnection): Promise<DeviceConnection> {
    const [newDevice] = await db
      .insert(deviceConnections)
      .values(device)
      .returning();
    
    return newDevice;
  }

  async updateDeviceConnection(deviceId: string, userId: number, updates: Partial<DeviceConnection>): Promise<void> {
    await db
      .update(deviceConnections)
      .set(updates)
      .where(
        and(
          eq(deviceConnections.deviceId, deviceId),
          eq(deviceConnections.userId, userId)
        )
      );
  }

  async deleteDeviceConnection(deviceId: string, userId: number): Promise<void> {
    await db
      .delete(deviceConnections)
      .where(
        and(
          eq(deviceConnections.deviceId, deviceId),
          eq(deviceConnections.userId, userId)
        )
      );
  }

  // Activity matching operations
  async createActivityMatch(match: InsertActivityMatch): Promise<ActivityMatch> {
    const [newMatch] = await db
      .insert(activityMatches)
      .values(match)
      .returning();
    
    return newMatch;
  }

  async getActivityMatches(rideId: number): Promise<ActivityMatch[]> {
    const matches = await db
      .select()
      .from(activityMatches)
      .where(eq(activityMatches.rideId, rideId))
      .orderBy(desc(activityMatches.matchedAt));
    
    return matches;
  }

  async getRideActivityMatches(rideId: number): Promise<Array<ActivityMatch & { userName: string }>> {
    const matches = await db
      .select({
        id: activityMatches.id,
        rideId: activityMatches.rideId,
        userId: activityMatches.userId,
        deviceId: activityMatches.deviceId,
        routeMatchPercentage: activityMatches.routeMatchPercentage,
        gpxFilePath: activityMatches.gpxFilePath,
        distance: activityMatches.distance,
        duration: activityMatches.duration,
        movingTime: activityMatches.movingTime,
        elevationGain: activityMatches.elevationGain,
        averageSpeed: activityMatches.averageSpeed,
        averageHeartRate: activityMatches.averageHeartRate,
        maxHeartRate: activityMatches.maxHeartRate,
        calories: activityMatches.calories,
        completedAt: activityMatches.completedAt,
        matchedAt: activityMatches.matchedAt,
        userName: users.name,
      })
      .from(activityMatches)
      .leftJoin(users, eq(activityMatches.userId, users.id))
      .where(eq(activityMatches.rideId, rideId))
      .orderBy(desc(activityMatches.matchedAt));
    
    return matches.map(row => ({
      ...row,
      userName: row.userName || 'Unknown',
    }));
  }

  async getUserActivityMatches(userId: number): Promise<ActivityMatch[]> {
    const matches = await db
      .select()
      .from(activityMatches)
      .where(eq(activityMatches.userId, userId))
      .orderBy(desc(activityMatches.matchedAt));
    
    return matches;
  }

  async getUserActivityForRide(rideId: number, userId: number): Promise<ActivityMatch | undefined> {
    const [activity] = await db
      .select()
      .from(activityMatches)
      .where(
        and(
          eq(activityMatches.rideId, rideId),
          eq(activityMatches.userId, userId)
        )
      )
      .limit(1);
    return activity || undefined;
  }

  // Solo activities operations
  async createSoloActivity(activity: InsertSoloActivity): Promise<SoloActivity> {
    // Manually construct the insert data to match the Drizzle schema types
    const insertData = {
        userId: activity.userId,
        name: activity.name,
        description: activity.description, // description is optional
        activityType: activity.activityType,
        gpxFilePath: activity.gpxFilePath,
        distance: activity.distance, // decimal
        duration: activity.duration, // integer
        movingTime: activity.movingTime, // integer
        elevationGain: activity.elevationGain, // decimal
        averageSpeed: activity.averageSpeed, // decimal
        averageHeartRate: activity.averageHeartRate, // integer
        maxHeartRate: activity.maxHeartRate, // integer
        calories: activity.calories, // integer
        deviceName: activity.deviceName, // text
        deviceType: activity.deviceType, // text (optional enum in schema)
        completedAt: activity.completedAt instanceof Date ? activity.completedAt : new Date(activity.completedAt), // Ensure completedAt is a Date object
        // createdAt will use the defaultNow() from the schema
    };
    
        // Calculate XP for the solo activity BEFORE inserting
        const distance = insertData.distance ? parseFloat(insertData.distance.toString()) : 0;
        const elevationGain = insertData.elevationGain ? parseFloat(insertData.elevationGain.toString()) : 0;
        const averageSpeed = insertData.averageSpeed ? parseFloat(insertData.averageSpeed.toString()) : 0;
        const xpFromDistance = Math.round(distance * 0.05);
        const xpFromElevation = Math.round(elevationGain * 0.01);
        const xpFromSpeed = Math.round(averageSpeed * 0.1);
    
        console.log(`[createSoloActivity] Calculating XP for activity: ${insertData.name}`);
        console.log(`[createSoloActivity] Distance: ${distance}`);
        console.log(`[createSoloActivity] Elevation Gain: ${elevationGain}`);
        console.log(`[createSoloActivity] Average Speed: ${averageSpeed}`);

        // Calculate XP: distance + elevation + speed (using the revised multiplier)
        const earnedXp = xpFromDistance + xpFromElevation + xpFromSpeed;;
    
        // Round the earned XP to the nearest integer
        const roundedEarnedXp = Math.round(earnedXp);

        console.log(`[createSoloActivity] Calculated raw XP: ${earnedXp}`);
        console.log(`[createSoloActivity] Rounded earned XP: ${roundedEarnedXp}`);
    
        // Add the calculated XP to the insert data
        // Assuming your soloActivities schema has an 'xp' column
        const finalInsertData = {
            ...insertData,
            xpEarned: roundedEarnedXp, 
            xpDistance: xpFromDistance, // XP from distance
            xpElevation: xpFromElevation, // XP from elevation
            xpSpeed: xpFromSpeed, // XP from speed
        };
    

    const [newActivity] = await db
      .insert(soloActivities)
      .values(finalInsertData) 
      .returning();

    // Add XP to the user's total
    // Only increment if the earned XP is positive
    if (roundedEarnedXp > 0) {
      // commented out because this is being handled in routes Solo Activity
      // await this.incrementUserXP(newActivity.userId, roundedEarnedXp);
      console.log(`[createSoloActivity] Added ${roundedEarnedXp} XP to user ${newActivity.userId} for solo activity ${newActivity.id}.`);
    } else {
      console.log(`[createSoloActivity] Calculated 0 XP for solo activity ${newActivity.id}. Skipping user XP increment.`);
    }
    return newActivity;
  }

  async getUserSoloActivities(userId: number): Promise<SoloActivity[]> {
    return await db
      .select()
      .from(soloActivities)
      .where(eq(soloActivities.userId, userId))
      .orderBy(desc(soloActivities.completedAt));
  }

  async getSoloActivity(id: number): Promise<SoloActivity | undefined> {
    const [activity] = await db
      .select()
      .from(soloActivities)
      .where(eq(soloActivities.id, id));
    return activity || undefined;
  }

  async deleteSoloActivity(id: number): Promise<void> {
    // Get the activity to check ownership and get file path and XP earned - ADDED
    const [activity] = await db.select().from(soloActivities).where(eq(soloActivities.id, id));

    if (!activity) {
        console.warn(`Solo activity with ID ${id} not found for deletion.`);
        return; // Activity not found
    }

    // Store XP earned before deleting the activity - ADDED
    const xpEarned = activity.xpEarned || 0;

    // Delete the activity from database
    await db.delete(soloActivities).where(eq(soloActivities.id, id));
    console.log(`Deleted solo activity record with ID: ${id}.`);

    // Decrement user's XP if XP was earned from this activity - ADDED
    if (xpEarned > 0) {
      await this.decrementUserXP(activity.userId, xpEarned); // Use the decrement function
      console.log(`Decremented user ${activity.userId} XP by ${xpEarned} for deleting solo activity ${id}.`);
   } else {
      console.log(`No XP earned from solo activity ${id}, skipping XP decrement.`);
   }
  }
  // ADDED: Function to increment user XP
  async incrementUserXP(userId: number, amount: number): Promise<void> {
  if (amount <= 0) {
      console.warn(`Attempted to increment XP by a non-positive amount for user ${userId}: ${amount}`);
      return; // Do not process non-positive XP amounts
  }
  await db
    .update(users)
    .set({
      xp: sql`${users.xp} + ${amount}`,
    })
    .where(eq(users.id, userId));
  }
  async getUserCompletedActivities(userId: number): Promise<{
    completedRides: Array<Ride & { organizerName: string; participantCount: number; completedAt: Date; userActivityData?: ActivityMatch }>;
    soloActivities: SoloActivity[];
  }> {
    // Get completed rides (both organized and joined)
    const completedRides = await db
      .select({
        id: rides.id,
        name: rides.name,
        description: rides.description,
        dateTime: rides.dateTime,
        rideType: rides.rideType,
        surfaceType: rides.surfaceType,
        gpxFilePath: rides.gpxFilePath,
        meetupLocation: rides.meetupLocation,
        meetupCoords: rides.meetupCoords,
        organizerId: rides.organizerId,
        isCompleted: rides.isCompleted,
        completedAt: rides.completedAt,
        createdAt: rides.createdAt,
        organizerName: users.name,
        participantCount: sql<number>`cast(count(${rideParticipants.id}) as int)`,
      })
      .from(rides)
      .leftJoin(users, eq(rides.organizerId, users.id))
      .leftJoin(rideParticipants, eq(rides.id, rideParticipants.rideId))
      .where(
        and(
          eq(rides.isCompleted, true),
          sql`(${rides.organizerId} = ${userId} OR ${rides.id} IN (
            SELECT ride_id FROM ${rideParticipants} WHERE user_id = ${userId}
          ))`
        )
      )
      .groupBy(rides.id, users.name)
      .orderBy(desc(rides.completedAt));

    // Get user's activity data for each completed ride
    const ridesWithUserData = await Promise.all(
      completedRides.map(async (ride) => {
        // First check for participant activity data
        const [userActivityData] = await db
          .select({
            id: activityMatches.id,
              rideId: activityMatches.rideId,
              userId: activityMatches.userId,
              deviceId: activityMatches.deviceId,
              routeMatchPercentage: activityMatches.routeMatchPercentage,
              gpxFilePath: activityMatches.gpxFilePath,
              distance: activityMatches.distance,
              duration: activityMatches.duration,
              movingTime: activityMatches.movingTime,
              elevationGain: activityMatches.elevationGain,
              averageSpeed: activityMatches.averageSpeed,
              averageHeartRate: activityMatches.averageHeartRate,
              maxHeartRate: activityMatches.maxHeartRate,
              calories: activityMatches.calories,
              completedAt: activityMatches.completedAt,
              matchedAt: activityMatches.matchedAt,
              xpEarned: activityMatches.xpEarned,
              xpDistance: activityMatches.xpDistance,
              xpElevation: activityMatches.xpElevation,
              xpSpeed: activityMatches.xpSpeed,
              xpOrganizingBonus: activityMatches.xpOrganizingBonus,
          })
          .from(activityMatches)
          .where(
            and(
              eq(activityMatches.rideId, ride.id),
              eq(activityMatches.userId, userId)
            )
          )
          .limit(1);

        // If no participant data found and user is the organizer, check for organizer GPX data
        let finalUserActivityData = userActivityData;
        if (!userActivityData && ride.organizerId === userId) {
          const [organizerGpxData] = await db
          .select({
            id: organizerGpxFiles.id,
            rideId: organizerGpxFiles.rideId,
            organizerId: organizerGpxFiles.organizerId,
            gpxFilePath: organizerGpxFiles.gpxFilePath,
            originalGpxPath: organizerGpxFiles.originalGpxPath,
            matchScore: organizerGpxFiles.matchScore,
            isManuallyLinked: organizerGpxFiles.isManuallyLinked,
            distance: organizerGpxFiles.distance,
            duration: organizerGpxFiles.duration,
            movingTime: organizerGpxFiles.movingTime,
            elevationGain: organizerGpxFiles.elevationGain,
            averageSpeed: organizerGpxFiles.averageSpeed,
            averageHeartRate: organizerGpxFiles.averageHeartRate,
            maxHeartRate: organizerGpxFiles.maxHeartRate,
            calories: organizerGpxFiles.calories,
            linkedAt: organizerGpxFiles.linkedAt,
            createdAt: organizerGpxFiles.createdAt,
            xpEarned: organizerGpxFiles.xpEarned,
            xpDistance: organizerGpxFiles.xpDistance,
            xpElevation: organizerGpxFiles.xpElevation,
            xpSpeed: organizerGpxFiles.xpSpeed,
            xpOrganizingBonus: organizerGpxFiles.xpOrganizingBonus,
          })
            .from(organizerGpxFiles)
            .where(eq(organizerGpxFiles.rideId, ride.id))
            .limit(1);
          
          // Convert organizer GPX data to ActivityMatch format for consistency
          if (organizerGpxData) {
            finalUserActivityData = {
              id: organizerGpxData.id,
              rideId: organizerGpxData.rideId,
              userId: userId, // Current user (organizer)
              deviceId: 'organizer-gpx',
              routeMatchPercentage: organizerGpxData.matchScore,
              gpxFilePath: organizerGpxData.gpxFilePath,
              distance: organizerGpxData.distance,
              duration: organizerGpxData.duration,
              movingTime: organizerGpxData.movingTime,
              elevationGain: organizerGpxData.elevationGain,
              averageSpeed: organizerGpxData.averageSpeed,
              averageHeartRate: organizerGpxData.averageHeartRate,
              maxHeartRate: organizerGpxData.maxHeartRate,
              calories: organizerGpxData.calories,
              completedAt: organizerGpxData.linkedAt || ride.completedAt,
              matchedAt: organizerGpxData.linkedAt || ride.completedAt,
              xpEarned: organizerGpxData.xpEarned,
              xpDistance: organizerGpxData.xpDistance,
              xpElevation: organizerGpxData.xpElevation,
              xpSpeed: organizerGpxData.xpSpeed,
              xpOrganizingBonus: organizerGpxData.xpOrganizingBonus,
            };
          }
        }

         // Fetch user's participation data for this ride - ADDED
         const [userParticipationData] = await db
         .select({
            id: rideParticipants.id,
            rideId: rideParticipants.rideId,
            userId: rideParticipants.userId,
            joinedAt: rideParticipants.joinedAt,
            xpJoiningBonus: rideParticipants.xpJoiningBonus, // ADDED
         })
         .from(rideParticipants)
         .where(
           and(
             eq(rideParticipants.rideId, ride.id),
             eq(rideParticipants.userId, userId)
           )
         )
         .limit(1);


        console.log(`User activity data for ride ${ride.id}:`, finalUserActivityData);
        console.log(`User participation data for ride ${ride.id}:`, userParticipationData);

        const result = {
          // Include all properties from the base Ride type from the select query result
          id: ride.id,
          name: ride.name,
          description: ride.description,
          dateTime: ride.dateTime,
          rideType: ride.rideType,
          surfaceType: ride.surfaceType,
          gpxFilePath: ride.gpxFilePath,
          meetupLocation: ride.meetupLocation,
          meetupCoords: ride.meetupCoords as { lat: number; lng: number }, // Explicitly cast
          organizerId: ride.organizerId,
          isCompleted: ride.isCompleted,
          completedAt: ride.completedAt!, // Use non-null assertion as these are completed rides
          createdAt: ride.createdAt,
          weatherData: ride.weatherData as any, // Explicitly cast weatherData
          // Add the additional properties expected in the interface
          organizerName: ride.organizerName || 'Unknown',
          participantCount: Number(ride.participantCount), // Ensure number type
          userActivityData: finalUserActivityData, // Include the fetched/converted activity data
          userParticipationData: userParticipationData, // Include the fetched participation data - ADDED
        };
        console.log(`Final ride object for ride ${ride.id}:`, JSON.stringify(result, null, 2));
        
        return result;
      })
    );

    // Get solo activities
    const soloActivities = await this.getUserSoloActivities(userId);

    return {
      completedRides: ridesWithUserData,
      soloActivities,
    };
  }

  // Organizer GPX operations
  async createOrganizerGpx(gpxFile: InsertOrganizerGpxFile): Promise<OrganizerGpxFile> {
    const [newGpx] = await db
      .insert(organizerGpxFiles)
      .values(gpxFile)
      .returning();
    return newGpx;
  }

  async getOrganizerGpx(rideId: number): Promise<OrganizerGpxFile | undefined> {
    const [gpx] = await db
      .select()
      .from(organizerGpxFiles)
      .where(eq(organizerGpxFiles.rideId, rideId))
      .limit(1);
    return gpx || undefined;
  }

  async getOrganizerGpxById(id: number): Promise<OrganizerGpxFile | undefined> {
    const [gpx] = await db
      .select()
      .from(organizerGpxFiles)
      .where(eq(organizerGpxFiles.id, id))
      .limit(1);
    return gpx || undefined;
  }

  async linkOrganizerGpx(rideId: number, gpxId: number, isManual: boolean): Promise<void> {
    await db
      .update(organizerGpxFiles)
      .set({ 
        rideId,
        isManuallyLinked: isManual,
        linkedAt: new Date()
      })
      .where(eq(organizerGpxFiles.id, gpxId));
  }

  async updateOrganizerGpx(id: number, updates: Partial<OrganizerGpxFile>): Promise<void> {
    await db
      .update(organizerGpxFiles)
      .set(updates)
      .where(eq(organizerGpxFiles.id, id));
  }

  // Participant proximity matching operations
  async createParticipantMatch(match: InsertParticipantMatch): Promise<ParticipantMatch> {
    const [newMatch] = await db
      .insert(participantMatches)
      .values(match)
      .returning();
    return newMatch;
  }

  async getParticipantMatches(rideId: number): Promise<ParticipantMatch[]> {
    return await db
      .select()
      .from(participantMatches)
      .where(eq(participantMatches.rideId, rideId))
      .orderBy(desc(participantMatches.matchedAt));
  }

  async getParticipantMatch(rideId: number, participantId: number): Promise<ParticipantMatch | undefined> {
    const [match] = await db
      .select()
      .from(participantMatches)
      .where(
        and(
          eq(participantMatches.rideId, rideId),
          eq(participantMatches.participantId, participantId)
        )
      )
      .limit(1);
    return match || undefined;
  }

  async updateParticipantMatch(id: number, updates: Partial<ParticipantMatch>): Promise<void> {
    await db
      .update(participantMatches)
      .set(updates)
      .where(eq(participantMatches.id, id));
  }

  // Advanced matching operations
  async getOrganizerPlannedRides(organizerId: number, dateFilter?: Date): Promise<Array<Ride & { organizerName: string }>> {
    let query = db
      .select({
        id: rides.id,
        name: rides.name,
        description: rides.description,
        dateTime: rides.dateTime,
        rideType: rides.rideType,
        surfaceType: rides.surfaceType,
        gpxFilePath: rides.gpxFilePath,
        meetupLocation: rides.meetupLocation,
        meetupCoords: rides.meetupCoords,
        organizerId: rides.organizerId,
        isCompleted: rides.isCompleted,
        completedAt: rides.completedAt,
        createdAt: rides.createdAt,
        weatherData: rides.weatherData,
        organizerName: users.name,
      })
      .from(rides)
      .leftJoin(users, eq(rides.organizerId, users.id))
      .where(eq(rides.organizerId, organizerId));

    if (dateFilter) {
      const startOfDay = new Date(dateFilter);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateFilter);
      endOfDay.setHours(23, 59, 59, 999);
      
      query = query.where(
        and(
          eq(rides.organizerId, organizerId),
          sql`${rides.dateTime} >= ${startOfDay}`,
          sql`${rides.dateTime} <= ${endOfDay}`
        )
      );
    }

    const results = await query.orderBy(asc(rides.dateTime));
    
    return results.map(row => ({
      ...row,
      organizerName: row.organizerName || 'Unknown',
    }));
  }

  async getRideParticipantIds(rideId: number): Promise<number[]> {
    const participants = await db
      .select({ userId: rideParticipants.userId })
      .from(rideParticipants)
      .where(eq(rideParticipants.rideId, rideId));
    
    return participants.map(p => p.userId);
  }

  async getPendingParticipantGpxFiles(rideId: number, participantIds: number[]): Promise<Array<{
    userId: number;
    gpxFilePath: string;
    activityDate: Date;
  }>> {
    // Get solo activities from participants that might match this ride
    const activities = await db
      .select({
        userId: soloActivities.userId,
        gpxFilePath: soloActivities.gpxFilePath,
        activityDate: soloActivities.completedAt,
      })
      .from(soloActivities)
      .where(sql`${soloActivities.userId} = ANY(${participantIds})`);
    
    return activities;
  }

  async getOrganizerGpxForRide(rideId: number): Promise<OrganizerGpxFile | undefined> {
    const [organizerGpx] = await db
      .select()
      .from(organizerGpxFiles)
      .where(eq(organizerGpxFiles.rideId, rideId))
      .limit(1);
    
    return organizerGpx;
  }

  async decrementUserXP(userId: number, amount: number): Promise<void> {
    if (amount <= 0) {
        console.warn(`Attempted to decrement XP by a non-positive amount for user ${userId}: ${amount}`);
        return; // Do not process non-positive XP amounts
    }
    // Ensure XP does not go below zero
    await db
      .update(users)
      .set({
        xp: sql`CASE WHEN ${users.xp} - ${amount} > 0 THEN ${users.xp} - ${amount} ELSE 0 END`,
      })
      .where(eq(users.id, userId));
      
    console.log(`Decremented user ${userId} XP by ${amount}.`);
  }
}

export const storage = new DatabaseStorage();
