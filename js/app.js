/**
 * app.js — Entry point. Wires all modules together.
 *
 * Responsibilities:
 *  - Instantiate all modules
 *  - Bind DOM events → module methods
 *  - Subscribe to module events → update DOM
 *  - Keyboard shortcuts
 *  - Sync settings UI ↔ settings object
 */

import { Timer, TimerMode }           from './timer.js';
import { Radio, STATIONS }            from './radio.js';
import { AmbientMixer, AMBIENT_TRACKS } from './ambient.js';
import { Chime }                       from './chime.js';
import { Settings }                    from './settings.js';
import { TaskTracker, renderTaskLog }  from './tasks.js';
import { SessionCounter, renderSessionDots } from './sessions.js';
import { ThemeManager }                from './themes.js';

// ── Instantiate modules ─────────────────────────────────────────

const settings = new Settings();
const timer    = new Timer(settings);
const radio    = new Radio();
const ambient  = new AmbientMixer();
const chime    = new Chime();
const tasks    = new TaskTracker();
const sessions = new SessionCounter();
const themes   = new ThemeManager();

// ── DOM refs ─────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

const timerFaceEl    = $('timer-face');
const timerDigitsEl  = $('timer-digits');
const timerLabelEl   = $('timer-phase-label');
const ringProgressEl = $('ring-progress');
const btnStart       = $('btn-start');
const btnReset       = $('btn-reset');
const btnSkip        = $('btn-skip');
const modeTabs       = document.querySelectorAll('.mode-tab');
const sessionDotsEl  = $('session-dots');
const taskInputEl    = $('task-input');
const flashOverlay   = $('flash-overlay');

const stationListEl  = $('station-list');
const btnPlayRadio   = $('btn-play-radio');
const btnPrevStation = $('btn-prev-station');
const btnNextStation = $('btn-next-station');
const radioVolumeEl  = $('radio-volume');
const radioVolumeVal = $('radio-volume-value');
const streamStatusEl = $('stream-status');
const ytIframeEl     = $('yt-iframe');

const ambientTracksEl    = $('ambient-tracks');
const ambientMasterEl    = $('ambient-master-volume');
const ambientMasterVal   = $('ambient-master-value');

const audioModeBtns  = document.querySelectorAll('.seg-btn[data-audio-mode]');
const radioPanel     = $('radio-panel');
const ambientPanel   = $('ambient-panel');
const focusOnlyEl        = $('focus-only-toggle');
const ambientOnBreakEl   = $('ambient-on-break-toggle');

const taskLogEl      = $('task-log');
const taskLogEmpty   = $('task-log-empty');
const btnClearLog    = $('btn-clear-log');

const settingsPanel  = $('settings-panel');
const settingsBack   = $('settings-backdrop');
const btnOpenSettings= $('btn-settings');
const btnCloseSettings= $('btn-close-settings');
const btnResetSettings= $('btn-reset-settings');

const sThemeEl       = $('s-theme');

// ── Init ────────────────────────────────────────────────────────

