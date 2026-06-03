// Recipes browse page.

import { findRecipes, BackendError } from '../api/recipes.js';
import * as pantry from '../state/pantry.js';
import { isBackendConfigured } from '../state/backend.js';
import { el, clear } from './common.js';
import { openRecipeDetail } from './recipeDetail.js';

const state = {
  mealType: 'any',
  mode: 'flexible',
};

export function render(container) {
  clear(container);

  container.appendChild(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('h1', {}, ['Find Recipes']),
        el('p', { class: 'muted' }, ['Recipes ranked by how many of your pantry items they use.']),
      ]),
    ])
  );

  if (!isBackendConfigured()) {
    container.appendChild(renderConfigureGate());
    return;
  }

  container.appendChild(renderControls());

  const resultsContainer = el('div', { id: 'recipe-results' });
  container.appendChild(resultsContainer);

  loadAndRender(resultsContainer);
}

function renderControls() {
  const mealSeg = el('div', { class: 'segmented', role: 'tablist' });
  for (const meal of ['breakfast', 'lunch', 'dinner', 'any']) {
    const btn = el('button', {
      class: meal === state.mealType ? 'active' : '',
      onclick: () => {
        state.mealType = meal;
        for (const child of mealSeg.children) {
          child.classList.toggle('active', child.dataset.value === meal);
        }
        loadAndRender(document.getElementById('recipe-results'));
      },
      dataset: { value: meal },
    }, [meal[0].toUpperCase() + meal.slice(1)]);
    mealSeg.appendChild(btn);
  }

  const modeSeg = el('div', { class: 'segmented' });
  for (const m of ['flexible', 'strict']) {
    const label = m === 'flexible' ? 'Flexible' : 'Strict';
    const btn = el('button', {
      class: m === state.mode ? 'active' : '',
      onclick: () => {
        state.mode = m;
        for (const child of modeSeg.children) {
          child.classList.toggle('active', child.dataset.value === m);
        }
        loadAndRender(document.getElementById('recipe-results'));
      },
      dataset: { value: m },
    }, [label]);
    modeSeg.appendChild(btn);
  }

  return el('div', { class: 'recipe-controls' }, [
    mealSeg,
    el('div', { class: 'mode-toggle' }, [el('span', {}, ['Mode:']), modeSeg]),
  ]);
}

async function loadAndRender(container) {
  if (!container) return;
  clear(container);

  const haveCount = pantry.getHaveItems().length;
  if (haveCount === 0) {
    container.appendChild(
      el('div', { class: 'empty-state' }, [
        el('h3', {}, ['Pantry is empty']),
        el('p', {}, ["Add a few ingredients first — head to the Pantry tab."]),
      ])
    );
    return;
  }

  container.appendChild(el('div', { class: 'loading' }, ['Finding recipes…']));

  try {
    const recipes = await findRecipes({ mealType: state.mealType, mode: state.mode });
    clear(container);

    if (!recipes.length) {
      const isStrict = state.mode === 'strict';
      container.appendChild(
        el('div', { class: 'empty-state' }, [
          el('h3', {}, [isStrict ? 'No exact matches' : 'No recipes found']),
          el('p', {}, [
            isStrict
              ? 'No recipes use only what you have. Switch to Flexible mode or add more ingredients.'
              : 'Try a different meal type or add more ingredients.',
          ]),
        ])
      );
      return;
    }

    const grid = el('div', { class: 'recipe-grid' });
    for (const recipe of recipes) {
      grid.appendChild(renderCard(recipe));
    }
    container.appendChild(grid);
  } catch (err) {
    clear(container);
    if (err instanceof BackendError && err.isNotConfigured) {
      container.appendChild(renderConfigureGate());
      return;
    }
    console.error(err);
    container.appendChild(
      el('div', { class: 'error' }, [`Couldn't load recipes: ${err.message || err}`])
    );
  }
}

function renderCard(recipe) {
  const badges = el('div', { class: 'badges' }, [
    el('span', { class: 'badge good' }, [`${recipe.usedIngredientCount} from pantry`]),
    recipe.missedIngredientCount === 0
      ? el('span', { class: 'badge muted' }, ['ready to cook'])
      : el('span', { class: 'badge warn' }, [`${recipe.missedIngredientCount} missing`]),
  ]);

  return el('article', {
    class: 'recipe-card',
    onclick: () => openRecipeDetail(recipe.id),
  }, [
    recipe.image
      ? el('img', { src: recipe.image, alt: recipe.title, loading: 'lazy' })
      : el('div', { class: 'placeholder' }),
    el('div', { class: 'body' }, [el('h3', {}, [recipe.title]), badges]),
  ]);
}

function renderConfigureGate() {
  return el('div', { class: 'empty-state' }, [
    el('h3', {}, ['Backend not configured']),
    el('p', {}, [
      'The Spoonacular API key needs to be set on the server. See ',
      el('a', { href: 'SETUP.md', target: '_blank' }, ['SETUP.md']),
      ' for the steps (it takes about a minute).',
    ]),
  ]);
}
