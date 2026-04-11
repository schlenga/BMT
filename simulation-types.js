// simulation-types.js — Business type adapters: default templates & input mappings
'use strict';

var SimulationTypes = (function() {

  // ── Revenue stream type definitions ──
  // Each business type maps to one or more revenue stream archetypes
  // Types: 'unit' (per-sale), 'recurring' (subscription/MRR), 'hourly' (time-based), 'project' (fixed-fee projects)

  var DEFAULTS = {

    restaurant: {
      label: 'Restaurant / Food & Drink',
      currency: '$',
      revenueStreams: [
        {
          name: 'Dine-in',
          type: 'unit',
          unitPrice: 25,
          unitsPerMonth: 1800,       // ~60/day × 30 days
          growthRate: 2,
          cogsPerUnit: 0,
          cogsPct: 30,               // food cost ~30%
          seasonality: [0.85, 0.85, 0.95, 1.0, 1.05, 1.1, 1.05, 1.05, 1.0, 1.0, 1.05, 1.15]
        },
        {
          name: 'Takeaway & Delivery',
          type: 'unit',
          unitPrice: 20,
          unitsPerMonth: 600,        // ~20/day
          growthRate: 4,
          cogsPerUnit: 0,
          cogsPct: 35,               // slightly higher (packaging, platform fees)
          seasonality: null
        }
      ],
      staff: [
        { role: 'Chef / Kitchen', count: 3, monthlyCost: 3500 },
        { role: 'Front of house', count: 3, monthlyCost: 2500 },
        { role: 'Manager', count: 1, monthlyCost: 4000 }
      ],
      opex: [
        { name: 'Rent / Lease', monthly: 4000 },
        { name: 'Utilities', monthly: 800 },
        { name: 'Insurance', monthly: 300 },
        { name: 'Marketing', monthly: 500, growthRate: 2 },
        { name: 'Licenses & Permits', monthly: 100 },
        { name: 'Equipment maintenance', monthly: 200 },
        { name: 'Software & POS', monthly: 150 }
      ],
      capex: [
        { name: 'Kitchen equipment', amount: 25000, month: 0 },
        { name: 'Interior fit-out', amount: 15000, month: 0 }
      ],
      startingCash: 50000,
      kpiLabels: {
        units: 'covers',
        revenue: 'sales',
        customers: 'guests'
      }
    },

    retail: {
      label: 'Retail / Shop',
      currency: '$',
      revenueStreams: [
        {
          name: 'In-store sales',
          type: 'unit',
          unitPrice: 35,
          unitsPerMonth: 1200,       // ~40/day
          growthRate: 2,
          cogsPerUnit: 0,
          cogsPct: 50,               // retail markup ~2x
          seasonality: [0.8, 0.8, 0.9, 0.95, 1.0, 1.0, 0.9, 0.95, 1.0, 1.05, 1.2, 1.4]
        },
        {
          name: 'Online orders',
          type: 'unit',
          unitPrice: 40,
          unitsPerMonth: 200,
          growthRate: 5,
          cogsPerUnit: 5,            // shipping/packaging
          cogsPct: 50,
          seasonality: null
        }
      ],
      staff: [
        { role: 'Sales staff', count: 2, monthlyCost: 2800 },
        { role: 'Owner / Manager', count: 1, monthlyCost: 4000 }
      ],
      opex: [
        { name: 'Rent / Lease', monthly: 3000 },
        { name: 'Utilities', monthly: 400 },
        { name: 'Insurance', monthly: 250 },
        { name: 'Marketing', monthly: 600, growthRate: 3 },
        { name: 'Store fixtures & display', monthly: 100 },
        { name: 'POS & Software', monthly: 100 }
      ],
      capex: [
        { name: 'Initial inventory', amount: 20000, month: 0 },
        { name: 'Store fit-out', amount: 10000, month: 0 }
      ],
      startingCash: 40000,
      kpiLabels: {
        units: 'items sold',
        revenue: 'sales',
        customers: 'shoppers'
      }
    },

    service: {
      label: 'Service / Consulting',
      currency: '$',
      revenueStreams: [
        {
          name: 'Client services',
          type: 'hourly',
          unitPrice: 80,
          unitsPerMonth: 120,        // ~30 hrs/week billable
          growthRate: 3,
          cogsPerUnit: 0,
          cogsPct: 0,
          seasonality: [0.9, 0.95, 1.0, 1.0, 1.05, 1.0, 0.8, 0.85, 1.05, 1.1, 1.1, 0.8]
        }
      ],
      staff: [
        { role: 'Owner / Founder', count: 1, monthlyCost: 5000 },
        { role: 'Associate / Contractor', count: 1, monthlyCost: 4000 }
      ],
      opex: [
        { name: 'Office / Coworking', monthly: 500 },
        { name: 'Insurance', monthly: 200 },
        { name: 'Marketing', monthly: 400, growthRate: 3 },
        { name: 'Software & Tools', monthly: 200 },
        { name: 'Travel', monthly: 300 },
        { name: 'Professional development', monthly: 150 }
      ],
      capex: [
        { name: 'Laptop & equipment', amount: 3000, month: 0 }
      ],
      startingCash: 15000,
      kpiLabels: {
        units: 'billable hours',
        revenue: 'fees',
        customers: 'clients'
      }
    },

    saas: {
      label: 'Software / SaaS',
      currency: '$',
      revenueStreams: [
        {
          name: 'Monthly subscriptions',
          type: 'recurring',
          unitPrice: 29,
          unitsPerMonth: 50,         // starting subscribers
          growthRate: 8,             // monthly subscriber growth %
          churnRate: 5,              // monthly churn %
          cogsPerUnit: 2,            // hosting per user
          cogsPct: 0,
          seasonality: null
        },
        {
          name: 'Annual plans',
          type: 'recurring',
          unitPrice: 24,             // discounted monthly equivalent
          unitsPerMonth: 20,
          growthRate: 6,
          churnRate: 2,              // annual churn (monthly equiv)
          cogsPerUnit: 2,
          cogsPct: 0,
          seasonality: null
        }
      ],
      staff: [
        { role: 'Developer', count: 2, monthlyCost: 7000 },
        { role: 'Founder / Product', count: 1, monthlyCost: 5000 },
        { role: 'Customer support', count: 1, monthlyCost: 3000 }
      ],
      opex: [
        { name: 'Hosting & Infrastructure', monthly: 500, growthRate: 5 },
        { name: 'Marketing & Ads', monthly: 1500, growthRate: 5 },
        { name: 'Software & Tools', monthly: 300 },
        { name: 'Office / Remote', monthly: 200 },
        { name: 'Legal & Compliance', monthly: 200 }
      ],
      capex: [],
      startingCash: 30000,
      kpiLabels: {
        units: 'subscribers',
        revenue: 'MRR',
        customers: 'users'
      }
    },

    ecommerce: {
      label: 'E-Commerce',
      currency: '$',
      revenueStreams: [
        {
          name: 'Online orders',
          type: 'unit',
          unitPrice: 45,
          unitsPerMonth: 200,
          growthRate: 6,
          cogsPerUnit: 7,            // shipping + packaging
          cogsPct: 40,               // product cost
          seasonality: [0.8, 0.75, 0.9, 0.95, 1.0, 1.0, 0.9, 0.9, 1.0, 1.1, 1.3, 1.5]
        }
      ],
      staff: [
        { role: 'Owner / Operator', count: 1, monthlyCost: 4000 },
        { role: 'Fulfillment', count: 1, monthlyCost: 2500 }
      ],
      opex: [
        { name: 'Platform fees (Shopify etc.)', monthly: 100 },
        { name: 'Marketing & Ads', monthly: 2000, growthRate: 5 },
        { name: 'Warehouse / Storage', monthly: 500 },
        { name: 'Software & Tools', monthly: 150 },
        { name: 'Returns & Refunds', monthly: 300, growthRate: 4 },
        { name: 'Insurance', monthly: 150 }
      ],
      capex: [
        { name: 'Initial inventory', amount: 10000, month: 0 },
        { name: 'Photography & Branding', amount: 2000, month: 0 }
      ],
      startingCash: 20000,
      kpiLabels: {
        units: 'orders',
        revenue: 'sales',
        customers: 'buyers'
      }
    },

    subscription: {
      label: 'Subscription / Membership',
      currency: '$',
      revenueStreams: [
        {
          name: 'Monthly memberships',
          type: 'recurring',
          unitPrice: 39,
          unitsPerMonth: 100,
          growthRate: 6,
          churnRate: 8,
          cogsPerUnit: 12,           // fulfillment cost per member
          cogsPct: 0,
          seasonality: [1.1, 0.95, 0.95, 1.0, 1.0, 0.9, 0.85, 0.9, 1.0, 1.05, 1.1, 1.2]
        }
      ],
      staff: [
        { role: 'Founder / Curator', count: 1, monthlyCost: 4000 },
        { role: 'Operations', count: 1, monthlyCost: 2800 }
      ],
      opex: [
        { name: 'Packaging & Shipping', monthly: 800, growthRate: 4 },
        { name: 'Platform & Tech', monthly: 200 },
        { name: 'Marketing', monthly: 1000, growthRate: 4 },
        { name: 'Content creation', monthly: 300 },
        { name: 'Insurance', monthly: 150 }
      ],
      capex: [
        { name: 'Initial sourcing', amount: 5000, month: 0 },
        { name: 'Branding & Design', amount: 2000, month: 0 }
      ],
      startingCash: 15000,
      kpiLabels: {
        units: 'members',
        revenue: 'recurring revenue',
        customers: 'members'
      }
    }
  };

  // Default scenario multipliers (shared across all types)
  var DEFAULT_SCENARIOS = {
    pessimistic: { revenueMult: 0.7, costMult: 1.1 },
    base:        { revenueMult: 1.0, costMult: 1.0 },
    optimistic:  { revenueMult: 1.3, costMult: 0.95 }
  };

  /**
   * Get full default config for a business type, ready for SimEngine.run()
   * @param {string} type - One of: restaurant, retail, service, saas, ecommerce, subscription
   * @returns {object} Complete simulation config
   */
  function getDefaults(type) {
    var tmpl = DEFAULTS[type] || DEFAULTS.service;
    var streams = tmpl.revenueStreams.map(function(rs, i) {
      return {
        id: 'rs' + (i + 1),
        name: rs.name,
        type: rs.type,
        unitPrice: rs.unitPrice,
        unitsPerMonth: rs.unitsPerMonth,
        growthRate: rs.growthRate,
        seasonality: rs.seasonality || null,
        cogsPerUnit: rs.cogsPerUnit || 0,
        cogsPct: rs.cogsPct || 0,
        churnRate: rs.churnRate || 0
      };
    });

    return {
      businessType: type,
      projectionMonths: 36,
      startingCash: tmpl.startingCash,
      revenueStreams: streams,
      staff: tmpl.staff.map(function(s) {
        return { role: s.role, count: s.count, monthlyCost: s.monthlyCost };
      }),
      opex: tmpl.opex.map(function(o) {
        return { name: o.name, monthly: o.monthly, growthRate: o.growthRate || 0 };
      }),
      capex: tmpl.capex.map(function(c) {
        return { name: c.name, amount: c.amount, month: c.month };
      }),
      scenario: 'base',
      scenarioMultipliers: JSON.parse(JSON.stringify(DEFAULT_SCENARIOS))
    };
  }

  /**
   * Get the KPI labels for a business type
   */
  function getKpiLabels(type) {
    var tmpl = DEFAULTS[type] || DEFAULTS.service;
    return tmpl.kpiLabels;
  }

  /**
   * Get the template for a specific type (for UI display of available options)
   */
  function getTemplate(type) {
    return DEFAULTS[type] || DEFAULTS.service;
  }

  /**
   * List all available business types
   */
  function listTypes() {
    var result = [];
    for (var key in DEFAULTS) {
      result.push({ id: key, label: DEFAULTS[key].label });
    }
    return result;
  }

  /**
   * Build a config from wizard data + canvas data, using type defaults to fill gaps.
   * This bridges the existing BMT data model to the simulation engine.
   *
   * @param {object} business - from Store.getBusiness()
   * @param {object} canvas - from Store.getCanvas()
   * @param {object} [overrides] - user-provided financial details from wizard
   * @returns {object} simulation config
   */
  function buildConfigFromWizard(business, canvas, overrides) {
    var type = (business && business.type) || 'service';
    var config = getDefaults(type);
    overrides = overrides || {};

    // Apply user-provided business name context
    if (business && business.name) {
      config.businessName = business.name;
    }

    // Map revenue range to starting cash estimate
    if (business && business.revenueRange) {
      var rangeMap = {
        'Pre-revenue': 5000,
        '$0 - $1K': 8000,
        '$1K - $5K': 15000,
        '$5K - $20K': 30000,
        '$20K - $50K': 60000,
        '$50K - $100K': 100000,
        '$100K+': 200000
      };
      if (!overrides.startingCash && rangeMap[business.revenueRange]) {
        config.startingCash = rangeMap[business.revenueRange];
      }
    }

    // Map canvas revenue streams if available
    if (canvas && canvas.revenueStreams && canvas.revenueStreams.length > 0) {
      // Use canvas items as names, keep type defaults for numbers
      var baseStreams = config.revenueStreams;
      config.revenueStreams = canvas.revenueStreams.map(function(cs, i) {
        var base = baseStreams[i] || baseStreams[0];
        return {
          id: cs.id || ('rs' + (i + 1)),
          name: cs.text || base.name,
          type: base.type,
          unitPrice: base.unitPrice,
          unitsPerMonth: base.unitsPerMonth,
          growthRate: base.growthRate,
          seasonality: base.seasonality,
          cogsPerUnit: base.cogsPerUnit,
          cogsPct: base.cogsPct,
          churnRate: base.churnRate || 0
        };
      });
    }

    // Map canvas cost structure to opex if available
    if (canvas && canvas.costStructure && canvas.costStructure.length > 0) {
      var baseOpex = config.opex;
      config.opex = canvas.costStructure.map(function(cs, i) {
        // Try to match with a default by name similarity
        var match = null;
        var csText = (cs.text || '').toLowerCase();
        var csFirst = csText.split(' ')[0];
        if (csFirst) {
          for (var j = 0; j < baseOpex.length; j++) {
            var opexFirst = baseOpex[j].name.toLowerCase().split(' ')[0];
            if (baseOpex[j].name.toLowerCase().indexOf(csFirst) >= 0 ||
                csText.indexOf(opexFirst) >= 0) {
              match = baseOpex[j];
              break;
            }
          }
        }
        return {
          name: cs.text,
          monthly: match ? match.monthly : 300,
          growthRate: match ? (match.growthRate || 0) : 0
        };
      });
    }

    // Apply any direct overrides
    if (overrides.startingCash != null) config.startingCash = overrides.startingCash;
    if (overrides.projectionMonths) config.projectionMonths = overrides.projectionMonths;
    if (overrides.revenueStreams) config.revenueStreams = overrides.revenueStreams;
    if (overrides.staff) config.staff = overrides.staff;
    if (overrides.opex) config.opex = overrides.opex;
    if (overrides.capex) config.capex = overrides.capex;

    return config;
  }

  return {
    getDefaults: getDefaults,
    getKpiLabels: getKpiLabels,
    getTemplate: getTemplate,
    listTypes: listTypes,
    buildConfigFromWizard: buildConfigFromWizard,
    DEFAULTS: DEFAULTS,
    DEFAULT_SCENARIOS: DEFAULT_SCENARIOS
  };
})();
