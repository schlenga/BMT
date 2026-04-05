// Cloudflare Worker proxy for BMT — hides the Anthropic API key server-side
//
// Deploy:   cd worker && npx wrangler deploy
// Secrets:  npx wrangler secret put ANTHROPIC_API_KEY
//           npx wrangler secret put ALLOWED_ORIGIN  (e.g. https://schlenga.github.io)
//
// Cost protection:
//   - ALLOWED_ORIGIN blocks requests from other sites
//   - Rate limit: max 20 requests per minute per IP
//   - Only POST to /v1/messages is forwarded (no other endpoints)
//   - model is forced to claude-sonnet-4-20250514 (cheapest capable model)
//   - max_tokens capped at 2048 per request

const RATE_LIMIT = 20;        // requests per minute per IP
const RATE_WINDOW = 60;       // seconds
const MAX_TOKENS_CAP = 2048;  // hard cap on max_tokens
const ALLOWED_MODEL = 'claude-sonnet-4-20250514';

// In-memory rate limit store (resets when worker restarts, which is fine)
const ipCounts = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const entry = ipCounts.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW * 1000) {
    ipCounts.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT) return true;
  return false;
}

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    };

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    // Origin check (if configured)
    if (origin !== '*') {
      const reqOrigin = request.headers.get('Origin') || '';
      if (reqOrigin && !reqOrigin.startsWith(origin)) {
        return new Response('Forbidden', { status: 403, headers: cors });
      }
    }

    // Rate limit by IP
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ error: { message: 'Rate limited. Try again in a minute.' } }), {
        status: 429,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // Validate content type
    const ct = request.headers.get('Content-Type') || '';
    if (!ct.includes('application/json')) {
      return new Response('Content-Type must be application/json', { status: 400, headers: cors });
    }

    try {
      // Parse and sanitize the request body
      const body = await request.json();

      // Force model and cap tokens for cost control
      body.model = ALLOWED_MODEL;
      body.max_tokens = Math.min(body.max_tokens || MAX_TOKENS_CAP, MAX_TOKENS_CAP);

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body)
      });

      const response = new Response(resp.body, {
        status: resp.status,
        headers: { ...Object.fromEntries(resp.headers), ...cors }
      });
      return response;
    } catch (err) {
      return new Response(JSON.stringify({ error: { message: 'Proxy error: ' + err.message } }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
  }
};
