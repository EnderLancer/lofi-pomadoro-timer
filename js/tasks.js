/**
 * tasks.js — Session task tracker
 *
 * Stores completed session entries: { id, task, mode, duration, timestamp }
 * Persisted to localStorage. Individual delete supported.
 */

const KEY = 'lofipomo_tasks';

export class TaskTracker extends EventTarget {
  #entries = [];

  constructor() {
    super();
    this.#load();
  }

  get entries() { return [...this.#entries]; }

  /**
   * Record a completed session.
   * @param {{ task: string, mode: string, durationSecs: number }} data
   */
  addEntry({ task, mode, durationSecs }) {
    const entry = {
      id:        crypto.randomUUID(),
      task:      task || '',
      mode,
      duration:  durationSecs,
      timestamp: Date.now(),
    };
    this.#entries.unshift(entry);  // newest first
    this.#save();
    this.#emit('add', { entry });
    return entry;
  }

  deleteEntry(id) {
    const before = this.#entries.length;
    this.#entries = this.#entries.filter(e => e.id !== id);
    if (this.#entries.length !== before) {
      this.#save();
      this.#emit('delete', { id });
    }
  }

  clearAll() {
    this.#entries = [];
    this.#save();
    this.#emit('clear', {});
  }

  // ── Private ─────────────────────────────────────────────────

  #load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.#entries = JSON.parse(raw);
    } catch {
      this.#entries = [];
    }
  }

  #save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.#entries));
    } catch {}
  }

  #emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

// ── Render helpers (called by app.js) ──────────────────────────

/**
 * Render all entries into the task log list.
 * @param {HTMLElement} listEl
 * @param {HTMLElement} emptyEl
 * @param {Array}       entries
 * @param {Function}    onDelete  (id) => void
 */
export function renderTaskLog(listEl, emptyEl, entries, onDelete) {
  listEl.innerHTML = '';
  emptyEl.style.display = entries.length ? 'none' : '';

  for (const entry of entries) {
    const li = document.createElement('li');
    li.className  = 'task-log-item';
    li.dataset.id = entry.id;

    const modeLabel = entry.mode === 'focus' ? 'Focus' : entry.mode === 'short' ? 'Short Break' : 'Long Break';
    const dur   = formatDuration(entry.duration);
    const time  = formatTime(entry.timestamp);

    li.innerHTML = `
      <span class="task-log-icon">&#10003;</span>
      <span class="task-log-text" title="${escHtml(entry.task || '(no task)')}">${escHtml(entry.task || '(no task)')}</span>
      <span class="task-log-meta">${modeLabel} &middot; ${dur} &middot; ${time}</span>
      <button class="task-log-delete" aria-label="Delete entry" title="Delete">&times;</button>
    `;

    li.querySelector('.task-log-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      onDelete(entry.id);
    });

    listEl.appendChild(li);
  }
}

function formatDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
