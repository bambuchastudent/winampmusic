(() => {
  if (window.__WINAMP_MUSIC_SHARED_ONBOARDING_V1__) return;
  window.__WINAMP_MUSIC_SHARED_ONBOARDING_V1__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const REPLACE_FLAG = 'winampmusic.sharedReplace.v1';
  const STATUS = document.getElementById('status');

  function isSharedUrl() {
    const params = new URLSearchParams(location.search);
    return Boolean(params.get('s') || params.get('p') || params.get('playlist'));
  }

  function trackCount() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value.length : 0;
    } catch {
      return 0;
    }
  }

  function ensureStyles() {
    if (document.getElementById('sharedPlaylistOnboardingStyles')) return;
    const style = document.createElement('style');
    style.id = 'sharedPlaylistOnboardingStyles';
    style.textContent = `
      .shared-playlist-banner{position:fixed;z-index:2147483000;left:50%;bottom:max(14px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(calc(100% - 20px),560px);padding:14px;border:1px solid #545d6a;border-radius:14px;background:#15181ef5;color:#fff;box-shadow:0 24px 80px rgba(0,0,0,.72);display:grid;gap:10px;backdrop-filter:blur(12px)}
      .shared-playlist-banner[hidden]{display:none}.shared-playlist-banner-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.shared-playlist-banner-head strong{font-size:16px}.shared-playlist-banner-head span{display:block;margin-top:3px;color:#aeb6c3;font-size:12px;line-height:1.4}.shared-playlist-banner-close{border:0;background:transparent;color:#9ea7b5;font-size:18px;line-height:1;padding:2px 4px}.shared-playlist-banner-actions{display:flex;gap:8px;flex-wrap:wrap}.shared-playlist-banner-actions button{min-height:42px;padding:0 13px;border-radius:9px;font-weight:800}.shared-playlist-keep{border:1px solid #8f7724;background:#d8b63f;color:#171717}.shared-playlist-replace{border:1px solid #4a515e;background:#2a3039;color:#fff}.shared-playlist-banner small{color:#7f8998;font-size:10px;line-height:1.35}
    `;
    document.head.appendChild(style);
  }

  function ensureBanner() {
    let banner = document.getElementById('sharedPlaylistBanner');
    if (banner) return banner;

    banner = document.createElement('aside');
    banner.id = 'sharedPlaylistBanner';
    banner.className = 'shared-playlist-banner';
    banner.hidden = true;
    banner.innerHTML = `
      <div class="shared-playlist-banner-head">
        <div><strong id="sharedPlaylistTitle">Playlist received ✓</strong><span id="sharedPlaylistText">It is now in your Winamp Music library.</span></div>
        <button class="shared-playlist-banner-close" type="button" aria-label="Close">✕</button>
      </div>
      <div class="shared-playlist-banner-actions">
        <button class="shared-playlist-keep" type="button">Got it</button>
        <button class="shared-playlist-replace" type="button">Use only this playlist</button>
      </div>
      <small>The second option resets your current playlist, reloads this shared link, and keeps only the received playlist.</small>`;
    document.body.appendChild(banner);

    const close = () => { banner.hidden = true; };
    banner.querySelector('.shared-playlist-banner-close')?.addEventListener('click', close);
    banner.querySelector('.shared-playlist-keep')?.addEventListener('click', close);
    banner.querySelector('.shared-playlist-replace')?.addEventListener('click', () => {
      sessionStorage.setItem(REPLACE_FLAG, '1');
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PLAYER_STATE_KEY);
      location.reload();
    });
    return banner;
  }

  function showReceived() {
    const banner = ensureBanner();
    const replacing = sessionStorage.getItem(REPLACE_FLAG) === '1';
    if (replacing) sessionStorage.removeItem(REPLACE_FLAG);
    const count = trackCount();
    banner.querySelector('#sharedPlaylistTitle').textContent = replacing ? 'Shared playlist is ready ✓' : 'Playlist received ✓';
    banner.querySelector('#sharedPlaylistText').textContent = replacing
      ? `${count || 'The'} received tracks are now your playlist.`
      : `${count || 'The'} tracks are available in your Winamp Music library.`;
    const replace = banner.querySelector('.shared-playlist-replace');
    if (replace) replace.hidden = replacing;
    banner.hidden = false;
  }

  function statusLooksReady() {
    return /SHARED PLAYLIST (IMPORTED|LOADED)/i.test(STATUS?.textContent || '');
  }

  if (!isSharedUrl()) return;
  ensureStyles();

  if (statusLooksReady()) {
    showReceived();
    return;
  }

  if (STATUS) {
    const observer = new MutationObserver(() => {
      if (!statusLooksReady()) return;
      observer.disconnect();
      showReceived();
    });
    observer.observe(STATUS, { childList: true, characterData: true, subtree: true });
    setTimeout(() => observer.disconnect(), 20000);
  }
})();
