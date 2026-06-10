// App bootstrap: init storage, probe backend, load state, wire navigation.

import * as storage from './storage/index.js';
import * as pantry from './state/pantry.js';
import * as shopping from './state/shopping.js';
import * as favorites from './state/favorites.js';
import * as history from './state/history.js';
import * as taste from './state/taste.js';
import * as settings from './state/settings.js';
import { checkBackend, isBackendConfigured, subscribe as subscribeBackend } from './state/backend.js';
import { render as renderPantry } from './ui/pantry.js';
import { render as renderRecipes } from './ui/recipes.js';
import { render as renderShopping } from './ui/shopping.js';
import { render as renderHistory } from './ui/history.js';
import { mountThemeToggle } from './ui/theme.js';
import { mountSyncButton } from './ui/sync.js';

const PAGES = {
  pantry: { id: 'page-pantry', render: renderPantry, rendered: false },
  recipes: { id: 'page-recipes', render: renderRecipes, rendered: false },
  shopping: { id: 'page-shopping', render: renderShopping, rendered: false },
  history: { id: 'page-history', render: renderHistory, rendered: false },
};

function showTab(name, { updateHash = true } = {}) {
  if (!PAGES[name]) name = 'pantry';
  for (const tabBtn of document.querySelectorAll('.tab')) {
    const active = tabBtn.dataset.tab === name;
    tabBtn.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  for (const [key, page] of Object.entries(PAGES)) {
    document.getElementById(page.id).classList.toggle('hidden', key !== name);
  }
  const page = PAGES[name];
  const section = document.getElementById(page.id);
  // Recipes re-renders every visit (pantry may have changed); other pages
  // subscribe to their state so first render suffices.
  if (name === 'recipes' || !page.rendered) {
    page.render(section);
    page.rendered = true;
  }
  if (updateHash && location.hash !== `#${name}`) {
    window.history.replaceState(null, '', `#${name}`);
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
    '<span>No Spoonacular key configured — recipe search uses the built-in catalog (~650 recipes). Add a key for the full web search.</span>' +
    ' <a href="SETUP.md" target="_blank">How to set it up →</a>';
}

function renderShoppingBadge(items) {
  const badge = document.getElementById('shopping-badge');
  if (!badge) return;
  const count = items.filter((i) => !i.checked).length;
  badge.textContent = String(count);
  badge.classList.toggle('hidden', count === 0);
}

async function init() {
  for (const tabBtn of document.querySelectorAll('.tab')) {
    tabBtn.addEventListener('click', () => showTab(tabBtn.dataset.tab));
  }
  window.addEventListener('hashchange', () => {
    showTab(location.hash.replace('#', ''), { updateHash: false });
  });

  const actions = document.getElementById('header-actions');
  if (actions) {
    mountThemeToggle(actions);
    mountSyncButton(actions);
  }

  await storage.init();
  // Backend probe runs concurrently with state loads — they're independent.
  await Promise.all([
    checkBackend(),
    pantry.load(),
    shopping.load(),
    favorites.load(),
    history.load(),
    taste.load(),
    settings.load(),
  ]);

  shopping.subscribe(renderShoppingBadge);
  renderConfigBanner();
  showTab(location.hash.replace('#', '') || 'pantry', { updateHash: false });

  // If backend status changes later (e.g. user fixes env var + reload), re-render.
  subscribeBackend(() => {
    renderConfigBanner();
    PAGES.recipes.rendered = false;
  });
}

init().catch((err) => {
  console.error('iChef failed to start', err);
  document.body.innerHTML =
    '<div style="padding:40px;text-align:center;color:#b04848;font-family:sans-serif">' +
    'iChef failed to start. Check the console for details.</div>';
});
