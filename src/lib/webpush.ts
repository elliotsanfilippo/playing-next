import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

/*
 * Configured lazily, on first send, rather than at module load. This
 * file is imported from the Stripe success/webhook routes — if VAPID
 * env vars were ever missing and setVapidDetails() threw at import
 * time, it would take the whole payment flow down with it, not just
 * push notifications.
 */
let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return true;

  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    console.error("Push notifications are not configured (missing VAPID env vars).");
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch (error) {
    console.error("Invalid VAPID configuration:", error);
    return false;
  }
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

/*
 * Fans a notification out to every device a DJ has subscribed on.
 * Subscriptions the push service reports as gone (410/404) are pruned
 * so the table doesn't accumulate dead endpoints over time.
 */
export async function sendPushToDJ(djProfileId: string, payload: PushPayload) {
  if (!ensureVapidConfigured()) return;

  const { data: subscriptions, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("dj_profile_id", djProfileId);

  if (error || !subscriptions || subscriptions.length === 0) {
    return;
  }

  const staleIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify(payload)
        );
      } catch (sendError) {
        const statusCode =
          sendError instanceof Error && "statusCode" in sendError
            ? (sendError as { statusCode?: number }).statusCode
            : undefined;

        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(subscription.id);
        } else {
          console.error("Push send error:", sendError);
        }
      }
    })
  );

  if (staleIds.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", staleIds);
  }
}
