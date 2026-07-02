import { useParams } from "react-router-dom";
import { TestCenterProtectedRoute } from "@/components/TestCenterProtectedRoute";

export default function TestCenterDetailPage() {
  const { id } = useParams();

  return (
    <TestCenterProtectedRoute testCenterId={id} fallbackPath="/dashboard">
      <div className="p-8">
        <h1 className="text-2xl font-semibold mb-4">Test Center {id} Details</h1>
        <p data-testid="test-center-access-granted" className="text-base text-slate-600">
          Test center access has been validated for center ID {id}.
        </p>
      </div>
    </TestCenterProtectedRoute>
  );
}
