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
      .winamp-playlist-qr{display:grid;justify-items:center;gap:9px;padding:12px;border:1px solid #343a46;border-radius:10px;background:#0c0e12}
      .winamp-playlist-qr[hidden]{display:none}
      .winamp-playlist-qr-title{width:100%;display:flex;align-items:baseline;justify-content:space-between;gap:12px}
      .winamp-playlist-qr-title strong{font-size:13px}.winamp-playlist-qr-title span{font-size:10px;color:#8f98a8;text-transform:uppercase;letter-spacing:.12em}
      .winamp-playlist-qr-code{display:grid;place-items:center;min-width:244px;min-height:244px;padding:12px;border-radius:8px;background:#fff}
      .winamp-playlist-qr-code canvas,.winamp-playlist-qr-code img{display:block!important;max-width:220px!important;width:220px!important;height:220px!important;image-rendering:pixelated}
      .winamp-playlist-qr-note{margin:0;color:#8f98a8;font-size:10px;line-height:1.4;text-align:center;max-width:360px}
      .winamp-playlist-qr-error{color:#f1b9b9;font-size:11px;text-align:center;max-width:320px}
      @media(max-width:420px){.winamp-playlist-qr-code{min-width:220px;min-height:220px;padding:10px}.winamp-playlist-qr-code canvas,.winamp-playlist-qr-code img{max-width:200px!important;width:200px!important;height:200px!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureLibrary() {
    if (window.QRCode) return Promise.resolve(window.QRCode);
    if (libraryPromise) return libraryPromise;

    libraryPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-winamp-qrcode-library]');
      const script = existing || document.createElement('script');
      const timeout = setTimeout(() => reject(new Error('QR library timeout')), 8000);
      const done = () => {
        clearTimeout(timeout);
        if (window.QRCode) resolve(window.QRCode);
        else reject(new Error('QR library unavailable'));
      };
      const fail = () => {
        clearTimeout(timeout);
        reject(new Error('QR library failed to load'));
      };

      if (!existing) {
        script.src = QR_SCRIPT;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.dataset.winampQrcodeLibrary = '1';
        script.addEventListener('load', done, { once: true });
        script.addEventListener('error', fail, { once: true });
        document.head.appendChild(script);
      } else if (window.QRCode) {
        done();
      } else {
        script.addEventListener('load', done, { once: true });
        script.addEventListener('error', fail, { once: true });
      }
    }).catch((error) => {
      libraryPromise = null;
      throw error;
    });

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
      <div class="winamp-playlist-qr-title"><strong>Scan playlist</strong><span>QR share</span></div>
      <div id="winampPlaylistQrCode" class="winamp-playlist-qr-code" aria-label="Playlist QR code"></div>
      <p class="winamp-playlist-qr-note">Generated on this device from the same encrypted playlist link. Scan it with another phone to open the playlist.</p>`;

    const input = dialog.querySelector('#winampShareUrl');
    input?.insertAdjacentElement('afterend', panel);
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

    if (panel.dataset.url === url && host.childElementCount) return;
    panel.dataset.url = url;
    host.replaceChildren();
    host.textContent = 'Creating QR…';
    host.style.color = '#111';
    host.style.font = '700 12px system-ui,sans-serif';

    try {
      const QRCodeCtor = await ensureLibrary();
      host.replaceChildren();
      host.removeAttribute('style');
      new QRCodeCtor(host, {
        text: url,
        width: 220,
        height: 220,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCodeCtor.CorrectLevel.M,
      });
      if (STATUS && /LINK (READY|COPIED)|SHORT LINK/i.test(STATUS.textContent || '')) {
        STATUS.textContent = 'PLAYLIST QR READY';
      }
    } catch (error) {
      console.warn('[Winamp Music QR share]', error);
      host.replaceChildren();
      host.removeAttribute('style');
      const message = document.createElement('div');
      message.className = 'winamp-playlist-qr-error';
      message.textContent = 'QR generator unavailable. The playlist link above still works.';
      host.appendChild(message);
      if (STATUS) STATUS.textContent = 'QR SHARE UNAVAILABLE';
    }
  }

  function bindDialog(dialog) {
    if (!dialog || dialog.dataset.qrShareV1 === '1') return;
    dialog.dataset.qrShareV1 = '1';
    ensurePanel(dialog);

    const observer = new MutationObserver(() => {
      if (dialog.open) queueMicrotask(() => render(dialog));
    });
    observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });

    dialog.addEventListener('close', () => {
      const panel = dialog.querySelector('#winampPlaylistQrPanel');
      if (panel) panel.hidden = true;
    });

    if (dialog.open) render(dialog);
  }

  function scan() {
    const dialog = document.getElementById('winampShareDialog');
    if (dialog) bindDialog(dialog);
  }

  ensureStyles();
  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
})();
