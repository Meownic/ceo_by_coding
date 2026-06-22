/**
 * @fileoverview ProfileSystem - tracks player XP, level, name, and drone upgrades.
 *
 * Emits events for UI updates:
 *   'profile-changed' -> { name, level, xp, xpNeeded }
 *   'level-up'        -> { level }
 *   'upgrade'         -> { type, level, value }
 */

import Phaser from 'phaser';

const UPGRADE_COSTS = [100, 250, 500, 1000];
const SPEED_VALUES = [200, 170, 140, 110, 80];
const ACTION_VALUES = [300, 250, 200, 150, 100];
const BATTERY_VALUES = [10000, 25000, 50000, 100000, 250000];

export default class ProfileSystem {
  constructor() {
    this.name = 'Pilot Alpha';
    this.level = 1;
    this.xp = 0;

    // Upgrade levels (1 to 5)
    this.upgrades = {
      speed: 1,
      action: 1,
      battery: 1,
    };

    /**
     * Phaser event emitter for profile-related events.
     * @type {Phaser.Events.EventEmitter}
     */
    this.events = new Phaser.Events.EventEmitter();
  }

  /**
   * Get XP needed to reach the next level.
   * Formula: level * 100
   * @returns {number}
   */
  getXpNeeded() {
    return this.level * 100;
  }

  /**
   * Add XP to the player.
   * @param {number} amount
   */
  addXp(amount) {
    this.xp += amount;
    let leveledUp = false;

    while (this.xp >= this.getXpNeeded()) {
      this.xp -= this.getXpNeeded();
      this.level++;
      leveledUp = true;
    }

    this.events.emit('profile-changed', {
      name: this.name,
      level: this.level,
      xp: this.xp,
      xpNeeded: this.getXpNeeded(),
    });

    if (leveledUp) {
      this.events.emit('level-up', { level: this.level });
    }
  }

  /**
   * Rename the pilot.
   * @param {string} newName
   */
  rename(newName) {
    if (newName && newName.trim()) {
      this.name = newName.trim();
      this.events.emit('profile-changed', {
        name: this.name,
        level: this.level,
        xp: this.xp,
        xpNeeded: this.getXpNeeded(),
      });
    }
  }

  /**
   * Get the cost to purchase the next upgrade level.
   * Returns null if already maxed.
   * @param {'speed'|'action'|'battery'} type
   * @returns {number|null}
   */
  getUpgradeCost(type) {
    const currentLvl = this.upgrades[type];
    if (currentLvl >= 5) return null;
    return UPGRADE_COSTS[currentLvl - 1];
  }

  /**
   * Get the current level of an upgrade.
   * @param {'speed'|'action'|'battery'} type
   * @returns {number}
   */
  getUpgradeLevel(type) {
    return this.upgrades[type];
  }

  /**
   * Get the actual value corresponding to the current upgrade level.
   * @param {'speed'|'action'|'battery'} type
   * @returns {number}
   */
  getUpgradeValue(type) {
    const currentLvl = this.upgrades[type];
    if (type === 'speed') {
      return SPEED_VALUES[currentLvl - 1];
    } else if (type === 'action') {
      return ACTION_VALUES[currentLvl - 1];
    } else if (type === 'battery') {
      return BATTERY_VALUES[currentLvl - 1];
    }
    return 0;
  }

  /**
   * Purchase an upgrade.
   * @param {'speed'|'action'|'battery'} type
   * @param {InventorySystem} inventorySystem
   * @returns {{ success: boolean, message: string }}
   */
  upgrade(type, inventorySystem) {
    const currentLvl = this.upgrades[type];
    if (currentLvl >= 5) {
      return { success: false, message: 'Upgrade already at maximum level.' };
    }

    const cost = this.getUpgradeCost(type);
    if (!inventorySystem.removeCoins(cost)) {
      return { success: false, message: 'Not enough coins.' };
    }

    this.upgrades[type]++;
    const newVal = this.getUpgradeValue(type);

    this.events.emit('upgrade', {
      type,
      level: this.upgrades[type],
      value: newVal,
    });

    // Also trigger profile change to update UI
    this.events.emit('profile-changed', {
      name: this.name,
      level: this.level,
      xp: this.xp,
      xpNeeded: this.getXpNeeded(),
    });

    return { success: true, message: `Successfully upgraded ${type} to Level ${this.upgrades[type]}!` };
  }
}
