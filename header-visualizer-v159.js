(() => {
  'use strict';

  function loadAdIndicator() {
    if (document.querySelector('script[data-ampula-ad-indicator-170]')) return;
    const script = document.createElement('script');
    script.src = './ad-indicator-v170.js?v=170';
    script.async = true;
    script.setAttribute('data-ampula-ad-indicator-170', '1');
    document.head.appendChild(script);
  }

  function loadPlaybackQueue() {
    if (document.querySelector('script[data-ampula-playback-queue-170]')) return;
    const script = document.createElement('script');
    script.src = './playback-queue-v170.js?v=170';
    script.async = true;
    script.setAttribute('data-ampula-playback-queue-170', '1');
    document.head.appendChild(script);
  }

  function loadPlaybackPrefetch() {
    const existing = document.querySelector('script[data-ampula-playback-prefetch-165]');
    if (existing) {
      if (window.__AMPULA_PLAYBACK_PREFETCH_165__) loadPlaybackQueue();
      else existing.addEventListener('load', loadPlaybackQueue, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = './playback-prefetch-v165.js?v=167';
    script.async = true;
    script.setAttribute('data-ampula-playback-prefetch-165', '1');
    script.addEventListener('load', loadPlaybackQueue, { once: true });
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

  function loadResolverTrust() {
    const existing = document.querySelector('script[data-ampula-resolver-trust-167]');
    if (existing) {
      if (window.__AMPULA_RESOLVER_TRUST_167__) loadTrackDiagnostics();
      else existing.addEventListener('load', loadTrackDiagnostics, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = './resolver-trust-v167.js?v=167';
    script.async = true;
    script.setAttribute('data-ampula-resolver-trust-167', '1');
    script.addEventListener('load', loadTrackDiagnostics, { once: true });
    document.head.appendChild(script);
  }

  loadAdIndicator();
  loadResolverTrust();

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