/**
 * timer.js — Pomodoro state machine
 *
 * Responsibilities:
 *  - Track current mode (focus / short / long)
 *  - Count down seconds
 *  - Emit events via a simple EventEmitter
 *  - Support auto-advance toggle
 *  - Determine long-break interval
 */

export const TimerMode = Object.freeze({
  FOCUS: 'focus',
  SHORT: 'short',
  LONG:  'long',
});

const CIRCUMFERENCE = 2 * Math.PI * 96; // matches SVG r=96

export class Timer extends EventTarget {
  #mode        = TimerMode.FOCUS;
  #totalSecs   = 25 * 60;
  #remaining   = 25 * 60;
  #running     = false;
  #intervalId  = null;
  #settings    = null;  // reference to settings object
  #sessionsDone = 0;    // focus sessions completed since last long break

  constructor(settings) {
    super();
    this.#settings = settings;
    this.#applyMode(TimerMode.FOCUS);
  }

  // ── Public API ──────────────────────────────────────────────

  get mode()        { return this.#mode; }
  get running()     { return this.#running; }
  get remaining()   { return this.#remaining; }
  get totalSecs()   { return this.#totalSecs; }
  get sessionsDone(){ return this.#sessionsDone; }
  get progress()    { return 1 - (this.#remaining / this.#totalSecs); }

  setMode(mode) {
    if (this.#running) this.pause();
    this.#applyMode(mode);
    this.#emit('modechange', { mode });
    this.#emit('tick', this.#tickData());
  }

  start() {
    if (this.#running) return;
    this.#running = true;
    this.#intervalId = setInterval(() => this.#tick(), 1000);
    this.#emit('start', this.#tickData());
  }

  pause() {
    if (!this.#running) return;
    this.#running = false;
    clearInterval(this.#intervalId);
    this.#emit('pause', this.#tickData());
  }

  toggle() {
    this.#running ? this.pause() : this.start();
  }

  reset() {
    this.pause();
    this.#remaining = this.#totalSecs;
    this.#emit('reset', this.#tickData());
    this.#emit('tick', this.#tickData());
  }

  skip() {
    this.pause();
    this.#advance(false);
  }

  /** Called by settings module when values change */
  onSettingsChange() {
    const wasRunning = this.#running;
    this.pause();
    this.#applyMode(this.#mode);
    if (wasRunning) this.start();
    this.#emit('tick', this.#tickData());
  }

  // ── Private ─────────────────────────────────────────────────

  #applyMode(mode) {
    this.#mode = mode;
    const s = this.#settings;
    const mins = mode === TimerMode.FOCUS  ? s.focusMins  :
                 mode === TimerMode.SHORT  ? s.shortMins  : s.longMins;
    this.#totalSecs = mins * 60;
    this.#remaining = this.#totalSecs;
  }

  #tick() {
    if (this.#remaining <= 0) return;
    this.#remaining--;
    this.#emit('tick', this.#tickData());

    if (this.#remaining > 0 && this.#remaining <= 3) {
      this.#emit('countdown', { remaining: this.#remaining });
    }

    if (this.#remaining === 0) {
      this.pause();
      this.#onComplete();
    }
  }

  #onComplete() {
    if (this.#mode === TimerMode.FOCUS) {
      this.#sessionsDone++;
    }
    this.#emit('complete', {
      mode: this.#mode,
      sessionsDone: this.#sessionsDone,
    });

    if (this.#settings.autoAdvance) {
      // small delay so the chime can play
      setTimeout(() => this.#advance(true), 1200);
    }
  }

  #advance(autoStarted) {
    let nextMode;
    if (this.#mode === TimerMode.FOCUS) {
      nextMode = (this.#sessionsDone % this.#settings.longBreakInterval === 0)
        ? TimerMode.LONG
        : TimerMode.SHORT;
    } else {
      nextMode = TimerMode.FOCUS;
    }

    this.#applyMode(nextMode);
    this.#emit('modechange', { mode: nextMode });
    this.#emit('tick', this.#tickData());

    if (autoStarted && this.#settings.autoAdvance) {
      this.start();
    }
  }

  #tickData() {
    return {
      mode:      this.#mode,
      remaining: this.#remaining,
      total:     this.#totalSecs,
      progress:  this.progress,
      running:   this.#running,
      dashOffset: CIRCUMFERENCE * (1 - this.progress),
    };
  }

  #emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
