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

  const setStatus = (text) => {
    if (status) status.textContent = text;
  };

  function loadScript(src, marker) {
    const existing = document.querySelector(`script[data-fast-module="${marker}"]`);
    if (existing?.dataset.loaded === '1') return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
      const script = existing || document.createElement('script');
      const done = () => {
        script.dataset.loaded = '1';
        resolve(script);
      };
      const fail = () => reject(new Error(`${marker} failed to load`));

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

  let shareLoading = null;
  shareButton.addEventListener('click', async () => {
    if (shareLoading) return;
    shareButton.disabled = true;
    shareButton.textContent = 'Preparing…';
    setStatus('PREPARING PLAYLIST SHARE…');

    shareLoading = (async () => {
      await loadScript('./compact-share.js?v=143', 'compact-share');
      await loadScript('./qr-share-v1.js?v=143', 'qr-share');
      const installed = document.getElementById('sharePlaylistButton');
      if (!installed) throw new Error('Share button unavailable');
      installed.disabled = false;
      installed.click();
    })();

    try {
      await shareLoading;
    } catch (error) {
      console.warn('[Winamp Music fast actions] share failed', error);
      const installed = document.getElementById('sharePlaylistButton') || shareButton;
      installed.disabled = false;
      installed.textContent = 'Share / QR';
      setStatus('SHARE UNAVAILABLE · TRY AGAIN');
    } finally {
      shareLoading = null;
    }
  }, { once: true });

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

  // Shared links are the one case where the share receiver loads automatically.
  // Normal startup remains untouched and keeps compact-share/QR out of the critical path.
  const params = new URLSearchParams(location.search);
  if (params.has('s') || params.has('p')) {
    setTimeout(() => {
      loadScript('./compact-share.js?v=143', 'compact-share').catch((error) => {
        console.warn('[Winamp Music fast actions] shared playlist receive failed', error);
        setStatus('SHARED PLAYLIST COULD NOT LOAD');
      });
    }, 0);
  }

  console.info('[Winamp Music] fast actions 1.4.3 ready');
})();
