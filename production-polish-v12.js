(() => {
  if (window.__WINAMP_MUSIC_PRODUCTION_POLISH_V12__) return;
  window.__WINAMP_MUSIC_PRODUCTION_POLISH_V12__ = true;

  const VERSION = '1.2';
  const OWNER_KEY = 'winampmusic.playbackOwner.v1';
  const CHANNEL_NAME = 'winampmusic.playback.v1';
  const HEARTBEAT_MS = 2000;
  const OWNER_STALE_MS = 6500;
  const TAB_ID = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const COPY = {
    en: { online: 'Online', offline: 'Offline', report: 'Report bug', update: 'Update ready', moved: 'Playback moved to another Winamp Music tab', shortcut: 'Space play/pause · ←/→ seek · P/N track' },
    ru: { online: 'В сети', offline: 'Нет сети', report: 'Сообщить баг', update: 'Есть обновление', moved: 'Музыка продолжилась в другой вкладке Winamp Music', shortcut: 'Пробел play/pause · ←/→ перемотка · P/N трек' },
    es: { online: 'En línea', offline: 'Sin conexión', report: 'Reportar fallo', update: 'Actualización lista', moved: 'La reproducción pasó a otra pestaña de Winamp Music', shortcut: 'Espacio play/pause · ←/→ buscar · P/N pista' },
    de: { online: 'Online', offline: 'Offline', report: 'Fehler melden', update: 'Update bereit', moved: 'Wiedergabe läuft jetzt in einem anderen Winamp-Music-Tab', shortcut: 'Leertaste Play/Pause · ←/→ Spulen · P/N Titel' },
    zh: { online: '在线', offline: '离线', report: '报告问题', update: '更新可用', moved: '播放已切换到另一个 Winamp Music 标签页', shortcut: '空格播放/暂停 · ←/→ 快退快进 · P/N 曲目' },
    hi: { online: 'ऑनलाइन', offline: 'ऑफ़लाइन', report: 'बग रिपोर्ट करें', update: 'अपडेट तैयार', moved: 'प्लेबैक दूसरे Winamp Music टैब में चला गया', shortcut: 'Space प्ले/पॉज़ · ←/→ सीक · P/N ट्रैक' },
    ur: { online: 'آن لائن', offline: 'آف لائن', report: 'بگ رپورٹ کریں', update: 'اپ ڈیٹ تیار', moved: 'پلے بیک دوسرے Winamp Music ٹیب میں منتقل ہو گیا', shortcut: 'Space پلے/پاز · ←/→ سیک · P/N ٹریک' },
    ar: { online: 'متصل', offline: 'غير متصل', report: 'الإبلاغ عن خلل', update: 'تحديث جاهز', moved: 'انتقل التشغيل إلى علامة تبويب Winamp Music أخرى', shortcut: 'Space تشغيل/إيقاف · ←/→ تقديم · P/N مقطع' },
  };

  function language() {
    for (const raw of [...(navigator.languages || []), navigator.language || 'en']) {
      const lang = String(raw || '').toLowerCase().split('-')[0];
      if (COPY[lang]) return lang;
    }
    return 'en';
  }

  const copy = COPY[language()];
  const status = document.getElementById('status');
  const play = document.getElementById('playButton');
  const previous = document.getElementById('prevButton');
  const next = document.getElementById('nextButton');
  const seek = document.getElementById('seek');
  const duration = document.getElementById('duration');
  const topActions = document.querySelector('.top-actions');
  let localClaimAt = 0;
  let reloadingForUpdate = false;

  function playerState() {
    return String(status?.textContent || '').trim().toUpperCase();
  }

  function parseTime(value) {
    const parts = String(value || '').trim().split(':').map(Number);
    if (!parts.length || parts.some((part) => !Number.isFinite(part))) return 0;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  }

  function ensureStyles() {
    if (document.getElementById('productionPolishV12Styles')) return;
    const style = document.createElement('style');
    style.id = 'productionPolishV12Styles';
    style.textContent = `
      .wm-v12-network{display:inline-flex;align-items:center;min-height:34px;padding:0 10px;border:1px solid #343a46;border-radius:999px;background:#111419;color:#b6beca;font-size:11px;font-weight:800;white-space:nowrap}
      .wm-v12-network[data-online="false"]{border-color:#8f4b24;color:#ffbf80}
      .wm-v12-report,.wm-v12-update{white-space:nowrap;text-decoration:none}
      .wm-v12-update{border-color:#8f7724!important;color:#f7d95d!important}
      .wm-v12-toast{position:fixed;z-index:10000;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);max-width:min(92vw,560px);padding:10px 13px;border:1px solid #3a414d;border-radius:10px;background:#111419;color:#fff;font-size:12px;font-weight:800;box-shadow:0 16px 45px rgba(0,0,0,.45);pointer-events:none}
      .wm-v12-shortcuts{margin:8px 0 0;text-align:center;color:#7f8793;font-size:10px}
      @media(max-width:620px){.wm-v12-shortcuts{display:none}.wm-v12-network{min-height:32px;padding:0 8px}.wm-v12-report{min-height:32px!important}}
    `;
    document.head.appendChild(style);
  }

  function toast(message) {
    let node = document.getElementById('wmV12Toast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'wmV12Toast';
      node.className = 'wm-v12-toast';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { node.hidden = true; }, 2600);
  }

  function mountConnectivity() {
    if (!topActions || document.getElementById('wmV12Network')) return;
    const badge = document.createElement('span');
    badge.id = 'wmV12Network';
    badge.className = 'wm-v12-network';
    badge.setAttribute('role', 'status');
    badge.setAttribute('aria-live', 'polite');
    topActions.prepend(badge);

    const sync = () => {
      const online = navigator.onLine !== false;
      badge.dataset.online = String(online);
      badge.textContent = online ? `● ${copy.online}` : `○ ${copy.offline}`;
      badge.title = online ? copy.online : copy.offline;
    };
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    sync();
  }

  function mountBugReport() {
    if (!topActions || document.getElementById('wmV12ReportBug')) return;
    const link = document.createElement('a');
    link.id = 'wmV12ReportBug';
    link.className = 'youtube-button wm-v12-report';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `⚑ ${copy.report}`;
    const url = new URL('https://github.com/bambuchastudent/winampmusic/issues/new');
    url.searchParams.set('labels', 'bug');
    url.searchParams.set('title', `[v${VERSION}] `);
    url.searchParams.set('body', `\n\n---\nWinamp Music v${VERSION}\nPage: ${location.origin}${location.pathname}\nBrowser: ${navigator.userAgent}\n`);
    link.href = url.toString();
    topActions.prepend(link);
  }

  function mountShortcutHint() {
    const controls = document.querySelector('.controls');
    if (!controls || document.getElementById('wmV12Shortcuts')) return;
    const hint = document.createElement('div');
    hint.id = 'wmV12Shortcuts';
    hint.className = 'wm-v12-shortcuts';
    hint.textContent = copy.shortcut;
    controls.insertAdjacentElement('afterend', hint);
  }

  function seekBy(seconds) {
    const total = parseTime(duration?.textContent);
    if (!seek || !(total > 0)) return;
    const current = (Number(seek.value) / 1000) * total;
    const target = Math.max(0, Math.min(total, current + seconds));
    seek.value = String(Math.round((target / total) * 1000));
    seek.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function installKeyboardControls() {
    document.addEventListener('keydown', (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(tag)) return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        play?.click();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        seekBy(-10);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        seekBy(10);
      } else if (event.key.toLowerCase() === 'p') {
        previous?.click();
      } else if (event.key.toLowerCase() === 'n') {
        next?.click();
      }
    });
  }

  function readOwner() {
    try { return JSON.parse(localStorage.getItem(OWNER_KEY) || 'null'); } catch { return null; }
  }

  function outranksLocal(owner) {
    if (!owner || owner.tabId === TAB_ID) return false;
    const at = Number(owner.at) || 0;
    if (Date.now() - at > OWNER_STALE_MS) return false;
    return at > localClaimAt || (at === localClaimAt && String(owner.tabId) > TAB_ID);
  }

  function pauseForForeignOwner(owner) {
    if (!outranksLocal(owner) || playerState() !== 'PLAYING') return;
    play?.click();
    toast(copy.moved);
  }

  let channel = null;
  try { channel = new BroadcastChannel(CHANNEL_NAME); } catch {}

  function publishClaim(reason = 'play') {
    const owner = { tabId: TAB_ID, at: Date.now(), reason };
    localClaimAt = owner.at;
    try { localStorage.setItem(OWNER_KEY, JSON.stringify(owner)); } catch {}
    try { channel?.postMessage({ type: 'claim', ...owner }); } catch {}
  }

  channel?.addEventListener('message', (event) => {
    if (event.data?.type === 'claim') pauseForForeignOwner(event.data);
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== OWNER_KEY || !event.newValue) return;
    try { pauseForForeignOwner(JSON.parse(event.newValue)); } catch {}
  });

  function installSingleTabPlayback() {
    if (!status) return;
    const observer = new MutationObserver(() => {
      if (playerState() === 'PLAYING') publishClaim('playing');
    });
    observer.observe(status, { childList: true, characterData: true, subtree: true });

    setInterval(() => {
      if (playerState() === 'PLAYING') publishClaim('heartbeat');
      else {
        const owner = readOwner();
        if (owner?.tabId === TAB_ID && Date.now() - Number(owner.at || 0) > OWNER_STALE_MS) {
          try { localStorage.removeItem(OWNER_KEY); } catch {}
        }
      }
    }, HEARTBEAT_MS);

    window.addEventListener('pagehide', () => {
      const owner = readOwner();
      if (owner?.tabId === TAB_ID) {
        try { localStorage.removeItem(OWNER_KEY); } catch {}
      }
      try { channel?.close(); } catch {}
    });
  }

  function mountUpdateButton(worker) {
    if (!topActions || !worker || document.getElementById('wmV12Update')) return;
    const button = document.createElement('button');
    button.id = 'wmV12Update';
    button.type = 'button';
    button.className = 'youtube-button wm-v12-update';
    button.textContent = `↻ ${copy.update}`;
    button.addEventListener('click', () => {
      button.disabled = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    }, { once: true });
    topActions.prepend(button);
  }

  async function installUpdateFlow() {
    if (!('serviceWorker' in navigator)) return;
    let registration;
    try {
      registration = await navigator.serviceWorker.ready;
    } catch {
      return;
    }

    if (registration.waiting) mountUpdateButton(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) mountUpdateButton(worker);
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadingForUpdate) return;
      reloadingForUpdate = true;
      location.reload();
    });

    setTimeout(() => registration.update().catch(() => {}), 1800);
  }

  function mount() {
    ensureStyles();
    mountConnectivity();
    mountBugReport();
    mountShortcutHint();
    installKeyboardControls();
    installSingleTabPlayback();
    const footer = document.querySelector('.app-version');
    if (footer) footer.textContent = `v${VERSION}`;
    window.addEventListener('load', installUpdateFlow, { once: true });
    if (document.readyState === 'complete') installUpdateFlow();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
