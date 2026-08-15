(() => {
  if (window.__WINAMP_MUSIC_V060_FAVICON__) return;
  window.__WINAMP_MUSIC_V060_FAVICON__ = true;

  const VERSION = '0.5.10';
  const MARK = 'data-winamp-favicon';

  const specs = [
    {
      key: 'ico',
      rel: 'icon',
      href: `./favicon.ico?v=${VERSION}`,
      type: 'image/x-icon',
      sizes: 'any',
    },
    {
      key: 'png32',
      rel: 'icon',
      href: `./favicon-32.png?v=${VERSION}`,
      type: 'image/png',
      sizes: '32x32',
    },
    {
      key: 'shortcut',
      rel: 'shortcut icon',
      href: `./favicon.ico?v=${VERSION}`,
      type: 'image/x-icon',
    },
    {
      key: 'touch',
      rel: 'apple-touch-icon',
      href: `./apple-touch-icon.png?v=${VERSION}`,
      sizes: '180x180',
    },
    {
      key: 'mask',
      rel: 'mask-icon',
      href: `./safari-pinned-tab.svg?v=${VERSION}`,
      color: '#fca600',
    },
  ];

  let applying = false;

  function setIfDifferent(node, name, value) {
    if (value == null) {
      if (node.hasAttribute(name)) node.removeAttribute(name);
      return;
    }
    if (node.getAttribute(name) !== value) node.setAttribute(name, value);
  }

  function ensureFavicons() {
    if (applying) return;
    applying = true;
    try {
      for (const spec of specs) {
        let node = document.head.querySelector(`link[${MARK}="${spec.key}"]`);
        if (!node) {
          node = document.createElement('link');
          node.setAttribute(MARK, spec.key);
          document.head.appendChild(node);
        }
        setIfDifferent(node, 'rel', spec.rel);
        setIfDifferent(node, 'href', spec.href);
        setIfDifferent(node, 'type', spec.type || null);
        setIfDifferent(node, 'sizes', spec.sizes || null);
        setIfDifferent(node, 'color', spec.color || null);
      }

      // v0.5.9 dynamically rewrites the first icon back to SVG. Keep that
      // legacy node from winning Safari's favicon selection while old tabs
      // are still running cached JS.
      for (const node of document.head.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')) {
        if (node.hasAttribute(MARK)) continue;
        const href = node.getAttribute('href') || '';
        if (/icon\.svg(?:\?|$)/.test(href)) node.remove();
      }

      const oldMask = [...document.head.querySelectorAll('link[rel="mask-icon"]')]
        .filter((node) => !node.hasAttribute(MARK));
      for (const node of oldMask) node.remove();
    } finally {
      applying = false;
    }
  }

  ensureFavicons();

  const observer = new MutationObserver(() => queueMicrotask(ensureFavicons));
  observer.observe(document.head, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['rel', 'href', 'type', 'sizes', 'color'],
  });

  window.addEventListener('load', () => {
    ensureFavicons();
    const version = document.querySelector('.app-version');
    if (version) version.textContent = `v${VERSION}`;
  }, { once: true });
})();
