(() => {
  if (window.__WINAMP_MUSIC_ACTIVITY_TICKER_V1__) return;
  window.__WINAMP_MUSIC_ACTIVITY_TICKER_V1__ = true;

  const status = document.getElementById('status');
  const screen = document.querySelector('.screen');
  if (!status || !screen) return;

  let lastRepairProgress = '';
  let explicitUntil = 0;
  let importTracksWrapped = false;

  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const trackLabel = (track) => {
    const artist = clean(track?.artist);
    const title = clean(track?.title);
    if (artist && title) return `${artist} — ${title}`;
    return title || artist || clean(track?.id) || 'track';
  };

  const ticker = document.createElement('div');
  ticker.id = 'winampActivityTicker';
  ticker.className = 'winamp-activity-ticker';
  ticker.setAttribute('role', 'status');
  ticker.setAttribute('aria-live', 'polite');
  ticker.innerHTML = '<div class="winamp-activity-window"><span id="winampActivityTickerTrack">READY</span></div>';
  status.insertAdjacentElement('afterend', ticker);
  status.hidden = true;

  const track = ticker.querySelector('#winampActivityTickerTrack');

  function render(text, { holdMs = 0 } = {}) {
    const message = clean(text) || 'READY';
    track.textContent = `${message}   •   ${message}`;
    track.dataset.message = message;
    track.classList.remove('is-static');
    void track.offsetWidth;
    if (holdMs > 0) explicitUntil = Date.now() + holdMs;
  }

  function statusMessage(value) {
    const text = clean(value);
    const fixing = text.match(/^FIXING NAMES\s+(\d+)\/(\d+)/i);
    if (fixing) {
      lastRepairProgress = `${fixing[1]}/${fixing[2]}`;
      return `LIBRARY SCAN ${lastRepairProgress} · checking track names`;
    }
    if (/^NAMES FIXED\s+/i.test(text)) return text.replace(/^NAMES FIXED/i, 'LIBRARY READY · fixed');
    return text;
  }

  function mirrorLegacyStatus() {
    if (Date.now() < explicitUntil) return;
    render(statusMessage(status.textContent));
  }

  new MutationObserver(mirrorLegacyStatus).observe(status, { childList: true, characterData: true, subtree: true });

  function observeSearchStatus() {
    const searchStatus = document.getElementById('songSearchStatus');
    if (!searchStatus || searchStatus.dataset.tickerObserved === '1') return;
    searchStatus.dataset.tickerObserved = '1';
    const sync = () => {
      const text = clean(searchStatus.textContent);
      if (!text || Date.now() < explicitUntil) return;
      if (/type artist|search youtube|paste a music link/i.test(text)) return;
      render(text);
    };
    new MutationObserver(sync).observe(searchStatus, { childList: true, characterData: true, subtree: true });
  }

  function wrapImportTracks() {
    if (importTracksWrapped || typeof window.importTracks !== 'function') return false;
    const original = window.importTracks;
    window.importTracks = function wrappedImportTracks(items, ...rest) {
      const list = Array.isArray(items) ? items : [];
      const first = list[0];
      if (first) {
        const count = list.length;
        const prefix = lastRepairProgress
          ? `LIBRARY SCAN ${lastRepairProgress}`
          : count > 1 ? `IMPORT ${count} TRACKS` : 'IMPORT NEXT';
        render(`${prefix} · ${trackLabel(first)}`, { holdMs: 1200 });
      }
      return original.call(this, items, ...rest);
    };
    importTracksWrapped = true;
    return true;
  }

  window.winampMusicActivity = {
    show(text, options = {}) {
      render(text, { holdMs: options.holdMs ?? 1800 });
    },
    importing(source, metadata = {}, options = {}) {
      const label = trackLabel(metadata);
      render(`${clean(source) || 'IMPORT'} → YouTube · ${label}`, { holdMs: options.holdMs ?? 2200 });
    },
    progress(current, total, metadata = {}) {
      lastRepairProgress = `${current}/${total}`;
      render(`LIBRARY SCAN ${lastRepairProgress} · ${trackLabel(metadata)}`, { holdMs: 900 });
    },
  };

  const style = document.createElement('style');
  style.id = 'winampActivityTickerStyle';
  style.textContent = `
    .winamp-activity-ticker{margin:0 0 8px;color:#9df582;font:700 11px/1.25 SFMono-Regular,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;overflow:hidden}
    .winamp-activity-window{overflow:hidden;white-space:nowrap;mask-image:linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent);-webkit-mask-image:linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent)}
    #winampActivityTickerTrack{display:inline-block;min-width:max-content;padding-left:100%;animation:winampTicker 14s linear infinite;will-change:transform}
    @keyframes winampTicker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
    @media(prefers-reduced-motion:reduce){#winampActivityTickerTrack{padding-left:0;animation:none;max-width:100%;overflow:hidden;text-overflow:ellipsis}}
  `;
  document.head.appendChild(style);

  mirrorLegacyStatus();
  const timer = setInterval(() => {
    observeSearchStatus();
    if (wrapImportTracks()) clearInterval(timer);
  }, 80);
  setTimeout(() => clearInterval(timer), 12000);
})();
