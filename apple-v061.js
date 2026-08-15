(() => {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const isIPadOS = platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || isIPadOS;
  const isMac = /Mac/i.test(platform) && !isIOS;
  const isSafari = /Safari/i.test(ua) && !/(CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|Edg)/i.test(ua);
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

  if (!isIOS && !isMac) return;

  window.__WINAMP_MUSIC_APPLE_V061__ = true;
  document.documentElement.classList.add('apple-platform');
  if (isIOS) document.documentElement.classList.add('apple-ios');
  if (isMac) document.documentElement.classList.add('apple-macos');
  if (isStandalone) document.documentElement.classList.add('apple-standalone');

  function ensureMeta(name, content) {
    let meta = document.querySelector(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = name;
      document.head.appendChild(meta);
    }
    meta.content = content;
  }

  function ensureAppleHead() {
    ensureMeta('mobile-web-app-capable', 'yes');
    ensureMeta('apple-mobile-web-app-capable', 'yes');
    ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
    ensureMeta('apple-mobile-web-app-title', 'Winamp Music');

    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const icon = document.createElement('link');
      icon.rel = 'apple-touch-icon';
      icon.sizes = '180x180';
      icon.href = './apple-touch-icon.png?v=0.6.1';
      document.head.appendChild(icon);
    }
  }

  function ensureStyles() {
    if (document.getElementById('appleV061Styles')) return;
    const style = document.createElement('style');
    style.id = 'appleV061Styles';
    style.textContent = `
      html.apple-ios body{padding-bottom:env(safe-area-inset-bottom)}
      html.apple-ios .app-shell{padding-left:max(12px,env(safe-area-inset-left));padding-right:max(12px,env(safe-area-inset-right))}
      html.apple-ios button,html.apple-ios a,html.apple-ios input{-webkit-tap-highlight-color:transparent}
      .apple-install-dialog .dialog-card{max-width:520px}
      .apple-install-steps{display:grid;gap:10px;margin:14px 0;padding-left:22px;line-height:1.45}
      .apple-install-note{margin:10px 0 0;color:#b7bdc8;font-size:12px;line-height:1.45}
      .apple-paste-button{min-height:48px;white-space:nowrap}
      .apple-import-hint{margin-top:8px;color:#b7bdc8;font-size:12px;line-height:1.4}
      @media(max-width:520px){
        html.apple-ios .top-actions{gap:6px;flex-wrap:wrap;justify-content:flex-end}
        html.apple-ios #installButton{min-height:38px}
        html.apple-ios .youtube-import-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
      }
    `;
    document.head.appendChild(style);
  }

  function getInstallDialog() {
    let dialog = document.getElementById('appleInstallDialog');
    if (dialog) return dialog;

    dialog = document.createElement('dialog');
    dialog.id = 'appleInstallDialog';
    dialog.className = 'apple-install-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="dialog-card">
        <div class="dialog-heading">
          <div><div class="eyebrow">APPLE PWA</div><h2>${isIOS ? 'Install Winamp Music on iPhone / iPad' : 'Install Winamp Music on Mac'}</h2></div>
          <button class="icon-button" value="cancel" aria-label="Close">✕</button>
        </div>
        ${isIOS ? `
          <ol class="apple-install-steps">
            <li>Open this page in Safari.</li>
            <li>Tap the Share button in Safari.</li>
            <li>Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</li>
          </ol>
          <p class="apple-install-note">The installed app keeps your Winamp Music library in its own Safari/PWA storage. YouTube iframe playback still follows iOS/YouTube background-playback rules.</p>
        ` : `
          <ol class="apple-install-steps">
            <li>Open this page in Safari.</li>
            <li>Choose <strong>File → Add to Dock</strong>.</li>
            <li>Launch Winamp Music from the Dock like a normal Mac app.</li>
          </ol>
          <p class="apple-install-note">Your library stays local in the installed Safari web app.</p>
        `}
        <div class="dialog-actions"><button value="cancel" class="ghost">Close</button></div>
      </form>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  function setupInstallButton() {
    const button = document.getElementById('installButton');
    if (!button) return;

    if (isIOS) {
      if (isStandalone) {
        button.hidden = true;
        return;
      }
      button.hidden = false;
      button.textContent = 'Install on iPhone';
      button.setAttribute('aria-label', 'Install Winamp Music on iPhone or iPad');
      button.addEventListener('click', (event) => {
        event.preventDefault();
        getInstallDialog().showModal();
      });
      return;
    }

    if (isMac && isSafari) {
      button.hidden = false;
      button.textContent = 'Add to Dock';
      button.setAttribute('aria-label', 'Add Winamp Music to the Mac Dock');
      button.addEventListener('click', (event) => {
        event.preventDefault();
        getInstallDialog().showModal();
      });
    }
  }

  function sendImportValue(input, value) {
    const text = String(value || '').trim();
    if (!text) return false;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function setupIOSPasteImport() {
    if (!isIOS) return;
    const row = document.querySelector('#youtubeImportBar .youtube-import-row');
    const input = document.getElementById('youtubeImportInput');
    if (!row || !input || document.getElementById('applePasteYoutube')) return;

    const button = document.createElement('button');
    button.id = 'applePasteYoutube';
    button.type = 'button';
    button.className = 'mini-button apple-paste-button';
    button.textContent = 'Paste';
    button.setAttribute('aria-label', 'Paste YouTube link from clipboard');
    button.addEventListener('click', async () => {
      const status = document.getElementById('status');
      try {
        const text = await navigator.clipboard.readText();
        if (!sendImportValue(input, text)) throw new Error('Clipboard is empty');
        if (status) status.textContent = 'PASTED FROM CLIPBOARD';
      } catch {
        const text = window.prompt('Paste a YouTube track or playlist URL');
        if (sendImportValue(input, text) && status) status.textContent = 'READING YOUTUBE LINK';
        else input.focus();
      }
    });
    row.appendChild(button);

    const hint = document.createElement('div');
    hint.className = 'apple-import-hint';
    hint.textContent = 'iPhone/iPad: in YouTube tap Share → Copy Link, then tap Paste here.';
    row.parentElement?.appendChild(hint);
  }

  function mount() {
    ensureAppleHead();
    ensureStyles();
    setupInstallButton();
    setupIOSPasteImport();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
