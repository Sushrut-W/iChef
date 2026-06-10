// Recipes browse page: Discover (live search) + Favorites sub-tabs.

import { findRecipes, BackendError } from '../api/recipes.js';
import * as pantry from '../state/pantry.js';
import * as favorites from '../state/favorites.js';
import * as taste from '../state/taste.js';
import * as settings from '../state/settings.js';
import { isBackendConfigured } from '../state/backend.js';
import { rankRecipes } from '../lib/rank.js';
import { el, clear, toast } from './common.js';
import { openRecipeDetail } from './recipeDetail.js';

const CUISINE_OPTIONS = [
  'african', 'american', 'asian', 'british', 'cajun', 'caribbean', 'chinese',
  'eastern european', 'european', 'french', 'german', 'greek', 'indian',
  'irish', 'italian', 'japanese', 'jewish', 'korean', 'latin american',
  'mediterranean', 'mexican', 'middle eastern', 'nordic', 'southern',
  'spanish', 'thai', 'vietnamese',
];

const DIET_OPTIONS = ['vegetarian', 'vegan', 'gluten free', 'ketogenic', 'pescetarian', 'paleo'];
const INTOLERANCE_OPTIONS = ['dairy', 'gluten', 'egg', 'peanut', 'shellfish', 'soy', 'tree nut'];

let subTab = 'discover';
let lastResults = []; // raw server results, re-ranked locally on vote changes

export function render(container) {
  clear(container);

  container.appendChild(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('h1', {}, ['Find Recipes']),
        el('p', { class: 'muted' }, ['Ranked by how many of your pantry items they use — tune results with 👍 and 👎.']),
      ]),
    ])
  );

  if (!isBackendConfigured() && subTab === 'discover' && !favorites.getAll().length) {
    container.appendChild(renderConfigureGate());
    return;
  }

  const subtabs = el('div', { class: 'subtabs' });
  for (const [key, label] of [['discover', 'Discover'], ['favorites', `Favorites`]]) {
    subtabs.appendChild(
      el('button', {
        class: key === subTab ? 'active' : '',
        onclick: () => {
          subTab = key;
          render(container);
        },
      }, [label])
    );
  }
  container.appendChild(subtabs);

  if (subTab === 'favorites') {
    renderFavoritesView(container);
    return;
  }

  if (!isBackendConfigured()) {
    container.appendChild(renderConfigureGate());
    return;
  }

  container.appendChild(renderControls(container));

  const resultsContainer = el('div', { id: 'recipe-results' });
  container.appendChild(resultsContainer);

  loadAndRender(resultsContainer);
}

// ---------- Controls ----------

function renderControls(pageContainer) {
  const s = settings.get();

  const onChange = async (partial) => {
    await settings.update(partial);
    loadAndRender(document.getElementById('recipe-results'));
  };

  const mealSeg = segmented(
    ['breakfast', 'lunch', 'dinner', 'any'],
    s.mealType,
    (v) => onChange({ mealType: v }),
    (v) => v[0].toUpperCase() + v.slice(1)
  );

  const modeSeg = segmented(
    ['flexible', 'strict'],
    s.mode,
    (v) => onChange({ mode: v }),
    (v) => (v === 'flexible' ? 'Flexible' : 'Strict')
  );
  modeSeg.classList.add('subtle');

  const cuisineSelect = el('select', { 'aria-label': 'Cuisine' });
  cuisineSelect.appendChild(el('option', { value: '' }, ['Any cuisine']));
  for (const c of CUISINE_OPTIONS) {
    const opt = el('option', { value: c }, [c[0].toUpperCase() + c.slice(1)]);
    if (c === s.cuisine) opt.selected = true;
    cuisineSelect.appendChild(opt);
  }
  cuisineSelect.addEventListener('change', () => onChange({ cuisine: cuisineSelect.value }));

  const groupChip = el('button', {
    class: 'chip' + (s.groupByCuisine ? ' active' : ''),
    onclick: async () => {
      await settings.update({ groupByCuisine: !settings.get().groupByCuisine });
      groupChip.classList.toggle('active', settings.get().groupByCuisine);
      // Grouping is presentation-only — re-render from cached results.
      renderResults(document.getElementById('recipe-results'));
    },
  }, ['Group by cuisine']);

  const dietSelect = el('select', { 'aria-label': 'Diet' });
  dietSelect.appendChild(el('option', { value: '' }, ['Any diet']));
  for (const d of DIET_OPTIONS) {
    const opt = el('option', { value: d }, [d[0].toUpperCase() + d.slice(1)]);
    if (d === s.diet) opt.selected = true;
    dietSelect.appendChild(opt);
  }
  dietSelect.addEventListener('change', () => onChange({ diet: dietSelect.value }));

  const intoleranceChips = el('div', { class: 'chip-row' });
  for (const tag of INTOLERANCE_OPTIONS) {
    const active = (s.intolerances || []).includes(tag);
    intoleranceChips.appendChild(
      el('button', {
        class: 'chip' + (active ? ' active' : ''),
        title: `Exclude recipes containing ${tag}`,
        onclick: async () => {
          const current = settings.get().intolerances || [];
          const next = current.includes(tag)
            ? current.filter((t) => t !== tag)
            : [...current, tag];
          // Full page re-render refreshes chip states and reloads results once.
          await settings.update({ intolerances: next });
          render(pageContainer);
        },
      }, [`no ${tag}`])
    );
  }

  return el('div', {}, [
    el('div', { class: 'recipe-controls' }, [
      mealSeg,
      el('div', { class: 'control-group' }, [el('span', { class: 'control-label' }, ['Mode']), modeSeg]),
      cuisineSelect,
      dietSelect,
      groupChip,
    ]),
    el('div', { class: 'recipe-controls' }, [
      el('span', { class: 'control-label' }, ['Avoid:']),
      intoleranceChips,
    ]),
  ]);
}

