/**
 * @fileoverview Plant / crop definitions.
 *
 * Each entry describes a plantable crop or tree.
 *   - type 'non-fruit' : harvested once (the whole plant is consumed).
 *   - type 'fruit'     : stays alive after harvest and regrows fruit.
 */

export const PLANT_TYPES = {
  wheat: {
    name: 'Wheat',
    type: 'non-fruit',
    stages: 4,
    growthTicks: 6,           // 6 ticks → 30 s to fully grow
    sellPrice: 15,
    seedCost: 5,
    harvestYield: { min: 1, max: 3 },
    unlockLevel: 1,
    description: 'A staple crop. Quick to grow, reliable income.',
  },
  potato: {
    name: 'Potato',
    type: 'non-fruit',
    stages: 4,
    growthTicks: 9,           // 9 ticks → 45 s
    sellPrice: 22,
    seedCost: 10,
    harvestYield: { min: 2, max: 4 },
    unlockLevel: 2,
    description: 'Hearty tuber. Slower growth but better returns.',
  },
  apple_tree: {
    name: 'Apple Tree',
    type: 'fruit',
    stages: 4,
    growthTicks: 18,          // 18 ticks → 90 s to mature
    sellPrice: 30,
    seedCost: 25,
    harvestYield: { min: 1, max: 2 },
    regrowTicks: 6,           // 6 ticks → 30 s to regrow fruit
    unlockLevel: 4,
    description: 'Long investment. Produces fruit repeatedly once mature.',
  },
  cactus: {
    name: 'Cactus',
    type: 'fruit',
    stages: 4,
    growthTicks: 12,          // 12 ticks → 60 s
    sellPrice: 25,
    seedCost: 18,
    harvestYield: { min: 1, max: 2 },
    regrowTicks: 5,           // 5 ticks → 25 s to regrow fruit
    unlockLevel: 3,
    description: "Desert plant. Doesn't need much water to regrow.",
  },
};

/** Convenience array of plant keys (e.g. ['wheat', 'potato', …]) */
export const PLANT_NAMES = Object.keys(PLANT_TYPES);
