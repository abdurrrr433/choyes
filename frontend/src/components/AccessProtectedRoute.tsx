import { Navigate } from "react-router-dom";
import { useAccessAuth } from "@/contexts/AccessAuthContext";

export default function AccessProtectedRoute({
  children,
  allowedRoles,
  requiredPermission,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredPermission?: string;
}) {
  const { isAuthenticated, loading, user, hasPermission } = useAccessAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/access/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/access/dashboard" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/access/forbidden" replace state={{ permission: requiredPermission }} />;
  }

  return <>{children}</>;
}
