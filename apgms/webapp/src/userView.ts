export interface UserSummary {
  email: string;
  orgId: string;
}

export function renderUserSummary(users: UserSummary[]): string {
  if (users.length === 0) {
    return "No users connected";
  }
  return users.map((user) => `${user.email} (${user.orgId})`).join(", ");
}
