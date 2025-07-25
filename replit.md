CycleConnect - Cycling Community Platform
Overview
CycleConnect is a full-stack web application that connects cyclists by allowing them to discover, organize, and participate in group rides. Built with modern web technologies, it provides a platform for cycling enthusiasts to share routes, organize events, and build community connections.

User Preferences
Preferred communication style: Simple, everyday language.

System Architecture
Frontend Architecture
Framework: React 18 with TypeScript
Routing: Wouter for client-side routing
Styling: Tailwind CSS with shadcn/ui component library
State Management: TanStack Query for server state and custom auth manager for authentication
Build Tool: Vite for fast development and optimized builds
Backend Architecture
Runtime: Node.js with Express.js
Language: TypeScript with ES modules
Database: PostgreSQL with Drizzle ORM
Session Management: Simple in-memory session store with cleanup
File Upload: Multer for GPX file handling
Authentication: Custom session-based auth with bcrypt password hashing
Database Layer
ORM: Drizzle ORM with PostgreSQL adapter
Connection: Neon serverless database connection
Migrations: Drizzle Kit for schema management
Schema: Shared TypeScript schema definitions between client and server
Key Components
Authentication System
Session-based authentication with secure password hashing
Custom auth manager on frontend for state management
Protected routes and API endpoints
User registration and login with validation
Ride Management
Create rides with GPX file uploads for route data
Filter and search rides by various criteria (type, surface, distance, date)
Join/leave ride functionality
Participant management and tracking
UI Components
Comprehensive component library based on Radix UI primitives
Responsive design with mobile-first approach
Toast notifications for user feedback
Form handling with validation
File Upload System
GPX file upload with validation
File storage in server uploads directory
MIME type checking and size limits
Data Flow
User Authentication Flow
User registers/logs in through auth forms
Server validates credentials and creates session
Session ID stored in localStorage and sent with requests
Auth manager maintains client-side state
Protected routes check authentication status
Ride Creation Flow
User fills out ride form with details and GPX file
Form data sent to server via multipart/form-data
Server validates data, stores file, and creates database record
Client receives confirmation and updates ride list
Ride Discovery Flow
Client requests rides with optional filters
Server queries database with filters and joins
Results include ride details, organizer info, and participant counts
Client displays rides in card format with filtering options
External Dependencies
Production Dependencies
Database: Neon serverless PostgreSQL
UI Components: Radix UI primitives for accessibility
Styling: Tailwind CSS for utility-first styling
Form Handling: React Hook Form with Zod validation
Date Handling: date-fns for date formatting and manipulation
Development Dependencies
Build Tools: Vite with React plugin
TypeScript: Full type safety across the stack
Drizzle Kit: Database schema management and migrations
Deployment Strategy
Development
Vite dev server for frontend with HMR
tsx for TypeScript execution in development
Concurrent client/server development setup
Replit-specific plugins for development environment
Production Build
Vite builds optimized client bundle
esbuild bundles server code for Node.js
Static files served from dist/public
Environment-based configuration
Database Management
Drizzle migrations for schema changes
Environment variable for database URL
Connection pooling with Neon serverless
File Storage
Local file storage for GPX uploads
Organized by upload timestamp and random suffix
MIME type validation and size limits
The application follows a traditional full-stack architecture with clear separation between client and server concerns, unified by shared TypeScript types and schemas. The choice of modern tools like Vite, Drizzle, and TanStack Query provides excellent developer experience while maintaining production performance.

