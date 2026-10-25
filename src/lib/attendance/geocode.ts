import "server-only";

const LABEL_LIMIT = 300;

export async function resolveLocationLabel(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const template = process.env.ATTENDANCE_GEOCODING_URL?.trim();
  if (!template || !template.startsWith("https://") || template.includes("@")) {
    return null;
  }

  const url = template
    .replaceAll("{lat}", encodeURIComponent(String(latitude)))
    .replaceAll("{lng}", encodeURIComponent(String(longitude)));
  if (!url.startsWith("https://")) {
    return null;
  }

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json, text/plain" },
      redirect: "manual",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok || !response.url.startsWith("https://")) {
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload: unknown = await response.json();
      return readLabel(payload);
    }
    if (contentType.startsWith("text/plain")) {
      return clip(await response.text());
    }
  } catch {
    return null;
  }
  return null;
}

function readLabel(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const candidate = record.label ?? record.display_name ?? record.address;
  return typeof candidate === "string" ? clip(candidate) : null;
}

function clip(value: string): string | null {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, LABEL_LIMIT);
}
