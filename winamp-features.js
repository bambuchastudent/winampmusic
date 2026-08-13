const WINAMP_FEATURES_KEY = 'winampmusic.features.v1';
const WINAMP_SKIN_KEY = 'winampmusic.skin.v1';

const eqBands = ['preamp', '60', '170', '310', '600', '1k', '3k', '6k', '12k', '14k', '16k'];
const eqPresets = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Rock: [0, 5, 4, 2, 0, -1, 1, 3, 4, 5, 5],
  Pop: [0, -1, 2, 4, 5, 3, 0, -1, -1, 0, 1],
  Bass: [0, 7, 6, 4, 2, 0, -1, -2, -2, -2, -2],
  Vocal: [0, -2, -1, 0, 2, 4, 5, 4, 2, 0, -1],
};

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveFeatures(state) {
  localStorage.setItem(WINAMP_FEATURES_KEY, JSON.stringify(state));
}

function dataUrlFromBase64(base64, mime) {
  return `data:${mime};base64,${base64}`;
}

function applySkin(skin) {
  const root = document.documentElement;
  root.dataset.winampSkin = skin?.kind || 'classic';
  root.style.setProperty('--skin-main-image', skin?.main ? `url("${skin.main}")` : 'none');
  root.style.setProperty('--skin-eq-image', skin?.eq ? `url("${skin.eq}")` : 'none');
  root.style.setProperty('--skin-playlist-image', skin?.playlist ? `url("${skin.playlist}")` : 'none');
  const label = document.getElementById('skinName');
  if (label) label.textContent = skin?.name || 'Classic';
}

async function importWinampSkin(file) {
  if (!window.JSZip) throw new Error('Skin ZIP reader is not available');
  if (!/\.(wsz|zip)$/i.test(file.name)) throw new Error('Choose a .wsz or .zip Winamp skin');
  if (file.size > 8 * 1024 * 1024) throw new Error('Skin archive is too large (8 MB max)');

  const zip = await JSZip.loadAsync(file);
  const files = Object.values(zip.files);
  const find = (name) => files.find((entry) => !entry.dir && entry.name.split('/').pop().toLowerCase() === name);
  const mainEntry = find('main.bmp');
  const eqEntry = find('eqmain.bmp');
  const playlistEntry = find('pledit.bmp');
  if (!mainEntry && !eqEntry && !playlistEntry) throw new Error('No classic Winamp skin bitmaps found');

  const skin = {
    kind: 'wsz',
    name: file.name.replace(/\.(wsz|zip)$/i, ''),
    main: mainEntry ? dataUrlFromBase64(await mainEntry.async('base64'), 'image/bmp') : '',
    eq: eqEntry ? dataUrlFromBase64(await eqEntry.async('base64'), 'image/bmp') : '',
    playlist: playlistEntry ? dataUrlFromBase64(await playlistEntry.async('base64'), 'image/bmp') : '',
  };

  try {
    localStorage.setItem(WINAMP_SKIN_KEY, JSON.stringify(skin));
  } catch {
    throw new Error('Skin is too large to persist in this browser');
  }
  applySkin(skin);
  return skin;
}

function initWinampFeatures() {
  const state = readJson(WINAMP_FEATURES_KEY, {
    eqEnabled: false,
    eqOpen: true,
    values: eqPresets.Flat,
    videoLarge: false,
  });

  const eqPanel = document.getElementById('equalizerPanel');
  const eqToggle = document.getElementById('eqToggle');
  const eqOn = document.getElementById('eqOn');
  const eqPreset = document.getElementById('eqPreset');
  const skinButton = document.getElementById('skinButton');
  const skinFile = document.getElementById('skinFile');
  const resetSkin = document.getElementById('resetSkin');
  const videoMode = document.getElementById('videoModeButton');
  const desktopApp = document.getElementById('desktopAppButton');
  const desktopDialog = document.getElementById('desktopDialog');

  for (const name of Object.keys(eqPresets)) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    eqPreset.appendChild(option);
  }

  const sliders = [...document.querySelectorAll('[data-eq-band]')];
  sliders.forEach((slider, index) => {
    slider.value = state.values?.[index] ?? 0;
    const value = slider.closest('.eq-band')?.querySelector('.eq-value');
    if (value) value.textContent = `${Number(slider.value) > 0 ? '+' : ''}${slider.value}`;
    slider.addEventListener('input', () => {
      const values = sliders.map((item) => Number(item.value));
      state.values = values;
      eqPreset.value = '';
      if (value) value.textContent = `${Number(slider.value) > 0 ? '+' : ''}${slider.value}`;
      saveFeatures(state);
    });
  });

  const syncEqUi = () => {
    eqPanel.hidden = !state.eqOpen;
    eqToggle.classList.toggle('active', state.eqOpen);
    eqOn.classList.toggle('active', state.eqEnabled);
    eqOn.textContent = state.eqEnabled ? 'EQ ON' : 'EQ OFF';
  };

  eqToggle.addEventListener('click', () => {
    state.eqOpen = !state.eqOpen;
    saveFeatures(state);
    syncEqUi();
  });
  eqOn.addEventListener('click', () => {
    state.eqEnabled = !state.eqEnabled;
    saveFeatures(state);
    syncEqUi();
  });
  eqPreset.addEventListener('change', () => {
    const values = eqPresets[eqPreset.value];
    if (!values) return;
    sliders.forEach((slider, index) => {
      slider.value = values[index];
      const value = slider.closest('.eq-band')?.querySelector('.eq-value');
      if (value) value.textContent = `${values[index] > 0 ? '+' : ''}${values[index]}`;
    });
    state.values = values;
    saveFeatures(state);
  });

  skinButton.addEventListener('click', () => skinFile.click());
  skinFile.addEventListener('change', async () => {
    const file = skinFile.files?.[0];
    if (!file) return;
    skinButton.disabled = true;
    skinButton.textContent = 'Loading…';
    try {
      const skin = await importWinampSkin(file);
      skinButton.textContent = `Skin: ${skin.name}`;
    } catch (error) {
      alert(`Winamp skin: ${error.message}`);
      skinButton.textContent = 'Load .WSZ skin';
    } finally {
      skinButton.disabled = false;
      skinFile.value = '';
    }
  });
  resetSkin.addEventListener('click', () => {
    localStorage.removeItem(WINAMP_SKIN_KEY);
    applySkin({ kind: 'classic', name: 'Classic' });
    skinButton.textContent = 'Load .WSZ skin';
  });

  videoMode.addEventListener('click', () => {
    state.videoLarge = !state.videoLarge;
    document.body.classList.toggle('video-large', state.videoLarge);
    videoMode.classList.toggle('active', state.videoLarge);
    videoMode.textContent = state.videoLarge ? 'Compact video' : 'Large video';
    saveFeatures(state);
  });

  desktopApp.addEventListener('click', () => desktopDialog.showModal());

  document.body.classList.toggle('video-large', state.videoLarge);
  videoMode.classList.toggle('active', state.videoLarge);
  videoMode.textContent = state.videoLarge ? 'Compact video' : 'Large video';
  applySkin(readJson(WINAMP_SKIN_KEY, { kind: 'classic', name: 'Classic' }));
  syncEqUi();
}

window.addEventListener('DOMContentLoaded', initWinampFeatures);
