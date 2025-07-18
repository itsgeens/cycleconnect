import { apiRequest } from "./queryClient";

export interface User {
  id: number;
  username: string;
  name: string;
  email: string;
}

export interface AuthState {
  user: User | null;
  sessionId: string | null;
}

class AuthManager {
  private listeners: ((state: AuthState) => void)[] = [];
  private state: AuthState = {
    user: null,
    sessionId: localStorage.getItem("sessionId"),
  };

  constructor() {
    // Check if user is already logged in
    this.checkAuth();
  }

  private async checkAuth() {
    if (this.state.sessionId) {
      try {
        const response = await fetch("/api/me", {
          headers: {
            Authorization: `Bearer ${this.state.sessionId}`,
          },
        });

        if (response.ok) {
          const user = await response.json();
          this.setState({ user, sessionId: this.state.sessionId });
        } else {
          this.logout();
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        this.logout();
      }
    }
  }

  private setState(newState: AuthState) {
    this.state = newState;
    this.listeners.forEach(listener => listener(newState));
  }

  public subscribe(listener: (state: AuthState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public getState() {
    return this.state;
  }

  public async login(username: string, password: string) {
    const response = await apiRequest("POST", "/api/login", { username, password });
    const data = await response.json();
    
    localStorage.setItem("sessionId", data.sessionId);
    this.setState({ user: data.user, sessionId: data.sessionId });
  }

  public async register(username: string, email: string, password: string, name: string) {
    const response = await apiRequest("POST", "/api/register", { username, email, password, name });
    const data = await response.json();
    
    localStorage.setItem("sessionId", data.sessionId);
    this.setState({ user: data.user, sessionId: data.sessionId });
  }

  public async logout() {
    if (this.state.sessionId) {
      try {
        await apiRequest("POST", "/api/logout", {});
      } catch (error) {
        console.error("Logout error:", error);
      }
    }
    
    localStorage.removeItem("sessionId");
    this.setState({ user: null, sessionId: null });
  }

  public getAuthHeaders() {
    return this.state.sessionId ? { Authorization: `Bearer ${this.state.sessionId}` } : {};
  }
}

export const authManager = new AuthManager();
