/**
 * @fileoverview ScriptManager – CRUD + persistence for player scripts.
 *
 * Each script is a small object:
 *   { id, name, code, color, createdAt }
 *
 * Scripts are persisted to `localStorage` under the key
 * `'ceoByCode_scripts'`.  A sensible default "My First Script" is
 * created on first launch.
 */

import { MAX_SCRIPT_SLOTS } from '../config/constants.js';

/** localStorage key for persisted scripts. */
const STORAGE_KEY = 'ceoByCode_scripts';

/** Colours available for script tabs / icons. */
const SCRIPT_COLORS = [
  '#4fc3f7', // light blue
  '#81c784', // green
  '#ffb74d', // orange
  '#e57373', // red
  '#ba68c8', // purple
  '#fff176', // yellow
  '#4db6ac', // teal
  '#f06292', // pink
];

/** The code that ships with the very first script slot. */
const DEFAULT_CODE = `// Welcome to DroneCode! 🤖
// Write JavaScript to control your drone.
// Available commands:
//   drone.move('right')  - Move drone
//   drone.till()         - Till the soil
//   drone.water()        - Water the soil
//   drone.plant('wheat') - Plant a seed
//   drone.canCrop()      - Check if ready to harvest
//   drone.crop()         - Harvest non-fruit plant
//
// Inter-drone communication & location:
//   drone.getDrones()          - Get all active drones
//   drone.getDronePosition(id) - Find another drone's coordinates
//   mem.set(key, val)          - Set global memory key
//   mem.get(key)               - Get global memory value

// Example: Move right and till the soil
drone.move('right');
drone.till();
drone.water();
drone.plant('wheat');
`;

/**
 * @typedef {Object} Script
 * @property {string} id        – Unique identifier.
 * @property {string} name      – Display name (≤ 30 chars).
 * @property {string} code      – Source code.
 * @property {string} color     – CSS colour string.
 * @property {number} createdAt – Unix-ms timestamp.
 */

/**
 * @class ScriptManager
 * Manages the player's library of drone scripts.
 */
export default class ScriptManager {
  constructor() {
    /** @type {Script[]} */
    this.scripts = [];

    /** @type {number} */
    this.maxSlots = MAX_SCRIPT_SLOTS;

    /** @type {string|null} ID of the script currently loaded in the editor. */
    this.activeScriptId = null;

    // Attempt to restore from localStorage; create default if empty
    this.loadFromLocalStorage();

    if (this.scripts.length === 0) {
      this._createDefaultScript();
    }
  }

  /* ================================================================
   *  CRUD
   * ================================================================ */

  /**
   * Create a new script.
   *
   * @param {string} [name='Untitled Script'] – Display name.
   * @param {string} [color]                  – CSS colour; picks a random one if omitted.
   * @returns {Script|null} The created script, or `null` if slots are full.
   */
  createScript(name = 'Untitled Script', color) {
    if (!this.canCreateScript()) {
      console.warn('ScriptManager: max script slots reached');
      return null;
    }

    const script = {
      id: this._generateId(),
      name: name.slice(0, 30),
      code: '',
      color: color || this._pickColor(),
      createdAt: Date.now(),
      assignedDroneId: null,
    };

    this.scripts.push(script);
    this.saveToLocalStorage();
    return script;
  }

  /**
   * Delete a script by ID.
   * If the deleted script was active, the active ID is reset.
   *
   * @param {string} id
   * @returns {boolean} `true` if a script was removed.
   */
  deleteScript(id) {
    const index = this.scripts.findIndex((s) => s.id === id);
    if (index === -1) return false;

    this.scripts.splice(index, 1);

    if (this.activeScriptId === id) {
      this.activeScriptId = this.scripts.length > 0 ? this.scripts[0].id : null;
    }

    this.saveToLocalStorage();
    return true;
  }

