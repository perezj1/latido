import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.10";

type ClaimedNotification = {
  user_id: string;
  attempts: number;
  first_unread_at: string;
};

type DeliveryContext = {
  profile_email: string | null;
  display_name: string | null;
  unread_count: number;
  latest_conversation_id: string | null;
  app_opened_since_first_unread: boolean;
  email_enabled: boolean;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SMTP_HOSTNAME = Deno.env.get("SMTP_HOSTNAME") ||
  "authsmtp.securemail.pro";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") || "465");
const SMTP_SECURE =
  (Deno.env.get("SMTP_SECURE") || "true").toLowerCase() === "true";
const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME") || "";
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD") || "";
const SMTP_FROM = Deno.env.get("SMTP_FROM") || SMTP_USERNAME;
const APP_URL = (Deno.env.get("LATIDO_APP_URL") || "https://www.latido.ch")
  .replace(/\/+$/, "");
const CRON_SECRET = Deno.env.get("EMAIL_CRON_SECRET") || "";
const MAX_BATCH = Math.min(
  Math.max(Number(Deno.env.get("EMAIL_MAX_BATCH") || "25"), 1),
  100,
);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const transport = nodemailer.createTransport({
  host: SMTP_HOSTNAME,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: SMTP_USERNAME,
    pass: SMTP_PASSWORD,
  },
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function messageUrl(conversationId?: string | null) {
  return conversationId
    ? `${APP_URL}/mensajes?conv=${encodeURIComponent(conversationId)}`
    : `${APP_URL}/mensajes`;
}

function buildMessageEmail(name: string, conversationId?: string | null) {
  const safeName = escapeHtml(name || "Usuario");
  const url = messageUrl(conversationId);

  return {
    subject: "Tienes mensajes sin leer en Latido",
    text: [
      `Hola ${name || "Usuario"},`,
      "",
      "Tienes mensajes sin leer en Latido.",
      `Puedes abrirlos aqui: ${url}`,
      "",
      "Este aviso se envia una sola vez hasta que leas todos tus mensajes.",
    ].join("\n"),
    html: `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f7f7f5;font-family:Arial,sans-serif;color:#1f2937">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f7f7f5">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;padding:32px">
            <tr><td style="font-size:24px;font-weight:700;color:#e85d3f;padding-bottom:20px">Latido</td></tr>
            <tr><td style="font-size:16px;line-height:1.6">Hola ${safeName},</td></tr>
            <tr><td style="font-size:16px;line-height:1.6;padding:12px 0 24px">Tienes mensajes sin leer en Latido.</td></tr>
            <tr>
              <td>
                <a href="${url}" style="display:inline-block;background:#e85d3f;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">Ver mensajes</a>
              </td>
            </tr>
            <tr><td style="font-size:12px;line-height:1.5;color:#6b7280;padding-top:28px">Este aviso se envia una sola vez hasta que leas todos tus mensajes.</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}

async function sendMail(
  to: string,
  name: string,
  conversationId?: string | null,
) {
  const content = buildMessageEmail(name, conversationId);

  await new Promise<void>((resolve, reject) => {
    transport.sendMail({
      from: SMTP_FROM,
      to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    }, (error: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function updateState(
  userId: string,
  values: Record<string, unknown>,
  expectedStatus = "processing",
) {
  const { error } = await supabase
    .from("message_email_notification_state")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", expectedStatus);

  if (error) throw error;
}

async function suppress(userId: string, reason: string) {
  await updateState(userId, {
    status: "suppressed",
    due_at: null,
    processing_started_at: null,
    last_error: reason,
  });
}

async function retryLater(notification: ClaimedNotification, error: unknown) {
  const delayMinutes = Math.min(Math.max(notification.attempts * 5, 5), 60);
  await updateState(notification.user_id, {
    status: "pending",
    due_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
    processing_started_at: null,
    last_error: error instanceof Error
      ? error.message.slice(0, 1000)
      : String(error).slice(0, 1000),
  });
}

async function processNotification(notification: ClaimedNotification) {
  const { data: context, error: contextError } = await supabase
    .rpc("message_email_delivery_context", { p_user_id: notification.user_id })
    .maybeSingle<DeliveryContext>();

  if (contextError) throw contextError;
  if (!context || Number(context.unread_count) < 1) {
    const { error } = await supabase
      .from("message_email_notification_state")
      .delete()
      .eq("user_id", notification.user_id)
      .eq("status", "processing");
    if (error) throw error;
    return "no_unread";
  }

  if (!context.email_enabled) {
    await suppress(notification.user_id, "email_disabled");
    return "email_disabled";
  }

  if (context.app_opened_since_first_unread) {
    await suppress(notification.user_id, "app_opened");
    return "app_opened";
  }

  const { data: authResult, error: authError } = await supabase.auth.admin
    .getUserById(notification.user_id);
  if (authError) throw authError;

  const recipientEmail = authResult.user?.email || context.profile_email;
  if (!recipientEmail) {
    await suppress(notification.user_id, "missing_email");
    return "missing_email";
  }

  await sendMail(
    recipientEmail,
    context.display_name || authResult.user?.user_metadata?.name || "Usuario",
    context.latest_conversation_id,
  );

  await updateState(notification.user_id, {
    status: "sent",
    sent_at: new Date().toISOString(),
    due_at: null,
    processing_started_at: null,
    last_error: null,
  });
  return "sent";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ ok: false, error: "Missing Supabase function secrets" }, 500);
  }
  if (!SMTP_USERNAME || !SMTP_PASSWORD || !SMTP_FROM) {
    return json({ ok: false, error: "Missing Nominalia mail secrets" }, 500);
  }
  if (!CRON_SECRET || req.headers.get("x-latido-cron-secret") !== CRON_SECRET) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json().catch(() => ({})) as { test_email?: string };

    if (body.test_email) {
      await sendMail(body.test_email, "Prueba Latido");
      return json({ ok: true, test: true });
    }

    const { data, error } = await supabase
      .rpc("claim_pending_message_email_notifications", { p_limit: MAX_BATCH });

    if (error) throw error;

    const claimed = (data || []) as ClaimedNotification[];
    const results = {
      claimed: claimed.length,
      sent: 0,
      suppressed: 0,
      retried: 0,
    };

    for (const notification of claimed) {
      try {
        const outcome = await processNotification(notification);
        if (outcome === "sent") results.sent += 1;
        else results.suppressed += 1;
      } catch (error) {
        console.error("message_email_delivery_failed", {
          userId: notification.user_id,
          attempt: notification.attempts,
          error: error instanceof Error ? error.message : String(error),
        });
        await retryLater(notification, error);
        results.retried += 1;
      }
    }

    await supabase
      .from("app_presence_sessions")
      .delete()
      .lt(
        "active_until",
        new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
      );

    console.log("message_email_batch", results);
    return json({ ok: true, ...results });
  } catch (error) {
    console.error(error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
