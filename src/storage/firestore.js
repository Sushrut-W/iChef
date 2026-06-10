// Firestore adapter — implements the same contract as localStorage.js.
//
// Data lives under households/{sha256(householdCode)}:
//   households/{hash}/pantry/{itemId}
//   households/{hash}/shopping/{itemId}
//   households/{hash}/favorites/{recipeId}
//   households/{hash}/history/{entryId}
//   households/{hash}/meta/taste        (singleton doc)
//   households/{hash}/meta/settings     (singleton doc)
//
// The Firebase SDK is loaded lazily from the gstatic CDN (ES modules, no build
// step) — this module is only ever imported when sync is configured.
// watch()/watchDoc() use onSnapshot, which is what makes cross-device sync
// live: another device's write re-fires every subscriber here automatically.

import { FIREBASE_CONFIG } from '../config.js';

const SDK_VERSION = '12.6.0';
const SDK_BASE = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

let fb = null; // firestore SDK module
let db = null;
let householdHash = null;
const activeUnsubs = new Set();

export async function init(hash) {
  if (!FIREBASE_CONFIG) throw new Error('FIREBASE_CONFIG is not set in src/config.js');
  if (!fb) {
    const [appModule, fsModule] = await Promise.all([
      import(`${SDK_BASE}/firebase-app.js`),
      import(`${SDK_BASE}/firebase-firestore.js`),
    ]);
    fb = fsModule;
    const app = appModule.initializeApp(FIREBASE_CONFIG);
    // IndexedDB persistence: the app keeps working offline once synced.
    try {
      db = fb.initializeFirestore(app, {
        localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }),
      });
    } catch {
      db = fb.getFirestore(app);
    }
  }
  if (householdHash !== hash) teardown();
  householdHash = hash;
}

// Detach all live listeners (used when switching households or disabling sync).
export function teardown() {
  for (const unsub of activeUnsubs) {
    try { unsub(); } catch { /* already detached */ }
  }
  activeUnsubs.clear();
}

function collRef(coll) {
  if (!db || !householdHash) throw new Error('Firestore adapter not initialized');
  return fb.collection(db, 'households', householdHash, coll);
}

function metaRef(name) {
  if (!db || !householdHash) throw new Error('Firestore adapter not initialized');
  return fb.doc(db, 'households', householdHash, 'meta', name);
}

function uid() {
  return 'it_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function snapToItems(snapshot) {
  const items = [];
  snapshot.forEach((docSnap) => items.push({ ...docSnap.data(), id: docSnap.id }));
  return items;
}

export async function listItems(coll) {
  const snapshot = await fb.getDocs(collRef(coll));
  return snapToItems(snapshot);
}

export async function upsertItem(coll, item) {
  const finalItem = { ...item };
  if (!finalItem.id) finalItem.id = uid();
  const { id, ...data } = finalItem;
  await fb.setDoc(fb.doc(collRef(coll), String(id)), data, { merge: true });
  return finalItem;
}

export async function patchItem(coll, id, partial) {
  await fb.setDoc(fb.doc(collRef(coll), String(id)), partial, { merge: true });
}

export async function removeItem(coll, id) {
  await fb.deleteDoc(fb.doc(collRef(coll), String(id)));
}

// Replace the whole collection in (chunked) batches: delete docs that aren't
// in the new set, write everything else. Firestore batches cap at 500 ops.
export async function replaceAll(coll, items) {
  const withIds = items.map((i) => (i.id ? { ...i } : { ...i, id: uid() }));
  const keepIds = new Set(withIds.map((i) => String(i.id)));
  const existing = await fb.getDocs(collRef(coll));

  const ops = [];
  existing.forEach((docSnap) => {
    if (!keepIds.has(docSnap.id)) ops.push({ type: 'delete', ref: docSnap.ref });
  });
  for (const item of withIds) {
    const { id, ...data } = item;
    ops.push({ type: 'set', ref: fb.doc(collRef(coll), String(id)), data });
  }

  for (let i = 0; i < ops.length; i += 450) {
    const batch = fb.writeBatch(db);
    for (const op of ops.slice(i, i + 450)) {
      if (op.type === 'delete') batch.delete(op.ref);
      else batch.set(op.ref, op.data);
    }
    await batch.commit();
  }
  return withIds;
}

export async function getDoc(name) {
  const snap = await fb.getDoc(metaRef(name));
  return snap.exists() ? snap.data() : null;
}

export async function setDoc(name, value) {
  await fb.setDoc(metaRef(name), value, { merge: true });
  const merged = await getDoc(name);
  return merged;
}

export function watch(coll, cb) {
  const unsub = fb.onSnapshot(
    collRef(coll),
    (snapshot) => cb(snapToItems(snapshot)),
    (err) => console.error(`Firestore watch(${coll}) error`, err)
  );
  activeUnsubs.add(unsub);
  return () => {
    activeUnsubs.delete(unsub);
    unsub();
  };
}

export function watchDoc(name, cb) {
  const unsub = fb.onSnapshot(
    metaRef(name),
    (snap) => cb(snap.exists() ? snap.data() : null),
    (err) => console.error(`Firestore watchDoc(${name}) error`, err)
  );
  activeUnsubs.add(unsub);
  return () => {
    activeUnsubs.delete(unsub);
    unsub();
  };
}
