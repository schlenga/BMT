// ai.js — AI integration layer (Claude API, website analysis, keyword fallback)
'use strict';

var AI = (function() {

  // ── Configuration ──
  // Set this to your Cloudflare Worker proxy URL
  var PROXY_URL = 'https://bmt-proxy.schlenga-bmt.workers.dev/v1/messages';

  // ── Keyword-based business type detection (fallback) ──
  var TYPE_KEYWORDS = {
    restaurant: ['restaurant','cafe','coffee','bakery','bar','food','cook','kitchen','catering','pizza','sushi','burger','diner','bistro','pub','brewery','juice','tea','ice cream','dessert','meal','chef','dining'],
    retail: ['shop','store','retail','sell','boutique','fashion','clothing','apparel','jewelry','gift','flower','book','furniture','toy','hardware','pet','beauty','cosmetic','shoes'],
    service: ['consult','coach','agency','freelance','design','develop','clean','repair','plumb','electric','account','legal','lawyer','tutor','teach','train','therapy','counsel','photograph','write','market','advise','architect','engineer'],
    saas: ['app','software','platform','saas','tool','automate','dashboard','analytics','api','cloud','mobile app','web app','subscription software'],
    ecommerce: ['online','e-commerce','ecommerce','dropship','marketplace','amazon','etsy','shopify','digital product','print on demand','wholesale online'],
    subscription: ['subscription','membership','box','monthly','recurring','club','community','patron','newsletter']
  };

  var TYPE_LABELS = {
    restaurant: 'food & drink',
    retail: 'retail / shop',
    service: 'service',
    saas: 'software / SaaS',
    ecommerce: 'e-commerce',
    subscription: 'subscription'
  };

  function detectType(description) {
    var desc = description.toLowerCase();
    var scores = {};
    for (var type in TYPE_KEYWORDS) {
      scores[type] = 0;
      TYPE_KEYWORDS[type].forEach(function(kw) {
        if (desc.indexOf(kw) >= 0) scores[type] += kw.length;
      });
    }
    var best = 'service', bestScore = 0;
    for (var t in scores) {
      if (scores[t] > bestScore) { bestScore = scores[t]; best = t; }
    }
    return bestScore > 0 ? best : 'service';
  }

  // ── Suggestion pools ──
  var SEGMENTS = {
    _common: ['Local residents','Young professionals (25-35)','Families','Students','Small businesses','Remote workers'],
    restaurant: ['Office workers nearby','Food enthusiasts','Tourists','Health-conscious eaters','Late-night crowd'],
    retail: ['Gift shoppers','Brand-conscious buyers','Budget shoppers','Collectors','Interior decorators'],
    service: ['Startups','Small business owners','Busy professionals','Growing companies','First-time buyers'],
    saas: ['Solo entrepreneurs','Small teams (2-10)','Marketing managers','Developers','Operations teams'],
    ecommerce: ['Online bargain hunters','Niche hobbyists','Gift buyers','Convenience shoppers'],
    subscription: ['Enthusiasts & hobbyists','Self-improvement seekers','Busy parents','Professionals wanting curation']
  };

  var CHANNELS = {
    _common: ['Word of mouth','Social media (Instagram/TikTok)','Google search / SEO','Local advertising'],
    restaurant: ['Walk-in foot traffic','Food delivery apps','Google Maps / Yelp','Local events'],
    retail: ['Storefront / walk-in','Instagram shopping','Pop-up events','Referral program'],
    service: ['LinkedIn / professional network','Referrals','Content marketing / blog','Cold outreach','Partnerships'],
    saas: ['Product Hunt / directories','Content marketing','Free trial / freemium','Paid ads (Google/FB)','Partnerships / integrations'],
    ecommerce: ['Marketplace listings','Paid social ads','SEO / content','Influencer collaborations','Email marketing'],
    subscription: ['Social media','Influencer partnerships','Free trial / sample','Community forums','Paid ads']
  };

  var COSTS = {
    _common: ['Marketing & advertising','Insurance','Software & tools'],
    restaurant: ['Rent / lease','Staff wages','Ingredients & supplies','Equipment','Utilities','Licenses & permits'],
    retail: ['Rent / lease','Staff wages','Inventory / stock','Store fixtures','Packaging','Shipping'],
    service: ['Your time','Staff / contractors','Office / coworking','Professional development','Travel'],
    saas: ['Development team','Hosting / infrastructure','Customer support','Sales team','Office / remote tools'],
    ecommerce: ['Inventory','Shipping & fulfillment','Platform fees','Packaging','Returns / refunds','Warehouse'],
    subscription: ['Product sourcing','Packaging & shipping','Platform / tech','Customer acquisition','Content creation']
  };

  var GOALS = [
    'Grow revenue',
    'Find product-market fit',
    'Reduce costs',
    'Expand to new markets',
    'Launch new product or service',
    'Build the team',
    'Improve customer retention'
  ];

  function getSuggestions(pool, type) {
    var common = pool._common || [];
    var specific = pool[type] || [];
    var seen = {};
    var result = [];
    specific.concat(common).forEach(function(item) {
      var key = item.toLowerCase();
      if (!seen[key]) { seen[key] = true; result.push(item); }
    });
    return result;
  }

  // ── Claude API ──
  function isAvailable() {
    return !!PROXY_URL;
  }

  function callClaude(messages, options) {
    options = options || {};
    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, options.timeout || 30000);

    return fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: options.model || 'claude-sonnet-4-20250514',
        max_tokens: options.maxTokens || 2048,
        system: options.system || '',
        messages: messages
      })
    })
    .then(function(resp) {
      clearTimeout(timeoutId);
      if (!resp.ok) return resp.json().then(function(err) { return { ok: false, error: (err.error && err.error.message) || 'API error' }; });
      return resp.json().then(function(data) {
        var text = data.content && data.content[0] && data.content[0].text;
        return { ok: true, text: text, usage: data.usage };
      });
    })
    .catch(function(err) {
      clearTimeout(timeoutId);
      return { ok: false, error: err.name === 'AbortError' ? 'Request timed out' : err.message };
    });
  }

  function parseJSON(text) {
    if (!text) return null;
    // Try to extract JSON from markdown code blocks or raw text
    var match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    var jsonStr = match ? match[1].trim() : text.trim();
    try { return JSON.parse(jsonStr); } catch(e) { return null; }
  }

  // ── Website Analysis ──
  function stripHTML(html) {
    // Remove scripts, styles, then tags
    var clean = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                    .replace(/<style[\s\S]*?<\/style>/gi, '')
                    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
                    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
    return clean.slice(0, 4000);
  }

  function fetchWithTimeout(url, timeout) {
    var controller = new AbortController();
    var id = setTimeout(function() { controller.abort(); }, timeout || 5000);
    return fetch(url, { signal: controller.signal })
      .then(function(r) { clearTimeout(id); return r; })
      .catch(function(e) { clearTimeout(id); throw e; });
  }

  function analyzeWebsite(url) {
    // Normalize URL
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;

    // Tier 1: Direct fetch
    return fetchWithTimeout(url, 5000)
      .then(function(resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.text();
      })
      .catch(function() {
        // Tier 2: CORS proxy (allorigins)
        return fetchWithTimeout('https://api.allorigins.win/get?url=' + encodeURIComponent(url), 6000)
          .then(function(resp) { return resp.json(); })
          .then(function(data) {
            if (!data.contents) throw new Error('No content');
            return data.contents;
          })
          .catch(function() {
            // Tier 2b: corsproxy.io
            return fetchWithTimeout('https://corsproxy.io/?' + encodeURIComponent(url), 6000)
              .then(function(resp) {
                if (!resp.ok) throw new Error('Proxy failed');
                return resp.text();
              });
          });
      })
      .then(function(html) {
        // Got HTML — send to Claude for extraction
        var text = stripHTML(html);
        if (!isAvailable()) {
          // No AI: keyword-detect from website text
          var type = detectType(text);
          return { ok: true, source: 'keywords', data: { description: text.slice(0, 200), type: type } };
        }
        return callClaude([{
          role: 'user',
          content: 'Here is the text content from a business website at ' + url + ':\n\n' + text + '\n\nExtract key business information and return JSON.'
        }], {
          system: 'You are analyzing a business website. Return ONLY valid JSON with these fields:\n{\n  "businessName": "string",\n  "description": "1-2 sentence summary",\n  "type": "restaurant|retail|service|saas|ecommerce|subscription",\n  "valueProposition": "what makes them special",\n  "customerSegments": ["segment1", "segment2"],\n  "products": ["product/service 1"],\n  "channels": ["channel1"],\n  "tone": "how they present themselves"\n}\nUse null for uncertain fields.',
          maxTokens: 1024
        }).then(function(result) {
          if (!result.ok) return { ok: false, error: result.error };
          var parsed = parseJSON(result.text);
          return parsed ? { ok: true, source: 'ai', data: parsed } : { ok: false, error: 'Could not parse response' };
        });
      })
      .catch(function() {
        // Tier 3: Ask Claude what it knows about this URL
        if (!isAvailable()) return { ok: false, fallback: 'manual' };
        return callClaude([{
          role: 'user',
          content: 'The business website is at ' + url + '. Based on your knowledge, describe what this business does, who its customers are, and what it offers. If you don\'t know, say so. Return the same JSON format.'
        }], {
          system: 'You are analyzing a business. Return ONLY valid JSON with fields: businessName, description, type, valueProposition, customerSegments[], products[], channels[], tone. Use null for fields you cannot determine.',
          maxTokens: 1024
        }).then(function(result) {
          if (!result.ok) return { ok: false, fallback: 'manual' };
          var parsed = parseJSON(result.text);
          return parsed ? { ok: true, source: 'ai-knowledge', data: parsed } : { ok: false, fallback: 'manual' };
        });
      });
  }

  // ── AI Hypothesis Generation ──
  function generateHypotheses(wizardData) {
    if (!isAvailable()) {
      return Promise.resolve({ ok: true, source: 'fallback', hypotheses: keywordFallbackHypotheses(wizardData) });
    }

    var context = 'Here\'s what we know about this business:\n';
    if (wizardData.name) context += '- Business name: ' + wizardData.name + '\n';
    if (wizardData.description) context += '- Description: ' + wizardData.description + '\n';
    if (wizardData.proudOf) context += '- What the owner is most proud of: ' + wizardData.proudOf + '\n';
    if (wizardData.segments && wizardData.segments.length) context += '- Customer segments: ' + wizardData.segments.join(', ') + '\n';
    if (wizardData.revenueRange) context += '- Monthly revenue range: ' + wizardData.revenueRange + '\n';
    if (wizardData.costs && wizardData.costs.length) context += '- Main costs: ' + wizardData.costs.join(', ') + '\n';
    if (wizardData.teamSize) context += '- Team size: ' + wizardData.teamSize + '\n';
    if (wizardData.goal) context += '- 6-month goal: ' + wizardData.goal + '\n';
    if (wizardData.concern) context += '- Biggest concern: ' + wizardData.concern + '\n';

    return callClaude([{
      role: 'user',
      content: context + '\nGenerate 5-8 specific, measurable, testable hypotheses for this business. Each should be something the owner can actually test in the next 1-3 months. Be specific to THIS business, not generic.'
    }], {
      system: 'You are a Lean Startup advisor helping small business owners test their assumptions.\n\nReturn ONLY valid JSON:\n{\n  "hypotheses": [{\n    "canvasElement": "customerSegments|valueProp|channels|revenueStreams|costStructure|keyActivities|keyResources|keyPartners|customerRelationships",\n    "category": "customer|value|revenue|growth|cost",\n    "statement": "specific testable statement",\n    "metric": "what to measure",\n    "target": <number>,\n    "unit": "unit of measurement",\n    "timeframe": "time period to test",\n    "priority": "critical|important|nice-to-have",\n    "rationale": "why this matters for their business"\n  }]\n}\n\nMake hypotheses specific and actionable. Use concrete numbers. Prioritize based on what matters most for their stage and goals.',
      maxTokens: 2048
    }).then(function(result) {
      if (!result.ok) {
        return { ok: true, source: 'fallback', hypotheses: keywordFallbackHypotheses(wizardData) };
      }
      var parsed = parseJSON(result.text);
      if (parsed && parsed.hypotheses && parsed.hypotheses.length > 0) {
        return { ok: true, source: 'ai', hypotheses: parsed.hypotheses };
      }
      return { ok: true, source: 'fallback', hypotheses: keywordFallbackHypotheses(wizardData) };
    });
  }

  // ── Keyword Fallback Hypothesis Generation ──
  function keywordFallbackHypotheses(d) {
    var hyps = [];

    if (d.segments && d.segments.length > 0) {
      d.segments.slice(0, 2).forEach(function(seg) {
        hyps.push({
          canvasElement: 'customerSegments', category: 'customer',
          statement: seg + ' will be interested in our offering',
          metric: 'Interested prospects from ' + seg,
          target: 10, unit: 'people', timeframe: 'First month', priority: 'critical'
        });
      });
    }

    if (d.proudOf) {
      hyps.push({
        canvasElement: 'valueProp', category: 'value',
        statement: 'Customers will recognize and value what makes us special',
        metric: 'Customer satisfaction score',
        target: 8, unit: 'out of 10', timeframe: 'First 3 months', priority: 'critical'
      });
      hyps.push({
        canvasElement: 'valueProp', category: 'value',
        statement: 'At least 50% of customers will return or recommend us',
        metric: 'Repeat / referral rate',
        target: 50, unit: '%', timeframe: 'First 3 months', priority: 'critical'
      });
    }

    hyps.push({
      canvasElement: 'valueProp', category: 'value',
      statement: 'People are willing to pay for this (not just interested)',
      metric: 'Paying customers',
      target: 5, unit: 'paying customers', timeframe: 'First month', priority: 'critical'
    });

    if (d.costs && d.costs.length > 0) {
      hyps.push({
        canvasElement: 'costStructure', category: 'cost',
        statement: 'Monthly costs will stay within our budget',
        metric: 'Total monthly expenses',
        target: 5000, unit: '$/month', timeframe: 'Ongoing', priority: 'critical'
      });
    }

    if (d.goal) {
      hyps.push({
        canvasElement: 'revenueStreams', category: 'revenue',
        statement: 'We will make measurable progress toward our 6-month goal',
        metric: 'Progress toward goal',
        target: 50, unit: '%', timeframe: '3 months', priority: 'important'
      });
    }

    return hyps;
  }

  // ── Build canvas from wizard data ──
  function buildCanvas(wizardData) {
    var canvas = Store.getCanvas();
    var d = wizardData;
    var wd = d.websiteData;

    // Customer segments from wizard selections
    if (d.segments) d.segments.forEach(function(s) {
      canvas.customerSegments.push({ id: Store.uid(), text: s, notes: '' });
    });

    // Value proposition from proudOf
    if (d.proudOf) canvas.valueProp.push({ id: Store.uid(), text: d.proudOf, notes: '' });

    // Costs
    if (d.costs) d.costs.forEach(function(c) {
      canvas.costStructure.push({ id: Store.uid(), text: c, notes: '' });
    });

    // Revenue from website data or revenueRange
    if (wd && wd.products) {
      wd.products.forEach(function(p) {
        canvas.revenueStreams.push({ id: Store.uid(), text: p, notes: '' });
      });
    }
    if (d.revenueRange && d.revenueRange !== 'Pre-revenue') {
      canvas.revenueStreams.push({ id: Store.uid(), text: 'Revenue target: ' + d.revenueRange + '/month', notes: '' });
    }

    // Channels from website data or defaults
    if (wd && wd.channels) {
      wd.channels.forEach(function(ch) {
        canvas.channels.push({ id: Store.uid(), text: ch, notes: '' });
      });
    }

    // Defaults for remaining canvas elements
    canvas.customerRelationships.push({ id: Store.uid(), text: 'Personal interaction', notes: '' });
    canvas.keyActivities.push({ id: Store.uid(), text: 'Deliver core product/service', notes: '' });
    canvas.keyActivities.push({ id: Store.uid(), text: 'Acquire customers', notes: '' });
    canvas.keyResources.push({ id: Store.uid(), text: 'Founding team', notes: '' });
    if (d.teamSize && d.teamSize !== 'Just me') {
      canvas.keyResources.push({ id: Store.uid(), text: 'Team of ' + d.teamSize, notes: '' });
    }

    return canvas;
  }

  return {
    PROXY_URL: PROXY_URL,
    TYPE_KEYWORDS: TYPE_KEYWORDS,
    TYPE_LABELS: TYPE_LABELS,
    SEGMENTS: SEGMENTS,
    CHANNELS: CHANNELS,
    COSTS: COSTS,
    GOALS: GOALS,
    detectType: detectType,
    getSuggestions: getSuggestions,
    isAvailable: isAvailable,
    callClaude: callClaude,
    analyzeWebsite: analyzeWebsite,
    generateHypotheses: generateHypotheses,
    keywordFallbackHypotheses: keywordFallbackHypotheses,
    buildCanvas: buildCanvas
  };
})();