function init() {
  // Apply saved theme
  themes.apply(settings.theme);
  sThemeEl.value = settings.theme;

  // Sync settings panel inputs with saved values
  syncSettingsPanel();

  // Apply saved chime volume
  chime.setVolume(settings.chimeVolume / 100);

  // Radio
  radio.init(ytIframeEl);
  radio.setVolume(settings.radioVolume / 100);
  radio.addEventListener('ready', () => {
    renderStations();
  });
  radio.dispatchEvent(new CustomEvent('ready', { detail: {} })); // trigger render

  // Ambient
  ambient.addEventListener('ready', () => renderAmbientTracks());
  ambient.init();
  ambient.setMasterVolume(settings.ambientMasterVol / 100);

  // Audio mode
  applyAudioMode(settings.audioMode);

  // Focus-only / ambient-on-break toggles
  focusOnlyEl.checked      = settings.focusOnlyMusic;
  ambientOnBreakEl.checked = settings.ambientOnBreak;

  // Timer initial render
  renderTimerTick({
    mode:      timer.mode,
    remaining: timer.remaining,
    total:     timer.totalSecs,
    progress:  timer.progress,
    running:   timer.running,
    dashOffset: 2 * Math.PI * 96,  // full circle = 0 progress
  });
  updateModeTab(timer.mode);

  // Session dots
  renderSessionDots(sessionDotsEl, sessions.setCount, settings.longBreakInterval);

  // Task log
  refreshTaskLog();

  // Restore radio station selection
  radio.selectStation(settings.currentStation);

  // Init ambient volumes from settings
  for (const [id, vol] of Object.entries(settings.ambientTrackVols)) {
    ambient.setTrackVolume(id, vol / 100);
  }

  // Set slider fill
  setSliderFill(radioVolumeEl, settings.radioVolume);
  setSliderFill(ambientMasterEl, settings.ambientMasterVol);
}

// ── Timer events ─────────────────────────────────────────────────

timer.addEventListener('tick', e => renderTimerTick(e.detail));

timer.addEventListener('start', e => {
  btnStart.textContent = 'Pause';
  timerFaceEl.classList.add('running');
  handleFocusOnlyMusic();
});

timer.addEventListener('pause', () => {
  btnStart.textContent = 'Start';
  timerFaceEl.classList.remove('running');
});

timer.addEventListener('reset', () => {
  btnStart.textContent = 'Start';
  timerFaceEl.classList.remove('running');
});

timer.addEventListener('modechange', e => {
  updateModeTab(e.detail.mode);
  handleFocusOnlyMusic();
});

timer.addEventListener('countdown', e => {
  chime.countdown(e.detail.remaining);
});

timer.addEventListener('complete', e => {
  const { mode, sessionsDone } = e.detail;

  chime.ring(timerFaceEl, flashOverlay);

  if (mode === TimerMode.FOCUS) {
    sessions.increment();
    tasks.addEntry({
      task:         taskInputEl.value.trim(),
      mode:         'focus',
      durationSecs: settings.focusMins * 60,
    });
    taskInputEl.value = '';

    // Reset dots after long break interval
    if (sessionsDone % settings.longBreakInterval === 0) {
      sessions.resetSet();
    }
  }

  renderSessionDots(sessionDotsEl, sessions.setCount, settings.longBreakInterval);
});

// ── Timer DOM bindings ────────────────────────────────────────────

btnStart.addEventListener('click', () => { ambient.resume(); timer.toggle(); });
btnReset.addEventListener('click', () => timer.reset());
btnSkip.addEventListener('click',  () => timer.skip());

modeTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const mode = tab.dataset.mode;
    timer.setMode(mode === 'focus' ? TimerMode.FOCUS : mode === 'short' ? TimerMode.SHORT : TimerMode.LONG);
    updateModeTab(mode);
  });
});

// ── Radio events ──────────────────────────────────────────────────

radio.addEventListener('playstate', e => {
  btnPlayRadio.textContent = e.detail.playing ? '⏸' : '▶';
  btnPlayRadio.classList.toggle('playing', e.detail.playing);
  updateStationStreaming(e.detail.playing);
});

radio.addEventListener('stationchange', e => {
  settings.set({ currentStation: e.detail.idx });
  highlightStation(e.detail.idx);
  updateStationStreaming(radio.playing);
});

radio.addEventListener('status', e => {
  streamStatusEl.textContent = e.detail.text;
});

// ── Radio DOM bindings ────────────────────────────────────────────

btnPlayRadio.addEventListener('click', () => { ambient.resume(); radio.toggle(); });
btnPrevStation.addEventListener('click', () => radio.prev());
btnNextStation.addEventListener('click', () => radio.next());

