// Client for the iChef backend (Vercel serverless functions in /api).
//
// All Spoonacular calls happen server-side. The browser never sees the API key.

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

export async function fetchRecipes({ mealType, mode, ingredients }) {
  const url = new URL('/api/recipes', window.location.origin);
  if (mealType) url.searchParams.set('mealType', mealType);
  if (mode) url.searchParams.set('mode', mode);
  if (ingredients && ingredients.length) {
    url.searchParams.set('ingredients', ingredients.join(','));
  }
  const data = await fetchJson(url.toString());
  return data.recipes || [];
}

export async function fetchRecipeDetail(id) {
  return fetchJson(`/api/recipe/${encodeURIComponent(id)}`);
}

export async function fetchAutocomplete(query) {
  if (!query || query.length < 2) return [];
  const url = new URL('/api/autocomplete', window.location.origin);
  url.searchParams.set('q', query);
  return fetchJson(url.toString());
}
