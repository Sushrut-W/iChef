// Pantry page UI.

import * as pantry from '../state/pantry.js';
import * as settings from '../state/settings.js';
import { isBackendConfigured } from '../state/backend.js';
import { fetchAutocomplete, BackendError } from '../api/backend.js';
import { el, clear, toast, debounce, openModal, modalHeader } from './common.js';

export function render(container) {
  clear(container);

  container.appendChild(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('h1', {}, ['Your Pantry']),
        el('p', { class: 'muted' }, ['Mark items "Have" or "Out". Used to find recipes you can actually make.']),
      ]),
      el('div', { class: 'actions' }, [
        el('button', { class: 'btn', onclick: openExportModal }, ['Export']),
        el('button', { class: 'btn primary', onclick: () => toggleGroceryRun(container) }, ['Grocery run']),
      ]),
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
          el('span', { class: 'icon' }, ['🥕']),
          el('h3', {}, ['Pantry is empty']),
          el('p', {}, ['Add a few ingredients above to get started — or use Grocery run to paste many at once.']),
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
    item.hasIt
      ? el('button', {
          class: 'btn ghost small use-up-btn',
          title: `Find recipes that use ${item.name}`,
          'aria-label': `Find recipes that use ${item.name}`,
          onclick: async () => {
            await settings.update({ mustUse: item.name });
            location.hash = '#recipes';
          },
        }, ['Use up ↗'])
      : null,
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

// ---------- Grocery run (bulk add with live preview) ----------

function parseBulkInput(text) {
  const seen = new Set();
  const rows = [];
  for (const raw of String(text).split(/[\r\n,;]+/)) {
    const name = pantry.normalizeName(raw);
    if (!name) continue;
    let status = 'new';
    if (seen.has(name)) status = 'dupe';
    else if (pantry.findByName(name)) status = 'exists';
    seen.add(name);
    rows.push({ name, category: guessOrExisting(name), status });
  }
  return rows;
}

function guessOrExisting(name) {
  const existing = pantry.findByName(name);
  return existing ? existing.category : pantry.guessCategory(name);
}

const PILL_LABELS = {
  new: 'new',
  exists: 'will mark Have',
  dupe: 'duplicate',
};

function toggleGroceryRun(container) {
  const existing = container.querySelector('.grocery-run');
  if (existing) {
    existing.remove();
    return;
  }

  const textarea = el('textarea', {
    placeholder:
      'Paste your groceries — one per line, or separated by commas:\n\neggs\nmilk\nflour, olive oil, basmati rice',
  });
  const preview = el('div', { class: 'bulk-preview hidden' });
  const counter = el('span', { class: 'spacer' }, ['']);
  const addBtn = el('button', { class: 'btn primary', disabled: true }, ['Add all']);

  // Preview rows hold their own category selects so the user can correct
  // guesses before committing.
  let rows = [];

  const refresh = debounce(() => {
    rows = parseBulkInput(textarea.value);
    clear(preview);
    preview.classList.toggle('hidden', rows.length === 0);

    const addable = rows.filter((r) => r.status !== 'dupe');
    counter.textContent = rows.length
      ? `${addable.length} item${addable.length === 1 ? '' : 's'} to add`
      : '';
    addBtn.disabled = addable.length === 0;
    addBtn.textContent = addable.length ? `Add all (${addable.length})` : 'Add all';

    for (const row of rows) {
      const select = el('select', { 'aria-label': `Category for ${row.name}` });
      for (const cat of pantry.CATEGORIES) {
        const opt = el('option', { value: cat }, [cat]);
        if (cat === row.category) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => { row.category = select.value; });
      preview.appendChild(
        el('div', { class: 'bulk-row' }, [
          el('span', { class: 'name' }, [row.name]),
          el('span', { class: `pill ${row.status}` }, [PILL_LABELS[row.status]]),
          select,
        ])
      );
    }
  }, 200);

  textarea.addEventListener('input', refresh);

  addBtn.addEventListener('click', async () => {
    const entries = rows
      .filter((r) => r.status !== 'dupe')
      .map((r) => ({ name: r.name, category: r.category }));
    if (!entries.length) return;
    addBtn.disabled = true;
    const added = await pantry.bulkAddEntries(entries);
    toast(`Added ${added.length} ingredient${added.length === 1 ? '' : 's'}`);
    panel.remove();
  });

  const panel = el('div', { class: 'grocery-run' }, [
    el('p', { class: 'muted' }, [
      'Paste many items at once — each will be marked Have. Adjust categories below before adding.',
    ]),
    textarea,
    preview,
    el('div', { class: 'row' }, [
      counter,
      el('button', { class: 'btn', onclick: () => panel.remove() }, ['Cancel']),
      addBtn,
    ]),
  ]);

  const list = container.querySelector('#pantry-list');
  container.insertBefore(panel, list);
  textarea.focus();
}

// ---------- Export ----------

function buildExportText(grouped) {
  const items = pantry.getAll();
  if (!grouped) return items.map((i) => i.name).sort().join('\n');
  const lines = [];
  for (const [category, group] of pantry.groupByCategory(items)) {
    lines.push(`# ${category}`);
    for (const item of group) lines.push(item.name);
    lines.push('');
  }
  return lines.join('\n').trim();
}

function openExportModal() {
  if (!pantry.getAll().length) {
    toast('Pantry is empty — nothing to export');
    return;
  }

  openModal((modal, close) => {
    modal.appendChild(modalHeader('Export pantry', close));

    const box = el('textarea', { class: 'export-box', readonly: 'readonly' });
    let grouped = false;
    box.value = buildExportText(grouped);

    const groupToggle = el('button', { class: 'btn small' }, ['Group by category']);
    groupToggle.addEventListener('click', () => {
      grouped = !grouped;
      box.value = buildExportText(grouped);
      groupToggle.textContent = grouped ? 'Flat list' : 'Group by category';
    });

    const body = el('div', { class: 'modal-body' }, [
      el('p', { class: 'muted', style: 'margin-top:0' }, [
        'One ingredient per line — paste it into any grocery-run box to import elsewhere.',
      ]),
      box,
      el('div', { class: 'export-actions' }, [
        groupToggle,
        el('button', {
          class: 'btn',
          onclick: () => {
            const blob = new Blob([box.value], { type: 'text/plain' });
            const a = el('a', {
              href: URL.createObjectURL(blob),
              download: 'ichef-pantry.txt',
            });
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(a.href);
            a.remove();
          },
        }, ['Download .txt']),
        el('button', {
          class: 'btn primary',
          onclick: async () => {
            try {
              await navigator.clipboard.writeText(box.value);
              toast('Pantry list copied');
            } catch {
              box.select();
              toast('Press Ctrl+C to copy');
            }
          },
        }, ['Copy to clipboard']),
      ]),
    ]);
    modal.appendChild(body);
  }, { narrow: true });
}
