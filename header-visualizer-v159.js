(() => {
  'use strict';
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
