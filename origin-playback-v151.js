(() => {
  'use strict';
  if (window.__AMP_MUSIC_ORIGIN_PLAYBACK_151__) return;
  window.__AMP_MUSIC_ORIGIN_PLAYBACK_151__ = true;

  const STORAGE_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const $ = (id) => document.getElementById(id);

  const ui = {
    status: $('status'),
    title: $('nowTitle'),
    artist: $('nowArtist'),
    hint: $('fastImportHint'),
    form: $('fastImportForm'),
    input: $('fastImportInput'),
  };

  let lastAppleUrl = '';
  let updating = false;

  function readLibrary() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function currentTrack() {
    const library = readLibrary();
    const index = Number(localStorage.getItem(CURRENT_KEY));
    return Number.isInteger(index) && index >= 0 && index < library.length ? library[index] : null;
  }

  function parseAppleUrl(value) {
    try {
      const url = new URL(clean(value));
      if (url.hostname.replace(/^www\./, '').toLowerCase() !== 'music.apple.com') return null;
      const parts = url.pathname.split('/').filter(Boolean);
      const storefront = /^[a-z]{2}$/i.test(parts[0] || '') ? parts[0].toUpperCase() : '';
      return { url: url.href, storefront };
    } catch {
      return null;
    }
  }

  function appleOrigin(track) {
    const badges = Array.isArray(track?.badges) ? track.badges.map(clean) : [];
    const source = clean(track?.originUrl || track?.sourceUrl);
    const parsed = parseAppleUrl(source);
    const isApple = Boolean(parsed) || Boolean(clean(track?.appleTrackId)) || badges.includes('Apple Music');
    if (!isApple) return null;
    const fallback = parseAppleUrl(lastAppleUrl);
    return {
      url: parsed?.url || fallback?.url || source,
      storefront: clean(track?.originStorefront) || parsed?.storefront || fallback?.storefront || '',
    };
  }

  function activeOrigin() {
    const track = currentTrack();
    if (track) return { track, origin: appleOrigin(track) };
    return { track: null, origin: parseAppleUrl(lastAppleUrl) };
  }

  function ensureSourceLine() {
    let line = $('nowSource');
    if (line) return line;
    if (!ui.artist?.parentElement) return null;
    line = document.createElement('div');
    line.id = 'nowSource';
    line.className = 'now-source';
    line.hidden = true;
    line.style.cssText = 'margin-top:5px;color:#94a58f;font:700 10px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.055em;text-transform:uppercase;white-space:normal';
    ui.artist.insertAdjacentElement('afterend', line);
    return line;
  }

  function providerState(track, statusText) {
    const status = clean(statusText).toUpperCase();
    if (/NO PLAYABLE SOURCE|TRACK UNAVAILABLE|APPLE TRACK NOT MATCHED/.test(status)) return 'No playable source in AMP';
    if (/APPLE MUSIC\s*·\s*PLAYING/.test(status)) return 'Playing · Apple Music';
    if (/YOUTUBE DIRECT\s*·\s*PLAYING|PLAYING\s*·\s*DIRECT|^PLAYING$/.test(status)) return 'Playing · YouTube';

    const badges = Array.isArray(track?.badges) ? track.badges.map(clean) : [];
    if (badges.some((badge) => /strict match|youtube match/i.test(badge)) || /APPLE MUSIC MATCHED|MATCHING APPLE MUSIC|RESOLVING DIRECT AUDIO/.test(status)) {
      return 'Playback · YouTube candidate';
    }
    return 'Playback · not resolved';
  }

  function rewriteLegacyStatus(track) {
    if (!ui.status || !appleOrigin(track)) return;
    const text = clean(ui.status.textContent);
    if (text === 'TRACK UNAVAILABLE · STAYING IN AMP MUSIC') {
      ui.status.textContent = 'NO PLAYABLE SOURCE IN AMP · APPLE ORIGIN PRESERVED';
    }
  }

  function rewriteImportHint(track, origin) {
    if (!ui.hint || !origin) return;
    const text = clean(ui.hint.textContent);
    const status = clean(ui.status?.textContent).toUpperCase();
    const region = origin.storefront ? ` (${origin.storefront})` : '';
    const apple = `Apple Music${region}`;

    if (/APPLE TRACK NOT MATCHED|NO PLAYABLE SOURCE/.test(status)) {
      if (/Apple Music/i.test(text) || lastAppleUrl) ui.hint.textContent = `${apple} origin preserved · no playable source in AMP`;
      return;
    }
    if (/APPLE MUSIC\s*·\s*PLAYING/.test(status)) {
      if (/Apple Music/i.test(text) || lastAppleUrl) ui.hint.textContent = `${apple} origin preserved · playing from Apple Music`;
      return;
    }
    if (/YOUTUBE DIRECT\s*·\s*PLAYING|PLAYING\s*·\s*DIRECT/.test(status)) {
      if (/Apple Music/i.test(text) || lastAppleUrl) ui.hint.textContent = `${apple} origin preserved · playing from YouTube`;
      return;
    }
    if (text === 'Apple Music track added · playing YouTube match') {
      ui.hint.textContent = `${apple} origin preserved · YouTube match found · playback not verified`;
    }
  }

  function refresh() {
    if (updating) return;
    updating = true;
    try {
      const { track, origin } = activeOrigin();
      rewriteLegacyStatus(track);
      const line = ensureSourceLine();
      if (!line) return;
      if (!origin) {
        line.hidden = true;
        line.textContent = '';
        line.removeAttribute('data-origin-url');
        line.removeAttribute('title');
        return;
      }

      const region = origin.storefront ? ` (${origin.storefront})` : '';
      line.hidden = false;
      line.textContent = `Origin · Apple Music${region} · ${providerState(track, ui.status?.textContent)}`;
      if (origin.url) {
        line.dataset.originUrl = origin.url;
        line.title = `Original Apple Music link: ${origin.url}`;
      }
      rewriteImportHint(track, origin);
    } finally {
      updating = false;
    }
  }

  function rememberAppleInput() {
    const parsed = parseAppleUrl(ui.input?.value);
    if (parsed) lastAppleUrl = parsed.url;
  }

  ui.form?.addEventListener('submit', rememberAppleInput, true);
  ui.input?.addEventListener('paste', () => setTimeout(() => { rememberAppleInput(); refresh(); }, 0));

  const observer = new MutationObserver(() => queueMicrotask(refresh));
  for (const node of [ui.status, ui.title, ui.artist, ui.hint]) {
    if (node) observer.observe(node, { childList: true, characterData: true, subtree: true });
  }

  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);
  window.ampMusicOriginPlayback151 = { parseAppleUrl, appleOrigin, providerState, refresh };

  refresh();
  console.info('[AmpMusic] origin/playback provenance 1.5.1 ready');
})();
