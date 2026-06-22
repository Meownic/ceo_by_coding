/**
 * @fileoverview GrowthSystem – Phaser-friendly wrapper that drives
 * GridManager.update() on a fixed tick interval and emits events
 * whenever a plant changes growth stage or bears fruit.
 *
 * Usage inside a Phaser Scene:
 *   create() {
 *     this.growthSystem = new GrowthSystem(this.gridManager);
 *     this.growthSystem.events.on('stage-change', ({ x, y, stage }) => { ... });
 *     this.growthSystem.events.on('fruit-ready',  ({ x, y })        => { ... });
 *   }
 *   update(time, delta) {
 *     this.growthSystem.update(time, delta);
 *   }
 */

import Phaser from 'phaser';
import { GROWTH_TICK_MS, GROWTH_STAGES } from '../config/constants.js';
import { PLANT_TYPES } from '../data/plants.js';

export default class GrowthSystem {
  /**
   * @param {import('./GridManager.js').default} gridManager
   */
  constructor(gridManager) {
    /** @type {import('./GridManager.js').default} */
    this.grid = gridManager;

    /**
     * Phaser event emitter for growth-related events.
     *
     * Events emitted:
     *  - `'stage-change'`  → `{ x, y, stage, plantType }`
     *  - `'fruit-ready'`   → `{ x, y, plantType }`
     *  - `'growth-tick'`   → (no payload, fired once per tick)
     */
    this.events = new Phaser.Events.EventEmitter();

    /**
     * Accumulator for the fixed-tick timer (in ms).
     * @type {number}
     * @private
     */
    this._tickAccumulator = 0;

    /**
     * Snapshot of every tile's growth stage & fruit state taken at the
     * *start* of each tick so we can diff after GridManager.update().
     * Keyed as `"x,y"` → `{ stage, hasFruit }`.
     * @type {Map<string, { stage: number, hasFruit: boolean }>}
     * @private
     */
    this._snapshot = new Map();
  }

  // ────────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────────

  /**
   * Call once per Phaser frame.  Internally accumulates `delta` and
   * only fires a growth tick when GROWTH_TICK_MS has been reached.
   *
   * @param {number} _time  Phaser scene time (ms) – unused, kept for API compat.
   * @param {number} delta  Milliseconds since last frame.
   */
  update(_time, delta) {
    this._tickAccumulator += delta;

    if (this._tickAccumulator < GROWTH_TICK_MS) return;

    // Process one tick (don't let the accumulator pile up multiple
    // ticks in a single frame – keeps the event stream predictable).
    this._tickAccumulator -= GROWTH_TICK_MS;

    this._takeSnapshot();

    // Let GridManager advance all tiles
    this.grid.update(Date.now());

    this._diffAndEmit();

    this.events.emit('growth-tick');
  }

  /**
   * Handle the "premature harvest" penalty.
   * Resets the plant's growth back to stage 0 and clears elapsed ticks.
   * (Called externally when a player/drone crops a plant before maturity.)
   *
   * @param {number} x
   * @param {number} y
   */
  applyPrematureHarvestPenalty(x, y) {
    const tile = this.grid.getTile(x, y);
    if (!tile || !tile.hasPlant) return;

    tile.growthStage = 0;
    tile.growthTicksElapsed = 0;
    tile.lastGrowthTime = Date.now();

    this.events.emit('stage-change', {
      x,
      y,
      stage: 0,
      plantType: tile.plantType,
    });
  }

  /**
   * Notify the system that fruit was just harvested so it can begin
   * tracking the regrow timer.  GridManager.harvestFruit() already
   * resets the counters, so this is purely for emitting events later.
   *
   * @param {number} x
   * @param {number} y
   */
  onFruitHarvested(x, y) {
    const tile = this.grid.getTile(x, y);
    if (!tile || !tile.hasPlant) return;

    const def = PLANT_TYPES[tile.plantType];
    if (!def || def.type !== 'fruit') return;

    // Nothing to do right now – the regrow will be picked up by
    // _diffAndEmit on the tick where hasFruit flips back to true.
  }

  // ────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────

  /**
   * Snapshot every planted tile's stage & fruit flag.
   * @private
   */
  _takeSnapshot() {
    this._snapshot.clear();
    for (let y = 0; y < this.grid.rows; y++) {
      for (let x = 0; x < this.grid.cols; x++) {
        const tile = this.grid.tiles[y][x];
        if (!tile.hasPlant) continue;
        this._snapshot.set(`${x},${y}`, {
          stage: tile.growthStage,
          hasFruit: tile.hasFruit,
        });
      }
    }
  }

  /**
   * Compare current tile state to the snapshot and emit events
   * for any changes.
   * @private
   */
  _diffAndEmit() {
    for (let y = 0; y < this.grid.rows; y++) {
      for (let x = 0; x < this.grid.cols; x++) {
        const tile = this.grid.tiles[y][x];
        if (!tile.hasPlant) continue;

        const key = `${x},${y}`;
        const prev = this._snapshot.get(key);

        // Brand new plant (planted between ticks) – no diff to report
        if (!prev) continue;

        // Growth stage advanced
        if (tile.growthStage !== prev.stage) {
          this.events.emit('stage-change', {
            x,
            y,
            stage: tile.growthStage,
            plantType: tile.plantType,
          });
        }

        // Fruit just became ready
        if (tile.hasFruit && !prev.hasFruit) {
          this.events.emit('fruit-ready', {
            x,
            y,
            plantType: tile.plantType,
          });
        }
      }
    }
  }
}
