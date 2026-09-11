(() => {
  'use strict';

  function loadAdIndicator() {
    if (document.querySelector('script[data-ampula-ad-indicator-170]')) return;
    const script = document.createElement('script');
    script.src = './ad-indicator-v170.js?v=173';
    script.async = true;
    script.setAttribute('data-ampula-ad-indicator-170', '1');
    document.head.appendChild(script);
  }

  function loadPlaybackQueue() {
    if (document.querySelector('script[data-ampula-playback-queue-170]')) return;
    const script = document.createElement('script');
    script.src = './playback-queue-v170.js?v=173';
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
    script.src = './playback-prefetch-v165.js?v=173';
    script.async = true;
    script.setAttribute('data-ampula-playback-prefetch-165', '1');
    script.addEventListener('load', loadPlaybackQueue, { once: true });
    document.head.appendChild(script);
  }

  function loadDiagnosticsDownload() {
    const existing = document.querySelector('script[data-ampula-diagnostics-download-171]');
    if (existing) {
      if (window.__AMPULA_DIAGNOSTICS_DOWNLOAD_171__) loadPlaybackPrefetch();
      else existing.addEventListener('load', loadPlaybackPrefetch, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = './diagnostics-download-v171.js?v=173';
    script.async = true;
    script.setAttribute('data-ampula-diagnostics-download-171', '1');
    script.addEventListener('load', loadPlaybackPrefetch, { once: true });
    document.head.appendChild(script);
  }

  function loadTrackDiagnostics() {
    const existing = document.querySelector('script[data-ampula-track-diagnostics-164]');
    if (existing) {
      if (window.__AMPULA_TRACK_DIAGNOSTICS_164__) loadDiagnosticsDownload();
      else existing.addEventListener('load', loadDiagnosticsDownload, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = './track-diagnostics-v164.js?v=173';
    script.async = true;
    script.setAttribute('data-ampula-track-diagnostics-164', '1');
    script.addEventListener('load', loadDiagnosticsDownload, { once: true });
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
    script.src = './resolver-trust-v167.js?v=173';
    script.async = true;
    script.setAttribute('data-ampula-resolver-trust-167', '1');
    script.addEventListener('load', loadTrackDiagnostics, { once: true });
    document.head.appendChild(script);
  }

  function loadPlaybackMiss() {
    const existing = document.querySelector('script[data-ampula-playback-miss-173]');
    if (existing) {
      if (window.__AMPULA_PLAYBACK_MISS_173__) loadResolverTrust();
      else existing.addEventListener('load', loadResolverTrust, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = './playback-miss-v173.js?v=173';
    script.async = true;
    script.setAttribute('data-ampula-playback-miss-173', '1');
    script.addEventListener('load', loadResolverTrust, { once: true });
    document.head.appendChild(script);
  }

  function loadMatcherCore() {
    if (typeof window.winampMusicAppleImport?.findYouTubeMatch === 'function') {
      loadPlaybackMiss();
      return;
    }
    const existing = document.querySelector('script[data-ampula-matcher-v173],script[src*="apple-music-import-v064.js"]');
    if (existing) {
      existing.addEventListener('load', loadPlaybackMiss, { once: true });
      setTimeout(() => {
        if (typeof window.winampMusicAppleImport?.findYouTubeMatch === 'function') loadPlaybackMiss();
      }, 0);
      return;
    }
    const script = document.createElement('script');
    script.src = './apple-music-import-v064.js?v=173';
    script.async = true;
    script.setAttribute('data-ampula-matcher-v173', '1');
    script.addEventListener('load', loadPlaybackMiss, { once: true });
    document.head.appendChild(script);
  }

  loadAdIndicator();
  loadMatcherCore();

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