// Default storage adapter. Persists the pantry in the browser's localStorage.
// All methods return Promises so the adapter interface stays Firestore-compatible.

const STORAGE_KEY = 'ichef.pantry.v1';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function uid() {
  return 'ing_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

export async function getPantry() {
  return readAll();
}

export async function addIngredient({ name, category }) {
  const items = readAll();
  const cleanName = normalizeName(name);
  if (!cleanName) throw new Error('Ingredient name required');

  const existing = items.find((i) => normalizeName(i.name) === cleanName);
  if (existing) {
    // Re-adding an existing ingredient marks it as Have again.
    existing.hasIt = true;
    if (category) existing.category = category;
    writeAll(items);
    return existing;
  }

  const ingredient = {
    id: uid(),
    name: cleanName,
    category: category || 'Other',
    hasIt: true,
    addedAt: new Date().toISOString(),
  };
  items.push(ingredient);
  writeAll(items);
  return ingredient;
}

export async function setIngredientStatus(id, hasIt) {
  const items = readAll();
  const item = items.find((i) => i.id === id);
  if (!item) return;
  item.hasIt = Boolean(hasIt);
  writeAll(items);
}

export async function removeIngredient(id) {
  const items = readAll().filter((i) => i.id !== id);
  writeAll(items);
}

export async function bulkAdd(entries) {
  const items = readAll();
  const added = [];
  for (const entry of entries) {
    const cleanName = normalizeName(entry.name);
    if (!cleanName) continue;
    const existing = items.find((i) => normalizeName(i.name) === cleanName);
    if (existing) {
      existing.hasIt = true;
      if (entry.category) existing.category = entry.category;
      added.push(existing);
    } else {
      const ingredient = {
        id: uid(),
        name: cleanName,
        category: entry.category || 'Other',
        hasIt: true,
        addedAt: new Date().toISOString(),
      };
      items.push(ingredient);
      added.push(ingredient);
    }
  }
  writeAll(items);
  return added;
}
