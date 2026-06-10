// Result ranking: applies taste preferences on top of the server's ordering.
//
// - Disliked recipes are excluded (callers get them back separately so the UI
//   can show "n hidden" with an undo).
// - Strict mode: everything is cookable, so affinity is the primary sort.
// - Flexible mode: missing-ingredient count stays primary — a loved cuisine
//   never outranks a recipe you can make with fewer purchases. Affinity only
//   re-ranks within each "missing N" bucket.

import * as taste from '../state/taste.js';

export function rankRecipes(recipes, mode) {
  const visible = [];
  const hidden = [];
  for (const recipe of recipes) {
    (taste.isHidden(recipe.id) ? hidden : visible).push(recipe);
  }

  const scores = new Map(visible.map((r) => [r.id, taste.scoreFor(r)]));

  visible.sort((a, b) => {
    if (mode !== 'strict') {
      const missDiff = a.missedIngredientCount - b.missedIngredientCount;
      if (missDiff !== 0) return missDiff;
    }
    const scoreDiff = scores.get(b.id) - scores.get(a.id);
    if (scoreDiff !== 0) return scoreDiff;
    return String(a.title).localeCompare(String(b.title));
  });

  return { visible, hidden };
}
