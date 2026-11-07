import { runEvaluationReminders } from "@/lib/notifications/sms-dispatch";
import { secretsMatch } from "@/lib/notifications/sms-policy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runProtected(request);
}

export async function POST(request: Request) {
  return runProtected(request);
}

async function runProtected(request: Request) {
  const secret = process.env.SMS_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim() || "";
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!secret) {
    return Response.json({ error: "SMS_CRON_SECRET is not configured." }, { status: 503 });
  }
  if (!secretsMatch(token, secret)) {
    return Response.json({ error: "Unauthorized reminder check." }, { status: 401 });
  }
  const result = await runEvaluationReminders();
  return Response.json(result);
}
