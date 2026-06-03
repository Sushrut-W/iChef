# iChef — Handoff to Laptop A

You've scaffolded iChef on Laptop B with Claude Code. This document walks you through finishing setup and deploying on Laptop A (which has Node.js / npm but no Claude Code). Read top to bottom — each step builds on the previous.

> ⏱️ Total time: ~15 minutes if you don't hit snags.

---

## 0. Before you leave Laptop B — zip the project

In Windows Explorer on Laptop B:

1. Navigate to `C:\Users\SushrutWarekar\iChef` (the parent folder).
2. Right-click the `iChef` folder → **Send to → Compressed (zipped) folder**.
3. You'll get `iChef.zip` (~50–100 KB). Transfer it to Laptop A any way you like (USB, OneDrive, email, etc.).

Nothing to exclude — the project has no `node_modules` or `.vercel` folders yet.

---

## 1. On Laptop A — extract + sanity check

1. Extract `iChef.zip` somewhere convenient (e.g. `C:\Users\<you>\Projects\iChef`).
2. Open a terminal (**PowerShell** recommended on Windows; commands below assume PowerShell).
3. `cd` into the project:

   ```powershell
   cd C:\Users\<you>\Projects\iChef
   ```

4. Verify your tools are good to go:

   ```powershell
   node --version    # expect v18.x or newer (v20+ ideal)
   npm --version     # expect 9.x or newer
   git --version     # any recent version is fine
   ```

   If `node` shows v17 or older, download a newer LTS from <https://nodejs.org>.

> **Heads up:** You do **not** need to run `npm install`. iChef has no npm dependencies — the serverless API functions only use Node's built-in `fetch`.

---

## 2. Get your Spoonacular API key

Skip this if you already have one.

1. Sign up at <https://spoonacular.com/food-api> → "Start Now".
2. Profile → **Show/Hide API Key** → copy.
3. Free tier: ~150 calls/day, more than enough for personal use.

---

## 3. Install the Vercel CLI

```powershell
npm install -g vercel
```

Verify:

```powershell
vercel --version
```

If `vercel` isn't found after install: close and reopen your terminal. PATH needs to refresh.

---

## 4. Sign up for Vercel

1. Go to <https://vercel.com/signup> → **Continue with GitHub** → authorize.
2. That's it. You won't connect a repo until step 8 (optional).

---

## 5. Create your local env file

From the iChef folder:

```powershell
Copy-Item .env.local.example .env.local
notepad .env.local
```

In Notepad, replace `paste-your-key-here` with your Spoonacular key and save. The file should look like:

```
SPOONACULAR_API_KEY=abc123yourkeyhere
```

`.env.local` is already in `.gitignore` — your key never gets committed.

---

## 6. Link the folder to a Vercel project

```powershell
vercel login
```

(Opens a browser → log in with the GitHub account from step 4 → terminal confirms.)

```powershell
vercel link
```

When prompted:

| Prompt | Answer |
|---|---|
| Set up and develop "C:\…\iChef"? | **Y** |
| Which scope should contain your project? | your personal account |
| Link to existing project? | **N** |
| What's your project's name? | `ichef` (or whatever you like) |
| In which directory is your code located? | press **Enter** (default `./`) |
| Want to modify these settings? | **N** |

This creates a `.vercel/` folder (gitignored) that remembers your project ID.

---

## 7. Run it locally

```powershell
vercel dev
```

You'll see something like:

```
> Ready! Available at http://localhost:3000
```

Open <http://localhost:3000>:

- **Pantry tab** → add a few ingredients (eggs, milk, flour, butter, sugar). Toggle Have/Out. Refresh — they persist.
- **Find Recipes tab** → pick Breakfast → see recipes. Toggle Strict ⟷ Flexible.
- Click a recipe → see details → "I cooked this!" → toggle eggs to Out → save → check the Pantry tab.

If the yellow "Server isn't configured" banner shows, the API key didn't load — re-check `.env.local` and restart `vercel dev` (Ctrl+C, run again).

---

## 8. Deploy to production

When you're happy with how it works locally:

```powershell
# Add your API key to Vercel's production environment
vercel env add SPOONACULAR_API_KEY production
# Paste your key when prompted

# Deploy
vercel deploy --prod
```

You'll get a URL like `https://ichef-yourname.vercel.app`. That's your live site, accessible from any device.

> **Note:** Setting the env var in `.env.local` only affects local dev. Production needs it set separately via `vercel env add` or the Vercel dashboard.

---

## 9. (Optional) Connect a GitHub repo for auto-deploy

If you want every `git push` to deploy automatically:

```powershell
git init
git add .
git commit -m "Initial iChef commit"

# Create a new repo on GitHub (any name), then:
git remote add origin https://github.com/<your-username>/<repo>.git
git branch -M main
git push -u origin main
```

Then on Vercel:

1. <https://vercel.com/dashboard> → **Add New… → Project** → import the repo.
2. Don't change build settings (defaults are correct).
3. Under **Environment Variables**, add `SPOONACULAR_API_KEY` → your key.
4. Click **Deploy**.

After this, `git push` triggers a deploy. PR branches get preview URLs.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `vercel: command not found` | Restart terminal, or use `npx vercel` instead |
| Recipes page shows "Backend not configured" | `.env.local` is missing the key, or you didn't restart `vercel dev` after editing it |
| `vercel dev` errors with "no project linked" | Run `vercel link` first |
| Port 3000 already in use | Run `vercel dev --listen 3001` |
| Recipe images don't load | Spoonacular sometimes returns broken image URLs — not your bug |
| `vercel env add` says "Environment variable already exists" | Use `vercel env rm SPOONACULAR_API_KEY production` first, then re-add |
| "Too many requests" from Spoonacular | You hit the 150/day free-tier limit — wait a day or upgrade |

---

## Project layout (so you can find things)

```
iChef/
├── api/                       Serverless backend (Vercel functions)
│   ├── health.js
│   ├── recipes.js
│   ├── recipe/[id].js
│   └── autocomplete.js
├── src/                       Frontend (vanilla JS, no build step)
│   ├── api/                   Client for /api/*
│   ├── state/                 Pantry state + backend health
│   ├── storage/               localStorage adapter (Firestore stub)
│   ├── ui/                    Page renderers
│   ├── config.js
│   └── main.js
├── styles/main.css
├── index.html                 Entry HTML
├── package.json
├── vercel.json
├── .env.local.example
├── .gitignore
├── README.md
├── SETUP.md                   General setup doc (this file is the Laptop-A-specific one)
└── LAPTOP_A_HANDOFF.md        This file
```

---

## What's done vs what's left

**Done:**
- Full frontend (pantry, recipe browsing, detail view, "I cooked this!" flow)
- Serverless backend that hides the Spoonacular API key
- Strict / Flexible recipe modes
- Grocery-run bulk add
- All Vercel config and scripts

**Left (optional, on you):**
- Cross-device pantry sync (currently localStorage). See **SETUP.md → section 7** for Vercel KV, Postgres, or Firestore options. None of these are required — the app is fully functional without them.
- Custom domain (optional, Vercel dashboard → Settings → Domains).

---

## If something is broken and you can't figure it out

You're on a laptop without Claude Code, so you'll need to debug yourself or wait until you're back on Laptop B. A few resources:

- Browser DevTools → Console — catches all client-side errors.
- Vercel logs: `vercel logs` from the project folder, or in the dashboard under your project → **Logs**.
- Spoonacular API docs: <https://spoonacular.com/food-api/docs>.

When you do come back to Laptop B, just zip the `iChef/` folder again (skip `node_modules` and `.vercel/`) and Claude Code can pick up wherever you left off.
