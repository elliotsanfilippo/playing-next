/*
 * In-memory, per-process rate limiting. This is real protection against
 * a single client hammering an endpoint (bots, retry loops, scripted
 * abuse), and needs no new infrastructure or account signup.
 *
 * What it does NOT do: coordinate across multiple serverless instances.
 * If this app runs on a platform that spins up several concurrent
 * instances (e.g. Vercel under load), each instance enforces its own
 * limit independently, so the *effective* limit under heavy concurrent
 * load is (limit × instance count), not `limit`. For a hard guarantee
 * regardless of instance count, this would need a shared store (e.g.
 * Upstash Redis) — a reasonable upgrade once real traffic justifies it,
 * but not required to get real protection today.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const MAX_TRACKED_KEYS = 20_000;

function sweepExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) {
      buckets.delete(key);
    }
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    if (buckets.size > MAX_TRACKED_KEYS) {
      sweepExpired(now);
    }

    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") || "unknown";
}
