// Firestore storage adapter — STUB.
//
// To activate:
//   1. Add your firebase web-app config to FIREBASE_CONFIG in src/config.js.
//   2. Replace this file's body with real Firestore logic (template below).
//   3. Change the active import in src/storage/index.js to './firestore.js'.
//   4. Tighten Firestore security rules before any real-world use.
//
// Template (uncomment + adapt once Firebase SDK is loaded — either as ES module
// CDN imports or via a bundler):
//
// import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.x.x/firebase-app.js';
// import {
//   getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteDoc,
// } from 'https://www.gstatic.com/firebasejs/10.x.x/firebase-firestore.js';
// import { FIREBASE_CONFIG } from '../config.js';
//
// const app = initializeApp(FIREBASE_CONFIG);
// const db = getFirestore(app);
// const PANTRY = collection(db, 'pantry');
//
// export async function getPantry() { ... }
// export async function addIngredient({ name, category }) { ... }
// export async function setIngredientStatus(id, hasIt) { ... }
// export async function removeIngredient(id) { ... }
// export async function bulkAdd(entries) { ... }

const NOT_CONFIGURED = () => {
  throw new Error(
    'Firestore adapter is not configured yet. See SETUP.md or switch ' +
    'src/storage/index.js back to ./localStorage.js for now.'
  );
};

export const getPantry = NOT_CONFIGURED;
export const addIngredient = NOT_CONFIGURED;
export const setIngredientStatus = NOT_CONFIGURED;
export const removeIngredient = NOT_CONFIGURED;
export const bulkAdd = NOT_CONFIGURED;
