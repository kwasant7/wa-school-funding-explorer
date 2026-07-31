# Deploying the site guide

The WA School Funding Explorer's assistant is two pieces:

| Piece | Where it runs | What it holds |
|---|---|---|
| **Frontend** | The existing static site on GitHub Pages | The UI, page context, local retrieval, action execution. **No credentials.** |
| **Worker** | Cloudflare Workers (`assistant-worker/`) | The OpenAI call. **Holds the API key.** |

The browser never contacts OpenAI. It calls the Worker, and only the Worker
has the key. That split is why the assistant can exist on a static site at all.

The site builds and deploys fine without any of this configured — the
assistant just reports itself unavailable. Nothing below is required to keep
the rest of the site running.

---

## 1. Install frontend dependencies

```bash
npm install
```

## 2. Run the site locally

```bash
npm run dev
```

Serves <http://localhost:3000>. The assistant launcher appears but reports
"The site guide has not been set up yet" until step 15.

## 3. Run the Worker locally

```bash
cd assistant-worker
npm install
cp .dev.vars.example .dev.vars   # then put a real key in .dev.vars
npm run dev
```

`.dev.vars` is gitignored. Never commit it.

Wrangler serves <http://localhost:8787>. To point the local site at it, create
`.env.local` in the repository root (also gitignored):

```bash
echo "NEXT_PUBLIC_ASSISTANT_API_URL=http://localhost:8787" > .env.local
```

Restart `npm run dev` — Next only reads env files at startup.

## 4. Create an OpenAI project

<https://platform.openai.com/> → **Dashboard** → project switcher → **Create
project**. A dedicated project keeps this site's usage, limits and key
separate from anything else on the account.

## 5. Create a project-scoped API key

**API keys** → **Create new secret key**, scoped to the project from step 4.
Copy it once — it is not shown again.

## 6. Add billing

**Settings → Billing** → add a payment method and a starting credit. Requests
fail with a quota error until the project can be billed.

## 7. Set usage limits

**Settings → Limits** → set a monthly budget and a notification threshold.
This is the backstop that caps spend if something goes wrong; the Worker's
rate limits are the first line, not the only one.

## 8. Store the key in Cloudflare

```bash
cd assistant-worker
npx wrangler login          # first time only
npx wrangler secret put OPENAI_API_KEY
```

Paste the key at the prompt. It is write-only from then on: it never appears
in `wrangler.jsonc`, in `git`, in the client bundle, or in any log.

## 9. Confirm the model

`wrangler.jsonc` already sets:

```jsonc
"OPENAI_MODEL": "gpt-5-nano"
```

`gpt-5-nano` is the intended model. The assistant explains supplied text,
summarises retrieved passages, and picks from an allow-list of actions — none
of which needs a larger model. To upgrade later, change this value and
redeploy; no code change is required.

Two related knobs, also in `vars`:

- `OPENAI_MAX_OUTPUT_TOKENS` (default `1400`) — hard ceiling per answer.
- `OPENAI_REASONING_EFFORT` (default `minimal`) — the lowest tier that still
  produces reliable structured output.

## 10. Configure allowed origins

In `wrangler.jsonc`:

```jsonc
"ALLOWED_ORIGINS": "http://localhost:3000,http://127.0.0.1:3000,https://kwasant7.github.io"
```

An `Origin` header is scheme + host + port, **never a path**. The production
value is therefore `https://kwasant7.github.io`, not
`https://kwasant7.github.io/wa-school-funding-explorer`. Adding the path would
match nothing and lock out the real site.

A consequence worth knowing: any page on `kwasant7.github.io` can call this
Worker. Origin checking is one layer; the rate limits and request caps are the
others.

## 11. Configure rate limiting

Two limiters ship enabled and need no setup:

| Binding | Window | Default |
|---|---|---|
| `BURST_LIMIT` | 10s | 5 requests |
| `SUSTAINED_LIMIT` | 60s | 15 requests |

Both are keyed on the anonymous per-session visitor ID, with a hashed-IP key
as a backstop against someone rotating that ID. No name, email, location, or
raw IP is ever used as a key or stored.

