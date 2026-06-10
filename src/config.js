// iChef configuration.
//
// The Spoonacular API key is server-side only — set it as SPOONACULAR_API_KEY
// in .env.local (local dev) or via Vercel project environment variables.
// See SETUP.md for full instructions.

// Firebase enables cross-device sync (pantry, shopping list, favorites,
// history shared via a household code). Without it the app stores everything
// in this browser's localStorage — fully functional, just single-device.
//
// To enable: follow SETUP.md → "Cross-device sync with Firebase", then paste
// your web-app config object here. It looks like:
//
// export const FIREBASE_CONFIG = {
//   apiKey: 'AIza…',
//   authDomain: 'your-project.firebaseapp.com',
//   projectId: 'your-project',
//   storageBucket: 'your-project.firebasestorage.app',
//   messagingSenderId: '…',
//   appId: '…',
// };
//
// (This config is safe to commit — it identifies your project, it isn't a
// secret. Access control comes from Firestore rules + your household code.)
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDPiU1qz4j5ralJnDrgPKxjvI9-HRfRX1g",
  authDomain: "ichef-34985.firebaseapp.com",
  projectId: "ichef-34985",
  storageBucket: "ichef-34985.firebasestorage.app",
  messagingSenderId: "818686582163",
  appId: "1:818686582163:web:309de1baeeb90082a09c66"
};

export function hasFirebaseConfig() {
  return Boolean(FIREBASE_CONFIG && typeof FIREBASE_CONFIG === 'object');
}
