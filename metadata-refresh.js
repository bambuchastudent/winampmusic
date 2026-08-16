(() => {
  const STORAGE_KEY = 'winampmusic.library.v1';
  const STATUS = document.getElementById('status');
  const MAX_WAIT_MS = 3500;
  const BETWEEN_TRACKS_MS = 80;

  function installWinampBranding() {
    if (!document.querySelector('link[data-winamp-icon]')) {
      const icon = document.createElement('link');
      icon.rel = 'icon';
      icon.type = 'image/svg+xml';
      icon.href = './icon.svg';
      icon.dataset.winampIcon = '1';
      document.head.appendChild(icon);
    }

    const topbar = document.querySelector('.topbar');
    const titleBlock = topbar?.firstElementChild;
    if (!topbar || !titleBlock || topbar.querySelector('.winamp-logo')) return;

    const brand = document.createElement('div');
    brand.className = 'winamp-brand';
    brand.style.cssText = 'display:flex;align-items:center;gap:10px;min-width:0;';

    const logo = document.createElement('img');
    logo.className = 'winamp-logo';
    logo.src = './icon.svg';
    logo.alt = 'Winamp';
    logo.width = 52;
    logo.height = 52;
    logo.style.cssText = 'display:block;width:clamp(42px,10vw,52px);height:clamp(42px,10vw,52px);object-fit:contain;flex:0 0 auto;filter:drop-shadow(0 3px 8px rgba(252,166,0,.25));';

    topbar.insertBefore(brand, titleBlock);
    brand.append(logo, titleBlock);
  }

  function loadScript(src, marker) {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.setAttribute(marker, '1');
    (document.head || document.documentElement).appendChild(script);
  }

  function loadCompactShare() {
    loadScript('./compact-share.js?v=0.5', 'data-winamp-compact-share');
  }

  function loadCurrentFixes() {
    loadScript('./activity-ticker-v1.js?v=1.0', 'data-winamp-activity-ticker-v1');
    loadScript('./qr-share-v1.js?v=1.0', 'data-winamp-qr-share-v1');
    loadScript('./shared-playlist-onboarding-v1.js?v=1.0', 'data-winamp-shared-onboarding-v1');
    loadScript('./input-v056.js?v=0.5.6', 'data-winamp-v056-input');
    loadScript('./universal-music-import-v1.js?v=1.0', 'data-winamp-universal-import-v1');
    loadScript('./unified-search-v065.js?v=1.0', 'data-winamp-unified-search-v1');
    loadScript('./support-v1.js?v=1.0.1', 'data-winamp-support-v1');
    loadScript('./playback-continuity.js?v=0.5.6', 'data-winamp-playback-continuity');
    loadScript('./background-playback-v11.js?v=1.1', 'data-winamp-background-v11');
    loadScript('./production-polish-v12.js?v=1.2', 'data-winamp-production-polish-v12');
    // Set this synchronously so comments.js cannot start the older lyrics-sync
    // module while the v0.5.7 replacement is still downloading.
    window.__WINAMP_SYNCED_LYRICS_V2__ = true;
    loadScript('./lyrics-v057.js?v=0.5.7', 'data-winamp-lyrics-v057');
    const footer = document.querySelector('.app-version');
    if (footer) footer.textContent = 'v1.2';
  }

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function weakTitle(track) {
    const title = clean(track?.title);
    if (!title) return true;
    if (/^(?:current track|track \d+|джем|jam|mix|radio)$/i.test(title)) return true;
    return title.toLowerCase() === `youtube ${track?.id || ''}`.toLowerCase();
  }

  function needsRepair(track) {
    return track && /^[\w-]{6,20}$/.test(track.id || '') && (weakTitle(track) || !track.artist || track.artist === 'YouTube');
  }

  function readLibrary() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  async function waitForApi() {
    const started = Date.now();
    while (!window.YT?.Player || typeof window.importTracks !== 'function') {
      if (Date.now() - started > 12000) return false;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return true;
  }

  async function createProbe() {
    const host = document.createElement('div');
    host.id = `metadataRepairProbe-${Date.now()}`;
    host.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;';
    document.body.appendChild(host);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('metadata probe timeout')), 8000);
      const player = new YT.Player(host, {
        width: '1',
        height: '1',
        playerVars: { playsinline: 1, controls: 0, autoplay: 0, origin: location.origin },
        events: {
          onReady: () => {
            clearTimeout(timer);
            resolve(player);
          },
          onError: () => {},
        },
      });
    });
  }

  async function metadataFor(player, id) {
    try { player.cueVideoById(id); } catch { return null; }
    const started = Date.now();
    while (Date.now() - started < MAX_WAIT_MS) {
      const data = player.getVideoData?.();
      const title = clean(data?.title);
      const artist = clean(data?.author);
      if (data?.video_id === id && title && !/^(?:джем|jam|mix|radio)$/i.test(title)) {
        return { id, title, artist: artist || 'YouTube' };
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
  }

  async function repair() {
    if (!(await waitForApi())) return;
    const broken = readLibrary().filter(needsRepair);
    if (!broken.length) return;

    let probe;
    try { probe = await createProbe(); } catch { return; }
    let repaired = 0;

    for (let index = 0; index < broken.length; index += 1) {
      const track = broken[index];
      if (STATUS && !['PLAYING', 'PAUSED'].includes(STATUS.textContent)) {
        STATUS.textContent = `FIXING NAMES ${index + 1}/${broken.length}`;
      }
      const metadata = await metadataFor(probe, track.id);
      if (metadata) {
        window.winampMusicActivity?.progress?.(index + 1, broken.length, metadata);
        window.importTracks([{ ...track, ...metadata }]);
        repaired += 1;
      }
      await new Promise((resolve) => setTimeout(resolve, BETWEEN_TRACKS_MS));
    }

    try { probe.destroy?.(); } catch {}
    if (STATUS && !['PLAYING', 'PAUSED'].includes(STATUS.textContent)) {
      STATUS.textContent = repaired ? `NAMES FIXED ${repaired}` : 'READY';
      setTimeout(() => {
        if (STATUS.textContent.startsWith('NAMES FIXED')) STATUS.textContent = 'READY';
      }, 2200);
    }
  }

  window.refreshWinampMetadata = () => repair().catch(() => {});
  installWinampBranding();
  loadCompactShare();
  loadCurrentFixes();
  window.addEventListener('load', () => setTimeout(() => window.refreshWinampMetadata(), 400));
})();
