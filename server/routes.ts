import type { Express, Request } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, loginSchema, insertRideSchema, rideFiltersSchema, insertSoloActivitySchema } from "@shared/schema";
import { ZodError } from "zod";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { parseGPXFile, calculateRouteMatch } from "./gpx-parser";
import { WeatherService } from "./weather";

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
const storage_multer = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req: any, file: any, cb: any) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage_multer,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/gpx+xml" || file.originalname.endsWith(".gpx")) {
      cb(null, true);
    } else {
      cb(new Error("Only GPX files are allowed"));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  }
});

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
        gpxFilePath: `/uploads/${req.file.filename}`,
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
          });
          return;
        }
      }
      
      res.json(ride);
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
      const ride = await storage.getRide(rideId);
      
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
      if (ride.organizerId !== req.userId!) {
        return res.status(403).json({ message: "Only the organizer can delete this ride" });
      }
      
      await storage.deleteRide(rideId);
      res.json({ message: "Ride deleted successfully" });
    } catch (error) {
      console.error("Delete ride error:", error);
      res.status(500).json({ message: "Internal server error" });
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
        gpxFilePath: `/uploads/${req.file.filename}`,
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
    try {
      const userId = req.userId!;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No GPX file provided" });
      }

      const { deviceName, deviceType } = req.body;
      
      // Parse GPX file to extract activity data
      const gpxData = await parseGPXFile(file.path);
      
      // Try to match with existing joined rides within a reasonable time window
      const userRides = await storage.getUserRides(userId);
      const currentTime = new Date();
      const activityStartTime = new Date(gpxData.startTime);
      
      // Look for rides that are within 2 hours of the activity start time (before or after)
      const timeWindowHours = 2;
      const timeWindowMs = timeWindowHours * 60 * 60 * 1000;
      
      const candidateRides = userRides.joined.filter(ride => {
        const rideDateTime = new Date(ride.dateTime);
        const timeDiff = Math.abs(activityStartTime.getTime() - rideDateTime.getTime());
        return timeDiff <= timeWindowMs && !ride.isCompleted;
      });
      
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
          const rideGpxData = await parseGPXFile(ride.gpxFilePath);
          const matchScore = calculateRouteMatch(gpxData, rideGpxData);
          
          console.log(`Ride ${ride.name} match score: ${matchScore}`);
          
          if (matchScore > bestMatchScore && matchScore >= 0.5) {
            bestMatch = ride;
            bestMatchScore = matchScore;
          }
        } catch (error) {
          console.warn(`Could not parse GPX for ride ${ride.id}:`, error);
        }
      }

      if (bestMatch && bestMatchScore >= 0.5) {
        // Match found - complete the ride
        await storage.completeRide(bestMatch.id, userId);
        
        // Create activity match record
        await storage.createActivityMatch({
          rideId: bestMatch.id,
          userId,
          deviceId: deviceName || 'manual-upload',
          routeMatchPercentage: bestMatchScore.toString(),
          gpxFilePath: file.path,
          distance: gpxData.distance,
          duration: gpxData.duration,
          movingTime: gpxData.movingTime,
          elevationGain: gpxData.elevationGain,
          averageSpeed: gpxData.averageSpeed,
          averageHeartRate: gpxData.averageHeartRate,
          maxHeartRate: gpxData.maxHeartRate,
          calories: gpxData.calories,
          completedAt: new Date(),
        });
        
        res.json({
          message: "Activity matched and ride completed!",
          matchedRide: bestMatch,
          matchScore: bestMatchScore,
        });
      } else {
        // No match found - create a solo activity automatically
        const soloActivity = await storage.createSoloActivity({
          name: `Manual Activity - ${new Date().toLocaleDateString()}`,
          description: `Solo cycling activity uploaded manually`,
          activityType: 'cycling',
          gpxFilePath: `/uploads/${file.filename}`,
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
        });

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

  // Serve GPX files for map preview
  app.get('/api/gpx/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path.resolve(process.cwd(), 'uploads', filename);
      
      console.log('Serving GPX file:', filename, 'from path:', filePath);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error('GPX file not found:', filePath);
        return res.status(404).json({ message: 'GPX file not found' });
      }
      
      res.setHeader('Content-Type', 'application/gpx+xml');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.sendFile(filePath);
    } catch (error) {
      console.error('GPX file serving error:', error);
      res.status(500).json({ message: 'Internal server error' });
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

      // Delete the GPX file if it exists
      if (activity.gpxFilePath) {
        try {
          const filePath = path.resolve(process.cwd(), activity.gpxFilePath);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (fileError) {
          console.warn('Could not delete GPX file:', fileError);
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

  const httpServer = createServer(app);
  return httpServer;
}
