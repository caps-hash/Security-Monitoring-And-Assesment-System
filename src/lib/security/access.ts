import type { UserRole } from "@/lib/auth/roles";

const SECRET_KEY = /password|token|secret|authorization|api[_-]?key|cookie|session/i;

export function requiredRoleForPath(pathname: string): UserRole | null {
  if (pathname === "/dashboard/hr" || pathname.startsWith("/dashboard/hr/")) {
    return "hr";
  }
  if (pathname === "/dashboard/supervisor" || pathname.startsWith("/dashboard/supervisor/")) {
    return "supervisor";
  }
  if (pathname === "/dashboard/employee" || pathname.startsWith("/dashboard/employee/")) {
    return "employee";
  }
  return null;
}

export function evidencePathAllowed(employeeId: string, path: string): boolean {
  if (!employeeId || path.includes("..") || path.includes("\\") || path.startsWith("/")) {
    return false;
  }
  const suffix = path.slice(employeeId.length + 1);
  return path.startsWith(`${employeeId}/`) && /^[0-9a-f-]{36}\/(time-in|time-out)\.jpg$/i.test(suffix);
}

export function sanitizeAuditChanges(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const clean: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_KEY.test(key) || entry == null || typeof entry === "object") {
      continue;
    }
    const text = String(entry).slice(0, 180);
    if (SECRET_KEY.test(text)) {
      continue;
    }
    clean[key.slice(0, 40)] = text;
  }
  return clean;
}

const attempts = new Map<string, number[]>();

export function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    attempts.set(key, recent);
    return false;
  }
  recent.push(now);
  attempts.set(key, recent);
  return true;
}

export function clearRateLimits(): void {
  attempts.clear();
}

export type AccessTarget =
  | "hr-page"
  | "supervisor-page"
  | "employee-page"
  | "own-profile"
  | "other-profile"
  | "other-dtr"
  | "other-photo"
  | "official-score"
  | "final-decision"
  | "role-change"
  | "other-supervisor-records"
  | "evaluation-file"
  | "audit-log";

export function accessDecision(input: {
  actorRole: UserRole | "anonymous";
  active: boolean;
  target: AccessTarget;
  assigned?: boolean;
  ownsRecord?: boolean;
}): "allow" | "deny" {
  if (input.actorRole === "anonymous" || !input.active) {
    return "deny";
  }
  if (input.target === "role-change") {
    return "deny";
  }
  if (input.target === "hr-page" || input.target === "official-score" || input.target === "final-decision" || input.target === "audit-log") {
    return input.actorRole === "hr" ? "allow" : "deny";
  }
  if (input.target === "supervisor-page") {
    return input.actorRole === "supervisor" ? "allow" : "deny";
  }
  if (input.target === "other-supervisor-records") {
    return "deny";
  }
  if (input.target === "employee-page") {
    return input.actorRole === "employee" ? "allow" : "deny";
  }
  if (input.target === "own-profile") {
    return input.ownsRecord ? "allow" : "deny";
  }
  if (input.ownsRecord && input.target !== "evaluation-file") {
    return "allow";
  }
  if (input.ownsRecord && input.target === "evaluation-file" && input.actorRole === "employee") {
    return "deny";
  }
  if (input.actorRole === "hr") {
    return "allow";
  }
  if (input.actorRole === "supervisor" && input.assigned) {
    return "allow";
  }
  return "deny";
}
