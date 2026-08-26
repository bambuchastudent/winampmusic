(() => {
  if (window.__WINAMP_MUSIC_QR_SHARE_V1__) return;
  window.__WINAMP_MUSIC_QR_SHARE_V1__ = true;

  const STATUS = document.getElementById('status');
  const QR_SCRIPT = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
  let libraryPromise = null;

  function ensureStyles() {
    if (document.getElementById('winampPlaylistQrStyles')) return;
    const style = document.createElement('style');
    style.id = 'winampPlaylistQrStyles';
    style.textContent = `
      .winamp-playlist-qr{display:grid;justify-items:center;gap:9px;padding:12px;border:1px solid #4b535f;border-radius:10px;background:#0c0e12}
      .winamp-playlist-qr[hidden]{display:none}
      .winamp-playlist-qr-title{width:100%;display:flex;align-items:baseline;justify-content:space-between;gap:12px}
      .winamp-playlist-qr-title strong{font-size:15px}.winamp-playlist-qr-title span{font-size:10px;color:#f7d95d;text-transform:uppercase;letter-spacing:.12em}
      .winamp-playlist-qr-code{display:grid;place-items:center;min-width:268px;min-height:268px;padding:14px;border-radius:10px;background:#fff}
      .winamp-playlist-qr-code canvas,.winamp-playlist-qr-code img{display:block!important;max-width:240px!important;width:240px!important;height:240px!important;image-rendering:pixelated}
      .winamp-playlist-qr-note{margin:0;color:#aab2bf;font-size:11px;line-height:1.45;text-align:center;max-width:380px}
      .winamp-playlist-qr-error{color:#8b1f2d;font-size:12px;font-weight:800;line-height:1.4;text-align:center;max-width:320px;padding:18px}
      @media(max-width:420px){.winamp-playlist-qr-code{min-width:238px;min-height:238px;padding:10px}.winamp-playlist-qr-code canvas,.winamp-playlist-qr-code img{max-width:218px!important;width:218px!important;height:218px!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureLibrary() {
    if (window.QRCode) return Promise.resolve(window.QRCode);
    if (libraryPromise) return libraryPromise;
    libraryPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-winamp-qrcode-library]');
      const script = existing || document.createElement('script');
      let settled = false;
      const finish = (fn, value) => { if (settled) return; settled = true; clearTimeout(timeout); fn(value); };
      const done = () => window.QRCode ? finish(resolve, window.QRCode) : finish(reject, new Error('QR library unavailable'));
      const fail = () => finish(reject, new Error('QR library failed to load'));
      const timeout = setTimeout(() => finish(reject, new Error('QR library timeout')), 5000);
      script.addEventListener('load', done, { once: true });
      script.addEventListener('error', fail, { once: true });
      if (!existing) {
        script.src = QR_SCRIPT;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.dataset.winampQrcodeLibrary = '1';
        document.head.appendChild(script);
      } else if (window.QRCode) done();
    }).catch((error) => { libraryPromise = null; throw error; });
    return libraryPromise;
  }

  function ensurePanel(dialog) {
    let panel = dialog.querySelector('#winampPlaylistQrPanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'winampPlaylistQrPanel';
    panel.className = 'winamp-playlist-qr';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="winamp-playlist-qr-title"><strong>Point the other phone here</strong><span>SCAN TO OPEN</span></div>
      <div id="winampPlaylistQrCode" class="winamp-playlist-qr-code" aria-label="Share QR code"></div>
      <p class="winamp-playlist-qr-note">Scan to open the same shared music on the other device.</p>`;
    const note = dialog.querySelector('#winampShareNote');
    const input = dialog.querySelector('#winampShareUrl');
    if (note) note.insertAdjacentElement('afterend', panel);
    else input?.insertAdjacentElement('beforebegin', panel);
    return panel;
  }

  async function render(dialog) {
    const input = dialog.querySelector('#winampShareUrl');
    const url = String(input?.value || '').trim();
    if (!url) return;
    const panel = ensurePanel(dialog);
    const host = panel.querySelector('#winampPlaylistQrCode');
    if (!host) return;
    panel.hidden = false;
    if (panel.dataset.url === url && host.dataset.ready === '1') return;
    panel.dataset.url = url;
    host.dataset.ready = '0';
    host.replaceChildren();
    host.textContent = 'Creating QR…';
    host.style.color = '#111';
    host.style.font = '700 12px system-ui,sans-serif';
    try {
      const QRCodeCtor = await ensureLibrary();
      if (!dialog.open || String(input?.value || '').trim() !== url) return;
      host.replaceChildren();
      host.removeAttribute('style');
      new QRCodeCtor(host, {
        text: url,
        width: 240,
        height: 240,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCodeCtor.CorrectLevel.M,
      });
      host.dataset.ready = '1';
      if (STATUS && /SHARE|LINK (READY|COPIED)|ÁMPULA/i.test(STATUS.textContent || '')) STATUS.textContent = 'QR READY';
    } catch (error) {
      console.warn('[AMPULAMP QR]', error);
      host.replaceChildren();
      host.removeAttribute('style');
      host.dataset.ready = '0';
      const message = document.createElement('div');
      message.className = 'winamp-playlist-qr-error';
      message.textContent = 'QR unavailable — use the share link.';
      host.appendChild(message);
      if (STATUS) STATUS.textContent = 'QR UNAVAILABLE · SHARE LINK READY';
    }
  }

  function bindDialog(dialog) {
    if (!dialog || dialog.dataset.qrShareV1 === '1') return;
    dialog.dataset.qrShareV1 = '1';
    ensurePanel(dialog);
    const observer = new MutationObserver(() => { if (dialog.open) queueMicrotask(() => render(dialog)); });
    observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
    dialog.addEventListener('close', () => {
      const panel = dialog.querySelector('#winampPlaylistQrPanel');
      if (panel) panel.hidden = true;
    });
    if (dialog.open) void render(dialog);
  }

  function scanForDialog(root = document) {
    const dialog = root.querySelector?.('#winampShareDialog') || document.getElementById('winampShareDialog');
    if (dialog) bindDialog(dialog);
  }

  ensureStyles();
  scanForDialog();
  const bodyObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes || []) {
        if (!(node instanceof Element)) continue;
        if (node.id === 'winampShareDialog' || node.querySelector?.('#winampShareDialog')) {
          scanForDialog(node.id === 'winampShareDialog' ? node.parentElement : node);
          return;
        }
      }
    }
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });
})();
