import "server-only";
import {
  buildAccountEmail,
  buildAccountSms,
  emailProviderConfigured,
  missingEmailConfigurationDetail,
  missingSmsConfigurationDetail,
  smsProviderName,
  type NoticeResult,
} from "@/lib/personnel/account-notices";
import {
  parseProviderPayload,
  philippineMobileE164,
  providerPhone,
  type ProviderAttempt,
} from "@/lib/notifications/sms-policy";

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
  const sent = await sendConfiguredSms({
    phone: input.phone,
    body: buildAccountSms(input),
  });
  if (sent.status === "not_configured") {
    return { status: "not_configured", detail: missingSmsConfigurationDetail() };
  }
  if (sent.status === "invalid_phone") {
    return { status: "failed", detail: "The mobile number is not a valid Philippine mobile number." };
  }
  if (sent.status !== "sent") {
    return {
      status: "failed",
      detail: sent.errorMessage || "SMS delivery failed.",
    };
  }
  return { status: "sent", detail: "SMS accepted by the provider. Delivery is not confirmed until a callback." };
}

export type ConfiguredSmsResult = {
  status: "sent" | "failed" | "rejected" | "not_configured" | "invalid_phone";
  provider: "twilio" | "semaphore" | null;
  providerMessageId: string | null;
  errorMessage: string | null;
  retryable: boolean;
};

export async function sendConfiguredSms(input: {
  phone: string;
  body: string;
}): Promise<ConfiguredSmsResult> {
  const provider = smsProviderName();
  if (!provider) {
    return {
      status: "not_configured",
      provider: null,
      providerMessageId: null,
      errorMessage: missingSmsConfigurationDetail(),
      retryable: true,
    };
  }
  const e164 = philippineMobileE164(input.phone);
  if (!e164) {
    return {
      status: "invalid_phone",
      provider,
      providerMessageId: null,
      errorMessage: "The mobile number is not a valid Philippine mobile number.",
      retryable: false,
    };
  }

  try {
    const response =
      provider === "twilio"
        ? await sendTwilio(e164, input.body)
        : await sendSemaphore(e164, input.body);
    const bodyText = await response.text();
    const parsed: ProviderAttempt = parseProviderPayload(provider, response.status, bodyText);
    return {
      status: parsed.outcome,
      provider,
      providerMessageId: parsed.providerMessageId,
      errorMessage: parsed.errorMessage,
      retryable: parsed.retryable,
    };
  } catch {
    return {
      status: "failed",
      provider,
      providerMessageId: null,
      errorMessage: "The SMS provider could not be reached.",
      retryable: false,
    };
  }
}

async function sendTwilio(phone: string, body: string): Promise<Response> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  const from = process.env.TWILIO_FROM?.trim() ?? "";
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const payload = new URLSearchParams({
    To: providerPhone(phone, "twilio"),
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
    number: providerPhone(phone, "semaphore"),
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
