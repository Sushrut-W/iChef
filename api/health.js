// GET /api/health
// Lightweight check — frontend uses this to decide whether to show
// the "configure your key" banner.

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    configured: Boolean(process.env.SPOONACULAR_API_KEY),
  });
}
