// Light/dark theme toggle.
//
// The initial theme is applied by an inline <head> script before first paint.
// This module renders the header toggle button and persists explicit choices.
// Until the user explicitly picks, the theme follows the OS preference live.

import { el } from './common.js';

const KEY = 'ichef.theme';

const SUN_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/></svg>';
const MOON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"/></svg>';

export function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function apply(theme) {
  document.documentElement.dataset.theme = theme;
}

function hasExplicitChoice() {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark';
  } catch {
    return false;
  }
}

export function mountThemeToggle(container) {
  const btn = el('button', {
    class: 'icon-btn',
    'aria-label': 'Toggle light/dark theme',
    title: 'Toggle light/dark theme',
  });

  function refreshIcon() {
    // Show the theme you'd switch TO.
    btn.innerHTML = currentTheme() === 'dark' ? SUN_SVG : MOON_SVG;
  }

  btn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
    refreshIcon();
  });

  // Follow OS preference changes while the user hasn't explicitly chosen.
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', (e) => {
    if (!hasExplicitChoice()) {
      apply(e.matches ? 'dark' : 'light');
      refreshIcon();
    }
  });

  refreshIcon();
  container.appendChild(btn);
  return btn;
}
