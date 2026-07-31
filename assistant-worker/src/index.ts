/**
 * WA School Funding Explorer - site guide Worker.
 *
 *   GET  /health  liveness plus whether the key and origins are configured
 *   POST /chat    one question in, one validated structured answer out
 *
 * The API key exists only as a Cloudflare secret in this Worker. The browser
 * never sees it and never contacts OpenAI directly.
 *
 * Logging is deliberately thin: request IDs, outcome codes, and sizes, never
 * the visitor's question or the model's answer. When something breaks, the
 * OpenAI request ID is what you need to look it up in the provider dashboard,
 * and it is returned to the caller as an opaque support code only on 5xx.
 */
import { corsHeaders, isAllowedOrigin, jsonResponse, parseAllowedOrigins } from './cors';
import { checkRateLimit, type RateLimitEnv } from './rateLimit';
import { callModel, DEFAULT_MODEL, type OpenAiEnv } from './openai';
import { isFailure, LIMITS, validateRequest } from './validation';

export type Env = OpenAiEnv &
  RateLimitEnv & {
    ALLOWED_ORIGINS?: string;
  };

/** Below the platform's own limit, so a hung upstream fails cleanly. */
const UPSTREAM_TIMEOUT_MS = 25_000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS);

    if (request.method === 'OPTIONS') {
      // Unknown origins get no CORS headers, so the preflight fails closed.
      return new Response(null, { status: 204, headers: corsHeaders(origin, allowed) });
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return jsonResponse(
        {
          status: 'ok',
          model: env.OPENAI_MODEL || DEFAULT_MODEL,
          // Presence only - never the value.
          configured: Boolean(env.OPENAI_API_KEY),
          allowedOrigins: allowed.length,
          rateLimit: {
            burst: Boolean(env.BURST_LIMIT),
            sustained: Boolean(env.SUSTAINED_LIMIT),
            daily: Boolean(env.DAILY_KV) && Number(env.DAILY_MESSAGE_CAP ?? '0') > 0,
          },
        },
        200,
        origin,
        allowed
      );
    }

    if (url.pathname !== '/chat') {
      return jsonResponse({ error: 'Not found.' }, 404, origin, allowed);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed.' }, 405, origin, allowed, {
        allow: 'POST, OPTIONS',
      });
    }

    /*
      Browsers always send Origin on a cross-origin POST, so a missing or
      unlisted one means this is not the site calling. Rejected before any
      body is read, so an unapproved caller cannot make the Worker do work.
    */
    if (!isAllowedOrigin(origin, allowed)) {
      return jsonResponse({ error: 'Origin not allowed.' }, 403, null, allowed);
    }

    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return jsonResponse({ error: 'Expected application/json.' }, 415, origin, allowed);
    }

    // Trust the declared length when present, and re-check the real size after
    // reading, since Content-Length can lie.
    const declaredLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > LIMITS.bodyBytes) {
      return jsonResponse({ error: 'Request too large.' }, 413, origin, allowed);
    }

    let raw: string;
    try {
      raw = await request.text();
    } catch {
      return jsonResponse({ error: 'Could not read request body.' }, 400, origin, allowed);
    }
    if (raw.length > LIMITS.bodyBytes) {
      return jsonResponse({ error: 'Request too large.' }, 413, origin, allowed);
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonResponse({ error: 'Malformed JSON.' }, 400, origin, allowed);
    }

    const clean = validateRequest(body);
    if (isFailure(clean)) {
      return jsonResponse({ error: clean.error }, 400, origin, allowed);
    }

    if (!env.OPENAI_API_KEY) {
      console.error('assistant: OPENAI_API_KEY is not set');
      return jsonResponse({ error: 'Assistant is not configured.' }, 503, origin, allowed);
    }

    const clientIp = request.headers.get('CF-Connecting-IP');
    const limit = await checkRateLimit(env, clean.visitorId, clientIp, new Date());
    if (!limit.allowed) {
      return jsonResponse(
        { error: 'Too many requests. Please wait a moment and try again.' },
        429,
        origin,
        allowed,
        { 'retry-after': String(limit.retryAfter) }
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
      const outcome = await callModel(env, clean, controller.signal);

      if (!outcome.ok) {
        // Sizes and codes only - never the question or the answer.
        console.error(
          JSON.stringify({
            event: 'assistant_failure',
            code: outcome.code,
            openaiRequestId: outcome.requestId,
            messageChars: clean.message.length,
            knowledgeChunks: clean.knowledge.length,
            historyTurns: clean.history.length,
          })
        );

        if (outcome.code === 'timeout') {
          return jsonResponse({ error: 'The assistant timed out.' }, 504, origin, allowed);
        }
        if (outcome.code === 'refusal') {
          return jsonResponse(
            { error: 'The assistant could not answer that question.' },
            422,
            origin,
            allowed
          );
        }
        if (outcome.code === 'incomplete' || outcome.code === 'invalid') {
          return jsonResponse(
            { error: 'The assistant could not produce a reliable answer.' },
            422,
            origin,
            allowed
          );
        }
        return jsonResponse(
          {
            error: 'The assistant is temporarily unavailable.',
            // Opaque to the visitor, but enough for the owner to find the call.
            ...(outcome.requestId ? { supportCode: outcome.requestId } : {}),
          },
          502,
          origin,
          allowed
        );
      }

      console.log(
        JSON.stringify({
          event: 'assistant_ok',
          openaiRequestId: outcome.requestId,
          replyChars: outcome.result.reply.length,
          actions: outcome.result.actions.length,
          sources: outcome.result.sources.length,
          language: clean.language,
        })
      );

      return jsonResponse({ result: outcome.result }, 200, origin, allowed);
    } catch {
      // Nothing from the thrown value is surfaced: it can carry provider
      // internals and, in some SDK paths, request content.
      console.error(JSON.stringify({ event: 'assistant_unhandled' }));
      return jsonResponse(
        { error: 'The assistant is temporarily unavailable.' },
        500,
        origin,
        allowed
      );
    } finally {
      clearTimeout(timer);
    }
  },
} satisfies ExportedHandler<Env>;
