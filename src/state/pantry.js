// Pantry state — a thin layer over the storage adapter that adds:
//  - in-memory caching
//  - change-event subscription so UI can re-render on updates
//  - category inference for unknown ingredients
//  - helpers to query "do I have ingredient X?"

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
  cache = await storage.getPantry();
  loaded = true;
  emit();
  return cache;
}

export function getAll() {
  return cache;
}

export function hasIngredient(name) {
  const lower = String(name || '').trim().toLowerCase();
  return cache.some((i) => i.name.toLowerCase() === lower && i.hasIt);
}

export function getHaveItems() {
  return cache.filter((i) => i.hasIt);
}

export async function add(name, category) {
  const finalCategory = category || guessCategory(name);
  const added = await storage.addIngredient({ name, category: finalCategory });
  cache = await storage.getPantry();
  emit();
  return added;
}

export async function setStatus(id, hasIt) {
  await storage.setIngredientStatus(id, hasIt);
  const item = cache.find((i) => i.id === id);
  if (item) item.hasIt = Boolean(hasIt);
  emit();
}

export async function remove(id) {
  await storage.removeIngredient(id);
  cache = cache.filter((i) => i.id !== id);
  emit();
}

export async function bulkAddNames(names) {
  const entries = names
    .map((n) => String(n).trim())
    .filter(Boolean)
    .map((name) => ({ name, category: guessCategory(name) }));
  if (!entries.length) return [];
  const added = await storage.bulkAdd(entries);
  cache = await storage.getPantry();
  emit();
  return added;
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
