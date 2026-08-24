(() => {
  'use strict';
  if (window.__WINAMP_FAST_ACTIONS_143__) return;
  window.__WINAMP_FAST_ACTIONS_143__ = true;

  const LIBRARY_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const BACKGROUND_KEY = 'winampmusic.background.v1';
  const ID_PATTERN = /^[\w-]{6,20}$/;
  const status = document.getElementById('status');
  const header = document.querySelector('.library-header');
  if (!header) return;

  const setStatus = (text) => {
    if (status) status.textContent = text;
  };

  function loadScript(src, marker, timeoutMs = 6000) {
    const existing = document.querySelector(`script[data-fast-module="${marker}"]`);
    if (existing?.dataset.loaded === '1') return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
      const script = existing || document.createElement('script');
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        fn(value);
      };
      const done = () => {
        script.dataset.loaded = '1';
        finish(resolve, script);
      };
      const fail = () => finish(reject, new Error(`${marker} failed to load`));
      const timeout = setTimeout(() => finish(reject, new Error(`${marker} load timed out`)), timeoutMs);

      script.addEventListener('load', done, { once: true });
      script.addEventListener('error', fail, { once: true });
      if (!existing) {
        script.src = src;
        script.async = true;
        script.dataset.fastModule = marker;
        document.head.appendChild(script);
      }
    });
  }

  const style = document.createElement('style');
  style.id = 'fastPlaylistActions143Styles';
  style.textContent = `
    .fast-playlist-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
    .fast-playlist-action{min-height:38px;padding:0 11px;border:1px solid #4a515e;border-radius:8px;background:#242a32;color:#fff;font-weight:800;font-size:12px;touch-action:manipulation}
    .fast-playlist-action.share{border-color:#8f7724;background:#d8b63f;color:#171717}
    .fast-playlist-action.clear{color:#ffb9b9}
    .fast-playlist-action.clear.armed{border-color:#9f4545;background:#472222;color:#fff}
    @media(max-width:520px){.library-header{align-items:flex-start}.fast-playlist-actions{width:100%;justify-content:flex-start}.fast-playlist-action{min-height:42px}}
  `;
  document.head.appendChild(style);

  const actions = document.createElement('div');
  actions.className = 'fast-playlist-actions';

  const shareButton = document.createElement('button');
  shareButton.id = 'sharePlaylistButton';
  shareButton.type = 'button';
  shareButton.className = 'fast-playlist-action share';
  shareButton.textContent = 'Share / QR';
  shareButton.setAttribute('aria-label', 'Share playlist by link or QR code');

  const clearButton = document.createElement('button');
  clearButton.id = 'clearPlaylistButton';
  clearButton.type = 'button';
  clearButton.className = 'fast-playlist-action clear';
  clearButton.textContent = 'Clear';
  clearButton.setAttribute('aria-label', 'Clear playlist');

  actions.append(shareButton, clearButton);
  header.appendChild(actions);

  function readLibrary() {
    try {
      const value = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function playlistIds() {
    const seen = new Set();
    const ids = [];
    for (const track of readLibrary()) {
      const id = String(track?.id || '').trim();
      if (!ID_PATTERN.test(id) || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }

  function fallbackShareUrl(ids) {
    const url = new URL(location.href);
    url.searchParams.delete('s');
    url.searchParams.delete('p');
    url.searchParams.delete('playlist');
    url.searchParams.set('p', ids.join('.'));
    url.hash = '';
    return url.toString();
  }

  function ensureQuickShareDialog() {
    let dialog = document.getElementById('winampShareDialog');
    if (dialog) return dialog;

    dialog = document.createElement('dialog');
    dialog.id = 'winampShareDialog';
    dialog.style.cssText = 'width:min(calc(100% - 24px),620px);border:1px solid #343a46;border-radius:14px;color:#fff;background:#15181e;padding:0;box-shadow:0 30px 100px rgba(0,0,0,.7);';
    dialog.innerHTML = `
      <div style="padding:16px;display:grid;gap:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
          <div><div style="font-size:10px;letter-spacing:.16em;color:#8f98a8;font-weight:800">SHARE PLAYLIST</div><strong id="winampShareHeading">Playlist link ready</strong></div>
          <button id="winampShareClose" type="button" aria-label="Close" style="border:0;background:transparent;color:#8f98a8;font-size:18px">✕</button>
        </div>
        <p id="winampShareNote" style="margin:0;color:#b4bbc7;font-size:12px;line-height:1.4">Send the link or scan the QR code.</p>
        <input id="winampShareUrl" readonly style="width:100%;min-height:42px;border:1px solid #343a46;border-radius:8px;background:#0c0e12;color:#b7f29e;padding:0 10px;font:11px SFMono-Regular,Consolas,monospace" />
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button id="winampShareCopy" type="button" style="min-height:40px;padding:0 14px;border:1px solid #4a515e;border-radius:8px;background:#2a3039;color:#fff;font-weight:800">Copy link</button>
          <button id="winampShareSystem" type="button" style="min-height:40px;padding:0 14px;border:1px solid #8f7724;border-radius:8px;background:#d8b63f;color:#171717;font-weight:800">Share…</button>
        </div>
      </div>`;
    document.body.appendChild(dialog);

    dialog.querySelector('#winampShareClose').addEventListener('click', () => dialog.close());
    dialog.querySelector('#winampShareCopy').addEventListener('click', async () => {
      const input = dialog.querySelector('#winampShareUrl');
      try {
        await navigator.clipboard.writeText(input.value);
        setStatus('PLAYLIST LINK COPIED');
      } catch {
        input.focus();
        input.select();
        document.execCommand?.('copy');
        setStatus('PLAYLIST LINK READY');
      }
    });
    dialog.querySelector('#winampShareSystem').addEventListener('click', async () => {
      const input = dialog.querySelector('#winampShareUrl');
      if (!navigator.share) return;
      try {
        await navigator.share({ title: 'Ámpula MP playlist', text: 'Listen to my Ámpula MP playlist', url: input.value });
        setStatus('PLAYLIST SHARED');
      } catch {}
    });
    return dialog;
  }

  let shareBusy = false;
  shareButton.addEventListener('click', async () => {
    if (shareBusy) return;
    const ids = playlistIds();
    if (!ids.length) {
      setStatus('NO TRACKS TO SHARE');
      return;
    }

    shareBusy = true;
    shareButton.disabled = true;
    shareButton.textContent = 'Preparing…';

    try {
      const url = fallbackShareUrl(ids);
      const dialog = ensureQuickShareDialog();
      dialog.dataset.count = String(ids.length);
      dialog.querySelector('#winampShareUrl').value = url;
      dialog.querySelector('#winampShareSystem').hidden = !navigator.share;
      if (!dialog.open) dialog.showModal();
      setStatus('PLAYLIST LINK READY');

      loadScript('./qr-share-v1.js?v=158', 'qr-share').catch((error) => {
        console.warn('[Ámpula MP share] QR module unavailable', error);
      });
    } catch (error) {
      console.warn('[Ámpula MP share] failed', error);
      setStatus('SHARE UNAVAILABLE · TRY AGAIN');
    } finally {
      shareBusy = false;
      shareButton.disabled = false;
      shareButton.textContent = 'Share / QR';
    }
  });

  let clearArmedUntil = 0;
  let clearTimer = null;
  clearButton.addEventListener('click', () => {
    const now = Date.now();
    if (now > clearArmedUntil) {
      clearArmedUntil = now + 5000;
      clearButton.classList.add('armed');
      clearButton.textContent = 'Confirm clear';
      setStatus('TAP CLEAR AGAIN TO CONFIRM');
      clearTimeout(clearTimer);
      clearTimer = setTimeout(() => {
        clearArmedUntil = 0;
        clearButton.classList.remove('armed');
        clearButton.textContent = 'Clear';
      }, 5000);
      return;
    }

    clearTimeout(clearTimer);
    try {
      localStorage.removeItem(LIBRARY_KEY);
      localStorage.removeItem(CURRENT_KEY);
      localStorage.removeItem(PLAYER_STATE_KEY);
      localStorage.removeItem(BACKGROUND_KEY);
    } catch {}
    clearButton.disabled = true;
    clearButton.textContent = 'Cleared';
    setStatus('PLAYLIST CLEARED');
    setTimeout(() => location.reload(), 80);
  });

  // Shared links still load the receiver module only when needed.
  const params = new URLSearchParams(location.search);
  if (params.has('s') || params.has('p')) {
    setTimeout(() => {
      loadScript('./compact-share.js?v=158', 'compact-share').catch((error) => {
        console.warn('[Ámpula MP fast actions] shared playlist receive failed', error);
        setStatus('SHARED PLAYLIST COULD NOT LOAD');
      });
    }, 0);
  }

  console.info('[Ámpula MP] fast actions 1.5.8 ready');
})();