function segmented(values, current, onPick, labelFor) {
  const seg = el('div', { class: 'segmented', role: 'tablist' });
  for (const value of values) {
    const btn = el('button', {
      class: value === current ? 'active' : '',
      dataset: { value },
      onclick: () => {
        for (const child of seg.children) {
          child.classList.toggle('active', child.dataset.value === value);
        }
        onPick(value);
      },
    }, [labelFor(value)]);
    seg.appendChild(btn);
  }
  return seg;
}

// ---------- Discover results ----------

async function loadAndRender(container) {
  if (!container) return;
  clear(container);

  const haveCount = pantry.getHaveItems().length;
  if (haveCount === 0) {
    container.appendChild(
      el('div', { class: 'empty-state' }, [
        el('span', { class: 'icon' }, ['🧺']),
        el('h3', {}, ['Pantry is empty']),
        el('p', {}, ["Add a few ingredients first — head to the Pantry tab."]),
      ])
    );
    return;
  }

  container.appendChild(el('div', { class: 'loading' }, ['Finding recipes…']));

  const s = settings.get();
  try {
    lastResults = await findRecipes({
      mealType: s.mealType,
      mode: s.mode,
      cuisine: s.cuisine,
      diet: s.diet,
      intolerances: s.intolerances,
    });
    renderResults(container);
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

function renderResults(container) {
  clear(container);
  const s = settings.get();
  const { visible, hidden } = rankRecipes(lastResults, s.mode);

  if (!visible.length) {
    const isStrict = s.mode === 'strict';
    container.appendChild(
      el('div', { class: 'empty-state' }, [
        el('h3', {}, [isStrict ? 'No exact matches' : 'No recipes found']),
        el('p', {}, [
          isStrict
            ? 'No recipes use only what you have. Switch to Flexible mode, loosen filters, or add more ingredients.'
            : 'Try a different meal type, loosen the filters, or add more ingredients.',
        ]),
      ])
    );
  } else if (s.groupByCuisine) {
    for (const [cuisine, group] of groupByCuisine(visible)) {
      const section = el('div', { class: 'cuisine-section' }, [
        el('h2', {}, [
          cuisine,
          ' ',
          el('span', { class: 'count' }, [`· ${group.length}`]),
        ]),
      ]);
      section.appendChild(renderGrid(group, container));
      container.appendChild(section);
    }
  } else {
    container.appendChild(renderGrid(visible, container));
  }

  if (hidden.length) {
    container.appendChild(
      el('div', { class: 'hidden-note' }, [
        `${hidden.length} recipe${hidden.length === 1 ? '' : 's'} hidden because you said "less like this". `,
        el('button', {
          class: 'btn ghost small',
          onclick: async () => {
            for (const recipe of hidden) await taste.clearVote(recipe);
            renderResults(container);
          },
        }, ['Show them']),
      ])
    );
  }
}

function groupByCuisine(recipes) {
  const groups = new Map();
  for (const recipe of recipes) {
    const cuisine = recipe.cuisines && recipe.cuisines.length
      ? capitalize(recipe.cuisines[0])
      : 'Other';
    if (!groups.has(cuisine)) groups.set(cuisine, []);
    groups.get(cuisine).push(recipe);
  }
  // Alphabetical, but "Other" always last.
  return [...groups.entries()].sort((a, b) => {
    if (a[0] === 'Other') return 1;
    if (b[0] === 'Other') return -1;
    return a[0].localeCompare(b[0]);
  });
}

function capitalize(s) {
  return String(s).replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderGrid(recipes, resultsContainer) {
  const grid = el('div', { class: 'recipe-grid' });
  for (const recipe of recipes) {
    grid.appendChild(renderCard(recipe, resultsContainer));
  }
  return grid;
}

// ---------- Cards ----------

function renderCard(recipe, resultsContainer) {
  const favBtn = el('button', {
    class: 'fav-btn' + (favorites.isFavorite(recipe.id) ? ' active' : ''),
    'aria-label': 'Save to favorites',
    title: 'Save to favorites',
    onclick: async (e) => {
      e.stopPropagation();
      const nowFav = await favorites.toggle(recipe);
      favBtn.classList.toggle('active', nowFav);
      toast(nowFav ? 'Saved to favorites' : 'Removed from favorites');
    },
  }, ['★']);

  const badges = el('div', { class: 'badges' }, [
    el('span', { class: 'badge good' }, [`${recipe.usedIngredientCount} from pantry`]),
    recipe.missedIngredientCount === 0
      ? el('span', { class: 'badge muted' }, ['ready to cook'])
      : el('span', { class: 'badge warn' }, [`${recipe.missedIngredientCount} missing`]),
    recipe.cuisines && recipe.cuisines.length
      ? el('span', { class: 'badge cuisine' }, [recipe.cuisines[0]])
      : null,
    recipe.vegan
      ? el('span', { class: 'badge diet' }, ['vegan'])
      : recipe.vegetarian
        ? el('span', { class: 'badge diet' }, ['veg'])
        : null,
    recipe.glutenFree ? el('span', { class: 'badge diet' }, ['GF']) : null,
  ]);

  const card = el('article', {
    class: 'recipe-card',
    onclick: () => openRecipeDetail(recipe.id, recipe),
  }, [
    el('div', { class: 'img-wrap' }, [
      recipe.image
        ? el('img', { src: recipe.image, alt: recipe.title, loading: 'lazy' })
        : el('div', { class: 'placeholder' }),
      favBtn,
    ]),
    el('div', { class: 'body' }, [
      el('h3', {}, [recipe.title]),
      badges,
      renderCardFooter(recipe, card_dismiss),
    ]),
  ]);

  function card_dismiss() {
    card.classList.add('dismissing');
    setTimeout(() => {
      if (resultsContainer) renderResults(resultsContainer);
    }, 260);
  }

  return card;
}

function renderCardFooter(recipe, onDismiss) {
  const vote = taste.getVote(recipe.id);

  const upBtn = el('button', {
    class: 'vote-btn up' + (vote === 'up' ? ' active' : ''),
    'aria-label': 'See more like this',
    title: 'See more like this',
    onclick: async (e) => {
      e.stopPropagation();
      const newVote = await taste.like(recipe);
      upBtn.classList.toggle('active', newVote === 'up');
      downBtn.classList.remove('active');
      toast(newVote === 'up' ? `More like "${recipe.title}" coming up` : 'Preference cleared');
    },
  }, ['👍']);

  const downBtn = el('button', {
    class: 'vote-btn down' + (vote === 'down' ? ' active' : ''),
    'aria-label': 'See less like this',
    title: 'See less like this',
    onclick: async (e) => {
      e.stopPropagation();
      const newVote = await taste.dislike(recipe);
      if (newVote === 'down') {
        toast(`Got it — hiding "${recipe.title}"`);
        onDismiss();
      } else {
        downBtn.classList.remove('active');
        toast('Preference cleared');
      }
    },
  }, ['👎']);

  return el('div', { class: 'card-footer' }, [
    el('span', { class: 'meta' }, [recipe.readyInMinutes ? `⏱ ${recipe.readyInMinutes} min` : '']),
    el('div', { class: 'vote-btns' }, [upBtn, downBtn]),
  ]);
}

// ---------- Favorites ----------

function renderFavoritesView(container) {
  const body = el('div');
  container.appendChild(body);

  function renderFavs() {
    clear(body);
    const favs = favorites.getAll();
    if (!favs.length) {
      body.appendChild(
        el('div', { class: 'empty-state' }, [
          el('span', { class: 'icon' }, ['⭐']),
          el('h3', {}, ['No favorites yet']),
          el('p', {}, ['Tap the ★ on any recipe to save it here — favorites work even offline.']),
        ])
      );
      return;
    }
    const grid = el('div', { class: 'recipe-grid' });
    for (const fav of favs) {
      grid.appendChild(renderFavoriteCard(fav, renderFavs));
    }
    body.appendChild(grid);
  }

  renderFavs();
}

function renderFavoriteCard(fav, rerender) {
  const favBtn = el('button', {
    class: 'fav-btn active',
    'aria-label': 'Remove from favorites',
    title: 'Remove from favorites',
    onclick: async (e) => {
      e.stopPropagation();
      await favorites.toggle(fav);
      toast('Removed from favorites');
      rerender();
    },
  }, ['★']);

  return el('article', {
    class: 'recipe-card',
    onclick: () => openRecipeDetail(fav.id, fav),
  }, [
    el('div', { class: 'img-wrap' }, [
      fav.image
        ? el('img', { src: fav.image, alt: fav.title, loading: 'lazy' })
        : el('div', { class: 'placeholder' }),
      favBtn,
    ]),
    el('div', { class: 'body' }, [
      el('h3', {}, [fav.title]),
      el('div', { class: 'badges' }, [
        fav.cuisines && fav.cuisines.length
          ? el('span', { class: 'badge cuisine' }, [fav.cuisines[0]])
          : null,
        fav.readyInMinutes ? el('span', { class: 'badge muted' }, [`${fav.readyInMinutes} min`]) : null,
      ]),
    ]),
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
