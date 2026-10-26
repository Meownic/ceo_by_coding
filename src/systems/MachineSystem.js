/**
 * @fileoverview MachineSystem — manages item refinement and artisan crafting refineries.
 *
 * Each machine has a specific type, input buffers, output buffers, and processes recipes.
 */

export const RECIPES = {
  crafting_table: [
    {
      inputs: { copper_ingot: 1, iron_ingot: 1 },
      output: { id: 'conveyor_kit', count: 1 },
      timeMs: 5000,
      name: 'Assemble Conveyor Kit',
    },
    {
      inputs: { stone: 12, iron_ingot: 4 },
      output: { id: 'warehouse_depot_kit', count: 1 },
      timeMs: 12000,
      name: 'Assemble Warehouse Depot Kit',
    },
  ],
  mill: {
    inputs: { wheat: 2 },
    output: { id: 'flour', count: 1 },
    timeMs: 10000,
    name: 'Grind Wheat into Flour',
  },
  bakery: {
    inputs: { flour: 2 },
    output: { id: 'bread', count: 1 },
    timeMs: 15000,
    name: 'Bake Flour into Bread',
  },
  press: {
    inputs: { apple_tree: 2 },
    output: { id: 'apple_juice', count: 1 },
    timeMs: 10000,
    name: 'Press Apples into Apple Juice',
  },
  boiler: {
    inputs: { apple_juice: 2 },
    output: { id: 'apple_jam', count: 1 },
    timeMs: 15000,
    name: 'Boil Apple Juice into Apple Jam',
  },
  purifier: {
    inputs: { potato: 2 },
    output: { id: 'potato_starch', count: 1 },
    timeMs: 10000,
    name: 'Purify Potatoes into Starch',
  },
  fryer: {
    inputs: { potato_starch: 2 },
    output: { id: 'chips', count: 1 },
    timeMs: 15000,
    name: 'Fry Starch into Potato Chips',
  },
  smelter: [
    {
      inputs: { copper_ore: 2, coal: 1 },
      output: { id: 'copper_ingot', count: 1 },
      timeMs: 12000,
      name: 'Smelt Copper Ingot',
    },
    {
      inputs: { iron_ore: 2, coal: 1 },
      output: { id: 'iron_ingot', count: 1 },
      timeMs: 12000,
      name: 'Smelt Iron Ingot',
    },
  ],
  assembler: [
    {
      inputs: { copper_ingot: 2 },
      output: { id: 'wire', count: 3 },
      timeMs: 15000,
      name: 'Assemble Copper Wire',
    },
    {
      inputs: { iron_ingot: 2 },
      output: { id: 'gear', count: 2 },
      timeMs: 15000,
      name: 'Assemble Iron Gear',
    },
  ],
  module_crafter: [
    {
      inputs: { wire: 1, gear: 1, copper_ingot: 2 },
      output: { id: 'module_mining', count: 1 },
      timeMs: 20000,
      name: 'Forge Mining Module',
    },
    {
      inputs: { wire: 5, gear: 5, iron_ingot: 10 },
      output: { id: 'module_bigger_seller', count: 1 },
      timeMs: 25000,
      name: 'Forge Bigger Seller Module',
    },
    {
      inputs: { wire: 10, gear: 10, iron_ingot: 20 },
      output: { id: 'module_super_carrier', count: 1 },
      timeMs: 30000,
      name: 'Forge Super Carrier Module',
    },
    {
      inputs: { wire: 5, gear: 5, copper_ingot: 5, iron_ingot: 5 },
      output: { id: 'module_advanced_farming', count: 1 },
      timeMs: 25000,
      name: 'Forge Advanced Farming Module',
    },
    {
      inputs: { wire: 5, gear: 5, copper_ingot: 10 },
      output: { id: 'module_speed_booster', count: 1 },
      timeMs: 25000,
      name: 'Forge Speed Booster Module',
    },
  ],
};

export default class MachineSystem {
  constructor() {
    /** @type {Map<string, object>} Map of machineId -> state */
    this.machines = new Map();
  }

  /**
   * Register a new machine in the system.
   * @param {string} id - Unique identifier (e.g. 'mill_001')
   * @param {string} type - Machine type matching RECIPES keys (e.g. 'mill')
   * @param {number} x - Grid X position
   * @param {number} y - Grid Y position
   */
  registerMachine(id, type, x, y) {
    if (this.machines.has(id)) return;

    this.machines.set(id, {
      id,
      type,
      x,
      y,
      inputBuffer: new Map(),
      outputBuffer: new Map(),
      activeRecipe: null,
      timeRemaining: 0,
      maxTime: 0,
    });
  }

  /**
   * Get the current state of a machine.
   * @param {string} id
   * @returns {object|null}
   */
  getMachineState(id) {
    const machine = this.machines.get(id);
    if (!machine) return null;

    const inputs = [];
    for (const [itemId, count] of machine.inputBuffer) {
      inputs.push({ id: itemId, count });
    }

    const outputs = [];
    for (const [itemId, count] of machine.outputBuffer) {
      outputs.push({ id: itemId, count });
    }

    const isProcessing = machine.activeRecipe !== null;
    const progress = isProcessing
      ? ((machine.maxTime - machine.timeRemaining) / machine.maxTime) * 100
      : 0;

    return {
      id: machine.id,
      type: machine.type,
      inputs,
      outputs,
      isProcessing,
      progress: Math.min(100, Math.max(0, progress)),
      activeRecipeName: machine.activeRecipe ? machine.activeRecipe.name : null,
      timeRemaining: Math.ceil(machine.timeRemaining / 1000), // in seconds
    };
  }

