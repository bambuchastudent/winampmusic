(() => {
  if (window.__WINAMP_MUSIC_SHARE_CURRENT_V062__) return;
  window.__WINAMP_MUSIC_SHARE_CURRENT_V062__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const STATUS = document.getElementById('status');
  const ID_PATTERN = /^[\w-]{6,20}$/;

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function currentTrack() {
    const library = readJson(STORAGE_KEY, []);
    if (!Array.isArray(library)) return null;
    const currentId = String(readJson(PLAYER_STATE_KEY, {}).currentId || '').trim();
    if (!ID_PATTERN.test(currentId)) return null;
    return library.find((track) => track?.id === currentId) || null;
  }

  function ensureDialog() {
    let dialog = document.getElementById('winampCurrentTrackShareDialog');
    if (dialog) return dialog;

    dialog = document.createElement('dialog');
    dialog.id = 'winampCurrentTrackShareDialog';
    dialog.style.cssText = 'width:min(calc(100% - 24px),620px);border:1px solid #343a46;border-radius:14px;color:#fff;background:#15181e;padding:0;box-shadow:0 30px 100px rgba(0,0,0,.7);';
    dialog.innerHTML = `
      <div style="padding:16px;display:grid;gap:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
          <div><div style="font-size:10px;letter-spacing:.16em;color:#8f98a8;font-weight:800">SHARE CURRENT TRACK</div><strong id="winampCurrentShareHeading">Track link ready</strong></div>
          <button id="winampCurrentShareClose" type="button" aria-label="Close" style="border:0;background:transparent;color:#8f98a8;font-size:18px">✕</button>
        </div>
        <p id="winampCurrentShareNote" style="margin:0;color:#b4bbc7;font-size:12px;line-height:1.4"></p>
        <input id="winampCurrentShareUrl" readonly style="width:100%;min-height:42px;border:1px solid #343a46;border-radius:8px;background:#0c0e12;color:#b7f29e;padding:0 10px;font:11px SFMono-Regular,Consolas,monospace" />
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button id="winampCurrentShareCopy" type="button" style="min-height:40px;padding:0 14px;border:1px solid #4a515e;border-radius:8px;background:#2a3039;color:#fff;font-weight:800">Copy link</button>
          <button id="winampCurrentShareSystem" type="button" style="min-height:40px;padding:0 14px;border:1px solid #8f7724;border-radius:8px;background:#d8b63f;color:#171717;font-weight:800">Share…</button>
        </div>
      </div>`;
    document.body.appendChild(dialog);

    dialog.querySelector('#winampCurrentShareClose').addEventListener('click', () => dialog.close());
    dialog.querySelector('#winampCurrentShareCopy').addEventListener('click', async () => {
      const input = dialog.querySelector('#winampCurrentShareUrl');
      try {
        await navigator.clipboard.writeText(input.value);
        if (STATUS) STATUS.textContent = 'TRACK LINK COPIED';
      } catch {
        input.focus();
        input.select();
        document.execCommand?.('copy');
        if (STATUS) STATUS.textContent = 'TRACK LINK SELECTED';
      }
    });
    dialog.querySelector('#winampCurrentShareSystem').addEventListener('click', async () => {
      const input = dialog.querySelector('#winampCurrentShareUrl');
      const track = currentTrack();
      if (!navigator.share || !track) return;
      try {
        await navigator.share({
          title: track.title || 'Winamp Music track',
          text: [track.artist, track.title].filter(Boolean).join(' — '),
          url: input.value,
        });
        if (STATUS) STATUS.textContent = 'TRACK SHARED';
      } catch {}
    });
    return dialog;
  }

  async function showLink(url, track, fallback) {
    const dialog = ensureDialog();
    dialog.querySelector('#winampCurrentShareHeading').textContent = fallback ? 'Fallback track link ready' : 'Track link ready';
    dialog.querySelector('#winampCurrentShareNote').textContent = `${track.artist || 'YouTube'} — ${track.title || track.id} · opens this track only`;
    const input = dialog.querySelector('#winampCurrentShareUrl');
    input.value = url;
    dialog.querySelector('#winampCurrentShareSystem').hidden = !navigator.share;
    try {
      await navigator.clipboard?.writeText(url);
      if (STATUS) STATUS.textContent = fallback ? 'TRACK FALLBACK LINK COPIED' : 'TRACK LINK COPIED';
    } catch {
      if (STATUS) STATUS.textContent = fallback ? 'TRACK FALLBACK LINK READY' : 'TRACK LINK READY';
    }
    if (!dialog.open) dialog.showModal();
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }

  async function shareCurrentTrack() {
    const track = currentTrack();
    if (!track) {
      if (STATUS) STATUS.textContent = 'PLAY A TRACK FIRST';
      return;
    }

    const compact = window.winampMusicCompactShare;
    if (!compact?.createRemoteShare) {
      if (STATUS) STATUS.textContent = 'SHARE IS STILL LOADING';
      return;
    }

    if (STATUS) STATUS.textContent = 'CREATING TRACK LINK';
    try {
      const url = await compact.createRemoteShare([track]);
      await showLink(url, track, false);
    } catch (error) {
      console.warn('[Winamp Music current-track share] short link failed', error);
      const url = compact.buildFallbackUrl?.([track.id]);
      if (!url) {
        if (STATUS) STATUS.textContent = 'TRACK SHARE FAILED';
        return;
      }
      await showLink(url, track, true);
    }
  }

  function mount() {
    let button = document.getElementById('shareCurrentTrackButton');
    if (!button) {
      const playlistButton = document.getElementById('sharePlaylistButton');
      if (!playlistButton?.parentNode) return;
      button = document.createElement('button');
      button.id = 'shareCurrentTrackButton';
      button.className = playlistButton.className || 'ghost';
      button.type = 'button';
      button.textContent = 'Share current track';
      playlistButton.insertAdjacentElement('beforebegin', button);
    }
    if (button.dataset.currentShareV062 === '1') return;
    button.dataset.currentShareV062 = '1';
    button.addEventListener('click', shareCurrentTrack);
  }

  window.winampMusicShareCurrentTrack = shareCurrentTrack;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
