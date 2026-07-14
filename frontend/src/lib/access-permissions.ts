export interface PermissionSubject {
  role?: string;
  permission_mode?: "LEGACY" | "MANAGED";
  permissions?: Record<string, boolean>;
}

export function resolveAccessPermission(user: PermissionSubject | null | undefined, permission: string): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (user.permissions && permission in user.permissions) return user.permissions[permission] === true;
  if (user.permission_mode === "MANAGED") return false;
  if (permission === "users.create") return user.role === "AGENCY";
  return user.role === "USER" && (
    permission === "booking.create" ||
    permission === "reservation.manage" ||
    permission === "payment.create"
  );
}
