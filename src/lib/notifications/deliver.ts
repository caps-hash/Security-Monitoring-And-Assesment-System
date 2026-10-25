import "server-only";
import {
  buildAccountEmail,
  buildAccountSms,
  emailProviderConfigured,
  missingEmailConfigurationDetail,
  missingSmsConfigurationDetail,
  smsProviderName,
  toE164,
  type NoticeResult,
} from "@/lib/personnel/account-notices";

// ponytail: fetch the configured provider directly. No email or SMS SDK until one is actually used.

const requestTimeoutMs = 10_000;

export async function deliverAccountEmail(input: {
  email: string;
  fullName: string;
  employeeNumber: string;
  smsSent: boolean;
}): Promise<NoticeResult> {
  if (!emailProviderConfigured()) {
    return { status: "not_configured", detail: missingEmailConfigurationDetail() };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.EMAIL_FROM?.trim() ?? "";
  const message = buildAccountEmail(input);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.email],
        subject: message.subject,
        text: message.text,
      }),
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    if (!response.ok) {
      return {
        status: "failed",
        detail: `Email delivery failed (provider status ${response.status}).`,
      };
    }
    return { status: "sent", detail: "Email sent." };
  } catch {
    return { status: "failed", detail: "The email provider could not be reached." };
  }
}

export async function deliverAccountSms(input: {
  phone: string;
  employeeNumber: string;
  temporaryPassword: string;
}): Promise<NoticeResult> {
  const provider = smsProviderName();
  if (!provider) {
    return { status: "not_configured", detail: missingSmsConfigurationDetail() };
  }

  const body = buildAccountSms(input);

  try {
    const response =
      provider === "twilio"
        ? await sendTwilio(input.phone, body)
        : await sendSemaphore(input.phone, body);
    if (!response.ok) {
      return {
        status: "failed",
        detail: `SMS delivery failed (provider status ${response.status}).`,
      };
    }
    return { status: "sent", detail: "SMS sent." };
  } catch {
    return { status: "failed", detail: "The SMS provider could not be reached." };
  }
}

async function sendTwilio(phone: string, body: string): Promise<Response> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  const from = process.env.TWILIO_FROM?.trim() ?? "";
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const payload = new URLSearchParams({
    To: toE164(phone),
    From: from,
    Body: body,
  });

  return fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload,
      signal: AbortSignal.timeout(requestTimeoutMs),
    },
  );
}

async function sendSemaphore(phone: string, body: string): Promise<Response> {
  const payload = new URLSearchParams({
    apikey: process.env.SEMAPHORE_API_KEY?.trim() ?? "",
    number: toE164(phone).replace(/^\+/, ""),
    message: body,
  });
  const sender = process.env.SEMAPHORE_SENDER?.trim();
  if (sender) {
    payload.set("sendername", sender);
  }

  return fetch("https://api.semaphore.co/api/v4/messages", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload,
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
}
