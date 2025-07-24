import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import Navbar from "@/components/navbar";
import RideCard from "@/components/ride-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { authManager } from "@/lib/auth";
import DonutChart from "@/components/donut-chart";
import {
  ArrowLeft,
  Clock,
  Zap,
  Heart,
  Calendar,
  TrendingUp,
  Mountain,
  Route,
  Trophy,
  Activity,
  Users,
  MapPin,
  UserPlus,
  ExternalLink
} from "lucide-react";

import type { Ride, ActivityMatch } from "@shared/schema"; // Import necessary types from your shared schema

    // Define a type alias for the completed ride objects returned by the backend
    type CompletedRideWithData = Ride & {
      organizerName: string;
      participantCount: number;
      completedAt: Date;
      userActivityData?: ActivityMatch;
      userParticipationData?: any; // You might want to define a more specific type for userParticipationData
    };


// Helper function to calculate the total XP needed to reach the start of a given level (Level 1 starts at 0 XP)
const getTotalXpForLevel = (level: number): number => {
  // Define the XP thresholds for the start of each level
  const xpThresholds: { [key: number]: number } = {
    1: 0,      // Starter
    2: 151,    // Cruiser
    3: 751,    // Pacer
    4: 2501,   // Climber
    5: 6001,   // Veteran
    6: 13001,  // Champion
    7: 25001,  // Master
    8: 40001,  // Legend
    9: 60001,  // Elite (This is the start of Elite, it goes up from here)
  };
  return xpThresholds[level] !== undefined ? xpThresholds[level] : Infinity; // Return Infinity for levels beyond defined
};

// Helper function to calculate user level based on total XP using the defined thresholds
const calculateLevel = (xp: number): number => {
  if (xp < 0) return 1; // XP cannot be negative, default to level 1

  let level = 1;
  // Increment level until the total XP required to reach the *next* level is greater than the user's current XP
  while (getTotalXpForLevel(level + 1) <= xp) {
    level++;
  }
  return level;
};

// Helper function to get the level name based on the level number
const getLevelName = (level: number): string => {
  const levelNames: { [key: number]: string } = {
    1: "Starter",
    2: "Cruiser",
    3: "Pacer",
    4: "Climber",
    5: "Veteran",
    6: "Champion",
    7: "Master",
    8: "Legend",
    9: "Elite",
  };
  return levelNames[level] || `Level ${level}`; // Return "Level X" if name not defined
};

