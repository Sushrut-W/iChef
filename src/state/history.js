// Cooking history state. Entries: {id, recipeId, title, image, cuisines, cookedAt}
// Newest first; capped so the collection can't grow unbounded.

import * as storage from '../storage/index.js';

const MAX_ENTRIES = 200;

const listeners = new Set();
let cache = [];
let loaded = false;

function emit() {
  for (const fn of listeners) {
    try { fn(cache); } catch (e) { console.error('history listener error', e); }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  if (loaded) fn(cache);
  return () => listeners.delete(fn);
}

export async function load() {
  cache = await storage.listItems('history');
  loaded = true;
  emit();
  storage.watch('history', (items) => {
    cache = items;
    emit();
  });
  return cache;
}

export function getAll() {
  return [...cache].sort((a, b) => (b.cookedAt || '').localeCompare(a.cookedAt || ''));
}

export async function logCook(recipe) {
  const entry = {
    recipeId: String(recipe.id),
    title: recipe.title,
    image: recipe.image || null,
    cuisines: recipe.cuisines || [],
    cookedAt: new Date().toISOString(),
  };
  await storage.upsertItem('history', entry);
  if (cache.length + 1 > MAX_ENTRIES) {
    const sorted = getAll();
    await storage.replaceAll('history', sorted.slice(0, MAX_ENTRIES));
  }
  return entry;
}

export async function remove(id) {
  await storage.removeItem('history', id);
}

export function cookedThisMonth() {
  const now = new Date();
  return cache.filter((e) => {
    const d = new Date(e.cookedAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
}
