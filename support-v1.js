(() => {
  if (window.__WINAMP_MUSIC_SUPPORT_V1__) return;
  window.__WINAMP_MUSIC_SUPPORT_V1__ = true;

  const LINKS = {
    winamp: 'https://winamp.com/',
    winrar: 'https://www.rarlab.com/shop.htm',
  };

  function ensureDialog() {
    let dialog = document.getElementById('supportWinampMusicDialog');
    if (dialog) return dialog;

    dialog = document.createElement('dialog');
    dialog.id = 'supportWinampMusicDialog';
    dialog.className = 'support-dialog';
    dialog.innerHTML = `
      <div class="support-card">
        <div class="support-head">
          <strong>♥ Support</strong>
          <button id="supportClose" class="icon-button" type="button" aria-label="Close">✕</button>
        </div>
        <div class="support-grid">
          <button class="support-choice support-author" type="button" disabled aria-disabled="true">
            <strong>⚡ Winamp Music</strong>
            <span>Direct author donation link coming soon</span>
          </button>
          <a class="support-choice" href="${LINKS.winamp}" target="_blank" rel="noopener noreferrer">
            <strong>🦙 Winamp</strong>
            <span>Official site</span>
          </a>
          <a class="support-choice" href="${LINKS.winrar}" target="_blank" rel="noopener noreferrer">
            <strong>📚 WinRAR</strong>
            <span>Official license</span>
          </a>
        </div>
      </div>`;

    document.body.appendChild(dialog);
    dialog.querySelector('#supportClose')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    return dialog;
  }

  function mount() {
    if (document.getElementById('supportButton')) return true;
    const actions = document.querySelector('.top-actions');
    if (!actions) return false;

    const button = document.createElement('button');
    button.id = 'supportButton';
    button.type = 'button';
    button.className = 'youtube-button support-button';
    button.textContent = '♥ Support';
    button.addEventListener('click', () => ensureDialog().showModal());
    actions.prepend(button);

    const style = document.createElement('style');
    style.textContent = `
      .support-button{border-color:#8f7724!important;color:#f7d95d!important}
      .support-dialog{width:min(calc(100% - 24px),460px);border:1px solid #343a46;border-radius:14px;color:#fff;background:#15181e;padding:0;box-shadow:0 30px 100px rgba(0,0,0,.7)}
      .support-dialog::backdrop{background:rgba(0,0,0,.65)}
      .support-card{padding:14px;display:grid;gap:12px}.support-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .support-grid{display:grid;gap:8px}.support-choice{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:58px;padding:12px 14px;border:1px solid #3a414d;border-radius:10px;background:#111419;color:#fff;text-decoration:none;font:inherit;text-align:left}
      .support-choice strong{font-size:15px}.support-choice span{font-size:11px;color:#9aa3b2;text-align:right}.support-choice[href]:hover{border-color:#fca600}.support-author{opacity:.6;cursor:default}.support-author span{color:#747d8a}
      @media(max-width:560px){.support-dialog{width:min(calc(100% - 18px),460px)}.support-choice{min-height:54px}.top-actions{flex-wrap:wrap}}
    `;
    document.head.appendChild(style);
    return true;
  }

  let attempts = 0;
  const run = () => {
    if (mount()) return;
    attempts += 1;
    if (attempts < 100) setTimeout(run, 50);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();
