import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { User, logout as revokeSession, useGetCurrentUser } from "@workspace/api-client-react";
import { clearQueue } from "@/lib/offline-queue";
import { abortUserScopedRequests, purgeAuthenticatedApiCache } from "@/lib/api-call";
import { bootstrapDisposition, logoutDisposition, makeAuthSyncSignal, reconcileRemoteAuth } from "@/lib/auth-session";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const WARNING_BEFORE_MS = 2 * 60 * 1000;
const AUTH_SYNC_KEY = "shepherd_auth_sync";

type AuthState = "ready" | "unknown";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** The saved credential could not be verified because the service is unavailable. */
  authState: AuthState;
  authError: string | null;
  sessionWarning: boolean;
  login: (token: string, user: User) => void;
  /** Returns false when the server did not confirm revocation. */
  logout: () => Promise<boolean>;
  /** Install a token returned by a security-sensitive session replacement. */
  replaceToken: (token: string) => void;
  retryAuth: () => void;
  resetSessionTimer: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(() => !localStorage.getItem("token"));
  const [authState, setAuthState] = useState<AuthState>("ready");
  const [authError, setAuthError] = useState<string | null>(null);
  const [sessionWarning, setSessionWarning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: currentUser, isLoading: currentUserLoading, error: currentUserError, refetch: refetchCurrentUser } = useGetCurrentUser({
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
      setAuthState("ready");
      setAuthError(null);
      return;
    }
    if (currentUserError) {
      // Only a 401 proves that this bearer is no longer usable.  A 403 can
      // mean an authorization/configuration problem, and all other failures
      // may simply be an outage, offline state, or a malformed response.
      if (bootstrapDisposition(currentUserError) === "clear") {
        abortUserScopedRequests();
        void queryClient.cancelQueries();
        queryClient.clear();
        void purgeAuthenticatedApiCache();
        if (user) clearQueue(user.id);
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
        setAuthState("ready");
        setAuthError(null);
        localStorage.setItem(AUTH_SYNC_KEY, makeAuthSyncSignal("revoked"));
      } else {
        setAuthState("unknown");
        setAuthError("We could not verify your session. Your sign-in has been kept; retry when the connection is available.");
      }
      setAuthChecked(true);
    }
  }, [currentUser, currentUserError, queryClient, token, user]);

  const cleanupLocalSession = useCallback((publish?: "logout" | "revoked") => {
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
    setAuthState("ready");
    setAuthError(null);
    if (publish) {
      // This deliberately carries no credential or security material. Other
      // tabs reread their shared token from storage before reconciling.
      localStorage.setItem(AUTH_SYNC_KEY, makeAuthSyncSignal(publish));
    }
  }, [queryClient, user]);

  const logout = useCallback(async (): Promise<boolean> => {
    try {
      await revokeSession();
      cleanupLocalSession("logout");
      return true;
    } catch (error) {
      // A rejected/revoked credential is already authoritative; a network or
      // server failure is not.  Keep the session and let the user retry.
      if (logoutDisposition(error) === "clear") {
        cleanupLocalSession("revoked");
        return true;
      }
      setAuthState("unknown");
      setAuthError("Sign out could not be confirmed by the server. Your session remains active; please retry.");
      return false;
    }
  }, [cleanupLocalSession]);

  const resetSessionTimer = useCallback(() => {
    if (!token) return;
    setSessionWarning(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    warningRef.current = setTimeout(() => {
      setSessionWarning(true);
    }, SESSION_TIMEOUT_MS - WARNING_BEFORE_MS);

    timeoutRef.current = setTimeout(() => {
      void logout();
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
    setAuthState("ready");
    setAuthError(null);
    setSessionWarning(false);
    localStorage.setItem(AUTH_SYNC_KEY, makeAuthSyncSignal("login"));
  };

  const replaceToken = useCallback((newToken: string) => {
    abortUserScopedRequests();
    void queryClient.cancelQueries();
    queryClient.clear();
    void purgeAuthenticatedApiCache();
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(null);
    setAuthChecked(false);
    setAuthState("ready");
    setAuthError(null);
    localStorage.setItem(AUTH_SYNC_KEY, makeAuthSyncSignal("session-replaced"));
  }, [queryClient]);

  const retryAuth = useCallback(() => {
    if (!token) return;
    setAuthChecked(false);
    setAuthState("ready");
    setAuthError(null);
    void refetchCurrentUser();
  }, [refetchCurrentUser, token]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_SYNC_KEY || !event.newValue) return;
      const sharedToken = localStorage.getItem("token");
      const action = reconcileRemoteAuth(event.newValue, token, sharedToken);
      if (action === "ignore") return;
      if (action === "clear") {
        cleanupLocalSession();
        return;
      }
      abortUserScopedRequests();
      void queryClient.cancelQueries();
      queryClient.clear();
      void purgeAuthenticatedApiCache();
      setToken(sharedToken);
      setUser(null);
      setSessionWarning(false);
      setAuthState("ready");
      setAuthError(null);
      setAuthChecked(!sharedToken);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [cleanupLocalSession, queryClient, token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading: !authChecked || currentUserLoading,
        authState,
        authError,
        sessionWarning,
        login,
        logout,
        replaceToken,
        retryAuth,
        resetSessionTimer,
      }}
    >
      {authState === "unknown" && token && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-amber-50 text-amber-950 border border-amber-300 rounded-xl shadow-lg p-3 max-w-md text-sm">
          <p>{authError}</p>
          <button onClick={retryAuth} className="mt-2 text-xs font-bold underline">Retry session check</button>
        </div>
      )}
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
