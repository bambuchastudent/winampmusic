(() => {
  'use strict';
  if (window.__AMP_MUSIC_SHARE_UI_CLEANUP_162__) return;
  window.__AMP_MUSIC_SHARE_UI_CLEANUP_162__ = true;

  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const STATUS = document.getElementById('status');
  const RECEIVED_HIDDEN_ATTR = 'data-amp-received-hidden';

  const setStatus = (text) => { if (STATUS) STATUS.textContent = text; };

  function setText(node, value) {
    if (node && clean(node.textContent) !== value) node.textContent = value;
  }

  function setEyebrow(strong, value) {
    const box = strong?.parentElement;
    const eyebrow = box?.querySelector('div');
    if (eyebrow) setText(eyebrow, value);
  }

  function copyFallback(value) {
    try {
      const field = document.createElement('textarea');
      field.value = value;
      field.setAttribute('readonly', '');
      field.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand?.('copy') === true;
      field.remove();
      return copied;
    } catch {
      return false;
    }
  }

  async function copyValue(value) {
    const text = clean(value);
    if (!text) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    return copyFallback(text);
  }

  async function copyCurrentShareLink(kind) {
    const dialog = document.getElementById('winampShareDialog');
    const value = clean(dialog?.querySelector('#winampShareUrl')?.value);
    if (!value) return false;
    const copied = await copyValue(value);
    if (!copied) return false;
    setStatus(kind === 'short' ? 'SHORT LINK COPIED' : 'LINK COPIED');
    return true;
  }

  function hideLocalLibrary() {
    const panel = document.querySelector('.library-panel');
    if (!panel) return;
    for (const node of panel.querySelectorAll('.library-header,#search,#trackList,#emptyState')) {
      if (node.hasAttribute(RECEIVED_HIDDEN_ATTR)) continue;
      node.setAttribute(RECEIVED_HIDDEN_ATTR, node.hidden ? 'hidden' : 'visible');
      node.hidden = true;
    }
  }

  function restoreLocalLibrary() {
    for (const node of document.querySelectorAll(`[${RECEIVED_HIDDEN_ATTR}]`)) {
      const previous = node.getAttribute(RECEIVED_HIDDEN_ATTR);
      node.hidden = previous === 'hidden';
      node.removeAttribute(RECEIVED_HIDDEN_ATTR);
    }
  }

  function leaveReceivedView(dialog) {
    try { if (dialog?.open) dialog.close(); } catch {}
    if (dialog) dialog.style.display = 'none';
    restoreLocalLibrary();
    try {
      const url = new URL(location.href);
      for (const key of ['a', 'al', 'p', 's', 'playlist']) url.searchParams.delete(key);
      url.hash = '';
      history.replaceState({}, '', url);
    } catch {}
    try { window.renderLibrary?.(); } catch {}
    setStatus('READY · FAST');
  }

  function makeReceivedInline(dialog) {
    if (!dialog) return;
    const panel = document.querySelector('.library-panel');
    if (panel && dialog.parentElement !== panel) panel.prepend(dialog);
    hideLocalLibrary();

    dialog.dataset.dialogless165 = '1';
    dialog.style.cssText = [
      'position:static',
      'inset:auto',
      'display:block',
      'width:100%',
      'max-width:none',
      'max-height:none',
      'box-sizing:border-box',
      'margin:0',
      'padding:0',
      'border:0',
      'border-radius:0',
      'background:transparent',
      'color:inherit',
      'box-shadow:none',
      'overflow:visible',
    ].join(';');

    const close = dialog.querySelector('#ampulaReceivedClose');
    if (close && close.dataset.dialogless165 !== '1') {
      const back = close.cloneNode(true);
      back.dataset.dialogless165 = '1';
      back.textContent = '← My library';
      back.setAttribute('aria-label', 'Return to my library');
      back.style.cssText = 'width:auto;min-width:0;padding:0 4px;font-size:11px;font-weight:800;white-space:nowrap';
      close.replaceWith(back);
      back.addEventListener('click', () => leaveReceivedView(dialog));
    }
  }

  function patchShareDialog(dialog) {
    if (!dialog) return;
    dialog.dataset.dialogless165 = '1';
    dialog.style.display = 'none';
    const heading = dialog.querySelector('#winampShareHeading');
    setEyebrow(heading, 'SHARE');
    setText(heading, 'Share music');
    dialog.querySelector('#winampShareFile')?.remove();
    dialog.querySelector('#winampShareSaved')?.remove();
  }

  function findReceivedNotice(dialog) {
    if (!dialog) return null;
    for (const node of dialog.querySelectorAll('div')) {
      if (node.children.length !== 0) continue;
      if (/Opening this Ámpula does not change Your library/i.test(clean(node.textContent))) return node;
    }
    return null;
  }

  function patchReceivedDialog(dialog) {
    if (!dialog) return;
    const title = dialog.querySelector('#ampulaReceivedTitle');
    setEyebrow(title, 'SHARED MUSIC');
    setText(title, 'Shared music');
    setText(dialog.querySelector('#ampulaSave'), 'Save');
    setText(dialog.querySelector('#ampulaAdd'), 'Add to library');
    dialog.querySelector('#ampulaFile')?.remove();

    const notice = findReceivedNotice(dialog);
    setText(notice, 'Opening this link does not change your library.');
    makeReceivedInline(dialog);
  }

  function patchSavedDialog(dialog) {
    if (!dialog) return;
    const strong = dialog.querySelector('strong');
    if (strong && /Ámpulas on this device/i.test(clean(strong.textContent))) {
      setEyebrow(strong, 'SAVED');
      setText(strong, 'Saved shares');
    }
    const list = dialog.querySelector('#ampulaSavedList');
    for (const node of list?.children || []) {
      if (/No saved Ámpulas yet/i.test(clean(node.textContent))) setText(node, 'No saved shares yet.');
    }
  }

  function patch(root = document) {
    const share = root.querySelector?.('#winampShareDialog') || document.getElementById('winampShareDialog');
    const received = root.querySelector?.('#ampulaReceivedDialog') || document.getElementById('ampulaReceivedDialog');
    const saved = root.querySelector?.('#ampulaSavedDialog') || document.getElementById('ampulaSavedDialog');
    patchShareDialog(share);
    patchReceivedDialog(received);
    patchSavedDialog(saved);
  }

  // Sharing is an action, not a modal. Receiving is content, not a modal.
  const dialogProto = window.HTMLDialogElement?.prototype;
  const nativeShowModal = dialogProto?.showModal;
  const nativeShow = dialogProto?.show;
  if (dialogProto && typeof nativeShowModal === 'function' && !dialogProto.__ampDialogless165) {
    Object.defineProperty(dialogProto, '__ampDialogless165', { value: true });
    dialogProto.showModal = function (...args) {
      if (this.id === 'winampShareDialog') {
        patchShareDialog(this);
        return;
      }
      if (this.id === 'ampulaReceivedDialog') {
        patchReceivedDialog(this);
        if (!this.open) {
          try {
            if (typeof nativeShow === 'function') nativeShow.call(this);
            else this.setAttribute('open', '');
          } catch {
            this.setAttribute?.('open', '');
          }
        }
        return;
      }
      return nativeShowModal.apply(this, args);
    };
  }

  if (STATUS) {
    let lastObserved = '';
    const copyOnStatus = () => {
      const value = clean(STATUS.textContent);
      if (!value || value === lastObserved) return;
      lastObserved = value;
      if (value === 'ÁMPULA LINK READY') void copyCurrentShareLink('canonical');
      else if (value === 'SHORT LINK READY') void copyCurrentShareLink('short');
    };
    new MutationObserver(copyOnStatus).observe(STATUS, { childList: true, characterData: true, subtree: true });
    copyOnStatus();
  }

  patch();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes || []) {
        if (!(node instanceof Element)) continue;
        if (
          node.matches?.('#winampShareDialog,#ampulaReceivedDialog,#ampulaSavedDialog') ||
          node.querySelector?.('#winampShareDialog,#ampulaReceivedDialog,#ampulaSavedDialog')
        ) {
          queueMicrotask(() => patch(node.parentElement || document));
          return;
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.ampMusicDialoglessSharing165 = {
    copyCurrentShareLink,
    makeReceivedInline,
    restoreLocalLibrary,
  };
  console.info('[AMPULAMP] dialogless short-link-first sharing 1.6.5 ready');
})();
