// Taste preferences — powers "see more like this" / "see less like this".
//
// Doc shape (storage doc 'taste'):
//   {
//     liked:    { [recipeId]: { title, ts } },
//     disliked: { [recipeId]: { title, ts } },   // hard-hidden from results
//     cuisines: { italian: 3, ... },              // clamped to [-5, +5]
//     dishTypes:{ soup: 1, ... }                  // clamped to [-3, +3]
//   }
//
// Liking a recipe: +1 per cuisine, +0.5 per dishType. Disliking: the inverse,
// plus the recipe id is excluded from future result lists. Votes are mutually
// exclusive; voting the same way twice clears the vote.

import * as storage from '../storage/index.js';

const CUISINE_CLAMP = 5;
const DISHTYPE_CLAMP = 3;

const listeners = new Set();
let doc = empty();
let loaded = false;

function empty() {
  return { liked: {}, disliked: {}, cuisines: {}, dishTypes: {} };
}

function emit() {
  for (const fn of listeners) {
    try { fn(doc); } catch (e) { console.error('taste listener error', e); }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  if (loaded) fn(doc);
  return () => listeners.delete(fn);
}

export async function load() {
  doc = (await storage.getDoc('taste')) || empty();
  normalizeDoc();
  loaded = true;
  emit();
  storage.watchDoc('taste', (value) => {
    doc = value || empty();
    normalizeDoc();
    emit();
  });
  return doc;
}

function normalizeDoc() {
  doc.liked = doc.liked || {};
  doc.disliked = doc.disliked || {};
  doc.cuisines = doc.cuisines || {};
  doc.dishTypes = doc.dishTypes || {};
}

async function save() {
  await storage.setDoc('taste', doc);
}

function clamp(value, limit) {
  return Math.max(-limit, Math.min(limit, value));
}

function bump(map, keys, delta, limit) {
  for (const key of keys || []) {
    const k = String(key).toLowerCase();
    if (!k) continue;
    map[k] = clamp((map[k] || 0) + delta, limit);
    if (map[k] === 0) delete map[k];
  }
}

export function getVote(recipeId) {
  const id = String(recipeId);
  if (doc.liked[id]) return 'up';
  if (doc.disliked[id]) return 'down';
  return null;
}

export function isHidden(recipeId) {
  return Boolean(doc.disliked[String(recipeId)]);
}

export async function like(recipe) {
  const id = String(recipe.id);
  const prev = getVote(id);
  applyClear(recipe, prev);
  if (prev !== 'up') {
    doc.liked[id] = { title: recipe.title, ts: Date.now() };
    bump(doc.cuisines, recipe.cuisines, 1, CUISINE_CLAMP);
    bump(doc.dishTypes, recipe.dishTypes, 0.5, DISHTYPE_CLAMP);
  }
  await save();
  emit();
  return getVote(id);
}

export async function dislike(recipe) {
  const id = String(recipe.id);
  const prev = getVote(id);
  applyClear(recipe, prev);
  if (prev !== 'down') {
    doc.disliked[id] = { title: recipe.title, ts: Date.now() };
    bump(doc.cuisines, recipe.cuisines, -1, CUISINE_CLAMP);
    bump(doc.dishTypes, recipe.dishTypes, -0.5, DISHTYPE_CLAMP);
  }
  await save();
  emit();
  return getVote(id);
}

// Undo a vote's score effects (used when toggling or switching votes).
function applyClear(recipe, prevVote) {
  const id = String(recipe.id);
  if (prevVote === 'up') {
    delete doc.liked[id];
    bump(doc.cuisines, recipe.cuisines, -1, CUISINE_CLAMP);
    bump(doc.dishTypes, recipe.dishTypes, -0.5, DISHTYPE_CLAMP);
  } else if (prevVote === 'down') {
    delete doc.disliked[id];
    bump(doc.cuisines, recipe.cuisines, 1, CUISINE_CLAMP);
    bump(doc.dishTypes, recipe.dishTypes, 0.5, DISHTYPE_CLAMP);
  }
}

export async function clearVote(recipe) {
  applyClear(recipe, getVote(recipe.id));
  await save();
  emit();
}

// Affinity score used by the result ranker.
export function scoreFor(recipe) {
  let score = 0;
  const cuisines = (recipe.cuisines || []).map((c) => String(c).toLowerCase());
  const dishTypes = (recipe.dishTypes || []).map((d) => String(d).toLowerCase());
  if (cuisines.length) {
    score += cuisines.reduce((sum, c) => sum + (doc.cuisines[c] || 0), 0) / cuisines.length;
  }
  if (dishTypes.length) {
    score += 0.5 * (dishTypes.reduce((sum, d) => sum + (doc.dishTypes[d] || 0), 0) / dishTypes.length);
  }
  if (doc.liked[String(recipe.id)]) score += 1;
  return score;
}
