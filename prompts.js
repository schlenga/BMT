// prompts.js — Action prompt engine (rule-based + AI-enhanced + tool connectors)
'use strict';

var Prompts = (function() {

  // ── Tool Connectors ──
  var TOOL_CONNECTORS = {
    buffer:             { name: 'Buffer',           icon: '\uD83D\uDCC5', categories: ['scheduling'] },
    hootsuite:          { name: 'Hootsuite',        icon: '\uD83E\uDD89', categories: ['scheduling'] },
    instagram:          { name: 'Instagram',        icon: '\uD83D\uDCF8', categories: ['social'] },
    tiktok:             { name: 'TikTok',           icon: '\uD83C\uDFB5', categories: ['social'] },
    facebook:           { name: 'Facebook',         icon: '\uD83D\uDC4D', categories: ['social'] },
    linkedin:           { name: 'LinkedIn',         icon: '\uD83D\uDCBC', categories: ['social'] },
    mailchimp:          { name: 'Mailchimp',        icon: '\uD83D\uDCE7', categories: ['email'] },
    convertkit:         { name: 'ConvertKit',       icon: '\u2709\uFE0F', categories: ['email'] },
    indeed:             { name: 'Indeed',           icon: '\uD83D\uDC54', categories: ['hiring'] },
    'linkedin-jobs':    { name: 'LinkedIn Jobs',    icon: '\uD83D\uDCBC', categories: ['hiring'] },
    'google-ads':       { name: 'Google Ads',       icon: '\uD83D\uDCE2', categories: ['ads'] },
    'meta-ads':         { name: 'Meta Ads',         icon: '\uD83C\uDFAF', categories: ['ads'] },
    'google-analytics': { name: 'Google Analytics', icon: '\uD83D\uDCCA', categories: ['analytics'] },
    stripe:             { name: 'Stripe',           icon: '\uD83D\uDCB3', categories: ['payments'] },
    square:             { name: 'Square',           icon: '\u25A0',       categories: ['payments'] },
    hubspot:            { name: 'HubSpot',          icon: '\uD83E\uDD1D', categories: ['crm'] },
    salesforce:         { name: 'Salesforce',       icon: '\u2601\uFE0F', categories: ['crm'] }
  };

  // Categories users can pick from (displayed in wizard + settings)
  var TOOL_CATEGORIES = [
    { id: 'social',     label: 'Social Media',    tools: ['instagram', 'tiktok', 'facebook', 'linkedin'] },
    { id: 'scheduling', label: 'Scheduling',      tools: ['buffer', 'hootsuite'] },
    { id: 'email',      label: 'Email Marketing', tools: ['mailchimp', 'convertkit'] },
    { id: 'ads',        label: 'Ads',             tools: ['google-ads', 'meta-ads'] },
    { id: 'analytics',  label: 'Analytics',       tools: ['google-analytics'] },
    { id: 'hiring',     label: 'Hiring',          tools: ['indeed', 'linkedin-jobs'] },
    { id: 'payments',   label: 'Payments',        tools: ['stripe', 'square'] },
    { id: 'crm',        label: 'CRM',             tools: ['hubspot', 'salesforce'] }
  ];

  // ── Helper ──
  function daysSince(dateStr) {
    if (!dateStr) return 999;
    var d = new Date(dateStr);
    var now = new Date();
    return Math.floor((now - d) / 86400000);
  }

  function userHasTool(toolPrefs, category) {
    if (!toolPrefs) return false;
    var arr = toolPrefs[category];
    return arr && arr.length > 0;
  }

  function firstTool(toolPrefs, category) {
    if (!toolPrefs || !toolPrefs[category] || !toolPrefs[category].length) return null;
    var id = toolPrefs[category][0];
    return TOOL_CONNECTORS[id] ? { id: id, name: TOOL_CONNECTORS[id].name, icon: TOOL_CONNECTORS[id].icon } : null;
  }

  function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // ── Rule-based Prompt Generation ──
  function generateFallback(hypotheses, business, toolPrefs) {
    var prompts = [];
    var biz = business || {};
    var stage = biz.stage || 'idea';
    var type = biz.type || 'service';

    // Hypothesis-specific prompts
    hypotheses.forEach(function(hyp) {
      var lastLog = hyp.actuals && hyp.actuals.length > 0 ? hyp.actuals[hyp.actuals.length - 1] : null;
      var stale = lastLog ? daysSince(lastLog.date) : daysSince(hyp.createdAt);
      var progress = lastLog && hyp.target ? (lastLog.value / hyp.target) : 0;
      var statement = hyp.statement || '';

      // Stale reminder (any hypothesis with no log in 7+ days)
      if (hyp.status === 'testing' && stale >= 7) {
        prompts.push({
          key: 'stale-' + hyp.id,
          hypId: hyp.id,
          type: 'testing',
          title: 'Time to check in!',
          description: 'Log your latest data for "' + statement.slice(0, 60) + '"',
          urgency: 'high',
          effort: '5 min',
          tool: null
        });
      }

      if (hyp.status === 'testing') {
        // Customer hypotheses
        if (hyp.category === 'customer') {
          if (!lastLog) {
            var seg = statement.replace(/ will be interested.*/, '') || 'your target customers';
            prompts.push({
              key: 'customer-talk-' + hyp.id,
              hypId: hyp.id,
              type: 'testing',
              title: 'Talk to 5 potential customers',
              description: 'Find 5 people from "' + seg + '" and ask what frustrates them most. Take notes and log the count.',
              urgency: 'high',
              effort: '1 hour',
              tool: null
            });
          } else if (progress < 0.5) {
            prompts.push({
              key: 'customer-survey-' + hyp.id,
              hypId: hyp.id,
              type: 'testing',
              title: 'Run a quick survey',
              description: 'Post a short survey in communities where your target customers hang out. Try local Facebook groups or Reddit.',
              urgency: 'medium',
              effort: '30 min',
              tool: userHasTool(toolPrefs, 'social') ? firstTool(toolPrefs, 'social') : null
            });
          }
        }

        // Value hypotheses
        if (hyp.category === 'value' && !lastLog) {
          if (type === 'restaurant' || type === 'retail') {
            prompts.push({
              key: 'value-sample-' + hyp.id,
              hypId: hyp.id,
              type: 'testing',
              title: 'Offer a free sample or demo day',
              description: 'Invite 10 people for a free tasting or demo. Count how many show genuine interest.',
              urgency: 'high',
              effort: '2 hours',
              tool: null
            });
          } else if (type === 'saas') {
            prompts.push({
              key: 'value-mockup-' + hyp.id,
              hypId: hyp.id,
              type: 'testing',
              title: 'Run 3 user tests with a mockup',
              description: 'Build a quick mockup or prototype and watch 3 potential users try to use it. Note where they get stuck.',
              urgency: 'high',
              effort: '2 hours',
              tool: null
            });
          } else {
            prompts.push({
              key: 'value-landing-' + hyp.id,
              hypId: hyp.id,
              type: 'testing',
              title: 'Set up a landing page test',
              description: 'Create a simple landing page describing your value proposition. Track how many visitors sign up or inquire.',
              urgency: 'high',
              effort: '1 hour',
              tool: null
            });
          }
        }

        // Revenue hypotheses
        if (hyp.category === 'revenue') {
          if (!lastLog) {
            prompts.push({
              key: 'revenue-presell-' + hyp.id,
              hypId: hyp.id,
              type: 'testing',
              title: 'Try pre-selling before building',
              description: 'Ask 5 people if they would pay for this today. Offer a pre-order or letter of intent.',
              urgency: 'high',
              effort: '1 hour',
              tool: userHasTool(toolPrefs, 'payments') ? firstTool(toolPrefs, 'payments') : null
            });
          } else if (progress < 0.3) {
            prompts.push({
              key: 'revenue-pricing-' + hyp.id,
              hypId: hyp.id,
              type: 'testing',
              title: 'Test a different price point',
              description: 'You\'re at ' + Math.round(progress * 100) + '% of target. Try offering two tiers and see which gets more takers.',
              urgency: 'medium',
              effort: '30 min',
              tool: null
            });
          }
        }

        // Growth / Channel hypotheses
        if (hyp.category === 'growth') {
          var stLower = statement.toLowerCase();
          if (stLower.indexOf('instagram') >= 0 || stLower.indexOf('tiktok') >= 0 || stLower.indexOf('social') >= 0) {
            var socialTool = firstTool(toolPrefs, 'social') || firstTool(toolPrefs, 'scheduling');
            prompts.push({
              key: 'growth-social-' + hyp.id,
              hypId: hyp.id,
              type: 'testing',
              title: 'Post 3 times this week',
              description: 'Post consistently and track which posts actually drive inquiries or sign-ups, not just likes.',
              urgency: 'medium',
              effort: '30 min',
              tool: socialTool
            });
          } else if (stLower.indexOf('google') >= 0 || stLower.indexOf('seo') >= 0) {
            prompts.push({
              key: 'growth-google-' + hyp.id,
              hypId: hyp.id,
              type: 'testing',
              title: 'Set up your Google Business profile',
              description: 'Claim your Google Business listing and track impressions this week.',
              urgency: 'medium',
              effort: '30 min',
              tool: userHasTool(toolPrefs, 'analytics') ? firstTool(toolPrefs, 'analytics') : null
            });
          } else if (stLower.indexOf('email') >= 0 || stLower.indexOf('newsletter') >= 0) {
            prompts.push({
              key: 'growth-email-' + hyp.id,
              hypId: hyp.id,
              type: 'testing',
              title: 'Send a campaign to your list',
              description: 'Write a short email highlighting your value proposition. Track open rates and click-throughs.',
              urgency: 'medium',
              effort: '45 min',
              tool: userHasTool(toolPrefs, 'email') ? firstTool(toolPrefs, 'email') : null
            });
          } else if (!lastLog) {
            prompts.push({
              key: 'growth-test-' + hyp.id,
              hypId: hyp.id,
              type: 'testing',
              title: 'Run a small ad experiment',
              description: 'Spend $20-50 on a targeted ad to test if "' + statement.slice(0, 40) + '" actually works.',
              urgency: 'medium',
              effort: '30 min',
              tool: userHasTool(toolPrefs, 'ads') ? firstTool(toolPrefs, 'ads') : null
            });
          }
        }

        // Cost hypotheses
        if (hyp.category === 'cost' && stale >= 14) {
          prompts.push({
            key: 'cost-review-' + hyp.id,
            hypId: hyp.id,
            type: 'testing',
            title: 'Review your costs vs. budget',
            description: 'Add up this month\'s expenses and log the total. Are you on track?',
            urgency: 'medium',
            effort: '20 min',
            tool: userHasTool(toolPrefs, 'payments') ? firstTool(toolPrefs, 'payments') : null
          });
        }
      }

      // Invalidated hypotheses
      if (hyp.status === 'invalidated') {
        prompts.push({
          key: 'pivot-' + hyp.id,
          hypId: hyp.id,
          type: 'testing',
          title: 'Great learning! Plan your pivot',
          description: 'This didn\'t pan out — what did you learn? Create a new hypothesis based on that insight.',
          urgency: 'medium',
          effort: '15 min',
          tool: null
        });
      }

      // Validated hypotheses
      if (hyp.status === 'validated') {
        prompts.push({
          key: 'double-down-' + hyp.id,
          hypId: hyp.id,
          type: 'testing',
          title: 'Double down on what works',
          description: 'This is validated! Can you push the target 50% higher and keep going?',
          urgency: 'low',
          effort: '10 min',
          tool: null
        });
      }
    });

    // ── Business-level action prompts ──
    if (stage === 'idea') {
      prompts.push({
        key: 'biz-pitch',
        hypId: null,
        type: 'business-action',
        title: 'Write a 1-paragraph pitch',
        description: 'Describe your business in 3 sentences. Share it with 3 friends and ask for brutally honest feedback.',
        urgency: 'high',
        effort: '15 min',
        tool: null
      });
    }

    if (stage === 'validation') {
      prompts.push({
        key: 'biz-followup',
        hypId: null,
        type: 'business-action',
        title: 'Follow up with recent customers',
        description: 'Reach out to your last 3 customers. Ask what almost stopped them from buying.',
        urgency: 'medium',
        effort: '20 min',
        tool: userHasTool(toolPrefs, 'crm') ? firstTool(toolPrefs, 'crm') : (userHasTool(toolPrefs, 'email') ? firstTool(toolPrefs, 'email') : null)
      });
    }

    if (stage === 'growth') {
      if (userHasTool(toolPrefs, 'hiring')) {
        prompts.push({
          key: 'biz-hiring',
          hypId: null,
          type: 'business-action',
          title: 'Review open roles and applicants',
          description: 'Check your applicant pipeline. Are you getting quality candidates? Adjust job descriptions if needed.',
          urgency: 'medium',
          effort: '15 min',
          tool: firstTool(toolPrefs, 'hiring')
        });
      }
      prompts.push({
        key: 'biz-scale',
        hypId: null,
        type: 'business-action',
        title: 'Identify your growth bottleneck',
        description: 'What\'s the #1 thing preventing faster growth? Write it down and brainstorm 3 solutions.',
        urgency: 'medium',
        effort: '20 min',
        tool: null
      });
    }

    // Competitor check (all stages)
    prompts.push({
      key: 'biz-competitors',
      hypId: null,
      type: 'business-action',
      title: 'Check what competitors are doing',
      description: 'Spend 15 minutes browsing competitor websites and social media. Note anything new.',
      urgency: 'low',
      effort: '15 min',
      tool: null
    });

    // Social media outreach (if they have social tools)
    if (userHasTool(toolPrefs, 'social') || userHasTool(toolPrefs, 'scheduling')) {
      var schTool = firstTool(toolPrefs, 'scheduling') || firstTool(toolPrefs, 'social');
      prompts.push({
        key: 'biz-social-post',
        hypId: null,
        type: 'business-action',
        title: 'Schedule this week\'s social posts',
        description: 'Plan and schedule 3 posts for the week. Mix value content, behind-the-scenes, and customer stories.',
        urgency: 'medium',
        effort: '30 min',
        tool: schTool
      });
    }

    // Email campaign (if they have email tools)
    if (userHasTool(toolPrefs, 'email')) {
      prompts.push({
        key: 'biz-email-campaign',
        hypId: null,
        type: 'business-action',
        title: 'Send a value-driven email',
        description: 'Share a useful tip or insight with your email list. Don\'t sell \u2014 build trust.',
        urgency: 'low',
        effort: '30 min',
        tool: firstTool(toolPrefs, 'email')
      });
    }

    return prompts;
  }

  // ── AI-Enhanced Prompt Generation ──
  function generateWithAI(hypotheses, business, toolPrefs) {
    if (!AI.isAvailable()) {
      return Promise.resolve({ ok: false });
    }

    var context = 'Business context:\n';
    if (business) {
      if (business.name) context += '- Name: ' + business.name + '\n';
      if (business.type) context += '- Type: ' + business.type + '\n';
      if (business.stage) context += '- Stage: ' + business.stage + '\n';
      if (business.goal) context += '- Goal: ' + business.goal + '\n';
      if (business.concern) context += '- Concern: ' + business.concern + '\n';
      if (business.revenueRange) context += '- Revenue: ' + business.revenueRange + '\n';
      if (business.teamSize) context += '- Team: ' + business.teamSize + '\n';
    }

    // Tool preferences
    var toolNames = [];
    if (toolPrefs) {
      Object.keys(toolPrefs).forEach(function(cat) {
        if (toolPrefs[cat] && toolPrefs[cat].length) {
          toolPrefs[cat].forEach(function(tid) {
            if (TOOL_CONNECTORS[tid]) toolNames.push(TOOL_CONNECTORS[tid].name);
          });
        }
      });
    }
    if (toolNames.length) context += '- Tools they use: ' + toolNames.join(', ') + '\n';

    context += '\nHypotheses:\n';
    hypotheses.forEach(function(hyp, i) {
      var lastLog = hyp.actuals && hyp.actuals.length > 0 ? hyp.actuals[hyp.actuals.length - 1] : null;
      context += (i + 1) + '. [' + hyp.status + '] ' + hyp.statement;
      if (hyp.target) context += ' (target: ' + hyp.target + ' ' + (hyp.unit || '') + ')';
      if (lastLog) context += ' (latest: ' + lastLog.value + ' on ' + lastLog.date + ')';
      context += '\n';
    });

    var validToolIds = toolNames.length > 0 ? Object.keys(TOOL_CONNECTORS).filter(function(id) {
      if (!toolPrefs) return false;
      for (var cat in toolPrefs) {
        if (toolPrefs[cat] && toolPrefs[cat].indexOf(id) >= 0) return true;
      }
      return false;
    }) : [];

    return AI.callClaude([{
      role: 'user',
      content: context + '\nGenerate 3-5 specific, actionable prompts for this business owner. Include both hypothesis testing actions and concrete business tasks. Be very specific to THIS business.'
    }], {
      system: 'You are a hands-on business coach for small business owners. Generate action prompts: specific things they should do THIS WEEK.\n\nReturn ONLY valid JSON:\n{\n  "prompts": [{\n    "hypId": null or the 1-based hypothesis number this relates to,\n    "type": "testing" or "business-action",\n    "title": "short actionable title (max 8 words)",\n    "description": "1-2 sentences of specific advice",\n    "urgency": "high" or "medium" or "low",\n    "effort": "time estimate like 10 min, 30 min, 1 hour",\n    "toolId": null or one of: ' + (validToolIds.length ? validToolIds.join(', ') : 'null (no tools configured)') + '\n  }]\n}\n\nBe concrete and specific. "Talk to 5 customers at the farmers market on Saturday" is better than "Do customer research". Reference their actual tools when relevant.',
      maxTokens: 1024
    }).then(function(result) {
      if (!result.ok) return { ok: false };
      var parsed = AI.parseJSON(result.text);
      if (!parsed || !parsed.prompts) return { ok: false };

      // Map AI response to our prompt format
      var aiPrompts = parsed.prompts.map(function(p, i) {
        var tool = null;
        if (p.toolId && TOOL_CONNECTORS[p.toolId]) {
          tool = { id: p.toolId, name: TOOL_CONNECTORS[p.toolId].name, icon: TOOL_CONNECTORS[p.toolId].icon };
        }
        var hypId = null;
        if (p.hypId && typeof p.hypId === 'number' && hypotheses[p.hypId - 1]) {
          hypId = hypotheses[p.hypId - 1].id;
        }
        return {
          key: 'ai-' + i + '-' + Date.now().toString(36),
          hypId: hypId,
          type: p.type || 'business-action',
          title: p.title || 'Take action',
          description: p.description || '',
          urgency: p.urgency || 'medium',
          effort: p.effort || '15 min',
          tool: tool
        };
      });

      return { ok: true, prompts: aiPrompts };
    });
  }

  // ── Main entry point ──
  function generate(hypotheses, business, toolPrefs, promptState) {
    var state = promptState || { completed: [], dismissed: [] };

    // Build set of completed/dismissed keys for fast lookup
    var excludeKeys = {};
    state.completed.forEach(function(c) { excludeKeys[c.key] = true; });
    state.dismissed.forEach(function(d) { excludeKeys[d] = true; });

    function filterAndSort(rawPrompts) {
      var filtered = rawPrompts.filter(function(p) { return !excludeKeys[p.key]; });
      // Sort: high first, then medium, then low
      var urgencyOrder = { high: 0, medium: 1, low: 2 };
      filtered.sort(function(a, b) {
        return (urgencyOrder[a.urgency] || 1) - (urgencyOrder[b.urgency] || 1);
      });
      return filtered.slice(0, 8);
    }

    // Always generate fallback immediately
    var fallbackPrompts = generateFallback(hypotheses, business, toolPrefs);

    // Try AI-enhanced, return Promise
    return generateWithAI(hypotheses, business, toolPrefs).then(function(aiResult) {
      if (aiResult.ok && aiResult.prompts && aiResult.prompts.length > 0) {
        // Merge: AI prompts first, then fill with unique fallback prompts
        var merged = aiResult.prompts.slice();
        var aiKeys = {};
        merged.forEach(function(p) { aiKeys[p.key] = true; });
        // Add fallback prompts that don't overlap by hypId + type
        var aiHypTypes = {};
        merged.forEach(function(p) { if (p.hypId) aiHypTypes[p.hypId + ':' + p.type] = true; });
        fallbackPrompts.forEach(function(p) {
          if (p.hypId && aiHypTypes[p.hypId + ':' + p.type]) return;
          merged.push(p);
        });
        return filterAndSort(merged);
      }
      return filterAndSort(fallbackPrompts);
    }).catch(function() {
      return filterAndSort(fallbackPrompts);
    });
  }

  // Synchronous version for immediate rendering
  function generateSync(hypotheses, business, toolPrefs, promptState) {
    var state = promptState || { completed: [], dismissed: [] };
    var excludeKeys = {};
    state.completed.forEach(function(c) { excludeKeys[c.key] = true; });
    state.dismissed.forEach(function(d) { excludeKeys[d] = true; });

    var prompts = generateFallback(hypotheses, business, toolPrefs);
    var filtered = prompts.filter(function(p) { return !excludeKeys[p.key]; });
    var urgencyOrder = { high: 0, medium: 1, low: 2 };
    filtered.sort(function(a, b) {
      return (urgencyOrder[a.urgency] || 1) - (urgencyOrder[b.urgency] || 1);
    });
    return filtered.slice(0, 8);
  }

  return {
    TOOL_CONNECTORS: TOOL_CONNECTORS,
    TOOL_CATEGORIES: TOOL_CATEGORIES,
    generate: generate,
    generateSync: generateSync
  };
})();
