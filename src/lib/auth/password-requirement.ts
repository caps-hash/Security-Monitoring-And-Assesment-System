export function mustChangePassword(appMetadata: unknown): boolean {
  if (!appMetadata || typeof appMetadata !== "object") {
    return false;
  }
  return (
    (appMetadata as { must_change_password?: unknown }).must_change_password === true
  );
}
