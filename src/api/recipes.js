// Higher-level recipe service: merges the built-in local catalog (free,
// offline, no quota) with Spoonacular results (when the server has a key),
// and tags recipe ingredients with whether they're in the pantry.

import { fetchRecipes, fetchRecipeDetail, BackendError } from './backend.js';
import { searchCatalog, getCatalogDetail, isCatalogId } from './catalog.js';
import { isBackendConfigured } from '../state/backend.js';
import { getHaveItems, getAll as getAllPantry } from '../state/pantry.js';

export { BackendError };

function titleKey(title) {
  return String(title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Returns { recipes, spoonacularError } — spoonacularError is set when the
// web search failed (quota, network, no key) but catalog results still stand.
export async function findRecipes({
  mealType = 'any',
  mode = 'flexible',
  cuisine = '',
  diet = '',
  intolerances = [],
  mustUse = '',
} = {}) {
  const ingredients = getHaveItems().map((i) => i.name);

  // The catalog has no allergen metadata, so when intolerances are active
  // only Spoonacular results (which filter server-side) are trustworthy.
  const catalogPromise = intolerances.length
    ? Promise.resolve([])
    : searchCatalog({ mealType, mode, cuisine, diet, mustUse });

  const webPromise = isBackendConfigured()
    ? fetchRecipes({ mealType, mode, ingredients, cuisine, diet, intolerances, mustUse })
    : Promise.reject(new BackendError('No Spoonacular key configured', 503));

  const [catalogResult, webResult] = await Promise.allSettled([catalogPromise, webPromise]);

  const local = catalogResult.status === 'fulfilled' ? catalogResult.value : [];
  const web = webResult.status === 'fulfilled' ? webResult.value : [];
  const spoonacularError = webResult.status === 'rejected' ? webResult.reason : null;

  // Dedupe by title; prefer the catalog copy (its detail view costs no quota).
  const seen = new Set(local.map((r) => titleKey(r.title)));
  const merged = [...local];
  for (const recipe of web) {
    if (!seen.has(titleKey(recipe.title))) {
      seen.add(titleKey(recipe.title));
      merged.push({ ...recipe, source: 'web' });
    }
  }

  // If BOTH sources failed (catalog unreachable too), surface the web error.
  if (!merged.length && spoonacularError && catalogResult.status === 'rejected') {
    throw spoonacularError;
  }

  return { recipes: merged, spoonacularError };
}

export async function getRecipeDetail(id) {
  if (isCatalogId(id)) return getCatalogDetail(id);

  const info = await fetchRecipeDetail(id);
  const pantryNames = new Set(getAllPantry().filter((i) => i.hasIt).map((i) => i.name.toLowerCase()));

  const ingredients = (info.extendedIngredients || []).map((ing) => {
    const name = (ing.name || ing.nameClean || ing.originalName || '').toLowerCase();
    const inPantry = [...pantryNames].some(
      (p) => name.includes(p) || p.includes(name)
    );
    return {
      id: ing.id,
      name: ing.name || ing.originalName,
      original: ing.original,
      inPantry,
    };
  });

  return {
    id: info.id,
    title: info.title,
    image: info.image,
    sourceUrl: info.sourceUrl || null,
    summary: info.summary || '',
    readyInMinutes: info.readyInMinutes || null,
    servings: info.servings || null,
    cuisines: info.cuisines || [],
    dishTypes: info.dishTypes || [],
    ingredients,
    steps: extractSteps(info),
  };
}

function extractSteps(info) {
  // Spoonacular returns analyzedInstructions: [{ steps: [{ number, step }] }]
  // and a fallback HTML `instructions` string.
  const analyzed = info.analyzedInstructions;
  if (Array.isArray(analyzed) && analyzed.length && analyzed[0].steps) {
    return analyzed[0].steps.map((s) => s.step).filter(Boolean);
  }
  if (info.instructions) {
    const plain = info.instructions.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const parts = plain.split(/(?<=\.)\s+(?=[A-Z0-9])/);
    return parts.filter((p) => p.length > 3);
  }
  return [];
}
