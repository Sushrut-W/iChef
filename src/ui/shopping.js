// Shopping list page UI.

import * as shopping from '../state/shopping.js';
import * as pantry from '../state/pantry.js';
import { el, clear, toast } from './common.js';

export function render(container) {
  clear(container);

  container.appendChild(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('h1', {}, ['Shopping List']),
        el('p', { class: 'muted' }, ['Check items off as you shop, then move them straight into your pantry.']),
      ]),
    ])
  );

  container.appendChild(renderAddForm());

  const actionBar = el('div', { class: 'action-bar' });
  const listContainer = el('div', { id: 'shopping-list' });
  container.appendChild(actionBar);
  container.appendChild(listContainer);

  function renderAll(items) {
    renderActions(actionBar, items);
    renderList(listContainer, items);
  }

  renderAll(shopping.getAll());
  const unsub = shopping.subscribe(renderAll);
  container._cleanup = unsub;
}

function renderAddForm() {
  const form = el('form', { class: 'add-form', autocomplete: 'off' });
  const input = el('input', {
    type: 'text',
    placeholder: 'Add something to buy (e.g. eggs, parmesan)',
    'aria-label': 'Shopping item name',
  });
  const submit = el('button', { type: 'submit', class: 'btn primary' }, ['Add']);
  form.append(input, submit);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) return;
    await shopping.add(name);
    input.value = '';
    input.focus();
  });

  return form;
}

function renderActions(bar, items) {
  clear(bar);
  const checkedCount = items.filter((i) => i.checked).length;
  if (!items.length) return;

  bar.appendChild(
    el('button', {
      class: 'btn primary',
      disabled: checkedCount === 0,
      onclick: async () => {
        const moved = await shopping.moveCheckedToPantry();
        toast(`Moved ${moved} item${moved === 1 ? '' : 's'} to pantry`);
      },
    }, [`Move checked to pantry${checkedCount ? ` (${checkedCount})` : ''}`])
  );
  bar.appendChild(
    el('button', {
      class: 'btn',
      disabled: checkedCount === 0,
      onclick: () => shopping.clearChecked(),
    }, ['Clear checked'])
  );
  bar.appendChild(
    el('button', {
      class: 'btn',
      onclick: async () => {
        const text = exportText(items);
        try {
          await navigator.clipboard.writeText(text);
          toast('Shopping list copied');
        } catch {
          toast('Couldn’t access the clipboard');
        }
      },
    }, ['Copy list'])
  );
}

function exportText(items) {
  const grouped = pantry.groupByCategory(items.filter((i) => !i.checked));
  const lines = [];
  for (const [category, group] of grouped) {
    lines.push(`# ${category}`);
    for (const item of group) lines.push(item.name);
    lines.push('');
  }
  return lines.join('\n').trim();
}

function renderList(container, items) {
  clear(container);
  if (!items.length) {
    container.appendChild(
      el('div', { class: 'empty-state' }, [
        el('span', { class: 'icon' }, ['🛒']),
        el('h3', {}, ['Nothing to buy']),
        el('p', {}, ['Add items above, or open a recipe and tap "Add missing to shopping list".']),
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
    container.appendChild(groupEl);
  }
}

function renderRow(item) {
  const checkbox = el('input', { type: 'checkbox', 'aria-label': `Bought ${item.name}` });
  checkbox.checked = Boolean(item.checked);
  checkbox.addEventListener('click', (e) => e.stopPropagation());
  checkbox.addEventListener('change', () => shopping.toggleChecked(item.id));

  const row = el('div', { class: 'check-row' + (item.checked ? ' checked' : '') }, [
    checkbox,
    el('span', { class: 'name' }, [item.name]),
    item.fromRecipe ? el('span', { class: 'origin' }, [`for ${item.fromRecipe}`]) : null,
    el('button', {
      class: 'btn danger',
      'aria-label': `Remove ${item.name}`,
      onclick: (e) => {
        e.stopPropagation();
        shopping.remove(item.id);
      },
    }, ['×']),
  ]);
  row.addEventListener('click', () => shopping.toggleChecked(item.id));
  return row;
}
