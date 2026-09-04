import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { User, useGetCurrentUser } from "@workspace/api-client-react";
import { clearQueue } from "@/lib/offline-queue";
import { abortUserScopedRequests, purgeAuthenticatedApiCache } from "@/lib/api-call";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const WARNING_BEFORE_MS = 2 * 60 * 1000;

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionWarning: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  resetSessionTimer: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(() => !localStorage.getItem("token"));
  const [sessionWarning, setSessionWarning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: currentUser, isLoading: currentUserLoading, isError: currentUserError } = useGetCurrentUser({
    query: {
      enabled: !!token,
      retry: false,
      queryKey: ["getCurrentUser"],
    },
  });

  useEffect(() => {
    if (!token) {
      setAuthChecked(true);
      return;
    }
    if (currentUser) {
      setUser(currentUser);
      setAuthChecked(true);
      return;
    }
    if (currentUserError) {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
      setAuthChecked(true);
    }
  }, [currentUser, currentUserError, token]);

  const logout = useCallback(() => {
    if (user) clearQueue(user.id);
    abortUserScopedRequests();
    void queryClient.cancelQueries();
    queryClient.clear();
    void purgeAuthenticatedApiCache();
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setAuthChecked(true);
    setSessionWarning(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
  }, [queryClient, user]);

  const resetSessionTimer = useCallback(() => {
    if (!token) return;
    setSessionWarning(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    warningRef.current = setTimeout(() => {
      setSessionWarning(true);
    }, SESSION_TIMEOUT_MS - WARNING_BEFORE_MS);

    timeoutRef.current = setTimeout(() => {
      logout();
    }, SESSION_TIMEOUT_MS);
  }, [token, logout]);

  useEffect(() => {
    if (!token) return;
    resetSessionTimer();
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    const handler = () => resetSessionTimer();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [token, resetSessionTimer]);

  const login = (newToken: string, newUser: User) => {
    // Clear/cancel before installing a different identity or role.  The token
    // is written first so all requests after this boundary use the new session.
    abortUserScopedRequests();
    void queryClient.cancelQueries();
    queryClient.clear();
    void purgeAuthenticatedApiCache();
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);
    setAuthChecked(true);
    setSessionWarning(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading: !authChecked || currentUserLoading,
        sessionWarning,
        login,
        logout,
        resetSessionTimer,
      }}
    >
      {sessionWarning && token && (
        <div className="fixed top-4 right-4 z-[9999] bg-amber-500 text-white rounded-xl shadow-2xl p-4 max-w-xs animate-in slide-in-from-top-4">
          <p className="font-bold text-sm">Session expiring soon</p>
          <p className="text-xs mt-0.5 text-amber-100">Your session will expire in 2 minutes due to inactivity.</p>
          <button onClick={resetSessionTimer}
            className="mt-2 w-full py-1.5 bg-white text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-50">
            Stay Logged In
          </button>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
