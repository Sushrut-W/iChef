// iChef configuration.
//
// The Spoonacular API key is server-side only — set it as SPOONACULAR_API_KEY
// in .env.local (local dev) or via Vercel project environment variables.
// See SETUP.md for full instructions.

// Firebase config is optional. Today the pantry lives in browser localStorage.
// If you later want cross-device sync, paste your firebaseConfig here and
// follow the Firestore steps in SETUP.md.
export const FIREBASE_CONFIG = null;

export function hasFirebaseConfig() {
  return FIREBASE_CONFIG && typeof FIREBASE_CONFIG === 'object';
}
