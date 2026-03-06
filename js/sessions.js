/**
 * sessions.js — Pomodoro session counter
 *
 * Tracks:
 *  - current set dots (resets after long break)
 *  - all-time total focus sessions
 */

const KEY = 'lofipomo_sessions';

export class SessionCounter extends EventTarget {
  #setCount   = 0;   // within current long-break cycle
  #totalCount = 0;   // all time

  constructor() {
    super();
    this.#load();
  }

  get setCount()   { return this.#setCount; }
  get totalCount() { return this.#totalCount; }

  /** Call when a focus session completes */
  increment() {
    this.#setCount++;
    this.#totalCount++;
    this.#save();
    this.#emit('update', { setCount: this.#setCount, totalCount: this.#totalCount });
  }

  /** Call when a long break begins / set resets */
  resetSet() {
    this.#setCount = 0;
    this.#save();
    this.#emit('update', { setCount: 0, totalCount: this.#totalCount });
  }

  resetTotal() {
    this.#setCount  = 0;
    this.#totalCount = 0;
    this.#save();
    this.#emit('update', { setCount: 0, totalCount: 0 });
  }

  // ── Private ─────────────────────────────────────────────────

  #load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        this.#setCount   = d.setCount   || 0;
        this.#totalCount = d.totalCount || 0;
      }
    } catch {}
  }

  #save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        setCount:   this.#setCount,
        totalCount: this.#totalCount,
      }));
    } catch {}
  }

  #emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

/**
 * Render session dots into the container element.
 * @param {HTMLElement} el
 * @param {number}      setCount     how many filled dots
 * @param {number}      interval     total dots to show (long break interval)
 */
export function renderSessionDots(el, setCount, interval) {
  el.innerHTML = '';
  for (let i = 0; i < interval; i++) {
    const dot = document.createElement('span');
    dot.className = 'session-dot' + (i < setCount ? ' filled' : '');
    dot.setAttribute('aria-hidden', 'true');
    el.appendChild(dot);
  }
}
