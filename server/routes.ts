import type { Express, Request } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { rideParticipants, insertUserSchema, loginSchema, insertRideSchema, rideFiltersSchema, insertSoloActivitySchema, insertOrganizerGpxFileSchema, linkGpxSchema } from "@shared/schema";
import { ZodError } from "zod";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { parseGPXFile, calculateRouteMatch } from "./gpx-parser";
import { WeatherService } from "./weather";
import { GPXProximityMatcher } from "./gpx-proximity-matcher";
import fetch from 'node-fetch'; // Import fetch if not already imported
import { db } from "./db";
import { eq, and, sql, desc, asc } from "drizzle-orm";

// Extend Request type to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure multer for GPX file uploads
import { supabase } from './supabase';
import { StorageEngine } from 'multer';
import { File } from 'buffer';

class SupabaseStorage implements StorageEngine {
  _handleFile(
    req: Request,
    file: Express.Multer.File,
    callback: (error?: any, info?: Partial<Express.Multer.File>) => void
  ): void {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${file.fieldname}-${uniqueSuffix}.${fileExtension}`;
    // MODIFIED: Removed the extra 'gpx-uploads/' prefix
    const filePath = fileName; 

    const fileStream = file.stream;
    const chunks: any[] = [];

    fileStream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    fileStream.on('end', async () => {
      const buffer = Buffer.concat(chunks);

      const { data, error } = await supabase.storage
        .from('gpx-uploads') // Replace 'gpx-uploads' with your Supabase bucket name
        .upload(filePath, buffer, {
          contentType: file.mimetype,
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return callback(error);
      }

      // Return the Supabase file path to be stored in the database
      callback(null, { path: filePath }); // This 'path' is the corrected relative path
    });

    fileStream.on('error', (err) => {
      console.error('File stream error:', err);
      callback(err);
    });
  }

  _removeFile(
    req: Request,
    file: Express.Multer.File,
    callback: (error: Error) => void
  ): void {
    const filePath = file.path; // This will be the Supabase storage path

    supabase.storage
      .from('gpx-uploads') // Replace 'gpx-uploads' with your Supabase bucket name
      .remove([filePath])
      .then(({ data, error }) => {
        if (error) {
          console.error('Supabase delete error:', error);
          return callback(error);
        }
        callback(null!);
      })
      .catch((err) => {
        console.error('Supabase delete promise error:', err);
        callback(err);
      });
  }
}

const supabaseStorage = new SupabaseStorage();

const upload = multer({
  storage: supabaseStorage, // Use the custom Supabase storage engine
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/gpx+xml' || file.originalname.endsWith('.gpx')) {
      cb(null, true);
    } else {
      cb(new Error('Only GPX files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});


// Initialize services
const proximityMatcher = new GPXProximityMatcher();

// Process participant proximity matching
async function processParticipantMatching(rideId: number, organizerGpxId: number, organizerGpxPath: string) {
  try {
    console.log(`Processing participant proximity matching for ride ${rideId}`);
    // This would analyze participant GPX files against organizer's actual route
    // Implementation depends on specific requirements for retroactive matching
  } catch (error) {
    console.error('Error processing participant matching:', error);
  }
}

// Simple session management
const sessions = new Map<string, { userId: number; expires: Date }>();

function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function cleanupExpiredSessions() {
  const now = new Date();
  for (const [sessionId, session] of Array.from(sessions.entries())) {
    if (session.expires < now) {
      sessions.delete(sessionId);
    }
  }
}

function requireAuth(req: any, res: any, next: any) {
  const sessionId = req.headers.authorization?.replace("Bearer ", "");
  if (!sessionId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const session = sessions.get(sessionId);
  if (!session || session.expires < new Date()) {
    sessions.delete(sessionId);
    return res.status(401).json({ message: "Session expired" });
  }

  req.userId = session.userId;
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Clean up expired sessions every hour
  setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

  // Serve static files from uploads directory
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
  // Serve GPX files for map preview
  app.get('/api/gpx/:filename', async (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = filename;
  
      console.log(`Attempting to generate signed URL for: ${filePath}`);
  
      // Generate a signed URL for the file
      const { data, error } = await supabase.storage
        .from('gpx-uploads') // Replace 'gpx-uploads' with your Supabase bucket name
        .createSignedUrl(filePath, 60 * 60); // URL expires in 1 hour
  
      if (error) {
        console.error('Supabase create signed URL error:', error.message);
        return res.status(500).json({ message: 'Failed to generate GPX file URL', error: error.message });
      }
  
      console.log(`Successfully generated signed URL: ${data.signedUrl}`);
  
      // Fetch the GPX content from the signed URL
      const response = await fetch(data.signedUrl);
  
      if (!response.ok) {
        console.error('Failed to fetch GPX from signed URL:', response.statusText);
        return res.status(response.status).json({ message: 'Failed to fetch GPX file', error: response.statusText });
      }
  
      const gpxContent = await response.text();
  
      // Set CORS headers
      res.set('Access-Control-Allow-Origin', '*'); // Or your frontend's specific origin
      res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      res.set('Content-Type', 'application/gpx+xml'); // Set the correct content type
  
      // Send the GPX content to the frontend
      res.send(gpxContent);
  
    } catch (error: any) {
      console.error('GPX file serving error:', error.message);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });
  
  // Auth routes
  app.post("/api/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      // Create session
      const sessionId = generateSessionId();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      sessions.set(sessionId, { userId: user.id, expires });

      res.json({
        user: { id: user.id, username: user.username, name: user.name, email: user.email },
        sessionId,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Create session
      const sessionId = generateSessionId();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      sessions.set(sessionId, { userId: user.id, expires });

      res.json({
        user: { id: user.id, username: user.username, name: user.name, email: user.email },
        sessionId,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/logout", requireAuth, (req, res) => {
    const sessionId = req.headers.authorization?.replace("Bearer ", "");
    if (sessionId) {
      sessions.delete(sessionId);
    }
    res.json({ message: "Logged out successfully" });
  });

  app.get("/api/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ id: user.id, username: user.username, name: user.name, email: user.email });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Weather routes
  app.get("/api/weather/current", async (req, res) => {
    try {
      const { lat, lon } = req.query;
      
      if (!lat || !lon) {
        return res.status(400).json({ message: "Latitude and longitude are required" });
      }

      const weather = await WeatherService.getCurrentWeather(
        parseFloat(lat as string),
        parseFloat(lon as string)
      );

      const cyclingAssessment = WeatherService.isGoodCyclingWeather(weather);

      res.json({
        weather,
        cyclingAssessment,
      });
    } catch (error) {
      console.error("Get current weather error:", error);
      res.status(500).json({ message: "Failed to fetch weather data" });
    }
  });

  app.get("/api/weather/forecast", async (req, res) => {
    try {
      const { lat, lon } = req.query;
      
      if (!lat || !lon) {
        return res.status(400).json({ message: "Latitude and longitude are required" });
      }

      const forecast = await WeatherService.getWeatherForecast(
        parseFloat(lat as string),
        parseFloat(lon as string)
      );

      // Add cycling assessment for each forecast period
      const forecastWithAssessment = {
        current: {
          ...forecast.current,
          cyclingAssessment: WeatherService.isGoodCyclingWeather(forecast.current),
        },
        hourly: forecast.hourly.map(hour => ({
          ...hour,
          cyclingAssessment: WeatherService.isGoodCyclingWeather(hour),
        })),
        daily: forecast.daily.map(day => ({
          ...day,
          cyclingAssessment: WeatherService.isGoodCyclingWeather(day),
        })),
      };

      res.json(forecastWithAssessment);
    } catch (error) {
      console.error("Get weather forecast error:", error);
      res.status(500).json({ message: "Failed to fetch weather forecast" });
    }
  });

  // Ride routes
  app.post("/api/rides", requireAuth, upload.single("gpxFile"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "GPX file is required" });
      }

      const rideData = insertRideSchema.parse({
        ...req.body,
        dateTime: new Date(req.body.dateTime),
        meetupCoords: JSON.parse(req.body.meetupCoords),
      });

      // Fetch weather forecast for the ride
      let weatherData = null;
      try {
        const coords = JSON.parse(req.body.meetupCoords);
        const forecast = await WeatherService.getWeatherForecast(coords.lat, coords.lng);
        
        // Find the closest weather forecast to the ride time
        const rideTime = new Date(req.body.dateTime);
        const closestForecast = forecast.hourly.find(hour => {
          const forecastTime = new Date(hour.timestamp);
          return Math.abs(forecastTime.getTime() - rideTime.getTime()) < 3 * 60 * 60 * 1000; // Within 3 hours
        }) || forecast.current;

        weatherData = {
          ...closestForecast,
          cyclingAssessment: WeatherService.isGoodCyclingWeather(closestForecast),
        };
      } catch (weatherError) {
        console.warn("Failed to fetch weather data for ride:", weatherError);
      }

      const ride = await storage.createRide({
        ...rideData,
        organizerId: req.userId!,
        gpxFilePath: req.file.path,
        weatherData,
      });

      res.json(ride);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Create ride error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/rides", async (req, res) => {
    try {
      const filters = rideFiltersSchema.parse(req.query);
      const rides = await storage.getRides(filters);
      res.json(rides);
    } catch (error) {
      console.error("Get rides error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/rides/:id", async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
      // If user is authenticated, include their activity data and following status for participants
      const sessionId = req.headers.authorization?.replace("Bearer ", "");
      if (sessionId) {
        const session = sessions.get(sessionId);
        if (session && session.expires > new Date()) {
          const userId = session.userId;
          
          // Get user's activity data for this ride
          const userActivityData = await storage.getUserActivityForRide(rideId, userId);
          
           // **Fetch user's participation data for this ride - ADDED**
           const [userParticipationData] = await db
           .select({ // Select the specific fields needed for userParticipationData
               id: rideParticipants.id,
               rideId: rideParticipants.rideId,
               userId: rideParticipants.userId,
               joinedAt: rideParticipants.joinedAt,
               xpJoiningBonus: rideParticipants.xpJoiningBonus,
           })
           .from(rideParticipants)
           .where(and(eq(rideParticipants.rideId, rideId), eq(rideParticipants.userId, userId)))
           .limit(1);

          // Get organizer's actual GPX file if available
          const organizerGpx = await storage.getOrganizerGpx(rideId);
          
          // Add following status to participants
          const participantsWithFollowStatus = await Promise.all(
            (ride.participants || []).map(async (participant) => {
              const isFollowing = await storage.isFollowing(userId, participant.id);
              return {
                ...participant,
                isFollowing,
              };
            })
          );
          
          res.json({
            ...ride,
            participants: participantsWithFollowStatus,
            userActivityData,
            organizerGpxPath: organizerGpx?.gpxFilePath || null,
          });
          return;
        }
      }
      
      // Get organizer's actual GPX file if available (for non-authenticated requests)
      const organizerGpx = await storage.getOrganizerGpx(rideId);
      
      res.json({
        ...ride,
        organizerGpxPath: organizerGpx?.gpxFilePath || null,
      });
    } catch (error) {
      console.error("Get ride error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/rides/:id/join", requireAuth, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      
      // Check if user is already joined
      const isJoined = await storage.isUserJoined(rideId, req.userId!);
      if (isJoined) {
        return res.status(400).json({ message: "Already joined this ride" });
      }

      await storage.joinRide(rideId, req.userId!);
      res.json({ message: "Successfully joined the ride" });
    } catch (error) {
      console.error("Join ride error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/rides/:id/leave", requireAuth, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      await storage.leaveRide(rideId, req.userId!);
      res.json({ message: "Successfully left the ride" });
    } catch (error) {
      console.error("Leave ride error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/rides/:id/participants", async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const participants = await storage.getRideParticipants(rideId);
      res.json(participants);
    } catch (error) {
      console.error("Get participants error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/rides/:id/activity-matches", async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const activityMatches = await storage.getRideActivityMatches(rideId);
      res.json(activityMatches);
    } catch (error) {
      console.error("Get activity matches error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/rides/:id", requireAuth, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      console.log(`DELETE request received for ride ID: ${rideId}`); // ADDED LOGGING

      const ride = await storage.getRide(rideId);
      console.log(`Fetched ride for deletion: ${JSON.stringify(ride)}`); // ADDED LOGGING

      if (!ride) {
        console.log(`Ride with ID ${rideId} not found.`); // ADDED LOGGING
        return res.status(404).json({ message: "Ride not found" });
      }

      if (ride.organizerId !== req.userId!) {
        console.log(`User ${req.userId} is not the organizer of ride ${rideId}. Organizer is ${ride.organizerId}.`); // ADDED LOGGING
        return res.status(403).json({ message: "Only the organizer can delete this ride" });
      }

      console.log(`Calling storage.deleteRide for ride ID: ${rideId}`); // ADDED LOGGING
      await storage.deleteRide(rideId); // This is the line that calls the delete logic
      console.log(`storage.deleteRide completed for ride ID: ${rideId}`); // ADDED LOGGING

      res.json({ message: "Ride deleted successfully" });
    } catch (error) {
      console.error("Delete ride error:", error);
      // Ensure error message is included in the response
      res.status(500).json({ message: "Internal server error", error: (error as Error).message });
    }
  });

  // Complete ride route
  app.post("/api/rides/:id/complete", requireAuth, async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      await storage.completeRide(rideId, req.userId!);
      res.json({ message: "Ride completed successfully" });
    } catch (error) {
      console.error("Complete ride error:", error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Complete ride with personal GPX data
  app.post("/api/rides/:id/complete-with-data", requireAuth, upload.single("gpxFile"), async (req, res) => {
    try {
      const rideId = parseInt(req.params.id);
      const userId = req.userId!;
      
      // Check if user is participant of the ride
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      const isParticipant = await storage.isUserJoined(rideId, userId);
      if (!isParticipant) {
        return res.status(403).json({ message: "Only participants can complete this ride with data" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "GPX file is required" });
      }

      // Parse GPX file to extract activity data
      const gpxData = await parseGPXFile(req.file.path);
      
      // Store activity match data
      await storage.createActivityMatch({
        rideId,
        userId,
        deviceId: req.body.deviceId || 'manual',
        routeMatchPercentage: '100.00', // Manually uploaded, assume 100% match
        gpxFilePath: req.file.path,
        distance: gpxData.distance?.toString(),
        duration: gpxData.duration,
        movingTime: gpxData.movingTime,
        elevationGain: gpxData.elevationGain?.toString(),
        averageSpeed: gpxData.averageSpeed?.toString(),
        averageHeartRate: gpxData.averageHeartRate,
        maxHeartRate: gpxData.maxHeartRate,
        calories: gpxData.calories,
        completedAt: new Date(),
      });

      res.json({ 
        message: "Ride completed with personal data successfully",
        activityData: {
          distance: gpxData.distance,
          duration: gpxData.duration,
          movingTime: gpxData.movingTime,
          elevationGain: gpxData.elevationGain,
          averageSpeed: gpxData.averageSpeed,
          averageHeartRate: gpxData.averageHeartRate,
          maxHeartRate: gpxData.maxHeartRate,
        }
      });
    } catch (error) {
      console.error("Complete ride with data error:", error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // User rides routes
  app.get("/api/my-rides", requireAuth, async (req, res) => {
    try {
      const myRides = await storage.getUserRides(req.userId!);
      res.json(myRides);
    } catch (error) {
      console.error("Get user rides error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User stats routes
  app.get("/api/my-stats", requireAuth, async (req, res) => {
    try {
      const timeframe = req.query.timeframe as string || "last-month";
      const stats = await storage.getUserStats(req.userId!, timeframe);
      res.json(stats);
    } catch (error) {
      console.error("Get user stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get stats for a specific user
  app.get("/api/user-stats/:userId", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const timeframe = req.query.timeframe as string || "last-month";
      const stats = await storage.getUserStats(userId, timeframe);
      
      // Also get user info
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        ...stats,
        user: {
          id: user.id,
          name: user.name,
          username: user.username
        }
      });
    } catch (error) {
      console.error("Get user stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User completed rides routes
  app.get("/api/my-completed-rides", requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit === "all" ? undefined : parseInt(req.query.limit as string) || 5;
      const completedRides = await storage.getUserCompletedRides(req.userId!, limit);
      res.json(completedRides);
    } catch (error) {
      console.error("Get user completed rides error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Riders discovery routes
  app.get("/api/riders", requireAuth, async (req, res) => {
    try {
      const riders = await storage.getRiders(req.userId!);
      res.json(riders);
    } catch (error) {
      console.error("Get riders error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Follow/unfollow routes
  app.post("/api/users/:id/follow", requireAuth, async (req, res) => {
    try {
      const followingId = parseInt(req.params.id);
      const followerId = req.userId!;
      
      if (followerId === followingId) {
        return res.status(400).json({ message: "Cannot follow yourself" });
      }
      
      const isAlreadyFollowing = await storage.isFollowing(followerId, followingId);
      if (isAlreadyFollowing) {
        return res.status(400).json({ message: "Already following this user" });
      }
      
      await storage.followUser(followerId, followingId);
      res.json({ message: "User followed successfully" });
    } catch (error) {
      console.error("Follow user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/users/:id/unfollow", requireAuth, async (req, res) => {
    try {
      const followingId = parseInt(req.params.id);
      const followerId = req.userId!;
      
      await storage.unfollowUser(followerId, followingId);
      res.json({ message: "User unfollowed successfully" });
    } catch (error) {
      console.error("Unfollow user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Follower/following routes
  app.get("/api/users/:id/followers", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const followers = await storage.getFollowers(userId);
      res.json(followers);
    } catch (error) {
      console.error("Get followers error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/:id/following", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const following = await storage.getFollowing(userId);
      res.json(following);
    } catch (error) {
      console.error("Get following error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Solo activities routes
  app.get("/api/completed-activities", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const activities = await storage.getUserCompletedActivities(userId);
      
      // Prevent caching to ensure fresh data
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.json(activities);
    } catch (error) {
      console.error("Get completed activities error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/solo-activities", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const validatedData = insertSoloActivitySchema.parse(req.body);
      
      const activity = await storage.createSoloActivity({
        ...validatedData,
        userId,
      });
      
      res.status(201).json(activity);
    } catch (error) {
      console.error("Create solo activity error:", error);
      if (error instanceof ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Get solo activity by ID
  app.get("/api/solo-activities/:id", requireAuth, async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      const userId = req.userId!;
      
      const activity = await storage.getSoloActivity(activityId);
      if (!activity) {
        return res.status(404).json({ message: 'Activity not found' });
      }

      if (activity.userId !== userId) {
        return res.status(403).json({ message: 'Not authorized to view this activity' });
      }

      res.json(activity);
    } catch (error) {
      console.error("Get solo activity error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GPX upload route with activity matching
  app.post("/api/upload-activity", requireAuth, upload.single("gpx"), async (req, res) => {
    console.log('--- Starting /api/upload-activity endpoint execution ---'); // Add this very first log
    try {
      const userId = req.userId!;
      const file = req.file;
      
      if (!file) {
        console.log('No GPX file provided'); 
        return res.status(400).json({ message: "No GPX file provided" });
      }
      console.log('GPX file provided:', file.originalname); // Log after the if condition
      console.log('GPX file path:', file.path); // Log the file.path property
      
      const { deviceName, deviceType, isOrganizerOverride } = req.body;
      console.log('Request body:', req.body); // Log the request body

      // Parse GPX file to extract activity data
      console.log('Before calling parseGPXFile'); // Add this log
      const gpxData = await parseGPXFile(file.path);
      console.log('gpxData after parsing:', gpxData); // Add this log

      // Validate GPX data has valid start time
      if (!gpxData.startTime || isNaN(gpxData.startTime.getTime())) {
        console.log('Invalid GPX file: missing or malformed timestamp data'); // Log inside the if condition
        return res.status(400).json({ message: "Invalid GPX file: missing or malformed timestamp data" });
      }
      console.log('GPX data validated'); // Log after validation

      // Calculate XP breakdown from GPX data - ADDED
      const distance = gpxData.distance || 0;
      const elevationGain = gpxData.elevationGain || 0;
      const averageSpeed = gpxData.averageSpeed || 0;

      const xpFromDistance = Math.round(distance * 0.05);
      const xpFromElevation = Math.round(elevationGain * 0.01);
      const xpFromSpeed = Math.round(averageSpeed * 0.1); 

      // Check if user has organized rides on the same date FIRST
      const activityDate = new Date(gpxData.startTime as Date);
      console.log('Activity date:', activityDate); // Log activity date
      const plannedRides = await storage.getOrganizerPlannedRides(userId, activityDate);
      console.log(`User has ${plannedRides.length} organized rides on ${activityDate.toDateString()}`);
      
      // If user has organized rides on this date, check for auto-match or prompt for manual override
      if (plannedRides.length > 0 && !isOrganizerOverride) {
        console.log(`User has ${plannedRides.length} organized rides on ${activityDate.toDateString()}`);
        console.log('Attempting auto-match with organized rides'); // Log before auto-match
        
        // Try auto-matching first
        console.log('Before calling proximityMatcher.matchOrganizerGpx'); // Add this log
        const autoMatch = await proximityMatcher.matchOrganizerGpx(gpxData, plannedRides);
        console.log('Calling proximityMatcher.matchOrganizerGpx with gpxData:', gpxData); // Add this log

        if (autoMatch) {
          // Auto-match successful - process as organizer GPX
          console.log('Auto-match successful, creating organizer GPX record.');

          // Calculate organizing bonus XP - ADDED
          const organizingBonusXp = 50; // Example bonus XP for organizing

           // Calculate total earned XP for organizer GPX - ADDED
          const earnedXp = xpFromDistance + xpFromElevation + xpFromSpeed + organizingBonusXp;
          const roundedEarnedXp = Math.round(earnedXp); // Round the total earned XP

          const organizerGpx = await storage.createOrganizerGpx({
            rideId: autoMatch.rideId,
            organizerId: userId,
            gpxFilePath: file.path,
            originalGpxPath: plannedRides.find(r => r.id === autoMatch.rideId)?.gpxFilePath,
            matchScore: autoMatch.matchScore.toString(),
            isManuallyLinked: false,
            distance: gpxData.distance?.toString(),
            duration: gpxData.duration,
            movingTime: gpxData.movingTime,
            elevationGain: gpxData.elevationGain?.toString(),
            averageSpeed: gpxData.averageSpeed?.toString(),
            averageHeartRate: gpxData.averageHeartRate,
            maxHeartRate: gpxData.maxHeartRate,
            calories: gpxData.calories,
            xpEarned: roundedEarnedXp,
            xpDistance: xpFromDistance,
            xpElevation: xpFromElevation,
            xpSpeed: xpFromSpeed,
            xpOrganizingBonus: organizingBonusXp,
          });
          console.log(`Organizer GPX record created with ID: ${organizerGpx.id}`);

          // Mark ride as completed
          console.log(`Calling storage.completeRide for ride ${autoMatch.rideId} triggered by organizer GPX upload.`);
          await storage.completeRide(autoMatch.rideId, userId); // Pass userId as organizer
          
          // Increment the organizer's total XP - ADDED
          if (roundedEarnedXp > 0) {
            await storage.incrementUserXP(userId, roundedEarnedXp);
            console.log(`Added ${roundedEarnedXp} XP to organizer ${userId} for organizer GPX upload.`);
         }
          // Process participant proximity matching
          console.log('Before calling processParticipantMatching after auto-match'); // Add this log
          await processParticipantMatching(autoMatch.rideId, organizerGpx.id, file.path);
          console.log('Calling processParticipantMatching after auto-match'); // Add this log
          return res.json({
            type: 'organizer_auto_matched',
            message: `Automatically matched to your organized ride "${autoMatch.rideName}"`,
            matchScore: autoMatch.matchScore,
            rideName: autoMatch.rideName,
            rideId: autoMatch.rideId
          });
        } else {
          // No auto-match - prompt user for manual decision
          console.log('No auto-match found, prompting for manual linking'); // Log before manual prompt
          return res.json({
            type: 'organizer_manual_prompt',
            message: 'I noticed you organized a ride today. Would you like this GPX file to serve as the actual route for your planned ride?',
            gpxData: {
              distance: gpxData.distance,
              duration: gpxData.duration,
              movingTime: gpxData.movingTime,
              elevationGain: gpxData.elevationGain
            },
            plannedRides: plannedRides.map(ride => ({
              id: ride.id,
              name: ride.name,
              dateTime: ride.dateTime,
              description: ride.description
            })),
            tempFilePath: file.path
          });
        }
      }
      
      // Try to match with existing joined rides within a reasonable time window
      console.log('Before calling storage.getUserRides');
      const userRides = await storage.getUserRides(userId);
      console.log('After calling storage.getUserRides, userRides:', userRides); 
      
      console.log('Before filtering userRides.joined, userRides.joined:', userRides?.joined);
     
      // Add a more robust check here
      const joinedRides = (userRides && Array.isArray(userRides.joined)) ? userRides.joined : [];
      console.log('After robust check, joinedRides:', joinedRides); // Add this log 
     
      const currentTime = new Date();
      const activityStartTime = new Date(gpxData.startTime);
      
      // Look for rides that are within 24 hours of the activity start time (before or after)
      // and include completed rides that the user joined
      const timeWindowHours = 24;
      const timeWindowMs = timeWindowHours * 60 * 60 * 1000;
      
      const candidateRides = joinedRides.filter(ride => {
        const rideDateTime = new Date(ride.dateTime);
        const timeDiff = Math.abs(activityStartTime.getTime() - rideDateTime.getTime());
        return timeDiff <= timeWindowMs; // Remove the isCompleted filter to include completed rides
      });
      console.log('After filtering joinedRides, candidateRides:', candidateRides); // Add this log

      // Debug: Log available rides for matching
      console.log('Available rides for matching:', candidateRides.map(r => ({
        id: r.id,
        name: r.name,
        dateTime: r.dateTime,
        isCompleted: r.isCompleted
      })));
      
      console.log('Activity start time:', gpxData.startTime);
      console.log('Activity track points:', gpxData.trackPoints?.length || 0);
      
      let bestMatch = null;
      let bestMatchScore = 0;
      
      // Simple route matching logic (can be enhanced)
      for (const ride of candidateRides) {
        try {
          // First try to parse the original planned route GPX
          let rideGpxData = null;
          try {
            console.log(`Attempting to parse planned route GPX for ride ${ride.id}: ${ride.gpxFilePath}`); // Log before parsing planned route
            rideGpxData = await parseGPXFile(ride.gpxFilePath);
            console.log(`Successfully parsed planned route GPX for ride ${ride.id}`); // Log after successful parsing
          } catch (plannedRouteError) {
            console.warn(`Could not parse planned route GPX for ride ${ride.id}, trying organizer's actual GPX:`, plannedRouteError);
            
            // If planned route fails, try to get organizer's actual uploaded GPX
            const organizerGpx = await storage.getOrganizerGpxForRide(ride.id);
            if (organizerGpx) {
              console.log(`Found organizer's actual GPX for ride ${ride.id}: ${organizerGpx.gpxFilePath}`);
                console.log(`Attempting to parse organizer's actual GPX for ride ${ride.id}: ${organizerGpx.gpxFilePath}`); // Log before parsing organizer's GP
              rideGpxData = await parseGPXFile(organizerGpx.gpxFilePath);
                console.log(`Successfully parsed organizer's actual GPX for ride ${ride.id}`); // Log after successful parsing
            }
          }
          
