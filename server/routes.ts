import type { Express, Request } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, loginSchema, insertRideSchema, rideFiltersSchema } from "@shared/schema";
import { ZodError } from "zod";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

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

      const ride = await storage.createRide({
        ...rideData,
        organizerId: req.userId!,
        gpxFilePath: `/uploads/${req.file.filename}`,
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

  const httpServer = createServer(app);
  return httpServer;
}
