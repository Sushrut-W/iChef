// Recipe detail modal + "I cooked this!" flow.

import { getRecipeDetail, BackendError } from '../api/recipes.js';
import * as pantry from '../state/pantry.js';
import { el, clear, openModal, closeModal, modalHeader, toast } from './common.js';

export async function openRecipeDetail(recipeId) {
  openModal((modal, close) => {
    modal.appendChild(modalHeader('Loading…', close));
    const body = el('div', { class: 'modal-body' }, [
      el('div', { class: 'loading' }, ['Loading recipe…']),
    ]);
    modal.appendChild(body);

    getRecipeDetail(recipeId)
      .then((recipe) => {
        clear(modal);
        modal.appendChild(modalHeader(recipe.title, close));
        modal.appendChild(renderBody(recipe));
      })
      .catch((err) => {
        clear(modal);
        modal.appendChild(modalHeader('Recipe', close));
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

function renderBody(recipe) {
  const body = el('div', { class: 'modal-body' });

  if (recipe.image) {
    body.appendChild(el('img', { class: 'hero', src: recipe.image, alt: recipe.title }));
  }

  const meta = el('div', { class: 'recipe-meta' });
  if (recipe.readyInMinutes) meta.appendChild(el('span', {}, [`${recipe.readyInMinutes} min`]));
  if (recipe.servings) meta.appendChild(el('span', {}, [`${recipe.servings} servings`]));
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
      toast(outCount ? `Updated pantry — ${outCount} marked Out` : 'Pantry updated');
      closeModal();
    },
  }, ['Save pantry update']);
  panel.appendChild(saveBtn);

  return panel;
}
