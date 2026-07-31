/**
 * CORS.
 *
 * The allow-list is exact-origin. GitHub Pages serves this site from
 * `https://<user>.github.io/<repo>/`, but an Origin header never carries a
 * path - it is scheme + host + port only - so the configured value must be
 * `https://<user>.github.io` and path-scoping is not something CORS can do.
 * That is a property of the platform, not an oversight: any page on that host
 * can call this Worker, so the origin check is one layer among several rather
 * than the whole defence.
 *
 * Unknown origins get no CORS headers at all, so the browser refuses the
 * response.
 */

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string | null, allowed: string[]): boolean {
  if (!origin) return false;
  return allowed.includes(origin.replace(/\/+$/, ''));
}

export function corsHeaders(origin: string | null, allowed: string[]): HeadersInit {
  if (!isAllowedOrigin(origin, allowed)) return {};
  return {
    'access-control-allow-origin': origin as string,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    // The allowed origin varies per request, so caches must key on it.
    vary: 'Origin',
  };
}

export function jsonResponse(
  body: unknown,
  status: number,
  origin: string | null,
  allowed: string[],
  extraHeaders: HeadersInit = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // This endpoint is per-visitor and must never be cached in between.
      'cache-control': 'no-store',
      ...corsHeaders(origin, allowed),
      ...extraHeaders,
    },
  });
}
