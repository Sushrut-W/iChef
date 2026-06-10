// One-time builder: downloads TheMealDB's full free catalog and writes it to
// data/catalog.json in iChef's normalized recipe shape.
//
//   node scripts/build-catalog.mjs
//
// TheMealDB (https://www.themealdb.com) is free for development/educational
// use with test key "1". Recipes are enumerated via search.php?f=a..z.
// Re-run any time to refresh the catalog.

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://www.themealdb.com/api/json/v1/1';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'catalog.json');

function normalizeMeal(meal) {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal[`strIngredient${i}`] || '').trim();
    if (!name) continue;
    const measure = (meal[`strMeasure${i}`] || '').trim();
    ingredients.push({ n: name.toLowerCase(), m: measure });
  }

  const steps = String(meal.strInstructions || '')
    .split(/\r?\n+/)
    .map((s) => s.replace(/^\s*(step\s*)?\d+[).:-]?\s*/i, '').trim())
    .filter((s) => s.length > 3);

  return {
    id: `mdb-${meal.idMeal}`,
    title: meal.strMeal,
    image: meal.strMealThumb || null,
    category: (meal.strCategory || '').toLowerCase(),
    area: (meal.strArea || '').toLowerCase().replace(/^unknown$/, ''),
    tags: (meal.strTags || '').toLowerCase().split(',').map((t) => t.trim()).filter(Boolean),
    sourceUrl: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
    ingredients,
    steps,
  };
}

async function fetchLetter(letter) {
  const res = await fetch(`${API}/search.php?f=${letter}`);
  if (!res.ok) throw new Error(`search.php?f=${letter} -> HTTP ${res.status}`);
  const data = await res.json();
  return data.meals || [];
}

const all = new Map();
for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
  const meals = await fetchLetter(letter);
  for (const meal of meals) {
    const normalized = normalizeMeal(meal);
    all.set(normalized.id, normalized);
  }
  process.stdout.write(`${letter}: ${meals.length}  `);
}

const recipes = [...all.values()].sort((a, b) => a.title.localeCompare(b.title));
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ source: 'TheMealDB', builtAt: new Date().toISOString(), recipes }));
console.log(`\nWrote ${recipes.length} recipes -> ${OUT}`);
