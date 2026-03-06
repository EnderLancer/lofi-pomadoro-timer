/**
 * ambient.js — YouTube-based ambient sound mixer
 *
 * Each track is a hidden YouTube IFrame player (loop enabled).
 * Multiple tracks play simultaneously with independent volume.
 * Master volume + mute applied by scaling each player's volume.
 *
 * To swap a sound: update the ytVideoId for that track.
 */

export const AMBIENT_TRACKS = [
  {
    id:         'rain',
    name:       'Rain',
    icon:       '\uD83C\uDF27',  // 🌧
    ytVideoId:  'nMfPqeZjc2c',  // Relaxing White Noise — Rain Sounds 8h
    defaultVol: 0.5,
  },
  {
    id:         'cafe',
    name:       'Café',
    icon:       '\u2615',         // ☕
    ytVideoId:  'h2zkV-l_TbY',  // Coffee Shop Ambience
    defaultVol: 0.35,
  },
  {
    id:         'forest',
    name:       'Forest',
    icon:       '\uD83C\uDF3F',  // 🌿
    ytVideoId:  'xNN7iTA57jM',  // Forest Birds & Nature Sounds
    defaultVol: 0.4,
  },
  {
    id:         'fire',
    name:       'Fireplace',
    icon:       '\uD83D\uDD25',  // 🔥
    ytVideoId:  'L_LUpnjgPso',  // Fireplace Crackling 10h
    defaultVol: 0.4,
  },
];

/**
 * Ensure YouTube IFrame API is loaded, then run cb().
 * Chains with any existing onYouTubeIframeAPIReady (e.g. from radio.js)
 * so both modules can coexist without overwriting each other's callback.
 */
function ensureYTApi(cb) {
  if (window.YT && window.YT.Player) {
    cb();
    return;
  }
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    if (typeof prev === 'function') prev();
    cb();
  };
  if (!document.getElementById('yt-api-script')) {
    const s = document.createElement('script');
    s.id  = 'yt-api-script';
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }
}

class AmbientTrack {
  #player        = null;
  #active        = false;
  #pending       = false;  // waiting for API / player ready
  #volume;                 // 0-1 per-track
  #effectiveVol  = 0;      // 0-100 sent to YT player

  constructor(trackDef) {
    this.def     = trackDef;
    this.#volume = trackDef.defaultVol;
  }

  get active() { return this.#active; }
  get volume() { return this.#volume; }

  async toggle() {
    if (this.#active) {
      this.stop();
    } else {
      await this.start();
    }
    return this.#active;
  }

  start() {
    if (this.#active || this.#pending) return Promise.resolve();
    this.#active = true;
    if (this.#player && this.#player.playVideo) {
      this.#player.setVolume(this.#effectiveVol);
      this.#player.playVideo();
    } else {
      this.#pending = true;
      ensureYTApi(() => this.#createPlayer());
    }
    return Promise.resolve();
  }

  stop() {
    this.#active = false;
    if (this.#player && this.#player.pauseVideo) {
      this.#player.pauseVideo();
    }
  }

  /** Pause playback without changing #active (timer pause) */
  suspend() {
    if (this.#player && this.#player.pauseVideo) this.#player.pauseVideo();
  }

  /** Resume playback if track is active (timer resume) */
  unsuspend() {
    if (this.#active && this.#player && this.#player.playVideo) this.#player.playVideo();
  }

  /** Set per-track volume (0-1). Call applyEffectiveVolume() to push to player. */
  setVolume(v) {
    this.#volume = Math.max(0, Math.min(1, v));
  }

  /** Recompute and push volume to the YT player. */
  applyEffectiveVolume(masterVol, muted) {
    this.#effectiveVol = muted ? 0 : Math.round(this.#volume * masterVol * 100);
    if (this.#player && this.#player.setVolume) {
      this.#player.setVolume(this.#effectiveVol);
    }
  }

  // ── Private ────────────────────────────────────────────────

  #createPlayer() {
    const host = document.createElement('div');
    host.id = `yt-ambient-${this.def.id}`;
    document.body.appendChild(host);

    this.#player = new window.YT.Player(host.id, {
      width:  '0',
      height: '0',
      videoId: this.def.ytVideoId,
      playerVars: { autoplay: 1, controls: 0, loop: 1, playlist: this.def.ytVideoId },
      events: {
        onReady: (e) => {
          this.#pending = false;
          e.target.setVolume(this.#effectiveVol);
          if (this.#active) e.target.playVideo();
        },
        onError: () => {
          this.#pending = false;
          this.#active  = false;
          console.warn(`[Ambient] YouTube player error for "${this.def.name}"`);
        },
      },
    });
  }
}

export class AmbientMixer extends EventTarget {
  #tracks    = [];
  #masterVol = 0.5;
  #muted     = false;
  #fadeMult  = 1;     // 0–1 crossfade multiplier applied to masterVol
  #fadeTimer = null;

  init() {
    this.#tracks = AMBIENT_TRACKS.map(def => new AmbientTrack(def));
    this.#emit('ready', { tracks: AMBIENT_TRACKS });
  }

  /** No-op: kept for API compatibility (was AudioContext.resume()) */
  resume() {}

  async toggleTrack(id) {
    const track = this.#findTrack(id);
    if (!track) return;
    const nowActive = await track.toggle();
    this.#applyAllVolumes();
    this.#emit('trackchange', { id, active: nowActive });
    return nowActive;
  }

  setTrackVolume(id, v) {
    const track = this.#findTrack(id);
    if (track) {
      track.setVolume(v);
      this.#applyAllVolumes();
    }
  }

  setMasterVolume(v) {
    this.#masterVol = Math.max(0, Math.min(1, v));
    this.#applyAllVolumes();
  }

  mute()       { this.#muted = true;  this.#applyAllVolumes(); }
  unmute()     { this.#muted = false; this.#applyAllVolumes(); }
  toggleMute() { this.#muted ? this.unmute() : this.mute(); }

  /** Pause all active track players without changing active state (timer pause) */
  pauseAll()  { for (const t of this.#tracks) t.suspend(); }
  /** Resume all active track players (timer resume) */
  resumeAll() { for (const t of this.#tracks) t.unsuspend(); }

  /** Fade ambient out (called when focus session starts) */
  silenceForFocus() { this.#fadeTo(0); }
  /** Fade ambient back in (called when a break starts) */
  resumeForBreak()  { this.#fadeTo(1); }

  trackState(id) {
    const t = this.#findTrack(id);
    return t ? { active: t.active, volume: t.volume } : null;
  }

  // ── Private ────────────────────────────────────────────────

  #findTrack(id) {
    return this.#tracks.find(t => t.def.id === id) || null;
  }

  #fadeTo(target) {
    clearInterval(this.#fadeTimer);
    const start = this.#fadeMult;
    const steps = 30;
    let step = 0;
    this.#fadeTimer = setInterval(() => {
      step++;
      this.#fadeMult = start + (target - start) * (step / steps);
      this.#applyAllVolumes();
      if (step >= steps) {
        clearInterval(this.#fadeTimer);
        this.#fadeMult = target;
        this.#applyAllVolumes();
      }
    }, 1500 / steps);
  }

  #applyAllVolumes() {
    const effective = this.#masterVol * this.#fadeMult;
    for (const t of this.#tracks) {
      t.applyEffectiveVolume(effective, this.#muted);
    }
  }

  #emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
