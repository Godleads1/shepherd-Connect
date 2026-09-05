import { ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/contexts/auth";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, token, authState, authError, retryAuth } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // A transient bootstrap failure must not send a still-saved bearer through
  // the login flow as though it had been revoked.
  if (token && authState === "unknown") {
    return (
      <div className="flex h-screen flex-col gap-3 items-center justify-center bg-background p-6 text-center">
        <p className="font-semibold">Your session could not be verified</p>
        <p className="text-sm text-muted-foreground">{authError}</p>
        <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground" onClick={retryAuth}>
          Retry
        </button>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Redirect to="/login" />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Redirect to="/dashboard" />; // Or unauthorized page
  }

  return <>{children}</>;
}
