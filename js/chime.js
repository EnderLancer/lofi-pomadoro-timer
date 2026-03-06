/**
 * chime.js — Web Audio synthesized bell chime + visual effects
 *
 * Produces a warm bell tone using additive synthesis:
 *   - fundamental + harmonics with exponential decay
 *   - soft attack via gain ramp
 *
 * Visual effects:
 *   - Timer face pulse (CSS animation class)
 *   - Full-screen edge flash (CSS animation class)
 */

const PARTIALS = [
  // [frequency multiplier, relative gain]
  [1.000, 1.00],
  [2.756, 0.55],
  [5.404, 0.25],
  [8.933, 0.10],
];

export class Chime {
  #ctx     = null;
  #volume  = 0.6;  // 0–1

  setVolume(v) {
    this.#volume = Math.max(0, Math.min(1, v));
  }

  /**
   * Ring the chime. Creates its own AudioContext if needed.
   * @param {HTMLElement} timerFaceEl
   * @param {HTMLElement} flashOverlayEl
   */
  ring(timerFaceEl, flashOverlayEl) {
    this.#synthesize();
    this.#pulseTimerFace(timerFaceEl);
    this.#flashScreen(flashOverlayEl);
  }

  /**
   * Play a short soft countdown beep (3, 2, 1 before end).
   * @param {number} remaining — seconds left (1–3)
   */
  countdown(remaining) {
    this.#synthesizeBeep(remaining);
  }

  // ── Private ─────────────────────────────────────────────────

  #ensureCtx() {
    if (!this.#ctx || this.#ctx.state === 'closed') {
      this.#ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.#ctx.state === 'suspended') {
      this.#ctx.resume();
    }
    return this.#ctx;
  }

  #synthesize() {
    const ctx     = this.#ensureCtx();
    const now     = ctx.currentTime;
    const decay   = 3.2;   // seconds
    const baseHz  = 440;   // A4 — warm bell fundamental

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(this.#volume, now + 0.01);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    masterGain.connect(ctx.destination);

    for (const [mult, relGain] of PARTIALS) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type      = 'sine';
      osc.frequency.setValueAtTime(baseHz * mult, now);

      gain.gain.setValueAtTime(relGain, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decay * 0.8);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + decay);
    }
  }

  #synthesizeBeep(remaining) {
    const ctx  = this.#ensureCtx();
    const now  = ctx.currentTime;
    // Pitch rises as countdown approaches zero: 3→660Hz, 2→770Hz, 1→880Hz
    const hz   = 660 + (3 - remaining) * 110;
    const decay = 0.25;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(this.#volume * 0.45, now + 0.008);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    masterGain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hz, now);
    osc.connect(masterGain);
    osc.start(now);
    osc.stop(now + decay);
  }

  #pulseTimerFace(el) {
    if (!el) return;
    el.classList.remove('pulsing');
    // Trigger reflow to restart animation
    void el.offsetWidth;
    el.classList.add('pulsing');
    el.addEventListener('animationend', () => el.classList.remove('pulsing'), { once: true });
  }

  #flashScreen(el) {
    if (!el) return;
    el.classList.remove('flashing');
    void el.offsetWidth;
    el.classList.add('flashing');
    el.addEventListener('animationend', () => el.classList.remove('flashing'), { once: true });
  }
}
