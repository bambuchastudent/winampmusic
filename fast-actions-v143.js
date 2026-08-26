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
  style.textContent = `.fast-playlist-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.fast-playlist-action{min-height:38px;padding:0 11px;border:1px solid #4a515e;border-radius:8px;background:#242a32;color:#fff;font-weight:800;font-size:12px;touch-action:manipulation}.fast-playlist-action.share{border-color:#8f7724;background:#d8b63f;color:#171717}.fast-playlist-action.clear{color:#ffb9b9}.fast-playlist-action.clear.armed{border-color:#9f4545;background:#472222;color:#fff}@media(max-width:520px){.library-header{align-items:center}.fast-playlist-actions{justify-content:flex-start}.fast-playlist-action{min-height:42px}}`;
  document.head.appendChild(style);

  const actions = document.createElement('div');
  actions.className = 'fast-playlist-actions';

  const shareButton = document.createElement('button');
  shareButton.id = 'sharePlaylistButton';
  shareButton.type = 'button';
  shareButton.className = 'fast-playlist-action share';
  shareButton.textContent = 'Share';
  shareButton.setAttribute('aria-label', 'Share current music');

  const clearButton = document.createElement('button');
  clearButton.id = 'clearPlaylistButton';
  clearButton.type = 'button';
  clearButton.className = 'fast-playlist-action clear';
  clearButton.textContent = 'Clear';
  clearButton.setAttribute('aria-label', 'Clear saved music');

  actions.append(shareButton, clearButton);
  header.appendChild(actions);

  let shareBusy = false;
  shareButton.addEventListener('click', async () => {
    if (shareBusy) return;
    shareBusy = true;
    shareButton.disabled = true;
    shareButton.textContent = 'Preparing…';
    setStatus('PREPARING SHARE');
    try {
      await loadScript('./share-ui-cleanup-v162.js?v=162', 'share-ui-cleanup');
      await loadScript('./compact-share.js?v=164', 'compact-share');
      if (typeof window.winampMusicCompactShare?.share !== 'function') throw new Error('Share module unavailable');
      const url = await window.winampMusicCompactShare.share();
      if (url) {
        // Optional transport alias. The canonical link is already in the dialog; a slow or missing
        // relay only costs link length. QR renders whichever link wins.
        loadScript('./ampula-short-link-v163.js?v=163', 'ampula-short-link')
          .then(() => window.ampulaShortLink?.apply?.(url))
          .catch((error) => {
            console.info('[AMPULAMP share] short link unavailable', error);
            return null;
          })
          .then(() => {
            loadScript('./qr-share-v1.js?v=161', 'qr-share').catch((error) => console.warn('[AMPULAMP share] QR unavailable', error));
          });
      }
    } catch (error) {
      console.warn('[AMPULAMP share] failed', error);
      setStatus('SHARE UNAVAILABLE · TRY AGAIN');
    } finally {
      shareBusy = false;
      shareButton.disabled = false;
      shareButton.textContent = 'Share';
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
    try {
      const url = new URL(location.href);
      for (const key of ['a', 'al', 'p', 's', 'playlist']) url.searchParams.delete(key);
      url.hash = '';
      history.replaceState({}, '', url);
    } catch {}
    clearButton.disabled = true;
    clearButton.textContent = 'Cleared';
    setStatus('MUSIC CLEARED');
    setTimeout(() => location.reload(), 80);
  });

  const params = new URLSearchParams(location.search);
  if (params.has('a')) {
    setTimeout(async () => {
      try {
        await loadScript('./share-ui-cleanup-v162.js?v=162', 'share-ui-cleanup');
        await loadScript('./compact-share.js?v=164', 'compact-share');
      } catch (error) {
        console.warn('[AMPULAMP] shared music receive failed', error);
        setStatus('SHARED MUSIC COULD NOT LOAD');
      }
    }, 0);
  } else if (params.has('al')) {
    setTimeout(async () => {
      try {
        await loadScript('./share-ui-cleanup-v162.js?v=162', 'share-ui-cleanup');
        await loadScript('./compact-share.js?v=164', 'compact-share');
        await loadScript('./ampula-short-link-v163.js?v=163', 'ampula-short-link');
        await window.ampulaShortLink.receive();
      } catch (error) {
        console.warn('[AMPULAMP] short link receive failed', error);
        setStatus('SHORT LINK COULD NOT LOAD');
      }
    }, 0);
  } else if (params.has('p') || params.has('s')) {
    setTimeout(() => {
      loadScript('./legacy-share-v1.js?v=161', 'legacy-share').catch((error) => {
        console.warn('[AMPULAMP] legacy share receive failed', error);
        setStatus('LEGACY SHARE COULD NOT LOAD');
      });
    }, 0);
  }

  console.info('[AMPULAMP] compact actions + legacy share compatibility ready');
})();
