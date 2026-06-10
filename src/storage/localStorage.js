// localStorage adapter — implements the generic storage contract:
//
//   init(), listItems(coll), upsertItem(coll, item), patchItem(coll, id, partial),
//   removeItem(coll, id), replaceAll(coll, items), getDoc(name), setDoc(name, value),
//   watch(coll, cb), watchDoc(name, cb)
//
// Collections: pantry | shopping | favorites | history
// Singleton docs: taste | settings
//
// All methods return Promises so the interface stays Firestore-compatible.
// watch() fires immediately with current data and again after every mutation.

const COLLECTION_KEYS = {
  pantry: 'ichef.pantry.v2',
  shopping: 'ichef.shopping.v1',
  favorites: 'ichef.favorites.v1',
  history: 'ichef.history.v1',
};

const LEGACY_PANTRY_KEY = 'ichef.pantry.v1';

function docKey(name) {
  return `ichef.doc.${name}.v1`;
}

const collListeners = new Map(); // coll -> Set<cb>
const docListeners = new Map(); // name -> Set<cb>

function keyFor(coll) {
  const key = COLLECTION_KEYS[coll];
  if (!key) throw new Error(`Unknown collection: ${coll}`);
  return key;
}

function readList(coll) {
  try {
    const raw = localStorage.getItem(keyFor(coll));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(coll, items) {
  localStorage.setItem(keyFor(coll), JSON.stringify(items));
  emitColl(coll, items);
}

function emitColl(coll, items) {
  const set = collListeners.get(coll);
  if (!set) return;
  for (const cb of set) {
    try { cb(items); } catch (e) { console.error('storage watch error', e); }
  }
}

function emitDoc(name, value) {
  const set = docListeners.get(name);
  if (!set) return;
  for (const cb of set) {
    try { cb(value); } catch (e) { console.error('storage watchDoc error', e); }
  }
}

function uid() {
  return 'it_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export async function init() {
  // One-time migration: ichef.pantry.v1 -> ichef.pantry.v2 (same item shape).
  // The old key is left in place as a backup.
  try {
    if (!localStorage.getItem(COLLECTION_KEYS.pantry)) {
      const legacy = localStorage.getItem(LEGACY_PANTRY_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length) {
          localStorage.setItem(COLLECTION_KEYS.pantry, legacy);
        }
      }
    }
  } catch (e) {
    console.warn('pantry v1 migration skipped', e);
  }
}

export async function listItems(coll) {
  return readList(coll);
}

export async function upsertItem(coll, item) {
  const items = readList(coll);
  const finalItem = { ...item };
  if (!finalItem.id) finalItem.id = uid();
  const idx = items.findIndex((i) => i.id === finalItem.id);
  if (idx >= 0) items[idx] = { ...items[idx], ...finalItem };
  else items.push(finalItem);
  writeList(coll, items);
  return finalItem;
}

export async function patchItem(coll, id, partial) {
  const items = readList(coll);
  const item = items.find((i) => i.id === id);
  if (!item) return;
  Object.assign(item, partial);
  writeList(coll, items);
}

export async function removeItem(coll, id) {
  writeList(coll, readList(coll).filter((i) => i.id !== id));
}

export async function replaceAll(coll, items) {
  const withIds = items.map((i) => (i.id ? i : { ...i, id: uid() }));
  writeList(coll, withIds);
  return withIds;
}

export async function getDoc(name) {
  try {
    const raw = localStorage.getItem(docKey(name));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setDoc(name, value) {
  const current = (await getDoc(name)) || {};
  const merged = { ...current, ...value };
  localStorage.setItem(docKey(name), JSON.stringify(merged));
  emitDoc(name, merged);
  return merged;
}

export function watch(coll, cb) {
  keyFor(coll); // validate
  if (!collListeners.has(coll)) collListeners.set(coll, new Set());
  collListeners.get(coll).add(cb);
  // Fire immediately so subscribers start with current data.
  cb(readList(coll));
  return () => collListeners.get(coll).delete(cb);
}

export function watchDoc(name, cb) {
  if (!docListeners.has(name)) docListeners.set(name, new Set());
  docListeners.get(name).add(cb);
  getDoc(name).then((value) => cb(value));
  return () => docListeners.get(name).delete(cb);
}
