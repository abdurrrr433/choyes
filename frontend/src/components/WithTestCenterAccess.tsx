import { ReactNode } from "react";
import { useParams, Navigate } from "react-router-dom";
import { TestCenterProtectedRoute } from "@/components/TestCenterProtectedRoute";

interface WithTestCenterAccessOptions {
  paramName?: string;
  fallbackPath?: string;
}

export function WithTestCenterAccess(
  Component: React.ComponentType<any>,
  options?: WithTestCenterAccessOptions
) {
  const { paramName = "id", fallbackPath = "/" } = options || {};

  return function ProtectedComponent(props: any) {
    const params = useParams();
    const testCenterId = params[paramName];

    if (!testCenterId) {
      return <Navigate to={fallbackPath} replace />;
    }

    return (
      <TestCenterProtectedRoute testCenterId={testCenterId} fallbackPath={fallbackPath}>
        <Component {...props} />
      </TestCenterProtectedRoute>
    );
  };
}
