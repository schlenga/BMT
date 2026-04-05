# BMT — Business Model Tracker

An interactive business model designer and tracker for small and medium businesses, built on Lean Startup methodology. Design your business model through a guided wizard, visualize it on a Business Model Canvas, and track testable hypotheses with real data.

## Features

- **Guided Wizard** — Answer simple questions about your business idea, customers, revenue, and costs. The app infers your business type and auto-generates a complete business model canvas with testable hypotheses.
- **Business Model Canvas** — Interactive 9-element canvas (Customer Segments, Value Proposition, Channels, Relationships, Revenue Streams, Key Resources, Activities, Partners, Cost Structure). Click to edit, add, or remove items.
- **Hypothesis Tracker** — Lean Startup-style hypothesis testing. Each assumption gets a target metric. Log actual data over time, see progress bars and sparklines, and mark hypotheses as validated, invalidated, or pivoted.
- **Smart Inference** — Keyword-based business type detection suggests relevant customer segments, channels, revenue models, and costs for any business.
- **No backend required** — Everything runs in the browser using localStorage. No accounts, no server, no database.

## Run Locally

Just open the file in your browser — no build step, no server needed:

```bash
open index.html
# or on Linux:
xdg-open index.html
```

Or use any static file server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy on GitHub Pages

1. Push the repository to GitHub.
2. Go to **Settings → Pages** in your GitHub repository.
3. Under **Source**, select **Deploy from a branch**.
4. Set the branch to `main` (or your branch) and the folder to `/ (root)`.
5. Click **Save**.
6. Your site will be live at `https://<username>.github.io/BMT/` within a few minutes.

## Test It

1. **First visit** → The wizard starts automatically. Walk through all 8 steps.
2. **Canvas** → After the wizard, click "Canvas" in the nav. You should see your business model laid out in the standard BMC grid. Click items to edit, use "+ Add" to add new ones.
3. **Tracker** → Click "Tracker" in the nav. You'll see auto-generated hypotheses with targets. Click "Log Data" on any hypothesis to enter actual metrics. Watch progress bars and sparklines update.
4. **Persistence** → Refresh the page. All data should persist via localStorage.
5. **Export/Import** → Go to Settings, click "Export Data" to download a JSON backup. Use "Import Data" to restore.
6. **Reset** → In Settings, "Reset Everything" clears all data and restarts the wizard.

## Tech Stack

- Vanilla HTML, CSS, JavaScript — no frameworks, no build tools
- localStorage for persistence
- Responsive design (works on mobile)
- Static site — deployable anywhere (GitHub Pages, Netlify, any web server)

## File Structure

```
index.html             # App shell + all CSS
app.js                 # Router, navigation, settings
wizard.js              # Onboarding wizard + inference engine
canvas.js              # Business Model Canvas view
tracker.js             # Hypothesis tracking dashboard
store.js               # localStorage persistence layer

archive/               # Original OxO consulting simulator (archived)
```

## Archive

The `archive/` folder contains the original OxO Business Model Simulator v3 — a Node.js + Express app with a 10-year P&L projection engine built specifically for a consulting firm. It served as the prototype and inspiration for this general-purpose tool.
