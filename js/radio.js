/**
 * radio.js — Internet radio with direct stream + YouTube iframe fallback
 *
 * Each station declares:
 *  - streamUrl: direct MP3/AAC stream (tried first)
 *  - ytVideoId:  YouTube video ID used as iframe fallback
 */

export const STATIONS = [
  {
    id:         'lofi-girl',
    name:       'Lofi Girl',
    genre:      'Beats to Relax / Study',
    streamUrl:  'https://play.streamafrica.net/lofiradio',
    ytVideoId:  'jfKfPfyJRdk',
  },
  {
    id:         'chillhop',
    name:       'Chillhop Radio',
    genre:      'Chillhop / Jazz',
    streamUrl:  'https://streams.fluxfm.de/Chillhop/mp3-128/stream.mp3',
    ytVideoId:  '5yx6BWlEVcY',
  },
  {
    id:         'box-lofi',
    name:       'Box Lofi',
    genre:      'LoFi / Ambient',
    streamUrl:  'https://streams.fluxfm.de/lofi/mp3-128/stream.mp3',
    ytVideoId:  'DWcJFNfaw9c',
  },
];

export class Radio extends EventTarget {
  #audio         = new Audio();
  #currentIdx    = 0;
  #playing       = false;
  #volume        = 0.7;
  #useYT         = false;    // whether current station is on YT fallback
  #ytIframe      = null;
  #ytPlayer      = null;     // YT.Player instance (if API loaded)
  #streamFailing  = false;
  #muted         = false;

  constructor() {
    super();
    this.#audio.crossOrigin = 'anonymous';
    this.#audio.preload     = 'none';

    this.#audio.addEventListener('error',  () => this.#onStreamError());
    this.#audio.addEventListener('playing', () => this.#onStreamPlaying());
    this.#audio.addEventListener('waiting', () => this.#emit('status', { text: 'Buffering…' }));
    this.#audio.addEventListener('stalled', () => this.#onStreamError());
  }

  // ── Public API ──────────────────────────────────────────────

