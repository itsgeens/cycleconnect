import { users, rides, rideParticipants, follows, deviceConnections, activityMatches, soloActivities, type User, type InsertUser, type Ride, type InsertRide, type RideParticipant, type RideFilters, type Follow, type DeviceConnection, type InsertDeviceConnection, type ActivityMatch, type InsertActivityMatch, type SoloActivity, type InsertSoloActivity } from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, asc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>; // Add alias for consistency
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Ride operations
  createRide(ride: InsertRide & { organizerId: number, gpxFilePath: string }): Promise<Ride>;
  getRides(filters?: RideFilters): Promise<Array<Ride & { organizerName: string; participantCount: number }>>;
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

  // Solo activities operations
  createSoloActivity(activity: InsertSoloActivity): Promise<SoloActivity>;
  getSoloActivity(id: number): Promise<SoloActivity | undefined>;
  deleteSoloActivity(id: number): Promise<void>;
  getUserSoloActivities(userId: number): Promise<SoloActivity[]>;
  getUserCompletedActivities(userId: number): Promise<{
    completedRides: Array<Ride & { organizerName: string; participantCount: number; completedAt: Date }>;
    soloActivities: SoloActivity[];
  }>;
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

  async deleteRide(id: number): Promise<void> {
    await db.delete(rides).where(eq(rides.id, id));
  }

  async getRides(filters?: RideFilters): Promise<Array<Ride & { organizerName: string; participantCount: number; participants?: Array<{ id: number; name: string }> }>> {
    // Build the conditions array
    const conditions = [sql`${rides.dateTime} >= NOW()`];
    
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
        gpxFilePath: rides.gpxFilePath,
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

    // Get participants for each ride
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

        return {
          ...ride,
          organizerName: ride.organizerName || 'Unknown',
          participantCount: Number(ride.participantCount),
          participants,
        };
      })
    );

    return ridesWithParticipants;
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
    await db.transaction(async (tx) => {
      // First delete all participants
      await tx.delete(rideParticipants).where(eq(rideParticipants.rideId, rideId));
      
      // Then delete the ride
      await tx.delete(rides).where(eq(rides.id, rideId));
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
      ...ride,
      organizerName: ride.organizerName || 'Unknown',
      participantCount: Number(ride.participantCount),
      isOrganizer: ride.organizerId === userId,
      isParticipant: ride.organizerId !== userId,
    }));

    return {
      all,
      organized: organized.map(ride => ({
        ...ride,
        organizerName: ride.organizerName || 'Unknown',
        participantCount: Number(ride.participantCount),
      })),
      joined: joined.map(ride => ({
        ...ride,
        organizerName: ride.organizerName || 'Unknown',
        participantCount: Number(ride.participantCount),
      })),
    };
  }

  async completeRide(rideId: number, userId: number): Promise<void> {
    // Check if user is the organizer
    const [ride] = await db.select().from(rides).where(eq(rides.id, rideId));
    if (!ride || ride.organizerId !== userId) {
      throw new Error("Only the organizer can complete a ride");
    }

    // Check if ride date has passed
    if (new Date(ride.dateTime) > new Date()) {
      throw new Error("Cannot complete a ride before its scheduled time");
    }

    await db
      .update(rides)
      .set({ 
        isCompleted: true, 
        completedAt: new Date() 
      })
      .where(eq(rides.id, rideId));
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
        totalDistance: sql<number>`SUM(CASE 
          WHEN ${activityMatches.userId} = ${userId} 
          AND ${activityMatches.distance} IS NOT NULL 
          THEN CAST(${activityMatches.distance} AS DECIMAL) 
          ELSE 0 
          END)`,
        totalElevation: sql<number>`SUM(CASE 
          WHEN ${activityMatches.userId} = ${userId} 
          AND ${activityMatches.elevationGain} IS NOT NULL 
          THEN CAST(${activityMatches.elevationGain} AS DECIMAL) 
          ELSE 0 
          END)`,
      })
      .from(rides)
      .leftJoin(rideParticipants, eq(rides.id, rideParticipants.rideId))
      .leftJoin(activityMatches, and(
        eq(rides.id, activityMatches.rideId),
        eq(activityMatches.userId, userId)
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
        totalDistance: sql<number>`SUM(CASE 
          WHEN ${activityMatches.userId} = ${userId} 
          AND ${activityMatches.distance} IS NOT NULL 
          THEN CAST(${activityMatches.distance} AS DECIMAL) 
          ELSE 0 
          END)`,
        totalElevation: sql<number>`SUM(CASE 
          WHEN ${activityMatches.userId} = ${userId} 
          AND ${activityMatches.elevationGain} IS NOT NULL 
          THEN CAST(${activityMatches.elevationGain} AS DECIMAL) 
          ELSE 0 
          END)`,
      })
      .from(rides)
      .leftJoin(rideParticipants, eq(rides.id, rideParticipants.rideId))
      .leftJoin(activityMatches, and(
        eq(rides.id, activityMatches.rideId),
        eq(activityMatches.userId, userId)
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

    // Get stats for each user
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

    // Sort by followers count descending
    return ridersWithStats.sort((a, b) => b.followersCount - a.followersCount);
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
    const [newActivity] = await db
      .insert(soloActivities)
      .values(activity)
      .returning();
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
    await db.delete(soloActivities).where(eq(soloActivities.id, id));
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
        const [userActivityData] = await db
          .select()
          .from(activityMatches)
          .where(
            and(
              eq(activityMatches.rideId, ride.id),
              eq(activityMatches.userId, userId)
            )
          )
          .limit(1);

        console.log(`User activity data for ride ${ride.id}:`, userActivityData);

        const result = {
          ...ride,
          userActivityData,
        };
        
        console.log(`Final ride object for ride ${ride.id}:`, JSON.stringify(result, null, 2));
        
        return result;
      })
    );

    // Get solo activities
    const soloActivities = await this.getUserSoloActivities(userId);

    return {
      completedRides: ridesWithUserData as any[],
      soloActivities,
    };
  }
}

export const storage = new DatabaseStorage();
