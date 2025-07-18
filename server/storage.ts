import { users, rides, rideParticipants, follows, type User, type InsertUser, type Ride, type InsertRide, type RideParticipant, type RideFilters, type Follow } from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, asc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
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
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
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

  async createRide(rideData: InsertRide & { organizerId: number, gpxFilePath: string }): Promise<Ride> {
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
    totalDistance: number;
    totalElevation: number;
    ridesJoinedChange: number;
    ridesHostedChange: number;
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

    // Get current period stats (count all rides in the period, not just completed ones)
    const currentStats = await db
      .select({
        ridesJoined: sql<number>`COUNT(DISTINCT CASE WHEN ${rides.organizerId} != ${userId} AND ${rideParticipants.userId} = ${userId} THEN ${rides.id} END)`,
        ridesHosted: sql<number>`COUNT(DISTINCT CASE WHEN ${rides.organizerId} = ${userId} THEN ${rides.id} END)`,
        totalDistance: sql<number>`0`, // Will be calculated with GPX data
        totalElevation: sql<number>`0`, // Will be calculated with GPX data
      })
      .from(rides)
      .leftJoin(rideParticipants, eq(rides.id, rideParticipants.rideId))
      .where(
        and(
          sql`${rides.createdAt} >= ${startDate}`,
          sql`${rides.createdAt} <= ${now}`,
          sql`(${rides.organizerId} = ${userId} OR ${rideParticipants.userId} = ${userId})`
        )
      );

    // Get previous period stats for comparison
    const previousStats = await db
      .select({
        ridesJoined: sql<number>`COUNT(DISTINCT CASE WHEN ${rides.organizerId} != ${userId} AND ${rideParticipants.userId} = ${userId} THEN ${rides.id} END)`,
        ridesHosted: sql<number>`COUNT(DISTINCT CASE WHEN ${rides.organizerId} = ${userId} THEN ${rides.id} END)`,
        totalDistance: sql<number>`0`,
        totalElevation: sql<number>`0`,
      })
      .from(rides)
      .leftJoin(rideParticipants, eq(rides.id, rideParticipants.rideId))
      .where(
        and(
          sql`${rides.createdAt} >= ${previousStartDate}`,
          sql`${rides.createdAt} < ${startDate}`,
          sql`(${rides.organizerId} = ${userId} OR ${rideParticipants.userId} = ${userId})`
        )
      );

    const current = currentStats[0] || { ridesJoined: 0, ridesHosted: 0, totalDistance: 0, totalElevation: 0 };
    const previous = previousStats[0] || { ridesJoined: 0, ridesHosted: 0, totalDistance: 0, totalElevation: 0 };

    // Get follower/following counts
    const followersCount = await this.getFollowerCount(userId);
    const followingCount = await this.getFollowingCount(userId);

    return {
      ridesJoined: Number(current.ridesJoined),
      ridesHosted: Number(current.ridesHosted),
      totalDistance: Number(current.totalDistance),
      totalElevation: Number(current.totalElevation),
      ridesJoinedChange: Number(current.ridesJoined) - Number(previous.ridesJoined),
      ridesHostedChange: Number(current.ridesHosted) - Number(previous.ridesHosted),
      totalDistanceChange: Number(current.totalDistance) - Number(previous.totalDistance),
      totalElevationChange: Number(current.totalElevation) - Number(previous.totalElevation),
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
    const ridersQuery = db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        password: users.password,
        name: users.name,
        createdAt: users.createdAt,
        followersCount: sql<number>`count(distinct f1.${follows.followerId})`,
        completedRides: sql<number>`count(distinct case when ${rides.isCompleted} = true and ${rideParticipants.userId} = ${users.id} then ${rides.id} end)`,
        hostedRides: sql<number>`count(distinct case when ${rides.organizerId} = ${users.id} then ${rides.id} end)`,
        isFollowing: sql<boolean>`exists(select 1 from ${follows} f2 where f2.${follows.followerId} = ${currentUserId} and f2.${follows.followingId} = ${users.id})`
      })
      .from(users)
      .leftJoin(sql`${follows} as f1`, sql`f1.${follows.followingId} = ${users.id}`)
      .leftJoin(rides, eq(rides.organizerId, users.id))
      .leftJoin(rideParticipants, eq(rideParticipants.userId, users.id))
      .where(sql`${users.id} != ${currentUserId}`)
      .groupBy(users.id)
      .orderBy(desc(sql`count(distinct f1.${follows.followerId})`));

    const riders = await ridersQuery;
    return riders;
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
    const followersQuery = db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        password: users.password,
        name: users.name,
        createdAt: users.createdAt,
        followersCount: sql<number>`count(distinct f2.${follows.followerId})`,
        completedRides: sql<number>`count(distinct case when ${rides.isCompleted} = true and ${rideParticipants.userId} = ${users.id} then ${rides.id} end)`,
        hostedRides: sql<number>`count(distinct case when ${rides.organizerId} = ${users.id} then ${rides.id} end)`
      })
      .from(users)
      .innerJoin(follows, eq(follows.followerId, users.id))
      .leftJoin(sql`${follows} as f2`, sql`f2.${follows.followingId} = ${users.id}`)
      .leftJoin(rides, eq(rides.organizerId, users.id))
      .leftJoin(rideParticipants, eq(rideParticipants.userId, users.id))
      .where(eq(follows.followingId, userId))
      .groupBy(users.id);

    const followers = await followersQuery;
    return followers;
  }

  async getFollowing(userId: number): Promise<Array<User & { followersCount: number; completedRides: number; hostedRides: number }>> {
    const followingQuery = db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        password: users.password,
        name: users.name,
        createdAt: users.createdAt,
        followersCount: sql<number>`count(distinct f2.${follows.followerId})`,
        completedRides: sql<number>`count(distinct case when ${rides.isCompleted} = true and ${rideParticipants.userId} = ${users.id} then ${rides.id} end)`,
        hostedRides: sql<number>`count(distinct case when ${rides.organizerId} = ${users.id} then ${rides.id} end)`
      })
      .from(users)
      .innerJoin(follows, eq(follows.followingId, users.id))
      .leftJoin(sql`${follows} as f2`, sql`f2.${follows.followingId} = ${users.id}`)
      .leftJoin(rides, eq(rides.organizerId, users.id))
      .leftJoin(rideParticipants, eq(rideParticipants.userId, users.id))
      .where(eq(follows.followerId, userId))
      .groupBy(users.id);

    const following = await followingQuery;
    return following;
  }
}

export const storage = new DatabaseStorage();
