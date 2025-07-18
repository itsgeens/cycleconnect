import { z } from "zod";

// Device connection schemas
export const deviceConnectionSchema = z.object({
  deviceId: z.string(),
  deviceName: z.string(),
  deviceType: z.enum(["cycling_computer", "smartwatch", "phone"]),
  protocol: z.enum(["ble", "ant_plus"]),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  batteryLevel: z.number().min(0).max(100).optional(),
  lastSeen: z.date().optional(),
});

export const gpxDataSchema = z.object({
  trackPoints: z.array(z.object({
    latitude: z.number(),
    longitude: z.number(),
    elevation: z.number().optional(),
    timestamp: z.date(),
    speed: z.number().optional(),
    heartRate: z.number().optional(),
    cadence: z.number().optional(),
    power: z.number().optional(),
  })),
  startTime: z.date(),
  endTime: z.date(),
  totalDistance: z.number(),
  totalElevation: z.number(),
  averageSpeed: z.number(),
  maxSpeed: z.number().optional(),
});

export const activityMatchSchema = z.object({
  id: z.number(),
  rideId: z.number(),
  userId: z.number(),
  deviceId: z.string(),
  uploadedGpxData: gpxDataSchema,
  routeMatchPercentage: z.number().min(0).max(100),
  timeWindowMatch: z.boolean(),
  isAutoCompleted: z.boolean(),
  createdAt: z.date(),
  processedAt: z.date().optional(),
});

export const routeMatchingConfigSchema = z.object({
  similarityThreshold: z.number().min(0).max(100).default(85),
  timeWindowMinutes: z.number().default(60),
  minimumTrackPoints: z.number().default(50),
  maxDistanceDeviation: z.number().default(100), // meters
});

export type DeviceConnection = z.infer<typeof deviceConnectionSchema>;
export type GpxData = z.infer<typeof gpxDataSchema>;
export type ActivityMatch = z.infer<typeof activityMatchSchema>;
export type RouteMatchingConfig = z.infer<typeof routeMatchingConfigSchema>;