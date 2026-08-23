const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const memory = document.getElementById('memory');
const errorBox = document.getElementById('error');
const capturedAt = document.getElementById('capturedAt');
const title = document.getElementById('title');
const note = document.getElementById('note');
const tracks = document.getElementById('tracks');
const openAnother = document.getElementById('openAnother');

function validateAmpula(value) {
  if (!value || typeof value !== 'object') throw new Error('Файл не содержит объект Ámpula.');
  if (value.format !== 'ampula') throw new Error('Неизвестный формат: ожидался format = "ampula".');
  if (value.version !== '0.1') throw new Error(`Эта версия viewer пока не понимает Ámpula ${value.version ?? 'без версии'}.`);
  if (!value.capturedAt || Number.isNaN(Date.parse(value.capturedAt))) throw new Error('Не указано корректное время capturedAt.');
  if (!Array.isArray(value.tracks) || value.tracks.length === 0) throw new Error('В Ámpula нет треков.');

  value.tracks.forEach((track, index) => {
    if (!track?.title || !Array.isArray(track.artists) || track.artists.length === 0) {
      throw new Error(`Трек ${index + 1}: нужны title и хотя бы один artist.`);
    }
  });
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return '';
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function describeObservations(observations = []) {
  if (!observations.length) return '';
  return observations.map(obs => {
    const when = obs.observedAt ? new Date(obs.observedAt).toLocaleDateString() : 'дата неизвестна';
    return `${obs.service}: был найден ${when}${obs.representation ? ` · ${obs.representation}` : ''}`;
  }).join(' · ');
}

function renderAmpula(ampula) {
  capturedAt.textContent = `Запечатано: ${new Date(ampula.capturedAt).toLocaleString()}`;
  title.textContent = ampula.moment?.title || 'Без названия';
  note.textContent = ampula.moment?.note || '';
  note.hidden = !ampula.moment?.note;
  tracks.replaceChildren();

  ampula.tracks.forEach(track => {
    const li = document.createElement('li');

    const main = document.createElement('div');
    const duration = formatDuration(track.durationMs);
    main.textContent = `${track.title}${duration ? ` · ${duration}` : ''}`;

    const artist = document.createElement('div');
    artist.className = 'artist';
    artist.textContent = track.artists.join(', ');

    li.append(main, artist);

    if (track.cue?.startMs != null) {
      const cue = document.createElement('div');
      cue.className = 'cue';
      cue.textContent = `Момент: ${formatDuration(track.cue.startMs)}${track.cue.endMs != null ? `–${formatDuration(track.cue.endMs)}` : ''}`;
      li.append(cue);
    }

    const traceText = describeObservations(track.observations);
    if (traceText) {
      const trace = document.createElement('div');
      trace.className = 'trace';
      trace.textContent = traceText;
      li.append(trace);
    }

    tracks.append(li);
  });

  dropZone.hidden = true;
  memory.hidden = false;
}

async function openFile(file) {
  errorBox.textContent = '';
  try {
    const text = await file.text();
    const ampula = JSON.parse(text);
    validateAmpula(ampula);
    renderAmpula(ampula);
  } catch (error) {
    errorBox.textContent = `Не удалось открыть Ámpula: ${error.message}`;
  }
}

fileInput.addEventListener('change', () => {
  if (fileInput.files?.[0]) openFile(fileInput.files[0]);
});

['dragenter', 'dragover'].forEach(type => dropZone.addEventListener(type, event => {
  event.preventDefault();
}));

dropZone.addEventListener('drop', event => {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (file) openFile(file);
});

openAnother.addEventListener('click', () => {
  fileInput.value = '';
  memory.hidden = true;
  dropZone.hidden = false;
});
