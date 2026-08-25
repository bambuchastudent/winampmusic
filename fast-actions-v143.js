(() => {
  'use strict';
  if (window.__WINAMP_FAST_ACTIONS_143__) return;
  window.__WINAMP_FAST_ACTIONS_143__ = true;

  const LIBRARY_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const BACKGROUND_KEY = 'winampmusic.background.v1';
  const status = document.getElementById('status');
  const header = document.querySelector('.library-header');
  if (!header) return;

  const setStatus = (text) => { if (status) status.textContent = text; };

  function loadScript(src, marker, timeoutMs = 6000) {
    const existing = document.querySelector(`script[data-fast-module="${marker}"]`);
    if (existing?.dataset.loaded === '1') return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const script = existing || document.createElement('script');
      let settled = false;
      const finish = (fn, value) => { if (settled) return; settled = true; clearTimeout(timeout); fn(value); };
      const done = () => { script.dataset.loaded = '1'; finish(resolve, script); };
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
  style.textContent = `.fast-playlist-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.fast-playlist-action{min-height:38px;padding:0 11px;border:1px solid #4a515e;border-radius:8px;background:#242a32;color:#fff;font-weight:800;font-size:12px;touch-action:manipulation}.fast-playlist-action.share{border-color:#8f7724;background:#d8b63f;color:#171717}.fast-playlist-action.clear{color:#ffb9b9}.fast-playlist-action.clear.armed{border-color:#9f4545;background:#472222;color:#fff}@media(max-width:520px){.library-header{align-items:flex-start}.fast-playlist-actions{width:100%;justify-content:flex-start}.fast-playlist-action{min-height:42px}}`;
  document.head.appendChild(style);

  const actions = document.createElement('div');
  actions.className = 'fast-playlist-actions';

  const shareButton = document.createElement('button');
  shareButton.id = 'sharePlaylistButton';
  shareButton.type = 'button';
  shareButton.className = 'fast-playlist-action share';
  shareButton.textContent = 'Share / QR';
  shareButton.setAttribute('aria-label', 'Share portable Ámpula by link, QR, or file');

  const openButton = document.createElement('button');
  openButton.id = 'openAmpulaButton';
  openButton.type = 'button';
  openButton.className = 'fast-playlist-action';
  openButton.textContent = 'Open .ampula';
  openButton.setAttribute('aria-label', 'Open a portable .ampula file');

  const fileInput = document.createElement('input');
  fileInput.id = 'openAmpulaInput';
  fileInput.type = 'file';
  fileInput.accept = '.ampula,application/vnd.ampula+json,application/json';
  fileInput.hidden = true;

  const clearButton = document.createElement('button');
  clearButton.id = 'clearPlaylistButton';
  clearButton.type = 'button';
  clearButton.className = 'fast-playlist-action clear';
  clearButton.textContent = 'Clear';
  clearButton.setAttribute('aria-label', 'Clear playlist');

  actions.append(shareButton, openButton, clearButton, fileInput);
  header.appendChild(actions);

  let shareBusy = false;
  shareButton.addEventListener('click', async () => {
    if (shareBusy) return;
    shareBusy = true;
    shareButton.disabled = true;
    shareButton.textContent = 'Preparing…';
    setStatus('PREPARING ÁMPULA');
    try {
      await loadScript('./compact-share.js?v=160', 'compact-share');
      if (typeof window.winampMusicCompactShare?.share !== 'function') throw new Error('Ámpula share module unavailable');
      const url = await window.winampMusicCompactShare.share();
      if (url) {
        loadScript('./qr-share-v1.js?v=160', 'qr-share').catch((error) => console.warn('[AMPULAMP share] QR unavailable', error));
      }
    } catch (error) {
      console.warn('[AMPULAMP share] failed', error);
      setStatus('ÁMPULA SHARE UNAVAILABLE · TRY AGAIN');
    } finally {
      shareBusy = false;
      shareButton.disabled = false;
      shareButton.textContent = 'Share / QR';
    }
  });

  openButton.addEventListener('click', () => {
    fileInput.value = '';
    fileInput.click();
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    openButton.disabled = true;
    setStatus('OPENING .AMPULA');
    try {
      await loadScript('./compact-share.js?v=160', 'compact-share');
      await loadScript('./ampula-file-open-v1.js?v=160', 'ampula-file-open');
      if (typeof window.ampulaFileOpen?.openFile !== 'function') throw new Error('.ampula opener unavailable');
      await window.ampulaFileOpen.openFile(file);
    } catch (error) {
      console.warn('[AMPULAMP .ampula open]', error);
      setStatus('INVALID OR UNSUPPORTED .AMPULA');
    } finally {
      openButton.disabled = false;
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

  const params = new URLSearchParams(location.search);
  if (params.has('a')) {
    setTimeout(() => {
      loadScript('./compact-share.js?v=160', 'compact-share').catch((error) => {
        console.warn('[AMPULAMP] Ámpula receive failed', error);
        setStatus('ÁMPULA COULD NOT LOAD');
      });
    }, 0);
  } else if (params.has('p') || params.has('s')) {
    setStatus('OLD PLAYLIST SHARE LINK UNSUPPORTED');
  }

  console.info('[AMPULAMP] fast actions with Ámpula v1 sharing ready');
})();
