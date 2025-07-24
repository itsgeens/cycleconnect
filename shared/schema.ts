import { pgTable, text, serial, integer, boolean, timestamp, real, jsonb, varchar, decimal, json, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  xp: integer("xp").default(0).notNull(), // Added XP column here
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rides = pgTable("rides", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  dateTime: timestamp("date_time").notNull(),
  rideType: text("ride_type").notNull(), // coffee, casual, threshold, zone2
  surfaceType: text("surface_type").notNull(), // paved, gravel, mixed
  gpxFilePath: text("gpx_file_path").notNull(),
  meetupLocation: text("meetup_location").notNull(),
  meetupCoords: jsonb("meetup_coords").notNull(), // {lat: number, lng: number}
  organizerId: integer("organizer_id").references(() => users.id).notNull(),
  isCompleted: boolean("is_completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  weatherData: jsonb("weather_data"), // Weather forecast data for the ride
});

export const rideParticipants = pgTable("ride_participants", {
  id: serial("id").primaryKey(),
  rideId: integer("ride_id").references(() => rides.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  xpJoiningBonus: integer("xp_joining_bonus").default(0),
});

export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").references(() => users.id).notNull(),
  followingId: integer("following_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const soloActivities = pgTable("solo_activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  activityType: text("activity_type").notNull(), // cycling, running, etc.
  gpxFilePath: text("gpx_file_path").notNull(),
  distance: decimal("distance", { precision: 10, scale: 2 }), // in kilometers
  duration: integer("duration"), // total elapsed time in seconds
  movingTime: integer("moving_time"), // active time (excluding stops) in seconds
  elevationGain: decimal("elevation_gain", { precision: 10, scale: 2 }), // in meters
  averageSpeed: decimal("average_speed", { precision: 10, scale: 2 }), // km/h
  averageHeartRate: integer("average_heart_rate"), // bpm
  maxHeartRate: integer("max_heart_rate"), // bpm
  calories: integer("calories"),
  deviceName: text("device_name"),
  deviceType: text("device_type"), // cycling_computer, smartwatch, phone
  completedAt: timestamp("completed_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  xpEarned: integer("xp_earned").default(0).notNull(), // Added XP column
  xpDistance: integer("xp_distance").default(0), // Added XP from distance
  xpElevation: integer("xp_elevation").default(0), // Added XP from elevation
  xpSpeed: integer("xp_speed").default(0), // Added XP from speed
});

// Table for organizer GPX files linked to planned rides
export const organizerGpxFiles = pgTable("organizer_gpx_files", {
  id: serial("id").primaryKey(),
  rideId: integer("ride_id").references(() => rides.id).notNull().unique(), // One GPX per ride
  organizerId: integer("organizer_id").references(() => users.id).notNull(),
  gpxFilePath: text("gpx_file_path").notNull(),
  originalGpxPath: text("original_gpx_path"), // Backup of original planned route
  matchScore: decimal("match_score", { precision: 5, scale: 2 }), // Auto-match confidence score
  isManuallyLinked: boolean("is_manually_linked").default(false), // Manual override flag
  distance: decimal("distance", { precision: 10, scale: 2 }),
  duration: integer("duration"),
  movingTime: integer("moving_time"),
  elevationGain: decimal("elevation_gain", { precision: 10, scale: 2 }),
  averageSpeed: decimal("average_speed", { precision: 10, scale: 2 }),
  averageHeartRate: integer("average_heart_rate"),
  maxHeartRate: integer("max_heart_rate"),
  calories: integer("calories"),
  linkedAt: timestamp("linked_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  xpEarned: integer("xp_earned").default(0),
  xpDistance: integer("xp_distance").default(0), // Added XP from distance
  xpElevation: integer("xp_elevation").default(0), // Added XP from elevation
  xpSpeed: integer("xp_speed").default(0), // Added XP from speed
  xpOrganizingBonus: integer("xp_organizing_bonus").default(0), // Added organizing bonus XP
});

// Table for participant proximity matches to organizer's actual ride
export const participantMatches = pgTable("participant_matches", {
  id: serial("id").primaryKey(),
  rideId: integer("ride_id").references(() => rides.id).notNull(),
  participantId: integer("participant_id").references(() => users.id).notNull(),
  organizerGpxId: integer("organizer_gpx_id").references(() => organizerGpxFiles.id).notNull(),
  participantGpxPath: text("participant_gpx_path").notNull(),
  proximityScore: decimal("proximity_score", { precision: 5, scale: 2 }), // % time near organizer
  matchedPoints: integer("matched_points"), // Number of points within proximity
  totalOrganizerPoints: integer("total_organizer_points"), // Total organizer track points
  isCompleted: boolean("is_completed").default(false), // Met 80% threshold
  distance: decimal("distance", { precision: 10, scale: 2 }),
  duration: integer("duration"),
  movingTime: integer("moving_time"),
  elevationGain: decimal("elevation_gain", { precision: 10, scale: 2 }),
  averageSpeed: decimal("average_speed", { precision: 10, scale: 2 }),
  averageHeartRate: integer("average_heart_rate"),
  maxHeartRate: integer("max_heart_rate"),
  calories: integer("calories"),
  matchedAt: timestamp("matched_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, table => ({
  // Ensure one match record per participant per ride
  participantRideUnique: unique().on(table.rideId, table.participantId),
}));

export const usersRelations = relations(users, ({ many }) => ({
  organizedRides: many(rides),
  rideParticipations: many(rideParticipants),
  following: many(follows, { relationName: "follower" }),
  followers: many(follows, { relationName: "following" }),
  soloActivities: many(soloActivities),
}));

export const ridesRelations = relations(rides, ({ one, many }) => ({
  organizer: one(users, {
    fields: [rides.organizerId],
    references: [users.id],
  }),
  participants: many(rideParticipants),
}));

export const rideParticipantsRelations = relations(rideParticipants, ({ one }) => ({
  ride: one(rides, {
    fields: [rideParticipants.rideId],
    references: [rides.id],
  }),
  user: one(users, {
    fields: [rideParticipants.userId],
    references: [users.id],
  }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
    relationName: "follower",
  }),
  following: one(users, {
    fields: [follows.followingId],
    references: [users.id],
    relationName: "following",
  }),
}));

export const soloActivitiesRelations = relations(soloActivities, ({ one }) => ({
  user: one(users, {
    fields: [soloActivities.userId],
    references: [users.id],
  }),
}));

export const organizerGpxFilesRelations = relations(organizerGpxFiles, ({ one, many }) => ({
  ride: one(rides, {
    fields: [organizerGpxFiles.rideId],
    references: [rides.id],
  }),
  organizer: one(users, {
    fields: [organizerGpxFiles.organizerId],
    references: [users.id],
  }),
  participantMatches: many(participantMatches),
}));

export const participantMatchesRelations = relations(participantMatches, ({ one }) => ({
  ride: one(rides, {
    fields: [participantMatches.rideId],
    references: [rides.id],
  }),
  participant: one(users, {
    fields: [participantMatches.participantId],
    references: [users.id],
  }),
  organizerGpx: one(organizerGpxFiles, {
    fields: [participantMatches.organizerGpxId],
    references: [organizerGpxFiles.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  name: true,
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// Export new table types
export type OrganizerGpxFile = typeof organizerGpxFiles.$inferSelect;
export type InsertOrganizerGpxFile = typeof organizerGpxFiles.$inferInsert;
export type ParticipantMatch = typeof participantMatches.$inferSelect;
export type InsertParticipantMatch = typeof participantMatches.$inferInsert;

// Insert schemas for new tables
export const insertOrganizerGpxFileSchema = createInsertSchema(organizerGpxFiles).omit({
  id: true,
  linkedAt: true,
  createdAt: true,
});

export const insertParticipantMatchSchema = createInsertSchema(participantMatches).omit({
  id: true,
  matchedAt: true,
  createdAt: true,
});

// Manual link schema for API endpoint
export const linkGpxSchema = z.object({
  gpxId: z.string(),
});

export const insertRideSchema = createInsertSchema(rides).pick({
  name: true,
  description: true,
  dateTime: true,
  rideType: true,
  surfaceType: true,
  meetupLocation: true,
  meetupCoords: true,
}).extend({
  rideType: z.enum(["coffee", "casual", "threshold", "zone2"]),
  surfaceType: z.enum(["paved", "gravel", "mixed"]),
  meetupCoords: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
});

export const rideFiltersSchema = z.object({
  distance: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  rideType: z.enum(["coffee", "casual", "threshold", "zone2"]).optional(),
  surfaceType: z.enum(["paved", "gravel", "mixed"]).optional(),
  userLat: z.number().optional(),
  userLng: z.number().optional(),
});

export const insertSoloActivitySchema = createInsertSchema(soloActivities).pick({
  userId: true, 
  name: true,
  description: true,
  activityType: true,
  gpxFilePath: true,
  distance: true,
  duration: true,
  movingTime: true,
  elevationGain: true,
  averageSpeed: true,
  averageHeartRate: true,
  maxHeartRate: true,
  calories: true,
  deviceName: true,
  deviceType: true,
  completedAt: true,
  xpEarned: true,
}).extend({
  activityType: z.enum(["cycling", "running", "walking", "other"]),
  deviceType: z.enum(["cycling_computer", "smartwatch", "phone", "manual"]).optional(),
  completedAt: z.string().or(z.date()).transform((val) => typeof val === 'string' ? new Date(val) : val),
});

export type SoloActivity = typeof soloActivities.$inferSelect;
export type InsertSoloActivity = z.infer<typeof insertSoloActivitySchema>;

// Device connections table
export const deviceConnections = pgTable("device_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceId: varchar("device_id", { length: 255 }).notNull(),
  deviceName: varchar("device_name", { length: 255 }).notNull(),
  deviceType: varchar("device_type", { length: 50 }).notNull(), // cycling_computer, smartwatch, phone
  protocol: varchar("protocol", { length: 20 }).notNull(), // ble, ant_plus
  manufacturer: varchar("manufacturer", { length: 100 }),
  model: varchar("model", { length: 100 }),
  batteryLevel: integer("battery_level"),
  lastSeen: timestamp("last_seen"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserDevice: unique().on(table.userId, table.deviceId),
}));

// Activity matches table for automatic ride completion
export const activityMatches = pgTable("activity_matches", {
  id: serial("id").primaryKey(),
  rideId: integer("ride_id").notNull().references(() => rides.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceId: varchar("device_id", { length: 255 }).notNull(),
  routeMatchPercentage: decimal("route_match_percentage", { precision: 5, scale: 2 }).notNull(),
  gpxFilePath: text("gpx_file_path").notNull(),
  distance: decimal("distance", { precision: 10, scale: 2 }),
  duration: integer("duration"),
  movingTime: integer("moving_time"),
  elevationGain: decimal("elevation_gain", { precision: 10, scale: 2 }),
  averageSpeed: decimal("average_speed", { precision: 10, scale: 2 }),
  averageHeartRate: integer("average_heart_rate"),
  maxHeartRate: integer("max_heart_rate"),
  calories: integer("calories"),
  completedAt: timestamp("completed_at").notNull(),
  matchedAt: timestamp("matched_at").defaultNow().notNull(),
  xpEarned: integer("xp_earned").default(0),
  xpDistance: integer("xp_distance").default(0), // Added XP from distance
  xpElevation: integer("xp_elevation").default(0), // Added XP from elevation
  xpSpeed: integer("xp_speed").default(0), // Added XP from speed
  xpOrganizingBonus: integer("xp_organizing_bonus").default(0), // Added organizing bonus XP")
}, (table) => ({
  uniqueUserRide: unique().on(table.rideId, table.userId),
  uniqueUserDevice: unique().on(table.userId, table.deviceId),
}));

// Zod schemas for device connections
export const insertDeviceConnectionSchema = createInsertSchema(deviceConnections).omit({
  id: true,
  createdAt: true,
});

export const insertActivityMatchSchema = createInsertSchema(activityMatches).omit({
  id: true,
  matchedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type InsertRide = z.infer<typeof insertRideSchema>;
export type RideFilters = z.infer<typeof rideFiltersSchema>;
export type User = typeof users.$inferSelect;
export type Ride = typeof rides.$inferSelect;
export type RideParticipant = typeof rideParticipants.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type DeviceConnection = typeof deviceConnections.$inferSelect;
export type InsertDeviceConnection = z.infer<typeof insertDeviceConnectionSchema>;
export type ActivityMatch = typeof activityMatches.$inferSelect;
export type InsertActivityMatch = z.infer<typeof insertActivityMatchSchema>;
