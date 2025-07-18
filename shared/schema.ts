import { pgTable, text, serial, integer, boolean, timestamp, real, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
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
});

export const rideParticipants = pgTable("ride_participants", {
  id: serial("id").primaryKey(),
  rideId: integer("ride_id").references(() => rides.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  organizedRides: many(rides),
  rideParticipations: many(rideParticipants),
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type InsertRide = z.infer<typeof insertRideSchema>;
export type RideFilters = z.infer<typeof rideFiltersSchema>;
export type User = typeof users.$inferSelect;
export type Ride = typeof rides.$inferSelect;
export type RideParticipant = typeof rideParticipants.$inferSelect;
