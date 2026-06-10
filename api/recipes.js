// GET /api/recipes?mealType=&mode=&ingredients=&cuisine=&diet=&intolerances=
//
// Server-side proxy for Spoonacular. Keeps SPOONACULAR_API_KEY out of the
// browser. Normalizes the response so the client just renders.
//
// Always uses complexSearch (even for mealType=any) so every result carries
// cuisines + diet flags. One Spoonacular request per query; responses are
// CDN-cached for 5 minutes, and the client adds its own sessionStorage cache —
// both protect the free-tier ~150 points/day quota.

const MEAL_TYPE_MAP = {
  breakfast: 'breakfast',
  lunch: 'main course',
  dinner: 'main course',
  snack: 'snack',
  side: 'side dish',
  dessert: 'dessert',
  baked: 'bread', // closest Spoonacular type for "baked goods"
  any: null,
};

const DIETS = new Set([
  'vegetarian', 'vegan', 'gluten free', 'ketogenic', 'pescetarian', 'paleo',
]);

const INTOLERANCES = new Set([
  'dairy', 'egg', 'gluten', 'grain', 'peanut', 'seafood', 'sesame',
  'shellfish', 'soy', 'sulfite', 'tree nut', 'wheat',
]);

const CUISINES = new Set([
  'african', 'american', 'asian', 'british', 'cajun', 'caribbean', 'chinese',
  'eastern european', 'european', 'french', 'german', 'greek', 'indian',
  'irish', 'italian', 'japanese', 'jewish', 'korean', 'latin american',
  'mediterranean', 'mexican', 'middle eastern', 'nordic', 'southern',
  'spanish', 'thai', 'vietnamese',
]);

export default async function handler(req, res) {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'SPOONACULAR_API_KEY not configured on server' });
  }

  const mealType = String(req.query.mealType || 'any');
  const mode = String(req.query.mode || 'flexible');
  const cuisine = String(req.query.cuisine || '').toLowerCase().trim();
  const diet = String(req.query.diet || '').toLowerCase().trim();
  const intolerances = String(req.query.intolerances || '')
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const ingredients = String(req.query.ingredients || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // Free-text pantry ingredient that results MUST use ("finish what's left").
  // Only ever compared against ingredient names, never forwarded raw.
  const mustUse = String(req.query.mustUse || '').toLowerCase().trim().slice(0, 60);

  if (!Object.prototype.hasOwnProperty.call(MEAL_TYPE_MAP, mealType)) {
    return res.status(400).json({ error: `Invalid mealType: ${mealType}` });
  }
  if (mode !== 'strict' && mode !== 'flexible') {
    return res.status(400).json({ error: `Invalid mode: ${mode}` });
  }
  if (cuisine && !CUISINES.has(cuisine)) {
    return res.status(400).json({ error: `Invalid cuisine: ${cuisine}` });
  }
  if (diet && !DIETS.has(diet)) {
    return res.status(400).json({ error: `Invalid diet: ${diet}` });
  }
  for (const intolerance of intolerances) {
    if (!INTOLERANCES.has(intolerance)) {
      return res.status(400).json({ error: `Invalid intolerance: ${intolerance}` });
    }
  }

  try {
    // mustUse is filtered AFTER the search, so it only sees whatever window
    // Spoonacular returned. Widen the window when it's active, otherwise a
    // broad query (e.g. mealType=any) can paradoxically yield fewer matches
    // than a narrow one. Costs ~2 extra quota points per must-use search.
    const raw = await complexSearch({
      apiKey,
      type: MEAL_TYPE_MAP[mealType],
      ingredients,
      cuisine,
      diet,
      intolerances,
      number: mustUse ? 64 : 24,
    });

    const matching = mustUse
      ? raw.filter((r) =>
          (r.usedIngredients || []).some((ing) => {
            const name = String(ing.name || ing.originalName || '').toLowerCase();
            return name.includes(mustUse) || mustUse.includes(name);
          })
        )
      : raw;

    const normalized = matching.map(normalize);

    const result =
      mode === 'strict'
        ? normalized.filter((r) => r.missedIngredientCount === 0)
        : normalized.sort((a, b) => a.missedIngredientCount - b.missedIngredientCount);

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    res.status(200).json({ recipes: result });
  } catch (err) {
    console.error('recipes handler error', err);
    if (String(err.message || '').includes(' 402')) {
      // Spoonacular daily points exhausted — tell the client distinctly so the
      // UI can explain (the built-in catalog keeps working regardless).
      return res.status(429).json({ error: 'Spoonacular daily quota reached — resets at midnight UTC' });
    }
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
}

async function complexSearch({ apiKey, type, ingredients, cuisine, diet, intolerances, number = 24 }) {
  const url = new URL('https://api.spoonacular.com/recipes/complexSearch');
  url.searchParams.set('apiKey', apiKey);
  if (type) url.searchParams.set('type', type);
  if (ingredients.length) url.searchParams.set('includeIngredients', ingredients.join(','));
  if (cuisine) url.searchParams.set('cuisine', cuisine);
  if (diet) url.searchParams.set('diet', diet);
  if (intolerances.length) url.searchParams.set('intolerances', intolerances.join(','));
  url.searchParams.set('fillIngredients', 'true');
  url.searchParams.set('addRecipeInformation', 'true');
  url.searchParams.set('instructionsRequired', 'true');
  url.searchParams.set('sort', 'min-missing-ingredients');
  url.searchParams.set('number', String(number));

  const r = await fetch(url);
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Spoonacular complexSearch ${r.status}: ${body.slice(0, 200)}`);
  }
  const data = await r.json();
  return data.results || [];
}

function normalize(r) {
  const usedIngredients = r.usedIngredients || [];
  const missedIngredients = r.missedIngredients || [];
  const missedCount =
    typeof r.missedIngredientCount === 'number'
      ? r.missedIngredientCount
      : missedIngredients.length;
  const usedCount =
    typeof r.usedIngredientCount === 'number'
      ? r.usedIngredientCount
      : usedIngredients.length;

  return {
    id: r.id,
    title: r.title,
    image: r.image,
    sourceUrl: r.sourceUrl || null,
    readyInMinutes: r.readyInMinutes || null,
    servings: r.servings || null,
    summary: r.summary || null,
    dishTypes: r.dishTypes || [],
    cuisines: r.cuisines || [],
    diets: r.diets || [],
    vegetarian: Boolean(r.vegetarian),
    vegan: Boolean(r.vegan),
    glutenFree: Boolean(r.glutenFree),
    dairyFree: Boolean(r.dairyFree),
    usedIngredientCount: usedCount,
    missedIngredientCount: missedCount,
  };
}
