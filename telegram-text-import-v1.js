(() => {
  'use strict';
  if (window.__AMP_MUSIC_TELEGRAM_TEXT_1__) return;
  window.__AMP_MUSIC_TELEGRAM_TEXT_1__ = true;

  const MAX_LINE = 300;
  const MAX_SIDE = 120;
  const MAX_TRACKS = 300;
  const TIME_PREFIX = /^\[?\s*\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\s*\]?\s*(?:am|pm)?\s+/i;
  const NAME_PREFIX = /^([^:]{1,40}):\s+(\S[\s\S]*)$/;
  const WIDE_DASH = /[—–]/;
  const SPACED_HYPHEN = /\s-{1,2}\s/;
  const SCHEME_URL = /^[a-z][a-z0-9+.-]*:\/\//i;
  const BARE_HOST = /^(?:www\.|[a-z0-9-]+(?:\.[a-z0-9-]+)+[/?#])/i;
  const ANY_URL = /\b[a-z][a-z0-9+.-]*:\/\//i;

  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const isUrlLike = (value) => SCHEME_URL.test(value) || BARE_HOST.test(value) || ANY_URL.test(value);

  const panel = document.getElementById('textImportPanel');
  const area = document.getElementById('textImportInput');
  const runButton = document.getElementById('textImportButton');
  const toggle = document.getElementById('textImportToggle');
  const hint = document.getElementById('textImportHint');
  const unifiedHint = document.getElementById('fastImportHint');

  function setStatus(message) {
    if (hint) hint.textContent = message;
    if (unifiedHint) unifiedHint.textContent = message;
  }

  // Removes a leading chat clock and a leading short author name. The author candidate must not
  // contain a separator, otherwise `Artist — Title: subtitle` would lose its artist and title.
  function stripChatPrefix(line) {
    const withoutTime = line.replace(TIME_PREFIX, '');
    const named = withoutTime.match(NAME_PREFIX);
    if (!named) return withoutTime;
    const name = named[1];
    if (WIDE_DASH.test(name) || SPACED_HYPHEN.test(name) || isUrlLike(name)) return withoutTime;
    return named[2];
  }

  function splitRecording(line) {
    const wide = line.search(WIDE_DASH);
    const hyphen = line.match(SPACED_HYPHEN);
    const hyphenAt = hyphen ? hyphen.index : -1;
    let at = -1;
    let width = 0;
    if (wide >= 0 && (hyphenAt < 0 || wide <= hyphenAt)) { at = wide; width = 1; }
    else if (hyphenAt >= 0) { at = hyphenAt; width = hyphen[0].length; }
    if (at < 0) return null;
    const artist = clean(line.slice(0, at));
    const title = clean(line.slice(at + width));
    if (!artist || !title) return null;
    if (artist.length > MAX_SIDE || title.length > MAX_SIDE) return null;
    if (isUrlLike(artist) || isUrlLike(title)) return null;
    return { artist, title };
  }

  function parseLines(text) {
    const out = [];
    for (const raw of String(text ?? '').split(/\r?\n/)) {
      const line = clean(raw);
      if (!line || line.length > MAX_LINE || isUrlLike(line)) continue;
      const recording = splitRecording(stripChatPrefix(line));
      if (recording) out.push({ ...recording, line });
    }
    return out;
  }

  const countLines = (text) => String(text ?? '').split(/\r?\n/).filter((line) => clean(line)).length;

  const identityKey = (entry) => (typeof window.ampMusicRecordingId === 'function'
    ? window.ampMusicRecordingId(entry.title, entry.artist)
    : `${entry.title}\u0000${entry.artist}`.toLowerCase());

  function distinct(entries) {
    const seen = new Set();
    const out = [];
    for (const entry of entries) {
      const key = identityKey(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(entry);
    }
    return out;
  }

  function report(state, options) {
    setStatus(state.message);
    try { options?.onStatus?.(state); } catch {}
    return state;
  }

  function importText(text, options = {}) {
    const lines = countLines(text);
    const recognised = distinct(parseLines(text));
    const entries = recognised.slice(0, MAX_TRACKS);
    const skipped = recognised.length - entries.length;
    if (!entries.length) {
      return report({
        handled: true,
        lines,
        tracks: 0,
        added: 0,
        existing: 0,
        skipped: 0,
        message: lines ? `${lines} lines · no Artist — Title lines found` : 'Paste lines like Artist — Title',
      }, options);
    }
    if (typeof window.importTracks !== 'function') {
      return report({
        handled: false,
        lines,
        tracks: entries.length,
        added: 0,
        existing: 0,
        skipped,
        message: 'Player is still starting — tap Import again',
      }, options);
    }
    const importedAt = new Date().toISOString();
    const items = entries.map((entry) => ({
      title: entry.title,
      artist: entry.artist,
      badges: ['Telegram', 'Text import'],
      importedAt,
      sourceLine: entry.line,
    }));
    const result = window.importTracks(items) || {};
    const added = Math.max(0, Number(result.added) || 0);
    const existing = Math.max(0, entries.length - added);
    return report({
      handled: true,
      lines,
      tracks: entries.length,
      added,
      existing,
      skipped,
      items,
      message: `${lines} lines · ${entries.length} tracks · ${added} new`
        + (existing ? ` · ${existing} already saved` : '')
        + (skipped ? ` · ${skipped} over the ${MAX_TRACKS} track limit` : ''),
    }, options);
  }

  function openPanel(text) {
    if (!panel) return false;
    panel.hidden = false;
    toggle?.setAttribute('aria-expanded', 'true');
    const incoming = String(text ?? '').replace(/\s+$/, '');
    if (area && incoming.trim()) {
      const current = area.value.replace(/\s+$/, '');
      area.value = current ? `${current}\n${incoming}` : incoming;
    }
    try { area?.focus(); } catch {}
    return true;
  }

  function closePanel() {
    if (!panel) return false;
    panel.hidden = true;
    toggle?.setAttribute('aria-expanded', 'false');
    return true;
  }

  const togglePanel = (text) => (panel && !panel.hidden ? closePanel() : openPanel(text));

  runButton?.addEventListener('click', () => {
    const result = importText(area?.value);
    if (result.added && area) area.value = '';
  });

  area?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); closePanel(); toggle?.focus(); }
  });

  window.ampMusicTelegramText1 = { parseLines, importText, openPanel, closePanel, togglePanel };
  console.info('[ÁmpulaMP] Telegram text import 1 ready');
})();
