/**
 * themes.js — Theme registry and switcher
 *
 * To add a new theme:
 *  1. Create  css/theme-<id>.css  with overriding CSS custom properties
 *  2. Add an entry to THEMES below
 *  3. Add <option> to the #s-theme <select> in index.html
 */

export const THEMES = {
  picnic: {
    id:    'picnic',
    label: 'Late Spring Picnic',
    file:  'css/theme-picnic.css',
  },
  // future themes (add css file + entry here):
  // 'night-city': { id: 'night-city', label: 'Night City', file: 'css/theme-night-city.css' },
  // 'autumn-library': { id: 'autumn-library', label: 'Autumn Library', file: 'css/theme-autumn-library.css' },
};

export class ThemeManager extends EventTarget {
  #current   = 'picnic';
  #linkEl    = null;

  constructor() {
    super();
    this.#linkEl = document.getElementById('theme-stylesheet');
  }

  get current() { return this.#current; }

  apply(themeId) {
    const theme = THEMES[themeId];
    if (!theme) return;

    this.#current = themeId;
    document.documentElement.setAttribute('data-theme', themeId);

    if (this.#linkEl) {
      this.#linkEl.href = theme.file;
    }

    this.#emit('themechange', { theme });
  }

  list() {
    return Object.values(THEMES);
  }

  // ── Private ─────────────────────────────────────────────────

  #emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
