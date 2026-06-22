/**
 * @fileoverview Module definitions for the drone module system.
 *
 * Each module occupies the drone's single module slot and unlocks
 * a set of API abilities. Modules are items in the player's inventory
 * that can be equipped to a drone via the Devices panel.
 */

import {
  DRONE_SUPPLIER_BONUS,
  DRONE_SELLER_BONUS,
  DRONE_BIGGER_SELLER_CAPACITY,
  DRONE_SUPER_CARRIER_CAPACITY,
  DRONE_BASE_INVENTORY,
} from '../config/constants.js';

/**
 * @typedef {Object} ModuleDefinition
 * @property {string}   name          - Human-readable name
 * @property {string}   emoji         - Emoji icon for UI display
 * @property {string}   description   - Short description shown in UI
 * @property {string[]} abilities     - Drone API methods this module enables
 * @property {number}   inventoryBonus - Extra carry capacity granted
 * @property {number}   cost          - Purchase cost in coins (shop price)
 */

/** @type {Object.<string, ModuleDefinition>} */
export const MODULE_TYPES = {
  farming: {
    name: 'Farming Module',
    emoji: '🌾',
    description: 'Boosts drone farming efficiency. Grants +50 extra carry capacity for harvested crops.',
    abilities: ['till', 'water', 'plant', 'crop', 'harvest'],
    inventoryBonus: 50,
    cost: 150,
  },
  supplier: {
    name: 'Supplier Module',
    emoji: '📦',
    description: 'Unlocks drone.supplyFrom() and drone.transferToWarehouse(). Massively increased carry capacity (+9900).',
    abilities: ['supplyFrom', 'transferTo'],
    inventoryBonus: DRONE_SUPPLIER_BONUS,
    cost: 400,
  },
  seller: {
    name: 'Seller/Buyer Module',
    emoji: '💰',
    description: 'Unlocks drone.sell() and drone.buy() for autonomous economy. Increased carry capacity (+400).',
    abilities: ['sell', 'buy'],
    inventoryBonus: DRONE_SELLER_BONUS,
    cost: 300,
  },
  mining: {
    name: 'Mining Module',
    emoji: '⛏️',
    description: 'Unlocks drone.mine() to extract Coal, Copper Ore, Iron Ore, and Gold Ore from rocks.',
    abilities: ['mine'],
    inventoryBonus: 50,
    cost: 250,
  },
  bigger_seller: {
    name: 'Bigger Seller Module',
    emoji: '💸',
    description: 'Advanced trade module. Unlocks drone.sell() and drone.buy(). Capacity +900 (total 1000). +20% sell coins.',
    abilities: ['sell', 'buy'],
    inventoryBonus: DRONE_BIGGER_SELLER_CAPACITY - DRONE_BASE_INVENTORY,
    cost: 1000,
  },
  super_carrier: {
    name: 'Super Carrier Module',
    emoji: '🚚',
    description: 'Ultimate carrying capacity. Unlocks drone.supplyFrom() and drone.transferToWarehouse(). Capacity +19900 (total 20000).',
    abilities: ['supplyFrom', 'transferTo'],
    inventoryBonus: DRONE_SUPER_CARRIER_CAPACITY - DRONE_BASE_INVENTORY,
    cost: 2000,
  },
  advanced_farming: {
    name: 'Advanced Farming Module',
    emoji: '🚜',
    description: 'All action delays are cut in half (150ms). Boosts farming capacity (+200).',
    abilities: ['till', 'water', 'plant', 'crop', 'harvest'],
    inventoryBonus: 200,
    cost: 1500,
  },
  speed_booster: {
    name: 'Speed Booster Module',
    emoji: '⚡',
    description: 'Turbine upgrade. Cut drone movement duration in half (100ms). Capacity +50.',
    abilities: [],
    inventoryBonus: 50,
    cost: 1200,
  },
};

export const MODULE_NAMES = Object.keys(MODULE_TYPES);

/**
 * Item IDs for modules in the inventory system.
 * These are the strings stored in player/drone inventory.
 */
export const MODULE_ITEM_IDS = {
  farming: 'module_farming',
  supplier: 'module_supplier',
  seller: 'module_seller',
  mining: 'module_mining',
  bigger_seller: 'module_bigger_seller',
  super_carrier: 'module_super_carrier',
  advanced_farming: 'module_advanced_farming',
  speed_booster: 'module_speed_booster',
};

/**
 * Resolve an item ID back to a module type key.
 * @param {string} itemId
 * @returns {string|null}
 */
export function getModuleTypeFromItemId(itemId) {
  for (const [key, val] of Object.entries(MODULE_ITEM_IDS)) {
    if (val === itemId) return key;
  }
  return null;
}

/**
 * Check if a drone's module allows a given ability.
 * @param {string|null} moduleType - The equipped module type
 * @param {string} ability - The ability to check
 * @returns {boolean}
 */
export function moduleHasAbility(moduleType, ability) {
  if (!moduleType) return false;
  const mod = MODULE_TYPES[moduleType];
  if (!mod) return false;
  return mod.abilities.includes(ability);
}
