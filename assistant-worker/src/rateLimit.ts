/**
 * Rate limiting, in three layers.
 *
 * 1. A burst limiter over a 10-second window, so one visitor cannot fire a
 *    dozen questions at once.
 * 2. A sustained limiter over 60 seconds.
 * 3. An optional daily cap in KV.
 *
 * Cloudflare's rate-limiting binding only supports 10- and 60-second periods,
 * which is why a day-long budget needs storage rather than a third binding.
 * The KV namespace is optional: if it is not bound the daily cap is skipped
 * and the two window limiters still apply, so the Worker deploys and runs
 * without any extra setup.
 *
 * The key is the anonymous per-session visitor ID. A secondary key derived
 * from the connecting IP is used only as a coarse backstop against someone
 * rotating the visitor ID to evade the limit - it is hashed and never stored
 * or logged.
 */

export type RateLimiter = { limit: (options: { key: string }) => Promise<{ success: boolean }> };

export type RateLimitEnv = {
  BURST_LIMIT?: RateLimiter;
  SUSTAINED_LIMIT?: RateLimiter;
  DAILY_KV?: KVNamespace;
  DAILY_MESSAGE_CAP?: string;
};

export type RateLimitResult = {
  allowed: boolean;
  /** Seconds to wait, for the Retry-After header. */
  retryAfter: number;
};

const ALLOWED: RateLimitResult = { allowed: true, retryAfter: 0 };

/** Non-reversible key material so an IP is never written to storage. */
async function hashKey(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const view = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < 12; i += 1) hex += view[i].toString(16).padStart(2, '0');
  return hex;
}

function todayUtc(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function checkRateLimit(
  env: RateLimitEnv,
  visitorId: string,
  clientIp: string | null,
  now: Date
): Promise<RateLimitResult> {
  const ipKey = clientIp ? await hashKey(clientIp) : null;

  if (env.BURST_LIMIT) {
    const visitor = await env.BURST_LIMIT.limit({ key: `v:${visitorId}` });
    if (!visitor.success) return { allowed: false, retryAfter: 10 };
    if (ipKey) {
      const byIp = await env.BURST_LIMIT.limit({ key: `i:${ipKey}` });
      if (!byIp.success) return { allowed: false, retryAfter: 10 };
    }
  }

  if (env.SUSTAINED_LIMIT) {
    const visitor = await env.SUSTAINED_LIMIT.limit({ key: `v:${visitorId}` });
    if (!visitor.success) return { allowed: false, retryAfter: 60 };
    if (ipKey) {
      const byIp = await env.SUSTAINED_LIMIT.limit({ key: `i:${ipKey}` });
      if (!byIp.success) return { allowed: false, retryAfter: 60 };
    }
  }

  const cap = Number(env.DAILY_MESSAGE_CAP ?? '0');
  if (env.DAILY_KV && Number.isFinite(cap) && cap > 0 && ipKey) {
    const key = `daily:${todayUtc(now)}:${ipKey}`;
    const raw = await env.DAILY_KV.get(key);
    const used = raw ? Number(raw) : 0;
    if (Number.isFinite(used) && used >= cap) {
      // Seconds left in the UTC day.
      const endOfDay = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1
      );
      return {
        allowed: false,
        retryAfter: Math.max(60, Math.ceil((endOfDay - now.getTime()) / 1000)),
      };
    }
    /*
      Read-modify-write is not atomic in KV, so a burst can slip a few over the
      cap. That is acceptable here: the two window limiters above are the real
      throttle, and this is a slow-drip daily budget, not a billing control.
      Making it exact would mean a Durable Object per visitor for no practical
      gain.
    */
    await env.DAILY_KV.put(key, String(used + 1), { expirationTtl: 60 * 60 * 26 });
  }

  return ALLOWED;
}
