export interface AuthenticatedUser {
  sub: string;
  email?: string;
  orgId?: string;
  roles: string[];
}

export interface AuthContext {
  user: AuthenticatedUser;
}
