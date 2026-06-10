// Built-in recipe catalog (TheMealDB dump in data/catalog.json).
//
// Searches run entirely in the browser against the full ~650-recipe catalog:
// zero API quota, works offline (after first load), exact must-use matching,
// and counts that stay consistent across meal types. Results are merged with
// Spoonacular's in src/api/recipes.js when a server key is configured.

import { getHaveItems } from '../state/pantry.js';

let catalogPromise = null;

// Pantry staples that shouldn't count against "missing" — nearly every
// kitchen has them, and counting them would make Strict mode useless.
const ASSUMED_STAPLES = new Set([
  'water', 'salt', 'pepper', 'black pepper', 'salt and pepper',
  'sugar', 'caster sugar', 'oil', 'vegetable oil', 'olive oil', 'flour', 'plain flour',
]);

// catalog category -> iChef meal type keys it satisfies
const CATEGORY_MEALTYPES = {
  breakfast: ['breakfast', 'any'],
  dessert: ['dessert', 'baked', 'any'],
  side: ['side', 'any'],
  starter: ['snack', 'side', 'any'],
  vegan: ['lunch', 'dinner', 'any'],
  vegetarian: ['lunch', 'dinner', 'any'],
  beef: ['lunch', 'dinner', 'any'],
  chicken: ['lunch', 'dinner', 'any'],
  goat: ['lunch', 'dinner', 'any'],
  lamb: ['lunch', 'dinner', 'any'],
  pasta: ['lunch', 'dinner', 'any'],
  pork: ['lunch', 'dinner', 'any'],
  seafood: ['lunch', 'dinner', 'any'],
  miscellaneous: ['lunch', 'dinner', 'any'],
};

async function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch('data/catalog.json')
      .then((r) => {
        if (!r.ok) throw new Error(`catalog.json HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => data.recipes || [])
      .catch((err) => {
        console.warn('Built-in catalog unavailable', err);
        catalogPromise = null; // allow retry on next search
        return [];
      });
  }
  return catalogPromise;
}

function nameMatches(a, b) {
  return a === b || a.includes(b) || b.includes(a);
}

function matchPantry(recipe, pantryNames) {
  let used = 0;
  let missed = 0;
  for (const ing of recipe.ingredients) {
    if (pantryNames.some((p) => nameMatches(ing.n, p))) used++;
    else if (!ASSUMED_STAPLES.has(ing.n)) missed++;
  }
  return { used, missed };
}

function isVegetarian(recipe) {
  return recipe.category === 'vegetarian' || recipe.category === 'vegan'
    || recipe.tags.includes('vegetarian') || recipe.tags.includes('vegan');
}

// Returns recipes in the same normalized shape api/recipes.js produces.
export async function searchCatalog({ mealType = 'any', mode = 'flexible', cuisine = '', diet = '', mustUse = '' } = {}) {
  const recipes = await loadCatalog();
  const pantryNames = getHaveItems().map((i) => i.name.toLowerCase());
  if (!pantryNames.length) return [];

  const mustUseLower = mustUse.toLowerCase().trim();
  const results = [];

  for (const recipe of recipes) {
    const mealTypes = CATEGORY_MEALTYPES[recipe.category] || ['any'];
    if (!mealTypes.includes(mealType)) continue;
    if (cuisine && recipe.area !== cuisine) continue;
    // The catalog has no reliable diet metadata beyond vegetarian/vegan —
    // for stricter diets, only Spoonacular results apply.
    if (diet === 'vegetarian' && !isVegetarian(recipe)) continue;
    if (diet === 'vegan' && recipe.category !== 'vegan' && !recipe.tags.includes('vegan')) continue;
    if (diet && diet !== 'vegetarian' && diet !== 'vegan') continue;

    if (mustUseLower && !recipe.ingredients.some((ing) => nameMatches(ing.n, mustUseLower))) continue;

    const { used, missed } = matchPantry(recipe, pantryNames);
    if (used === 0) continue;
    if (mode === 'strict' && missed > 0) continue;

    results.push({
      id: recipe.id,
      title: recipe.title,
      image: recipe.image,
      sourceUrl: recipe.sourceUrl,
      readyInMinutes: null,
      servings: null,
      summary: null,
      dishTypes: [recipe.category],
      cuisines: recipe.area ? [recipe.area] : [],
      diets: [],
      vegetarian: isVegetarian(recipe),
      vegan: recipe.category === 'vegan' || recipe.tags.includes('vegan'),
      glutenFree: false,
      dairyFree: false,
      usedIngredientCount: used,
      missedIngredientCount: missed,
      source: 'catalog',
    });
  }

  results.sort((a, b) => a.missedIngredientCount - b.missedIngredientCount || b.usedIngredientCount - a.usedIngredientCount);
  return results.slice(0, 48);
}

export function isCatalogId(id) {
  return String(id).startsWith('mdb-');
}

// Detail view for catalog recipes — built locally, costs nothing.
export async function getCatalogDetail(id) {
  const recipes = await loadCatalog();
  const recipe = recipes.find((r) => r.id === String(id));
  if (!recipe) throw new Error('Recipe not found in the built-in catalog');

  const pantryNames = getHaveItems().map((i) => i.name.toLowerCase());
  const ingredients = recipe.ingredients.map((ing) => ({
    id: null,
    name: ing.n,
    original: ing.m ? `${ing.m} ${ing.n}` : ing.n,
    inPantry: pantryNames.some((p) => nameMatches(ing.n, p)),
  }));

  return {
    id: recipe.id,
    title: recipe.title,
    image: recipe.image,
    sourceUrl: recipe.sourceUrl,
    summary: '',
    readyInMinutes: null,
    servings: null,
    cuisines: recipe.area ? [recipe.area] : [],
    dishTypes: [recipe.category],
    ingredients,
    steps: recipe.steps,
  };
}
