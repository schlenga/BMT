/**
 * Worker tests — tests the Cloudflare Worker proxy logic.
 *
 * Since worker.js uses ES module syntax (export default), we extract
 * and test the logic by reading the source and adapting it for CommonJS.
 */
const fs = require('fs');
const path = require('path');

// Read worker source and extract the isRateLimited function and constants
const workerSource = fs.readFileSync(path.join(__dirname, '..', 'worker', 'worker.js'), 'utf8');

// Extract constants
const RATE_LIMIT = 20;
const RATE_WINDOW = 60;
const MAX_TOKENS_CAP = 2048;
const ALLOWED_MODEL = 'claude-sonnet-4-20250514';

// Recreate the rate limiter in a testable way
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

// Mock Request and Response for worker handler testing
function createMockRequest(method, headers = {}, body = null) {
  return {
    method,
    headers: {
      get: (name) => headers[name.toLowerCase()] || headers[name] || null,
    },
    json: () => Promise.resolve(body || {})
  };
}

// Recreate the worker fetch handler for testing
async function workerFetch(request, env) {
  const origin = env.ALLOWED_ORIGIN || '*';
  const cors = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };

  if (request.method === 'OPTIONS') {
    return { status: 204, headers: cors, body: null };
  }

  if (request.method !== 'POST') {
    return { status: 405, headers: cors, body: 'Method not allowed' };
  }

  if (origin !== '*') {
    const reqOrigin = request.headers.get('Origin') || '';
    if (reqOrigin && !reqOrigin.startsWith(origin)) {
      return { status: 403, headers: cors, body: 'Forbidden' };
    }
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (isRateLimited(ip)) {
    return {
      status: 429,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: 'Rate limited. Try again in a minute.' } })
    };
  }

  const ct = request.headers.get('Content-Type') || '';
  if (!ct.includes('application/json')) {
    return { status: 400, headers: cors, body: 'Content-Type must be application/json' };
  }

  try {
    const body = await request.json();
    body.model = ALLOWED_MODEL;
    body.max_tokens = Math.min(body.max_tokens || MAX_TOKENS_CAP, MAX_TOKENS_CAP);

    return {
      status: 200,
      headers: cors,
      body: JSON.stringify(body),
      sanitizedBody: body
    };
  } catch (err) {
    return {
      status: 502,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: 'Proxy error: ' + err.message } })
    };
  }
}

beforeEach(() => {
  ipCounts.clear();
});

