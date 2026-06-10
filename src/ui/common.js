// Shared UI helpers: element factory, modal, toast, escape.

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class' || key === 'className') node.className = value;
    else if (key === 'dataset') {
      for (const [dk, dv] of Object.entries(value)) node.dataset[dk] = dv;
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'html') {
      node.innerHTML = value;
    } else {
      node.setAttribute(key, value);
    }
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const kid of kids) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Toast. Options: toast('msg'), toast('msg', 4000), or
// toast('msg', { ms, action: { label, onClick } }) for an inline action button.
export function toast(message, opts = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const { ms = 2400, action = null } = typeof opts === 'number' ? { ms: opts } : opts;
  const children = [el('span', {}, [message])];
  const node = el('div', { class: 'toast' }, children);
  if (action) {
    node.appendChild(
      el('button', {
        onclick: () => {
          node.remove();
          action.onClick();
        },
      }, [action.label])
    );
  }
  root.appendChild(node);
  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transition = 'opacity 200ms';
    setTimeout(() => node.remove(), 220);
  }, action ? Math.max(ms, 5000) : ms);
}

// Modal — only one at a time.
let modalCleanup = null;

export function openModal(render, { narrow = false } = {}) {
  closeModal();
  const root = document.getElementById('modal-root');
  if (!root) return;

  const backdrop = el('div', { class: 'modal-backdrop' });
  const modal = el('div', {
    class: 'modal' + (narrow ? ' narrow' : ''),
    role: 'dialog',
    'aria-modal': 'true',
  });

  backdrop.appendChild(modal);
  root.appendChild(backdrop);

  function close() { closeModal(); }
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKey);

  modalCleanup = () => {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    modalCleanup = null;
  };

  render(modal, close);
}

export function closeModal() {
  if (modalCleanup) modalCleanup();
}

// Optional extraButtons render between the title and the close button —
// used by the recipe detail modal for its star/vote actions.
export function modalHeader(title, onClose, extraButtons = []) {
  return el('div', { class: 'modal-header' }, [
    el('h2', {}, [title]),
    el('div', { class: 'header-btns' }, [
      ...extraButtons,
      el('button', { class: 'modal-close', 'aria-label': 'Close', onclick: onClose }, ['×']),
    ]),
  ]);
}

// Debounce — used for autocomplete.
export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
