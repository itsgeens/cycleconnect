import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Auth from "@/pages/auth";
import RideDetail from "@/pages/ride-detail";
import CreateRide from "@/pages/create-ride";
import Activities from "@/pages/activities";
import MyStats from "@/pages/my-stats";
import FollowersPage from "@/pages/followers";
import ManageDevices from "@/pages/manage-devices";
import UploadActivity from "@/pages/upload-activity";
import MyPerformance from "@/pages/my-performance";
import { authManager } from "./lib/auth";
import { useEffect, useState } from "react";

function Router() {
  const [authState, setAuthState] = useState(authManager.getState());

  useEffect(() => {
    const unsubscribe = authManager.subscribe(setAuthState);
    return unsubscribe;
  }, []);

  if (!authState.user) {
    return <Auth />;
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/create" component={CreateRide} />
      <Route path="/activities" component={Activities} />
      <Route path="/upload-activity" component={UploadActivity} />
      <Route path="/my-stats" component={MyStats} />
      <Route path="/manage-devices" component={ManageDevices} />
      <Route path="/followers/:id" component={FollowersPage} />
      <Route path="/ride/:id" component={RideDetail} />
      <Route path="/my-performance/:id" component={MyPerformance} />
      <Route path="/my-performance/solo/:id" component={MyPerformance} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
