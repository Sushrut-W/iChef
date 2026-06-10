// Recipe-page filter settings, persisted (and synced) via the 'settings' doc:
//   { mealType, mode, cuisine, groupByCuisine, diet, intolerances }

import * as storage from '../storage/index.js';

const DEFAULTS = {
  mealType: 'any',
  mode: 'flexible',
  cuisine: '',
  groupByCuisine: false,
  diet: '',
  intolerances: [],
};

const listeners = new Set();
let cache = { ...DEFAULTS };
let loaded = false;

function emit() {
  for (const fn of listeners) {
    try { fn(cache); } catch (e) { console.error('settings listener error', e); }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  if (loaded) fn(cache);
  return () => listeners.delete(fn);
}

export async function load() {
  cache = { ...DEFAULTS, ...((await storage.getDoc('settings')) || {}) };
  loaded = true;
  emit();
  storage.watchDoc('settings', (value) => {
    cache = { ...DEFAULTS, ...(value || {}) };
    emit();
  });
  return cache;
}

export function get() {
  return cache;
}

export async function update(partial) {
  cache = { ...cache, ...partial };
  emit();
  await storage.setDoc('settings', partial);
}
