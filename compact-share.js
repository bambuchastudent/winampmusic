(() => {
  'use strict';

  const STORAGE_KEY = 'winampmusic.library.v1';
  const CURRENT_KEY = 'winampmusic.fast.current.v1';
  const PLAYER_STATE_KEY = 'winampmusic.player.v1';
  const SAVED_AMPULAS_KEY = 'winampmusic.ampulas.v1';
  const AMPULA_PARAM = 'a';
  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const STATUS = document.getElementById('status');
  const SEARCH_INSTANCES = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://yt.chocolatemoo53.com',
  ];
  const resolvedIds = new Map();
  let receivedAmpula = null;
  let lastSharedAmpula = null;

  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const setStatus = (text) => { if (STATUS) STATUS.textContent = text; };

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function readLibrary() {
    const value = readJson(STORAGE_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function parseDurationMs(track) {
    const direct = Number(track?.durationMs);
    if (Number.isFinite(direct) && direct >= 0) return Math.round(direct);
    const raw = track?.duration;
    if (Number.isFinite(Number(raw)) && Number(raw) > 0) {
      const n = Number(raw);
      return Math.round(n > 10000 ? n : n * 1000);
    }
    const text = clean(raw);
    if (!/^\d{1,2}:\d{2}(?::\d{2})?$/.test(text)) return 0;
    const parts = text.split(':').map(Number);
    const seconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
    return seconds * 1000;
  }

  function youtubeIdFromUrl(raw) {
    try {
      const url = new URL(String(raw || ''));
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'youtu.be') {
        const id = url.pathname.split('/').filter(Boolean)[0] || '';
        return VIDEO_ID_RE.test(id) ? id : '';
      }
      if (!['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) return '';
      const query = clean(url.searchParams.get('v'));
      if (VIDEO_ID_RE.test(query)) return query;
      const parts = url.pathname.split('/').filter(Boolean);
      const id = ['shorts', 'embed', 'live'].includes(parts[0]) ? (parts[1] || '') : '';
      return VIDEO_ID_RE.test(id) ? id : '';
    } catch {
      return '';
    }
  }

  function observationFromUrl(raw, observedAt) {
    const text = clean(raw);
    if (!text) return null;
    try {
      const url = new URL(text);
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      const youtubeId = youtubeIdFromUrl(text);
      if (youtubeId) return { service: 'youtube', itemId: youtubeId, observedAt };
      if (host === 'music.apple.com') {
        const itemId = clean(url.searchParams.get('i')) || clean(url.pathname.split('/').filter(Boolean).at(-1));
        return { service: 'apple-music', ...(itemId ? { itemId } : {}), url: text, observedAt };
      }
      if (host.endsWith('spotify.com')) {
        const itemId = clean(url.pathname.split('/').filter(Boolean).at(-1));
        return { service: 'spotify', ...(itemId ? { itemId } : {}), url: text, observedAt };
      }
      return { service: host || 'web', url: text, observedAt };
    } catch {
      return null;
    }
  }

  function trackObservations(track, observedAt) {
    const out = [];
    const seen = new Set();
    const push = (value) => {
      if (!value) return;
      const key = `${value.service}|${value.itemId || ''}|${value.url || ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(value);
    };

    const id = clean(track?.id || track?.videoId || track?.youtubeId);
    if (VIDEO_ID_RE.test(id)) push({ service: 'youtube', itemId: id, observedAt });
    for (const value of [track?.sourceUrl, track?.appleTrackUrl, track?.url, track?.originUrl]) {
      push(observationFromUrl(value, observedAt));
    }
    return out;
  }

  function currentStartIndex(tracks) {
    const numeric = Number(localStorage.getItem(CURRENT_KEY));
    if (Number.isInteger(numeric) && numeric >= 0 && numeric < tracks.length) return numeric;
    const currentId = clean(readJson(PLAYER_STATE_KEY, {}).currentId);
    if (currentId) {
      const index = tracks.findIndex((track) => clean(track?.id) === currentId);
      if (index >= 0) return index;
    }
    return 0;
  }

  function toAmpula(tracks = readLibrary()) {
    const capturedAt = new Date().toISOString();
    const source = Array.isArray(tracks) ? tracks : [];
    const ampulaTracks = source.map((track) => {
      const title = clean(track?.title) || 'Unknown track';
      const artist = clean(track?.artist) || 'Unknown artist';
      const durationMs = parseDurationMs(track);
      const observations = trackObservations(track, capturedAt);
      const result = {
        title,
        artists: [artist],
      };
      if (clean(track?.album)) result.album = clean(track.album);
      if (clean(track?.versionLabel)) result.versionLabel = clean(track.versionLabel);
      if (durationMs) result.durationMs = durationMs;
      if (clean(track?.isrc)) result.isrc = clean(track.isrc);
      if (clean(track?.musicBrainzRecordingId)) result.musicBrainzRecordingId = clean(track.musicBrainzRecordingId);
      if (observations.length) result.observations = observations;
      return result;
    });
    return {
      format: 'ampula',
      version: '1',
      capturedAt,
      startTrack: currentStartIndex(source),
      tracks: ampulaTracks,
    };
  }

  function validateAmpula(value) {
    if (!value || typeof value !== 'object') throw new Error('Invalid Ámpula');
    if (value.format !== 'ampula' || value.version !== '1') throw new Error('Unsupported Ámpula version');
    if (!Array.isArray(value.tracks) || !value.tracks.length) throw new Error('Ámpula has no tracks');
    value.tracks.forEach((track, index) => {
      if (!clean(track?.title) || !Array.isArray(track?.artists) || !track.artists.some((artist) => clean(artist))) {
        throw new Error(`Invalid Ámpula track ${index + 1}`);
      }
    });
    return value;
  }

  function compactObservation(obs, capturedAt) {
    return [
      clean(obs?.service),
      clean(obs?.itemId),
      clean(obs?.url),
      clean(obs?.representation),
      clean(obs?.observedAt) === clean(capturedAt) ? '' : clean(obs?.observedAt),
    ];
  }

  function compactTrack(track, capturedAt) {
    return [
      clean(track?.title),
      Array.isArray(track?.artists) ? track.artists.map(clean).filter(Boolean) : [],
      clean(track?.album),
      clean(track?.versionLabel),
      Number(track?.durationMs) || 0,
      clean(track?.isrc),
      clean(track?.musicBrainzRecordingId),
      Array.isArray(track?.observations) ? track.observations.map((obs) => compactObservation(obs, capturedAt)) : [],
    ];
  }

  function compactAmpula(ampula) {
    const value = validateAmpula(ampula);
    const payload = {
      v: 1,
      c: clean(value.capturedAt),
      s: Number.isInteger(value.startTrack) ? value.startTrack : 0,
      t: value.tracks.map((track) => compactTrack(track, value.capturedAt)),
    };
    if (value.moment?.title || value.moment?.note) payload.m = [clean(value.moment?.title), clean(value.moment?.note)];
    return payload;
  }

  function expandObservation(raw, capturedAt) {
    const [service, itemId, url, representation, observedAt] = Array.isArray(raw) ? raw : [];
    const result = { service: clean(service), observedAt: clean(observedAt) || capturedAt };
    if (clean(itemId)) result.itemId = clean(itemId);
    if (clean(url)) result.url = clean(url);
    if (clean(representation)) result.representation = clean(representation);
    return result;
  }

  function expandCompact(payload) {
    if (!payload || payload.v !== 1 || !Array.isArray(payload.t) || !payload.t.length) throw new Error('Invalid Ámpula transport');
    const capturedAt = clean(payload.c) || undefined;
    const tracks = payload.t.map((raw) => {
      const [title, artists, album, versionLabel, durationMs, isrc, musicBrainzRecordingId, observations] = Array.isArray(raw) ? raw : [];
      const track = { title: clean(title), artists: Array.isArray(artists) ? artists.map(clean).filter(Boolean) : [] };
      if (clean(album)) track.album = clean(album);
      if (clean(versionLabel)) track.versionLabel = clean(versionLabel);
      if (Number(durationMs) > 0) track.durationMs = Number(durationMs);
      if (clean(isrc)) track.isrc = clean(isrc);
      if (clean(musicBrainzRecordingId)) track.musicBrainzRecordingId = clean(musicBrainzRecordingId);
      if (Array.isArray(observations) && observations.length) track.observations = observations.map((obs) => expandObservation(obs, capturedAt));
      return track;
    });
    const ampula = {
      format: 'ampula',
      version: '1',
      ...(capturedAt ? { capturedAt } : {}),
      startTrack: Number.isInteger(payload.s) ? payload.s : 0,
      tracks,
    };
    if (Array.isArray(payload.m) && (clean(payload.m[0]) || clean(payload.m[1]))) {
      ampula.moment = {};
      if (clean(payload.m[0])) ampula.moment.title = clean(payload.m[0]);
      if (clean(payload.m[1])) ampula.moment.note = clean(payload.m[1]);
    }
    return validateAmpula(ampula);
  }

  function bytesToBase64Url(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function base64UrlToBytes(value) {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  }

  async function gzip(bytes) {
    if (!window.CompressionStream) return null;
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function gunzip(bytes) {
    if (!window.DecompressionStream) throw new Error('This browser cannot open compressed Ámpula links');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function encodeAmpula(ampula) {
    const bytes = new TextEncoder().encode(JSON.stringify(compactAmpula(ampula)));
    try {
      const compressed = await gzip(bytes);
      if (compressed && compressed.length + 8 < bytes.length) return `g.${bytesToBase64Url(compressed)}`;
    } catch {}
    return `j.${bytesToBase64Url(bytes)}`;
  }

  async function decodeAmpula(value) {
    const text = String(value || '');
    const dot = text.indexOf('.');
    if (dot < 1) throw new Error('Invalid Ámpula link');
    const mode = text.slice(0, dot);
    let bytes = base64UrlToBytes(text.slice(dot + 1));
    if (mode === 'g') bytes = await gunzip(bytes);
    else if (mode !== 'j') throw new Error('Unknown Ámpula transport');
    return expandCompact(JSON.parse(new TextDecoder().decode(bytes)));
  }

  function appUrl() {
    const url = new URL(location.href);
    for (const key of [AMPULA_PARAM, 'al', 'p', 's', 'playlist']) url.searchParams.delete(key);
    url.hash = '';
    return url;
  }

  async function buildShareUrl(ampula) {
    const url = appUrl();
    url.searchParams.set(AMPULA_PARAM, await encodeAmpula(ampula));
    return url.toString();
  }

  function youtubeObservation(track) {
    return (Array.isArray(track?.observations) ? track.observations : []).find((obs) => obs?.service === 'youtube' && VIDEO_ID_RE.test(clean(obs?.itemId))) || null;
  }

  async function findYouTube(track, index) {
    if (resolvedIds.has(index)) return resolvedIds.get(index);
    const observed = youtubeObservation(track);
    if (observed) {
      resolvedIds.set(index, clean(observed.itemId));
      return clean(observed.itemId);
    }
    const query = clean(`${track?.title || ''} ${(track?.artists || []).join(' ')}`);
    if (query.length < 2) return '';
    for (const base of SEARCH_INSTANCES) {
      try {
        const url = new URL('/api/v1/search', base);
        url.searchParams.set('q', query);
        url.searchParams.set('type', 'video');
        url.searchParams.set('sort', 'relevance');
        const response = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
        if (!response.ok) continue;
        const payload = await response.json();
        const candidate = Array.isArray(payload) ? payload.find((item) => item?.type === 'video' && VIDEO_ID_RE.test(clean(item.videoId))) : null;
        if (candidate) {
          const id = clean(candidate.videoId);
          resolvedIds.set(index, id);
          return id;
        }
      } catch {}
    }
    return '';
  }

  function hashText(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function saveAmpula(ampula) {
    const canonical = validateAmpula(ampula);
    const source = JSON.stringify(canonical);
    const id = `a_${hashText(source)}`;
    const saved = readJson(SAVED_AMPULAS_KEY, []);
    const list = Array.isArray(saved) ? saved.filter((item) => item?.id !== id) : [];
    list.unshift({ id, savedAt: new Date().toISOString(), ampula: canonical });
    localStorage.setItem(SAVED_AMPULAS_KEY, JSON.stringify(list.slice(0, 100)));
    return id;
  }

  function savedAmpulas() {
    const value = readJson(SAVED_AMPULAS_KEY, []);
    return Array.isArray(value) ? value.filter((item) => item?.ampula) : [];
  }

  function runtimeTrack(track, index) {
    const id = resolvedIds.get(index) || clean(youtubeObservation(track)?.itemId);
    if (!VIDEO_ID_RE.test(id)) return null;
    const source = (Array.isArray(track?.observations) ? track.observations : []).find((obs) => clean(obs?.url));
    return {
      id,
      title: clean(track.title),
      artist: Array.isArray(track.artists) ? track.artists.map(clean).filter(Boolean).join(', ') : '',
      ...(source?.url ? { sourceUrl: clean(source.url) } : {}),
      ...(Number(track.durationMs) > 0 ? { durationMs: Number(track.durationMs) } : {}),
    };
  }

  function downloadAmpula(ampula) {
    const blob = new Blob([`${JSON.stringify(validateAmpula(ampula), null, 2)}\n`], { type: 'application/vnd.ampula+json;charset=utf-8' });
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    link.href = URL.createObjectURL(blob);
    link.download = `ampula-${stamp}.ampula`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function ensureShareDialog() {
    let dialog = document.getElementById('winampShareDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'winampShareDialog';
    dialog.style.cssText = 'width:min(calc(100% - 24px),680px);border:1px solid #343a46;border-radius:14px;color:#fff;background:#15181e;padding:0;box-shadow:0 30px 100px rgba(0,0,0,.7);';
    dialog.innerHTML = `
      <div style="padding:16px;display:grid;gap:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
          <div><div style="font-size:10px;letter-spacing:.16em;color:#8f98a8;font-weight:800">ÁMPULA</div><strong id="winampShareHeading">Portable link ready</strong></div>
          <button id="winampShareClose" type="button" aria-label="Close" style="border:0;background:transparent;color:#8f98a8;font-size:18px">✕</button>
        </div>
        <p id="winampShareNote" style="margin:0;color:#b4bbc7;font-size:12px;line-height:1.4"></p>
        <input id="winampShareUrl" readonly style="width:100%;min-height:42px;border:1px solid #343a46;border-radius:8px;background:#0c0e12;color:#b7f29e;padding:0 10px;font:11px SFMono-Regular,Consolas,monospace" />
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button id="winampShareCopy" type="button" style="min-height:40px;padding:0 14px;border:1px solid #4a515e;border-radius:8px;background:#2a3039;color:#fff;font-weight:800">Copy link</button>
          <button id="winampShareSystem" type="button" style="min-height:40px;padding:0 14px;border:1px solid #8f7724;border-radius:8px;background:#d8b63f;color:#171717;font-weight:800">Share…</button>
          <button id="winampShareFile" type="button" style="min-height:40px;padding:0 14px;border:1px solid #4a515e;border-radius:8px;background:#242a32;color:#fff;font-weight:800">.ampula file</button>
          <button id="winampShareSaved" type="button" style="min-height:40px;padding:0 14px;border:1px solid #4a515e;border-radius:8px;background:#242a32;color:#fff;font-weight:800">Saved Ámpulas</button>
        </div>
      </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector('#winampShareClose').addEventListener('click', () => dialog.close());
    dialog.querySelector('#winampShareCopy').addEventListener('click', async () => {
      const input = dialog.querySelector('#winampShareUrl');
      try {
        await navigator.clipboard.writeText(input.value);
        setStatus('ÁMPULA LINK COPIED');
      } catch {
        input.focus(); input.select(); document.execCommand?.('copy'); setStatus('ÁMPULA LINK READY');
      }
    });
    dialog.querySelector('#winampShareSystem').addEventListener('click', async () => {
      const input = dialog.querySelector('#winampShareUrl');
      if (!navigator.share) return;
      try {
        await navigator.share({ title: 'Ámpula', text: 'Listen to my Ámpula', url: input.value });
        setStatus('ÁMPULA SHARED');
      } catch {}
    });
    dialog.querySelector('#winampShareFile').addEventListener('click', () => {
      if (lastSharedAmpula) downloadAmpula(lastSharedAmpula);
    });
    dialog.querySelector('#winampShareSaved').addEventListener('click', () => showSaved());
    return dialog;
  }

  function ensureReceivedDialog() {
    let dialog = document.getElementById('ampulaReceivedDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'ampulaReceivedDialog';
    dialog.style.cssText = 'width:min(calc(100% - 20px),760px);max-height:88vh;border:1px solid #343a46;border-radius:14px;color:#fff;background:#15181e;padding:0;box-shadow:0 30px 100px rgba(0,0,0,.7);';
    dialog.innerHTML = `
      <div style="padding:16px;display:grid;gap:12px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div><div style="font-size:10px;letter-spacing:.16em;color:#8f98a8;font-weight:800">RECEIVED ÁMPULA</div><strong id="ampulaReceivedTitle">Musical moment</strong><div id="ampulaReceivedMeta" style="margin-top:3px;color:#8f98a8;font-size:11px"></div></div>
          <button id="ampulaReceivedClose" type="button" aria-label="Close" style="border:0;background:transparent;color:#8f98a8;font-size:18px">✕</button>
        </div>
        <div id="ampulaReceivedPlayer" style="display:none;aspect-ratio:16/9;background:#090b0e;border-radius:10px;overflow:hidden"></div>
        <ol id="ampulaReceivedList" style="margin:0;padding:0;list-style:none;display:grid;gap:5px;max-height:46vh;overflow:auto"></ol>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button id="ampulaSave" type="button" style="min-height:40px;padding:0 14px;border:1px solid #8f7724;border-radius:8px;background:#d8b63f;color:#171717;font-weight:800">Save Ámpula</button>
          <button id="ampulaAdd" type="button" style="min-height:40px;padding:0 14px;border:1px solid #4a515e;border-radius:8px;background:#242a32;color:#fff;font-weight:800">Add playable tracks</button>
          <button id="ampulaFile" type="button" style="min-height:40px;padding:0 14px;border:1px solid #4a515e;border-radius:8px;background:#242a32;color:#fff;font-weight:800">.ampula file</button>
        </div>
        <div style="color:#8f98a8;font-size:11px;line-height:1.4">Opening this Ámpula does not change Your library. Playback matches are local and do not rewrite the received object.</div>
      </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector('#ampulaReceivedClose').addEventListener('click', () => dialog.close());
    dialog.querySelector('#ampulaSave').addEventListener('click', () => {
      if (!receivedAmpula) return;
      saveAmpula(receivedAmpula);
      dialog.querySelector('#ampulaSave').textContent = 'Saved ✓';
      setStatus('ÁMPULA SAVED LOCALLY');
    });
    dialog.querySelector('#ampulaFile').addEventListener('click', () => { if (receivedAmpula) downloadAmpula(receivedAmpula); });
    dialog.querySelector('#ampulaAdd').addEventListener('click', () => {
      if (!receivedAmpula || typeof window.importTracks !== 'function') return;
      const candidates = receivedAmpula.tracks.map(runtimeTrack).filter(Boolean);
      const result = window.importTracks(candidates);
      setStatus(`ADDED ${result?.added ?? 0} PLAYABLE TRACKS · ÁMPULA KEPT SEPARATE`);
    });
    return dialog;
  }

  async function playReceivedTrack(index) {
    if (!receivedAmpula?.tracks?.[index]) return;
    const track = receivedAmpula.tracks[index];
    setStatus(`RESOLVING ${clean(track.title).toUpperCase()}`);
    const id = await findYouTube(track, index);
    if (!id) {
      setStatus('NO PLAYABLE SOURCE RESOLVED');
      return;
    }
    const dialog = ensureReceivedDialog();
    const host = dialog.querySelector('#ampulaReceivedPlayer');
    host.style.display = '';
    host.replaceChildren();
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&playsinline=1&rel=0`;
    iframe.title = `${clean(track.title)} — ${(track.artists || []).join(', ')}`;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.style.cssText = 'width:100%;height:100%;border:0';
    host.appendChild(iframe);
    setStatus('PLAYING RECEIVED ÁMPULA');
  }

  function renderReceived(ampula) {
    receivedAmpula = validateAmpula(ampula);
    resolvedIds.clear();
    const dialog = ensureReceivedDialog();
    dialog.querySelector('#ampulaReceivedTitle').textContent = receivedAmpula.moment?.title || 'Musical moment';
    dialog.querySelector('#ampulaReceivedMeta').textContent = `${receivedAmpula.tracks.length} tracks${receivedAmpula.capturedAt ? ` · ${new Date(receivedAmpula.capturedAt).toLocaleString()}` : ''}`;
    dialog.querySelector('#ampulaSave').textContent = 'Save Ámpula';
    dialog.querySelector('#ampulaReceivedPlayer').replaceChildren();
    dialog.querySelector('#ampulaReceivedPlayer').style.display = 'none';
    const list = dialog.querySelector('#ampulaReceivedList');
    list.replaceChildren();
    receivedAmpula.tracks.forEach((track, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.style.cssText = 'width:100%;display:grid;grid-template-columns:34px minmax(0,1fr);gap:8px;align-items:center;text-align:left;border:1px solid #303640;border-radius:8px;background:#20242b;color:#fff;padding:8px;cursor:pointer';
      const number = document.createElement('span');
      number.textContent = String(index + 1).padStart(2, '0');
      number.style.cssText = 'color:#8f98a8;font:11px monospace';
      const text = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = clean(track.title);
      title.style.display = 'block';
      const artist = document.createElement('span');
      artist.textContent = (track.artists || []).map(clean).filter(Boolean).join(', ');
      artist.style.cssText = 'display:block;color:#9ca5b4;font-size:11px;margin-top:2px';
      text.append(title, artist);
      button.append(number, text);
      button.addEventListener('click', () => void playReceivedTrack(index));
      item.appendChild(button);
      list.appendChild(item);
    });
    if (!dialog.open) dialog.showModal();
    setStatus(`RECEIVED ÁMPULA · ${receivedAmpula.tracks.length} TRACKS`);
    return dialog;
  }

  function ensureSavedDialog() {
    let dialog = document.getElementById('ampulaSavedDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'ampulaSavedDialog';
    dialog.style.cssText = 'width:min(calc(100% - 24px),620px);max-height:80vh;border:1px solid #343a46;border-radius:14px;color:#fff;background:#15181e;padding:0;box-shadow:0 30px 100px rgba(0,0,0,.7);';
    dialog.innerHTML = `<div style="padding:16px;display:grid;gap:12px"><div style="display:flex;justify-content:space-between;gap:12px"><div><div style="font-size:10px;letter-spacing:.16em;color:#8f98a8;font-weight:800">SAVED</div><strong>Ámpulas on this device</strong></div><button id="ampulaSavedClose" type="button" style="border:0;background:transparent;color:#8f98a8;font-size:18px">✕</button></div><div id="ampulaSavedList" style="display:grid;gap:6px;overflow:auto"></div></div>`;
    document.body.appendChild(dialog);
    dialog.querySelector('#ampulaSavedClose').addEventListener('click', () => dialog.close());
    return dialog;
  }

  function showSaved() {
    const entries = savedAmpulas();
    const dialog = ensureSavedDialog();
    const list = dialog.querySelector('#ampulaSavedList');
    list.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement('div'); empty.textContent = 'No saved Ámpulas yet.'; empty.style.color = '#8f98a8'; list.appendChild(empty);
    } else {
      entries.forEach((entry) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.style.cssText = 'text-align:left;border:1px solid #343a46;border-radius:8px;background:#20242b;color:#fff;padding:10px;cursor:pointer';
        const title = entry.ampula?.moment?.title || `${entry.ampula?.tracks?.length || 0}-track Ámpula`;
        button.textContent = `${title} · ${entry.savedAt ? new Date(entry.savedAt).toLocaleString() : ''}`;
        button.addEventListener('click', () => { dialog.close(); renderReceived(entry.ampula); });
        list.appendChild(button);
      });
    }
    if (!dialog.open) dialog.showModal();
  }

  async function shareAmpula() {
    const tracks = readLibrary();
    if (!tracks.length) {
      setStatus('NO TRACKS TO SHARE');
      return null;
    }
    const ampula = toAmpula(tracks);
    const url = await buildShareUrl(ampula);
    lastSharedAmpula = ampula;
    const dialog = ensureShareDialog();
    dialog.dataset.count = String(ampula.tracks.length);
    dialog.querySelector('#winampShareUrl').value = url;
    dialog.querySelector('#winampShareSystem').hidden = !navigator.share;
    dialog.querySelector('#winampShareSaved').hidden = savedAmpulas().length === 0;
    dialog.querySelector('#winampShareNote').textContent = `Self-contained · ${ampula.tracks.length} tracks · no Ámpula server required · ${(url.length / 1024).toFixed(1)} KB link`;
    if (!dialog.open) dialog.showModal();
    setStatus('ÁMPULA LINK READY');
    return url;
  }

  async function loadFromLocation() {
    const params = new URLSearchParams(location.search);
    const payload = params.get(AMPULA_PARAM);
    if (payload) {
      setStatus('OPENING ÁMPULA');
      try {
        renderReceived(await decodeAmpula(payload));
      } catch (error) {
        console.warn('[AMPULAMP Ámpula]', error);
        setStatus('INVALID OR UNSUPPORTED ÁMPULA');
      }
      return true;
    }
    if (params.has('p') || params.has('s')) {
      setStatus('OLD PLAYLIST SHARE LINK UNSUPPORTED');
      return true;
    }
    return false;
  }

  window.winampMusicCompactShare = {
    share: shareAmpula,
    load: loadFromLocation,
    toAmpula,
    encode: encodeAmpula,
    decode: decodeAmpula,
    save: saveAmpula,
    showSaved,
    download: downloadAmpula,
  };
  window.sharePlaylist = shareAmpula;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void loadFromLocation(), { once: true });
  } else {
    void loadFromLocation();
  }
})();
