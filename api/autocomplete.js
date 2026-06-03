// GET /api/autocomplete?q=eg
// Ingredient-name suggestions for the pantry add form.

export default async function handler(req, res) {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'SPOONACULAR_API_KEY not configured on server' });
  }

  const q = String(req.query.q || '').trim();
  if (q.length < 2) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json([]);
  }

  const url = new URL('https://api.spoonacular.com/food/ingredients/autocomplete');
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('query', q);
  url.searchParams.set('number', '8');
  url.searchParams.set('metaInformation', 'false');

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
    console.error('autocomplete error', err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
