// GET /api/recipes?mealType=breakfast&mode=flexible&ingredients=eggs,milk,flour
//
// Server-side proxy for Spoonacular. Keeps SPOONACULAR_API_KEY out of the
// browser. Normalizes the response so the client just renders.

const MEAL_TYPE_MAP = {
  breakfast: 'breakfast',
  lunch: 'main course',
  dinner: 'main course',
  any: null,
};

export default async function handler(req, res) {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'SPOONACULAR_API_KEY not configured on server' });
  }

  const mealType = String(req.query.mealType || 'any');
  const mode = String(req.query.mode || 'flexible');
  const ingredientsParam = String(req.query.ingredients || '');
  const ingredients = ingredientsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!Object.prototype.hasOwnProperty.call(MEAL_TYPE_MAP, mealType)) {
    return res.status(400).json({ error: `Invalid mealType: ${mealType}` });
  }
  if (mode !== 'strict' && mode !== 'flexible') {
    return res.status(400).json({ error: `Invalid mode: ${mode}` });
  }

  const apiType = MEAL_TYPE_MAP[mealType];

  try {
    const raw = apiType
      ? await complexSearch({ apiKey, type: apiType, ingredients })
      : await findByIngredients({ apiKey, ingredients });

    const normalized = raw.map(normalize);

    const result =
      mode === 'strict'
        ? normalized.filter((r) => r.missedIngredientCount === 0)
        : normalized.sort((a, b) => a.missedIngredientCount - b.missedIngredientCount);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    res.status(200).json({ recipes: result });
  } catch (err) {
    console.error('recipes handler error', err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
}

async function complexSearch({ apiKey, type, ingredients }) {
  const url = new URL('https://api.spoonacular.com/recipes/complexSearch');
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('type', type);
  if (ingredients.length) url.searchParams.set('includeIngredients', ingredients.join(','));
  url.searchParams.set('fillIngredients', 'true');
  url.searchParams.set('addRecipeInformation', 'true');
  url.searchParams.set('instructionsRequired', 'true');
  url.searchParams.set('sort', 'min-missing-ingredients');
  url.searchParams.set('number', '24');

  const r = await fetch(url);
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Spoonacular complexSearch ${r.status}: ${body.slice(0, 200)}`);
  }
  const data = await r.json();
  return data.results || [];
}

async function findByIngredients({ apiKey, ingredients }) {
  const url = new URL('https://api.spoonacular.com/recipes/findByIngredients');
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('ingredients', ingredients.length ? ingredients.join(',') : 'salt');
  url.searchParams.set('number', '24');
  url.searchParams.set('ranking', '2');
  url.searchParams.set('ignorePantry', 'true');

  const r = await fetch(url);
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Spoonacular findByIngredients ${r.status}: ${body.slice(0, 200)}`);
  }
  return r.json();
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
    usedIngredientCount: usedCount,
    missedIngredientCount: missedCount,
  };
}
