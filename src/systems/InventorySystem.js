/**
 * @fileoverview InventorySystem – tracks the player's items and coins.
 *
 * All mutations emit events so UI components (HUD, MarketUI) can react
 * without polling.
 *
 * Events:
 *   'inventory-changed' → { itemId, count, delta }
 *   'coins-changed'     → { coins, delta }
 */

import Phaser from 'phaser';
import { STARTING_COINS } from '../config/constants.js';

export default class InventorySystem {
  constructor() {
    /**
     * Item storage – key is the item ID string, value is the quantity.
     * @type {Map<string, number>}
     */
    this.items = new Map();

    /**
     * Current coin balance.
     * @type {number}
     */
    this.coins = STARTING_COINS;

    /**
     * Phaser event emitter for inventory-related events.
     * @type {Phaser.Events.EventEmitter}
     */
    this.events = new Phaser.Events.EventEmitter();
  }

  /* ================================================================
   *  ITEM MANAGEMENT
   * ================================================================ */

  /**
   * Add items to the inventory.
   *
   * @param {string} itemId   – Item identifier (e.g. 'wheat_seed').
   * @param {number} [quantity=1] – Number of items to add.
   */
  addItem(itemId, quantity = 1) {
    const current = this.items.get(itemId) || 0;
    const newCount = current + quantity;
    this.items.set(itemId, newCount);

    this.events.emit('inventory-changed', {
      itemId,
      count: newCount,
      delta: quantity,
    });
  }

  /**
   * Remove items from the inventory.
   *
   * @param {string} itemId       – Item identifier.
   * @param {number} [quantity=1] – Number to remove.
   * @returns {boolean} `true` if the items were removed, `false` if
   *                    the player didn't have enough.
   */
  removeItem(itemId, quantity = 1) {
    const current = this.items.get(itemId) || 0;
    if (current < quantity) return false;

    const newCount = current - quantity;
    if (newCount <= 0) {
      this.items.delete(itemId);
    } else {
      this.items.set(itemId, newCount);
    }

    this.events.emit('inventory-changed', {
      itemId,
      count: newCount,
      delta: -quantity,
    });

    return true;
  }

  /**
   * Check whether the player has at least `quantity` of the given item.
   *
   * @param {string} itemId
   * @param {number} [quantity=1]
   * @returns {boolean}
   */
  hasItem(itemId, quantity = 1) {
    return (this.items.get(itemId) || 0) >= quantity;
  }

  /**
   * Get the current count of a specific item.
   *
   * @param {string} itemId
   * @returns {number}
   */
  getItemCount(itemId) {
    return this.items.get(itemId) || 0;
  }

  /**
   * Return every item in the inventory as an array of `{ id, count }`.
   *
   * @returns {{ id: string, count: number }[]}
   */
  getAllItems() {
    const result = [];
    for (const [id, count] of this.items) {
      result.push({ id, count });
    }
    return result;
  }

  /* ================================================================
   *  COIN MANAGEMENT
   * ================================================================ */

  /**
   * Add coins to the player's balance.
   *
   * @param {number} amount
   */
  addCoins(amount) {
    this.coins += amount;

    this.events.emit('coins-changed', {
      coins: this.coins,
      delta: amount,
    });
  }

  /**
   * Remove coins from the player's balance.
   *
   * @param {number} amount
   * @returns {boolean} `false` if the player doesn't have enough coins.
   */
  removeCoins(amount) {
    if (this.coins < amount) return false;

    this.coins -= amount;

    this.events.emit('coins-changed', {
      coins: this.coins,
      delta: -amount,
    });

    return true;
  }

  /**
   * Get the current coin balance.
   *
   * @returns {number}
   */
  getCoins() {
    return this.coins;
  }
}
