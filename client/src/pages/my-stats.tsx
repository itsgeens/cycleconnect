import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/navbar";
import RideCard from "@/components/ride-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { authManager } from "@/lib/auth";
import { 
  Calendar, 
  TrendingUp, 
  Mountain, 
  Route, 
  Trophy,
  Activity,
  Users,
  MapPin
} from "lucide-react";

export default function MyStats() {
  const [timeframe, setTimeframe] = useState("last-month");
  const [showAllRides, setShowAllRides] = useState(false);
  const user = authManager.getState().user;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/my-stats", { timeframe }],
    staleTime: 0, // Always fetch fresh data
    cacheTime: 0, // Don't cache the data
  });

  const { data: completedRides, isLoading: ridesLoading } = useQuery({
    queryKey: ["/api/my-completed-rides", { limit: showAllRides ? "all" : "5" }],
    staleTime: 0, // Always fetch fresh data
    cacheTime: 0, // Don't cache the data
  });

  const timeframeOptions = [
    { value: "last-month", label: "Last Month" },
    { value: "last-3-months", label: "Last 3 Months" },
    { value: "last-6-months", label: "Last 6 Months" },
    { value: "last-year", label: "Last Year" },
    { value: "all-time", label: "All Time" }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Stats</h1>
          <p className="text-gray-600">Track your cycling achievements and progress</p>
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

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Rides Joined
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{stats?.ridesJoined || 0}</div>
                  <Badge variant="secondary" className="mt-1">
                    {stats?.ridesJoinedChange >= 0 ? '+' : ''}{stats?.ridesJoinedChange || 0} from previous
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    <Trophy className="h-4 w-4" />
                    Rides Hosted
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{stats?.ridesHosted || 0}</div>
                  <Badge variant="secondary" className="mt-1">
                    {stats?.ridesHostedChange >= 0 ? '+' : ''}{stats?.ridesHostedChange || 0} from previous
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    <Route className="h-4 w-4" />
                    Total Distance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{stats?.totalDistance || 0} km</div>
                  <Badge variant="secondary" className="mt-1">
                    {stats?.totalDistanceChange >= 0 ? '+' : ''}{stats?.totalDistanceChange || 0} km from previous
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    <Mountain className="h-4 w-4" />
                    Total Elevation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{stats?.totalElevation || 0} m</div>
                  <Badge variant="secondary" className="mt-1">
                    {stats?.totalElevationChange >= 0 ? '+' : ''}{stats?.totalElevationChange || 0} m from previous
                  </Badge>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Completed Rides Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Completed Rides
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
            ) : completedRides?.length > 0 ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {completedRides.map((ride: any) => (
                    <RideCard key={ride.id} ride={ride} />
                  ))}
                </div>
                
                {!showAllRides && completedRides.length >= 5 && (
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
      </div>
    </div>
  );
}