          if (rideGpxData) {
            console.log('Calling calculateRouteMatch with gpxData and rideGpxData:', { gpxData, rideGpxData }); // Add this log
            const matchScore = calculateRouteMatch(gpxData, rideGpxData);
            console.log('After calling calculateRouteMatch, matchScore:', matchScore); // Log after calculateRouteMatch
            console.log(`Ride ${ride.name} match score: ${matchScore}`);
            
            if (matchScore > bestMatchScore && matchScore >= 0.5) {
              bestMatch = ride;
              bestMatchScore = matchScore;
            }
          } else {
            console.warn(`No GPX data available for ride ${ride.id} to compare against`);
          }
        } catch (error) {
          console.warn(`Could not parse GPX for ride ${ride.id}:`, error);
        }
      }

      if (bestMatch && bestMatchScore >= 0.5) {
        console.log(`Match found for ride ${bestMatch.id} with score ${bestMatchScore}`); // Log when match is found
        // Check if user already has activity data for this ride
        const existingActivity = await storage.getUserActivityForRide(bestMatch.id, userId);
        
        if (existingActivity) {
          console.log(`Existing activity found for ride ${bestMatch.id}, updating`); // Log when existing activity is found
          // User already has activity data for this ride, just update it
          res.json({
            message: "Activity updated for matched ride!",
            matchedRide: bestMatch,
            matchScore: bestMatchScore,
            existing: true,
          });
        } else {
          console.log(`No existing activity found for ride ${bestMatch.id}, creating new activity match`); // Log when creating new activity match
          
           // Calculate total earned XP for participant activity match 
           const earnedXp = xpFromDistance + xpFromElevation + xpFromSpeed;
           const roundedEarnedXp = Math.round(earnedXp);
          
          
          // Match found - complete the ride if not already completed 
          if (!bestMatch.isCompleted) {
              console.log(`Ride ${bestMatch.id} is not completed, marking as completed`); // Log before completing ride
            await storage.completeRide(bestMatch.id, userId);
            console.log(`Ride ${bestMatch.id} marked as completed`); // Log after completing ride
          }
          
          // Create activity match record
          console.log('Before creating activity match record'); // Log before creating activity match
          await storage.createActivityMatch({
            rideId: bestMatch.id,
            userId,
            deviceId: deviceName || 'manual-upload',
            routeMatchPercentage: (bestMatchScore * 100).toFixed(2),
            gpxFilePath: file.path,
            distance: gpxData.distance?.toString() ?? null,
            duration: gpxData.duration ?? null,
            movingTime: gpxData.movingTime,
            elevationGain: gpxData.elevationGain?.toString() ?? null,
            averageSpeed: gpxData.averageSpeed?.toString() ?? null,
            averageHeartRate: gpxData.averageHeartRate ?? null,
            maxHeartRate: gpxData.maxHeartRate ?? null, 
            calories: gpxData.calories ?? null,
            completedAt: new Date(),
            xpEarned: roundedEarnedXp,
            xpDistance: xpFromDistance,
            xpElevation: xpFromElevation,
            xpSpeed: xpFromSpeed,
            xpOrganizingBonus: 0, // Participant matches don't get organizing bonus
          });
          console.log('After creating activity match record'); // Log after creating activity match
          
           // Immediately increment the user's total XP for this matched activity. - ADDED
           if (roundedEarnedXp > 0) {
            await storage.incrementUserXP(userId, roundedEarnedXp);
            console.log(`Added ${roundedEarnedXp} XP to user ${userId} for activity match on ride ${bestMatch.id}.`);
          }

          // Note: storage.completeRide is NOT called here. Ride completion is an organizer action.

          res.json({
            message: "Activity matched!",
            matchedRide: bestMatch,
            matchScore: bestMatchScore,
          });
        }
      } else {
        // No match found - create a solo activity automatically
        console.log('No ride match found, creating solo activity with gpxData:', gpxData); // Add this log
        
         // Add a check for req.file here
         if (!req.file) {
          console.error('Error creating solo activity: req.file is undefined'); // Log the error
          // Decide how to handle this case:
          // - Return an error response to the client
          // - Throw an error to be caught by the outer catch block
          return res.status(500).json({ message: "Error processing uploaded file for solo activity" });
         }
        
         // Reuse the XP breakdown calculated earlier for solo activities
        const earnedXp = xpFromDistance + xpFromElevation + xpFromSpeed; // Calculate total XP for solo activity
        const roundedEarnedXp = Math.round(earnedXp);

        const soloActivity = await storage.createSoloActivity({
          name: `Manual Activity - ${new Date().toLocaleDateString()}`,
          description: `Solo cycling activity uploaded manually`,
          activityType: 'cycling',
          gpxFilePath: req.file.path,
          distance: gpxData.distance?.toString(),
          duration: gpxData.duration,
          movingTime: gpxData.movingTime,
          elevationGain: gpxData.elevationGain?.toString(),
          averageSpeed: gpxData.averageSpeed?.toString(),
          averageHeartRate: gpxData.averageHeartRate,
          maxHeartRate: gpxData.maxHeartRate,
          calories: gpxData.calories,
          deviceName: deviceName || 'Manual Upload',
          deviceType: deviceType || 'manual',
          completedAt: new Date(),
          userId,
          xpEarned: roundedEarnedXp,
          xpDistance: xpFromDistance,
          xpElevation: xpFromElevation,
          xpSpeed: xpFromSpeed,
          // No organizing bonus for solo activities
          xpOrganizingBonus: 0, // Ensure this is included and 0
        });
          console.log('Solo activity created:', soloActivity); // Log created solo activity
        
          // Increment user's total XP for the solo activity - ADDED
        if (roundedEarnedXp > 0) {
          await storage.incrementUserXP(userId, roundedEarnedXp);
          console.log(`Solo activity created, XP increment handled within createSoloActivity.`); // Temporary log
        }

        res.json({
          message: "Solo activity created successfully", 
          matchedRide: null,
          soloActivity,
          matches: candidateRides.length,
        });
      }
    } catch (error) {
      console.error("Upload activity error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Manual organizer GPX linking - when user chooses to link their GPX to an organized ride
  app.post("/api/link-organizer-gpx", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const { rideId, tempFilePath, gpxData } = req.body;
      
      console.log('Link organizer GPX request body:', req.body);
      console.log('Request data:', { rideId, tempFilePath, gpxData });
      
      if (!rideId || !tempFilePath || !gpxData) {
        console.log('Missing fields:', { rideId: !!rideId, tempFilePath: !!tempFilePath, gpxData: !!gpxData });
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Verify user is the organizer of this ride
      const ride = await storage.getRide(rideId);
      if (!ride || ride.organizerId !== userId) {
        return res.status(403).json({ message: "Not authorized - you are not the organizer of this ride" });
      }

      // Check if organizer GPX already exists for this ride
      const existingOrganizerGpx = await storage.getOrganizerGpxForRide(rideId);
      if (existingOrganizerGpx) {
        return res.status(400).json({ message: "This ride already has organizer GPX data linked" });
      }

      // Create organizer GPX record with manual linking
      const organizerGpx = await storage.createOrganizerGpx({
        rideId,
        organizerId: userId,
        gpxFilePath: tempFilePath,
        originalGpxPath: ride.gpxFilePath,
        matchScore: "0.00", // Manual link, no auto-match score
        isManuallyLinked: true,
        distance: gpxData.distance?.toString(),
        duration: gpxData.duration,
        movingTime: gpxData.movingTime,
        elevationGain: gpxData.elevationGain?.toString(),
        averageSpeed: gpxData.averageSpeed?.toString(),
        averageHeartRate: gpxData.averageHeartRate,
        maxHeartRate: gpxData.maxHeartRate,
        calories: gpxData.calories,
      });

      // Mark ride as completed
      await storage.completeRide(rideId, userId);
      
      // Process participant proximity matching
      await processParticipantMatching(rideId, organizerGpx.id, tempFilePath);
      
      res.json({
        type: 'organizer_manual_linked',
        message: `Successfully linked GPX to your organized ride "${ride.name}"`,
        rideName: ride.name,
        rideId: rideId
      });
    } catch (error) {
      console.error("Link organizer GPX error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  

  // Delete solo activity
  app.delete('/api/activities/:id', requireAuth, async (req, res) => {
    try {
      const activityId = parseInt(req.params.id);
      const userId = req.userId;

      // Get the activity to check ownership and get file path
      const activity = await storage.getSoloActivity(activityId);
      if (!activity) {
        return res.status(404).json({ message: 'Activity not found' });
      }

      if (activity.userId !== userId) {
        return res.status(403).json({ message: 'Not authorized to delete this activity' });
      }

// Delete the GPX file from Supabase if it exists
if (activity.gpxFilePath) {
  try {
    const { data, error } = await supabase.storage
      .from('gpx-uploads') // Replace 'gpx-uploads' with your Supabase bucket name
      .remove([activity.gpxFilePath]); // activity.gpxFilePath should already be the Supabase path

    if (error) {
      console.warn('Could not delete GPX file from Supabase:', error);
    }
  } catch (fileError) {
    console.warn('Supabase delete promise error:', fileError);
  }
}


      // Delete the activity from database
      await storage.deleteSoloActivity(activityId);

      res.json({ message: 'Activity deleted successfully' });
    } catch (error) {
      console.error('Delete activity error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Initialize proximity matcher
  const proximityMatcher = new GPXProximityMatcher();

  // Upload organizer GPX for planned ride
  app.post("/api/organizer-gpx", requireAuth, upload.single("gpx"), async (req, res) => {
    try {
      const userId = req.userId!;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No GPX file provided" });
      }

      // Parse GPX file to extract activity data
      const gpxData = await parseGPXFile(file.path);
      
      // Get organizer's planned rides on the same date
      const activityDate = new Date(gpxData.startTime);
      const plannedRides = await storage.getOrganizerPlannedRides(userId, activityDate);
      
      console.log(`Checking ${plannedRides.length} planned rides for auto-matching`);
      
      // Try to auto-match with planned rides (70% similarity threshold)
      const autoMatch = await proximityMatcher.matchOrganizerGpx(gpxData, plannedRides);
      
      if (autoMatch) {
        // Auto-match found - link directly
        const organizerGpx = await storage.createOrganizerGpx({
          rideId: autoMatch.rideId,
          organizerId: userId,
          gpxFilePath: file.path,
          originalGpxPath: plannedRides.find(r => r.id === autoMatch.rideId)?.gpxFilePath,
          matchScore: autoMatch.matchScore.toString(),
          isManuallyLinked: false,
          distance: gpxData.distance?.toString(),
          duration: gpxData.duration,
          movingTime: gpxData.movingTime,
          elevationGain: gpxData.elevationGain?.toString(),
          averageSpeed: gpxData.averageSpeed?.toString(),
          averageHeartRate: gpxData.averageHeartRate,
          maxHeartRate: gpxData.maxHeartRate,
          calories: gpxData.calories,
        });

        // Mark ride as completed
        await storage.completeRide(autoMatch.rideId, userId);
        
        // Process participant proximity matching
        await processParticipantMatching(autoMatch.rideId, organizerGpx.id, file.path);
        console.log('Calling processParticipantMatching after auto-match'); // Add this log
        res.json({
          message: `Auto-matched to ride "${autoMatch.rideName}" with ${autoMatch.matchScore.toFixed(1)}% similarity`,
          organizerGpx,
          autoMatched: true,
          matchScore: autoMatch.matchScore,
          rideName: autoMatch.rideName,
        });
      } else {
        // No auto-match - create unlinked GPX for manual selection
        const organizerGpx = await storage.createOrganizerGpx({
          rideId: -1, // Temporary - will be set when manually linked
          organizerId: userId,
          gpxFilePath: file.path,
          matchScore: "0.00",
          isManuallyLinked: false,
          distance: gpxData.distance?.toString(),
          duration: gpxData.duration,
          movingTime: gpxData.movingTime,
          elevationGain: gpxData.elevationGain?.toString(),
          averageSpeed: gpxData.averageSpeed?.toString(),
          averageHeartRate: gpxData.averageHeartRate,
          maxHeartRate: gpxData.maxHeartRate,
          calories: gpxData.calories,
        });

        res.json({
          message: "No automatic match found. Please manually link to a planned ride.",
          organizerGpx,
          autoMatched: false,
          availableRides: plannedRides,
        });
      }
    } catch (error) {
      console.error('Organizer GPX upload error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Manual link organizer GPX to planned ride
  app.post("/api/rides/:rideId/link-gpx", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const rideId = parseInt(req.params.rideId);
      const { gpxId } = linkGpxSchema.parse(req.body);
      
      // Verify user is the organizer
      const ride = await storage.getRide(rideId);
      if (!ride || ride.organizerId !== userId) {
        return res.status(403).json({ message: "Not authorized to link GPX to this ride" });
      }
      
      // Verify GPX file belongs to user
      const gpxFile = await storage.getOrganizerGpxById(parseInt(gpxId));
      if (!gpxFile || gpxFile.organizerId !== userId) {
        return res.status(403).json({ message: "GPX file not found or not owned by user" });
      }
      
      // Link the GPX file to the ride
      await storage.linkOrganizerGpx(rideId, parseInt(gpxId), true);
      
      // Mark ride as completed
      await storage.completeRide(rideId, userId);
      
      // Process participant proximity matching
      await processParticipantMatching(rideId, parseInt(gpxId), gpxFile.gpxFilePath);
      
      res.json({ message: "GPX file successfully linked to ride" });
    } catch (error) {
      console.error('Manual GPX link error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get participant matches for a ride
  app.get("/api/rides/:rideId/participant-matches", requireAuth, async (req, res) => {
    try {
      const rideId = parseInt(req.params.rideId);
      const matches = await storage.getParticipantMatches(rideId);
      res.json({ matches });
    } catch (error) {
      console.error('Get participant matches error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Helper function to process participant proximity matching
  async function processParticipantMatching(rideId: number, organizerGpxId: number, organizerGpxPath: string) {
    try {
      // Get all participants for this ride
      const participantIds = await storage.getRideParticipantIds(rideId);
      
      if (participantIds.length === 0) {
        console.log('No participants to match for ride', rideId);
        return;
      }
      
      // Get any pending participant GPX files that might match
      const pendingGpxFiles = await storage.getPendingParticipantGpxFiles(rideId, participantIds);
      
      console.log(`Processing ${pendingGpxFiles.length} pending participant GPX files for ride ${rideId}`);
      
      // Check proximity for each participant GPX
      for (const participantGpx of pendingGpxFiles) {
        try {
          const proximityResult = await proximityMatcher.checkParticipantProximity(
            organizerGpxPath,
            participantGpx.gpxFilePath
          );
          
          // Create participant match record
          await storage.createParticipantMatch({
            rideId,
            participantId: participantGpx.userId,
            organizerGpxId,
            participantGpxPath: participantGpx.gpxFilePath,
            proximityScore: proximityResult.proximityScore.toString(),
            matchedPoints: proximityResult.matchedPoints,
            totalOrganizerPoints: proximityResult.totalOrganizerPoints,
            isCompleted: proximityResult.isCompleted,
            // Extract additional metrics from participant GPX
            distance: "0", // Will be populated by GPX parse
            duration: 0,
            movingTime: 0,
            elevationGain: "0",
            averageSpeed: "0",
          });
          
          console.log(`Participant ${participantGpx.userId} proximity: ${proximityResult.proximityScore.toFixed(1)}% (${proximityResult.isCompleted ? 'COMPLETED' : 'incomplete'})`);
        } catch (error) {
          console.warn(`Error processing participant ${participantGpx.userId} GPX:`, error);
        }
      }
    } catch (error) {
      console.error('Participant matching error:', error);
    }
  }

  const httpServer = createServer(app);
  return httpServer;
}
