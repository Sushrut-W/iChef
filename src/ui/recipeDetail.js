// Recipe detail modal + "I cooked this!" flow.

import { getRecipeDetail, BackendError } from '../api/recipes.js';
import * as pantry from '../state/pantry.js';
import * as shopping from '../state/shopping.js';
import * as favorites from '../state/favorites.js';
import * as history from '../state/history.js';
import * as taste from '../state/taste.js';
import { el, clear, openModal, closeModal, modalHeader, toast } from './common.js';

// `snapshot` (optional) is a denormalized recipe summary (from a favorite or
// history entry) so the modal can show a meaningful title immediately.
export async function openRecipeDetail(recipeId, snapshot = null) {
  openModal((modal, close) => {
    modal.appendChild(modalHeader(snapshot?.title || 'Loading…', close));
    const body = el('div', { class: 'modal-body' }, [
      el('div', { class: 'loading' }, ['Loading recipe…']),
    ]);
    modal.appendChild(body);

    getRecipeDetail(recipeId)
      .then((recipe) => {
        clear(modal);
        modal.appendChild(modalHeader(recipe.title, close, headerButtons(recipe)));
        modal.appendChild(renderBody(recipe));
      })
      .catch((err) => {
        clear(modal);
        modal.appendChild(modalHeader(snapshot?.title || 'Recipe', close));
        if (err instanceof BackendError && err.isNotConfigured) {
          modal.appendChild(
            el('div', { class: 'modal-body' }, [
              el('p', {}, ['Backend is not configured. See SETUP.md.']),
            ])
          );
        } else {
          modal.appendChild(
            el('div', { class: 'modal-body' }, [
              el('div', { class: 'error' }, [err.message || String(err)]),
            ])
          );
        }
      });
  });
}

function headerButtons(recipe) {
  const favBtn = el('button', {
    class: 'icon-btn',
    'aria-label': 'Save to favorites',
    title: 'Save to favorites',
  }, ['★']);
  const refreshFav = () => {
    favBtn.style.color = favorites.isFavorite(recipe.id) ? 'var(--star)' : '';
  };
  favBtn.addEventListener('click', async () => {
    const nowFav = await favorites.toggle(recipe);
    refreshFav();
    toast(nowFav ? 'Saved to favorites' : 'Removed from favorites');
  });
  refreshFav();

  const upBtn = el('button', { class: 'icon-btn', 'aria-label': 'See more like this', title: 'See more like this' }, ['👍']);
  const downBtn = el('button', { class: 'icon-btn', 'aria-label': 'See less like this', title: 'See less like this' }, ['👎']);
  const refreshVotes = () => {
    const vote = taste.getVote(recipe.id);
    upBtn.style.color = vote === 'up' ? 'var(--good)' : '';
    downBtn.style.color = vote === 'down' ? 'var(--warn)' : '';
  };
  upBtn.addEventListener('click', async () => {
    const vote = await taste.like(recipe);
    refreshVotes();
    toast(vote === 'up' ? 'Got it — more like this' : 'Preference cleared');
  });
  downBtn.addEventListener('click', async () => {
    const vote = await taste.dislike(recipe);
    refreshVotes();
    toast(vote === 'down' ? 'Got it — less like this' : 'Preference cleared');
  });
  refreshVotes();

  return [favBtn, upBtn, downBtn];
}

