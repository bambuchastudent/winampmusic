(() => {
  const STORAGE_KEY = 'winampmusic.library.v1';
  const META_PREFIX = 'WMETA␞';
  const META_SEP = '␞';
  const BADGE_SEP = '␟';
  const list = document.getElementById('trackList');
  const durationDisplay = document.getElementById('duration');
  if (!list || typeof window.renderLibrary !== 'function') return;

  let busy = false;

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function validDuration(value) {
    const text = clean(value);
    return /^(?:\d{1,2}:)?\d{1,2}:\d{2}$/.test(text) ? text : '';
  }

  function splitLeadingDuration(title, explicitDuration = '') {
    const source = clean(title);
    let duration = validDuration(explicitDuration);
    let cleanTitle = source;
    const match = source.match(/^((?:\d{1,2}:)?\d{1,2}:\d{2})(?=\D|$)\s*/);
    if (match) {
      duration ||= validDuration(match[1]);
      cleanTitle = clean(source.slice(match[0].length).replace(/^[\-–—|•·]+\s*/, ''));
    }
    return { title: cleanTitle || source || 'Untitled video', duration };
  }

  function normalizeBadges(value) {
    const items = Array.isArray(value) ? value : value ? [value] : [];
    const seen = new Set();
    const result = [];
    for (const raw of items) {
      const badge = clean(raw);
      if (!badge || badge.length > 80 || validDuration(badge)) continue;
      const key = badge.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(badge);
      if (result.length >= 8) break;
    }
    return result;
  }

  function unpackMetadata(track) {
    const playlist = String(track?.playlist || '');
    if (!playlist.startsWith(META_PREFIX)) return track;
    const [, duration = '', badgeBlob = '', realPlaylist = ''] = playlist.split(META_SEP, 4);
    return {
      ...track,
      playlist: clean(realPlaylist),
      duration: validDuration(track.duration) || validDuration(duration),
      badges: normalizeBadges(track.badges?.length ? track.badges : badgeBlob.split(BADGE_SEP)),
    };
  }

  function normalizeTrack(rawTrack) {
    if (!rawTrack || typeof rawTrack !== 'object') return rawTrack;
    const track = unpackMetadata(rawTrack);
    const parsed = splitLeadingDuration(track.title, track.duration || track.durationText);
    return {
      ...track,
      title: parsed.title,
      duration: parsed.duration,
      badges: normalizeBadges(track.badges || track.youtubeBadges || track.labels),
    };
  }

  function visibleLabels(track) {
    const labels = [...normalizeBadges(track.badges)];
    const hashtags = track.title?.match(/#[\p{L}\p{N}_-]+/gu) || [];
    labels.push(...hashtags);
    const playlist = clean(track.playlist);
    if (playlist && playlist !== track.title && !playlist.startsWith('WMETA')) labels.push(playlist);
    return normalizeBadges(labels).slice(0, 5);
  }

  function readLibrary() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveLibrary(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function migrate() {
    const before = readLibrary();
    const after = before.map(normalizeTrack);
    if (JSON.stringify(before) === JSON.stringify(after)) return false;
    saveLibrary(after);
    return true;
  }

  function badgeNode(text) {
    const node = document.createElement('span');
    node.className = 'youtube-label';
    node.textContent = text;
    node.title = text;
    return node;
  }

  function decorate() {
    if (busy) return;
    busy = true;
    try {
      const library = readLibrary();
      list.querySelectorAll('.track').forEach((row) => {
        const track = normalizeTrack(library[Number(row.dataset.index)]);
        if (!track) return;
        const title = row.querySelector('.track-title');
        if (title) { title.textContent = track.title; title.title = track.title; }

        const artist = row.querySelector('.track-artist');
        if (artist) { artist.textContent = track.artist || 'YouTube'; artist.title = track.artist || ''; }

        const main = row.querySelector('.track-main');
        let labels = row.querySelector('.track-youtube-labels');
        const items = visibleLabels(track);
        if (items.length) {
          if (!labels) { labels = document.createElement('div'); labels.className = 'track-youtube-labels'; main?.appendChild(labels); }
          labels.replaceChildren(...items.map(badgeNode));
        } else labels?.remove();

        let duration = row.querySelector('.track-duration');
        if (!duration) {
          duration = document.createElement('span');
          duration.className = 'track-duration';
          row.insertBefore(duration, row.lastElementChild);
        }
        duration.textContent = track.duration || '—';
      });
    } finally {
      busy = false;
    }
  }

  const observer = new MutationObserver(() => {
    if (migrate()) window.renderLibrary();
    requestAnimationFrame(decorate);
  });
  observer.observe(list, { childList: true, subtree: true });

  setInterval(() => {
    const shown = validDuration(durationDisplay?.textContent);
    if (!shown || shown === '00:00') return;
    const active = list.querySelector('.track.active');
    const index = Number(active?.dataset.index);
    const items = readLibrary();
    if (!Number.isInteger(index) || index < 0 || !items[index] || items[index].duration === shown) return;
    items[index] = normalizeTrack({ ...items[index], duration: shown });
    saveLibrary(items);
    decorate();
  }, 1500);

  if (migrate()) window.renderLibrary();
  decorate();
})();
