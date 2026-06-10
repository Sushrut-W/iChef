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

> **Note:** recipe search works even with no API key at all — iChef ships with a built-in ~650-recipe catalog (TheMealDB) that's searched locally with zero quota. The Spoonacular key adds its 365k-recipe web search on top, merged into the same results.

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

## 7. (Optional) Cross-device sync with Firebase

Out of the box, everything (pantry, shopping list, favorites, history) lives in the browser's `localStorage` — fully functional, but single-device. To sync across devices, wire up the built-in Firestore support (~5 minutes, free tier):

### 7a. Create the Firebase project

1. Go to <https://console.firebase.google.com> → **Add project**.
2. Name it anything (e.g. `ichef`). **Disable Google Analytics** when asked (not needed). Create.

### 7b. Register a web app and grab the config

1. On the project overview page, click the **`</>` (Web)** icon → nickname it `iChef` → **don't** check Firebase Hosting → Register.
2. You'll see a `firebaseConfig = { apiKey: …, projectId: …, … }` code block. Copy just the object.
3. Open `src/config.js` and replace `export const FIREBASE_CONFIG = null;` with your object:

   ```js
   export const FIREBASE_CONFIG = {
     apiKey: 'AIza…',
     authDomain: 'ichef-xxxxx.firebaseapp.com',
     projectId: 'ichef-xxxxx',
     storageBucket: 'ichef-xxxxx.firebasestorage.app',
     messagingSenderId: '…',
     appId: '…',
   };
   ```

   This config is **safe to commit** — it identifies your project but isn't a secret.

### 7c. Create the Firestore database

1. In the Firebase console: **Build → Firestore Database → Create database**.
2. Choose **production mode**, pick the region closest to you, Create.

### 7d. Set the security rules

In Firestore → **Rules** tab, replace the contents with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /households/{household}/{document=**} {
      allow read, write: if true;
    }
  }
}
```

Click **Publish**.

> ⚠️ **What this means:** data is only reachable if you know the household path, which is the SHA-256 hash of your household code — nobody can *list* households or guess yours from a short code. But the rules are technically open: anyone who learns your `projectId` could write junk data under their own made-up household and burn your free quota. That's an acceptable trade-off for a personal app with no sign-in. If you ever want to harden it, the standard upgrade is enabling **Anonymous Authentication** (Build → Authentication → Sign-in method → Anonymous) and changing `if true` to `if request.auth != null` — ask Claude to wire up the matching `signInAnonymously()` call.

### 7e. Connect your devices

1. Reload iChef and click the **cloud icon** in the header.
2. Invent a household code — make it **long and unguessable**, like four random words (`purple-walrus-pancake-tuesday`). Anyone who knows the code can see and edit your data.
3. The app will offer to upload this device's existing data. On your other devices, enter the **same code** and choose "Just use the household data" (or merge).

From then on, changes sync live between devices (Firestore pushes updates within seconds). If a device shows an unexpectedly *empty* household when connecting, you probably typo'd the code — a different code is a different household.

## Troubleshooting

- **`vercel dev` says "no project linked"** → run `vercel link` first.
- **Recipes page shows "Backend not configured"** → `.env.local` doesn't have `SPOONACULAR_API_KEY` set, or you didn't restart `vercel dev` after editing it.
- **CORS errors in the console** → shouldn't happen (same-origin); if you see them, you're probably loading `index.html` via `file://` instead of `vercel dev`.
- **`vercel: command not found`** after install → restart your terminal, or use `npx vercel` instead of `vercel`.