function renderBody(recipe) {
  const body = el('div', { class: 'modal-body' });

  if (recipe.image) {
    body.appendChild(el('img', { class: 'hero', src: recipe.image, alt: recipe.title }));
  }

  const meta = el('div', { class: 'recipe-meta' });
  if (recipe.readyInMinutes) meta.appendChild(el('span', {}, [`⏱ ${recipe.readyInMinutes} min`]));
  if (recipe.servings) meta.appendChild(el('span', {}, [`🍽 ${recipe.servings} servings`]));
  if (recipe.cuisines && recipe.cuisines.length) {
    meta.appendChild(el('span', { style: 'text-transform:capitalize' }, [recipe.cuisines.join(', ')]));
  }
  if (recipe.sourceUrl) {
    meta.appendChild(
      el('a', { href: recipe.sourceUrl, target: '_blank', rel: 'noopener' }, ['Original recipe ↗'])
    );
  }
  if (meta.children.length) body.appendChild(meta);

  if (recipe.summary) {
    const plain = recipe.summary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (plain) body.appendChild(el('p', { class: 'muted' }, [plain]));
  }

  body.appendChild(el('h3', {}, ['Ingredients']));
  const ul = el('ul', { class: 'ingredient-list' });
  for (const ing of recipe.ingredients) {
    ul.appendChild(
      el('li', { class: ing.inPantry ? 'have' : 'missing' }, [
        el('span', {}, [ing.original || ing.name]),
        el('span', { class: 'tag' }, [ing.inPantry ? 'in pantry' : 'missing']),
      ])
    );
  }
  body.appendChild(ul);

  const missing = recipe.ingredients.filter((i) => !i.inPantry);
  if (missing.length) {
    body.appendChild(
      el('button', {
        class: 'btn',
        style: 'margin-top: 12px;',
        onclick: async (e) => {
          e.target.disabled = true;
          const added = await shopping.addMany(missing.map((i) => i.name), recipe.title);
          toast(
            added
              ? `Added ${added} item${added === 1 ? '' : 's'} to your shopping list`
              : 'All missing items are already on your list'
          );
        },
      }, [`🛒 Add ${missing.length} missing to shopping list`])
    );
  }

  if (recipe.steps.length) {
    body.appendChild(el('h3', {}, ['Steps']));
    const ol = el('ol', { class: 'steps' });
    for (const step of recipe.steps) ol.appendChild(el('li', {}, [step]));
    body.appendChild(ol);
  }

  body.appendChild(renderCookPanel(recipe));

  return body;
}

function renderCookPanel(recipe) {
  const pantryByName = new Map(
    pantry.getAll().map((i) => [i.name.toLowerCase(), i])
  );

  const matches = recipe.ingredients
    .map((ing) => {
      const name = (ing.name || '').toLowerCase();
      let match = pantryByName.get(name);
      if (!match) {
        for (const [pn, p] of pantryByName.entries()) {
          if (name.includes(pn) || pn.includes(name)) {
            match = p;
            break;
          }
        }
      }
      return match ? { ing, pantryItem: match } : null;
    })
    .filter(Boolean);

  if (!matches.length) {
    return el('div', { class: 'cook-panel' }, [
      el('h3', {}, ['Cooked this?']),
      el('p', { class: 'muted' }, [
        'None of these ingredients match items in your pantry. Add them on the Pantry tab first.',
      ]),
    ]);
  }

  const localState = new Map(matches.map(({ pantryItem }) => [pantryItem.id, 'have']));

  const panel = el('div', { class: 'cook-panel' });
  panel.appendChild(el('h3', {}, ['I cooked this!']));
  panel.appendChild(
    el('p', { class: 'muted' }, [
      'For each ingredient you used, mark whether you still have any left or you ran out.',
    ])
  );

  const list = el('ul', { class: 'ingredient-list' });
  for (const { pantryItem } of matches) {
    const row = el('li', { class: 'have' });
    row.appendChild(el('span', {}, [pantryItem.name]));

    const toggle = el('div', { class: 'status-toggle' });
    const haveBtn = el('button', {
      class: 'have active',
      onclick: () => {
        localState.set(pantryItem.id, 'have');
        haveBtn.classList.add('active');
        outBtn.classList.remove('active');
      },
    }, ['Still have']);
    const outBtn = el('button', {
      class: 'out',
      onclick: () => {
        localState.set(pantryItem.id, 'out');
        outBtn.classList.add('active');
        haveBtn.classList.remove('active');
      },
    }, ['Out']);
    toggle.append(haveBtn, outBtn);
    row.appendChild(toggle);
    list.appendChild(row);
  }
  panel.appendChild(list);

  const saveBtn = el('button', {
    class: 'btn primary',
    style: 'margin-top: 12px;',
    onclick: async () => {
      saveBtn.disabled = true;
      let outCount = 0;
      for (const [id, status] of localState.entries()) {
        if (status === 'out') {
          await pantry.setStatus(id, false);
          outCount++;
        } else {
          await pantry.setStatus(id, true);
        }
      }
      await history.logCook(recipe);
      toast(outCount ? `Updated pantry — ${outCount} marked Out` : 'Pantry updated');
      closeModal();
    },
  }, ['Save pantry update']);
  panel.appendChild(saveBtn);

  return panel;
}
