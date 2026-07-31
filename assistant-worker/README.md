# Assistant Worker

Cloudflare Worker backing the WA School Funding Explorer's site guide. It is
the only place the OpenAI API key exists — the static site calls this, and
this calls OpenAI.

Full setup, deployment, and troubleshooting:
[`../docs/ASSISTANT_DEPLOYMENT.md`](../docs/ASSISTANT_DEPLOYMENT.md).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness, model name, and whether a key and origins are configured. Never exposes the key. |
| `POST` | `/chat` | One question in, one schema-validated answer out. |

## Quick start

```bash
npm install
cp .dev.vars.example .dev.vars   # add a real key
npm run dev                      # http://localhost:8787
```

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Local Wrangler server |
| `npm test` | Unit tests (request bounding, origin checks, schema) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | `wrangler deploy --dry-run` |
| `npm run deploy` | Deploy |
| `npm run tail` | Live logs |

## Configuration

`vars` in `wrangler.jsonc`: `OPENAI_MODEL` (`gpt-5-nano`),
`OPENAI_MAX_OUTPUT_TOKENS`, `OPENAI_REASONING_EFFORT`, `ALLOWED_ORIGINS`,
`DAILY_MESSAGE_CAP`.

The key is a secret, never a var:

```bash
npx wrangler secret put OPENAI_API_KEY
```

## Layout

```
src/
  index.ts         routing, CORS gate, size caps, error mapping
  openai.ts        the Responses API call
  systemPrompt.ts  standing instructions (frozen constant, cacheable prefix)
  schema.ts        strict Structured Outputs schema
  validation.ts    rebuilds every request field inside hard limits
  cors.ts          exact-origin allow-listing
  rateLimit.ts     burst + sustained bindings, optional KV daily cap
```

`schema.ts` intentionally duplicates the response types from the site's
`src/lib/assistant/types.ts`: this is a separate deployment and cannot import
from the Next app. Change one, change the other.
