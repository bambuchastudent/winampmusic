(() => {
  'use strict';
  if (window.__AMP_MUSIC_SHARE_UI_CLEANUP_161__) return;
  window.__AMP_MUSIC_SHARE_UI_CLEANUP_161__ = true;

  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  function setText(node, value) {
    if (node && clean(node.textContent) !== value) node.textContent = value;
  }

  function setEyebrow(strong, value) {
    const box = strong?.parentElement;
    const eyebrow = box?.querySelector('div');
    if (eyebrow) setText(eyebrow, value);
  }

  function patchShareDialog(dialog) {
    if (!dialog) return;
    const heading = dialog.querySelector('#winampShareHeading');
    setEyebrow(heading, 'SHARE');
    setText(heading, 'Share music');

    dialog.querySelector('#winampShareFile')?.remove();
    dialog.querySelector('#winampShareSaved')?.remove();

    const note = dialog.querySelector('#winampShareNote');
    const rewriteNote = () => {
      const count = Number(dialog.dataset.count || 0);
      const value = count > 0
        ? `${count} tracks · share by link or scan the QR code`
        : 'Share by link or scan the QR code';
      setText(note, value);
    };
    rewriteNote();
    if (note && note.dataset.shareUiCleanup161 !== '1') {
      note.dataset.shareUiCleanup161 = '1';
      new MutationObserver(rewriteNote).observe(note, { childList: true, characterData: true, subtree: true });
    }

    const oldSystem = dialog.querySelector('#winampShareSystem');
    if (oldSystem && oldSystem.dataset.shareUiCleanup161 !== '1') {
      const system = oldSystem.cloneNode(true);
      system.dataset.shareUiCleanup161 = '1';
      system.textContent = 'Share';
      system.hidden = !navigator.share;
      oldSystem.replaceWith(system);
      system.addEventListener('click', async () => {
        const input = dialog.querySelector('#winampShareUrl');
        const url = clean(input?.value);
        if (!url || !navigator.share) return;
        try {
          await navigator.share({ title: 'Shared music', text: 'Listen to this playlist', url });
        } catch {}
      });
    }
  }

  function patchReceivedDialog(dialog) {
    if (!dialog) return;
    const title = dialog.querySelector('#ampulaReceivedTitle');
    setEyebrow(title, 'SHARED MUSIC');
    setText(title, 'Shared music');
    setText(dialog.querySelector('#ampulaSave'), 'Save');
    setText(dialog.querySelector('#ampulaAdd'), 'Add to library');
    dialog.querySelector('#ampulaFile')?.remove();

    for (const node of dialog.querySelectorAll('div')) {
      if (/Opening this Ámpula does not change Your library/i.test(clean(node.textContent))) {
        setText(node, 'Opening this link does not change your library.');
        break;
      }
    }
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

  console.info('[AMPULAMP] compact Share UI cleanup 1.6.1 ready');
})();
