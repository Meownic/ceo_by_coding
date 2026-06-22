/**
 * @fileoverview SharedMemory – global key-value store accessible from ALL drone sandboxes.
 *
 * Think of it as a bulletin board that every drone can read and write.
 * Use it for inter-drone coordination:
 *
 *   // Drone 1 (harvester):
 *   mem.set('harvestDone', true);
 *   mem.push('queue', drone.getPosition());
 *
 *   // Drone 2 (seller):
 *   if (mem.get('harvestDone')) { drone.sell(); }
 *   var next = mem.pop('queue');
 *
 * API (synchronous — all methods return immediately):
 *
 *   mem.set(key, value)          → void    — store any primitive / object / array
 *   mem.get(key)                 → value   — retrieve stored value (undefined if missing)
 *   mem.has(key)                 → boolean — check if key exists
 *   mem.del(key)                 → void    — delete a key
 *   mem.keys()                   → string[] — list all stored keys
 *   mem.clear()                  → void    — wipe the entire store
 *   mem.inc(key, delta?)         → number  — atomic increment (default delta=1)
 *   mem.dec(key, delta?)         → number  — atomic decrement
 *   mem.push(key, item)          → number  — push item to list at key, returns new length
 *   mem.pop(key)                 → any     — pop item from list at key (LIFO)
 *   mem.shift(key)               → any     — shift item from front of list at key (FIFO queue)
 *   mem.len(key)                 → number  — length of list at key (0 if not a list)
 *
 * Values are stored as plain JS primitives — strings, numbers, booleans, null, arrays, objects.
 * NOTE: Object values are deep-cloned on get/set to prevent cross-sandbox reference sharing.
 */

export default class SharedMemory {
  constructor() {
    /** @type {Map<string, any>} */
    this._store = new Map();

    /** @type {number} Total number of write operations since last clear (useful for debugging) */
    this.writeCount = 0;
  }

  /* ================================================================
   *  CORE GET / SET / HAS / DEL
   * ================================================================ */

  /**
   * Store a value.
   * @param {string} key
   * @param {any} value – Primitives, arrays, plain objects only.
   */
  set(key, value) {
    this._store.set(String(key), this._clone(value));
    this.writeCount++;
  }

  /**
   * Retrieve a stored value.
   * @param {string} key
   * @param {any} [defaultValue=undefined]
   * @returns {any}
   */
  get(key, defaultValue = undefined) {
    const k = String(key);
    if (!this._store.has(k)) return defaultValue;
    return this._clone(this._store.get(k));
  }

  /**
   * Check if a key exists.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this._store.has(String(key));
  }

  /**
   * Delete a key.
   * @param {string} key
   */
  del(key) {
    this._store.delete(String(key));
  }

  /**
   * Return all stored keys.
   * @returns {string[]}
   */
  keys() {
    return Array.from(this._store.keys());
  }

  /**
   * Wipe the entire store.
   */
  clear() {
    this._store.clear();
    this.writeCount = 0;
  }

  /* ================================================================
   *  NUMERIC HELPERS
   * ================================================================ */

  /**
   * Atomically increment a numeric value (initialized to 0 if missing).
   * @param {string} key
   * @param {number} [delta=1]
   * @returns {number} New value after increment.
   */
  inc(key, delta = 1) {
    const current = Number(this._store.get(String(key))) || 0;
    const next = current + delta;
    this._store.set(String(key), next);
    this.writeCount++;
    return next;
  }

  /**
   * Atomically decrement a numeric value.
   * @param {string} key
   * @param {number} [delta=1]
   * @returns {number} New value after decrement.
   */
  dec(key, delta = 1) {
    return this.inc(key, -delta);
  }

  /* ================================================================
   *  LIST HELPERS (FIFO queue + LIFO stack)
   * ================================================================ */

  /**
   * Push an item to the end of a list at the given key.
   * Creates the list if it doesn't exist.
   * @param {string} key
   * @param {any} item
   * @returns {number} New length of the list.
   */
  push(key, item) {
    const k = String(key);
    const arr = Array.isArray(this._store.get(k)) ? this._store.get(k) : [];
    arr.push(this._clone(item));
    this._store.set(k, arr);
    this.writeCount++;
    return arr.length;
  }

  /**
   * Pop the last item from the list (LIFO).
   * Returns undefined if the list is empty or doesn't exist.
   * @param {string} key
   * @returns {any}
   */
  pop(key) {
    const k = String(key);
    const arr = Array.isArray(this._store.get(k)) ? this._store.get(k) : [];
    if (arr.length === 0) return undefined;
    const item = arr.pop();
    this._store.set(k, arr);
    this.writeCount++;
    return this._clone(item);
  }

  /**
   * Shift the first item from the list (FIFO queue).
   * Returns undefined if empty.
   * @param {string} key
   * @returns {any}
   */
  shift(key) {
    const k = String(key);
    const arr = Array.isArray(this._store.get(k)) ? this._store.get(k) : [];
    if (arr.length === 0) return undefined;
    const item = arr.shift();
    this._store.set(k, arr);
    this.writeCount++;
    return this._clone(item);
  }

  /**
   * Return the length of a list (0 if key missing or not a list).
   * @param {string} key
   * @returns {number}
   */
  len(key) {
    const val = this._store.get(String(key));
    return Array.isArray(val) ? val.length : 0;
  }

  /* ================================================================
   *  DEBUGGING HELPERS
   * ================================================================ */

  /**
   * Return a snapshot of the store as a plain object (for debugging).
   * @returns {object}
   */
  snapshot() {
    const result = {};
    for (const [k, v] of this._store.entries()) {
      result[k] = this._clone(v);
    }
    return result;
  }

  /* ================================================================
   *  PRIVATE HELPERS
   * ================================================================ */

  /**
   * Deep-clone a value to prevent reference sharing between sandboxes.
   * Falls back to the original value for non-clonable types.
   * @private
   */
  _clone(value) {
    if (value === null || value === undefined) return value;
    if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
      return value;
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }
}
