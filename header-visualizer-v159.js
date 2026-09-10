(() => {
  'use strict';

  function loadPlaybackPrefetch() {
    if (document.querySelector('script[data-ampula-playback-prefetch-165]')) return;
    const script = document.createElement('script');
    script.src = './playback-prefetch-v165.js?v=167';
    script.async = true;
    script.setAttribute('data-ampula-playback-prefetch-165', '1');
    document.head.appendChild(script);
  }

  function loadTrackDiagnostics() {
    const existing = document.querySelector('script[data-ampula-track-diagnostics-164]');
    if (existing) {
      if (window.__AMPULA_TRACK_DIAGNOSTICS_164__) loadPlaybackPrefetch();
      else existing.addEventListener('load', loadPlaybackPrefetch, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = './track-diagnostics-v164.js?v=167';
    script.async = true;
    script.setAttribute('data-ampula-track-diagnostics-164', '1');
    script.addEventListener('load', loadPlaybackPrefetch, { once: true });
    document.head.appendChild(script);
  }

  loadTrackDiagnostics();

  const spectrum = document.getElementById('headerSpectrum');
  const playButton = document.getElementById('playButton');
  const status = document.getElementById('status');
  if (!spectrum) return;

  const sync = () => {
    const byButton = String(playButton?.textContent || '').includes('⏸');
    const byStatus = /PLAYING/i.test(String(status?.textContent || ''));
    spectrum.dataset.playing = byButton || byStatus ? '1' : '0';
  };

  const observer = new MutationObserver(sync);
  if (playButton) observer.observe(playButton, { childList: true, subtree: true });
  if (status) observer.observe(status, { childList: true, subtree: true });
  sync();
})();