radioVolumeEl.addEventListener('input', () => {
  const v = +radioVolumeEl.value;
  radio.setVolume(v / 100);
  radioVolumeVal.textContent = v + '%';
  setSliderFill(radioVolumeEl, v);
  settings.set({ radioVolume: v });
});

// ── Ambient DOM bindings ──────────────────────────────────────────

ambientMasterEl.addEventListener('input', () => {
  const v = +ambientMasterEl.value;
  ambient.setMasterVolume(v / 100);
  ambientMasterVal.textContent = v + '%';
  setSliderFill(ambientMasterEl, v);
  settings.set({ ambientMasterVol: v });
});

// ── Audio mode ────────────────────────────────────────────────────

audioModeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.audioMode;
    applyAudioMode(mode);
    settings.set({ audioMode: mode });
  });
});

focusOnlyEl.addEventListener('change', () => {
  settings.set({ focusOnlyMusic: focusOnlyEl.checked });
  handleFocusOnlyMusic();
});

ambientOnBreakEl.addEventListener('change', () => {
  settings.set({ ambientOnBreak: ambientOnBreakEl.checked });
  handleFocusOnlyMusic();
});

// ── Task log ──────────────────────────────────────────────────────

tasks.addEventListener('add',    () => refreshTaskLog());
tasks.addEventListener('delete', () => refreshTaskLog());
tasks.addEventListener('clear',  () => refreshTaskLog());

btnClearLog.addEventListener('click', () => {
  if (confirm('Clear all session history?')) tasks.clearAll();
});

// ── Sessions ──────────────────────────────────────────────────────

sessions.addEventListener('update', e => {
  renderSessionDots(sessionDotsEl, e.detail.setCount, settings.longBreakInterval);
});

// ── Settings panel ────────────────────────────────────────────────

btnOpenSettings.addEventListener('click',  openSettings);
btnCloseSettings.addEventListener('click', closeSettings);
settingsBack.addEventListener('click',     closeSettings);

btnResetSettings.addEventListener('click', () => {
  if (confirm('Reset all settings to defaults?')) {
    settings.reset();
    syncSettingsPanel();
    applySettingsToModules();
    themes.apply(settings.theme);
  }
});

// Live-update settings on input
[
  ['s-focus',        v => settings.set({ focusMins:         +v })],
  ['s-short',        v => settings.set({ shortMins:         +v })],
  ['s-long',         v => settings.set({ longMins:          +v })],
  ['s-interval',     v => settings.set({ longBreakInterval: +v })],
].forEach(([id, fn]) => {
  $(id).addEventListener('change', e => {
    fn(e.target.value);
    timer.onSettingsChange();
    renderSessionDots(sessionDotsEl, sessions.setCount, settings.longBreakInterval);
  });
});

$('s-auto-advance').addEventListener('change', e => {
  settings.set({ autoAdvance: e.target.checked });
});

$('s-chime-volume').addEventListener('input', e => {
  const v = +e.target.value;
  chime.setVolume(v / 100);
  $('s-chime-value').textContent = v + '%';
  setSliderFill(e.target, v);
  settings.set({ chimeVolume: v });
});

sThemeEl.addEventListener('change', () => {
  themes.apply(sThemeEl.value);
  settings.set({ theme: sThemeEl.value });
});

$('btn-theme').addEventListener('click', () => {
  const all = themes.list();
  const idx = all.findIndex(t => t.id === settings.theme);
  const next = all[(idx + 1) % all.length];
  themes.apply(next.id);
  settings.set({ theme: next.id });
  sThemeEl.value = next.id;
});

// ── Keyboard shortcuts ────────────────────────────────────────────

