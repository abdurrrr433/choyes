# React Test Center Guards & Hooks

This directory contains React-specific test-center access validation utilities.

## Hooks

- `useTestCenterAccess.ts` — validates access to a specific test center
  - Returns: `{ hasAccess, loading, error }`
  - Options: `onAccessDenied`, `cacheDuration`
  - Usage: call inside a component before rendering center-specific content

- `useIsTestCenterOwner()` — validates whether the current user is a test-center owner
  - Returns: `{ isOwner, loading, error }`
  - Options: `onOwnerCheckFail`, `cacheDuration`

## Components

- `TestCenterProtectedRoute.tsx` — route wrapper for center access validation
  - Props: `testCenterId`, `fallbackPath`, `children`, `loading`
  - Usage: wrap route content for a specific test center

- `TestCenterOwnerRoute.tsx` — owner-only route wrapper
  - Props: `fallbackPath`, `children`, `loading`
  - Usage: wrap admin/owner pages to ensure the user is a test-center owner

- `WithTestCenterAccess.tsx` — HOC for route components
  - Usage: `WithTestCenterAccess(Component, { paramName: 'id' })`
  - Automatically extracts route params and validates access

## Integration Examples

### Example 1: Using the hook in a component

```tsx
import { useParams } from "react-router-dom";
import { useTestCenterAccess } from "@/hooks/useTestCenterAccess";

function ViewTestCenterPage() {
  const { id } = useParams();
  const { hasAccess, loading } = useTestCenterAccess(id);

  if (loading) return <div>Validating access...</div>;
  if (hasAccess === false) return <Navigate to="/" replace />;

  return <div>Test Center Details for {id}</div>;
}
```

### Example 2: Using protected route component

```tsx
import { TestCenterProtectedRoute } from "@/components/TestCenterProtectedRoute";
import { useParams } from "react-router-dom";

function EditTestCenterPage() {
  const { id } = useParams();

  return (
    <TestCenterProtectedRoute testCenterId={id} fallbackPath="/">
      <div>Edit Test Center {id}</div>
    </TestCenterProtectedRoute>
  );
}
```

### Example 3: Using owner-only route

```tsx
import { TestCenterOwnerRoute } from "@/components/TestCenterOwnerRoute";

function AdminDashboard() {
  return (
    <TestCenterOwnerRoute fallbackPath="/">
      <div>Admin Dashboard (Owner Only)</div>
    </TestCenterOwnerRoute>
  );
}
```

### Example 4: Using the HOC in router config

```tsx
import { WithTestCenterAccess } from "@/components/WithTestCenterAccess";

const ProtectedEditPage = WithTestCenterAccess(EditTestCenterPage, {
  paramName: "id",
  fallbackPath: "/",
});
```

## API Integration

The hooks call `TestCenterApi` methods:

- `validateAccess(testCenterId)` — GET `/test_centers/:id/validate_access`
- `checkUserIsTestCenterOwner()` — GET `/users/me/test_centers/owner`

Both use a 5-minute cache TTL by default.
