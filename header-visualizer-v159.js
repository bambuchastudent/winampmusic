(() => {
  'use strict';

  function loadTrackDiagnostics() {
    if (document.querySelector('script[data-ampula-track-diagnostics-164]')) return;
    const script = document.createElement('script');
    script.src = './track-diagnostics-v164.js?v=164';
    script.async = true;
    script.dataset.ampulaTrackDiagnostics164 = '1';
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