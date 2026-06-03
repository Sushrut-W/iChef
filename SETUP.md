# iChef setup

End-to-end setup with **Vercel** (hosting + serverless backend) and **Spoonacular** (recipes).

> Why Vercel and not GitHub Pages? We need a backend to hide the Spoonacular API key from the browser. Vercel gives us static hosting *and* serverless functions, deploys from a GitHub repo, and has a generous free tier.

## 1. One-time installs

- **Node.js LTS** — needed for `vercel dev` and `npx`.
  - Download <https://nodejs.org> → click the green **LTS** button → install with defaults.
  - **Restart your terminal**, then verify: `node --version` (should print `v20.x` or `v22.x`).

- **Vercel CLI**:

  ```powershell
  npm install -g vercel
  ```

  Then verify: `vercel --version`.

## 2. Get a Spoonacular API key

1. Sign up at <https://spoonacular.com/food-api> → "Start Now".
2. In your dashboard, click your profile → **Show/Hide API Key** → copy it.
3. The free tier allows ~150 calls/day, plenty for personal use.

## 3. Sign up for Vercel

1. Go to <https://vercel.com/signup> → **Continue with GitHub** → authorize.

## 4. Wire up local dev

From the iChef folder:

```powershell
# 1. Copy the example env file
copy .env.local.example .env.local

# 2. Open .env.local in any editor and paste your Spoonacular key
#    after SPOONACULAR_API_KEY=

# 3. Link this folder to a Vercel project (one-time)
vercel link

# 4. Run locally — serves static files + serverless functions on http://localhost:3000
vercel dev
```

The first time you run `vercel link`, the CLI will ask:
- "Set up and develop?" → Yes
- "Which scope?" → your personal account
- "Link to existing project?" → No
- "What's your project's name?" → `ichef` (or whatever you want)
- "In which directory is your code located?" → just hit Enter (current dir)

Open <http://localhost:3000> — recipes should work end-to-end.

## 5. Deploy to production

When you're happy with it:

```powershell
vercel deploy --prod
```

You'll get a URL like `https://ichef-yourname.vercel.app`. That's your live site.

You also need to add the API key to production env vars (separate from `.env.local`):

```powershell
vercel env add SPOONACULAR_API_KEY production
# paste your key when prompted
```

Then redeploy: `vercel deploy --prod`.

> Or do it in the dashboard: <https://vercel.com/dashboard> → your project → **Settings** → **Environment Variables**.

## 6. (Optional) Connect a GitHub repo for auto-deploy

If you'd rather push to GitHub and have Vercel deploy automatically:

1. Create a new repo on GitHub (private or public, your call), push this folder to it.
2. <https://vercel.com/dashboard> → **Add New… → Project** → select your repo.
3. Don't change any build settings — defaults are correct for this project.
4. **Environment Variables** → add `SPOONACULAR_API_KEY` → deploy.

After this, every `git push` to `main` triggers a deploy. PR branches get preview URLs.

## 7. (Optional) Cross-device pantry sync

The pantry currently lives in browser `localStorage` — single-device only. To sync across devices, you have a few options:

- **Vercel KV** (Redis-backed, simplest): <https://vercel.com/docs/storage/vercel-kv>. ~30k commands/month free. You'd move pantry operations into a new `/api/pantry` endpoint.
- **Vercel Postgres** (Neon-backed): <https://vercel.com/docs/storage/vercel-postgres>. SQL, free tier is generous.
- **Firebase Firestore**: see `src/storage/firestore.js` — there's a stub there with a template for the client-direct approach (older plan, predates the Vercel backend).

This isn't wired up yet — let me know when you want to add it and we'll pick one.

## Troubleshooting

- **`vercel dev` says "no project linked"** → run `vercel link` first.
- **Recipes page shows "Backend not configured"** → `.env.local` doesn't have `SPOONACULAR_API_KEY` set, or you didn't restart `vercel dev` after editing it.
- **CORS errors in the console** → shouldn't happen (same-origin); if you see them, you're probably loading `index.html` via `file://` instead of `vercel dev`.
- **`vercel: command not found`** after install → restart your terminal, or use `npx vercel` instead of `vercel`.
