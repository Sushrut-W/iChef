// Client for the iChef backend (Vercel serverless functions in /api).
//
// All Spoonacular calls happen server-side. The browser never sees the API key.
// Responses are cached in localStorage — searches for 24h, details for 7 days —
// so repeat queries cost zero Spoonacular quota. (Recipes don't change fast;
// for a personal pantry app, freshness matters far less than the 150 pts/day.)

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
const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
const DETAIL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 60;

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { ts, ttl, payload } = JSON.parse(raw);
    if (Date.now() - ts > (ttl || SEARCH_TTL_MS)) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function cacheSet(key, payload, ttl) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), ttl, payload }));
    pruneCache();
  } catch {
    // localStorage full or unavailable — caching is best-effort.
    try { pruneCache(true); } catch { /* ignore */ }
  }
}

// Keep the cache bounded: evict oldest entries beyond the cap (or aggressively
// when storage is full).
function pruneCache(aggressive = false) {
  const entries = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(CACHE_PREFIX)) continue;
    try {
      entries.push({ k, ts: JSON.parse(localStorage.getItem(k)).ts || 0 });
    } catch {
      entries.push({ k, ts: 0 });
    }
  }
  const cap = aggressive ? Math.floor(MAX_CACHE_ENTRIES / 2) : MAX_CACHE_ENTRIES;
  if (entries.length <= cap) return;
  entries.sort((a, b) => a.ts - b.ts);
  for (const { k } of entries.slice(0, entries.length - cap)) {
    localStorage.removeItem(k);
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
  cacheSet(key, data, SEARCH_TTL_MS);
  return data.recipes || [];
}

export async function fetchRecipeDetail(id) {
  const key = `detail:${id}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const data = await fetchJson(`/api/recipe/${encodeURIComponent(id)}`);
  cacheSet(key, data, DETAIL_TTL_MS);
  return data;
}
