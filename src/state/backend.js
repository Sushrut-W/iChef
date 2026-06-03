// Tracks whether the backend has its Spoonacular API key configured.
// Used by the UI to show the "set up your key" banner and to disable
// recipe-related features gracefully.

import { fetchHealth } from '../api/backend.js';

let configured = null;
const listeners = new Set();

export async function checkBackend() {
  try {
    const data = await fetchHealth();
    configured = Boolean(data && data.configured);
  } catch {
    configured = false;
  }
  for (const fn of listeners) {
    try { fn(configured); } catch (e) { console.error(e); }
  }
  return configured;
}

export function isBackendConfigured() {
  return configured === true;
}

export function subscribe(fn) {
  listeners.add(fn);
  if (configured !== null) fn(configured);
  return () => listeners.delete(fn);
}
