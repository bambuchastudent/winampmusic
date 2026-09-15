(() => {
  'use strict';
  function load(src, marker, done) {
    if (document.querySelector(`script[${marker}]`)) return done?.();
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.setAttribute(marker, '1');
    if (done) script.addEventListener('load', done, { once: true });
    document.head.appendChild(script);
  }
  load('./playback-navigation-core-v178.js?v=179', 'data-ampula-playback-navigation-core-178', () => {
    load('./background-media-session-v114.js?v=114', 'data-ampula-media-session-114');
    load('./background-playback-v114.js?v=114', 'data-ampula-background-playback-114');
  });
})();