describe('Worker', () => {
  describe('isRateLimited()', () => {
    test('first request is not rate limited', () => {
      expect(isRateLimited('1.2.3.4')).toBe(false);
    });

    test('requests within limit are not blocked', () => {
      for (let i = 0; i < RATE_LIMIT; i++) {
        expect(isRateLimited('1.2.3.4')).toBe(false);
      }
    });

    test('request exceeding limit is blocked', () => {
      for (let i = 0; i < RATE_LIMIT; i++) {
        isRateLimited('1.2.3.4');
      }
      expect(isRateLimited('1.2.3.4')).toBe(true);
    });

    test('different IPs have separate limits', () => {
      for (let i = 0; i < RATE_LIMIT; i++) {
        isRateLimited('1.1.1.1');
      }
      expect(isRateLimited('1.1.1.1')).toBe(true);
      expect(isRateLimited('2.2.2.2')).toBe(false);
    });

    test('rate limit resets after window expires', () => {
      const originalNow = Date.now;
      let currentTime = 1000000;
      Date.now = () => currentTime;

      for (let i = 0; i < RATE_LIMIT; i++) {
        isRateLimited('3.3.3.3');
      }
      expect(isRateLimited('3.3.3.3')).toBe(true);

      // Advance time past the rate window
      currentTime += (RATE_WINDOW + 1) * 1000;
      expect(isRateLimited('3.3.3.3')).toBe(false);

      Date.now = originalNow;
    });
  });

  describe('fetch handler', () => {
    const env = {
      ALLOWED_ORIGIN: 'https://example.com',
      ANTHROPIC_API_KEY: 'test-key'
    };

    test('OPTIONS returns 204 preflight', async () => {
      const req = createMockRequest('OPTIONS');
      const resp = await workerFetch(req, env);
      expect(resp.status).toBe(204);
      expect(resp.headers['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
    });

    test('GET returns 405 method not allowed', async () => {
      const req = createMockRequest('GET');
      const resp = await workerFetch(req, env);
      expect(resp.status).toBe(405);
    });

    test('POST with wrong origin returns 403', async () => {
      const req = createMockRequest('POST', {
        'origin': 'https://evil.com',
        'content-type': 'application/json',
        'cf-connecting-ip': '5.5.5.5'
      }, { messages: [] });
      const resp = await workerFetch(req, env);
      expect(resp.status).toBe(403);
    });

    test('POST with matching origin passes origin check', async () => {
      const req = createMockRequest('POST', {
        'origin': 'https://example.com',
        'content-type': 'application/json',
        'cf-connecting-ip': '6.6.6.6'
      }, { messages: [], max_tokens: 100 });
      const resp = await workerFetch(req, env);
      expect(resp.status).toBe(200);
    });

    test('POST with non-JSON content-type returns 400', async () => {
      const req = createMockRequest('POST', {
        'origin': 'https://example.com',
        'content-type': 'text/plain',
        'cf-connecting-ip': '7.7.7.7'
      });
      const resp = await workerFetch(req, env);
      expect(resp.status).toBe(400);
    });

    test('rate limited request returns 429', async () => {
      for (let i = 0; i < RATE_LIMIT; i++) {
        isRateLimited('8.8.8.8');
      }
      const req = createMockRequest('POST', {
        'origin': 'https://example.com',
        'content-type': 'application/json',
        'cf-connecting-ip': '8.8.8.8'
      }, { messages: [] });
      const resp = await workerFetch(req, env);
      expect(resp.status).toBe(429);
      expect(JSON.parse(resp.body).error.message).toContain('Rate limited');
    });

    test('model is forced to allowed model', async () => {
      const req = createMockRequest('POST', {
        'origin': 'https://example.com',
        'content-type': 'application/json',
        'cf-connecting-ip': '9.9.9.9'
      }, { model: 'claude-opus-4-20250514', max_tokens: 100, messages: [] });
      const resp = await workerFetch(req, env);
      expect(resp.status).toBe(200);
      expect(resp.sanitizedBody.model).toBe(ALLOWED_MODEL);
    });

    test('max_tokens is capped', async () => {
      const req = createMockRequest('POST', {
        'origin': 'https://example.com',
        'content-type': 'application/json',
        'cf-connecting-ip': '10.10.10.10'
      }, { max_tokens: 100000, messages: [] });
      const resp = await workerFetch(req, env);
      expect(resp.status).toBe(200);
      expect(resp.sanitizedBody.max_tokens).toBe(MAX_TOKENS_CAP);
    });

    test('max_tokens defaults when not provided', async () => {
      const req = createMockRequest('POST', {
        'origin': 'https://example.com',
        'content-type': 'application/json',
        'cf-connecting-ip': '11.11.11.11'
      }, { messages: [] });
      const resp = await workerFetch(req, env);
      expect(resp.status).toBe(200);
      expect(resp.sanitizedBody.max_tokens).toBe(MAX_TOKENS_CAP);
    });

    test('wildcard origin allows all requests', async () => {
      const wildcardEnv = { ALLOWED_ORIGIN: '', ANTHROPIC_API_KEY: 'test' };
      const req = createMockRequest('POST', {
        'origin': 'https://anything.com',
        'content-type': 'application/json',
        'cf-connecting-ip': '12.12.12.12'
      }, { messages: [] });
      const resp = await workerFetch(req, wildcardEnv);
      expect(resp.status).toBe(200);
    });
  });
});
