(() => {
  'use strict';

  const EXPANDED_KEY = 'ampula.eq.expanded.v1';
  const BANDS_KEY = 'ampula.eq.bands.v1';
  const DEFAULT_NOTE = 'EQ is visual only for this source — provider audio cannot be filtered here.';

  const toggle = document.getElementById('eqToggle');
  const panel = document.getElementById('equalizerPanel');
  const note = document.getElementById('eqCapabilityNote');
  if (!toggle || !panel || !note) return;

  const sliders = [...panel.querySelectorAll('[data-eq-band]')];

  const readJson = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };

  const readExpanded = () => {
    try { return localStorage.getItem(EXPANDED_KEY) === '1'; } catch { return false; }
  };

  const writeExpanded = (expanded) => {
    try { localStorage.setItem(EXPANDED_KEY, expanded ? '1' : '0'); } catch {}
  };

  const updateExpanded = (expanded) => {
    panel.hidden = !expanded;
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.classList.toggle('active', expanded);
    toggle.textContent = expanded ? 'EQ ▲' : 'EQ ▼';
    writeExpanded(expanded);
  };

  const savedBands = readJson(BANDS_KEY, {});
  sliders.forEach((slider) => {
    const band = slider.dataset.eqBand;
    const valueLabel = slider.closest('.eq-band')?.querySelector('.eq-value');
    if (band && Object.prototype.hasOwnProperty.call(savedBands, band)) slider.value = String(savedBands[band]);
    if (valueLabel) valueLabel.textContent = `${Number(slider.value) > 0 ? '+' : ''}${slider.value}`;
    slider.addEventListener('input', () => {
      const state = readJson(BANDS_KEY, {});
      state[band] = Number(slider.value);
      writeJson(BANDS_KEY, state);
      if (valueLabel) valueLabel.textContent = `${Number(slider.value) > 0 ? '+' : ''}${slider.value}`;
    });
  });

  toggle.addEventListener('click', () => updateExpanded(panel.hidden));

  const setCapability = ({ canFilter = false, label = '' } = {}) => {
    panel.dataset.eqCapability = canFilter ? 'filterable' : 'visual-only';
    note.textContent = label || (canFilter
      ? 'EQ processing is available for this playback source.'
      : DEFAULT_NOTE);
    note.classList.toggle('eq-capability-live', Boolean(canFilter));
  };

  window.ampulaEqualizer = Object.freeze({ setCapability });
  setCapability({ canFilter: false });
  updateExpanded(readExpanded());
})();