  /**
   * Rename a script (max 30 characters).
   *
   * @param {string} id
   * @param {string} newName
   * @returns {boolean} `true` if the script was found and renamed.
   */
  renameScript(id, newName) {
    const script = this.getScript(id);
    if (!script) return false;

    script.name = newName.slice(0, 30);
    this.saveToLocalStorage();
    return true;
  }

  /**
   * Replace the code content for a script.
   *
   * @param {string} id
   * @param {string} code
   * @returns {boolean}
   */
  updateCode(id, code) {
    const script = this.getScript(id);
    if (!script) return false;

    script.code = code;
    this.saveToLocalStorage();
    return true;
  }

  /* ================================================================
   *  GETTERS
   * ================================================================ */

  /**
   * @param {string} id
   * @returns {Script|undefined}
   */
  getScript(id) {
    return this.scripts.find((s) => s.id === id);
  }

  /**
   * @returns {Script[]}
   */
  getAllScripts() {
    return [...this.scripts];
  }

  /**
   * @returns {Script|undefined}
   */
  getActiveScript() {
    if (!this.activeScriptId) return undefined;
    return this.getScript(this.activeScriptId);
  }

  /**
   * Set which script is currently loaded in the editor.
   * @param {string} id
   */
  setActiveScript(id) {
    if (this.getScript(id)) {
      this.activeScriptId = id;
    }
  }

  /**
   * Assign a script card to a specific drone, unbinding it from any other drone.
   * @param {string} scriptId
   * @param {string} droneId
   */
  assignScriptToDrone(scriptId, droneId) {
    this.scripts.forEach((s) => {
      if (s.id === scriptId) {
        s.assignedDroneId = droneId;
      } else if (s.assignedDroneId === droneId) {
        s.assignedDroneId = null;
      }
    });
    this.saveToLocalStorage();
  }

  /* ================================================================
   *  SLOT HELPERS
   * ================================================================ */

  /**
   * @returns {boolean} `true` if there is room for another script.
   */
  canCreateScript() {
    return this.scripts.length < this.maxSlots;
  }

  /**
   * @returns {{ current: number, max: number }}
   */
  getSlotCount() {
    return { current: this.scripts.length, max: this.maxSlots };
  }

  /* ================================================================
   *  PERSISTENCE
   * ================================================================ */

  /** Save the full script list to localStorage. */
  saveToLocalStorage() {
    try {
      const data = JSON.stringify({
        scripts: this.scripts,
        activeScriptId: this.activeScriptId,
      });
      localStorage.setItem(STORAGE_KEY, data);
    } catch (err) {
      console.error('ScriptManager: failed to save to localStorage', err);
    }
  }

  /** Load scripts from localStorage (if present). */
  loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);

      if (Array.isArray(data.scripts)) {
        this.scripts = data.scripts;
      }
      if (data.activeScriptId) {
        this.activeScriptId = data.activeScriptId;
      }
    } catch (err) {
      console.error('ScriptManager: failed to load from localStorage', err);
    }
  }

  /* ================================================================
   *  PRIVATE HELPERS
   * ================================================================ */

  /**
   * Create the default starter script and make it active.
   * @private
   */
  _createDefaultScript() {
    const script = {
      id: this._generateId(),
      name: 'My First Script',
      code: DEFAULT_CODE,
      color: SCRIPT_COLORS[0],
      createdAt: Date.now(),
    };

    this.scripts.push(script);
    this.activeScriptId = script.id;
    this.saveToLocalStorage();
  }

  /**
   * Generate a unique ID.
   * @private
   * @returns {string}
   */
  _generateId() {
    return `script_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Pick a colour that isn't already used by an existing script.
   * Falls back to the first colour if all are taken.
   * @private
   * @returns {string}
   */
  _pickColor() {
    const used = new Set(this.scripts.map((s) => s.color));
    const available = SCRIPT_COLORS.filter((c) => !used.has(c));
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
    return SCRIPT_COLORS[0];
  }
}
