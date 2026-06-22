/**
 * @fileoverview EconomySystem – handles buying seeds/modules and selling crops.
 */

import { PLANT_TYPES } from '../data/plants.js';
import { MODULE_TYPES, MODULE_ITEM_IDS } from '../data/modules.js';

export const REFINED_PRICES = {
  flour: { name: 'Flour', sellPrice: 35 },
  bread: { name: 'Bread', sellPrice: 90 },
  apple_juice: { name: 'Apple Juice', sellPrice: 70 },
  apple_jam: { name: 'Apple Jam', sellPrice: 180 },
  potato_starch: { name: 'Potato Starch', sellPrice: 50 },
  chips: { name: 'Potato Chips', sellPrice: 130 },
  coal: { name: 'Coal', sellPrice: 15 },
  copper_ore: { name: 'Copper Ore', sellPrice: 20 },
  iron_ore: { name: 'Iron Ore', sellPrice: 30 },
  gold_ore: { name: 'Gold Ore', sellPrice: 75 },
  copper_ingot: { name: 'Copper Ingot', sellPrice: 80 },
  iron_ingot: { name: 'Iron Ingot', sellPrice: 110 },
  gold_ingot: { name: 'Gold Ingot', sellPrice: 300 },
  wire: { name: 'Copper Wire', sellPrice: 130 },
  gear: { name: 'Iron Gear', sellPrice: 240 }
};

export default class EconomySystem {
  /**
   * @param {import('./InventorySystem.js').default} inventory
   * @param {object} [profile] - Optional player profile system.
   */
  constructor(inventory, profile = null) {
    this.inventory = inventory;
    this.profile = profile;
  }

  /* ================================================================
   *  BUYING
   * ================================================================ */

  buySeed(plantType) {
    const def = PLANT_TYPES[plantType];
    if (!def) return { success: false, message: `Unknown plant type: ${plantType}` };

    if (this.profile && def.unlockLevel && this.profile.level < def.unlockLevel) {
      return { success: false, message: `Locked! Requires Level ${def.unlockLevel}.` };
    }

    const cost = def.seedCost;
    if (!this.inventory.removeCoins(cost)) {
      return { success: false, message: `Not enough coins! Need ${cost}, have ${this.inventory.getCoins()}.` };
    }

    this.inventory.addItem(`${plantType}_seed`, 1);
    return { success: true, message: `Bought 1 ${def.name} Seed for ${cost} coins.` };
  }

  buyKey(keyType) {
    const keys = {
      key_zone2: { name: 'Artisan Key', cost: 1000, level: 3, desc: 'Unlocks Zone 2 (Artisan Refineries).' },
      key_zone3: { name: 'Mining Key', cost: 5000, level: 5, desc: 'Unlocks Zone 3 (Mining Cave).' },
      key_zone4: { name: 'Lab Key', cost: 15000, level: 8, desc: 'Unlocks Zone 4 (Advanced Tech Lab).' }
    };
    const def = keys[keyType];
    if (!def) return { success: false, message: `Unknown key: ${keyType}` };

    if (this.profile && this.profile.level < def.level) {
      return { success: false, message: `Locked! Requires Level ${def.level}.` };
    }

    if (!this.inventory.removeCoins(def.cost)) {
      return { success: false, message: `Not enough coins! Need ${def.cost}, have ${this.inventory.getCoins()}.` };
    }

    this.inventory.addItem(keyType, 1);
    return { success: true, message: `Bought ${def.name} for ${def.cost} coins.` };
  }

  /**
   * Purchase a drone module item.
   * @param {string} moduleType – Key in MODULE_TYPES (e.g. 'farming').
   * @returns {{ success: boolean, message: string }}
   */
  buyModule(moduleType) {
    const def = MODULE_TYPES[moduleType];
    if (!def) return { success: false, message: `Unknown module: ${moduleType}` };

    const cost = def.cost;
    if (!this.inventory.removeCoins(cost)) {
      return { success: false, message: `Not enough coins! Need ${cost}, have ${this.inventory.getCoins()}.` };
    }

    this.inventory.addItem(MODULE_ITEM_IDS[moduleType], 1);
    return { success: true, message: `Bought ${def.name} for ${cost} coins.` };
  }

