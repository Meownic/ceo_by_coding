/**
 * @fileoverview Warehouse entity – storage building on the game map.
 *
 * Drones can deposit and withdraw items when adjacent.
 * The player can interact (press E) to open a management UI.
 *
 * Warehouses have unlimited storage capacity unlike drone inventories.
 */

import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants.js';

export default class Warehouse {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} tx  – Tile-X of the warehouse (top-left corner)
   * @param {number} ty  – Tile-Y of the warehouse (top-left corner)
   * @param {number} [w=2] – Width in tiles
   * @param {number} [h=2] – Height in tiles
   */
  constructor(scene, tx, ty, w = 2, h = 2, storage = null, label = 'GUDANG') {
    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {number} Tile anchor X */
    this.tileX = tx;
    /** @type {number} Tile anchor Y */
    this.tileY = ty;
    /** @type {number} Width in tiles */
    this.tileW = w;
    /** @type {number} Height in tiles */
    this.tileH = h;

    /**
     * HQ and crafted depots share the same storage object. Keeping the event
     * emitter in that object makes every access point refresh consistently.
     */
    this.storage = storage || { items: new Map(), events: new Phaser.Events.EventEmitter() };
    this.items = this.storage.items;
    this.events = this.storage.events;
    this.label = label;

    // ── Visual ──────────────────────────────────────────────────
    const cx = (tx + w / 2) * TILE_SIZE;
    const cy = (ty + h / 2) * TILE_SIZE;

    // Background panel
    this._bg = scene.add.rectangle(cx, cy, w * TILE_SIZE, h * TILE_SIZE, 0x244c3a);
    this._bg.setDepth(2);
    this._bg.setStrokeStyle(1, 0x244c3a);

    // Icon
    this._icon = scene.add.image(cx, cy, 'warehouse').setDepth(3);

    // Label
    this._label = scene.add.text(cx, cy + 12, label, {
      fontFamily: '"Courier New", monospace',
      fontSize: '8px',
      color: '#edf0d4',
      resolution: 1,
    }).setOrigin(0.5).setPosition(cx, cy + 25).setDepth(4);

    // Subtle pulsing glow
  }

  /* ================================================================
   *  STORAGE API
   * ================================================================ */

  /**
   * Deposit items into the warehouse.
   * @param {string} itemId
   * @param {number} qty
   */
  deposit(itemId, qty = 1) {
    const current = this.items.get(itemId) || 0;
    this.items.set(itemId, current + qty);
    this.events.emit('changed', { action: 'deposit', itemId, qty });
  }

  /**
   * Withdraw items from the warehouse.
   * @param {string} itemId
   * @param {number} qty
   * @returns {boolean} false if not enough stock
   */
  withdraw(itemId, qty = 1) {
    const current = this.items.get(itemId) || 0;
    if (current < qty) return false;
    const newCount = current - qty;
    if (newCount === 0) {
      this.items.delete(itemId);
    } else {
      this.items.set(itemId, newCount);
    }
    this.events.emit('changed', { action: 'withdraw', itemId, qty });
    return true;
  }

  /**
   * Check if warehouse has at least qty of an item.
   * @param {string} itemId
   * @param {number} qty
   * @returns {boolean}
   */
  hasItem(itemId, qty = 1) {
    return (this.items.get(itemId) || 0) >= qty;
  }

  /**
   * Get all stored items as array of {id, count}.
   * @returns {{ id: string, count: number }[]}
   */
  getAll() {
    const result = [];
    for (const [id, count] of this.items) {
      result.push({ id, count });
    }
    return result;
  }

  /**
   * Get count of a specific item.
   * @param {string} itemId
   * @returns {number}
   */
  getItemCount(itemId) {
    return this.items.get(itemId) || 0;
  }

  /* ================================================================
   *  SPATIAL HELPERS
   * ================================================================ */

  /**
   * Check if a tile coordinate is within the warehouse footprint.
   * @param {number} tx
   * @param {number} ty
   * @returns {boolean}
   */
  containsTile(tx, ty) {
    return (
      tx >= this.tileX && tx < this.tileX + this.tileW &&
      ty >= this.tileY && ty < this.tileY + this.tileH
    );
  }

  /**
   * Check if an entity at tile (tx, ty) is adjacent (1 tile away) to the warehouse.
   * @param {number} tx
   * @param {number} ty
   * @returns {boolean}
   */
  isAdjacentTo(tx, ty) {
    // Expand warehouse footprint by 1 in all directions
    return (
      tx >= this.tileX - 1 && tx <= this.tileX + this.tileW &&
      ty >= this.tileY - 1 && ty <= this.tileY + this.tileH &&
      !this.containsTile(tx, ty)
    );
  }

  /**
   * Destroy all visual objects.
   */
  destroy() {
    this._bg.destroy();
    this._icon.destroy();
    this._label.destroy();
  }
}
