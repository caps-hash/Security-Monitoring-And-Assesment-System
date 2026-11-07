import { createHmac } from "node:crypto";
import { applyProviderDeliveryUpdate } from "@/lib/notifications/sms-dispatch";
import { secretsMatch, webhookStatus } from "@/lib/notifications/sms-policy";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.SMS_WEBHOOK_SECRET?.trim() ?? "";
  const headerSecret = request.headers.get("x-sms-webhook-secret") ?? "";
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const raw = await request.text();
  const contentType = request.headers.get("content-type") ?? "";
  const params = contentType.includes("application/json") ? {} : Object.fromEntries(new URLSearchParams(raw));
  const secretAccepted = Boolean(secret) && (secretsMatch(headerSecret, secret) || secretsMatch(token, secret));
  const twilioAccepted = twilioSignatureValid({
    url: request.url,
    params,
    signature: request.headers.get("x-twilio-signature") ?? "",
    authToken: process.env.TWILIO_AUTH_TOKEN?.trim() ?? "",
  });
  if (!secretAccepted && !twilioAccepted) {
    return Response.json({ error: "Invalid SMS webhook signature." }, { status: 401 });
  }

  const payload = contentType.includes("application/json") ? parseJson(raw) : params;
  const providerMessageId = readField(payload, ["MessageSid", "message_id", "providerMessageId", "sid"]);
  const status = webhookStatus(readField(payload, ["MessageStatus", "status", "delivery_status"]));
  if (!providerMessageId || !status) {
    return Response.json({ updated: false }, { status: 202 });
  }
  const provider = twilioAccepted && !secretAccepted ? "twilio" : readField(payload, ["provider"]) || null;
  const result = await applyProviderDeliveryUpdate({ providerMessageId, status, provider });
  return Response.json(result);
}

function twilioSignatureValid(input: {
  url: string;
  params: Record<string, string>;
  signature: string;
  authToken: string;
}): boolean {
  if (!input.signature || !input.authToken) {
    return false;
  }
  const signed = Object.keys(input.params)
    .sort()
    .reduce((value, key) => value + key + input.params[key], input.url);
  const digest = createHmac("sha1", input.authToken).update(signed).digest("base64");
  return secretsMatch(digest, input.signature);
}

function parseJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed[0] && typeof parsed[0] === "object" ? parsed[0] as Record<string, unknown> : {};
    }
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function readField(payload: Record<string, unknown> | Record<string, string>, names: string[]): string {
  for (const name of names) {
    const value = payload[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number") {
      return String(value);
    }
  }
  return "";
}
