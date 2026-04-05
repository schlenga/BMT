# BMT — Business Model Tracker

An interactive business model designer and tracker for small and medium businesses, built on Lean Startup methodology. Walk through a conversational onboarding, build a Business Model Canvas, and track testable hypotheses with real data.

## How It Works

### 1. Conversational Onboarding

The app walks you through 7 easy steps in a chat-like interface. As you answer, a live preview of your business model builds on the right side of the screen.

| Step | What it asks | What it builds |
|------|-------------|----------------|
| Website | "Got a website?" (optional) | Scans your site and pre-fills your business info |
| Pride | "What are you most proud of?" | Value Proposition |
| Customers | "Who are your best customers?" | Customer Segments |
| Economics | Revenue range, team size, main costs | Cost Structure + Revenue Streams |
| Goal | "Biggest goal for the next 6 months?" | Priorities for hypothesis generation |
| Concerns | "What keeps you up at night?" | Risk-focused hypotheses |
| Hypotheses | AI generates testable hypotheses | Your tracking dashboard |

### 2. Business Model Canvas

Visual 9-element canvas based on the Business Model Canvas framework. Click any item to edit. Add new items with "+". Color-coded by hypothesis status (blue = testing, green = validated, red = at risk).

### 3. Hypothesis Tracker

Each hypothesis has a target metric. Log actual data points over time. See progress bars, sparklines, and status badges. Mark hypotheses as validated, invalidated, or pivoted — the core Build-Measure-Learn loop.

## Run Locally

Just open in a browser — no build step, no server, no install:

```bash
open index.html           # macOS
xdg-open index.html       # Linux
start index.html          # Windows
```

Or use a local server (needed if you enable the AI proxy):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy on GitHub Pages

1. Push the repository to GitHub.
2. Go to **Settings → Pages**.
3. Under **Source**, select **Deploy from a branch**.
4. Set branch to `main` (or your branch) and folder to `/ (root)`.
5. Click **Save**.
6. Live at `https://<username>.github.io/BMT/` in a few minutes.

---

## AI Features (Optional)

The app works fully without AI — it uses keyword-based inference to suggest customer segments, costs, channels, and generates template hypotheses. But with AI enabled, you get:

- **Website analysis** — paste your URL and Claude reads your site to pre-fill your business model
- **Personalized hypotheses** — Claude generates specific, measurable hypotheses tailored to your business, your goals, and your concerns
- **Smarter suggestions** — contextual recommendations based on your actual answers

### How it works architecturally

Your API key never touches the browser. Instead, a tiny Cloudflare Worker sits between the app and the Anthropic API:

```
Browser (GitHub Pages)  →  Cloudflare Worker (proxy)  →  Anthropic API
                                ↑
                          Your API key lives here
                          (as a Cloudflare secret)
```

### Cost Protection Built In

The proxy has multiple safeguards so you don't burn through tokens:

| Protection | How it works |
|-----------|--------------|
| **Model locked** | The proxy forces `claude-sonnet-4-20250514` regardless of what the client requests. This is the most cost-effective capable model (~$3/M input, $15/M output tokens). |
| **Token cap** | Every request is capped at 2,048 output tokens. No request can ask for more. |
| **Rate limit** | 20 requests per minute per IP address. After that, requests get a 429 error. |
| **Origin lock** | Only your GitHub Pages domain can call the proxy. Other sites get a 403. |
| **Method lock** | Only POST requests are forwarded. GET, PUT, DELETE are blocked. |

### Expected cost per user onboarding

A typical onboarding makes 2-3 API calls:

| Call | Input tokens (approx) | Output tokens (approx) | Cost |
|------|----------------------|------------------------|------|
| Website analysis | ~4,000 | ~300 | ~$0.02 |
| Hypothesis generation | ~1,000 | ~1,500 | ~$0.03 |
| **Total per onboarding** | | | **~$0.05** |

That's about **5 cents per new user**. 20 users = ~$1. You can set a [spending limit on your Anthropic account](https://console.anthropic.com/settings/limits) as an additional safety net.

### Setup Guide (Step by Step)

**Prerequisites:** Node.js installed (for the `npx` command). If you don't have it: [nodejs.org](https://nodejs.org/).

**Step 1: Deploy the proxy**

```bash
cd worker
npx wrangler login          # Opens browser, log in with Cloudflare (free account)
npx wrangler deploy          # Deploys the worker
```

This prints a URL like `https://bmt-proxy.<your-subdomain>.workers.dev`. Copy it.

**Step 2: Set your API key as a secret**

```bash
npx wrangler secret put ANTHROPIC_API_KEY
# Paste your key when prompted (it won't be visible)
# Get a key at: https://console.anthropic.com/settings/keys
```

**Step 3: Lock the proxy to your site**

```bash
npx wrangler secret put ALLOWED_ORIGIN
# Type: https://schlenga.github.io
# (or http://localhost:8000 for local testing)
```

**Step 4: Connect the app to the proxy**

Open `ai.js` and set the proxy URL on line 8:

```js
var PROXY_URL = 'https://bmt-proxy.<your-subdomain>.workers.dev/v1/messages';
```

Commit and push. That's it — AI features are live.

**Step 5 (recommended): Set a spending limit**

Go to [console.anthropic.com/settings/limits](https://console.anthropic.com/settings/limits) and set a monthly spend limit (e.g., $5 or $10). This is your ultimate safety net regardless of anything else.

### Testing the AI

1. Open the app and start the onboarding wizard.
2. On the first step, paste a website URL and click "Analyze". You should see a typing indicator, then extracted business info.
3. Complete all steps. On the last step, hypotheses should have a "rationale" line under each one — that means they came from Claude, not the keyword fallback.
4. Check your [Anthropic dashboard](https://console.anthropic.com/) to verify token usage.

### Disabling AI

To turn off AI at any time, just set `PROXY_URL` back to empty in `ai.js`:

```js
var PROXY_URL = '';  // AI disabled, keyword fallback only
```

Or delete/pause the Cloudflare Worker:

```bash
cd worker
npx wrangler delete
```

### Changing the model

The model is locked in `worker/worker.js` on the `ALLOWED_MODEL` line. If you want to use a different model (e.g., `claude-haiku-4-5-20251001` for even cheaper calls at ~$0.01 per onboarding), change it there and redeploy:

```bash
cd worker
npx wrangler deploy
```

---

## File Structure

```
index.html             # App shell + all CSS (warm & friendly design)
app.js                 # Router, navigation, settings page
ai.js                  # AI integration layer (Claude API, website scraping, fallback)
wizard.js              # Conversational onboarding (7 steps, split-screen)
canvas.js              # Business Model Canvas view (9-element grid)
tracker.js             # Hypothesis tracking dashboard
store.js               # localStorage persistence layer

worker/                # Cloudflare Worker proxy (deploy separately)
  worker.js            # Proxy code with rate limiting + cost protection
  wrangler.toml        # Cloudflare deployment config

archive/               # Original OxO consulting simulator (archived)
```

## Tech Stack

- Vanilla HTML, CSS, JavaScript — no frameworks, no build tools, no bundler
- localStorage for all persistence (business model, hypotheses, onboarding progress)
- Cloudflare Workers for API proxy (free tier: 100,000 requests/day)
- Claude API (Sonnet) for AI features
- Responsive design — works on desktop and mobile
- Static site — deployable on GitHub Pages, Netlify, or any web server
