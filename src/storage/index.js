// Storage facade — the only module the rest of the app talks to for persistence.
//
// Picks the active adapter at runtime:
//   - Firestore  when FIREBASE_CONFIG is set AND a household hash is saved locally
//   - localStorage otherwise
//
// Also owns the sync lifecycle: enabling sync is a two-step flow so a mistyped
// household code can be abandoned before anything is persisted or migrated.
//
//   1. previewSync(code)  -> connects to Firestore, returns remote item counts
//   2. confirmSync(mode)  -> 'upload' | 'merge' | 'remote'; migrates, persists
//                            the code hash, and switches the live adapter
//   cancelSync()          -> abandons the preview
//   disableSync()         -> back to localStorage (local data is untouched)
//
// watch()/watchDoc() subscriptions survive adapter switches — subscribers are
// re-fired with the new adapter's data automatically.

import * as local from './localStorage.js';
import { hasFirebaseConfig } from '../config.js';

export const COLLECTIONS = ['pantry', 'shopping', 'favorites', 'history'];
export const DOCS = ['taste', 'settings'];

const HOUSEHOLD_KEY = 'ichef.household.v1';

let adapter = null;
let firestoreModule = null;
let pending = null; // { module, hash } during previewSync

// ---------- subscriptions (adapter-independent) ----------

const collSubs = new Map(); // coll -> { cbs:Set, unsub, last }
const docSubs = new Map(); // name -> { cbs:Set, unsub, last }

function getSub(map, key) {
  if (!map.has(key)) map.set(key, { cbs: new Set(), unsub: null, last: undefined });
  return map.get(key);
}

function attachSub(sub, attach) {
  if (sub.unsub || !adapter) return;
  sub.unsub = attach((value) => {
    sub.last = value;
    for (const cb of sub.cbs) {
      try { cb(value); } catch (e) { console.error('storage subscriber error', e); }
    }
  });
}

function attachAllSubs() {
  for (const [coll, sub] of collSubs) attachSub(sub, (fan) => adapter.watch(coll, fan));
  for (const [name, sub] of docSubs) attachSub(sub, (fan) => adapter.watchDoc(name, fan));
}

function detachAllSubs() {
  for (const sub of [...collSubs.values(), ...docSubs.values()]) {
    if (sub.unsub) { sub.unsub(); sub.unsub = null; }
  }
}

export function watch(coll, cb) {
  const sub = getSub(collSubs, coll);
  sub.cbs.add(cb);
  if (adapter) {
    attachSub(sub, (fan) => adapter.watch(coll, fan));
    if (sub.last !== undefined) cb(sub.last);
  }
  return () => sub.cbs.delete(cb);
}

export function watchDoc(name, cb) {
  const sub = getSub(docSubs, name);
  sub.cbs.add(cb);
  if (adapter) {
    attachSub(sub, (fan) => adapter.watchDoc(name, fan));
    if (sub.last !== undefined) cb(sub.last);
  }
  return () => sub.cbs.delete(cb);
}

// ---------- init + adapter selection ----------

export function getHouseholdHash() {
  try { return localStorage.getItem(HOUSEHOLD_KEY); } catch { return null; }
}

export function isSynced() {
  return adapter !== null && adapter !== local;
}

export async function init() {
  await local.init();
  const hash = getHouseholdHash();
  if (hasFirebaseConfig() && hash) {
    try {
      firestoreModule = await import('./firestore.js');
      await firestoreModule.init(hash);
      adapter = firestoreModule;
    } catch (e) {
      console.error('Firestore init failed — falling back to local storage', e);
      adapter = local;
    }
  } else {
    adapter = local;
  }
  attachAllSubs();
}

// ---------- CRUD delegation ----------

export function listItems(coll) { return adapter.listItems(coll); }
export function upsertItem(coll, item) { return adapter.upsertItem(coll, item); }
export function patchItem(coll, id, partial) { return adapter.patchItem(coll, id, partial); }
export function removeItem(coll, id) { return adapter.removeItem(coll, id); }
export function replaceAll(coll, items) { return adapter.replaceAll(coll, items); }
export function getDoc(name) { return adapter.getDoc(name); }
export function setDoc(name, value) { return adapter.setDoc(name, value); }

