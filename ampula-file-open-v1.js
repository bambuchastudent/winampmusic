(() => {
  'use strict';
  if (window.__AMPULA_FILE_OPEN_V1__) return;
  window.__AMPULA_FILE_OPEN_V1__ = true;

  const STATUS = document.getElementById('status');
  const setStatus = (text) => { if (STATUS) STATUS.textContent = text; };

  function shareApi() {
    const api = window.winampMusicCompactShare;
    if (!api || typeof api.encode !== 'function' || typeof api.load !== 'function') {
      throw new Error('Ámpula core module is unavailable');
    }
    return api;
  }

  async function openObject(value) {
    const ampula = typeof value === 'string' ? JSON.parse(value) : value;
    const api = shareApi();
    const encoded = await api.encode(ampula);
    const url = new URL(location.href);
    for (const key of ['a', 'al', 'p', 's', 'playlist']) url.searchParams.delete(key);
    url.searchParams.set('a', encoded);
    url.hash = '';
    history.pushState({}, '', url);
    await api.load();
    setStatus('ÁMPULA FILE OPENED');
    return ampula;
  }

  async function openFile(file) {
    if (!file || typeof file.text !== 'function') throw new Error('No Ámpula file selected');
    setStatus('OPENING .AMPULA');
    try {
      return await openObject(await file.text());
    } catch (error) {
      console.warn('[AMPULAMP .ampula]', error);
      setStatus('INVALID OR UNSUPPORTED .AMPULA');
      throw error;
    }
  }

  window.ampulaFileOpen = { openFile, openObject };
})();
