# Full System Setup & Live Run Guide (React + FastAPI + Booking)

This guide walks you through running the entire choyes system locally — React frontend, FastAPI backend, and the exam booking flow.

## Prerequisites

- Node.js 18+
- Python 3.9+
- MongoDB running locally or accessible via connection string
- Git, npm, pip

## Architecture Overview

- Frontend: React 18 + Vite + React Router v6 (port 3000)
- Backend: Python FastAPI + MongoDB (port 8000)
- State: React Context API + TanStack React Query
- Auth: JWT tokens in localStorage (key: `accessToken`)
- Test Center Guards: React hooks (`useTestCenterAccess`, `useIsTestCenterOwner`)

## Step 1: Install Dependencies

```bash
# Frontend
cd frontend
npm ci

# Python backend
cd ../backend
pip install -r requirements.txt
```

## Step 2: Environment Setup

### Frontend (.env.local)

Create `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:8000
VITE_AUTH_API_URL=http://localhost:8000
```

### Backend (.env)

Create `backend/.env` (copy from `backend/.env.example`):

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=choyes
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

## Step 3: Start Services

### Terminal 1: React Frontend (Vite)

```bash
cd frontend
npm run dev
# Opens http://localhost:3000
```

### Terminal 2: Python FastAPI Backend

```bash
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8000
# API at http://localhost:8000/api
```

## Step 4: Access the Application

Open `http://localhost:3000` in your browser.

### Default Route Flow

1. Root `/` redirects to `/access/login`
2. Login page at `/access/login`
3. On login success, redirected to `/access/dashboard` or user dashboard `/dashboard`

### Mock Authentication (for testing without a real backend)

Open DevTools console and paste:

```javascript
const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
const payload = btoa(JSON.stringify({ login: 'test-user', role: 'ADMIN', exp: Math.floor(Date.now() / 1000) + 60 * 60 }));
const token = `${header}.${payload}.`;
localStorage.setItem('accessToken', token);
window.location.reload();
```

This seeds a non-expired JWT with role `ADMIN`. You can change the role to `USER` or `AGENCY` as needed.

## Step 5: Explore the UI

### Admin Routes (requires role: ADMIN)

- `/access/dashboard`
- `/access/accounts`
- `/access/users`
- `/access/agencies`
- `/access/test-centers`
- `/access/session-centers`
- `/access/section-rules`

### User Routes (requires role: USER)

- `/dashboard`
- `/exam/booking`
- `/exam/reservations`

## Step 6: Test Center Management (with Guards)

1. Navigate to `/access/test-centers` (as ADMIN)
2. Component-level access is validated by `useTestCenterAccess`
3. For specific center routes, use `TestCenterProtectedRoute`
4. For owner-only pages, use `TestCenterOwnerRoute`

Example React usage:

```tsx
import { useParams } from "react-router-dom";
import { useTestCenterAccess } from "@/hooks/useTestCenterAccess";

function ViewTestCenterPage() {
  const { id } = useParams();
  const { hasAccess, loading } = useTestCenterAccess(id);

  if (loading) return <div>Validating access...</div>;
  if (hasAccess === false) return <Navigate to="/" replace />;

  return <div>Test Center {id} Details</div>;
}
```

## Step 7: Run Playwright E2E Tests

With both frontend dev server and backend running:

```bash
cd frontend
E2E_BASE_URL=http://localhost:3000 npx playwright test src/test/testcenter.guard.spec.ts --headed
```

## Troubleshooting

### "Cannot fetch /test_centers/:id/validate_access"

- Ensure backend is running on port 8000
- Check `CORS_ORIGINS` in `backend/.env`
- Verify MongoDB is running and `MONGO_URL` is correct

### "Redirect to login immediately after seed token"

- Make sure `accessToken` is present in localStorage
- Confirm JWT payload has a valid `exp` timestamp

### "Test Center access hook returns hasAccess=false"

- Inspect network traffic for `/test_centers/:id/validate_access`
- Verify backend returns `access: true` or `allowed: true`

## Key Files for Reference

- `frontend/src/hooks/useTestCenterAccess.ts`
- `frontend/src/components/TestCenterProtectedRoute.tsx`
- `frontend/src/components/TestCenterOwnerRoute.tsx`
- `frontend/src/components/WithTestCenterAccess.tsx`
- `frontend/src/api/testCenter.api.ts`
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/App.tsx`
