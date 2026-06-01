export function getAdminEmails(): string[] {
  return (import.meta.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(
  user: { email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined,
  profileAdmin?: boolean
): boolean {
  if (!user) return false;
  if (profileAdmin) return true;
  if (user.user_metadata?.role === 'admin') return true;
  const email = user.email?.toLowerCase();
  return email ? getAdminEmails().includes(email) : false;
}
