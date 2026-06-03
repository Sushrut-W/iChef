// Pantry page UI.

import * as pantry from '../state/pantry.js';
import { isBackendConfigured } from '../state/backend.js';
import { fetchAutocomplete, BackendError } from '../api/backend.js';
import { el, clear, toast, debounce } from './common.js';

export function render(container) {
  clear(container);

  container.appendChild(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('h1', {}, ['Your Pantry']),
        el('p', { class: 'muted' }, ['Mark items "Have" or "Out". Used to find recipes you can actually make.']),
      ]),
      el('button', { class: 'btn', onclick: () => openGroceryRun(container) }, ['Grocery run']),
    ])
  );

  container.appendChild(renderAddForm());

  const listContainer = el('div', { id: 'pantry-list' });
  container.appendChild(listContainer);

  function renderList(items) {
    clear(listContainer);
    if (!items.length) {
      listContainer.appendChild(
        el('div', { class: 'empty-state' }, [
          el('h3', {}, ['Pantry is empty']),
          el('p', {}, ['Add a few ingredients above to get started — or use Grocery run to add many at once.']),
        ])
      );
      return;
    }

    const grouped = pantry.groupByCategory(items);
    for (const [category, group] of grouped) {
      const groupEl = el('div', { class: 'category-group' }, [
        el('h2', {}, [category]),
        ...group.map(renderRow),
      ]);
      listContainer.appendChild(groupEl);
    }
  }

  renderList(pantry.getAll());
  const unsub = pantry.subscribe(renderList);
  container._cleanup = unsub;
}

function renderRow(item) {
  return el('div', { class: 'ingredient-row', dataset: { id: item.id } }, [
    el('span', { class: 'name' + (item.hasIt ? '' : ' out') }, [item.name]),
    el('div', { class: 'status-toggle' }, [
      el('button', {
        class: 'have' + (item.hasIt ? ' active' : ''),
        onclick: async () => { await pantry.setStatus(item.id, true); },
      }, ['Have']),
      el('button', {
        class: 'out' + (!item.hasIt ? ' active' : ''),
        onclick: async () => { await pantry.setStatus(item.id, false); },
      }, ['Out']),
    ]),
    el('button', {
      class: 'btn danger',
      'aria-label': `Remove ${item.name}`,
      onclick: async () => {
        await pantry.remove(item.id);
        toast(`Removed ${item.name}`);
      },
    }, ['×']),
  ]);
}

function renderAddForm() {
  const form = el('form', { class: 'add-form', autocomplete: 'off' });
  const input = el('input', {
    type: 'text',
    name: 'ingredient',
    placeholder: 'Add an ingredient (e.g. eggs, olive oil, basmati rice)',
    'aria-label': 'Ingredient name',
  });
  const categorySelect = el('select', { 'aria-label': 'Category' });
  for (const cat of ['Auto', ...pantry.CATEGORIES]) {
    categorySelect.appendChild(el('option', { value: cat }, [cat]));
  }
  const submit = el('button', { type: 'submit', class: 'btn primary' }, ['Add']);
  const acList = el('div', { class: 'autocomplete-list hidden' });

  form.append(input, categorySelect, submit, acList);

  // Autocomplete — works only when the backend is configured. Gracefully
  // degrades to plain text input if the backend returns 503.
  const runAutocomplete = debounce(async (q) => {
    if (!isBackendConfigured()) {
      acList.classList.add('hidden');
      return;
    }
    try {
      const results = await fetchAutocomplete(q);
      renderSuggestions(acList, results, (name) => {
        input.value = name;
        acList.classList.add('hidden');
        input.focus();
      });
    } catch (err) {
      if (!(err instanceof BackendError && err.isNotConfigured)) {
        console.warn('autocomplete failed', err);
      }
      acList.classList.add('hidden');
    }
  }, 220);

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q.length < 2) {
      acList.classList.add('hidden');
      return;
    }
    runAutocomplete(q);
  });
  input.addEventListener('blur', () => {
    setTimeout(() => acList.classList.add('hidden'), 120);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) return;
    const cat = categorySelect.value === 'Auto' ? null : categorySelect.value;
    await pantry.add(name, cat);
    toast(`Added ${name}`);
    input.value = '';
    acList.classList.add('hidden');
    input.focus();
  });

  return form;
}

function renderSuggestions(listEl, items, onPick) {
  clear(listEl);
  if (!items.length) {
    listEl.classList.add('hidden');
    return;
  }
  for (const item of items) {
    const node = el('div', { class: 'item', onclick: () => onPick(item.name) }, [item.name]);
    listEl.appendChild(node);
  }
  listEl.classList.remove('hidden');
}

function openGroceryRun(container) {
  const existing = container.querySelector('.grocery-run');
  if (existing) {
    existing.remove();
    return;
  }
  const textarea = el('textarea', {
    placeholder: 'Paste one ingredient per line:\n\neggs\nmilk\nflour\nolive oil',
  });
  const panel = el('div', { class: 'grocery-run' }, [
    el('p', { class: 'muted' }, ['Add many items at once. One per line — each will be marked Have.']),
    textarea,
    el('div', { class: 'row' }, [
      el('button', { class: 'btn', onclick: () => panel.remove() }, ['Cancel']),
      el('button', {
        class: 'btn primary',
        onclick: async () => {
          const names = textarea.value.split(/\r?\n/);
          const added = await pantry.bulkAddNames(names);
          toast(`Added ${added.length} ingredient${added.length === 1 ? '' : 's'}`);
          panel.remove();
        },
      }, ['Add all']),
    ]),
  ]);

  const list = container.querySelector('#pantry-list');
  container.insertBefore(panel, list);
  textarea.focus();
}