document.addEventListener('keydown', e => {
  // Ignore when typing in an input/textarea
  if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;

  switch (e.key) {
    case ' ':
      e.preventDefault();
      ambient.resume();
      timer.toggle();
      break;
    case 'r':
    case 'R':
      timer.reset();
      break;
    case 'm':
    case 'M':
      toggleMuteAll();
      break;
    case '1':
      timer.setMode(TimerMode.FOCUS);
      updateModeTab(TimerMode.FOCUS);
      break;
    case '2':
      timer.setMode(TimerMode.SHORT);
      updateModeTab(TimerMode.SHORT);
      break;
    case '3':
      timer.setMode(TimerMode.LONG);
      updateModeTab(TimerMode.LONG);
      break;
    case 'ArrowLeft':
      radio.prev();
      break;
    case 'ArrowRight':
      radio.next();
      break;
    case ',':
      settingsPanel.classList.contains('open') ? closeSettings() : openSettings();
      break;
  }
});

// ── Render helpers ────────────────────────────────────────────────

function renderTimerTick({ mode, remaining, dashOffset, running }) {
  const m  = String(Math.floor(remaining / 60)).padStart(2, '0');
  const s  = String(remaining % 60).padStart(2, '0');
  timerDigitsEl.textContent = `${m}:${s}`;

  const labels = { focus: 'Focus', short: 'Short Break', long: 'Long Break' };
  timerLabelEl.textContent = labels[mode] || '';

  ringProgressEl.style.strokeDashoffset = dashOffset;

  btnStart.textContent = running ? 'Pause' : 'Start';
  timerFaceEl.classList.toggle('running', running);
  document.documentElement.setAttribute('data-mode', mode);
}

