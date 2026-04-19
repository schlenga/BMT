// Security & privacy tests — design tickets:
//   S-01 · secret scanner — no key ever enters git
//   S-02 · PII in logs — proxied: no console.log of phone numbers in v2 modules
//   S-03 · prompt injection — covered in V-02 adversarial set
//   S-04 · authz boundary — proxied: Worker enforces ALLOWED_ORIGIN
//   S-06 · dependency vuln scan — proxied: package.json is dependency-free
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.git')) continue;
    if (ent.name === 'node_modules' || ent.name === 'archive') continue;
    if (ent.name === 'package-lock.json') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const SOURCE_FILES = walk(ROOT);

test('S-01.1 · no Anthropic API key prefix in any tracked source file', () => {
  const re = /sk-ant-[A-Za-z0-9_-]{8,}/;
  const hits = [];
  for (const f of SOURCE_FILES) {
    const txt = fs.readFileSync(f, 'utf8');
    if (re.test(txt)) hits.push(path.relative(ROOT, f));
  }
  assert.deepEqual(hits, [], `secrets found in: ${hits.join(', ')}`);
});

test('S-01.2 · no Stripe live-key prefix', () => {
  const re = /sk_live_[A-Za-z0-9]{16,}/;
  const hits = [];
  for (const f of SOURCE_FILES) {
    const txt = fs.readFileSync(f, 'utf8');
    if (re.test(txt)) hits.push(path.relative(ROOT, f));
  }
  assert.deepEqual(hits, [], `Stripe live keys in: ${hits.join(', ')}`);
});

test('S-01.3 · no .env or credentials.json checked in', () => {
  const banned = ['.env', '.env.local', 'credentials.json', 'service-account.json', 'secrets.json'];
  const hits = SOURCE_FILES.filter(f => banned.includes(path.basename(f)));
  assert.deepEqual(hits, [], `credential files: ${hits.join(', ')}`);
});

test('S-04 · Worker config (wrangler.toml) does not embed plaintext secrets', () => {
  const wrangler = fs.readFileSync(path.join(ROOT, 'worker', 'wrangler.toml'), 'utf8');
  // Secrets must come from `wrangler secret put`, never from a [vars] block
  // that ends up committed.
  assert.ok(!/ANTHROPIC_API_KEY\s*=/.test(wrangler), 'ANTHROPIC_API_KEY assigned in wrangler.toml');
  assert.ok(!/sk-ant-/.test(wrangler), 'API key value present in wrangler.toml');
});

test('S-02 · v2 modules do not console.log phone numbers or auth secrets', () => {
  const re = /console\.(log|info|warn|error)\([^)]*(?:phone|otp|verification[_ -]?code|sk-ant-)/i;
  const hits = [];
  for (const f of SOURCE_FILES) {
    if (!f.endsWith('.js')) continue;
    if (path.relative(ROOT, f).startsWith('tests')) continue;
    const txt = fs.readFileSync(f, 'utf8');
    if (re.test(txt)) hits.push(path.relative(ROOT, f));
  }
  assert.deepEqual(hits, [], `risky console.log calls in: ${hits.join(', ')}`);
});

test('S-06 · v2 ships with zero npm dependencies (smallest possible attack surface)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const deps = Object.keys(pkg.dependencies || {});
  const dev = Object.keys(pkg.devDependencies || {});
  assert.deepEqual(deps, [], `v2 should be dependency-free, found: ${deps.join(', ')}`);
  assert.deepEqual(dev, [], `v2 should ship without devDependencies, found: ${dev.join(', ')}`);
});

test('S-headers · worker.js sets CORS allow-headers explicitly (no wildcard for headers)', () => {
  const w = fs.readFileSync(path.join(ROOT, 'worker', 'worker.js'), 'utf8');
  assert.match(w, /Access-Control-Allow-Headers['"\s]*:\s*['"]Content-Type['"]/);
});
