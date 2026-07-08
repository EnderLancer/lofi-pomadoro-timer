/**
 * settings.js — All user preferences, persisted to localStorage
 *
 * Single source of truth for configuration. Other modules receive
 * a reference to this object and react to 'change' events.
 */

const KEY = 'lofipomo_settings';

const DEFAULTS = {
  focusMins:          25,
  shortMins:          5,
  longMins:           15,
  longBreakInterval:  4,
  autoAdvance:        false,
  focusOnlyMusic:     false,
  ambientOnBreak:     false,
  audioMode:          'radio',   // 'radio' | 'ambient' | 'both'
  radioVolume:        70,        // 0–100
  ambientMasterVol:   50,        // 0–100
  chimeVolume:        60,        // 0–100
  theme:              'picnic',
  currentStation:     0,
  ambientTrackVols:   {},        // { [trackId]: 0-100 }
  customStations:     [],        // [{ id, name, genre, streamUrl, ytVideoId }]
};

export class Settings extends EventTarget {
  #data = { ...DEFAULTS };

  constructor() {
    super();
    this.#load();
  }

  // ── Property accessors ──────────────────────────────────────

  get focusMins()         { return this.#data.focusMins; }
  get shortMins()         { return this.#data.shortMins; }
  get longMins()          { return this.#data.longMins; }
  get longBreakInterval() { return this.#data.longBreakInterval; }
  get autoAdvance()       { return this.#data.autoAdvance; }
  get focusOnlyMusic()    { return this.#data.focusOnlyMusic; }
  get ambientOnBreak()    { return this.#data.ambientOnBreak; }
  get audioMode()         { return this.#data.audioMode; }
  get radioVolume()       { return this.#data.radioVolume; }
  get ambientMasterVol()  { return this.#data.ambientMasterVol; }
  get chimeVolume()       { return this.#data.chimeVolume; }
  get theme()             { return this.#data.theme; }
  get currentStation()    { return this.#data.currentStation; }
  get ambientTrackVols()  { return this.#data.ambientTrackVols; }
  get customStations()    { return this.#data.customStations; }

  /**
   * Update one or many settings at once.
   * @param {Partial<typeof DEFAULTS>} patch
   */
  set(patch) {
    const changed = {};
    for (const [k, v] of Object.entries(patch)) {
      if (k in DEFAULTS && this.#data[k] !== v) {
        this.#data[k] = v;
        changed[k] = v;
      }
    }
    if (Object.keys(changed).length > 0) {
      this.#save();
      this.#emit('change', changed);
    }
  }

  setAmbientTrackVol(id, vol) {
    const vols = { ...this.#data.ambientTrackVols, [id]: vol };
    this.set({ ambientTrackVols: vols });
  }

  addCustomStation(station) {
    const list = [...this.#data.customStations, station];
    this.#data.customStations = list;
    this.#save();
    this.#emit('change', { customStations: list });
  }

  removeCustomStation(id) {
    const list = this.#data.customStations.filter(s => s.id !== id);
    this.#data.customStations = list;
    this.#save();
    this.#emit('change', { customStations: list });
  }

  reset() {
    this.#data = { ...DEFAULTS };
    this.#save();
    this.#emit('reset', { ...DEFAULTS });
  }

  snapshot() {
    return { ...this.#data };
  }

  // ── Private ─────────────────────────────────────────────────

  #load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Merge: only known keys, keep defaults for missing ones
        for (const k of Object.keys(DEFAULTS)) {
          if (k in parsed) this.#data[k] = parsed[k];
        }
      }
    } catch {
      // ignore corrupt data
    }
  }

  #save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.#data));
    } catch {
      // ignore quota errors
    }
  }

  #emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
