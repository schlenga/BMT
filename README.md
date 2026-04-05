# OxO — Business Model Simulator v3

Strategic 5-year business model simulator for OxO consulting.

## Quick Start

```bash
cd oxo-tracker
npm install    # only needed first time
npm start
```

Open **http://localhost:3000**

If migrating from v2, delete the old `oxo-data.sqlite` first (or let it auto-migrate your opportunities into archetypes).

## What Changed: Simulator, Not CRM

This is no longer a CRM for tracking individual deals. It's a **strategic simulator** that answers:

- Given a mix of engagement types, what does OxO look like at scale?
- How many people do we need to hire, and when?
- How many leads must the sales funnel produce?
- What's the revenue at risk if gain-share doesn't pay out?
- When does guaranteed revenue cover fixed costs?

## Core Concepts

**Engagement Archetypes** — types of engagements (not individual deals). E.g. "Mid-market 6-month transformation" or "PE post-merger sprint". Each has a delivery model, pricing, and a volume plan (how many per year, years 1–5).

**Project Delivery Model** — every archetype follows the structured OxO delivery: kickoff retreat → weekly check-ins → monthly workshops → quarterly offsites → closing workshop. Costs are calculated automatically.

**Two Pricing Models** — per archetype: Base+Upside (base fee + gain-share) or Outcome-Based Fixed (% of client upside as fixed price).

**5-Year Simulation** — the simulator projects revenue, costs, profit, cash, team size, hiring needs, capacity utilization, sales funnel requirements, and downside scenarios across 5 years.

**Growth Model** — win rate, repeat rate, referral rate, sales cycle, utilization target. These drive how many cold leads you need and when hiring triggers.

## Tabs

1. **5-Year Projection** — the main view. Revenue, profit, team evolution, sales funnel.
2. **Engagement Archetypes** — define and tune your engagement types.
3. **Cost Structure** — team, salaries, overhead, growth parameters.
4. **Scaling & Capacity** — flywheel dynamics, capacity constraints, unit economics, worst-case scenarios.
