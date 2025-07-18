import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authManager } from "../lib/auth";
import { Zap, User, LogOut, TrendingUp, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Navbar() {
  const [authState, setAuthState] = useState(authManager.getState());
  const [location] = useLocation();

  useState(() => {
    const unsubscribe = authManager.subscribe(setAuthState);
    return unsubscribe;
  });

  const handleLogout = async () => {
    await authManager.logout();
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <div className="w-8 h-8 bg-cycling-blue rounded-full flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="ml-2 text-xl font-bold text-gray-900">CycleConnect</span>
            </div>
          </div>
          
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              <Link 
                href="/" 
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  location === "/" ? "text-cycling-blue" : "text-gray-900 hover:text-cycling-blue"
                }`}
              >
                Discover
              </Link>
              <Link 
                href="/create" 
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  location === "/create" ? "text-cycling-blue" : "text-gray-900 hover:text-cycling-blue"
                }`}
              >
                Create Ride
              </Link>
              <Link 
                href="/activities" 
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  location === "/activities" ? "text-cycling-blue" : "text-gray-900 hover:text-cycling-blue"
                }`}
              >
                Activities
              </Link>
              <Link 
                href="/upload-activity" 
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  location === "/upload-activity" ? "text-cycling-blue" : "text-gray-900 hover:text-cycling-blue"
                }`}
              >
                Upload Activity
              </Link>

            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {authState.user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-3">
                    <User className="w-5 h-5" />
                    <span className="text-sm font-medium">{authState.user.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/my-stats" className="flex items-center w-full">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      My Stats
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/manage-devices" className="flex items-center w-full">
                      <Settings className="w-4 h-4 mr-2" />
                      Manage Devices
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
