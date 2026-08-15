(() => {
  if (window.__WINAMP_LYRICS_V057__) return;
  window.__WINAMP_LYRICS_V057__ = true;

  const panel = document.getElementById('lyricsBar');
  if (!panel) return;

  const originalElementScrollTo = Element.prototype.scrollTo;
  if (typeof originalElementScrollTo === 'function' && !Element.prototype.__winampLyricsScrollPatched) {
    Object.defineProperty(Element.prototype, '__winampLyricsScrollPatched', { value: true, configurable: true });
    Element.prototype.scrollTo = function(...args) {
      if (this?.classList?.contains('lyrics-karaoke')) return;
      return originalElementScrollTo.apply(this, args);
    };
  }

  let allowLyricsFocusUntil = 0;
  let lastOutsideFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let lastUserNavigationAt = Date.now();

  const markLyricsInteraction = () => { allowLyricsFocusUntil = Date.now() + 2500; };
  panel.addEventListener('pointerdown', markLyricsInteraction, true);
  panel.addEventListener('touchstart', markLyricsInteraction, { capture: true, passive: true });
  panel.addEventListener('keydown', markLyricsInteraction, true);

  document.addEventListener('pointerdown', () => { lastUserNavigationAt = Date.now(); }, true);
  document.addEventListener('touchmove', () => { lastUserNavigationAt = Date.now(); }, { capture: true, passive: true });
  document.addEventListener('wheel', () => { lastUserNavigationAt = Date.now(); }, { capture: true, passive: true });

  document.addEventListener('focusin', (event) => {
    const target = event.target;
    if (!panel.contains(target)) {
      if (target instanceof HTMLElement) lastOutsideFocus = target;
      return;
    }

    if (target?.classList?.contains('genius-lyrics-frame') && Date.now() > allowLyricsFocusUntil) {
      const restore = lastOutsideFocus;
      setTimeout(() => {
        if (restore?.isConnected && typeof restore.focus === 'function') {
          try { restore.focus({ preventScroll: true }); } catch { restore.focus(); }
        } else if (document.activeElement === target && target instanceof HTMLElement) {
          try { target.blur(); } catch {}
        }
      }, 0);
    }
  }, true);

  function prepareGeniusFrame(frame) {
    if (!frame || frame.dataset.winampNoFocus === '1') return;
    frame.dataset.winampNoFocus = '1';
    frame.tabIndex = -1;
    frame.setAttribute('tabindex', '-1');

    const mountedAt = Date.now();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const navigationStamp = lastUserNavigationAt;
    const restoreFocus = lastOutsideFocus;

    frame.addEventListener('load', () => {
      const automaticWindow = Date.now() - mountedAt < 1800;
      const userDidNotNavigate = lastUserNavigationAt === navigationStamp;
      if (automaticWindow && userDidNotNavigate) {
        if (Math.abs(window.scrollY - scrollY) > 2 || Math.abs(window.scrollX - scrollX) > 2) {
          window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
        }
        if (document.activeElement === frame && restoreFocus?.isConnected) {
          try { restoreFocus.focus({ preventScroll: true }); } catch { restoreFocus.focus(); }
        }
      }
    });
  }

  function refreshVisibility() {
    const syncHost = document.getElementById('lyricsSyncHost');
    const embedHost = document.getElementById('geniusEmbedHost');
    const header = panel.querySelector('.lyrics-panel-header');
    const geniusFrame = embedHost?.querySelector('iframe.genius-lyrics-frame, iframe');
    const hasSyncedText = Boolean(syncHost?.querySelector('.lyrics-line, .lyrics-plain'));
    const hasGenius = Boolean(geniusFrame);

    if (geniusFrame) prepareGeniusFrame(geniusFrame);

    panel.hidden = !(hasSyncedText || hasGenius);
    if (header) header.hidden = !hasGenius;
    if (syncHost) syncHost.hidden = !hasSyncedText;
    if (embedHost) embedHost.hidden = !hasGenius;
  }

  const observer = new MutationObserver(refreshVisibility);
  observer.observe(panel, { childList: true, subtree: true });
  refreshVisibility();
})();
