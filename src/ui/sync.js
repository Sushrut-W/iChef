// Cross-device sync UI: header status button + household-code modal.

import * as storage from '../storage/index.js';
import { hasFirebaseConfig } from '../config.js';
import { el, clear, openModal, modalHeader, toast } from './common.js';

const CLOUD_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 18.5a4.5 4.5 0 0 0 .9-8.9 6 6 0 0 0-11.7 1.2A4 4 0 0 0 7 18.5h10.5Z"/></svg>';
const CLOUD_CHECK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 18.5a4.5 4.5 0 0 0 .9-8.9 6 6 0 0 0-11.7 1.2A4 4 0 0 0 7 18.5h10.5Z"/><path d="m9.5 13.5 2 2 3.5-3.5"/></svg>';

let buttonEl = null;

export function mountSyncButton(container) {
  buttonEl = el('button', {
    class: 'icon-btn',
    'aria-label': 'Cross-device sync',
    onclick: openSyncModal,
  });
  refreshButton();
  container.appendChild(buttonEl);
  return buttonEl;
}

function refreshButton() {
  if (!buttonEl) return;
  const synced = storage.isSynced();
  buttonEl.innerHTML = synced ? CLOUD_CHECK_SVG : CLOUD_SVG;
  buttonEl.classList.toggle('synced', synced);
  buttonEl.title = synced
    ? 'Synced across devices — click to manage'
    : 'Local only — click to set up cross-device sync';
}

function openSyncModal() {
  openModal((modal, close) => {
    modal.appendChild(modalHeader('Cross-device sync', close));
    const body = el('div', { class: 'modal-body' });
    modal.appendChild(body);
    renderModalBody(body, close);
  }, { narrow: true });
}

function renderModalBody(body, close) {
  clear(body);

  if (!hasFirebaseConfig()) {
    body.append(
      statusLine(false, 'Local only — Firebase isn’t configured yet.'),
      el('p', { class: 'sync-note' }, [
        'To sync your pantry across devices you need a free Firebase project (~5 minutes to set up). ',
        'Follow the steps in ',
        el('a', { href: 'SETUP.md', target: '_blank' }, ['SETUP.md']),
        ', paste your config into ', el('code', {}, ['src/config.js']), ', and reload.',
      ])
    );
    return;
  }

  if (storage.isSynced()) {
    body.append(
      statusLine(true, 'Synced — every device using your household code shares this data.'),
      el('p', { class: 'sync-note' }, [
        'Changes appear on other devices within seconds. To stop syncing on this device, disconnect below — your data stays in the household, and this device keeps its last local copy.',
      ]),
      el('div', { class: 'sync-form' }, [
        el('div', { class: 'row' }, [
          el('button', {
            class: 'btn danger',
            onclick: async () => {
              await storage.disableSync();
              refreshButton();
              toast('Sync disconnected — using this device only');
              close();
            },
          }, ['Disconnect this device']),
        ]),
      ])
    );
    return;
  }

  // Configured but not connected: ask for the household code.
  const input = el('input', {
    type: 'text',
    placeholder: 'e.g. purple-walrus-pancake-tuesday',
    'aria-label': 'Household code',
  });
  const connectBtn = el('button', { class: 'btn primary' }, ['Connect']);

  connectBtn.addEventListener('click', async () => {
    const code = input.value.trim();
    if (code.length < 4) {
      toast('Use a longer code — at least 4 characters');
      return;
    }
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting…';
    try {
      const counts = await storage.previewSync(code);
      renderMigrationChoice(body, close, counts);
    } catch (err) {
      console.error('sync preview failed', err);
      toast(`Couldn't connect: ${err.message || err}`);
      connectBtn.disabled = false;
      connectBtn.textContent = 'Connect';
    }
  });

  const form = el('div', { class: 'sync-form' }, [
    input,
    el('div', { class: 'row' }, [connectBtn]),
  ]);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') connectBtn.click();
  });

  body.append(
    statusLine(false, 'Local only — data lives in this browser.'),
    el('p', { class: 'sync-note' }, [
      'Enter your household code. Every device that enters the same code shares one pantry, shopping list, favorites, and history. ',
      el('strong', {}, ['Pick something long and unguessable']),
      ' (like four random words) — anyone who knows it can see and edit your data.',
    ]),
    form
  );
}

function renderMigrationChoice(body, close, counts) {
  clear(body);
  const remoteTotal = Object.values(counts).reduce((a, b) => a + b, 0);

  const countsBox = el('div', { class: 'sync-counts' }, [
    el('div', {}, [el('strong', {}, ['Found in this household:'])]),
    el('div', {}, [
      `${counts.pantry} pantry · ${counts.shopping} shopping · ${counts.favorites} favorites · ${counts.history} history`,
    ]),
  ]);

  async function finish(mode, label) {
    try {
      await storage.confirmSync(mode);
      refreshButton();
      toast(label);
      close();
    } catch (err) {
      console.error('sync confirm failed', err);
      toast(`Sync failed: ${err.message || err}`);
    }
  }

  if (remoteTotal === 0) {
    body.append(
      statusLine(false, 'Connected — this household is empty.'),
      countsBox,
      el('p', { class: 'sync-note' }, [
        'If you expected data here, double-check the code for typos (a different code means a different, fresh household). ',
        'Otherwise, upload this device’s data to get started.',
      ]),
      el('div', { class: 'sync-form' }, [
        el('div', { class: 'row' }, [
          el('button', { class: 'btn', onclick: () => { storage.cancelSync(); renderModalBody(body, close); } }, ['Back']),
          el('button', { class: 'btn primary', onclick: () => finish('upload', 'Synced — local data uploaded') }, ['Upload my data & sync']),
        ]),
      ])
    );
    return;
  }

  body.append(
    statusLine(true, 'Connected — this household already has data.'),
    countsBox,
    el('p', { class: 'sync-note' }, [
      'How should this device join?',
    ]),
    el('div', { class: 'sync-form' }, [
      el('div', { class: 'row', style: 'flex-direction: column; align-items: stretch; gap: 8px;' }, [
        el('button', {
          class: 'btn primary',
          onclick: () => finish('merge', 'Synced — local and household data merged'),
        }, ['Merge my local data in']),
        el('button', {
          class: 'btn',
          onclick: () => finish('remote', 'Synced — using household data'),
        }, ['Just use the household data']),
        el('button', {
          class: 'btn ghost',
          onclick: () => { storage.cancelSync(); renderModalBody(body, close); },
        }, ['Back']),
      ]),
    ])
  );
}

function statusLine(on, text) {
  return el('div', { class: 'sync-status-line' }, [
    el('span', { class: 'sync-dot' + (on ? ' on' : '') }),
    el('span', {}, [text]),
  ]);
}
