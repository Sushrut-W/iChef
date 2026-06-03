// GET /api/recipe/:id
// Full recipe info for the detail view.

export default async function handler(req, res) {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'SPOONACULAR_API_KEY not configured on server' });
  }

  const { id } = req.query;
  if (!id || !/^\d+$/.test(String(id))) {
    return res.status(400).json({ error: 'Invalid recipe id' });
  }

  const url = new URL(`https://api.spoonacular.com/recipes/${id}/information`);
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('includeNutrition', 'false');

  try {
    const r = await fetch(url);
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      return res.status(r.status).json({
        error: `Spoonacular ${r.status}`,
        detail: body.slice(0, 300),
      });
    }
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json(data);
  } catch (err) {
    console.error('recipe detail error', err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
