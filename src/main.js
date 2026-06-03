// App bootstrap: probe backend, render pantry, set up tab switching.

import * as pantry from './state/pantry.js';
import { checkBackend, isBackendConfigured, subscribe as subscribeBackend } from './state/backend.js';
import { render as renderPantry } from './ui/pantry.js';
import { render as renderRecipes } from './ui/recipes.js';

const PAGES = {
  pantry: { id: 'page-pantry', render: renderPantry, rendered: false },
  recipes: { id: 'page-recipes', render: renderRecipes, rendered: false },
};

function showTab(name) {
  for (const tabBtn of document.querySelectorAll('.tab')) {
    const active = tabBtn.dataset.tab === name;
    tabBtn.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  for (const [key, page] of Object.entries(PAGES)) {
    document.getElementById(page.id).classList.toggle('hidden', key !== name);
  }
  const page = PAGES[name];
  const section = document.getElementById(page.id);
  // Recipes page re-renders every visit (pantry may have changed).
  // Pantry subscribes to changes so first render suffices.
  if (name === 'recipes' || !page.rendered) {
    page.render(section);
    page.rendered = true;
  }
}

function renderConfigBanner() {
  const banner = document.getElementById('config-banner');
  if (!banner) return;
  if (isBackendConfigured()) {
    banner.classList.add('hidden');
    return;
  }
  banner.classList.remove('hidden');
  banner.innerHTML =
    '<span>Server isn\'t configured with a Spoonacular API key — pantry works, recipe search is disabled.</span>' +
    ' <a href="SETUP.md" target="_blank">How to set it up →</a>';
}

async function init() {
  for (const tabBtn of document.querySelectorAll('.tab')) {
    tabBtn.addEventListener('click', () => showTab(tabBtn.dataset.tab));
  }

  // Probe backend + load pantry concurrently — they're independent.
  await Promise.all([checkBackend(), pantry.load()]);
  renderConfigBanner();
  showTab('pantry');

  // If backend status changes later (e.g. user fixes env var + reload), re-render.
  subscribeBackend(() => {
    renderConfigBanner();
    // Force re-render of currently visible page so it picks up new state.
    PAGES.recipes.rendered = false;
  });
}

init().catch((err) => {
  console.error('iChef failed to start', err);
  document.body.innerHTML =
    '<div style="padding:40px;text-align:center;color:#b04848;font-family:sans-serif">' +
    'iChef failed to start. Check the console for details.</div>';
});