The optional daily cap needs a KV namespace, because Cloudflare's rate-limit
binding only supports 10- and 60-second windows:

```bash
cd assistant-worker
npx wrangler kv namespace create ASSISTANT_DAILY
```

Uncomment the `kv_namespaces` block at the bottom of `wrangler.jsonc`, paste
the printed id, and set `DAILY_MESSAGE_CAP`. Without the namespace the daily
cap is skipped and the two window limiters still apply.

## 12. Deploy the Worker

```bash
cd assistant-worker
npm run deploy
```

Wrangler prints the URL, e.g.
`https://wa-funding-assistant.<your-subdomain>.workers.dev`.

## 13. Test `GET /health`

```bash
curl https://wa-funding-assistant.<your-subdomain>.workers.dev/health
```

```json
{
  "status": "ok",
  "model": "gpt-5-nano",
  "configured": true,
  "allowedOrigins": 3,
  "rateLimit": { "burst": true, "sustained": true, "daily": false }
}
```

`configured: false` means the secret from step 8 did not land. The endpoint
reports only *whether* a key exists, never any part of its value.

## 14. Test `POST /chat`

The `Origin` header must be one of the allowed origins, or the request is
rejected before any work happens:

```bash
curl -X POST https://wa-funding-assistant.<your-subdomain>.workers.dev/chat \
  -H 'content-type: application/json' \
  -H 'Origin: https://kwasant7.github.io' \
  -d '{
    "message": "What is the levy cap?",
    "language": "en",
    "visitorId": "manual-test",
    "context": { "pathname": "/simulator" },
    "knowledge": [],
    "availableSources": [
      { "id": "rcw-84-52-0531", "label": "RCW 84.52.0531", "type": "official" }
    ],
    "history": []
  }'
```

A success looks like `{"result":{"reply":"…","actions":[],"sources":["rcw-84-52-0531"],…}}`.

Confirm the origin check works by sending a disallowed one:

```bash
curl -i -X POST https://wa-funding-assistant.<your-subdomain>.workers.dev/chat \
  -H 'content-type: application/json' -H 'Origin: https://evil.example' -d '{}'
# HTTP/2 403  {"error":"Origin not allowed."}
```

## 15. Point the site at the Worker

GitHub → repository **Settings** → **Secrets and variables** → **Actions** →
**Variables** → **New repository variable**:

| Name | Value |
|---|---|
| `ASSISTANT_API_URL` | `https://wa-funding-assistant.<your-subdomain>.workers.dev` |

A **variable**, not a secret. This URL is a public endpoint and is compiled
into the client bundle; storing it as a secret would only make it harder to
read while changing nothing about its exposure. No API key goes here.

The workflow already passes it through as `NEXT_PUBLIC_ASSISTANT_API_URL`.

## 16. Redeploy the site

Push to `main`, or **Actions → Deploy to GitHub Pages → Run workflow**.

## 17. Test in production

Open <https://kwasant7.github.io/wa-school-funding-explorer/>, click **Site
guide**, and check:

- A starter question returns an answer with a **Sources** list.
- On District Explorer with a district selected, the answer uses that
  district's real figures.
- "Take me to the simulator" navigates.
- Switching the site language changes the assistant's labels, and the next
  answer arrives in that language.

## 18. Review usage and cost

<https://platform.openai.com/usage>, filtered to the project from step 4.

Rough per-question shape at the shipped settings:

| | Tokens |
|---|---|
| System prompt (cacheable, identical every call) | ~1,100 |
| Page context + retrieved passages + history | ~1,200–2,500 |
| Output (capped at `OPENAI_MAX_OUTPUT_TOKENS`) | ~250–700 typical, 1,400 ceiling |

So roughly **2.5k–4k input and under 1.4k output per question**. The system
prompt is a frozen constant sent first on every call and `prompt_cache_key` is
set per session, so within a conversation that prefix is eligible for
OpenAI's automatic prompt caching.

Worst case per visitor per minute is bounded by `SUSTAINED_LIMIT` (15
questions), and per day by `DAILY_MESSAGE_CAP` if you enabled step 11's KV
namespace.

