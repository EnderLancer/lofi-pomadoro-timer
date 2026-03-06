/**
 * ambient.js — Web Audio API ambient sound mixer
 *
 * Each track loops seamlessly using AudioBufferSourceNode.
 * Tracks can use local files (assets/sounds/) or remote URLs.
 * Per-track volume + master volume, individual on/off.
 */

export const AMBIENT_TRACKS = [
  {
    id:    'rain',
    name:  'Rain',
    icon:  '\uD83C\uDF27',  // 🌧
    src:   'assets/sounds/rain.mp3',
    fallbackSrc: 'https://assets.mixkit.co/sfx/preview/mixkit-light-rain-loop-2393.mp3',
    defaultVol: 0.5,
  },
  {
    id:    'cafe',
    name:  'Café',
    icon:  '\u2615',         // ☕
    src:   'assets/sounds/cafe.mp3',
    fallbackSrc: 'https://assets.mixkit.co/sfx/preview/mixkit-restaurant-crowd-talking-ambience-444.mp3',
    defaultVol: 0.35,
  },
  {
    id:    'forest',
    name:  'Forest',
    icon:  '\uD83C\uDF3F',  // 🌿
    src:   'assets/sounds/forest.mp3',
    fallbackSrc: 'https://assets.mixkit.co/sfx/preview/mixkit-forest-birds-ambience-1210.mp3',
    defaultVol: 0.4,
  },
  {
    id:    'fire',
    name:  'Fireplace',
    icon:  '\uD83D\uDD25',  // 🔥
    src:   'assets/sounds/fire.mp3',
    fallbackSrc: 'https://assets.mixkit.co/sfx/preview/mixkit-fireplace-crackling-1326.mp3',
    defaultVol: 0.4,
  },
];

class AmbientTrack {
  #ctx;
  #gainNode;
  #masterGain;
  #sourceNode  = null;
  #buffer      = null;
  #active      = false;
  #volume;
  #loaded      = false;
  #loading     = false;
  #triedFallback = false;

  constructor(ctx, masterGain, trackDef) {
    this.#ctx        = ctx;
    this.#masterGain = masterGain;
    this.#volume     = trackDef.defaultVol;
    this.def         = trackDef;

    this.#gainNode = ctx.createGain();
    this.#gainNode.gain.value = this.#volume;
    this.#gainNode.connect(masterGain);
  }

  get active()  { return this.#active; }
  get volume()  { return this.#volume; }
  get loaded()  { return this.#loaded; }

  async toggle() {
    if (this.#active) {
      this.stop();
    } else {
      await this.start();
    }
    return this.#active;
  }

  async start() {
    if (this.#active) return;
    this.#active = true;
    if (!this.#loaded) await this.#load();
    if (this.#buffer) this.#startSource();
  }

  stop() {
    this.#active = false;
    if (this.#sourceNode) {
      try { this.#sourceNode.stop(); } catch (_) {}
      this.#sourceNode.disconnect();
      this.#sourceNode = null;
    }
  }

  setVolume(v) {
    this.#volume = Math.max(0, Math.min(1, v));
    this.#gainNode.gain.setTargetAtTime(this.#volume, this.#ctx.currentTime, 0.05);
  }

  // ── Private ────────────────────────────────────────────────

  async #load() {
    if (this.#loading) return;
    this.#loading = true;
    try {
      await this.#fetchAndDecode(this.def.src);
    } catch {
      if (!this.#triedFallback && this.def.fallbackSrc) {
        this.#triedFallback = true;
        try {
          await this.#fetchAndDecode(this.def.fallbackSrc);
        } catch {
          console.warn(`[Ambient] Could not load ${this.def.name}`);
        }
      }
    }
    this.#loading = false;
  }

  async #fetchAndDecode(url) {
    const resp   = await fetch(url);
    const ab     = await resp.arrayBuffer();
    this.#buffer = await this.#ctx.decodeAudioData(ab);
    this.#loaded = true;
  }

  #startSource() {
    this.#sourceNode             = this.#ctx.createBufferSource();
    this.#sourceNode.buffer      = this.#buffer;
    this.#sourceNode.loop        = true;
    this.#sourceNode.connect(this.#gainNode);
    this.#sourceNode.start();

    // Re-start if it ever ends unexpectedly (shouldn't with loop, but guard)
    this.#sourceNode.onended = () => {
      if (this.#active) this.#startSource();
    };
  }
}

export class AmbientMixer extends EventTarget {
  #ctx          = null;
  #masterGain   = null;
  #tracks       = [];
  #masterVol    = 0.5;
  #muted        = false;

  init() {
    if (this.#ctx) return;
    this.#ctx        = new (window.AudioContext || window.webkitAudioContext)();
    this.#masterGain = this.#ctx.createGain();
    this.#masterGain.gain.value = this.#masterVol;
    this.#masterGain.connect(this.#ctx.destination);

    this.#tracks = AMBIENT_TRACKS.map(def => new AmbientTrack(this.#ctx, this.#masterGain, def));
    this.#emit('ready', { tracks: AMBIENT_TRACKS });
  }

  /** Must be called inside a user gesture to resume suspended AudioContext */
  resume() {
    if (this.#ctx && this.#ctx.state === 'suspended') {
      this.#ctx.resume();
    }
  }

  async toggleTrack(id) {
    this.#ensureInit();
    this.resume();
    const track = this.#findTrack(id);
    if (!track) return;
    const nowActive = await track.toggle();
    this.#emit('trackchange', { id, active: nowActive });
    return nowActive;
  }

  setTrackVolume(id, v) {
    const track = this.#findTrack(id);
    if (track) track.setVolume(v);
  }

  setMasterVolume(v) {
    this.#masterVol = Math.max(0, Math.min(1, v));
    if (this.#masterGain) {
      this.#masterGain.gain.setTargetAtTime(
        this.#muted ? 0 : this.#masterVol,
        this.#ctx.currentTime,
        0.05
      );
    }
  }

  mute()        { this.#muted = true;  this.#applyMasterGain(); }
  unmute()      { this.#muted = false; this.#applyMasterGain(); }
  toggleMute()  { this.#muted ? this.unmute() : this.mute(); }

  trackState(id) {
    const t = this.#findTrack(id);
    return t ? { active: t.active, volume: t.volume } : null;
  }

  // ── Private ────────────────────────────────────────────────

  #ensureInit() {
    if (!this.#ctx) this.init();
  }

  #findTrack(id) {
    return this.#tracks.find(t => t.def.id === id) || null;
  }

  #applyMasterGain() {
    if (!this.#masterGain) return;
    this.#masterGain.gain.setTargetAtTime(
      this.#muted ? 0 : this.#masterVol,
      this.#ctx.currentTime,
      0.05
    );
  }

  #emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
