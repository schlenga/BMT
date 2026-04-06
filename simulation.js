// simulation.js — Core business simulation engine (pure calculations, no DOM)
'use strict';

var SimEngine = (function() {

  // ── Month label helper ──
  var MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function monthLabel(monthIndex, startDate) {
    // monthIndex is 0-based (month 0 = first month)
    var d = startDate || new Date();
    var m = (d.getMonth() + monthIndex) % 12;
    var y = d.getFullYear() + Math.floor((d.getMonth() + monthIndex) / 12);
    return MONTH_NAMES[m] + ' ' + y;
  }

  // ── Revenue calculation for a single stream in a given month ──
  function calcStreamRevenue(stream, monthIndex, scenarioMult) {
    var mult = scenarioMult || 1.0;
    var seasonMult = 1.0;
    if (stream.seasonality && stream.seasonality.length === 12) {
      seasonMult = stream.seasonality[monthIndex % 12];
    }

    var units, revenue, cogs;

    if (stream.type === 'recurring') {
      // Recurring: subscribers grow by growthRate%, reduced by churnRate%
      // We track subscriber count via compounding
      var monthlyGrowth = (stream.growthRate || 0) / 100;
      var monthlyChurn = (stream.churnRate || 0) / 100;
      var netGrowth = 1 + monthlyGrowth - monthlyChurn;
      units = stream.unitsPerMonth * Math.pow(netGrowth, monthIndex) * seasonMult * mult;
      units = Math.max(0, Math.round(units));
      revenue = units * stream.unitPrice;
      cogs = units * (stream.cogsPerUnit || 0);
      if (stream.cogsPct) {
        cogs += revenue * stream.cogsPct / 100;
      }
    } else {
      // unit, hourly, project — all volume-based with compound growth
      var monthlyGrowthRate = (stream.growthRate || 0) / 100;
      units = stream.unitsPerMonth * Math.pow(1 + monthlyGrowthRate, monthIndex) * seasonMult * mult;
      units = Math.max(0, Math.round(units));
      revenue = units * stream.unitPrice;
      cogs = units * (stream.cogsPerUnit || 0);
      if (stream.cogsPct) {
        cogs += revenue * stream.cogsPct / 100;
      }
    }

    return {
      id: stream.id,
      name: stream.name,
      type: stream.type,
      units: units,
      revenue: Math.round(revenue * 100) / 100,
      cogs: Math.round(cogs * 100) / 100
    };
  }

  // ── Staff cost for a given month ──
  function calcStaffCost(staffList, monthIndex) {
    var totalCost = 0;
    var headcount = 0;

    for (var i = 0; i < staffList.length; i++) {
      var s = staffList[i];
      var count = s.count || 0;

      // Simple growth trigger: hire +1 every N months
      if (s.hireEveryMonths && s.hireEveryMonths > 0 && monthIndex > 0) {
        count += Math.floor(monthIndex / s.hireEveryMonths);
      }

      totalCost += count * (s.monthlyCost || 0);
      headcount += count;
    }

    return { cost: Math.round(totalCost * 100) / 100, headcount: headcount };
  }

  // ── Opex for a given month ──
  function calcOpex(opexList, monthIndex, scenarioMult) {
    var costMult = scenarioMult || 1.0;
    var total = 0;

    for (var i = 0; i < opexList.length; i++) {
      var o = opexList[i];
      var monthlyGrowth = (o.growthRate || 0) / 100;
      var cost = (o.monthly || 0) * Math.pow(1 + monthlyGrowth, monthIndex) * costMult;
      total += cost;
    }

    return Math.round(total * 100) / 100;
  }

  // ── Capex for a given month ──
  function calcCapex(capexList, monthIndex) {
    var total = 0;
    for (var i = 0; i < capexList.length; i++) {
      if ((capexList[i].month || 0) === monthIndex) {
        total += capexList[i].amount || 0;
      }
    }
    return Math.round(total * 100) / 100;
  }

  // ── Project a single month ──
  function projectMonth(config, monthIndex, prevCash) {
    var sc = config.scenarioMultipliers || {};
    var scenario = sc[config.scenario] || { revenueMult: 1.0, costMult: 1.0 };
    var revMult = scenario.revenueMult || 1.0;
    var costMult = scenario.costMult || 1.0;

    // Revenue
    var revenueByStream = [];
    var totalRevenue = 0;
    var totalCogs = 0;

    var streams = config.revenueStreams || [];
    for (var i = 0; i < streams.length; i++) {
      var sr = calcStreamRevenue(streams[i], monthIndex, revMult);
      revenueByStream.push(sr);
      totalRevenue += sr.revenue;
      totalCogs += sr.cogs;
    }

    // Costs
    var grossProfit = totalRevenue - totalCogs;
    var grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    var staffResult = calcStaffCost(config.staff || [], monthIndex);
    var staffCost = staffResult.cost * costMult;
    var headcount = staffResult.headcount;

    var opex = calcOpex(config.opex || [], monthIndex, costMult);
    var capex = calcCapex(config.capex || [], monthIndex);

    var totalFixedCosts = staffCost + opex;
    var ebitda = grossProfit - totalFixedCosts;
    var netIncome = ebitda - capex;

    var cashBalance = (prevCash || 0) + netIncome;

    // KPIs
    var revenuePerHead = headcount > 0 ? totalRevenue / headcount : 0;
    var burnRate = netIncome < 0 ? Math.abs(netIncome) : 0;
    var runway = burnRate > 0 && cashBalance > 0 ? cashBalance / burnRate : (cashBalance > 0 ? 999 : 0);

    return {
      month: monthIndex + 1,
      label: monthLabel(monthIndex),
      revenue: Math.round(totalRevenue * 100) / 100,
      revenueByStream: revenueByStream,
      cogs: Math.round(totalCogs * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossMargin: Math.round(grossMargin * 10) / 10,
      staffCost: Math.round(staffCost * 100) / 100,
      opex: Math.round(opex * 100) / 100,
      totalFixedCosts: Math.round(totalFixedCosts * 100) / 100,
      capex: Math.round(capex * 100) / 100,
      ebitda: Math.round(ebitda * 100) / 100,
      netIncome: Math.round(netIncome * 100) / 100,
      cashBalance: Math.round(cashBalance * 100) / 100,
      headcount: headcount,
      revenuePerHead: Math.round(revenuePerHead),
      burnRate: Math.round(burnRate),
      runway: Math.round(runway * 10) / 10
    };
  }

  // ── Roll up months into annual summary ──
  function rollupYear(months, yearNum) {
    var startIdx = (yearNum - 1) * 12;
    var endIdx = Math.min(yearNum * 12, months.length);
    var yearMonths = months.slice(startIdx, endIdx);

    if (yearMonths.length === 0) return null;

    var revenue = 0, cogs = 0, staffCost = 0, opex = 0, capex = 0;
    var lastMonth = yearMonths[yearMonths.length - 1];

    for (var i = 0; i < yearMonths.length; i++) {
      var m = yearMonths[i];
      revenue += m.revenue;
      cogs += m.cogs;
      staffCost += m.staffCost;
      opex += m.opex;
      capex += m.capex;
    }

    var grossProfit = revenue - cogs;
    var netIncome = grossProfit - staffCost - opex - capex;

    return {
      year: yearNum,
      months: yearMonths.length,
      revenue: Math.round(revenue),
      cogs: Math.round(cogs),
      grossProfit: Math.round(grossProfit),
      grossMargin: revenue > 0 ? Math.round(grossProfit / revenue * 1000) / 10 : 0,
      staffCost: Math.round(staffCost),
      opex: Math.round(opex),
      capex: Math.round(capex),
      netIncome: Math.round(netIncome),
      netMargin: revenue > 0 ? Math.round(netIncome / revenue * 1000) / 10 : 0,
      cashBalance: Math.round(lastMonth.cashBalance),
      headcount: lastMonth.headcount
    };
  }

  // ── Calculate summary KPIs from monthly data ──
  function calcKPIs(months, config) {
    if (!months.length) return {};

    var breakEvenMonth = null;
    var lowestCash = config.startingCash || 0;
    var totalCapex = 0;

    // Track cumulative profitability (monthly net income turning positive)
    for (var i = 0; i < months.length; i++) {
      var m = months[i];
      totalCapex += m.capex;
      if (m.cashBalance < lowestCash) {
        lowestCash = m.cashBalance;
      }
      // Break-even = first month where net income is positive AND stays positive for 2 more months
      if (breakEvenMonth === null && m.netIncome > 0) {
        var sustained = true;
        for (var j = i + 1; j < Math.min(i + 3, months.length); j++) {
          if (months[j].netIncome <= 0) { sustained = false; break; }
        }
        if (sustained) breakEvenMonth = m.month;
      }
    }

    var first = months[0];
    var last = months[months.length - 1];
    var y1End = months.length >= 12 ? months[11] : last;
    var y3End = months.length >= 36 ? months[35] : last;

    // Sum year 1 and year 3 revenue
    var y1Revenue = 0, y3Revenue = 0;
    for (var i = 0; i < months.length; i++) {
      if (i < 12) y1Revenue += months[i].revenue;
      if (i >= 24 && i < 36) y3Revenue += months[i].revenue;
    }

    // Average gross margin
    var totalGM = 0;
    for (var i = 0; i < months.length; i++) totalGM += months[i].grossMargin;
    var avgGrossMargin = Math.round(totalGM / months.length * 10) / 10;

    return {
      breakEvenMonth: breakEvenMonth,
      peakCashNeeded: Math.round(Math.abs(Math.min(0, lowestCash))),
      peakCashDeficit: Math.round(lowestCash),
      monthlyBurnAtStart: first.burnRate,
      year1Revenue: Math.round(y1Revenue),
      year1Net: Math.round(y1End.cashBalance - (config.startingCash || 0)),
      year3Revenue: Math.round(y3Revenue),
      year3CashBalance: Math.round(y3End.cashBalance),
      avgGrossMargin: avgGrossMargin,
      totalCapex: Math.round(totalCapex),
      finalHeadcount: last.headcount,
      finalMonthlyRevenue: Math.round(last.revenue),
      finalMonthlyNet: Math.round(last.netIncome)
    };
  }

  // ── Main entry point: run a complete simulation ──
  function run(config) {
    config = config || {};
    var numMonths = Math.min(Math.max(config.projectionMonths || 36, 6), 120);
    var startingCash = config.startingCash || 0;

    // Project all months
    var months = [];
    var prevCash = startingCash;

    for (var i = 0; i < numMonths; i++) {
      var m = projectMonth(config, i, prevCash);
      months.push(m);
      prevCash = m.cashBalance;
    }

    // Roll up years
    var numYears = Math.ceil(numMonths / 12);
    var years = [];
    for (var y = 1; y <= numYears; y++) {
      var yr = rollupYear(months, y);
      if (yr) years.push(yr);
    }

    // KPIs
    var summary = calcKPIs(months, config);

    return {
      months: months,
      years: years,
      summary: summary,
      config: config
    };
  }

  // ── Run all three scenarios at once ──
  function runScenarios(baseConfig) {
    var scenarios = ['pessimistic', 'base', 'optimistic'];
    var results = {};

    for (var i = 0; i < scenarios.length; i++) {
      var cfg = JSON.parse(JSON.stringify(baseConfig));
      cfg.scenario = scenarios[i];
      results[scenarios[i]] = run(cfg);
    }

    return results;
  }

  // ── Currency formatter ──
  function currency(val, symbol) {
    symbol = symbol || '$';
    if (val == null || isNaN(val)) return symbol + '0';
    var abs = Math.abs(val);
    var sign = val < 0 ? '-' : '';
    if (abs >= 1e6) return sign + symbol + (abs / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return sign + symbol + (abs / 1e3).toFixed(1) + 'K';
    return sign + symbol + Math.round(abs);
  }

  function pct(val) {
    return (val || 0).toFixed(1) + '%';
  }

  // ── Public API ──
  return {
    run: run,
    runScenarios: runScenarios,
    projectMonth: projectMonth,
    rollupYear: rollupYear,
    calcKPIs: calcKPIs,
    currency: currency,
    pct: pct
  };
})();
