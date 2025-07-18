import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, UserPlus, Trophy, Calendar } from "lucide-react";
import { authManager } from "@/lib/auth";

export default function FollowersPage() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<"followers" | "following">("followers");
  const user = authManager.getState().user;
  const userId = id ? parseInt(id) : user?.id;

  const { data: followers, isLoading: isLoadingFollowers } = useQuery({
    queryKey: [`/api/users/${userId}/followers`],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}/followers`);
      if (!response.ok) throw new Error("Failed to fetch followers");
      return response.json();
    },
    enabled: !!userId,
  });

  const { data: following, isLoading: isLoadingFollowing } = useQuery({
    queryKey: [`/api/users/${userId}/following`],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}/following`);
      if (!response.ok) throw new Error("Failed to fetch following");
      return response.json();
    },
    enabled: !!userId,
  });

  const renderUserCards = (users: any[], isLoading: boolean) => {
    if (isLoading) {
      return Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="hover:shadow-lg transition-shadow">
          <CardHeader className="text-center pb-4">
            <Skeleton className="w-16 h-16 rounded-full mx-auto mb-4" />
            <Skeleton className="h-6 w-3/4 mx-auto mb-2" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <Skeleton className="h-6 w-8 mx-auto mb-1" />
                <Skeleton className="h-3 w-12 mx-auto" />
              </div>
              <div>
                <Skeleton className="h-6 w-8 mx-auto mb-1" />
                <Skeleton className="h-3 w-12 mx-auto" />
              </div>
              <div>
                <Skeleton className="h-6 w-8 mx-auto mb-1" />
                <Skeleton className="h-3 w-12 mx-auto" />
              </div>
            </div>
          </CardContent>
        </Card>
      ));
    }

    if (!users?.length) {
      return (
        <div className="col-span-full text-center py-12">
          <div className="text-gray-500 mb-4">
            <Users className="w-12 h-12 mx-auto mb-4" />
            <h3 className="text-xl font-semibold">
              No {activeTab === "followers" ? "followers" : "following"} yet
            </h3>
            <p>
              {activeTab === "followers"
                ? "No one is following yet."
                : "Not following anyone yet."}
            </p>
          </div>
        </div>
      );
    }

    return users.map((user: any) => (
      <Card key={user.id} className="hover:shadow-lg transition-shadow">
        <CardHeader className="text-center pb-4">
          <Avatar className="w-16 h-16 mx-auto mb-4">
            <AvatarFallback className="bg-cycling-blue text-white text-lg">
              {user.name?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <CardTitle className="text-lg">{user.name}</CardTitle>
          <p className="text-sm text-gray-500">@{user.username}</p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-2xl font-bold text-cycling-blue">{user.followersCount || 0}</div>
              <div className="text-xs text-gray-500">Followers</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-nature-green">{user.completedRides || 0}</div>
              <div className="text-xs text-gray-500">Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-energy-red">{user.hostedRides || 0}</div>
              <div className="text-xs text-gray-500">Hosted</div>
            </div>
          </div>
        </CardContent>
      </Card>
    ));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/my-stats")}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Stats
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Social Connections</h1>
            <p className="text-gray-600">View followers and following</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "followers" | "following")}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="followers">
              <Users className="w-4 h-4 mr-2" />
              Followers ({followers?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="following">
              <UserPlus className="w-4 h-4 mr-2" />
              Following ({following?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="followers" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {renderUserCards(followers, isLoadingFollowers)}
            </div>
          </TabsContent>

          <TabsContent value="following" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {renderUserCards(following, isLoadingFollowing)}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}