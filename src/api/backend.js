// Client for the iChef backend (Vercel serverless functions in /api).
//
// All Spoonacular calls happen server-side. The browser never sees the API key.
// Recipe searches are additionally cached in sessionStorage (5-min TTL) so tab
// switches and repeat filter clicks don't re-spend Spoonacular quota.

export class BackendError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'BackendError';
    this.status = status;
  }
  get isNotConfigured() {
    return this.status === 503;
  }
}

const CACHE_PREFIX = 'ichef.cache.';
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { ts, payload } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function cacheSet(key, payload) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), payload }));
  } catch {
    // sessionStorage full or unavailable — caching is best-effort.
  }
}

async function fetchJson(url) {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new BackendError(`Network error: ${err.message}`, 0);
  }
  let payload = null;
  try { payload = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok) {
    const msg = (payload && payload.error) || `HTTP ${res.status}`;
    throw new BackendError(msg, res.status);
  }
  return payload;
}

export async function fetchHealth() {
  return fetchJson('/api/health');
}

export async function fetchRecipes({ mealType, mode, ingredients, cuisine, diet, intolerances, mustUse }) {
  const url = new URL('/api/recipes', window.location.origin);
  if (mealType) url.searchParams.set('mealType', mealType);
  if (mode) url.searchParams.set('mode', mode);
  if (ingredients && ingredients.length) {
    url.searchParams.set('ingredients', ingredients.join(','));
  }
  if (mustUse) url.searchParams.set('mustUse', mustUse);
  if (cuisine) url.searchParams.set('cuisine', cuisine);
  if (diet) url.searchParams.set('diet', diet);
  if (intolerances && intolerances.length) {
    url.searchParams.set('intolerances', intolerances.join(','));
  }

  const key = url.search;
  const cached = cacheGet(key);
  if (cached) return cached.recipes || [];

  const data = await fetchJson(url.toString());
  cacheSet(key, data);
  return data.recipes || [];
}

export async function fetchRecipeDetail(id) {
  const key = `detail:${id}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const data = await fetchJson(`/api/recipe/${encodeURIComponent(id)}`);
  cacheSet(key, data);
  return data;
}

export async function fetchAutocomplete(query) {
  if (!query || query.length < 2) return [];
  const url = new URL('/api/autocomplete', window.location.origin);
  url.searchParams.set('q', query);
  return fetchJson(url.toString());
}