  get playing()     { return this.#playing; }
  get currentIdx()  { return this.#currentIdx; }
  get station()     { return STATIONS[this.#currentIdx]; }
  get volume()      { return this.#volume; }
  get usingYT()     { return this.#useYT; }

  init(ytIframeEl) {
    this.#ytIframe = ytIframeEl;
    this.#renderStations();
  }

  play() {
    this.#playing = true;
    if (this.#useYT) {
      this.#ytPlay();
    } else {
      this.#streamPlay();
    }
    this.#emit('playstate', { playing: true });
  }

  pause() {
    this.#playing = false;
    this.#audio.pause();
    this.#ytPause();
    this.#emit('playstate', { playing: false });
    this.#emit('status', { text: '' });
  }

  toggle() {
    this.#playing ? this.pause() : this.play();
  }

  selectStation(idx) {
    const wasPlaying = this.#playing;
    this.pause();
    this.#streamFailing = false;
    this.#useYT         = false;
    this.#currentIdx    = ((idx % STATIONS.length) + STATIONS.length) % STATIONS.length;
    this.#audio.src     = '';
    this.#emit('stationchange', { idx: this.#currentIdx, station: this.station });
    if (wasPlaying) this.play();
  }

  next() { this.selectStation(this.#currentIdx + 1); }
  prev() { this.selectStation(this.#currentIdx - 1); }

  setVolume(v) {
    this.#volume       = Math.max(0, Math.min(1, v));
    this.#audio.volume = this.#muted ? 0 : this.#volume;
    this.#ytSetVolume(this.#muted ? 0 : Math.round(this.#volume * 100));
  }

  mute()   { this.#muted = true;  this.#applyMute(); }
  unmute() { this.#muted = false; this.#applyMute(); }
  toggleMute() { this.#muted ? this.unmute() : this.mute(); }

  /** Called when focus-only mode activates a silence period */
  silenceForBreak() { if (this.#playing) { this.pause(); this.#emit('silenced', {}); } }
  resumeForFocus()  { if (!this.#playing) { this.play(); } }

  // ── Private: stream ─────────────────────────────────────────

  #streamPlay() {
    const station = this.station;
    this.#emit('status', { text: 'Connecting…' });
    this.#audio.src    = station.streamUrl;
    this.#audio.volume = this.#muted ? 0 : this.#volume;
    this.#audio.play().catch(() => this.#onStreamError());
  }

  #onStreamPlaying() {
    this.#streamFailing = false;
    this.#emit('status', { text: '' });
    this.#emit('streaming', { using: 'stream' });
  }

  #onStreamError() {
    if (!this.#playing) return;
    if (!this.#streamFailing) {
      this.#streamFailing = true;
      this.#emit('status', { text: 'Stream unavailable — trying fallback…' });
      setTimeout(() => {
        if (this.#playing && this.#streamFailing) {
          this.#switchToYT();
        }
      }, 2000);
    }
  }

  // ── Private: YouTube fallback ────────────────────────────────

  #switchToYT() {
    this.#useYT = true;
    this.#audio.pause();
    this.#audio.src = '';
    this.#emit('status', { text: 'Using YouTube fallback' });
    this.#emit('streaming', { using: 'youtube' });

    const videoId = this.station.ytVideoId;
    if (!videoId) {
      this.#emit('status', { text: 'No stream available' });
      return;
    }

    if (window.YT && window.YT.Player) {
      this.#initYTPlayer(videoId);
    } else {
      this.#loadYTApi(videoId);
    }
  }

  #loadYTApi(videoId) {
    window.__ytPendingPlay = videoId;
    // Chain onto any existing callback (e.g. from ambient.js) instead of overwriting it
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev();
      this.#initYTPlayer(window.__ytPendingPlay);
    };
    if (!document.getElementById('yt-api-script')) {
      const s = document.createElement('script');
      s.id  = 'yt-api-script';
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
  }

  #initYTPlayer(videoId) {
    if (this.#ytIframe) {
      this.#ytIframe.parentElement.style.display = 'none';
    }
    if (this.#ytPlayer) {
      this.#ytPlayer.loadVideoById(videoId);
      this.#ytPlayer.setVolume(this.#muted ? 0 : Math.round(this.#volume * 100));
      this.#ytPlayer.playVideo();
      return;
    }

    const container = document.createElement('div');
    container.id = 'yt-player-container';
    document.body.appendChild(container);

    this.#ytPlayer = new window.YT.Player('yt-player-container', {
      width:    '0',
      height:   '0',
      videoId,
      playerVars: { autoplay: 1, controls: 0, loop: 1, playlist: videoId },
      events: {
        onReady: (e) => {
          e.target.setVolume(this.#muted ? 0 : Math.round(this.#volume * 100));
          e.target.playVideo();
          this.#emit('status', { text: '' });
        },
        onError: () => {
          this.#emit('status', { text: 'Playback unavailable' });
        },
      },
    });
  }

  #ytPlay() {
    if (this.#ytPlayer && this.#ytPlayer.playVideo) {
      this.#ytPlayer.playVideo();
    } else {
      this.#switchToYT();
    }
  }

  #ytPause() {
    if (this.#ytPlayer && this.#ytPlayer.pauseVideo) {
      this.#ytPlayer.pauseVideo();
    }
  }

  #ytSetVolume(v) {
    if (this.#ytPlayer && this.#ytPlayer.setVolume) {
      this.#ytPlayer.setVolume(v);
    }
  }

  // ── Private: helpers ─────────────────────────────────────────

  #applyMute() {
    this.#audio.volume = this.#muted ? 0 : this.#volume;
    this.#ytSetVolume(this.#muted ? 0 : Math.round(this.#volume * 100));
  }

  #renderStations() {
    this.#emit('ready', { stations: STATIONS, currentIdx: this.#currentIdx });
  }

  #emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
