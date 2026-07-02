import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import TestCenterApi from "@/api/testCenter.api";

interface UseTestCenterAccessOptions {
  onAccessDenied?: () => void;
  cacheDuration?: number;
}

interface UseTestCenterAccessResult {
  hasAccess: boolean | null;
  loading: boolean;
  error: Error | null;
}

type TestCenterId = string | number | null | undefined;

type AccessCacheEntry = {
  access: boolean;
  timestamp: number;
};

const accessCache: Record<string, AccessCacheEntry> = {};

export function useTestCenterAccess(
  testCenterId: TestCenterId,
  { onAccessDenied, cacheDuration = 5 * 60 * 1000 }: UseTestCenterAccessOptions = {}
): UseTestCenterAccessResult {
  const { isAuthenticated } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated || !testCenterId) {
      setHasAccess(false);
      setError(null);
      return;
    }

    const cacheKey = String(testCenterId);
    const cached = accessCache[cacheKey];

    if (cached && Date.now() - cached.timestamp < cacheDuration) {
      setHasAccess(cached.access);
      setError(null);
      if (!cached.access && onAccessDenied) onAccessDenied();
      return;
    }

    const validateAccess = async () => {
      try {
        const resp = await TestCenterApi.validateAccess(testCenterId);
        const payload = resp?.data ?? resp;
        const ok = payload?.access === true || payload?.allowed === true;

        accessCache[cacheKey] = { access: !!ok, timestamp: Date.now() };

        if (cancelled) return;

        setHasAccess(!!ok);
        setError(null);

        if (!ok && onAccessDenied) onAccessDenied();
      } catch (err) {
        if (cancelled) return;

        const errorObject = err instanceof Error ? err : new Error(String(err));
        console.error("useTestCenterAccess error:", err);
        setError(errorObject);
        setHasAccess(false);
        if (onAccessDenied) onAccessDenied();
      }
    };

    setHasAccess(null);
    validateAccess();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, testCenterId, onAccessDenied, cacheDuration]);

  return { hasAccess, loading: hasAccess === null, error };
}

interface UseIsTestCenterOwnerOptions {
  onOwnerCheckFail?: () => void;
  cacheDuration?: number;
}

interface UseIsTestCenterOwnerResult {
  isOwner: boolean | null;
  loading: boolean;
  error: Error | null;
}

export function useIsTestCenterOwner(
  { onOwnerCheckFail, cacheDuration = 5 * 60 * 1000 }: UseIsTestCenterOwnerOptions = {}
): UseIsTestCenterOwnerResult {
  const { isAuthenticated } = useAuth();
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const ownerCacheKey = "__isTestCenterOwner";

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      setIsOwner(false);
      setError(null);
      return;
    }

    const cached = accessCache[ownerCacheKey];
    if (cached && Date.now() - cached.timestamp < cacheDuration) {
      setIsOwner(cached.access);
      setError(null);
      if (!cached.access && onOwnerCheckFail) onOwnerCheckFail();
      return;
    }

    const checkOwner = async () => {
      try {
        const resp = await TestCenterApi.checkUserIsTestCenterOwner();
        const payload = resp?.data ?? resp;
        const ok = payload?.is_owner === true;

        accessCache[ownerCacheKey] = { access: !!ok, timestamp: Date.now() };

        if (cancelled) return;

        setIsOwner(!!ok);
        setError(null);

        if (!ok && onOwnerCheckFail) onOwnerCheckFail();
      } catch (err) {
        if (cancelled) return;

        const errorObject = err instanceof Error ? err : new Error(String(err));
        console.error("useIsTestCenterOwner error:", err);
        setError(errorObject);
        setIsOwner(false);
        if (onOwnerCheckFail) onOwnerCheckFail();
      }
    };

    setIsOwner(null);
    checkOwner();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, onOwnerCheckFail, cacheDuration]);

  return { isOwner, loading: isOwner === null, error };
}
