(() => {
  if (window.__WINAMP_MUSIC_UNIVERSAL_IMPORT_V1__) return;
  window.__WINAMP_MUSIC_UNIVERSAL_IMPORT_V1__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const ODESLI_API = 'https://api.song.link/v1-alpha.1/links';
  const STATUS = document.getElementById('status');
  let activeController = null;
  let lastHandled = '';
  let lastHandledAt = 0;

  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  function extractUrl(value) {
    const match = String(value || '').match(/https?:\/\/[^\s<>'"]+/i);
    return (match?.[0] || '').replace(/[),.;!?]+$/g, '');
  }

  function parse(value) {
    const raw = clean(value);
    const href = extractUrl(raw) || raw;
    if (!/^https?:\/\//i.test(href)) return null;
    try {
      const url = new URL(href);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      if (host === 'open.spotify.com' && /\/track\/[^/]+/i.test(url.pathname)) return { source: 'Spotify', href: url.href, raw };
      if (['vk.com', 'm.vk.com', 'vk.ru', 'm.vk.ru'].includes(host) && /\/(?:audio|music)/i.test(url.pathname)) return { source: 'VK', href: url.href, raw };
      return null;
    } catch {
      return null;
    }
  }

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
  }

  function videoIdFromUrl(value) {
    try {
      const url = new URL(clean(value));
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      let id = '';
      if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
      else if (['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) id = url.searchParams.get('v') || '';
      return /^[\w-]{6,20}$/.test(id) ? id : '';
    } catch { return ''; }
  }

  function metadataFromOdesli(payload) {
    const entities = payload?.entitiesByUniqueId || {};
    const preferred = entities[payload?.entityUniqueId || ''];
    const all = preferred ? [preferred, ...Object.values(entities)] : Object.values(entities);
    const entity = all.find((item) => item && (item.title || item.artistName || item.thumbnailUrl)) || {};
    return {
      title: clean(entity.title),
      artist: clean(entity.artistName),
      artwork: clean(entity.thumbnailUrl),
      durationMs: 0,
    };
  }

  function metadataFromSharedText(parsed) {
    let text = clean(parsed.raw).replace(parsed.href, ' ').replace(/https?:\/\/[^\s]+/gi, ' ');
    text = clean(text.replace(/\b(?:listen|open|spotify|vk|vkontakte|music|track|song|share|слушать|музыка|трек)\b/gi, ' '));
    if (!text || text.length < 3) return null;
    const parts = text.split(/\s+[—–-]\s+/).map(clean).filter(Boolean);
    if (parts.length >= 2) return { artist: parts[0], title: parts.slice(1).join(' - '), artwork: '', durationMs: 0 };
    return { artist: '', title: text, artwork: '', durationMs: 0 };
  }

  async function resolveOdesli(parsed, signal) {
    const url = new URL(ODESLI_API);
    url.searchParams.set('url', parsed.href);
    const response = await fetch(url, { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`resolver HTTP ${response.status}`);
    const payload = await response.json();
    const links = payload?.linksByPlatform || {};
    const youtubeUrl = clean(links.youtubeMusic?.url || links.youtube?.url);
    return { payload, youtubeUrl, metadata: metadataFromOdesli(payload) };
  }

  function saveAndPlay(match, metadata, parsed) {
    const track = {
      id: match.id,
      title: metadata.title || match.title || `YouTube ${match.id}`,
      artist: metadata.artist || match.artist || 'YouTube',
      thumbnail: metadata.artwork || match.thumbnail || `https://i.ytimg.com/vi/${match.id}/hqdefault.jpg`,
      duration: Number(match.duration || 0),
      playlist: `${parsed.source} import`,
      badges: [parsed.source, 'YouTube match'],
      sourceUrl: parsed.href,
      importedAt: new Date().toISOString(),
    };
    window.importTracks?.([track]);
    const library = readJson(STORAGE_KEY, []);
    if (Array.isArray(library)) {
      const index = library.findIndex((item) => item?.id === match.id);
      if (index >= 0) {
        library[index] = { ...library[index], ...track, id: match.id };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
      }
    }
    const state = readJson(PLAYER_STATE_KEY, {});
    localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify({ ...state, currentId: match.id }));
    window.renderLibrary?.();
    const finalLibrary = readJson(STORAGE_KEY, []);
    const finalIndex = Array.isArray(finalLibrary) ? finalLibrary.findIndex((item) => item?.id === match.id) : -1;
    if (finalIndex >= 0) setTimeout(() => window.playIndex?.(finalIndex), 0);
    return finalIndex >= 0;
  }

  function clearInputs(parsed, explicitInput) {
    if (explicitInput) explicitInput.value = '';
    for (const id of ['youtubeImportInput', 'songSearchInput']) {
      const input = document.getElementById(id);
      if (input && extractUrl(input.value) === parsed.href) input.value = '';
    }
  }

  async function findMatch(metadata, signal) {
    const finder = window.winampMusicAppleImport?.findYouTubeMatch;
    if (typeof finder !== 'function') throw new Error('YouTube matcher is still loading');
    return finder(metadata, signal);
  }

  async function handleUrl(value, options = {}) {
    const parsed = parse(value);
    if (!parsed) return false;
    const now = Date.now();
    if (parsed.href === lastHandled && now - lastHandledAt < 900) return true;
    lastHandled = parsed.href;
    lastHandledAt = now;

    activeController?.abort();
    activeController = new AbortController();
    const signal = activeController.signal;
    if (STATUS) STATUS.textContent = `MATCHING ${parsed.source.toUpperCase()}`;

    try {
      let metadata = null;
      try {
        const resolved = await resolveOdesli(parsed, signal);
        metadata = resolved.metadata;
        const directId = videoIdFromUrl(resolved.youtubeUrl);
        if (directId && window.winampMusicDirectYouTubeImport?.handleUrl?.(resolved.youtubeUrl)) {
          setTimeout(() => {
            const library = readJson(STORAGE_KEY, []);
            const index = Array.isArray(library) ? library.findIndex((item) => item?.id === directId) : -1;
            if (index >= 0) {
              library[index] = {
                ...library[index],
                title: metadata.title || library[index].title,
                artist: metadata.artist || library[index].artist,
                thumbnail: metadata.artwork || library[index].thumbnail,
                playlist: `${parsed.source} import`,
                badges: [parsed.source, 'YouTube match'],
                sourceUrl: parsed.href,
              };
              localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
              window.renderLibrary?.();
              window.playIndex?.(index);
            }
          }, 180);
          clearInputs(parsed, options.input);
          if (STATUS) STATUS.textContent = `${parsed.source.toUpperCase()} IMPORTED`;
          return true;
        }
      } catch (error) {
        if (error?.name === 'AbortError') return true;
      }

      metadata = metadata?.title ? metadata : metadataFromSharedText(parsed);
      if (!metadata?.title) throw new Error(`${parsed.source} metadata unavailable`);
      const match = await findMatch(metadata, signal);
      if (!saveAndPlay(match, metadata, parsed)) throw new Error('Could not save track');
      clearInputs(parsed, options.input);
      if (STATUS) STATUS.textContent = `${parsed.source.toUpperCase()} IMPORTED`;
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') return true;
      console.warn('[Winamp Music universal import]', error);
      if (STATUS) STATUS.textContent = `${parsed.source.toUpperCase()} IMPORT FAILED`;
      return true;
    }
  }

  function bindInput() {
    const input = document.getElementById('youtubeImportInput');
    if (!input || input.dataset.universalImportV1 === '1') return Boolean(input);
    input.dataset.universalImportV1 = '1';
    input.addEventListener('paste', (event) => {
      const text = event.clipboardData?.getData('text') || '';
      if (!parse(text)) return;
      event.preventDefault();
      input.value = text;
      handleUrl(text, { input });
    }, true);
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || !parse(input.value)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      handleUrl(input.value, { input });
    }, true);
    return true;
  }

  let attempts = 0;
  const mount = () => {
    if (bindInput()) return;
    attempts += 1;
    if (attempts < 120) setTimeout(mount, 50);
  };

  window.winampMusicUniversalImport = { parse, handleUrl };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
