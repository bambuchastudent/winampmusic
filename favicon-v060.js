(() => {
  if (window.__WINAMP_MUSIC_V060_FAVICON__) return;
  window.__WINAMP_MUSIC_V060_FAVICON__ = true;

  const VERSION = '0.6.2';
  const MARK = 'data-winamp-favicon';

  const specs = [
    {
      key: 'png16',
      rel: 'icon',
      href: `./favicon-16.png?v=${VERSION}`,
      type: 'image/png',
      sizes: '16x16',
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
      sizes: '16x16 32x32 48x48 64x64',
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

      // Safari was falling back to the generated github.io monogram. Keep a
      // single raster favicon set and remove stale static/runtime SVG/ICO
      // candidates that can win selection from older cached releases.
      for (const node of document.head.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')) {
        if (node.hasAttribute(MARK)) continue;
        node.remove();
      }

      for (const node of document.head.querySelectorAll('link[rel="mask-icon"]')) {
        if (!node.hasAttribute(MARK)) node.remove();
      }
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

  window.addEventListener('load', () => ensureFavicons(), { once: true });
})();
