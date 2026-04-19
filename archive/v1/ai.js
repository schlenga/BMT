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

  // ── Adaptive Terminology ──
  var TERMINOLOGY = {
    restaurant: {
      customerSegments: 'Your Guests',
      valueProp: 'Why They Come Back',
      channels: 'How They Find You',
      customerRelationships: 'Guest Experience',
      revenueStreams: 'How You Earn',
      keyResources: 'What You Need',
      keyActivities: 'Daily Operations',
      keyPartners: 'Your Partners',
      costStructure: 'Running Costs',
      customers: 'guests',
      products: 'dishes & drinks',
      revenue: 'covers & orders',
      team: 'staff',
      proudPrompt: 'What makes your place special?',
      customersPrompt: 'Who are your best guests?',
      goalPrompt: 'Where do you want to take this?',
      concernPrompt: 'What keeps you up at night about the business?'
    },
    retail: {
      customerSegments: 'Your Shoppers',
      valueProp: 'Why They Choose You',
      channels: 'Where They Find You',
      customerRelationships: 'Shopper Experience',
      revenueStreams: 'Revenue Streams',
      keyResources: 'What You Need',
      keyActivities: 'Key Operations',
      keyPartners: 'Your Partners',
      costStructure: 'Store Costs',
      customers: 'shoppers',
      products: 'products',
      revenue: 'sales',
      team: 'team',
      proudPrompt: 'What makes your store stand out?',
      customersPrompt: 'Who are your best shoppers?',
      goalPrompt: 'What\'s your biggest goal for the next 6 months?',
      concernPrompt: 'What\'s the biggest risk you see?'
    },
    service: {
      customerSegments: 'Your Clients',
      valueProp: 'Your Edge',
      channels: 'How Clients Find You',
      customerRelationships: 'Client Relations',
      revenueStreams: 'Revenue Streams',
      keyResources: 'Key Resources',
      keyActivities: 'Core Services',
      keyPartners: 'Partners & Network',
      costStructure: 'Operating Costs',
      customers: 'clients',
      products: 'services',
      revenue: 'engagements',
      team: 'team',
      proudPrompt: 'What makes your service stand out?',
      customersPrompt: 'Who are your best clients?',
      goalPrompt: 'What\'s your biggest goal for the next 6 months?',
      concernPrompt: 'What\'s keeping you up at night?'
    },
    saas: {
      customerSegments: 'Your Users',
      valueProp: 'Core Value',
      channels: 'Acquisition Channels',
      customerRelationships: 'User Experience',
      revenueStreams: 'Revenue Model',
      keyResources: 'Tech & Team',
      keyActivities: 'Build & Ship',
      keyPartners: 'Integrations & Partners',
      costStructure: 'Burn Rate',
      customers: 'users',
      products: 'features & plans',
      revenue: 'MRR',
      team: 'engineers',
      proudPrompt: 'What\'s your unfair advantage?',
      customersPrompt: 'Who are your power users?',
      goalPrompt: 'What does growth look like for you?',
      concernPrompt: 'What\'s the biggest risk to the product?'
    },
    ecommerce: {
      customerSegments: 'Your Buyers',
      valueProp: 'Why They Buy From You',
      channels: 'Where They Find You',
      customerRelationships: 'Buyer Experience',
      revenueStreams: 'Sales Channels',
      keyResources: 'Supply & Logistics',
      keyActivities: 'Fulfillment & Marketing',
      keyPartners: 'Suppliers & Platforms',
      costStructure: 'Cost of Goods & Ops',
      customers: 'buyers',
      products: 'products',
      revenue: 'orders',
      team: 'team',
      proudPrompt: 'What makes your store different?',
      customersPrompt: 'Who are your best buyers?',
      goalPrompt: 'What\'s your growth target?',
      concernPrompt: 'What\'s the biggest challenge right now?'
    },
    subscription: {
      customerSegments: 'Your Members',
      valueProp: 'Why They Stay',
      channels: 'How Members Find You',
      customerRelationships: 'Member Experience',
      revenueStreams: 'Recurring Revenue',
      keyResources: 'Content & Curation',
      keyActivities: 'Curation & Delivery',
      keyPartners: 'Sourcing Partners',
      costStructure: 'Cost per Member',
      customers: 'members',
      products: 'offerings',
      revenue: 'subscriptions',
      team: 'team',
      proudPrompt: 'What keeps your members coming back?',
      customersPrompt: 'Who are your most engaged members?',
      goalPrompt: 'What does success look like in 6 months?',
      concernPrompt: 'What\'s the biggest risk to retention?'
    }
  };

  var DEFAULT_TERMINOLOGY = {
    customerSegments: 'Customer Segments',
    valueProp: 'Value Proposition',
    channels: 'Channels',
    customerRelationships: 'Customer Relations',
    revenueStreams: 'Revenue Streams',
    keyResources: 'Key Resources',
    keyActivities: 'Key Activities',
    keyPartners: 'Key Partners',
    costStructure: 'Cost Structure',
    customers: 'customers',
    products: 'products',
    revenue: 'revenue',
    team: 'team',
    proudPrompt: 'What are you most proud of about your business?',
    customersPrompt: 'Who are your best customers?',
    goalPrompt: 'What\'s your biggest goal for the next 6 months?',
    concernPrompt: 'What keeps you up at night?'
  };

  function getTerminology(type) {
    var base = {};
    var k;
    for (k in DEFAULT_TERMINOLOGY) base[k] = DEFAULT_TERMINOLOGY[k];
    var override = TERMINOLOGY[type];
    if (override) {
      for (k in override) base[k] = override[k];
    }
    // Check if store has custom terminology from Claude
    var stored = Store.getTerminology ? Store.getTerminology() : null;
    if (stored && stored.labels) {
      for (k in stored.labels) {
        if (stored.labels[k]) base[k] = stored.labels[k];
      }
    }
    return base;
  }

  function getTerm(type, key) {
    var terms = getTerminology(type);
    return terms[key] || DEFAULT_TERMINOLOGY[key] || key;
  }

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

  // ── Color Extraction & Palette ──
  function extractColorsFromHTML(html) {
    var colors = [];
    // theme-color meta tag
    var themeMeta = html.match(/<meta[^>]*name=["']theme-color["'][^>]*content=["'](#[0-9a-fA-F]{3,8})["']/i);
    if (!themeMeta) themeMeta = html.match(/<meta[^>]*content=["'](#[0-9a-fA-F]{3,8})["'][^>]*name=["']theme-color["']/i);
    if (themeMeta) colors.push(themeMeta[1]);

    // msapplication-TileColor
    var tileMeta = html.match(/<meta[^>]*name=["']msapplication-TileColor["'][^>]*content=["'](#[0-9a-fA-F]{3,8})["']/i);
    if (tileMeta) colors.push(tileMeta[1]);

    // CSS custom properties that look like brand colors
    var brandVarRe = /--(?:brand|primary|main|accent|theme)[^:]*:\s*(#[0-9a-fA-F]{3,8})/gi;
    var m;
    while ((m = brandVarRe.exec(html)) !== null) colors.push(m[1]);

    // Common CSS background-color and color values (skip black/white/gray)
    var cssColorRe = /(?:background-color|background|color)\s*:\s*(#[0-9a-fA-F]{3,8})/gi;
    while ((m = cssColorRe.exec(html)) !== null) {
      var c = m[1].toLowerCase();
      if (c !== '#fff' && c !== '#ffffff' && c !== '#000' && c !== '#000000' &&
          c !== '#333' && c !== '#333333' && c !== '#666' && c !== '#999' && c !== '#ccc') {
        colors.push(m[1]);
      }
    }

    // Deduplicate
    var seen = {};
    return colors.filter(function(c) {
      var k = c.toLowerCase();
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    }).slice(0, 6);
  }

  function hexToHSL(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var r = parseInt(hex.substr(0,2),16)/255;
    var g = parseInt(hex.substr(2,2),16)/255;
    var b = parseInt(hex.substr(4,2),16)/255;
    var max = Math.max(r,g,b), min = Math.min(r,g,b);
    var h=0, s=0, l=(max+min)/2;
    if (max !== min) {
      var d = max-min;
      s = l>0.5 ? d/(2-max-min) : d/(max+min);
      if (max===r) h=((g-b)/d+(g<b?6:0))/6;
      else if (max===g) h=((b-r)/d+2)/6;
      else h=((r-g)/d+4)/6;
    }
    return {h:Math.round(h*360), s:Math.round(s*100), l:Math.round(l*100)};
  }

  function hslToHex(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    var r, g, b;
    if (s === 0) { r=g=b=l; } else {
      function hue2rgb(p,q,t) {
        if(t<0) t+=1; if(t>1) t-=1;
        if(t<1/6) return p+(q-p)*6*t;
        if(t<1/2) return q;
        if(t<2/3) return p+(q-p)*(2/3-t)*6;
        return p;
      }
      var q = l<0.5 ? l*(1+s) : l+s-l*s;
      var p = 2*l-q;
      r = hue2rgb(p,q,h+1/3);
      g = hue2rgb(p,q,h);
      b = hue2rgb(p,q,h-1/3);
    }
    function toHex(x) { var hex = Math.round(x*255).toString(16); return hex.length===1?'0'+hex:hex; }
    return '#'+toHex(r)+toHex(g)+toHex(b);
  }

  function generatePalette(primary, secondary) {
    if (!primary) return null;
    var hsl = hexToHSL(primary);

    var palette = {
      accent: primary,
      accent2: hslToHex(hsl.h, Math.min(hsl.s+5, 100), Math.max(hsl.l-15, 15)),
      accentLight: hslToHex(hsl.h, Math.max(hsl.s-40, 10), 95),
      bg: hslToHex(hsl.h, 8, 97),
      bg2: hslToHex(hsl.h, 10, 93),
      surface: '#ffffff',
      surface2: hslToHex(hsl.h, 6, 98),
      text: hslToHex(hsl.h, 15, 16),
      text2: hslToHex(hsl.h, 10, 40),
      text3: hslToHex(hsl.h, 8, 60),
      border: hslToHex(hsl.h, 10, 88),
      border2: hslToHex(hsl.h, 12, 82),
      shadow: 'rgba(' + Math.round(hsl.h/360*45) + ',' + Math.round(hsl.h/360*42) + ',' + Math.round(hsl.h/360*38) + ', 0.06)',
      shadow2: 'rgba(' + Math.round(hsl.h/360*45) + ',' + Math.round(hsl.h/360*42) + ',' + Math.round(hsl.h/360*38) + ', 0.12)'
    };

    if (secondary) {
      var hsl2 = hexToHSL(secondary);
      // Use secondary for some accents if it's sufficiently different
      if (Math.abs(hsl.h - hsl2.h) > 30) {
        palette.accent2 = secondary;
      }
    }

    return palette;
  }

  function applyTheme(palette) {
    if (!palette) return;
    var root = document.documentElement;
    var map = {
      '--accent': palette.accent,
      '--accent2': palette.accent2,
      '--accent-light': palette.accentLight,
      '--bg': palette.bg,
      '--bg2': palette.bg2,
      '--surface': palette.surface,
      '--surface2': palette.surface2,
      '--text': palette.text,
      '--text2': palette.text2,
      '--text3': palette.text3,
      '--border': palette.border,
      '--border2': palette.border2,
      '--shadow': palette.shadow,
      '--shadow2': palette.shadow2
    };

    // Add transition class for smooth color shift
    document.body.classList.add('theme-transitioning');
    for (var prop in map) {
      if (map[prop]) root.style.setProperty(prop, map[prop]);
    }
    setTimeout(function() {
      document.body.classList.remove('theme-transitioning');
    }, 700);

    // Persist
    if (Store.saveTheme) Store.saveTheme(palette);
  }

  function restoreTheme() {
    var palette = Store.getTheme ? Store.getTheme() : null;
    if (palette && palette.accent) {
      var root = document.documentElement;
      var map = {
        '--accent': palette.accent,
        '--accent2': palette.accent2,
        '--accent-light': palette.accentLight,
        '--bg': palette.bg,
        '--bg2': palette.bg2,
        '--surface': palette.surface,
        '--surface2': palette.surface2,
        '--text': palette.text,
        '--text2': palette.text2,
        '--text3': palette.text3,
        '--border': palette.border,
        '--border2': palette.border2,
        '--shadow': palette.shadow,
        '--shadow2': palette.shadow2
      };
      for (var prop in map) {
        if (map[prop]) root.style.setProperty(prop, map[prop]);
      }
    }
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
        // Got HTML — extract colors from CSS before stripping
        var htmlColors = extractColorsFromHTML(html);
        var text = stripHTML(html);
        if (!isAvailable()) {
          // No AI: keyword-detect from website text
          var type = detectType(text);
          return { ok: true, source: 'keywords', data: { description: text.slice(0, 200), type: type }, colors: htmlColors };
        }
        var colorHint = htmlColors.length > 0 ? '\n\nCSS/meta colors found on the page: ' + htmlColors.join(', ') : '';
        return callClaude([{
          role: 'user',
          content: 'Here is the text content from a business website at ' + url + ':\n\n' + text + colorHint + '\n\nExtract key business information and return JSON.'
        }], {
          system: 'You analyze business websites. Return ONLY valid JSON:\n{\n  "businessName": "string",\n  "description": "1-2 sentence summary",\n  "type": "restaurant|retail|service|saas|ecommerce|subscription",\n  "valueProposition": "what makes them special",\n  "customerSegments": ["segment1", "segment2", "segment3"],\n  "products": ["product/service 1"],\n  "channels": ["channel1"],\n  "tone": "casual|professional|friendly|luxurious|technical",\n  "brandColors": {\n    "primary": "#hex or null",\n    "secondary": "#hex or null"\n  },\n  "greeting": "A warm one-sentence welcome for the business owner, mentioning their business by name"\n}\nFor brandColors: use the CSS colors provided if available, or infer from the brand identity. Use null for uncertain fields.',
          maxTokens: 1024
        }).then(function(result) {
          if (!result.ok) return { ok: false, error: result.error };
          var parsed = parseJSON(result.text);
          if (!parsed) return { ok: false, error: 'Could not parse response' };
          // Merge HTML-extracted colors as fallback
          if ((!parsed.brandColors || !parsed.brandColors.primary) && htmlColors.length > 0) {
            parsed.brandColors = { primary: htmlColors[0], secondary: htmlColors[1] || null };
          }
          return { ok: true, source: 'ai', data: parsed };
        });
      })
      .catch(function() {
        // Tier 3: Ask Claude what it knows about this URL
        if (!isAvailable()) return { ok: false, fallback: 'manual' };
        return callClaude([{
          role: 'user',
          content: 'The business website is at ' + url + '. Based on your knowledge, describe what this business does, who its customers are, and what it offers. If you don\'t know, say so. Return the same JSON format.'
        }], {
          system: 'You analyze businesses. Return ONLY valid JSON:\n{\n  "businessName": "string",\n  "description": "1-2 sentence summary",\n  "type": "restaurant|retail|service|saas|ecommerce|subscription",\n  "valueProposition": "what makes them special",\n  "customerSegments": ["segment1", "segment2"],\n  "products": ["product/service 1"],\n  "channels": ["channel1"],\n  "tone": "casual|professional|friendly|luxurious|technical",\n  "brandColors": { "primary": "#hex or null", "secondary": "#hex or null" },\n  "greeting": "A warm one-sentence welcome for the business owner"\n}\nUse null for uncertain fields.',
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
    TERMINOLOGY: TERMINOLOGY,
    DEFAULT_TERMINOLOGY: DEFAULT_TERMINOLOGY,
    detectType: detectType,
    getSuggestions: getSuggestions,
    getTerminology: getTerminology,
    getTerm: getTerm,
    isAvailable: isAvailable,
    callClaude: callClaude,
    extractColorsFromHTML: extractColorsFromHTML,
    hexToHSL: hexToHSL,
    hslToHex: hslToHex,
    generatePalette: generatePalette,
    applyTheme: applyTheme,
    restoreTheme: restoreTheme,
    analyzeWebsite: analyzeWebsite,
    generateHypotheses: generateHypotheses,
    keywordFallbackHypotheses: keywordFallbackHypotheses,
    buildCanvas: buildCanvas
  };
})();
