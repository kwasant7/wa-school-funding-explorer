'use client';

/**
 * The browser half of the assistant transport.
 *
 * No OpenAI client is constructed here and no OpenAI endpoint is contacted.
 * The browser only ever talks to the Cloudflare Worker, whose URL comes from
 * NEXT_PUBLIC_ASSISTANT_API_URL. If that variable is absent the assistant
 * reports itself unconfigured rather than failing at request time - the site
 * has to build and run without it.
 */
import type {
  AssistantChatRequest,
  AssistantClientError,
  AssistantErrorCode,
  AssistantLanguage,
  AssistantResponse,
} from '@/lib/assistant/types';
import { validateResponse } from '@/lib/assistant/validation';
import { assistantStrings } from '@/lib/assistant/i18n';

const RAW_ENDPOINT = process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? '';

/** Trailing slashes on the configured base would produce `//chat`. */
const ENDPOINT = RAW_ENDPOINT.replace(/\/+$/, '');

export function isAssistantConfigured(): boolean {
  return ENDPOINT.length > 0;
}

const REQUEST_TIMEOUT_MS = 30_000;

function errorFor(
  code: AssistantErrorCode,
  language: AssistantLanguage
): AssistantClientError {
  const strings = assistantStrings(language);
  const message =
    code === 'not_configured'
      ? strings.errorNotConfigured
      : code === 'network'
        ? strings.errorNetwork
        : code === 'timeout'
          ? strings.errorTimeout
          : code === 'rate_limited'
            ? strings.errorRateLimited
            : code === 'invalid_response'
              ? strings.errorInvalid
              : strings.errorGeneric;
  return {
    code,
    message,
    retryable: code !== 'not_configured' && code !== 'bad_request',
  };
}

export type ChatOutcome =
  | { ok: true; response: AssistantResponse }
  | { ok: false; error: AssistantClientError };

/**
 * Send one question. `signal` comes from the panel's AbortController so the
 * visitor's Stop button cancels the in-flight request rather than just hiding
 * its result.
 */
export async function sendChat(
  request: AssistantChatRequest,
  signal: AbortSignal
): Promise<ChatOutcome> {
  const language = request.language;
  if (!ENDPOINT) return { ok: false, error: errorFor('not_configured', language) };

  /*
    Two things can stop this request: the visitor pressing Stop, and the
    timeout. AbortSignal.any would express that directly but is too new to
    rely on here, so the timeout aborts its own controller and the visitor's
    signal is forwarded into it.
  */
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let timedOut = false;
  const timeoutMarker = setTimeout(() => {
    timedOut = true;
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${ENDPOINT}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 429) {
        return { ok: false, error: errorFor('rate_limited', language) };
      }
      if (response.status === 400 || response.status === 413) {
        return { ok: false, error: errorFor('bad_request', language) };
      }
      return { ok: false, error: errorFor('server', language) };
    }

    const payload: unknown = await response.json().catch(() => null);
    const validated = validateResponse(
      payload && typeof payload === 'object' && 'result' in payload
        ? (payload as { result: unknown }).result
        : payload
    );
    if (!validated) return { ok: false, error: errorFor('invalid_response', language) };
    return { ok: true, response: validated };
  } catch (error) {
    if (signal.aborted && !timedOut) {
      return { ok: false, error: { code: 'aborted', message: '', retryable: true } };
    }
    if (controller.signal.aborted) {
      return { ok: false, error: errorFor('timeout', language) };
    }
    return { ok: false, error: errorFor('network', language) };
  } finally {
    clearTimeout(timeout);
    clearTimeout(timeoutMarker);
    signal.removeEventListener('abort', onAbort);
  }
}