Recent Changes
Smart Device Integration (July 18, 2025)
Automatic Ride Completion System: Complete infrastructure for connecting cycling computers and smartwatches
Web Bluetooth API Integration: Direct browser connection to BLE-enabled devices (Garmin, Wahoo, etc.)
GPX Route Matching Engine: Sophisticated algorithm using Needleman-Wunsch and Hausdorff distance for 85% route similarity detection
Device Management System: Save and manage connected devices with battery monitoring and protocol detection
Database Schema Updates: Added device_connections and activity_matches tables for device tracking and automated completion
API Endpoints: Complete set of endpoints for device management, activity matching, and automatic ride completion
Frontend Components: DeviceConnectionPanel with real-time connection status and device management
Advanced Activity Tracking (July 18, 2025)
Active vs Total Time Distinction: GPX parser now calculates moving time (active) vs elapsed time (total)
Enhanced Activity Cards: Show embedded GPX route maps, active time prominently, and heart rate data
Improved Speed Calculations: Average speed based on active time for more accurate performance metrics
Enhanced Heart Rate Display: Shows both average and maximum heart rate when available from GPX files
Multi-format GPX Support: Enhanced parser supports multiple Garmin extension formats for heart rate data
Visual Improvements: Activity cards now feature route previews similar to ride cards with better data presentation
Weather Integration & Timezone Support (July 18, 2025)
Mock Weather Service: Intelligent weather generation based on location and season without requiring API keys
Cycling-Specific Weather Assessment: Temperature comfort, precipitation risk, wind conditions, and visibility scoring
Weather-Aware Ride Planning: Weather forecasts integrated into ride creation form with cycling suitability ratings
Location-Based Timezone Detection: Smart timezone detection from GPX coordinates and meetup locations
Accurate Time Display: Ride times shown in local timezone with timezone indicators on cards
Weather Cards Integration: Weather conditions and cycling scores displayed on ride cards
Route Matching Algorithm Improvements (July 18, 2025)
Enhanced Time Window Matching: Improved algorithm to match activities within 2-hour window of planned rides (previously only matched past-due rides)
Flexible Route Comparison: More lenient coordinate matching with bonus scoring for routes in same geographic area
Debug Logging System: Added comprehensive logging for route matching analysis and troubleshooting
Geographic Bonus Scoring: Routes within 5km of each other receive bonus points for better matching accuracy
Timezone Conversion Fixes: Fixed Singapore/Philippines timezone detection and display using native Intl.DateTimeFormat API
Improved Coordinate Tolerance: Enhanced distance calculations for start/end point matching with 10km tolerance instead of 5km
Participant GPX Upload System (July 18, 2025)
Manual GPX Upload Interface: Added upload button and dialog for participants to submit their activity data after completing group rides
Personal Activity Data Storage: Integrated with activityMatches table to store participant's individual performance metrics
Data Precedence Logic: Activity cards now display participant's personal data when available, falling back to planned route data
Complete Activity Pipeline: Full end-to-end workflow from GPX upload to data extraction, storage, and display
Performance Metrics Display: Shows participant's actual distance, time, elevation, and speed instead of generic "N/A" values
Backend API Integration: Complete-with-data endpoint processes GPX files and creates activity match records
Data Source Fix: Fixed activities page to use correct endpoint (completed-activities) that includes userActivityData instead of my-rides
Verified End-to-End: Fully tested GPX upload workflow with multiple participants showing personal performance data correctly
Activity Filtering System: Added toggle button to show/hide group rides where user hasn't uploaded GPX data
Statistics Exclusion: Updated My Stats calculations to only count activities where user has uploaded GPX data, excluding unverified rides
Smart Activity Display: Activities page now differentiates between verified rides (with user data) and unverified rides (without user data)
Dynamic Performance Button: Ride detail pages now show "View My Performance" button when user has uploaded GPX data, "Upload Your Activity" when not
Enhanced API Integration: Fixed ride detail API to include user activity data in authenticated requests for proper button state detection
Navigation Fix: Corrected upload button routing from activities page to use proper /upload-activity route instead of broken /upload route
Android APK Packaging (July 19, 2025)
Capacitor Integration: Added full Capacitor setup for wrapping web app in native Android container
Bluetooth Permissions: Comprehensive bluetooth and location permissions for device connectivity testing
Native Device Access: @capacitor-community/bluetooth-le plugin for direct bluetooth device connections
Build System: Complete Android build configuration with APK generation capability
Mobile Testing: Enables installation on Android devices for testing bluetooth device connections in real environment
Development Workflow: Build scripts and documentation for generating debug APKs
Production Deployment Setup (July 20, 2025)
Multi-Platform Deployment: Configured for GitHub, Supabase, Vercel, and Render deployment
Environment Configuration: Separate development and production environment handling
API URL Management: Dynamic API endpoint configuration for frontend-backend communication
Build Scripts: Production-ready build processes for both frontend and backend
Documentation Suite: Comprehensive deployment guides and checklists for zero-DevOps-experience deployment
Configuration Files: Vercel, Render, and Capacitor configurations for automated deployments
Advanced GPX Matching for Organizers (July 20, 2025)
Organizer GPX Auto-Matching: Intelligent system to match organizer's uploaded GPX files to planned group rides with 70% similarity threshold
Route Similarity Engine: Enhanced matching algorithm using distance, start/end points, and geographic proximity for accurate ride identification
Manual Override System: API endpoint for organizers to manually link GPX files when auto-matching fails
Participant Proximity Analysis: Advanced algorithm checking if participants were within 50 meters of organizer for 80% of ride duration
Database Schema Extensions: New tables (organizer_gpx_files, participant_matches) for comprehensive ride completion tracking
Retroactive Matching: System processes previously uploaded participant GPX files when organizer uploads their route
Complete API Suite: Full REST endpoints for GPX upload, manual linking, and participant match analysis
Organizer Tools Interface: Dedicated frontend with GPX upload, manual linking, and proximity analysis visualization
Proximity Scoring System: Detailed metrics showing matched points, completion percentages, and ride statistics for each participant
Dual Route Visualization (July 20, 2025)
Planned vs Actual Route Display: Ride detail maps now show both the original planned route (blue) and organizer's actual route (green) when available
Enhanced Map Layering: Custom z-index panes ensure organizer's actual route displays prominently above planned route
Visual Route Distinction: Thicker lines and higher opacity for organizer's actual route with clear color-coded legend
API Integration: Ride detail endpoint includes organizer's GPX file path for dual route rendering
Interactive Route Legend: Visual indicators showing planned route (blue) and organizer's actual route (green) with proper labeling
Activity Management Fixes (July 20, 2025)
Organizer GPX Upload Bug Fixes: Resolved duplicate key constraint errors when linking organizer GPX files to rides
Time Validation Removal: Removed restrictive time validation that prevented ride completion for testing purposes
Duplicate Prevention: Added proper validation to prevent linking GPX files to rides that already have organizer data
Completed Rides Filtering: Fixed organizer planned rides query to exclude already completed rides from manual linking options
React Key Uniqueness: Fixed duplicate React key warnings in activities page by using unique prefixed keys for solo vs group activities
Activity Display: Ensured completed group rides with organizer GPX data display properly in user activities
Technical Implementation Details
Route Matching: Uses geometric similarity (Hausdorff distance), temporal alignment (Dynamic Time Warping), and elevation correlation
Time Window Validation: Automatic completion only if activity starts within 1 hour of planned ride time
Multi-Protocol Support: Both Bluetooth Low Energy and ANT+ bridge compatibility
Real-time Monitoring: Live data streaming from connected devices during rides
Automatic Validation: 85% route similarity threshold with configurable parameters
Active Time Calculation: Moving time excludes stops below 0.5 km/h threshold for accurate performance metrics
Timezone Handling: Intelligent timezone detection based on GPX coordinates and meetup locations for accurate time display
Mobile Packaging: Capacitor-based Android APK generation with native bluetooth device access
Advanced GPX Matching: Organizer route auto-matching with 70% similarity threshold and participant proximity analysis using 50-meter radius validation
Manual Override System: Complete workflow for organizers to manually link GPX files when automatic matching fails