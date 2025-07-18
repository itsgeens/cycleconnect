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
import MyRides from "@/pages/my-rides";
import MyStats from "@/pages/my-stats";
import FollowersPage from "@/pages/followers";
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
      <Route path="/my-rides" component={MyRides} />
      <Route path="/my-stats" component={MyStats} />
      <Route path="/followers/:id" component={FollowersPage} />
      <Route path="/ride/:id" component={RideDetail} />
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
