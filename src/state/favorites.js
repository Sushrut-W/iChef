// Favorites state. Stores denormalized recipe snapshots so the favorites view
// renders with zero API calls:
//   {id, title, image, cuisines, dishTypes, readyInMinutes, servings,
//    usedIngredientCount, missedIngredientCount, savedAt}
// The item id IS the Spoonacular recipe id (stringified).

import * as storage from '../storage/index.js';

const listeners = new Set();
let cache = [];
let loaded = false;

function emit() {
  for (const fn of listeners) {
    try { fn(cache); } catch (e) { console.error('favorites listener error', e); }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  if (loaded) fn(cache);
  return () => listeners.delete(fn);
}

export async function load() {
  cache = await storage.listItems('favorites');
  loaded = true;
  emit();
  storage.watch('favorites', (items) => {
    cache = items;
    emit();
  });
  return cache;
}

export function getAll() {
  return [...cache].sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
}

export function isFavorite(recipeId) {
  const id = String(recipeId);
  return cache.some((f) => String(f.id) === id);
}

// Toggle from a recipe card/detail snapshot. Returns true if now favorited.
export async function toggle(recipe) {
  const id = String(recipe.id);
  if (isFavorite(id)) {
    await storage.removeItem('favorites', id);
    return false;
  }
  await storage.upsertItem('favorites', {
    id,
    title: recipe.title,
    image: recipe.image || null,
    cuisines: recipe.cuisines || [],
    dishTypes: recipe.dishTypes || [],
    readyInMinutes: recipe.readyInMinutes || null,
    servings: recipe.servings || null,
    usedIngredientCount: recipe.usedIngredientCount ?? null,
    missedIngredientCount: recipe.missedIngredientCount ?? null,
    savedAt: new Date().toISOString(),
  });
  return true;
}
