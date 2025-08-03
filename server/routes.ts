import type { Express, Request, Response } from "express";
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
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Login error:", error);
      // Log the error message and stack trace for better debugging
      if (error.message) {
        console.error("Login error message:", error.message);
    }
    if (error.stack) {
        console.error("Login error stack trace:", error.stack);
    } 
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
    console.log('--- Starting /api/upload-activity endpoint execution ---');
    try {
      const userId = req.userId!;
      const file = req.file;
  
      if (!file) {
        console.log('No GPX file provided');
        return res.status(400).json({ message: "No GPX file provided" });
      }
      console.log('GPX file provided:', file.originalname);
      console.log('GPX file path:', file.path);
  
      const { deviceName, deviceType, isOrganizerOverride } = req.body;
      console.log('Request body:', req.body);
  
      // Parse GPX file to extract activity data
      console.log('Before calling parseGPXFile');
      const gpxData = await parseGPXFile(file.path);
      console.log('gpxData after parsing:', gpxData);
  
      // Validate GPX data has valid start time
      if (!gpxData.startTime || isNaN(gpxData.startTime.getTime())) {
        console.log('Invalid GPX file: missing or malformed timestamp data');
        return res.status(400).json({ message: "Invalid GPX file: missing or malformed timestamp data" });
      }
      console.log('GPX data validated');
  
      // Calculate XP breakdown from GPX data
      const distance = gpxData.distance || 0;
      const elevationGain = gpxData.elevationGain || 0;
      const averageSpeed = gpxData.averageSpeed || 0;
  
      const xpFromDistance = Math.round(distance * 0.05);
      const xpFromElevation = Math.round(elevationGain * 0.01);
      const xpFromSpeed = Math.round(averageSpeed * 0.1);
  
      // Check if user has organized rides on the same date
      const activityDate = gpxData.startTime ? new Date(gpxData.startTime) : new Date(); // Provide a fallback date
      console.log('Activity date:', activityDate);
      const plannedRides = await storage.getOrganizerPlannedRides(userId, activityDate);
      console.log(`User has ${plannedRides.length} organized rides on ${activityDate.toDateString()}`);
  
      // If user has organized rides on this date, check for auto-match or prompt for manual override
      if (plannedRides.length > 0 && !isOrganizerOverride) {
        console.log(`User has ${plannedRides.length} organized rides on ${activityDate.toDateString()}`);
        console.log('Attempting auto-match with organized rides');
  
        // Try auto-matching first
        console.log('Before calling proximityMatcher.matchOrganizerGpx');
        const autoMatch = await proximityMatcher.matchOrganizerGpx(gpxData, plannedRides);
        console.log('Calling proximityMatcher.matchOrganizerGpx with gpxData:', gpxData);
  
        if (autoMatch) {
          // Auto-match successful - process as organizer GPX
          console.log('Auto-match successful, creating organizer GPX record.');
  
          const organizingBonusXp = 1;
          const organizerJoiningBonus = 1;
          const earnedXp = xpFromDistance + xpFromElevation + xpFromSpeed + organizingBonusXp + organizerJoiningBonus;
          const roundedEarnedXp = Math.round(earnedXp);
          console.log(`Calculated organizer XP for auto-match: ${roundedEarnedXp}`);
  
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
  
          //console.log(`Calling storage.completeRide for ride ${autoMatch.rideId} triggered by organizer GPX upload.`);
          //await storage.completeRide(autoMatch.rideId, userId);
  
          if (roundedEarnedXp > 0) {
            await storage.incrementUserXP(userId, roundedEarnedXp);
            console.log(`Added ${roundedEarnedXp} XP to organizer ${userId} for organizer GPX upload.`);
          }
  
          console.log(`Calling storage.completeRide for ride ${autoMatch.rideId} triggered by organizer GPX upload.`);
          await storage.completeRide(autoMatch.rideId, userId); // Pass userId as organizer
          console.log(`Ride ${autoMatch.rideId} marked as completed by organizer ${userId}.`);
          
          // --- Retroactive Matching for Participants ---
          console.log(`Starting retroactive matching for pending participant activities for ride ${autoMatch.rideId}.`);
          await storage.processPendingActivityMatches(autoMatch.rideId, organizerGpx.id, file.path, proximityMatcher); // Updated to call storage method
          console.log(`Finished retroactive matching for ride ${autoMatch.rideId}.`);
          // --- End Retroactive Matching ---

          return res.json({
            type: 'organizer_auto_matched',
            message: `Automatically matched to your organized ride "${autoMatch.rideName}"`,
            matchScore: autoMatch.matchScore,
            rideName: autoMatch.rideName,
            rideId: autoMatch.rideId,
            tempFilePath: file.path,
            gpxData: gpxData, // Include the parsed gpxData
            // ADDED: Include the list of planned rides
            plannedRides: plannedRides.map(ride => ({
                id: ride.id,
                name: ride.name,
                dateTime: ride.dateTime,
                description: ride.description
            })),
          });
        } else {
          // No auto-match for organizer - prompt for manual decision
          console.log('No auto-match found for organizer, prompting for manual linking');
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
  
      // User is not an organizer or chose to override organizer flow
      console.log('User is not an organizer or chose organizer override.');
      console.log('Attempting to match with joined rides.');
  
      const userRides = await storage.getUserRides(userId);
      console.log('After calling storage.getUserRides, userRides:', userRides);
  
      const joinedRides = (userRides && Array.isArray(userRides.joined)) ? userRides.joined : [];
      console.log('After robust check, joinedRides:', joinedRides);
  
      const activityStartTime = new Date(gpxData.startTime);
      const timeWindowHours = 24;
      const timeWindowMs = timeWindowHours * 60 * 60 * 1000;
  
      const candidateRides = joinedRides.filter(ride => {
        const rideDateTime = new Date(ride.dateTime);
        const timeDiff = Math.abs(activityStartTime.getTime() - rideDateTime.getTime());
        // Also check if the ride is not completed yet or if it is completed by the organizer
        return timeDiff <= timeWindowMs && (!ride.isCompleted || (ride.isCompleted && ride.organizerId === userId));
      });
      console.log('After filtering joinedRides for time window and completion status, candidateRides:', candidateRides);
  
  
      let bestMatch = null;
      let bestMatchScore = 0;
  
      for (const ride of candidateRides) {
        try {
          let rideGpxData = null;
            let organizerGpx = await storage.getOrganizerGpxForRide(ride.id); // **Prioritize organizer GPX**

            if (organizerGpx) {
              console.log(`Found organizer\'s actual GPX for ride ${ride.id}: ${organizerGpx.gpxFilePath}`);
              try {
              console.log(`Attempting to parse organizer\'s actual GPX for ride ${ride.id}`);
              rideGpxData = await parseGPXFile(organizerGpx.gpxFilePath);
              console.log(`Successfully parsed organizer\'s actual GPX for ride ${ride.id}`);
              } catch (organizerGpxError) {
              console.warn(`Could not parse organizer\'s actual GPX for ride ${ride.id}:`, organizerGpxError);
              // If organizer GPX parsing fails, we won't have rideGpxData for this ride,
              // and the matching logic below will handle it.
            }
        } else {
       console.log(`No organizer GPX found for ride ${ride.id}. Skipping auto-match for this ride.`);
         // If no organizer GPX, we skip matching for this ride as per new requirement
         continue; // Move to the next candidate ride
    }

  
          if (rideGpxData) {
            console.log('Calling calculateRouteMatch with gpxData and rideGpxData:', { gpxData, rideGpxData });
            const matchScore = calculateRouteMatch(gpxData, rideGpxData);
            console.log('After calling calculateRouteMatch, matchScore:', matchScore);
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
        console.log(`Auto-match found for ride ${bestMatch.id} with score ${bestMatchScore}. Prompting for confirmation.`);
        // Return a response to the frontend to trigger the confirmation modal
        return res.json({
          type: 'participant_auto_match_confirm', // New type for frontend
          message: `Automatically matched this activity to your joined ride: "${bestMatch.name}". Is this correct?`,
          matchedRide: { // Include necessary ride details for frontend display
              id: bestMatch.id,
              name: bestMatch.name,
              // Add other relevant ride details here (you can fetch them from 'bestMatch')
               dateTime: bestMatch.dateTime,
               description: bestMatch.description,
               organizerName: bestMatch.organizerName, // Assuming organizerName is available in bestMatch
          },
          matchScore: bestMatchScore,
          tempFilePath: file.path, // Pass the temporary file path
          gpxData: gpxData, // Pass the parsed gpxData
           // Include the list of joined rides on the same day for the "choose from a list" option
          joinedRides: candidateRides.filter(ride => { // Filter candidate rides to those on the same day
              const rideDateTime = new Date(ride.dateTime);
              const activityDate = new Date(gpxData.startTime ?? new Date()); 
              return rideDateTime.toDateString() === activityDate.toDateString();
          }).map(ride => ({
              id: ride.id,
              name: ride.name,
              dateTime: ride.dateTime,
              description: ride.description,
              organizerName: ride.organizerName, // Assuming organizerName is available
          })),
        });
      }
    
       else {
        // No automatic match found with joined rides
        console.log('No automatic match found with joined rides.');
        const joinedRidesOnActivityDate = joinedRides.filter(ride => {
            const rideDateTime = new Date(ride.dateTime);
            return rideDateTime.toDateString() === activityDate.toDateString();
        });
  
        if (joinedRidesOnActivityDate.length > 0) {
            // User has joined rides on this day, prompt for manual linking
            console.log(`User has ${joinedRidesOnActivityDate.length} joined rides on ${activityDate.toDateString()}. Prompting for manual linking.`);
            return res.json({
                type: 'participant_manual_prompt',
                message: 'I noticed you joined a ride today. Would you like to link this activity to one of your joined rides?',
                gpxData: {
                  distance: gpxData.distance,
                  duration: gpxData.duration,
                  movingTime: gpxData.movingTime,
                  elevationGain: gpxData.elevationGain
                },
                joinedRides: joinedRidesOnActivityDate.map(ride => ({
                  id: ride.id,
                  name: ride.name,
                  dateTime: ride.dateTime,
                  description: ride.description
                })),
                tempFilePath: file.path
            });
        } else {
            // No joined rides on this day either, create a solo activity automatically
            console.log('No joined rides on activity date, creating solo activity.');
            if (!req.file) {
                console.error('Error creating solo activity: req.file is undefined');
                return res.status(500).json({ message: "Error processing uploaded file for solo activity" });
            }
  
            const earnedXp = xpFromDistance + xpFromElevation + xpFromSpeed 
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
            });
            console.log('Solo activity created:', soloActivity);
  
            if (roundedEarnedXp > 0) {
                await storage.incrementUserXP(userId, roundedEarnedXp);
                console.log(`Solo activity created, XP increment handled within createSoloActivity.`);
            }
  
            res.json({
                message: "Solo activity created successfully",
                matchedRide: null,
                soloActivity,
                matches: 0, // No matches found
            });
        }
      }
    } catch (error) {
      console.error("Upload activity error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // New endpoint for manual participant GPX linking
   // ADDED: Middleware to log response state before the handler
   app.use("/api/link-participant-gpx", (req, res, next) => {
    console.log('--- Pre-route check for /api/link-participant-gpx ---'); // ADDED
    console.log('Response headers sent:', res.headersSent); // ADDED: Check if headers have already been sent
    console.log('Response status code:', res.statusCode); // ADDED: Check the current status code
    console.log('--- End pre-route check ---'); // ADDED
    next(); // Pass control to the next middleware/route handler
  });
  app.post("/api/link-participant-gpx", requireAuth, async (req, res) => {
    console.log('--- Starting /api/link-participant-gpx endpoint execution ---'); // ADDED
    try {
      const userId = req.userId!;
      const { rideId, tempFilePath } = req.body;
  
      console.log('Link participant GPX request body:', req.body);
      console.log('Request data:', { rideId, tempFilePath });
  
      if (!rideId || !tempFilePath) {
        console.log('Missing fields for participant link:', { rideId: !!rideId, tempFilePath: !!tempFilePath});
        return res.status(400).json({ message: "Missing required fields" });
      }

       // Read and parse the GPX file from the temporary path on the backend *here*
    console.log(`[link-participant-gpx] Reading and parsing GPX file from: ${tempFilePath}`); // ADDED LOGGING
    const gpxData = await parseGPXFile(tempFilePath); // Parse gpxData here
    console.log('[link-participant-gpx] GPX data parsed:', gpxData); // ADDED LOGGING

    if (!gpxData || !gpxData.startTime || isNaN(gpxData.startTime.getTime())) {
       console.error('[link-participant-gpx] Failed to parse GPX data from temp file or invalid data.'); // ADDED LOGGING
       return res.status(400).json({ message: "Failed to process GPX file or invalid data." });
    }
    console.log('GPX data successfully parsed and validated.'); // ADDED LOGGING

    // Now gpxData is available for use in the rest of the function
  
      // Verify user is a participant of this ride
      const isParticipant = await storage.isUserJoined(rideId, userId);
      if (!isParticipant) {
        return res.status(403).json({ message: "Not authorized - you are not a participant of this ride" });
      }
  
      // Check if user already has activity data for this ride
      const existingActivity = await storage.getUserActivityForRide(rideId, userId);
      if (existingActivity) {
        console.log(`Existing activity found for ride ${rideId}, cannot link again.`);
        return res.status(400).json({ message: "You have already linked an activity to this ride." });
      }
  
      // At this point, we don't have a matchScore from an automatic matching process.
      // If you want to calculate a matchScore here based on the selected ride's GPX,
      // you would fetch the organizer's GPX for this ride and run calculateRouteMatch.
      // For simplicity in this step, I'll set a placeholder score or assume 100% if it's a manual link.
      // Let's assume 100% match for manual linking for now, or you can implement the comparison here.
      let matchScore = "100.00"; // Placeholder
  
      // If you want to calculate the match score here:
      try {
          const organizerGpx = await storage.getOrganizerGpxForRide(rideId);
          if (organizerGpx) {
               const organizerGpxData = await parseGPXFile(organizerGpx.gpxFilePath);
               if (organizerGpxData) {
                   const calculatedScore = calculateRouteMatch(gpxData, organizerGpxData);
                   matchScore = (calculatedScore * 100).toFixed(2);
                   console.log(`Calculated match score for manual participant link: ${matchScore}`);
               }
          } else {
               console.warn(`Organizer GPX not found for ride ${rideId}, cannot calculate precise match score for manual link.`);
          }
      } catch (matchError) {
          console.error('Error calculating match score for manual participant link:', matchError);
          // Continue with placeholder score
      }
  
  
      // Create activity match record
      console.log('Before creating activity match record for participant manual link');
      const earnedXp = Math.round((gpxData.distance || 0) * 0.05 + (gpxData.elevationGain || 0) * 0.01 + (gpxData.averageSpeed || 0) * 0.1);
  
  
      await storage.createActivityMatch({
        rideId,
        userId,
        deviceId: gpxData.deviceName || 'manual-upload', // Assuming deviceName might be in gpxData, fallback to manual
        routeMatchPercentage: matchScore,
        gpxFilePath: tempFilePath,
        distance: gpxData.distance?.toString() ?? null,
        duration: gpxData.duration ?? null,
        movingTime: gpxData.movingTime,
        elevationGain: gpxData.elevationGain?.toString() ?? null,
        averageSpeed: gpxData.averageSpeed?.toString() ?? null,
        averageHeartRate: gpxData.averageHeartRate ?? null,
        maxHeartRate: gpxData.maxHeartRate ?? null,
        calories: gpxData.calories ?? null,
        completedAt: new Date(),
        xpEarned: earnedXp,
        xpDistance: Math.round((gpxData.distance || 0) * 0.05),
        xpElevation: Math.round((gpxData.elevationGain || 0) * 0.01),
        xpSpeed: Math.round((gpxData.averageSpeed || 0) * 0.1),
        xpOrganizingBonus: 0,
      });
      console.log('After creating activity match record for participant manual link');
      
      try {
        const ride = await storage.getRide(rideId);
        if (ride?.organizerId) {
             const incrementalOrganizerXp = 5; // Define your incremental XP amount per participant
             await storage.incrementUserXP(ride.organizerId, incrementalOrganizerXp);
             console.log(`Awarded ${incrementalOrganizerXp} incremental XP to organizer ${ride.organizerId} for participant ${userId}'s linked activity on ride ${rideId}.`);
        } else {
             console.warn(`Could not find organizerId for ride ${rideId} to award incremental XP.`);
        }
    } catch (organizerXpError) {
        console.error('Error awarding incremental organizer XP:', organizerXpError);
    }


       // Immediately increment the user's total XP for this manually linked activity. - ADDED
       if (earnedXp > 0) {
          await storage.incrementUserXP(userId, earnedXp);
          console.log(`Added ${earnedXp} XP to user ${userId} for manually linked activity on ride ${rideId}.`);
      }
  
  
      // You might want to re-fetch the ride details to send updated info back to the client
      const updatedRide = await storage.getRide(rideId);
  
  
      res.json({
        type: 'participant_manual_linked',
        message: `Successfully linked activity to joined ride "${updatedRide?.name}"`,
        linkedRide: {
            id: updatedRide?.id,
            name: updatedRide?.name,
            // include other relevant ride details you need on the frontend
        },
        matchScore: parseFloat(matchScore),
        activityData: { // Include activity data in the response
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
      console.error("Link participant GPX error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  

  // Manual organizer GPX linking - when user chooses to link their GPX to an organized ride
  app.post("/api/link-organizer-gpx", requireAuth, async (req, res) => {
  console.log('--- Starting /api/link-organizer-gpx endpoint execution ---'); // ADDED
  console.log('Raw request body:', req.body); // <-- Add this line to log the raw body

  let rideId: number | undefined = undefined; // MODIFIED: Initialize with undefined

    try {
      const userId = req.userId!;
      const { rideId: extractedRideId, tempFilePath } = req.body; // Extract rideId with a different name temporarily

      rideId = parseInt(extractedRideId); // Assign to the outer scope rideId

      console.log('Link organizer GPX request body:', req.body);
      console.log('Request data:', { rideId, tempFilePath });
      
      if (!rideId || !tempFilePath) {
        console.log('Missing fields:', { rideId: !!rideId, tempFilePath: !!tempFilePath});
        return res.status(400).json({ message: "Missing required fields" });
      }
      console.log('Required fields present.'); // ADDED LOGGING

      // Read and parse the GPX file from the temporary path on the backend
      console.log(`[link-organizer-gpx] Reading and parsing GPX file from: ${tempFilePath}`); // ADDED LOGGING
      const gpxData = await parseGPXFile(tempFilePath); // READ AND PARSE GPX DATA HERE
      console.log('[link-organizer-gpx] GPX data parsed:', gpxData); // ADDED LOGGING

      if (!gpxData || !gpxData.startTime || isNaN(gpxData.startTime.getTime())) {
         console.error('[link-organizer-gpx] Failed to parse GPX data from temp file or invalid data.'); // ADDED LOGGING
         return res.status(400).json({ message: "Failed to process GPX file or invalid data." });
      }
      console.log('GPX data successfully parsed and validated.'); // ADDED LOGGING

      // Verify user is the organizer of this ride
      console.log(`[link-organizer-gpx] Verifying user ${userId} is organizer of ride ${rideId}`); // ADDED LOGGING
      const ride = await storage.getRide(rideId);
      if (!ride || ride.organizerId !== userId) {
        console.warn(`[link-organizer-gpx] User ${userId} is not authorized to link GPX to ride ${rideId}.`); // ADDED LOGGING
        return res.status(403).json({ message: "Not authorized - you are not the organizer of this ride" });
      }
      console.log('User is authorized as organizer.'); // ADDED

      // Check if organizer GPX already exists for this ride
      console.log(`[link-organizer-gpx] Checking for existing organizer GPX for ride ${rideId}`); // ADDED LOGGING
      const existingOrganizerGpx = await storage.getOrganizerGpxForRide(rideId);
      console.log(`[link-organizer-gpx] Existing organizer GPX found: ${!!existingOrganizerGpx}`); // ADDED LOGGING
      if (existingOrganizerGpx) {
        console.warn(`[link-organizer-gpx] Ride ${rideId} already has organizer GPX data linked.`); // ADDED LOGGING
        return res.status(400).json({ message: "This ride already has organizer GPX data linked" });
      }
      console.log('No existing organizer GPX found.'); // ADDED


       // --- CREATE ORGANIZER GPX RECORD HERE ---
       console.log('Creating organizer GPX record upon manual linking confirmation.');

       // You'll need originalGpxPath for the organizerGpx record.
       // It's already fetched in the 'ride' object above.
       const originalGpxPath = ride.gpxFilePath; // Use the planned route GPX path from the ride record

      // Create organizer GPX record with manual linking
      const organizerGpx = await storage.createOrganizerGpx({
        rideId,
        organizerId: userId,
        gpxFilePath: tempFilePath,
        originalGpxPath: originalGpxPath,
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
      console.log(`Organizer GPX record created with ID: ${organizerGpx.id} for ride ${rideId}.`);

      // --- CALCULATE AND AWARD XP ---
      console.log('[link-organizer-gpx] Calculating and awarding XP...'); // ADDED LOGGING
      const distance = gpxData.distance || 0;
      const elevationGain = gpxData.elevationGain || 0;
      const averageSpeed = gpxData.averageSpeed || 0;

      const xpFromDistance = Math.round(distance * 0.05);
      const xpFromElevation = Math.round(elevationGain * 0.01);
      const xpFromSpeed = Math.round(averageSpeed * 0.1);
      const organizerActivityXp = xpFromDistance + xpFromElevation + xpFromSpeed;
      const roundedOrganizerActivityXp = Math.round(organizerActivityXp);
      console.log(`Organizer activity-based XP calculated on manual link: ${roundedOrganizerActivityXp}`);

      const organizingBonusXp = 1; // Award organizing bonus upon linking
      const organizerJoiningBonus = 1
      
      // Total earned XP includes activity XP, standard organizing XP, and joining bonus
      const earnedXp = xpFromDistance + xpFromElevation + xpFromSpeed + organizingBonusXp + organizerJoiningBonus;
      const roundedEarnedXp = Math.round(earnedXp);

      console.log(`Calculating XP for organizer GPX link: Distance XP=${xpFromDistance}, Elevation XP=${xpFromElevation}, Speed XP=${xpFromSpeed}, Organizing Bonus=${organizingBonusXp}. Total Earned XP=${roundedEarnedXp}`);

      // --- CREATE ORGANIZER GPX RECORD HERE ---
           // Create organizer GPX record with manual linking and activity XP
           //const organizerGpx = await storage.createOrganizerGpx({
            //rideId,
            //organizerId: userId,
            //gpxFilePath: tempFilePath,
            //originalGpxPath: ride.gpxFilePath,
            //matchScore: "0.00",
            //isManuallyLinked: true,
            //distance: gpxData.distance?.toString(),
            //duration: gpxData.duration,
            //movingTime: gpxData.movingTime,
            //elevationGain: gpxData.elevationGain?.toString(),
            //averageSpeed: gpxData.averageSpeed?.toString(),
            //averageHeartRate: gpxData.averageHeartRate,
            //maxHeartRate: gpxData.maxHeartRate,
            //calories: gpxData.calories,
            //xpEarned: roundedOrganizerActivityXp, // Store activity-based XP
            //xpDistance: xpFromDistance,
            //xpElevation: xpFromElevation,
            //xpSpeed: xpFromSpeed,
            //xpOrganizingBonus: 0, // Bonuses awarded now
          //});
          console.log(`Organizer GPX record created with ID: ${organizerGpx.id} for ride ${rideId}.`);

          // Award activity-based XP (if not already awarded on initial upload - check your flow)
          // If this manual link is for a file NOT uploaded via /api/organizer-gpx, you need to award it here.
          // If it IS uploaded via /api/organizer-gpx, it's already awarded. You might need a flag.
          // Assuming for simplicity it's always awarded here on link if activity XP > 0:
           if (roundedOrganizerActivityXp > 0) {
               await storage.incrementUserXP(userId, roundedOrganizerActivityXp);
               console.log(`Added ${roundedOrganizerActivityXp} activity-based XP to organizer ${userId} on manual GPX link.`);
           }


          // --- Award Fixed Organizing Bonus and Standard Organizing Bonus (Manual Link) ---
          const fixedOrganizingBonusXp = 2; // Fixed bonus for organizing
          const standardOrganizingBonusXp = 1; // Standard bonus
          const totalLinkingBonuses = fixedOrganizingBonusXp + standardOrganizingBonusXp; // Total bonuses for linking

          console.log(`Awarding Fixed Organizing Bonus (${fixedOrganizingBonusXp}) and Standard Organizing Bonus (${standardOrganizingBonusXp}) for manual link.`);

          if (totalLinkingBonuses > 0) {
               await storage.incrementUserXP(userId, totalLinkingBonuses);
               console.log(`Added ${totalLinkingBonuses} linking bonuses XP to organizer ${userId} for manually linked ride ${rideId}.`);
                // Update the organizer GPX record to include these bonuses in xpOrganizingBonus and update total earned
                await storage.updateOrganizerGpx(organizerGpx.id, {
                   // Handle potential nulls using nullish coalescing (?? 0)
                   xpOrganizingBonus: (organizerGpx.xpOrganizingBonus ?? 0) + totalLinkingBonuses, // Store the combined bonuses
                   xpEarned: (organizerGpx.xpEarned ?? 0) + totalLinkingBonuses, // Add linking bonuses to total earned XP
                });
          }
          // --- End Award Bonuses ---

      // Update the newly created organizer GPX record with XP details
      console.log(`Updating organizer GPX record ${organizerGpx.id} with XP.`);
      await storage.updateOrganizerGpx(organizerGpx.id, { // <-- Assuming storage.updateOrganizerGpx function
          xpEarned: roundedEarnedXp,
          xpDistance: xpFromDistance,
          xpElevation: xpFromElevation,
          xpSpeed: xpFromSpeed,
          xpOrganizingBonus: organizingBonusXp + organizerJoiningBonus,
          // isManuallyLinked is already true
          // Update other fields if necessary (matchScore, etc.)
      });
      console.log(`Organizer GPX record ${organizerGpx.id} updated with XP.`);

      // Increment user's total XP
      if (roundedEarnedXp > 0) {
        await storage.incrementUserXP(userId, roundedEarnedXp);
        console.log(`Added ${roundedEarnedXp} XP to organizer ${userId} for linked organizer GPX.`);
      }
      // --- END CALCULATE AND AWARD XP ---


      // Mark ride as completed
      console.log(`Calling storage.completeRide for ride ${rideId} triggered by organizer GPX link.`);
      await storage.completeRide(rideId, userId);
      console.log(`Ride ${rideId} marked as completed by organizer ${userId}.`);

      
      // Process participant proximity matching
      console.log(`Starting retroactive matching for pending participant activities for ride ${rideId}.`);
      await storage.processPendingActivityMatches(rideId, organizerGpx.id, tempFilePath, proximityMatcher);
      console.log(`Finished retroactive matching for ride ${rideId}.`);
      
      res.json({
        type: 'organizer_manual_linked',
        message: `Successfully linked GPX to your organized ride "${ride.name}"`,
        rideName: ride.name,
        rideId: rideId
      });
    } catch (error) {
      console.error("Link organizer GPX error:", error);
      // Ensure error is an Error object to access message property
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      // Now you can access rideId here for logging if needed (though it might be undefined if the error occurred before assignment)
      console.error(`Error processing ride ID: ${rideId}`, error); // Example usage in catch
      res.status(500).json({ message: "Internal server error", error: errorMessage }); // MODIFIED: Include error message in JSON
      console.log('--- Finished /api/link-organizer-gpx endpoint execution (error) ---'); // ADDED
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


// Upload organizer GPX for planned ride
app.post("/api/organizer-gpx", requireAuth, upload.single("gpx"), async (req, res) => {
  console.log('--- Starting /api/organizer-gpx endpoint execution ---');
  try {
    const userId = req.userId!;
    const file = req.file;

    if (!file) {
      console.log('No GPX file provided');
      return res.status(400).json({ message: "No GPX file provided" });
    }
    console.log('GPX file provided:', file.originalname);
    console.log('GPX file path:', file.path);

    // Parse GPX file to extract activity data
    console.log('Before calling parseGPXFile for organizer GPX');
    const gpxData = await parseGPXFile(file.path);
    console.log('gpxData after parsing organizer GPX:', gpxData);

    // Validate GPX data has valid start time
    if (!gpxData.startTime || isNaN(gpxData.startTime.getTime())) {
      console.log('Invalid GPX file: missing or malformed timestamp data');
      return res.status(400).json({ message: "Invalid GPX file: missing or malformed timestamp data" });
    }
    console.log('GPX data validated');

    // --- Calculate and Award Organizer Activity-Based XP Immediately ---
    const distance = gpxData.distance || 0;
    const elevationGain = gpxData.elevationGain || 0;
    const averageSpeed = gpxData.averageSpeed || 0;

    const xpFromDistance = Math.round(distance * 0.05);
    const xpFromElevation = Math.round(elevationGain * 0.01);
    const xpFromSpeed = Math.round(averageSpeed * 0.1);
    const organizerActivityXp = xpFromDistance + xpFromElevation + xpFromSpeed;
    const roundedOrganizerActivityXp = Math.round(organizerActivityXp);
    console.log(`Organizer activity-based XP calculated on upload: ${roundedOrganizerActivityXp}`);

    // Award activity-based XP immediately
    if (roundedOrganizerActivityXp > 0) {
        await storage.incrementUserXP(userId, roundedOrganizerActivityXp); // Assuming storage.incrementUserXP exists
        console.log(`Added ${roundedOrganizerActivityXp} activity-based XP to organizer ${userId} on GPX upload.`);
    }

    // Get organizer's planned rides on the same date
    const activityDate = new Date(gpxData.startTime ?? new Date()); // Use nullish coalescing to provide a fallback Date
    const plannedRides = await storage.getOrganizerPlannedRides(userId, activityDate);

    console.log(`Checking ${plannedRides.length} planned rides for auto-matching organizer GPX`);

    // Try to auto-match with planned rides (70% similarity threshold)
    console.log('Before calling proximityMatcher.matchOrganizerGpx for organizer auto-match');
    const autoMatch = await proximityMatcher.matchOrganizerGpx(gpxData, plannedRides);
    console.log('After calling proximityMatcher.matchOrganizerGpx for organizer auto-match, autoMatch:', autoMatch);

    if (autoMatch) {
      // Auto-match found - link directly
      console.log('Organizer auto-match successful, creating organizer GPX record.');

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
        xpEarned: roundedOrganizerActivityXp, // Store activity-based XP
        xpDistance: xpFromDistance,
        xpElevation: xpFromElevation,
        xpSpeed: xpFromSpeed,
        xpOrganizingBonus: 0,
      });
      console.log(`Organizer GPX record created with ID: ${organizerGpx.id} for ride ${autoMatch.rideId}`);

       // --- Award Fixed Organizing Bonus and Standard Organizing Bonus (Auto-match) ---
       const fixedOrganizingBonusXp = 2; // Fixed bonus for organizing
       const standardOrganizingBonusXp = 1; // Standard bonus (based on previous definition) - Decide if you keep this
       const totalLinkingBonuses = fixedOrganizingBonusXp + standardOrganizingBonusXp; // Total bonuses for linking

       console.log(`Awarding Fixed Organizing Bonus (${fixedOrganizingBonusXp}) and Standard Organizing Bonus (${standardOrganizingBonusXp}) for auto-matched ride.`);

       if (totalLinkingBonuses > 0) {
            await storage.incrementUserXP(userId, totalLinkingBonuses);
            console.log(`Added ${totalLinkingBonuses} linking bonuses XP to organizer ${userId} for auto-matched ride ${autoMatch.rideId}.`);
            // Update the organizer GPX record to include these bonuses in xpOrganizingBonus
             await storage.updateOrganizerGpx(organizerGpx.id, { // Assuming storage.updateOrganizerGpx exists
                xpOrganizingBonus: totalLinkingBonuses, // Store the combined bonuses
                xpEarned: (organizerGpx.xpEarned ?? 0) + totalLinkingBonuses, // Add linking bonuses to total earned XP
             });
       }

      // Mark ride as completed by the organizer
      console.log(`Calling storage.completeRide for ride ${autoMatch.rideId} triggered by organizer GPX upload.`);
      await storage.completeRide(autoMatch.rideId, userId); // Pass userId as organizer
      console.log(`Ride ${autoMatch.rideId} marked as completed by organizer ${userId}.`);

      // --- Retroactive Matching for Participants ---
      console.log(`Starting retroactive matching for pending participant activities for ride ${autoMatch.rideId}.`);
      await storage.processPendingActivityMatches(autoMatch.rideId, organizerGpx.id, file.path, proximityMatcher); // Use autoMatch.rideId here
      console.log(`Finished retroactive matching for ride ${autoMatch.rideId}.`);
      // --- End Retroactive Matching ---


      res.json({
        type: 'organizer_auto_matched',
        message: `Automatically matched to your organized ride \"${autoMatch.rideName}\" with ${autoMatch.matchScore.toFixed(1)}% similarity`,
        organizerGpx,
        autoMatched: true,
        matchScore: autoMatch.matchScore,
        rideName: autoMatch.rideName,
      });
    } else {
      // No auto-match - create unlinked GPX for manual selection by the organizer
      console.log('No automatic match found for organizer GPX. Creating unlinked organizer GPX record.');
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
         // XP is not calculated at this stage for unlinked organizer GPX
      });
      console.log(`Unlinked organizer GPX record created with ID: ${organizerGpx.id}`);

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


// New helper function to process pending participant matches for a specific ride
async function processPendingParticipantMatchesForRide(rideId: number, organizerGpxId: number, organizerGpxPath: string) {
    console.log(`Processing pending participant matches for ride ${rideId}`);
    // Fetch the ride details to get the organizer ID
    const ride = await storage.getRide(rideId); // ADDED: Fetch the ride object

    if (!ride) {
         console.warn(`Ride ${rideId} not found during pending participant matching.`);
         return; // Exit if ride is not found
    }

    // Get all activity_match records for this ride that are pending proximity match
    const pendingActivityMatches = await storage.getPendingActivityMatchesForRide(rideId);
    try {
        // Get all activity_match records for this ride that are pending proximity match
        const pendingActivityMatches = await storage.getPendingActivityMatchesForRide(rideId);

        console.log(`Found ${pendingActivityMatches.length} pending activity matches for ride ${rideId}.`);

        for (const pendingMatch of pendingActivityMatches) {
            try {
                console.log(`Processing pending match for user ${pendingMatch.userId} with activity match ID ${pendingMatch.id}.`);
                // Retrieve the participant's GPX data
                 // We need to fetch the gpxData again from the stored path
                 const participantGpxData = await parseGPXFile(pendingMatch.gpxFilePath);

                 if (!participantGpxData || !participantGpxData.startTime || isNaN(participantGpxData.startTime.getTime())) {
                     console.warn(`Could not parse participant GPX for pending match ${pendingMatch.id} or invalid data.`);
                     // Optionally update the activity_match to reflect parsing failure
                     // await storage.updateActivityMatch(pendingMatch.id, { isMatchFailed: true, isPendingProximityMatch: false });
                     continue; // Skip this pending match
                 }

                // Perform the proximity match calculation
                console.log(`Attempting proximity match for user ${pendingMatch.userId} using organizer GPX ${organizerGpxPath} and participant GPX ${pendingMatch.gpxFilePath}`);
                const proximityResult = await proximityMatcher.checkParticipantProximity(
                    organizerGpxPath, // Newly uploaded organizer's actual GPX
                    pendingMatch.gpxFilePath // Participant's uploaded GPX
                );
                console.log(`Proximity match result for user ${pendingMatch.userId}: ${proximityResult.proximityScore.toFixed(1)}%`);


                // Check if the match score is 50% or higher
                const matchScore = proximityResult.proximityScore * 100; // Convert to percentage

                if (matchScore >= 50) {
                    console.log(`Match score ${matchScore.toFixed(2)}% >= 50% for user ${pendingMatch.userId}. Linking activity.`);
                    // Update the activity_match record with match results
                    await storage.updateActivityMatch(pendingMatch.id, {
                        organizerGpxId: organizerGpxId, // Link to the organizer's GPX file
                        routeMatchPercentage: matchScore.toFixed(2),
                        proximityScore: proximityResult.proximityScore.toFixed(2),
                        matchedPoints: proximityResult.matchedPoints,
                        totalOrganizerPoints: proximityResult.totalOrganizerPoints,
                        isCompleted: proximityResult.isCompleted, // Update completion status based on match
                        isPendingProximityMatch: false, // No longer pending
                        isRetroactivelyMatched: true, // Mark as retroactively matched
                        isMatchFailed: false, // Ensure failed flag is false
                    });
                    console.log(`Activity match ${pendingMatch.id} updated and linked for user ${pendingMatch.userId}.`);

                    // Update the corresponding solo activity to reflect it's now a matched ride activity
                    if (pendingMatch.soloActivityId) {
                         console.log(`Updating linked solo activity ${pendingMatch.soloActivityId} for user ${pendingMatch.userId}.`);
                         await storage.updateSoloActivity(pendingMatch.soloActivityId, {
                             name: `Matched Ride Activity: ${participantGpxData.name || 'Unnamed Activity'}`, // Adjust based on your GpxData structure
                             description: `Activity matched to ride ${rideId}`, // Update description
                             // Consider adding a rideId foreign key to solo_activities and updating it here
                             // rideId: rideId,
                             // You might also want to clear deviceName and deviceType if they are now represented by the ride
                             // deviceName: null,
                             // deviceType: null,
                         });
                         console.log(`Solo activity ${pendingMatch.soloActivityId} updated.`);
                    } else {
                        console.warn(`Activity match ${pendingMatch.id} is missing soloActivityId.`);
                    }

                    // If the proximity match indicates completion, update the participant's ride completion status
                    if (proximityResult.isCompleted) {
                         console.log(`Proximity match indicates completion for user ${pendingMatch.userId} on ride ${rideId}.`);
                         // You might want a separate function in storage to mark participant ride completion
                         // await storage.markParticipantRideCompleted(rideId, pendingMatch.userId);
                    }
                // Update the activity_match record with match results
                await storage.updateActivityMatch(pendingMatch.id, {
                  organizerGpxId: organizerGpxId, // Link to the organizer's GPX file
                  routeMatchPercentage: matchScore.toFixed(2),
                  proximityScore: proximityResult.proximityScore.toFixed(2),
                  matchedPoints: proximityResult.matchedPoints,
                  totalOrganizerPoints: proximityResult.totalOrganizerPoints,
                  isCompleted: proximityResult.isCompleted, // Update completion status based on match
                  isPendingProximityMatch: false, // No longer pending
                  isRetroactivelyMatched: true, // Mark as retroactively matched
                  isMatchFailed: false, // Ensure failed flag is false
                });
                console.log(`[storage] Activity match ${pendingMatch.id} updated and linked for user ${pendingMatch.userId}.`);


                // --- Award Incremental Participant Bonus to Others ---
                console.log(`Awarding incremental participant bonus to others for retroactive match of user ${pendingMatch.userId}.`); // ADDED
                 try {
                    // Find other participants who have linked their activities to this ride
                    const linkedParticipants = await storage.getParticipantsWithLinkedActivitiesForRide(rideId);

                    const incrementalParticipantBonus = 0.5; // Define the incremental participant bonus

                    for (const participant of linkedParticipants) {
                        // Ensure we don't award the bonus to the currently matched participant or the organizer
                        // Also ensure the other participant's activity is also successfully matched (not pending or failed)
                         const otherParticipantActivityMatch = await storage.getUserActivityForRide(rideId, participant.userId);

                         if (participant.userId !== pendingMatch.userId && participant.userId !== ride.organizerId && otherParticipantActivityMatch && !otherParticipantActivityMatch.isPendingProximityMatch && !otherParticipantActivityMatch.isMatchFailed) {
                             console.log(`Awarding ${incrementalParticipantBonus} incremental XP to participant ${participant.userId} for retroactive match of user ${pendingMatch.userId} on ride ${rideId}.`); // ADDED
                             await storage.incrementUserXP(participant.userId, incrementalParticipantBonus);
                              // Optionally update their activity_match record to show this bonus was awarded
                         }
                    }
                  } catch (incrementalParticipantError) {
                     console.error('Error awarding incremental participant XP during retroactive matching:', incrementalParticipantError); // ADDED
                  }
                // --- End Award Incremental Participant Bonus to Others ---


                // If the proximity match indicates completion, update the participant's ride completion status
                if (proximityResult.isCompleted) {
                     console.log(`Proximity match indicates completion for user ${pendingMatch.userId} on ride ${rideId}.`);
                     // You might want a separate function in storage to mark participant ride completion
                     // await storage.markParticipantRideCompleted(rideId, pendingMatch.userId);
                }


                } else {
                    console.log(`Match score ${matchScore.toFixed(2)}% < 50% for user ${pendingMatch.userId}. Keeping as solo activity.`);
                    // Update the activity_match record to indicate match failed
                     await storage.updateActivityMatch(pendingMatch.id, {
                        organizerGpxId: organizerGpxId, // Link to the organizer's GPX file
                        routeMatchPercentage: matchScore.toFixed(2),
                        proximityScore: proximityResult.proximityScore.toFixed(2),
                        matchedPoints: proximityResult.matchedPoints,
                        totalOrganizerPoints: proximityResult.totalOrganizerPoints,
                        isCompleted: false, // Not completed based on proximity
                        isPendingProximityMatch: false, // No longer pending
                        isRetroactivelyMatched: true, // Mark as retroactively processed
                        isMatchFailed: true, // Mark as match failed
                    });
                     console.log(`Activity match ${pendingMatch.id} marked as match failed for user ${pendingMatch.userId}.`);
                    // The corresponding solo activity remains as is.
                }

            } catch (participantMatchError) {
                console.error(`Error processing pending participant match ${pendingMatch.id}:`, participantMatchError);
                // In case of an error processing a single pending match, log it and continue with the next.
                 // You might want to update the activity_match to reflect the error.
                 // await storage.updateActivityMatch(pendingMatch.id, { isMatchFailed: true, isPendingProximityMatch: false });
            }
        }

    } catch (error) {
        console.error('Error in processPendingParticipantMatchesForRide:', error);
        // Handle errors in fetching pending matches or the overall process
      }
    }


// New endpoint for manual participant GPX linking
app.post("/api/link-participant-gpx", requireAuth, async (req, res) => {
  console.log('--- Starting /api/link-participant-gpx endpoint execution ---'); // ADDED
  console.log('Raw request body:', req.body); // <-- Add this line to log the raw body
  try {
    const userId = req.userId!;
    const { rideId, tempFilePath } = req.body; // gpxData will be the parsed data sent from the frontend

    console.log('Link participant GPX request body:', req.body); // ADDED
    console.log('Request data:', { rideId, tempFilePath }); // ADDED

    if (!rideId || !tempFilePath) {
      console.log('Missing fields for participant link:', { rideId: !!rideId, tempFilePath: !!tempFilePath });
      return res.status(400).json({ message: "Missing required fields" });
    }
    console.log('Required fields present.'); // ADDED

    // Read and parse the GPX file from the temporary path on the backend
    console.log(`[link-participant-gpx] Reading and parsing GPX file from: ${tempFilePath}`); // ADDED LOGGING
    const gpxData = await parseGPXFile(tempFilePath); // READ AND PARSE GPX DATA HERE
    console.log('[link-participant-gpx] GPX data parsed:', gpxData); // ADDED LOGGING

    if (!gpxData || !gpxData.startTime || isNaN(gpxData.startTime.getTime())) {
       console.error('[link-participant-gpx] Failed to parse GPX data from temp file or invalid data.'); // ADDED LOGGING
       return res.status(400).json({ message: "Failed to process GPX file or invalid data." });
    }
    console.log('GPX data successfully parsed and validated.'); // ADDED LOGGING

    // Verify user is a participant of this ride
    console.log(`Checking if user ${userId} is a participant of ride ${rideId}`); // ADDED
    const isParticipant = await storage.isUserJoined(rideId, userId);
    console.log(`User ${userId} is participant of ride ${rideId}: ${isParticipant}`); // ADDED
      if (!isParticipant) {
      return res.status(403).json({ message: "Not authorized - you are not a participant of this ride" });
    }
    console.log('User is authorized.'); // ADDED


    // Check if user already has activity data for this ride
    console.log(`Checking for existing activity for user ${userId} on ride ${rideId}`); // ADDED
    const existingActivity = await storage.getUserActivityForRide(rideId, userId);
    console.log(`Existing activity found: ${!!existingActivity}`); // ADDED
    if (existingActivity) {
      console.log(`Existing activity found for ride ${rideId}, cannot link again.`);
      return res.status(400).json({ message: "You have already linked an activity to this ride." });
    }
    console.log('No existing activity found.'); // ADDED


    // Calculate XP breakdown from GPX data (ONLY activity-based XP)
    console.log('Calculating activity-based XP breakdown from GPX data'); // ADDED
    const distance = gpxData.distance || 0;
    const elevationGain = gpxData.elevationGain || 0;
    const averageSpeed = gpxData.averageSpeed || 0;

    const xpFromDistance = Math.round(distance * 0.05);
    const xpFromElevation = Math.round(elevationGain * 0.01);
    const xpFromSpeed = Math.round(averageSpeed * 0.1);

    // Calculate total activity-based earned XP
    const activityBasedEarnedXp = xpFromDistance + xpFromElevation + xpFromSpeed; // Renamed for clarity
    const roundedActivityBasedEarnedXp = Math.round(activityBasedEarnedXp); // Renamed for clarity
    console.log(`Calculated activity-based earned XP: ${roundedActivityBasedEarnedXp}`); // ADDED

    const participantJoiningBonus = 0.5; // Define the participant joining bonus
    console.log(`Defined participant joining bonus: ${participantJoiningBonus}`); // ADDED


    // Check if organizer's GPX is available for this ride
    console.log(`Checking for organizer GPX for ride ${rideId}`); // ADDED
    const organizerGpx = await storage.getOrganizerGpxForRide(rideId);
    console.log(`Organizer GPX found: ${!!organizerGpx}`); // ADDED


    let isPendingProximityMatch = true;
    let matchScore = "0.00"; // Default to 0 until matched
    let organizerGpxId: number | null = null; // Initialize as nullable number
    let proximityMatchedPoints: number | null = null; // Initialize as nullable number
    let proximityTotalOrganizerPoints: number | null = null; // Initialize as nullable number
    let isProximityCompleted = false;


    if (organizerGpx) {
      console.log(`Organizer GPX found for ride ${rideId}. Attempting immediate proximity match.`);
      try {
          console.log(`Parsing organizer GPX: ${organizerGpx.gpxFilePath}`); // ADDED
          const organizerGpxData = await parseGPXFile(organizerGpx.gpxFilePath);
          console.log(`Organizer GPX parsed: ${!!organizerGpxData}`); // ADDED
          if (organizerGpxData) {
               console.log('Performing proximity match.'); // ADDED
               const proximityResult = await proximityMatcher.checkParticipantProximity(
                   organizerGpx.gpxFilePath, // Organizer's actual GPX path
                   tempFilePath // Participant's uploaded GPX path
               );
               console.log(`Proximity match result: ${JSON.stringify(proximityResult)}`); // ADDED


               matchScore = (proximityResult.proximityScore * 100).toFixed(2);
               organizerGpxId = organizerGpx.id; // Link to the organizer's GPX file
               proximityMatchedPoints = proximityResult.matchedPoints;
               proximityTotalOrganizerPoints = proximityResult.totalOrganizerPoints;
               isProximityCompleted = proximityResult.isCompleted;

               isPendingProximityMatch = false; // Not pending, matched immediately
               console.log(`Immediate proximity match successful. Match Score: ${matchScore}%`); // ADDED

               // If immediately matched, update participant's ride completion status
               if (isProximityCompleted) {
                   console.log(`Participant ${userId} completed ride ${rideId} based on immediate proximity match.`);
                   // You might want a separate function in storage to mark participant ride completion
                   // await storage.markParticipantRideCompleted(rideId, userId);
               }

          } else {
               console.warn(`Could not parse organizer GPX for ride ${rideId} during manual participant link.`);
               // ADDED: Return error response if organizer GPX parsing fails
               return res.status(400).json({ message: "Could not process organizer GPX for matching." });
          }
      } catch (matchError) {
          console.error('Error during immediate proximity match for participant link:', matchError);
          // ADDED: Return error response if immediate proximity match fails
          return res.status(500).json({ message: "Error during proximity matching." });
      }
    } else {
      console.log(`Organizer GPX not found for ride ${rideId}. Marking activity match as pending proximity match.`);
      // isPendingProximityMatch remains true
      // No return needed here, as the flow continues to create a pending activity match
    }
    console.log('Finished proximity match check.'); // ADDED


    // Create a solo activity first
    console.log('Creating solo activity for manual participant link (initially)'); // ADDED
    const soloActivity = await storage.createSoloActivity({
      name: `Ride Activity - ${new Date().toLocaleDateString()}`, // Generic name initially
      description: `Activity for joined ride ${rideId}`, // Generic description initially
      activityType: 'cycling', // Assuming cycling
      gpxFilePath: tempFilePath,
      distance: gpxData.distance?.toString(),
      duration: gpxData.duration,
      movingTime: gpxData.movingTime,
      elevationGain: gpxData.elevationGain?.toString(),
      averageSpeed: gpxData.averageSpeed?.toString(),
      averageHeartRate: gpxData.averageHeartRate,
      maxHeartRate: gpxData.maxHeartRate,
      calories: gpxData.calories,
      deviceName: gpxData.deviceName || 'Manual Upload',
      deviceType: gpxData.deviceType || 'manual',
      completedAt: new Date(), // Or use gpxData.startTime if available and reliable
      userId,
      xpEarned: roundedActivityBasedEarnedXp, // Award XP based on activity data immediately
      xpDistance: xpFromDistance,
      xpElevation: xpFromElevation,
      xpSpeed: xpFromSpeed,
    });
    console.log('Solo activity created with ID:', soloActivity.id); // ADDED


    // Create activity match record, linking to the solo activity
    console.log('Before creating activity match record for participant manual link'); // ADDED
    const activityMatch = await storage.createActivityMatch({
      rideId,
      userId,
      deviceId: gpxData.deviceName || 'manual-upload',
      routeMatchPercentage: matchScore, // Will be 0 or calculated
      gpxFilePath: tempFilePath,
      distance: gpxData.distance?.toString() ?? null,
      duration: gpxData.duration ?? null,
      movingTime: gpxData.movingTime,
      elevationGain: gpxData.elevationGain?.toString() ?? null,
      averageSpeed: gpxData.averageSpeed?.toString() ?? null,
      averageHeartRate: gpxData.averageHeartRate ?? null,
      maxHeartRate: gpxData.maxHeartRate ?? null,
      calories: gpxData.calories ?? null,
      completedAt: new Date(), // Or use gpxData.startTime
      xpEarned: roundedActivityBasedEarnedXp, // Store activity-based earned XP in activityMatch
      xpDistance: xpFromDistance,
      xpElevation: xpFromElevation,
      xpSpeed: xpFromSpeed,
      xpOrganizingBonus: 0, // No organizing bonus for participants
      organizerGpxId: organizerGpxId,
      proximityScore: parseFloat(matchScore).toFixed(2),
      matchedPoints: proximityMatchedPoints,
      totalOrganizerPoints: proximityTotalOrganizerPoints,
      isCompleted: isProximityCompleted,
      isPendingProximityMatch: isPendingProximityMatch,
      soloActivityId: soloActivity.id,
    });
      console.log('Activity match record created with ID:', activityMatch.id); // ADDED
      
  // --- Award Incremental Participant Bonus to Others ---
  console.log(`Checking for other linked participants for ride ${rideId} to award incremental bonus upon successful link.`); // ADDED
  try {
    // Find other participants who have linked their activities to this ride
    // This function needs to be implemented in storage.ts as discussed
    const linkedParticipants = await storage.getParticipantsWithLinkedActivitiesForRide(rideId);
    console.log(`Found ${linkedParticipants.length} other participants with linked activities for ride ${rideId}.`); // ADDED

    const incrementalParticipantBonus = 0.5; // Define the incremental participant bonus

    for (const participant of linkedParticipants) {
        // Ensure we don't award the bonus to the currently linking participant
        // Also ensure the other participant's activity is also successfully matched (not pending or failed)
         const otherParticipantActivityMatch = await storage.getUserActivityForRide(rideId, participant.userId);

         if (participant.userId !== userId && otherParticipantActivityMatch && !otherParticipantActivityMatch.isPendingProximityMatch && !otherParticipantActivityMatch.isMatchFailed) {
             console.log(`Awarding ${incrementalParticipantBonus} incremental XP to participant ${participant.userId} for user ${userId}'s linked activity on ride ${rideId}.`); // ADDED
             await storage.incrementUserXP(participant.userId, incrementalParticipantBonus);
              // Optionally update their activity_match record to show this bonus was awarded
         }
    }
  } catch (incrementalParticipantError) {
     console.error('Error awarding incremental participant XP during initial linking:', incrementalParticipantError); // ADDED
  }
  // --- End Award Incremental Participant Bonus to Others ---

  // --- Award Incremental Participant Bonus ---
  console.log(`Checking for other linked participants for ride ${rideId} to award incremental bonus.`); // ADDED
  try {
    // Find other participants who have linked their activities to this ride
    // You need a storage function to get participants with linked activities for a ride
    const linkedParticipants = await storage.getParticipantsWithLinkedActivitiesForRide(rideId);
    console.log(`Found ${linkedParticipants.length} other participants with linked activities for ride ${rideId}.`); // ADDED

    const incrementalParticipantBonus = 0.5; // Define the incremental participant bonus

    for (const participant of linkedParticipants) {
        // Ensure we don't award the bonus to the currently linking participant again
        if (participant.userId !== userId) {
            console.log(`Awarding ${incrementalParticipantBonus} incremental XP to participant ${participant.userId} for linked activity on ride ${rideId}.`); // ADDED
            await storage.incrementUserXP(participant.userId, incrementalParticipantBonus);

            // You might also want to update their activity_match record to show this bonus was awarded
            // This would require fetching their specific activity_match record for this ride
             const participantActivityMatch = await storage.getUserActivityForRide(rideId, participant.userId);
             if (participantActivityMatch) {
                 // Assuming you have an xpIncrementalParticipantBonus field in activity_match
                 // You might need to add this field if it doesn't exist
                 // await storage.updateActivityMatch(participantActivityMatch.id, {
                 //    xpIncrementalParticipantBonus: (participantActivityMatch.xpIncrementalParticipantBonus || 0) + incrementalParticipantBonus
                 // });
             }
        }
    }
  } catch (incrementalParticipantError) {
     console.error('Error awarding incremental participant XP:', incrementalParticipantError); // ADDED
  }
  // --- End Award Incremental Participant Bonus ---

   // Increment the user's total XP immediately for the solo activity.
  let participantRecord; // Declare with let outside the inner try block


   try {
    participantRecord = await db // Assign to the outer scope participantRecord
        .select()
        .from(rideParticipants)
        .where(and(eq(rideParticipants.rideId, rideId), eq(rideParticipants.userId, userId)))
        .limit(1);

    if (participantRecord.length > 0 && participantRecord[0].xpJoiningBonus === 0) {
        await db
            .update(rideParticipants)
            .set({ xpJoiningBonus: participantJoiningBonus })
            .where(eq(rideParticipants.id, participantRecord[0].id));

        console.log(`Awarded ${participantJoiningBonus} joining bonus XP to participant ${userId} for ride ${rideId}.`);

        // Increment the user's total XP with the joining bonus and activity-based XP
        const totalXpToAward = participantJoiningBonus + roundedActivityBasedEarnedXp;
        if (totalXpToAward > 0) {
            await storage.incrementUserXP(userId, totalXpToAward);
            console.log(`Added ${totalXpToAward} total XP (Joining Bonus + Activity) to user ${userId}.`);
        }

    } else if (participantRecord.length > 0 && participantRecord[0] && participantRecord[0].xpJoiningBonus !== null && participantRecord[0].xpJoiningBonus > 0) { // MODIFIED: Added participantRecord[0] check and explicit null check for xpJoiningBonus
        console.log(`Joining bonus already awarded to participant ${userId} for ride ${rideId}. Skipping joining bonus.`);

        // Still increment user's total XP with only the activity-based XP if it's positive
        if (roundedActivityBasedEarnedXp > 0) {
             await storage.incrementUserXP(userId, roundedActivityBasedEarnedXp);
             console.log(`Added ${roundedActivityBasedEarnedXp} activity-based XP to user ${userId} (joining bonus already awarded).`);
        }

    } else {
        console.warn(`Ride participant record not found for user ${userId} on ride ${rideId}. Cannot award joining bonus or activity XP.`);
        // Consider returning an error here or handling this unexpected state
         return res.status(500).json({ message: "Internal server error: Participant record not found." });
    }
} catch (xpAwardError) {
    console.error('Error awarding participant XP:', xpAwardError);
    // Decide how to handle this error - log, potentially rollback, etc.
     return res.status(500).json({ message: "Internal server error during XP award." });
}


  // If immediately matched, update the solo activity to reflect the match
  if (!isPendingProximityMatch) {
      console.log(`Activity immediately matched, updating solo activity ${soloActivity.id}.`); // ADDED
      await storage.updateSoloActivity(soloActivity.id, {
           name: `Matched Ride Activity: ${gpxData.name || 'Unnamed Activity'}`, // Update name to reflect match
           description: `Activity matched to ride ${rideId}`, // Update description
           // You might want to add a rideId foreign key to solo_activities table as well
           // rideId: rideId,
      });
      console.log(`Solo activity ${soloActivity.id} updated.`); // ADDED
  }
  console.log('Solo activity update check finished.'); // ADDED


  console.log('Sending success JSON response.'); // ADDED
  return res.json({ // ADDED 'return'  
    type: isPendingProximityMatch ? 'participant_manual_linked_pending' : 'participant_manual_linked_matched_immediately',
    message: isPendingProximityMatch ?
               `Activity linked to ride ${rideId}. Awaiting organizer GPX for final match.` :
               `Activity successfully linked and matched to ride ${rideId}.`,
    linkedRideId: rideId,
    activityMatchId: activityMatch.id,
    soloActivityId: soloActivity.id,
    matchScore: parseFloat(matchScore), // Send calculated or default score
    isPendingProximityMatch: isPendingProximityMatch,
    activityData: { // Include activity data in the response
        distance: gpxData.distance,
        duration: gpxData.duration,
        movingTime: gpxData.movingTime,
        elevationGain: gpxData.elevationGain,
        averageSpeed: gpxData.averageSpeed,
        averageHeartRate: gpxData.averageHeartRate,
        maxHeartRate: gpxData.maxHeartRate,
    }
  });
  console.log('--- Finished /api/link-participant-gpx endpoint execution (success) ---'); // ADDED

  } catch (error) {
  console.error("Link participant GPX error:", error);
  // Ensure error is an Error object to access message property
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  res.status(500).json({ message: "Internal server error", error: errorMessage }); // MODIFIED: Include error message in JSON
  console.log('--- Finished /api/link-participant-gpx endpoint execution (error) ---'); // ADDED
  }
});
  const httpServer = createServer(app);
  return httpServer;
}


