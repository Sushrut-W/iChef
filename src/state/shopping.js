// Shopping list state. Items: {id, name, category, checked, addedAt, fromRecipe?}

import * as storage from '../storage/index.js';
import * as pantry from './pantry.js';

const listeners = new Set();
let cache = [];
let loaded = false;

function emit() {
  for (const fn of listeners) {
    try { fn(cache); } catch (e) { console.error('shopping listener error', e); }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  if (loaded) fn(cache);
  return () => listeners.delete(fn);
}

export async function load() {
  cache = await storage.listItems('shopping');
  loaded = true;
  emit();
  storage.watch('shopping', (items) => {
    cache = items;
    emit();
  });
  return cache;
}

export function getAll() {
  return cache;
}

export function uncheckedCount() {
  return cache.filter((i) => !i.checked).length;
}

export async function add(name, category, fromRecipe = null) {
  const cleanName = pantry.normalizeName(name);
  if (!cleanName) return null;
  const existing = cache.find((i) => pantry.normalizeName(i.name) === cleanName);
  if (existing) {
    if (existing.checked) await storage.patchItem('shopping', existing.id, { checked: false });
    return existing;
  }
  return storage.upsertItem('shopping', {
    name: cleanName,
    category: category || pantry.guessCategory(cleanName),
    checked: false,
    addedAt: new Date().toISOString(),
    ...(fromRecipe ? { fromRecipe } : {}),
  });
}

// Add a recipe's missing ingredients. Skips items already on the list and
// items the pantry already has. Returns the number actually added.
export async function addMany(names, recipeTitle = null) {
  const listNames = new Set(cache.map((i) => pantry.normalizeName(i.name)));
  let added = 0;
  for (const name of names) {
    const cleanName = pantry.normalizeName(name);
    if (!cleanName || listNames.has(cleanName) || pantry.hasIngredient(cleanName)) continue;
    listNames.add(cleanName);
    await storage.upsertItem('shopping', {
      name: cleanName,
      category: pantry.guessCategory(cleanName),
      checked: false,
      addedAt: new Date().toISOString(),
      ...(recipeTitle ? { fromRecipe: recipeTitle } : {}),
    });
    added++;
  }
  return added;
}

export async function toggleChecked(id) {
  const item = cache.find((i) => i.id === id);
  if (!item) return;
  await storage.patchItem('shopping', id, { checked: !item.checked });
}

export async function remove(id) {
  await storage.removeItem('shopping', id);
}

export async function clearChecked() {
  const remaining = cache.filter((i) => !i.checked);
  await storage.replaceAll('shopping', remaining);
}

// Move every checked item into the pantry (marked Have), then drop them
// from the shopping list. Returns how many moved.
export async function moveCheckedToPantry() {
  const checked = cache.filter((i) => i.checked);
  if (!checked.length) return 0;
  await pantry.bulkAddEntries(checked.map((i) => ({ name: i.name, category: i.category })));
  await storage.replaceAll('shopping', cache.filter((i) => !i.checked));
  return checked.length;
}
