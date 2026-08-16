(() => {
  if (window.__WINAMP_MUSIC_SUPPORT_V1__) return;
  window.__WINAMP_MUSIC_SUPPORT_V1__ = true;

  const LINKS = {
    author: 'https://github.com/sponsors/bambuchastudent',
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
          <div><div class="eyebrow">SUPPORT</div><strong>Keep the good old software alive</strong></div>
          <button id="supportClose" class="icon-button" type="button" aria-label="Close">✕</button>
        </div>
        <div class="support-grid">
          <a href="${LINKS.author}" target="_blank" rel="noopener noreferrer"><strong>⚡ Winamp Music</strong><span>Support the author</span></a>
          <a href="${LINKS.winamp}" target="_blank" rel="noopener noreferrer"><strong>🦙 Winamp</strong><span>Official Winamp site</span></a>
          <a href="${LINKS.winrar}" target="_blank" rel="noopener noreferrer"><strong>📚 WinRAR</strong><span>Buy an official WinRAR license</span></a>
        </div>
        <p>Winamp Music is independent and is not affiliated with Winamp or WinRAR.</p>
      </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector('#supportClose')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
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
      .support-dialog{width:min(calc(100% - 24px),620px);border:1px solid #343a46;border-radius:14px;color:#fff;background:#15181e;padding:0;box-shadow:0 30px 100px rgba(0,0,0,.7)}
      .support-dialog::backdrop{background:rgba(0,0,0,.65)}.support-card{padding:16px;display:grid;gap:14px}.support-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .support-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.support-grid a{display:grid;gap:4px;min-height:94px;padding:12px;border:1px solid #3a414d;border-radius:10px;background:#111419;color:#fff;text-decoration:none}.support-grid a:hover{border-color:#fca600}.support-grid span{font-size:11px;color:#9aa3b2;line-height:1.35}.support-card p{margin:0;color:#7f8793;font-size:10px;line-height:1.4}
      @media(max-width:560px){.support-grid{grid-template-columns:1fr}.support-grid a{min-height:64px}.top-actions{flex-wrap:wrap}}
    `;
    document.head.appendChild(style);
    return true;
  }

  let attempts = 0;
  const run = () => { if (mount()) return; attempts += 1; if (attempts < 100) setTimeout(run, 50); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();
