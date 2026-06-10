// Cooking history page UI.

import * as history from '../state/history.js';
import { el, clear } from './common.js';
import { openRecipeDetail } from './recipeDetail.js';

export function render(container) {
  clear(container);

  container.appendChild(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('h1', {}, ['Cooking History']),
        el('p', { class: 'muted' }, ['Everything you’ve marked "I cooked this!", newest first.']),
      ]),
    ])
  );

  const body = el('div');
  container.appendChild(body);

  function renderAll() {
    clear(body);
    const entries = history.getAll();

    if (!entries.length) {
      body.appendChild(
        el('div', { class: 'empty-state' }, [
          el('span', { class: 'icon' }, ['🍳']),
          el('h3', {}, ['No meals logged yet']),
          el('p', {}, ['Open a recipe and tap "I cooked this!" — it will show up here.']),
        ])
      );
      return;
    }

    const monthCount = history.cookedThisMonth();
    body.appendChild(
      el('p', { class: 'history-stat' }, [
        `🍽️ ${monthCount} meal${monthCount === 1 ? '' : 's'} cooked this month · ${entries.length} all time`,
      ])
    );

    for (const [label, group] of groupByPeriod(entries)) {
      const groupEl = el('div', { class: 'history-group' }, [el('h2', {}, [label])]);
      for (const entry of group) groupEl.appendChild(renderRow(entry));
      body.appendChild(groupEl);
    }
  }

  renderAll();
  const unsub = history.subscribe(renderAll);
  container._cleanup = unsub;
}

function groupByPeriod(entries) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - 6);

  const groups = new Map();
  for (const entry of entries) {
    const d = new Date(entry.cookedAt);
    let label;
    if (d >= startOfDay) label = 'Today';
    else if (d >= startOfWeek) label = 'This week';
    else label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(entry);
  }
  return [...groups.entries()];
}

function renderRow(entry) {
  const cooked = new Date(entry.cookedAt);
  const dateStr = cooked.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  const cuisines = (entry.cuisines || []).slice(0, 2).join(', ');

  return el('div', { class: 'history-row' }, [
    entry.image
      ? el('img', { src: entry.image, alt: entry.title, loading: 'lazy' })
      : el('div', { class: 'thumb-placeholder' }),
    el('div', { class: 'info' }, [
      el('p', { class: 'title' }, [entry.title]),
      el('p', { class: 'sub' }, [cuisines ? `${dateStr} · ${cuisines}` : dateStr]),
    ]),
    el('div', { class: 'actions' }, [
      el('button', {
        class: 'btn small',
        onclick: () => openRecipeDetail(entry.recipeId, entry),
      }, ['Cook again']),
      el('button', {
        class: 'btn danger',
        'aria-label': `Delete ${entry.title} from history`,
        onclick: () => history.remove(entry.id),
      }, ['×']),
    ]),
  ]);
}
