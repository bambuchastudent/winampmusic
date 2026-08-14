(() => {
  const STORAGE_KEY = 'winampmusic.library.v1';
  const STATUS = document.getElementById('status');
  const MAX_WAIT_MS = 3500;
  const BETWEEN_TRACKS_MS = 80;

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

  window.addEventListener('load', () => setTimeout(() => repair().catch(() => {}), 400));
})();
