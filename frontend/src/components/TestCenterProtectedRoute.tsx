import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useTestCenterAccess } from "@/hooks/useTestCenterAccess";

interface TestCenterProtectedRouteProps {
  testCenterId?: string | number;
  fallbackPath?: string;
  children: ReactNode;
  loading?: ReactNode;
}

export function TestCenterProtectedRoute({
  testCenterId,
  fallbackPath = "/",
  children,
  loading: LoadingUI,
}: TestCenterProtectedRouteProps) {
  const { hasAccess, loading } = useTestCenterAccess(String(testCenterId), {
    onAccessDenied: () => {
      // Redirect happens via the rendered Navigate below.
    },
  });

  if (loading) {
    if (LoadingUI) {
      return LoadingUI;
    }

    return (
      <div className="p-4 text-center text-sm text-slate-600">
        Validating access...
      </div>
    );
  }

  if (hasAccess === false) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
