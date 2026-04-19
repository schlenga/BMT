// ai.js — AI integration layer for BMT.
//
// Design commitments:
//  1. Attitude: the AI talks like a helpful friend, not a consultant. It is
//     allowed and expected to say "I'm not sure" — in fact every structured
//     response carries an explicit confidence score per field.
//  2. Lots of little calls: the front-end flow calls us at many steps
//     (onboarding narration, extrapolation, persona guess, cockpit copy,
//     nudges, situation-room drafts, scenario narration). Each has its own
//     function — no overloaded single "ask" endpoint.
//  3. Graceful offline: every call has a deterministic fallback so the app
//     remains usable without PROXY_URL configured. The fallback is always
//     flagged so the UI can show "offline estimate".
'use strict';

var AI = (function() {

  // Point this at your Cloudflare worker (see /worker). Empty = offline mode.
  var PROXY_URL = '';

  // The system tone every structured call inherits. The "we / I" swap is
  // deliberate — "I" feels like a helper, "we" feels like a team.
  var TONE = [
    "You are BMT — a calm, friendly operator's sidekick for small and medium businesses.",
    "You talk plainly. No consultant jargon. No 'leverage', 'stakeholder', 'ecosystem', 'synergy'.",
    "You say 'I'm not sure' when you're not. You say 'I guessed' when you guessed.",
    "When you make a claim, you explain the 'why' in one short sentence.",
    "Your user probably got into this because they love the craft, not spreadsheets.",
    "Your secret teaching goal is the lean-startup loop — Build, Measure, Learn — but you NEVER use those words. You just shape every suggestion as a tiny question you can answer with a number.",
  ].join(' ');

  function isOnline() { return !!PROXY_URL; }

  // ------------------------------------------------------------
  // Low-level call — everything else is sugar over this.
  // ------------------------------------------------------------
  function call(opts) {
    if (!isOnline()) return Promise.reject(new Error('offline'));
    var body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: opts.maxTokens || 800,
      system: [TONE, opts.system || ''].filter(Boolean).join('\n\n'),
      messages: [{ role: 'user', content: opts.prompt }],
    };
    return fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function(r){
      if (!r.ok) throw new Error('proxy ' + r.status);
      return r.json();
    }).then(function(j){
      var txt = (j.content && j.content[0] && j.content[0].text) || '';
      return txt;
    });
  }

  // Ask for JSON and parse it. Anthropic's models usually oblige when the
  // prompt is structured; we defensively strip code fences.
  function callJSON(opts) {
    var wrap = (opts.system || '') + '\n\nReturn ONLY a valid JSON object. No prose. No code fences.';
    return call({ system: wrap, prompt: opts.prompt, maxTokens: opts.maxTokens })
      .then(function(txt){
        txt = txt.replace(/^```(?:json)?|```$/g, '').trim();
        try { return JSON.parse(txt); }
        catch (e) { throw new Error('bad JSON from model: ' + txt.slice(0, 120)); }
      });
  }

  // ------------------------------------------------------------
  // Public endpoints — one per front-end step that needs the AI.
  // Each returns { data, source: 'ai'|'offline', confidence }.
  // ------------------------------------------------------------

  // 03 · Extrapolate. Given a bench of dropped items, guess the business.
  function extrapolate(bench, onProgress) {
    var narrate = onProgress || function(){};
    var steps = ['Reading what you dropped', 'Figuring out your shop', 'Guessing your customers', 'Picking a cockpit layout'];
    steps.forEach(function(s, i){ setTimeout(function(){ narrate({ step: s, index: i, total: steps.length }); }, i * 500); });

    var benchText = bench.map(function(b){
      return '- ' + b.kind + ': ' + (typeof b.value === 'string' ? b.value : JSON.stringify(b.value));
    }).join('\n') || '(nothing dropped yet)';

    var prompt = [
      "Here is what the operator just dropped on their workbench:",
      benchText,
      "",
      "Extrapolate a first-pass business profile. Fields:",
      " - persona: one of 'lina' (small-scale creator, mobile-first), 'klaus' (multi-crew operator, desktop), 'franka' (solo consultant / small agency), 'nadia' (service shop with tight margins)",
      " - businessType: a short phrase (e.g. '2-chair hair salon')",
      " - location: city / neighborhood or null",
      " - priceTier: 'budget' | 'mid' | 'premium' | null",
      " - customers: a short phrase about who they serve",
      " - staff: rough count or null",
      "",
      "For EACH field include:",
      "  - value: your best guess (or null)",
      "  - confidence: a number 0..1",
      "  - why: one short sentence — which item on the bench made you think this?",
      "",
      "If bench is empty or too thin, it is OK (expected!) to say confidence 0.1 and why 'just a hunch'.",
    ].join('\n');

    return callJSON({ prompt: prompt, maxTokens: 900 })
      .then(function(json){ return { data: json, source: 'ai' }; })
      .catch(function(){ return { data: offlineExtrapolate(bench), source: 'offline' }; });
  }

  // Deterministic offline guess — keyword match on whatever's on the bench.
  // Salon/barber/studio is matched FIRST so "barber" doesn't get caught by
  // the "bar" token in the nadia regex. Word boundaries on short tokens
  // (\bbar\b) keep the matcher honest on adversarial inputs.
  function offlineExtrapolate(bench) {
    var text = bench.map(function(b){ return (typeof b.value === 'string' ? b.value : JSON.stringify(b.value || '')); }).join(' ').toLowerCase();
    var persona = 'lina';
    if (/plumb|electric|\bvans?\b|\bcrew\b|dispatch|boiler/i.test(text)) persona = 'klaus';
    else if (/consult|agency|marketing|\bdesign\b|freelance|proposal/i.test(text)) persona = 'franka';
    else if (/salon|\bhair\b|\bnail\b|beauty|studio|barber/i.test(text)) persona = 'lina';
    else if (/caf[eé]|restaurant|\bfood\b|bakery|\bbar\b|kitchen|bistro|wine/i.test(text)) persona = 'nadia';
    var type = {
      lina: 'small salon or studio',
      klaus: 'trades shop with a small crew',
      franka: 'consulting or creative agency',
      nadia: 'café or neighborhood food shop',
    }[persona];
    function f(v, c, why) { return { value: v, confidence: c, why: why }; }
    return {
      persona: f(persona, 0.35, 'rough keyword match on what you dropped'),
      businessType: f(type, 0.3, 'same keyword signal'),
      location: f(null, 0.05, 'not enough info offline'),
      priceTier: f('mid', 0.15, 'middle is the safest guess without data'),
      customers: f('local regulars', 0.15, 'default for most SMBs'),
      staff: f(null, 0.05, 'not enough info offline'),
    };
  }

  // 04 · Ask the user to confirm what we extrapolated. We might nudge them to
  // correct anything low-confidence — the UI reads this for copy.
  function confirmNudge(field, guess) {
    if (guess.confidence >= 0.7) return 'Looks right?';
    if (guess.confidence >= 0.4) return "I'm fairly sure — but tap to fix if I'm off.";
    return "I'm not sure about this one. What should it be?";
  }

  // 05 · Greeting copy for the cockpit. Persona-tuned.
  function greet(profile) {
    var p = profile.persona || 'lina';
    var hour = new Date().getHours();
    var time = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
    var openers = {
      lina: time + ", Lina ✂️",
      klaus: "Dispatch · " + new Date().toLocaleDateString('en', { weekday: 'short' }),
      franka: "Good " + time.toLowerCase() + ", Franka — 2 things.",
      nadia: "Café · right now · " + new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
    };
    return openers[p] || openers.lina;
  }

  // 08 · COO nudges. Takes the state + recent sim observations, returns an
  // array of {kind, copy, confidence, bml}. BML = the secret lean loop tag.
  function proposeNudges(state, simSummary) {
    var prompt = [
      "Propose 1-3 nudges for this operator. Write each as if you're reminding a friend.",
      "Format EACH nudge as { kind: 'opportunity'|'watch'|'idea', copy: '...', confidence: 0..1, bml: { build, measure, learn } }.",
      "The bml triplet is private (used by the coach layer) — never leak the words 'hypothesis', 'MVP', 'lean'.",
      "",
      "State summary: " + JSON.stringify({
        persona: state.profile.persona,
        businessType: state.profile.businessType,
        sharpness: state.sharpness,
      }),
      "Sim says: " + JSON.stringify(simSummary || {}),
      "",
      "Return { nudges: [...] } only.",
    ].join('\n');
    return callJSON({ prompt: prompt, maxTokens: 700 })
      .then(function(j){ return { data: j.nudges || [], source: 'ai' }; })
      .catch(function(){ return { data: offlineNudges(state), source: 'offline' }; });
  }

  function offlineNudges(state) {
    var persona = state.profile.persona || 'lina';
    var byPersona = {
      lina: [
        { kind: 'opportunity', copy: '3 regulars haven\'t booked in 6+ weeks. Text them?', confidence: 0.55, bml: { build: 'send 3 reminders', measure: 'rebookings in 7 days', learn: 'which wording pulls people back' } },
        { kind: 'idea', copy: 'Tuesday 18:00 posts get 2× saves. Try another one?', confidence: 0.5, bml: { build: 'post Tue 18:00', measure: 'saves vs your weekly average', learn: 'is the slot real or a coincidence' } },
      ],
      klaus: [
        { kind: 'watch', copy: 'Quote to Dellbrück has been out 9 days. Nudge today?', confidence: 0.7, bml: { build: 'call + follow-up email', measure: 'reply within 48h', learn: 'how long is "too quiet" for this client type' } },
        { kind: 'opportunity', copy: 'Van 4 is free tomorrow. Paul is 12 min from a pending job — want me to draft the dispatch?', confidence: 0.6, bml: { build: 'route Paul via Dellbrück', measure: 'jobs/day per van', learn: 'does tighter routing actually save the day' } },
      ],
      franka: [
        { kind: 'idea', copy: 'Your last 3 proposals were scoped 40% under final hours. Add a buffer to Acme?', confidence: 0.75, bml: { build: 'add 40% buffer to next 3 proposals', measure: 'quoted vs actual hours', learn: 'does the buffer stick or get cut in negotiation' } },
      ],
      nadia: [
        { kind: 'watch', copy: 'Order croissants by 3pm — Lena flagged Saturday\'s likely to run dry.', confidence: 0.85, bml: { build: 'order +20% Saturday stock', measure: 'waste vs sell-out by end of day', learn: 'weekly peak-day size' } },
      ],
    };
    return byPersona[persona] || byPersona.lina;
  }

  // 07b · Situation-room drafter. Given a detected shock event, draft a plan.
  function draftShockPlan(shock, state) {
    var prompt = [
      "An unexpected event landed for this operator. Draft a calm, specific plan with 3-4 concrete steps.",
      "Always include a 'do nothing' option at the end — they stay in charge.",
      "Return { title, steps: ['...'], doNothing: '...', confidence: 0..1, why: '...' }.",
      "",
      "Shock: " + JSON.stringify(shock),
      "Operator profile: " + JSON.stringify(state.profile),
    ].join('\n');
    return callJSON({ prompt: prompt, maxTokens: 500 })
      .then(function(j){ return { data: j, source: 'ai' }; })
      .catch(function(){
        return { data: {
          title: shock.title + ' — draft plan',
          steps: ['Gather the 3-4 facts that actually matter', 'Talk to one person who knows (a peer, your accountant)', 'Run a tiny pilot before committing', 'Decide by end of week'],
          doNothing: 'Sleep on it for a week. Most surprises shrink.',
          confidence: 0.35,
          why: 'generic plan — I\'m offline'
        }, source: 'offline' };
      });
  }

  // 09 · Scenario narration — plain words describing a simulated outcome.
  function narrateScenario(goal, simOut) {
    var prompt = [
      "Narrate the result of this simulation in 2-3 short sentences, plainly.",
      "Flag uncertainty explicitly with phrases like 'I think', 'roughly', 'somewhere around'.",
      "Goal: " + goal,
      "Simulation: " + JSON.stringify(simOut),
    ].join('\n');
    return call({ prompt: prompt, maxTokens: 220 })
      .then(function(t){ return { data: t.trim(), source: 'ai' }; })
      .catch(function(){
        return { data: offlineScenarioCopy(goal, simOut), source: 'offline' };
      });
  }

  function offlineScenarioCopy(goal, out) {
    var cash = out && out.cash12mo;
    var be = out && out.breakeven;
    var parts = [];
    if (cash != null) parts.push('Cash in 12 months: roughly €' + cash.toLocaleString() + '.');
    if (be != null) parts.push('Break-even around month ' + be + '.');
    parts.push('This is an estimate — tune the sliders and watch it move.');
    return parts.join(' ');
  }

  // Small helper the UI uses to render the confidence chip.
  function confidenceLabel(c) {
    if (c >= 0.75) return 'pretty sure';
    if (c >= 0.5) return 'a guess';
    if (c >= 0.25) return 'hunch';
    return 'shot in the dark';
  }

  return {
    isOnline: isOnline,
    setProxy: function(u) { PROXY_URL = u || ''; },
    extrapolate: extrapolate,
    confirmNudge: confirmNudge,
    greet: greet,
    proposeNudges: proposeNudges,
    draftShockPlan: draftShockPlan,
    narrateScenario: narrateScenario,
    confidenceLabel: confidenceLabel,
  };
})();

if (typeof module !== 'undefined') module.exports = AI;