function updateModeTab(mode) {
  modeTabs.forEach(t => {
    const isActive = t.dataset.mode === mode;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  document.documentElement.setAttribute('data-mode', mode);
}

function renderStations() {
  stationListEl.innerHTML = '';
  STATIONS.forEach((s, idx) => {
    const card = document.createElement('div');
    card.className   = 'station-card' + (idx === settings.currentStation ? ' active' : '');
    card.role        = 'option';
    card.dataset.idx = idx;
    card.setAttribute('aria-selected', idx === settings.currentStation ? 'true' : 'false');
    card.innerHTML = `
      <span class="station-dot"></span>
      <span class="station-info">
        <span class="station-name">${escHtml(s.name)}</span>
        <span class="station-genre">${escHtml(s.genre)}</span>
      </span>
      <span class="station-mode-badge">MP3 + YT</span>
    `;
    card.addEventListener('click', () => {
      ambient.resume();
      radio.selectStation(idx);
      if (!radio.playing) radio.play();
    });
    stationListEl.appendChild(card);
  });
}

function highlightStation(idx) {
  document.querySelectorAll('.station-card').forEach((c, i) => {
    c.classList.toggle('active', i === idx);
    c.setAttribute('aria-selected', i === idx ? 'true' : 'false');
  });
}

function updateStationStreaming(isPlaying) {
  document.querySelectorAll('.station-card').forEach((c, i) => {
    if (i === radio.currentIdx) {
      c.classList.toggle('streaming', isPlaying);
    } else {
      c.classList.remove('streaming');
    }
  });
}

function renderAmbientTracks() {
  ambientTracksEl.innerHTML = '';
  AMBIENT_TRACKS.forEach(def => {
    const savedVol = settings.ambientTrackVols[def.id] ?? Math.round(def.defaultVol * 100);
    const div  = document.createElement('div');
    div.className   = 'ambient-track';
    div.role        = 'listitem';
    div.dataset.id  = def.id;
    div.innerHTML = `
      <div class="ambient-track-header">
        <span class="ambient-icon">${def.icon}</span>
        <span class="ambient-name">${escHtml(def.name)}</span>
        <button class="ambient-toggle" aria-label="Toggle ${escHtml(def.name)}" aria-pressed="false">&#9654;</button>
      </div>
      <div class="volume-row">
        <input type="range" class="volume-slider ambient-vol" min="0" max="100"
               value="${savedVol}" aria-label="${escHtml(def.name)} volume" />
      </div>
    `;

    const toggleBtn = div.querySelector('.ambient-toggle');
    const volSlider = div.querySelector('.ambient-vol');

    setSliderFill(volSlider, savedVol);
    ambient.setTrackVolume(def.id, savedVol / 100);

    toggleBtn.addEventListener('click', async () => {
      ambient.resume();
      const nowActive = await ambient.toggleTrack(def.id);
      div.classList.toggle('active', nowActive);
      toggleBtn.innerHTML = nowActive ? '&#9646;&#9646;' : '&#9654;';
      toggleBtn.setAttribute('aria-pressed', nowActive ? 'true' : 'false');
    });

    volSlider.addEventListener('input', () => {
      const v = +volSlider.value;
      ambient.setTrackVolume(def.id, v / 100);
      setSliderFill(volSlider, v);
      settings.setAmbientTrackVol(def.id, v);
    });

    ambientTracksEl.appendChild(div);
  });
}

function applyAudioMode(mode) {
  audioModeBtns.forEach(b => b.classList.toggle('active', b.dataset.audioMode === mode));

  const showRadio   = mode === 'radio'   || mode === 'both';
  const showAmbient = mode === 'ambient' || mode === 'both';
  radioPanel.classList.toggle('hidden', !showRadio);
  ambientPanel.classList.toggle('hidden', !showAmbient);
}

function handleFocusOnlyMusic() {
  const isFocusRunning = timer.mode === TimerMode.FOCUS && timer.running;

  if (settings.focusOnlyMusic) {
    if (isFocusRunning) {
      radio.resumeForFocus();
    } else {
      radio.silenceForBreak();
    }
  }

  if (settings.ambientOnBreak) {
    if (isFocusRunning) {
      ambient.silenceForFocus();
    } else {
      ambient.resumeForBreak();
    }
  } else {
    ambient.resumeForBreak();
  }
}

function refreshTaskLog() {
  renderTaskLog(taskLogEl, taskLogEmpty, tasks.entries, id => {
    tasks.deleteEntry(id);
  });
}

let _muted = false;
function toggleMuteAll() {
  _muted = !_muted;
  radio.toggleMute();
  ambient.toggleMute();
}

function openSettings() {
  settingsPanel.classList.add('open');
  settingsBack.classList.add('open');
  settingsPanel.removeAttribute('aria-hidden');
  btnCloseSettings.focus();
}

function closeSettings() {
  settingsPanel.classList.remove('open');
  settingsBack.classList.remove('open');
  settingsPanel.setAttribute('aria-hidden', 'true');
  btnOpenSettings.focus();
}

function syncSettingsPanel() {
  $('s-focus').value    = settings.focusMins;
  $('s-short').value    = settings.shortMins;
  $('s-long').value     = settings.longMins;
  $('s-interval').value = settings.longBreakInterval;
  $('s-auto-advance').checked = settings.autoAdvance;
  $('s-chime-volume').value   = settings.chimeVolume;
  $('s-chime-value').textContent = settings.chimeVolume + '%';
  setSliderFill($('s-chime-volume'), settings.chimeVolume);
  sThemeEl.value = settings.theme;
}

function applySettingsToModules() {
  timer.onSettingsChange();
  radio.setVolume(settings.radioVolume / 100);
  ambient.setMasterVolume(settings.ambientMasterVol / 100);
  chime.setVolume(settings.chimeVolume / 100);
  focusOnlyEl.checked      = settings.focusOnlyMusic;
  ambientOnBreakEl.checked = settings.ambientOnBreak;
  applyAudioMode(settings.audioMode);
  renderSessionDots(sessionDotsEl, sessions.setCount, settings.longBreakInterval);
}

/** Update CSS gradient fill on a range slider */
function setSliderFill(el, pct) {
  el.style.setProperty('--slider-pct', pct + '%');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Bootstrap ─────────────────────────────────────────────────────

init();