## 19. Rotate the key

1. Create a new key in the same project (step 5).
2. `npx wrangler secret put OPENAI_API_KEY` — takes effect immediately, no
   redeploy needed.
3. Delete the old key in the OpenAI dashboard.
4. `curl .../health` to confirm `configured: true`.

## 20. Revoke the key

Delete it in the OpenAI dashboard. The Worker starts returning 503 and the
site shows "The site guide is temporarily unavailable." Nothing else breaks.

## 21. Turn the assistant off

Pick whichever fits:

- **Hide it from the site** — delete the `ASSISTANT_API_URL` repository
  variable and redeploy. The launcher still renders but reports itself
  unconfigured. To remove it entirely, drop `<FundingAssistant />` from
  `src/app/layout.tsx`.
- **Stop it serving** — `npx wrangler delete` in `assistant-worker/`, or clear
  `ALLOWED_ORIGINS` so every request is refused.
- **Stop it spending** — revoke the key (step 20), or set the OpenAI project
  budget to zero.

## 22. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "The site guide has not been set up yet" | `NEXT_PUBLIC_ASSISTANT_API_URL` was unset **at build time** | Set the repo variable, redeploy. It is compiled in, so an existing build will not pick it up. |
| CORS error in the browser console | Origin not in `ALLOWED_ORIGINS` | Add the exact scheme+host, no path. Redeploy the Worker. |
| 403 `Origin not allowed.` | Same as above, or a direct call with no `Origin` | Send an allowed `Origin` header. |
| 429 | Rate limited | Expected under rapid questioning. Raise the limits in `wrangler.jsonc` if genuinely too tight. |
| 503 `Assistant is not configured.` | Secret missing | `wrangler secret put OPENAI_API_KEY`. |
| 502 with a `supportCode` | Upstream OpenAI failure | The code is the OpenAI request id — look it up in the OpenAI dashboard logs. Usually billing or a quota limit. |
| 504 | Model took over 25s | Usually transient. If persistent, lower `OPENAI_MAX_OUTPUT_TOKENS`. |
| 422 "could not produce a reliable answer" | Output was truncated or failed schema validation | Raise `OPENAI_MAX_OUTPUT_TOKENS`. |
| Answers are in the wrong language | The site's `<html lang>` is not what you expect | The assistant follows `document.documentElement.lang`, which `LanguageSwitcher` sets. |
| An action does nothing | It failed validation, or the target page is not mounted | By design — invalid actions are dropped rather than guessed at. Check the browser console. |
| `wrangler dev` cannot find the key | No `.dev.vars` | `cp .dev.vars.example .dev.vars` and add the key. |

To watch live Worker logs:

```bash
cd assistant-worker && npm run tail
```

Logs carry outcome codes, sizes, and OpenAI request ids. They deliberately do
**not** carry visitor questions or model answers.

---

## Checks

```bash
npm run typecheck          # frontend types
npm test                   # frontend unit tests
npm run build              # static export
npm run worker:test        # Worker unit tests
cd assistant-worker && npm run typecheck && npm run build
```

## Security notes

- The API key exists only as a Cloudflare secret. It is not in the repo, the
  client bundle, source maps, or CI logs.
- The browser never calls OpenAI directly.
- The model is given an allow-list of source **IDs** and never produces a URL;
  IDs are resolved to trusted URLs locally. A fabricated citation cannot render
  as a link.
- Actions are validated twice — once against the JSON schema at the provider,
  then again in the browser against the real district codes, school years, and
  slider bounds. Anything that fails is dropped, never repaired.
- State-changing actions run only when the visitor's own words read as a
  command; otherwise they are offered as a button.
- Replies render through a Markdown renderer that builds React elements and
  never touches `innerHTML`. Links resolve only to URLs the site already
  publishes.
- No web search, file search, code interpreter, computer use, image
  generation, or remote MCP tools are enabled.
- `store: false` on every call, so the provider retains nothing.
- Conversations live in `sessionStorage` and are gone when the tab closes. No
  cookies, analytics, or tracking identifiers.