export default function MyStats() {
  const [timeframe, setTimeframe] = useState("last-month");
  const [showAllRides, setShowAllRides] = useState(false);
  const [, navigate] = useLocation();
  const { userId } = useParams<{ userId: string }>();
  const currentUser = authManager.getState().user;

  // Determine if viewing own stats or another user's stats
  const isOwnStats = !userId;
  const targetUserId = isOwnStats ? currentUser?.id : parseInt(userId!);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: [isOwnStats ? "/api/my-stats" : "/api/user-stats", targetUserId, { timeframe }],
    queryFn: async () => {
      const sessionId = localStorage.getItem("sessionId");
      const endpoint = isOwnStats ? `/api/my-stats?timeframe=${timeframe}` : `/api/user-stats/${targetUserId}?timeframe=${timeframe}`;
      const response = await fetch(endpoint, {
        headers: {
          "Authorization": `Bearer ${sessionId}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      const statsData = await response.json(); // Keep this line to access the data
      console.log("Fetched stats data:", statsData); // Keep this log
      return statsData; // Return the actual data here
    },
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache the data (updated property name)
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    enabled: !!targetUserId,
  });
  console.log("Stats object:", stats); // Keep this log
  console.log("Stats XP:", stats?.xp); // Keep this log

  const { data: completedRides, isLoading: ridesLoading } = useQuery({
    queryKey: [isOwnStats ? "/api/my-completed-rides" : "/api/user-completed-rides", targetUserId, { limit: showAllRides ? "all" : "5" }],
    queryFn: async () => {
      if (!isOwnStats) {
        // For other users, we don't show their completed rides for privacy
        return [];
      }
      const sessionId = localStorage.getItem("sessionId");
      const response = await fetch(`/api/my-completed-rides?limit=${showAllRides ? "all" : "5"}`, {
        headers: {
          "Authorization": `Bearer ${sessionId}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch completed rides");
      const completedRidesData = await response.json(); // Keep this line to access the data
      console.log("Fetched completed rides data:", completedRidesData); // Add a log for completed rides data
      return completedRidesData; // Return the actual data here
    },
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache the data (updated property name)
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    enabled: !!targetUserId,
  });

  const timeframeOptions = [
    { value: "last-month", label: "Last Month" },
    { value: "last-3-months", label: "Last 3 Months" },
    { value: "last-6-months", label: "Last 6 Months" },
    { value: "last-year", label: "Last Year" },
    { value: "all-time", label: "All Time" }
  ];
    // Add these new calculations using the updated non-linear logic
    const currentLevel = stats?.xp !== undefined ? calculateLevel(stats.totalXp) : 1; // Default to level 1 if no XP
    const xpForStartOfCurrentLevel = getTotalXpForLevel(currentLevel);
    const xpForStartOfNextLevel = getTotalXpForLevel(currentLevel + 1); // This will be Infinity for Elite level

    const xpIntoCurrentLevel = stats?.xp !== undefined ? stats.xp - xpForStartOfCurrentLevel : 0;
    // Ensure xpIntoCurrentLevel is not negative
    const safeXpIntoCurrentLevel = Math.max(0, xpIntoCurrentLevel);

    const totalXpForCurrentLevelRange = xpForStartOfNextLevel - xpForStartOfCurrentLevel;

    // Calculate the percentage progress in the current level
    // Handle division by zero and Infinity for Elite level
    const levelProgressPercentage = totalXpForCurrentLevelRange > 0 && totalXpForCurrentLevelRange !== Infinity
      ? (safeXpIntoCurrentLevel / totalXpForCurrentLevelRange) * 100
      : 0; // If range is 0 or Infinity, progress is 0 (or maxed for Elite)

  // Derive completed ride counts by type from the stats object - MODIFIED
  const completedSoloRidesCount = stats?.soloRides || 0;
  const completedOrganizedRidesCount = stats?.ridesHosted || 0;
  const completedJoinedRidesCount = stats?.ridesJoined || 0;

  const totalCompletedRides = completedSoloRidesCount + completedOrganizedRidesCount + completedJoinedRidesCount;

  console.log("Calculated counts for Donut Chart:", { completedSoloRidesCount, completedOrganizedRidesCount, completedJoinedRidesCount, totalCompletedRides }); // Add this log


  return (
    <div className="min-h-screen bg-gray-50"> {/* Outer div 1 */}
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isOwnStats ? "My Stats" : `${stats?.user?.name || "User"}'s Stats`}
          </h1>
          <p className="text-gray-600">
            {isOwnStats ? "Track your cycling achievements and progress" : `View ${stats?.user?.name || "this user"}'s cycling achievements and progress`}
          </p>
        </div>


        {/* Time Frame Selector */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Time Frame:</label>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                {timeframeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
             {/* Full-width XP Card */}
            <Card className="lg:col-span-3"> {/* This card spans all 3 columns on large screens */}
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-3"> {/* Adjusted title size and style */}
                  <Trophy className="h-6 w-6 text-yellow-500" /> {/* Increased icon size */}
                  Total XP
              </CardTitle>
            </CardHeader>

            <CardContent className="flex flex-col md:flex-row items-start md:items-center justify-between"> {/* Use flexbox for layout */}
              <div className="mb-4 md:mb-0"> {/* Spacing for smaller screens */}
                {stats?.xp !== undefined ? (
                  <>
                {/* Prominent XP Amount */}
                <div className="text-4xl font-bold text-gray-900 mb-1">{stats.xp.toFixed(2)}</div> {/* Increased XP font size */}
                {/* Level Information */}
                <p className="text-lg text-gray-600">
                 Level {currentLevel}: {getLevelName(currentLevel)} {/* Adjusted level font size */}
                </p>
              </>
            ) : (
              <div className="text-4xl font-bold text-gray-900">N/A</div> // Display N/A if XP is not available
            )}
          </div>

          {stats?.xp !== undefined && currentLevel < 9 && ( // Show progress bar only if XP is available and not Elite
             <div className="w-full md:w-2/3 lg:w-1/2"> {/* Progress bar takes available width */}
               <p className="text-sm text-gray-600 mb-1">Progress to Level {currentLevel + 1}</p> {/* Adjusted text size */}
               <div className="w-full bg-gray-200 rounded-full h-8"> {/* Adjusted height */}
                 <div
                   className="bg-yellow-500 h-3 rounded-full"
                    style={{ width: `${levelProgressPercentage}%` }}
                    ></div>
                  </div>
                  <p className="text-right text-sm text-gray-700 mt-1"> {/* Adjusted text size and color */}
                    {/* Use the correct variables for progress display */}
                    {safeXpIntoCurrentLevel.toFixed(0)} / {(totalXpForCurrentLevelRange).toFixed(0)} XP
                  </p>
                </div>
             )}
            </CardContent>
          </Card>

            {/* Second Row: Ride Count (2x2), Total Distance (1x3), Total Elevation (1x3) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 mt-8"> {/* Using a 5-column grid */}
            {/* Ride Count Card (2x2) */}
            <Card className="md:col-span-2 md:row-span-2"> {/* Spans 2 columns and 2 rows on medium screens and up */}
                <CardHeader className="pb-2">
                    <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
                        <Activity className="h-6 w-6 text-blue-500" />
                        Ride Count
                    </CardTitle>
                    <CardDescription>(Completed Activities)</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center h-full"> {/* Center content */}
                    {statsLoading ? ( // Use statsLoading here as the donut chart data comes from stats
                        <Skeleton className="h-40 w-40 rounded-full" />
                    ) : (
                       <>
                        <DonutChart
                               data={[
                                   { name: 'Solo Activities', value: completedSoloRidesCount },
                                   { name: 'Organized Rides', value: completedOrganizedRidesCount },
                                   { name: 'Joined Rides', value: completedJoinedRidesCount },
                               ]}
                               totalCompletedRides={totalCompletedRides} // Pass the total count
                           />
                       </>
                    )}
                </CardContent>
            </Card>


            {/* Total Distance Card (1x2) */}
            <Card className="md:col-span-2"> {/* Spans 3 columns on medium screens and up */}
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
                  <Route className="h-6 w-6 text-green-500" />
                  Total Distance
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                {statsLoading ? ( // Loading state for distance
                    <Skeleton className="h-8 w-24 mb-2" />
                ) : (
                   <div className="text-4xl font-bold text-gray-900 mb-1">{stats?.totalDistance || 0} km</div>
                )}
                {statsLoading ? ( // Loading state for distance change
                    <Skeleton className="h-4 w-20" />
                ) : (
                   <Badge variant="secondary">
                     {stats?.totalDistanceChange >= 0 ? '+' : ''}{stats?.totalDistanceChange || 0} km from previous
                   </Badge>
                )}
              </CardContent>
            </Card>

               {/* Total Elevation Card (1x2) */}
            <Card className="md:col-span-2"> {/* Spans 3 columns on medium screens and up */}
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
                  <Mountain className="h-6 w-6 text-purple-500" />
                  Total Elevation
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                 {statsLoading ? ( // Loading state for elevation
                    <Skeleton className="h-8 w-24 mb-2" />
                 ) : (
                   <div className="text-4xl font-bold text-gray-900 mb-1">{stats?.totalElevation || 0} m</div>
                 )}
                 {statsLoading ? ( // Loading state for elevation change
                    <Skeleton className="h-4 w-20" />
                 ) : (
                   <Badge variant="secondary">
                     {stats?.totalElevationChange >= 0 ? '+' : ''}{stats?.totalElevationChange || 0} m from previous
                   </Badge>
                 )}
              </CardContent>
            </Card>
         </div>

        {/* Third Row: Full-width Followers and Following Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"> {/* Using a 2-column grid for this section */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow md:col-span-1"> {/* Spans 1 column on medium screens and up */}
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Followers
                <ExternalLink className="h-3 w-3 ml-auto" />
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
               {statsLoading ? ( // Loading state for followers
                  <Skeleton className="h-8 w-16" />
               ) : (
                 <div className="text-4xl font-bold text-gray-900">{stats?.followersCount || 0}</div>
               )}
              <p className="text-sm text-gray-500">People following {isOwnStats ? 'you' : stats?.user?.name || 'them'}</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow md:col-span-1"> {/* Spans 1 column on medium screens and up */}
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Following
                <ExternalLink className="h-3 w-3 ml-auto" />
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              {statsLoading ? ( // Loading state for following
                  <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-4xl font-bold text-gray-900">{stats?.followingCount || 0}</div>
              )}
              <p className="text-sm text-gray-500">People {isOwnStats ? "you're" : `${stats?.user?.name || 'they are'}`} following</p>
            </CardContent>
          </Card>
        </div>

        {/* Completed Rides Section - Only show for own stats */}
        {isOwnStats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Completed Group Rides
              </CardTitle>
              <CardDescription>
                Your cycling achievements and completed adventures
              </CardDescription>
            </CardHeader>
          <CardContent>
            {ridesLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-4">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-full mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
              ) : (completedRides?.completedRides?.length > 0 || completedRides?.soloActivities?.length > 0) ? ( // Correctly check if either array has data
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {/* Map over the completed group rides */}
                  {completedRides?.completedRides?.map((ride: CompletedRideWithData) => (
                    <RideCard key={ride.id} ride={ride} />
                  ))}
                </div>

                {!showAllRides && ((completedRides?.completedRides?.length || 0) + (completedRides?.soloActivities?.length || 0)) >= 5 && (
                  <div className="text-center mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setShowAllRides(true)}
                      className="flex items-center gap-2"
                    >
                      <TrendingUp className="h-4 w-4" />
                      View All Completed Rides
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No completed rides</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Complete your first ride to start tracking your cycling achievements!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>
      </div>
  )}
