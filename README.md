# iChef

A personal cooking web app. Maintain a pantry of what you have, find recipes you can actually make, and keep your pantry up to date after cooking.

## What it does

- **Pantry tracking** — add ingredients you own, mark them Have/Out, group by category.
- **Grocery run** — paste a whole list at once (newlines or commas), preview the parsed items with guessed categories, then add them all. Export your pantry back out as a plain list (clipboard or `.txt`).
- **Recipe search** — breakfast / lunch / dinner recipes from [Spoonacular](https://spoonacular.com/food-api), ranked by how many pantry items they use.
  - **Strict**: only recipes you can make right now. **Flexible**: all matches, fewest missing first.
  - Filter by **cuisine** and **diet** (vegetarian, vegan, gluten free, …), exclude **intolerances**, or group results by cuisine.
- **See more / less like this** — 👍 / 👎 any recipe; iChef learns your cuisine and dish-type tastes and re-ranks future results (👎 hides the recipe).
- **Favorites** — ⭐ recipes into a Favorites tab that works offline (no API calls).
- **Shopping list** — one tap adds a recipe's missing ingredients; check items off while shopping, then move them straight into the pantry.
- **Cooked this** — open a recipe, tap "I cooked this!", mark which ingredients you used up; every cook is logged to a **History** tab with "Cook again".
- **Light & dark themes** — warm-cozy light mode, modern-dark-kitchen dark mode; follows your OS or toggle manually.
- **Cross-device sync (optional)** — share one household via a secret code, backed by Firebase Firestore with live updates. Works fully offline/local without it.

## Stack

- **Frontend:** vanilla HTML / CSS / ES modules, no build step.
- **Backend:** Vercel serverless functions in `api/` (Node.js, no dependencies — uses built-in `fetch`).
- **Storage:** browser `localStorage` by default; optional Firebase Firestore for cross-device sync (`SETUP.md` §7).
- **Recipe data:** Spoonacular API, called server-side so the key stays out of the browser. Responses are CDN- and session-cached to respect the free-tier quota.

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
│   ├── recipes.js             # GET  /api/recipes   → recipe list (cuisine/diet filters)
│   ├── recipe/[id].js         # GET  /api/recipe/:id → full info
│   └── autocomplete.js        # GET  /api/autocomplete?q=…
├── index.html                 # static entry (theme set pre-paint)
├── styles/main.css            # design tokens + both themes
├── src/
│   ├── main.js                # bootstrap, tabs, hash routing
│   ├── config.js              # optional Firebase config
│   ├── api/
│   │   ├── backend.js         # client for /api/* (+ sessionStorage cache)
│   │   └── recipes.js         # higher-level recipe service
│   ├── lib/
│   │   └── rank.js            # taste-based result re-ranking
│   ├── state/                 # cache + subscribe modules over storage
│   │   ├── pantry.js          # categories, guessing, bulk add
│   │   ├── shopping.js        # shopping list
│   │   ├── favorites.js       # starred recipes (denormalized)
│   │   ├── history.js         # cooking log
│   │   ├── taste.js           # 👍/👎 preference scores
│   │   ├── settings.js        # persisted recipe filters
│   │   └── backend.js         # /api/health configured-ness
│   ├── storage/
│   │   ├── index.js           # adapter facade + sync lifecycle
│   │   ├── localStorage.js    # default adapter
│   │   └── firestore.js       # Firestore adapter (household-code sync)
│   └── ui/
│       ├── common.js          # el(), modal, toast, debounce
│       ├── theme.js           # light/dark toggle
│       ├── sync.js            # household-code sync modal
│       ├── pantry.js          # pantry page + grocery run + export
│       ├── recipes.js         # discover/favorites, filters, cards
│       ├── recipeDetail.js    # detail modal + "I cooked this!"
│       ├── shopping.js        # shopping list page
│       └── history.js         # cooking history page
├── package.json
├── vercel.json
├── .env.local.example
├── SETUP.md
└── README.md
```

## Hosting

Designed for Vercel (free tier). Deploys from GitHub repo or directly via `vercel deploy --prod`. See `SETUP.md`.
