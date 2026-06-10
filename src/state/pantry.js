// Pantry state — caches the 'pantry' collection and adds:
//  - change-event subscription (driven by storage.watch, so remote sync
//    updates flow through the same path as local edits)
//  - category inference for unknown ingredients
//  - name normalization + dedupe (adapters stay dumb)

import * as storage from '../storage/index.js';

const listeners = new Set();
let cache = [];
let loaded = false;

export const CATEGORIES = [
  'Produce',
  'Dairy',
  'Meat & Seafood',
  'Pantry',
  'Spices',
  'Baking',
  'Frozen',
  'Condiments',
  'Beverages',
  'Other',
];

// Lightweight category inference for the add-ingredient form. Order matters:
// more specific patterns first.
const CATEGORY_PATTERNS = [
  { cat: 'Spices', words: ['salt', 'pepper', 'cumin', 'paprika', 'cinnamon', 'turmeric', 'oregano', 'basil', 'thyme', 'rosemary', 'chili', 'curry', 'nutmeg', 'cardamom', 'clove', 'bay leaf', 'garam masala'] },
  { cat: 'Baking', words: ['flour', 'sugar', 'baking soda', 'baking powder', 'yeast', 'cocoa', 'vanilla', 'cornstarch'] },
  { cat: 'Dairy', words: ['milk', 'butter', 'cheese', 'yogurt', 'cream', 'sour cream', 'egg', 'eggs'] },
  { cat: 'Meat & Seafood', words: ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'salmon', 'tuna', 'shrimp', 'bacon', 'ham', 'sausage'] },
  { cat: 'Produce', words: ['onion', 'garlic', 'tomato', 'potato', 'carrot', 'lettuce', 'spinach', 'kale', 'apple', 'banana', 'lemon', 'lime', 'pepper', 'cucumber', 'celery', 'broccoli', 'mushroom', 'ginger', 'avocado', 'cilantro', 'parsley'] },
  { cat: 'Frozen', words: ['frozen'] },
  { cat: 'Condiments', words: ['ketchup', 'mustard', 'mayo', 'mayonnaise', 'soy sauce', 'hot sauce', 'vinegar', 'olive oil', 'oil', 'honey', 'syrup', 'jam'] },
  { cat: 'Beverages', words: ['water', 'juice', 'coffee', 'tea', 'wine', 'beer', 'soda'] },
  { cat: 'Pantry', words: ['rice', 'pasta', 'bread', 'beans', 'lentils', 'oats', 'cereal', 'noodle', 'tortilla', 'broth', 'stock', 'tuna', 'tomato sauce'] },
];

export function guessCategory(name) {
  const lower = String(name || '').toLowerCase();
  if (!lower) return 'Other';
  for (const { cat, words } of CATEGORY_PATTERNS) {
    if (words.some((w) => lower.includes(w))) return cat;
  }
  return 'Other';
}

export function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

function emit() {
  for (const fn of listeners) {
    try { fn(cache); } catch (e) { console.error('pantry listener error', e); }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  if (loaded) fn(cache);
  return () => listeners.delete(fn);
}

export async function load() {
  cache = await storage.listItems('pantry');
  loaded = true;
  emit();
  // Keep the cache in sync with all future changes — local or remote.
  storage.watch('pantry', (items) => {
    cache = items;
    emit();
  });
  return cache;
}

export function getAll() {
  return cache;
}

export function findByName(name) {
  const lower = normalizeName(name);
  return cache.find((i) => normalizeName(i.name) === lower) || null;
}

export function hasIngredient(name) {
  const item = findByName(name);
  return Boolean(item && item.hasIt);
}

export function getHaveItems() {
  return cache.filter((i) => i.hasIt);
}

export async function add(name, category) {
  const cleanName = normalizeName(name);
  if (!cleanName) throw new Error('Ingredient name required');
  const existing = findByName(cleanName);
  if (existing) {
    // Re-adding an existing ingredient marks it as Have again.
    await storage.patchItem('pantry', existing.id, {
      hasIt: true,
      ...(category ? { category } : {}),
    });
    return existing;
  }
  return storage.upsertItem('pantry', {
    name: cleanName,
    category: category || guessCategory(cleanName),
    hasIt: true,
    addedAt: new Date().toISOString(),
  });
}

export async function setStatus(id, hasIt) {
  await storage.patchItem('pantry', id, { hasIt: Boolean(hasIt) });
}

export async function remove(id) {
  await storage.removeItem('pantry', id);
}

// Bulk add from {name, category} entries (grocery run, shopping-list import).
// Dedupes against the current pantry by normalized name; existing items are
// marked Have. Single replaceAll write -> single re-render / sync batch.
export async function bulkAddEntries(entries) {
  const next = cache.map((i) => ({ ...i }));
  const byName = new Map(next.map((i) => [normalizeName(i.name), i]));
  const added = [];
  for (const entry of entries) {
    const cleanName = normalizeName(entry.name);
    if (!cleanName) continue;
    const existing = byName.get(cleanName);
    if (existing) {
      existing.hasIt = true;
      if (entry.category) existing.category = entry.category;
      added.push(existing);
    } else {
      const item = {
        name: cleanName,
        category: entry.category || guessCategory(cleanName),
        hasIt: true,
        addedAt: new Date().toISOString(),
      };
      next.push(item);
      byName.set(cleanName, item);
      added.push(item);
    }
  }
  if (!added.length) return [];
  await storage.replaceAll('pantry', next);
  return added;
}

export async function bulkAddNames(names) {
  return bulkAddEntries(
    names
      .map((n) => normalizeName(n))
      .filter(Boolean)
      .map((name) => ({ name, category: guessCategory(name) }))
  );
}

export function groupByCategory(items) {
  const grouped = {};
  for (const item of items) {
    const cat = item.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }
  // Preserve canonical category ordering, then any extras alphabetically.
  const ordered = [];
  for (const cat of CATEGORIES) {
    if (grouped[cat]) ordered.push([cat, grouped[cat].sort((a, b) => a.name.localeCompare(b.name))]);
  }
  for (const cat of Object.keys(grouped).sort()) {
    if (!CATEGORIES.includes(cat)) {
      ordered.push([cat, grouped[cat].sort((a, b) => a.name.localeCompare(b.name))]);
    }
  }
  return ordered;
}
