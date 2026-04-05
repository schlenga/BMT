// Cloudflare Worker proxy for BMT — hides the Anthropic API key server-side
// Deploy: wrangler deploy
// Secrets: wrangler secret put ANTHROPIC_API_KEY
//          wrangler secret put ALLOWED_ORIGIN  (e.g. https://schlenga.github.io)

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    // Validate content type
    const ct = request.headers.get('Content-Type') || '';
    if (!ct.includes('application/json')) {
      return new Response('Content-Type must be application/json', { status: 400, headers: cors });
    }

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: request.body
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
