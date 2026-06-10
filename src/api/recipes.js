// Higher-level recipe service. Thin wrapper over the backend client that
// also tags recipe ingredients with whether they're in the pantry.

import { fetchRecipes, fetchRecipeDetail, BackendError } from './backend.js';
import { getHaveItems, getAll as getAllPantry } from '../state/pantry.js';

export { BackendError };

export async function findRecipes({
  mealType = 'any',
  mode = 'flexible',
  cuisine = '',
  diet = '',
  intolerances = [],
  mustUse = '',
} = {}) {
  const ingredients = getHaveItems().map((i) => i.name);
  return fetchRecipes({ mealType, mode, ingredients, cuisine, diet, intolerances, mustUse });
}

export async function getRecipeDetail(id) {
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
