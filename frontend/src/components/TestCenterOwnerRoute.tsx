import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useIsTestCenterOwner } from "@/hooks/useTestCenterAccess";

interface TestCenterOwnerRouteProps {
  fallbackPath?: string;
  children: ReactNode;
  loading?: ReactNode;
}

export function TestCenterOwnerRoute({
  fallbackPath = "/",
  children,
  loading: LoadingUI,
}: TestCenterOwnerRouteProps) {
  const { isOwner, loading } = useIsTestCenterOwner({
    onOwnerCheckFail: () => {
      // Redirect happens via the rendered Navigate below.
    },
  });

  if (loading) {
    return (
      <>{
        LoadingUI || (
          <div className="p-4 text-center text-sm text-slate-600">
            Checking permissions...
          </div>
        )
      }</>
    );
  }

  if (isOwner === false) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
