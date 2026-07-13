export interface PendingAuth {
  login: string;
  password: string;
  otpMethod: string;
}

let pendingAuth: PendingAuth | null = null;

export function setPendingAuth(value: PendingAuth) {
  pendingAuth = value;
}

export function getPendingAuth() {
  return pendingAuth;
}

export function clearPendingAuth() {
  pendingAuth = null;
}
