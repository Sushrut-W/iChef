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

// Toast
export function toast(message, ms = 2400) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const node = el('div', { class: 'toast' }, [message]);
  root.appendChild(node);
  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transition = 'opacity 200ms';
    setTimeout(() => node.remove(), 220);
  }, ms);
}

// Modal — only one at a time.
let modalCleanup = null;

export function openModal(render) {
  closeModal();
  const root = document.getElementById('modal-root');
  if (!root) return;

  const backdrop = el('div', { class: 'modal-backdrop' });
  const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' });

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

export function modalHeader(title, onClose) {
  return el('div', { class: 'modal-header' }, [
    el('h2', {}, [title]),
    el('button', { class: 'modal-close', 'aria-label': 'Close', onclick: onClose }, ['×']),
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