  /* ================================================================
   *  SELLING
   * ================================================================ */

  /**
   * Sell crops or refined items. Optionally pass an inventoryOverride for drone-side selling
   * (drone's DroneInventory) and a sell price multiplier. Coins always go to the player.
   */
  sellCrop(cropType, quantity = 1, inventoryOverride = null, multiplier = 1.0) {
    const inv = inventoryOverride || this.inventory;
    
    let name = '';
    let sellPrice = 0;
    
    if (PLANT_TYPES[cropType]) {
      name = PLANT_TYPES[cropType].name;
      sellPrice = PLANT_TYPES[cropType].sellPrice;
    } else if (REFINED_PRICES[cropType]) {
      name = REFINED_PRICES[cropType].name;
      sellPrice = REFINED_PRICES[cropType].sellPrice;
    } else {
      return { success: false, message: `Unknown crop or item: ${cropType}`, earned: 0 };
    }

    const have = inv.getItemCount ? inv.getItemCount(cropType) : (inv.items?.get(cropType) || 0);
    if (have < quantity) {
      return { success: false, message: `Not enough ${name}! Have ${have}.`, earned: 0 };
    }

    if (inv.removeItem) {
      inv.removeItem(cropType, quantity);
    }
    const baseEarned = sellPrice * quantity;
    const earned = Math.floor(baseEarned * multiplier);
    this.inventory.addCoins(earned);

    return { success: true, message: `Sold ${quantity} ${name} for ${earned} coins.`, earned };
  }

  /* ================================================================
   *  PRICE QUERIES
   * ================================================================ */

  getSeedPrice(plantType) { return PLANT_TYPES[plantType]?.seedCost ?? 0; }
  getSellPrice(cropType) {
    if (PLANT_TYPES[cropType]) return PLANT_TYPES[cropType].sellPrice;
    if (REFINED_PRICES[cropType]) return REFINED_PRICES[cropType].sellPrice;
    return 0;
  }

  getDroneCost(currentDroneCount) {
    const costs = {
      1: 500,
      2: 1000,
      3: 2000,
      4: 5000
    };
    return costs[currentDroneCount] || 5000;
  }

  getShopItems() {
    const list = Object.entries(PLANT_TYPES).map(([id, def]) => ({
      id,
      name: def.name,
      description: def.description,
      seedCost: def.seedCost,
      sellPrice: def.sellPrice,
      isKey: false,
      unlockLevel: def.unlockLevel || 1
    }));

    // Add progression keys
    list.push({
      id: 'key_zone2',
      name: 'Artisan Key',
      description: 'Key to unlock Zone 2: Artisan Refineries. Consume at Zone 2 gate.',
      seedCost: 1000,
      sellPrice: 0,
      isKey: true,
      unlockLevel: 3
    });
    list.push({
      id: 'key_zone3',
      name: 'Mining Key',
      description: 'Key to unlock Zone 3: Mining Cave. Consume at Zone 3 gate.',
      seedCost: 5000,
      sellPrice: 0,
      isKey: true,
      unlockLevel: 5
    });
    list.push({
      id: 'key_zone4',
      name: 'Lab Key',
      description: 'Key to unlock Zone 4: Advanced Tech Lab. Consume at Zone 4 gate.',
      seedCost: 15000,
      sellPrice: 0,
      isKey: true,
      unlockLevel: 8
    });

    return list;
  }

  getShopModules() {
    const buyableKeys = ['farming', 'supplier', 'seller', 'mining'];
    return Object.entries(MODULE_TYPES)
      .filter(([id]) => buyableKeys.includes(id))
      .map(([id, def]) => ({
        id,
        itemId: MODULE_ITEM_IDS[id],
        name: def.name,
        emoji: def.emoji,
        description: def.description,
        cost: def.cost,
      }));
  }
}