  /**
   * Deposit an item into a machine.
   * @param {string} id
   * @param {string} itemId
   * @param {number} qty
   * @returns {number} Amount actually deposited.
   */
  deposit(id, itemId, qty) {
    const machine = this.machines.get(id);
    if (!machine) return 0;

    const current = machine.inputBuffer.get(itemId) || 0;
    machine.inputBuffer.set(itemId, current + qty);

    // Try starting a recipe after deposit
    this._tryStartRecipe(machine);

    return qty;
  }

  /**
   * Retrieve all outputs from a machine.
   * @param {string} id
   * @returns {{id: string, count: number}[]}
   */
  retrieve(id) {
    const machine = this.machines.get(id);
    if (!machine) return [];

    const result = [];
    for (const [itemId, count] of machine.outputBuffer) {
      result.push({ id: itemId, count });
    }

    machine.outputBuffer.clear();
    return result;
  }

  /**
   * Core tick update. Called from GameScene update.
   * @param {number} delta - Frame delta in ms
   */
  update(delta) {
    for (const machine of this.machines.values()) {
      if (machine.activeRecipe) {
        machine.timeRemaining -= delta;
        if (machine.timeRemaining <= 0) {
          this._completeRecipe(machine);
        }
      }
    }
  }

  /**
   * Attempt to find and start a valid recipe based on inputs.
   * @private
   * @param {object} machine
   */
  _tryStartRecipe(machine) {
    if (machine.activeRecipe) return; // Already processing

    const recipeList = RECIPES[machine.type];
    if (!recipeList) return;

    // Check if the recipe list is an array or a single recipe
    const recipesToCheck = Array.isArray(recipeList) ? recipeList : [recipeList];

    for (const recipe of recipesToCheck) {
      let canCraft = true;

      // Verify inputs
      for (const [reqId, reqCount] of Object.entries(recipe.inputs)) {
        const hasCount = machine.inputBuffer.get(reqId) || 0;
        if (hasCount < reqCount) {
          canCraft = false;
          break;
        }
      }

      if (canCraft) {
        // Deduct inputs
        for (const [reqId, reqCount] of Object.entries(recipe.inputs)) {
          const current = machine.inputBuffer.get(reqId);
          if (current === reqCount) {
            machine.inputBuffer.delete(reqId);
          } else {
            machine.inputBuffer.set(reqId, current - reqCount);
          }
        }

        // Start recipe
        machine.activeRecipe = recipe;
        machine.timeRemaining = recipe.timeMs;
        machine.maxTime = recipe.timeMs;
        break; // Process one recipe at a time
      }
    }
  }

  /**
   * Complete the active recipe, moving result to output buffer.
   * @private
   * @param {object} machine
   */
  _completeRecipe(machine) {
    const recipe = machine.activeRecipe;
    if (!recipe) return;

    const outId = recipe.output.id;
    const outCount = recipe.output.count;

    const current = machine.outputBuffer.get(outId) || 0;
    machine.outputBuffer.set(outId, current + outCount);

    machine.activeRecipe = null;
    machine.timeRemaining = 0;
    machine.maxTime = 0;

    // Try starting the next one immediately if inputs exist
    this._tryStartRecipe(machine);
  }

  /**
   * Dump states for saving.
   */
  getSaveState() {
    const states = [];
    for (const [id, m] of this.machines) {
      states.push({
        id,
        type: m.type,
        x: m.x,
        y: m.y,
        inputBuffer: Array.from(m.inputBuffer.entries()),
        outputBuffer: Array.from(m.outputBuffer.entries()),
        activeRecipeName: m.activeRecipe ? m.activeRecipe.name : null,
        timeRemaining: m.timeRemaining,
        maxTime: m.maxTime,
      });
    }
    return states;
  }

  /**
   * Restore states from saving.
   */
  loadSaveState(states) {
    if (!Array.isArray(states)) return;
    this.machines.clear();

    for (const s of states) {
      const machine = {
        id: s.id,
        type: s.type,
        x: s.x,
        y: s.y,
        inputBuffer: new Map(s.inputBuffer),
        outputBuffer: new Map(s.outputBuffer),
        activeRecipe: null,
        timeRemaining: s.timeRemaining || 0,
        maxTime: s.maxTime || 0,
      };

      // Re-map active recipe if it was processing
      if (s.activeRecipeName) {
        const recipeList = RECIPES[s.type];
        if (recipeList) {
          const list = Array.isArray(recipeList) ? recipeList : [recipeList];
          const matched = list.find(r => r.name === s.activeRecipeName);
          if (matched) {
            machine.activeRecipe = matched;
          }
        }
      }

      this.machines.set(s.id, machine);
    }
  }
}
