(() => {
  'use strict';
  if (window.__AMPULA_DIAGNOSTICS_DOWNLOAD_171__) return;
  window.__AMPULA_DIAGNOSTICS_DOWNLOAD_171__ = true;

  const VERSION = '1.7.1';
  let decorateQueued = false;

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function filenameFor(payload, index) {
    const stamp = clean(payload?.capturedAt || new Date().toISOString())
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z')
      .replace('T', '-');
    return `ampula-diagnostics-${stamp}-track-${String(Number(index) + 1).padStart(2, '0')}.json`;
  }

  function payloadFor(index) {
    try {
      return window.ampulaTrackDiagnostics164?.payloadForIndex?.(Number(index)) || null;
    } catch {
      return null;
    }
  }

  function downloadPayload(index) {
    const payload = payloadFor(index);
    if (!payload) return false;
    const json = `${JSON.stringify(payload, null, 2)}\n`;
    try {
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filenameFor(payload, index);
      anchor.hidden = true;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch (error) {
      console.warn('[ÁmpulaMP] diagnostics download failed', error);
      return false;
    }
  }

  function decorate() {
    decorateQueued = false;
    for (const row of document.querySelectorAll('#trackList .track[data-index]')) {
      const menu = row.querySelector('.track-more-menu');
      if (!menu || menu.querySelector('[data-download-diagnostics="1"]')) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.downloadDiagnostics = '1';
      button.innerHTML = 'Download diagnostics<small>JSON file</small>';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const ok = downloadPayload(Number(row.dataset.index));
        if (button.firstChild) button.firstChild.textContent = ok ? 'Downloaded diagnostics' : 'Download failed';
        setTimeout(() => {
          if (button.firstChild) button.firstChild.textContent = 'Download diagnostics';
        }, 1400);
      });
      menu.appendChild(button);
    }
  }

  function queueDecorate() {
    if (decorateQueued) return;
    decorateQueued = true;
    queueMicrotask(decorate);
  }

  const list = document.getElementById('trackList');
  const observer = list ? new MutationObserver(queueDecorate) : null;
  observer?.observe(list, { childList: true, subtree: true });
  window.addEventListener('pageshow', queueDecorate);
  for (const delay of [0, 60, 250, 900, 2200]) setTimeout(queueDecorate, delay);

  window.ampulaDiagnosticsDownload171 = {
    version: VERSION,
    decorate,
    downloadPayload,
    filenameFor,
    stop() {
      observer?.disconnect();
      window.removeEventListener('pageshow', queueDecorate);
    },
  };
})();