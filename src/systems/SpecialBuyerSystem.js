/**
 * @fileoverview SpecialBuyerSystem — manages special guest NPC buyers with timed requests.
 */

import Phaser from 'phaser';

const BUYER_POOL = [
  { name: 'Chef Bob', reqItem: 'bread', baseQty: 5, rewardPerUnit: 180, delay: 180000 },
  { name: 'Baker Sally', reqItem: 'flour', baseQty: 8, rewardPerUnit: 70, delay: 150000 },
  { name: 'Sweet Suzie', reqItem: 'apple_jam', baseQty: 3, rewardPerUnit: 360, delay: 200000 },
  { name: 'Kid Billy', reqItem: 'chips', baseQty: 6, rewardPerUnit: 260, delay: 180000 },
  { name: 'Blacksmith Pete', reqItem: 'iron_ingot', baseQty: 4, rewardPerUnit: 220, delay: 180000 },
  { name: 'Engineer Emma', reqItem: 'wire', baseQty: 5, rewardPerUnit: 260, delay: 180000 },
  { name: 'Inventor Ian', reqItem: 'gear', baseQty: 3, rewardPerUnit: 480, delay: 200000 },
];

export default class SpecialBuyerSystem {
  constructor() {
    /** @type {object|null} Active buyer details */
    this.activeBuyer = null;

    /** @type {number} Time since last spawn check */
    this.spawnTimer = 0;

    /** @type {number} Spawn check interval (120 seconds) */
    this.spawnInterval = 120000;

    /** @type {Phaser.Events.EventEmitter} */
    this.events = new Phaser.Events.EventEmitter();
  }

  /**
   * Tick update.
   * @param {number} delta - Frame delta in ms
   */
  update(delta) {
    if (this.activeBuyer) {
      this.activeBuyer.timeRemaining -= delta;
      if (this.activeBuyer.timeRemaining <= 0) {
        const expiredBuyer = this.activeBuyer;
        this.activeBuyer = null;
        this.events.emit('buyer-left', expiredBuyer);
      }
    } else {
      this.spawnTimer += delta;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;
        // 50% chance to spawn a buyer every interval
        if (Math.random() < 0.5) {
          this.spawnBuyer();
        }
      }
    }
  }

  /**
   * Manually or automatically spawn a random buyer.
   */
  spawnBuyer() {
    if (this.activeBuyer) return;

    const template = BUYER_POOL[Math.floor(Math.random() * BUYER_POOL.length)];
    const qty = template.baseQty + Math.floor(Math.random() * 3) - 1; // Slight random variation
    const reward = qty * template.rewardPerUnit;

    this.activeBuyer = {
      id: `buyer_${Date.now()}`,
      name: template.name,
      reqItem: template.reqItem,
      reqCount: qty,
      reward: reward,
      timeTotal: template.delay,
      timeRemaining: template.delay,
    };

    this.events.emit('buyer-arrived', this.activeBuyer);
  }

  /**
   * Attempt to fulfill the current buyer order from an inventory (drone or player).
   * @param {object} inventory - Drone or Player inventory system instance
   * @returns {boolean} True if successfully fulfilled
   */
  fulfillOrder(inventory) {
    if (!this.activeBuyer) return false;

    const reqItem = this.activeBuyer.reqItem;
    const reqCount = this.activeBuyer.reqCount;

    if (inventory.hasItem(reqItem, reqCount)) {
      inventory.removeItem(reqItem, reqCount);
      const fulfilledBuyer = this.activeBuyer;
      this.activeBuyer = null;
      this.events.emit('buyer-fulfilled', fulfilledBuyer);
      return true;
    }

    return false;
  }

  /**
   * Get active buyer data.
   */
  getActiveBuyer() {
    return this.activeBuyer;
  }

  /**
   * Get state for save file.
   */
  getSaveState() {
    return {
      activeBuyer: this.activeBuyer,
      spawnTimer: this.spawnTimer,
    };
  }

  /**
   * Restore state from save.
   */
  loadSaveState(state) {
    if (!state) return;
    this.activeBuyer = state.activeBuyer || null;
    this.spawnTimer = state.spawnTimer || 0;
  }
}
