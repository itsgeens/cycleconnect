import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { authManager } from "./auth";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  options: {
    method: string;
    data?: unknown | undefined;
  }
): Promise<Response> {
  const authHeaders = authManager.getAuthHeaders();
  const headers: Record<string, string> = {};
  
  // Only add Authorization header if it exists
  if (authHeaders.Authorization) {
    headers.Authorization = authHeaders.Authorization;
  }
  
  // Add Content-Type header if we have data
  if (options.data) {
    headers["Content-Type"] = "application/json";
  }

  // Get the API base URL from environment or default to relative URLs
  const API_BASE_URL = import.meta.env.VITE_API_URL || '';
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  
  const res = await fetch(fullUrl, {
    method: options.method,
    headers,
    body: options.data ? JSON.stringify(options.data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authHeaders = authManager.getAuthHeaders();
    const headers: Record<string, string> = {};
    
    // Only add Authorization header if it exists
    if (authHeaders.Authorization) {
      headers.Authorization = authHeaders.Authorization;
    }

    // Handle query parameters from the query key
    let url = queryKey[0] as string;
    
    // Handle route parameters (e.g., ['/api/rides', '4'] -> '/api/rides/4')
    if (queryKey.length > 1 && typeof queryKey[1] === 'string') {
      url += `/${queryKey[1]}`;
    }
    
    // Handle query string parameters
    if (queryKey.length > 1 && typeof queryKey[1] === 'object') {
      const params = new URLSearchParams(queryKey[1] as Record<string, string>);
      url += `?${params.toString()}`;
    }

    // Get the API base URL from environment or default to relative URLs
    const API_BASE_URL = import.meta.env.VITE_API_URL || '';
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    
    const res = await fetch(fullUrl, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