// ---------- sync lifecycle ----------

function normalizeCode(code) {
  return String(code || '').trim().toLowerCase();
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function previewSync(code) {
  const normalized = normalizeCode(code);
  if (normalized.length < 4) throw new Error('Household code must be at least 4 characters.');
  const hash = await sha256Hex(normalized);
  const module = firestoreModule || (await import('./firestore.js'));
  firestoreModule = module;
  await module.init(hash);

  const counts = {};
  for (const coll of COLLECTIONS) {
    counts[coll] = (await module.listItems(coll)).length;
  }
  pending = { module, hash };
  return counts;
}

export function cancelSync() {
  if (pending && adapter !== pending.module) pending.module.teardown();
  pending = null;
}

async function snapshotAdapter(src) {
  const data = { items: {}, docs: {} };
  for (const coll of COLLECTIONS) data.items[coll] = await src.listItems(coll);
  for (const name of DOCS) data.docs[name] = await src.getDoc(name);
  return data;
}

function mergeTaste(remote, localDoc) {
  const out = {
    liked: { ...(localDoc?.liked || {}), ...(remote?.liked || {}) },
    disliked: { ...(localDoc?.disliked || {}), ...(remote?.disliked || {}) },
    cuisines: { ...(localDoc?.cuisines || {}) },
    dishTypes: { ...(localDoc?.dishTypes || {}) },
  };
  for (const [k, v] of Object.entries(remote?.cuisines || {})) {
    out.cuisines[k] = Math.max(-5, Math.min(5, (out.cuisines[k] || 0) + v));
  }
  for (const [k, v] of Object.entries(remote?.dishTypes || {})) {
    out.dishTypes[k] = Math.max(-3, Math.min(3, (out.dishTypes[k] || 0) + v));
  }
  return out;
}

function mergeLists(coll, remoteItems, localItems) {
  // pantry/shopping dedupe by normalized name; favorites/history by identity key.
  const keyOf =
    coll === 'favorites' ? (i) => String(i.id)
    : coll === 'history' ? (i) => `${i.recipeId}|${i.cookedAt}`
    : (i) => String(i.name || '').trim().toLowerCase();
  const seen = new Map();
  for (const item of remoteItems) seen.set(keyOf(item), item); // remote wins conflicts
  for (const item of localItems) {
    const k = keyOf(item);
    if (!seen.has(k)) seen.set(k, item);
  }
  return [...seen.values()];
}

export async function confirmSync(mode) {
  if (!pending) throw new Error('No pending sync to confirm');
  const { module, hash } = pending;

  if (mode !== 'remote') {
    const localData = await snapshotAdapter(local);
    for (const coll of COLLECTIONS) {
      const localItems = localData.items[coll];
      if (!localItems.length) continue;
      if (mode === 'upload') {
        await module.replaceAll(coll, localItems);
      } else {
        const remoteItems = await module.listItems(coll);
        await module.replaceAll(coll, mergeLists(coll, remoteItems, localItems));
      }
    }
    for (const name of DOCS) {
      const localDoc = localData.docs[name];
      if (!localDoc) continue;
      if (mode === 'upload') {
        await module.setDoc(name, localDoc);
      } else if (name === 'taste') {
        const remoteDoc = await module.getDoc(name);
        await module.setDoc(name, mergeTaste(remoteDoc, localDoc));
      } else {
        const remoteDoc = await module.getDoc(name);
        await module.setDoc(name, { ...localDoc, ...(remoteDoc || {}) });
      }
    }
  }

  try { localStorage.setItem(HOUSEHOLD_KEY, hash); } catch { /* ignore */ }
  detachAllSubs();
  adapter = module;
  pending = null;
  attachAllSubs();
}

export async function disableSync() {
  try { localStorage.removeItem(HOUSEHOLD_KEY); } catch { /* ignore */ }
  detachAllSubs();
  if (firestoreModule) firestoreModule.teardown();
  adapter = local;
  attachAllSubs();
}
