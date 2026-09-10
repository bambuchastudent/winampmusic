(() => {
  'use strict';
  if (window.__AMPULA_SPOTIFY_PLAYLIST_160__) return;
  window.__AMPULA_SPOTIFY_PLAYLIST_160__ = true;

  const core = globalThis.AmpulaSpotifyCore160;
  if (!core?.parseSource) return;

  const STORAGE_KEY = 'ampula.spotifySource.v1';
  const API_SRC = 'https://open.spotify.com/embed/iframe-api/v1';
  const TRACK_URI_RE = /^spotify:track:[A-Za-z0-9]{16,40}$/;
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  let apiPromise = null;
  let controller = null;
  let currentSource = null;

  function ensureStyles() {
    if (document.getElementById('ampulaSpotify160Styles')) return;
    const style = document.createElement('style');
    style.id = 'ampulaSpotify160Styles';
    style.textContent = `
      .spotify-source{margin:0 0 12px;padding:12px;border:1px solid #315b43;border-radius:14px;background:linear-gradient(180deg,#18231d,#101713);box-shadow:inset 0 1px rgba(255,255,255,.04)}
      .spotify-source[hidden]{display:none!important}.spotify-source-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px}.spotify-source-copy{min-width:0}.spotify-source-copy .eyebrow{color:#69d991}.spotify-source-copy strong{display:block;margin-top:3px;color:#f4f7f5;font-size:15px;line-height:1.25;overflow-wrap:anywhere}.spotify-source-copy small{display:block;margin-top:3px;color:#95a59b;font-size:10px}.spotify-source-actions{display:flex;gap:6px;flex:0 0 auto}.spotify-source-actions a,.spotify-source-actions button{min-height:34px;border:1px solid #3d5b49;border-radius:8px;background:#1b2a21;color:#dce8df;padding:0 10px;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}.spotify-source-actions button{cursor:pointer}.spotify-source-status{margin:0 0 8px;color:#9ca9a0;font-size:10px}.spotify-embed-slot{min-height:152px;border-radius:12px;overflow:hidden;background:#0c100e}.spotify-embed-slot iframe{display:block;width:100%!important;border:0;border-radius:12px}.spotify-source-fallback{display:grid;place-items:center;gap:10px;min-height:152px;padding:18px;text-align:center;color:#aab5ad}.spotify-source-fallback a{color:#7ae29c;font-weight:900}
      @media(max-width:520px){.spotify-source{padding:10px}.spotify-source-head{display:grid}.spotify-source-actions{justify-content:flex-start}.spotify-source-actions a,.spotify-source-actions button{min-height:40px}.spotify-embed-slot{min-height:352px}}
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    let panel = document.getElementById('spotifySourcePanel');
    if (panel) return panel;
    ensureStyles();
    panel = document.createElement('section');
    panel.id = 'spotifySourcePanel';
    panel.className = 'spotify-source';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="spotify-source-head">
        <div class="spotify-source-copy">
          <div class="eyebrow">SPOTIFY PLAYLIST</div>
          <strong id="spotifySourceTitle">Spotify playlist</strong>
          <small id="spotifySourceOwner">Official Spotify embed</small>
        </div>
        <div class="spotify-source-actions">
          <a id="spotifySourceOpen" href="https://open.spotify.com" target="_blank" rel="noopener noreferrer">Open Spotify</a>
          <button id="spotifySourceClose" type="button">Close</button>
        </div>
      </div>
      <div id="spotifySourceStatus" class="spotify-source-status">Ready</div>
      <div id="spotifyEmbedSlot" class="spotify-embed-slot"></div>`;

    const fastImport = document.querySelector('.fast-import');
    const player = document.querySelector('.player');
    if (fastImport?.parentElement) fastImport.insertAdjacentElement('afterend', panel);
    else if (player?.parentElement) player.parentElement.insertBefore(panel, player);
    else document.querySelector('main')?.appendChild(panel);

    panel.querySelector('#spotifySourceClose')?.addEventListener('click', closeSource);
    return panel;
  }

  function setStatus(message) {
    const node = ensurePanel().querySelector('#spotifySourceStatus');
    if (node) node.textContent = clean(message) || 'Ready';
  }

  function saveSource(source) {
    if (!source) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      playlistId: source.playlistId,
      canonicalUrl: source.canonicalUrl,
      title: source.title || '',
      owner: source.owner || '',
      sourceUrl: source.sourceUrl || source.canonicalUrl,
    }));
  }

  function loadSavedSource() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved?.playlistId) return null;
      return core.parseSource(saved.canonicalUrl || `https://open.spotify.com/playlist/${saved.playlistId}`)
        ? { ...saved, provider: 'spotify', kind: 'playlist' }
        : null;
    } catch {
      return null;
    }
  }

  function sourceSnapshot() {
    if (!currentSource?.playlistId) return null;
    return {
      playlistId: clean(currentSource.playlistId),
      canonicalUrl: clean(currentSource.canonicalUrl),
      sourceUrl: clean(currentSource.sourceUrl || currentSource.canonicalUrl),
      title: clean(currentSource.title),
      owner: clean(currentSource.owner),
    };
  }

  function emitPlaybackEvent(type, data = {}) {
    const playingURI = clean(data?.playingURI);
    if (!TRACK_URI_RE.test(playingURI)) return;
    const detail = {
      playingURI,
      durationMs: Math.max(0, Number(data?.duration || 0)),
      positionMs: Math.max(0, Number(data?.position || 0)),
      playlist: sourceSnapshot(),
    };
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }

  function resetSlot() {
    const panel = ensurePanel();
    const old = panel.querySelector('#spotifyEmbedSlot');
    const next = document.createElement('div');
    next.id = 'spotifyEmbedSlot';
    next.className = 'spotify-embed-slot';
    if (old) old.replaceWith(next);
    else panel.appendChild(next);
    return next;
  }

  function closeSource() {
    try { controller?.pause?.(); } catch {}
    try { controller?.destroy?.(); } catch {}
    controller = null;
    currentSource = null;
    saveSource(null);
    const panel = ensurePanel();
    panel.hidden = true;
    resetSlot();
  }

  function spotifyApi() {
    if (window.__AMPULA_SPOTIFY_IFRAME_API__) return Promise.resolve(window.__AMPULA_SPOTIFY_IFRAME_API__);
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onSpotifyIframeApiReady;
      const timeout = setTimeout(() => reject(new Error('Spotify embed API timeout')), 12000);
      window.onSpotifyIframeApiReady = (api) => {
        clearTimeout(timeout);
        window.__AMPULA_SPOTIFY_IFRAME_API__ = api;
        try { previous?.(api); } catch {}
        resolve(api);
      };
      let script = document.querySelector(`script[src="${API_SRC}"]`);
      if (!script) {
        script = document.createElement('script');
        script.src = API_SRC;
        script.async = true;
        script.dataset.ampulaSpotifyApi = '1';
        script.addEventListener('error', () => reject(new Error('Spotify embed API failed to load')), { once: true });
        document.head.appendChild(script);
      }
    }).finally(() => { apiPromise = null; });
    return apiPromise;
  }

  async function readOEmbed(source) {
    try {
      const url = new URL('https://open.spotify.com/oembed');
      url.searchParams.set('url', source.canonicalUrl);
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return null;
      const data = await response.json();
      return { title: clean(data?.title), thumbnail: clean(data?.thumbnail_url) };
    } catch {
      return null;
    }
  }

  function renderFallback(source, error) {
    const slot = resetSlot();
    slot.innerHTML = `<div class="spotify-source-fallback"><strong>Spotify player could not be embedded here.</strong><a href="${source.canonicalUrl}" target="_blank" rel="noopener noreferrer">Open this playlist in Spotify</a></div>`;
    setStatus(error?.message || 'Spotify embed unavailable');
  }

  async function openSource(valueOrSource, options = {}) {
    const source = typeof valueOrSource === 'string' ? core.parseSource(valueOrSource) : valueOrSource;
    if (!source?.playlistId) return { handled: false };

    const panel = ensurePanel();
    panel.hidden = false;
    currentSource = source;
    panel.querySelector('#spotifySourceOpen').href = source.canonicalUrl;
    panel.querySelector('#spotifySourceTitle').textContent = source.title || 'Spotify playlist';
    panel.querySelector('#spotifySourceOwner').textContent = source.owner || 'Official Spotify embed';
    setStatus('Loading Spotify playlist…');
    saveSource(source);
    options.input && (options.input.value = '');
    options.onStatus?.({ phase: 'loading', message: 'Loading Spotify playlist…' });

    const oembedPromise = readOEmbed(source);
    try {
      const api = await spotifyApi();
      if (currentSource?.playlistId !== source.playlistId) return { handled: true, stale: true };
      const slot = resetSlot();
      const width = Math.max(300, Math.floor(panel.getBoundingClientRect().width - 24));
      controller = await new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) reject(new Error('Spotify player did not initialize'));
        }, 10000);
        api.createController(slot, {
          uri: `spotify:playlist:${source.playlistId}`,
          width,
          height: 352,
        }, (embedController) => {
          settled = true;
          clearTimeout(timer);
          resolve(embedController);
        });
      });

      controller.addListener?.('ready', () => setStatus('Spotify playlist ready · heard tracks save automatically'));
      controller.addListener?.('playback_started', (event) => {
        setStatus('Playing from Spotify · saving heard track…');
        emitPlaybackEvent('ampula:spotify-playback-started', event?.data);
      });
      controller.addListener?.('playback_update', (event) => {
        if (event?.data?.isBuffering) setStatus('Spotify buffering…');
        else if (event?.data?.isPaused === false) setStatus('Playing from Spotify · heard tracks save automatically');
        emitPlaybackEvent('ampula:spotify-playback-update', event?.data);
      });
      try { controller.play?.(); } catch {}

      const meta = await oembedPromise;
      if (meta?.title && currentSource?.playlistId === source.playlistId) {
        source.title = meta.title;
        panel.querySelector('#spotifySourceTitle').textContent = meta.title;
        saveSource(source);
      }
      options.onStatus?.({ phase: 'done', message: source.title ? `Spotify · ${source.title}` : 'Spotify playlist ready' });
      return { handled: true, source };
    } catch (error) {
      console.warn('[ÁmpulaMP] Spotify playlist embed failed', error);
      renderFallback(source, error);
      options.onStatus?.({ phase: 'error', message: 'Open this playlist in Spotify', error });
      return { handled: true, source, error };
    }
  }

  async function restoreSaved() {
    const saved = loadSavedSource();
    if (!saved) return;
    await openSource(saved, { restore: true });
  }

  window.ampulaSpotifyPlaylist160 = {
    parseSource: core.parseSource,
    openSource,
    closeSource,
    restoreSaved,
  };

  setTimeout(() => restoreSaved().catch(() => {}), 250);
  console.info('[ÁmpulaMP] Spotify playlist source 1.6 ready');
})();