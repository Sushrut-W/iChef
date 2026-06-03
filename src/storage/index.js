// Active storage adapter.
//
// Today: localStorage (works without any setup).
// Switch to Firestore later by changing this one line to './firestore.js'
// after completing the steps in SETUP.md.

export {
  getPantry,
  addIngredient,
  setIngredientStatus,
  removeIngredient,
  bulkAdd,
} from './localStorage.js';
