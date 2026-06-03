# iChef

A personal cooking web app. Maintain a pantry of what you have, find recipes you can actually make, and keep your pantry up to date after cooking.

## What it does

- **Pantry tracking** — add ingredients you own, mark them Have/Out, group by category.
- **Grocery run** — bulk-add many ingredients at once after a shop.
- **Recipe search** — breakfast / lunch / dinner recipes from [Spoonacular](https://spoonacular.com/food-api), ranked by how many pantry items they use.
  - **Strict**: only recipes you can make right now.
  - **Flexible**: all matches, sorted by fewest missing ingredients.
- **Cooked this** — open a recipe, tap "I cooked this!", and mark which ingredients you used up.

## Stack

- **Frontend:** vanilla HTML / CSS / ES modules, no build step.
- **Backend:** Vercel serverless functions in `api/` (Node.js, no dependencies — uses built-in `fetch`).
- **Storage:** browser `localStorage` for the pantry. Optional upgrades documented in `SETUP.md`.
- **Recipe data:** Spoonacular API, called server-side so the key stays out of the browser.

## Quick start

See `SETUP.md` for the full walkthrough. Short version:

```powershell
# After installing Node.js and the Vercel CLI:
copy .env.local.example .env.local
# edit .env.local — paste your Spoonacular API key
vercel link
vercel dev
```

Open <http://localhost:3000>.

## Project layout

```
ichef/
├── api/                       # Vercel serverless functions
│   ├── health.js              # GET  /api/health    → { configured: bool }
│   ├── recipes.js             # GET  /api/recipes   → recipe list
│   ├── recipe/[id].js         # GET  /api/recipe/:id → full info
│   └── autocomplete.js        # GET  /api/autocomplete?q=…
├── index.html                 # static entry
├── styles/main.css
├── src/
│   ├── main.js                # bootstrap + tab switching
│   ├── config.js              # optional Firebase config (storage upgrade)
│   ├── api/
│   │   ├── backend.js         # client for /api/*
│   │   └── recipes.js         # higher-level recipe service
│   ├── state/
│   │   ├── pantry.js          # pantry state + change events
│   │   └── backend.js         # tracks /api/health configured-ness
│   ├── storage/
│   │   ├── index.js           # active adapter (switch here)
│   │   ├── localStorage.js
│   │   └── firestore.js       # stub for optional client-direct sync
│   └── ui/
│       ├── common.js          # el(), modal, toast, debounce
│       ├── pantry.js
│       ├── recipes.js
│       └── recipeDetail.js
├── package.json
├── vercel.json
├── .env.local.example
├── .gitignore
├── SETUP.md
└── README.md
```

## Hosting

Designed for Vercel (free tier). Deploys from your GitHub repo or directly via `vercel deploy --prod`. See `SETUP.md`.
