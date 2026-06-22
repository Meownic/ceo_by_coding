/**
 * @fileoverview Drone entity – the player's programmable farming drone.
 *
 * Extends Phaser.GameObjects.Sprite and lives on the tile grid.
 * Each drone has a unique ID, a limited-capacity inventory, and a single
 * module slot that unlocks different farming/logistics abilities.
 *
 * Renders a shadow, a bobbing sprite, and a small status-LED circle
 * that changes colour based on execution state.
 */

import Phaser from 'phaser';
import {
  TILE_SIZE,
  DRONE_MOVE_SPEED,
  DRONE_ACTION_DELAY,
  DRONE_BASE_INVENTORY,
  DRONE_SUPPLIER_BONUS,
  DRONE_SELLER_BONUS,
  COLORS,
} from '../config/constants.js';
import { MODULE_TYPES } from '../data/modules.js';
import DroneAPI from '../systems/DroneAPI.js';
import ScriptSandbox from '../systems/ScriptSandbox.js';

// LED colours for each status
const STATUS_COLORS = {
  idle:    COLORS.DRONE_GREEN,
  running: 0xffff00,  // yellow
  error:   COLORS.DRONE_RED,
  paused:  0xff8800,  // orange
};

/** Counter for generating unique drone IDs */
let _droneIdCounter = 0;

/**
 * @class DroneInventory
 * Internal inventory container for drones with capacity management.
 */
class DroneInventory {
  /**
   * @param {number} capacity - Maximum number of total items
   */
  constructor(capacity) {
    /** @type {number} */
    this.capacity = capacity;
    /** @type {Map<string, number>} */
    this.items = new Map();
  }

  /** Total number of items currently held */
  getTotalCount() {
    let total = 0;
    for (const count of this.items.values()) total += count;
    return total;
  }

  /**
   * Add items — returns false if capacity would be exceeded.
   * @param {string} itemId
   * @param {number} qty
   * @returns {boolean}
   */
  addItem(itemId, qty = 1) {
    if (this.getTotalCount() + qty > this.capacity) return false;
    const current = this.items.get(itemId) || 0;
    this.items.set(itemId, current + qty);
    return true;
  }

  /**
   * Remove items — returns false if not enough.
   * @param {string} itemId
   * @param {number} qty
   * @returns {boolean}
   */
  removeItem(itemId, qty = 1) {
    const current = this.items.get(itemId) || 0;
    if (current < qty) return false;
    const newCount = current - qty;
    if (newCount === 0) {
      this.items.delete(itemId);
    } else {
      this.items.set(itemId, newCount);
    }
    return true;
  }

  /**
   * Check if holding at least qty of item.
   * @param {string} itemId
   * @param {number} qty
   * @returns {boolean}
   */
  hasItem(itemId, qty = 1) {
    return (this.items.get(itemId) || 0) >= qty;
  }

  /**
   * Get count of a specific item.
   * @param {string} itemId
   * @returns {number}
   */
  getItemCount(itemId) {
    return this.items.get(itemId) || 0;
  }

  /**
   * Return all items as array of {id, count}.
   * @returns {{ id: string, count: number }[]}
   */
  getAll() {
    const result = [];
    for (const [id, count] of this.items) {
      result.push({ id, count });
    }
    return result;
  }

  /** Clear all items */
  clear() {
    this.items.clear();
  }
}

/**
 * @class Drone
 * @extends Phaser.GameObjects.Sprite
 *
 * A tile-based drone that can be scripted by the player.
 */
export default class Drone extends Phaser.GameObjects.Sprite {
  /**
   * @param {Phaser.Scene} scene  – The owning scene.
   * @param {number}       tx     – Starting tile-X coordinate.
   * @param {number}       ty     – Starting tile-Y coordinate.
   * @param {object}       gridManager – Reference to the grid manager.
   * @param {object}       profileSystem - Reference to the profile system.
   * @param {string}       [id]   – Optional unique ID (auto-generated if omitted).
   */
  constructor(scene, tx, ty, gridManager, profileSystem, id) {
    // Convert tile coords → pixel centre
    const px = tx * TILE_SIZE + TILE_SIZE / 2;
    const py = ty * TILE_SIZE + TILE_SIZE / 2;

    super(scene, px, py, 'drone');

    /** @type {string} Unique drone identifier */
    if (!id) {
      _droneIdCounter++;
      this.id = `drone-${String(_droneIdCounter).padStart(3, '0')}`;
      this.label = `Drone ${_droneIdCounter}`;
    } else {
      this.id = id;
      const numMatch = id.match(/drone-(\d+)/);
      const num = numMatch ? parseInt(numMatch[1], 10) : 1;
      this.label = `Drone ${num}`;
    }

    /** @type {number} Current tile-X */
    this.tileX = tx;
    /** @type {number} Current tile-Y */
    this.tileY = ty;

    /** @type {number} Spawn tile-X */
    this.spawnX = tx;
    /** @type {number} Spawn tile-Y */
    this.spawnY = ty;

    /** @type {boolean} True while a script is being executed */
    this.isExecuting = false;

    /** @type {'idle'|'running'|'error'|'paused'} */
    this.status = 'idle';

    /** @type {string|null} Currently equipped module type key */
    this.module = null;

    /** @type {string} Facing direction */
    this.facing = 'down';

    /** @type {object} */
    this.gridManager = gridManager;

    /** @type {object} */
    this.profileSystem = profileSystem;

    // Setup script execution context
    this.droneAPI = new DroneAPI(
      this,
      gridManager,
      scene.inventorySystem,
      profileSystem,
      scene.economySystem,
      scene.warehouse,
      scene.deviceManager
    );
    this.scriptSandbox = new ScriptSandbox(this.droneAPI, profileSystem);

    // ── Drone inventory ────────────────────────────────────────────
    this.droneInventory = new DroneInventory(DRONE_BASE_INVENTORY);

    // ── Add to scene ─────────────────────────────────────────────
    scene.add.existing(this);
    this.setDepth(15);

    // ── Shadow (ellipse drawn below the sprite) ──────────────────
    this.shadow = scene.add.ellipse(px, py + 12, 20, 8, 0x000000, 0.3);
    this.shadow.setDepth(14);

    // ── Status LED (small circle above the sprite) ───────────────
    this.statusIndicator = scene.add.circle(px, py - 14, 4, STATUS_COLORS.idle);
    this.statusIndicator.setDepth(16);

    // ── ID label (small text below the drone) ────────────────────
    this.idLabel = scene.add.text(px, py + 18, this.label, {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '18px',
      color: '#00ffcc',
      alpha: 0.9,
      resolution: 4,
    }).setOrigin(0.5, 0).setDepth(16).setScale(0.4);

    // ── Idle bobbing animation ───────────────────────────────────
    this._startBobbing();

    // ── Event emitter for inventory changes ──────────────────────
    this.events = new Phaser.Events.EventEmitter();
  }

  /* ================================================================
   *  PUBLIC METHODS
   * ================================================================ */

  /**
   * Get the current maximum inventory capacity (base + module bonus).
   * @returns {number}
   */
  getInventoryCapacity() {
    if (!this.module) return DRONE_BASE_INVENTORY;
    const mod = MODULE_TYPES[this.module];
    if (!mod) return DRONE_BASE_INVENTORY;
    return DRONE_BASE_INVENTORY + mod.inventoryBonus;
  }

  /**
   * Equip a module. Updates the drone inventory capacity.
   * @param {string|null} moduleType - Module type key, or null to unequip
   * @returns {{ success: boolean, message: string }}
   */
  equipModule(moduleType) {
    if (moduleType && !MODULE_TYPES[moduleType]) {
      return { success: false, message: `Unknown module type: ${moduleType}` };
    }
    this.module = moduleType;
    this.droneInventory.capacity = this.getInventoryCapacity();
    this.events.emit('module-changed', { module: moduleType, droneId: this.id });
    return { success: true, message: moduleType ? `Equipped ${MODULE_TYPES[moduleType].name}` : 'Module unequipped' };
  }

  /**
   * Check if this drone has a specific module ability.
   *
   * Design: Basic farming (till/water/plant/crop/harvest) is available on ALL drones.
   * Advanced economy/logistics abilities require specific modules:
   *   - sell, buy → Seller Module
   *   - supplyFrom, transferTo → Supplier Module
   *
   * @param {string} ability
   * @returns {boolean}
   */
  hasAbility(ability) {
    // Basic farming is always available — no module required
    const basicAbilities = ['till', 'water', 'plant', 'crop', 'harvest'];
    if (basicAbilities.includes(ability)) return true;

    // Advanced abilities require the appropriate module
    if (!this.module) return false;
    const mod = MODULE_TYPES[this.module];
    return mod ? mod.abilities.includes(ability) : false;
  }

  /**
   * Snap the drone to a tile position (no animation).
   * @param {number} tx – Tile-X
   * @param {number} ty – Tile-Y
   */
  setTilePosition(tx, ty) {
    this.tileX = tx;
    this.tileY = ty;

    const px = tx * TILE_SIZE + TILE_SIZE / 2;
    const py = ty * TILE_SIZE + TILE_SIZE / 2;

    if (this._bobTween) {
      this._bobTween.stop();
      this._bobTween = null;
    }

    this.setPosition(px, py);
    this._syncAttachments();

    this._startBobbing();
  }

  /**
   * Update status and recolour the LED.
   * @param {'idle'|'running'|'error'|'paused'} newStatus
   */
  setStatus(newStatus) {
    this.status = newStatus;
    this.isExecuting = newStatus === 'running';

    const colour = STATUS_COLORS[newStatus] ?? STATUS_COLORS.idle;
    this.statusIndicator.setFillStyle(colour);
    this.events.emit('status-changed', { status: newStatus, droneId: this.id });
  }

  /**
   * Perform a named action with a visual delay.
   * Resolves after the delay so callers can `await` it.
   *
   * @param {string} actionName – e.g. 'water', 'crop', 'till'
   * @param  {...any} args
   * @returns {Promise<void>}
   */
  async executeAction(actionName, ...args) {
    this.animateAction(actionName);

    let delay = this.profileSystem ? this.profileSystem.getUpgradeValue('action') : DRONE_ACTION_DELAY;
    if (this.module === 'advanced_farming') {
      delay = Math.floor(delay / 2);
    }
    return new Promise((resolve) => {
      this.scene.time.delayedCall(delay, resolve);
    });
  }

  /**
   * Return the drone's current tile coordinates.
   * @returns {{ x: number, y: number }}
   */
  getPosition() {
    return { x: this.tileX, y: this.tileY };
  }

  /**
   * Move one tile in the given direction with a smooth tween.
   *
   * @param {'up'|'down'|'left'|'right'} direction
   * @returns {Promise<boolean>} Resolves `true` if the move succeeded.
   */
  moveTo(direction) {
    const deltas = {
      up:    { dx:  0, dy: -1 },
      down:  { dx:  0, dy:  1 },
      left:  { dx: -1, dy:  0 },
      right: { dx:  1, dy:  0 },
    };

    const delta = deltas[direction];
    if (!delta) {
      console.warn(`Drone.moveTo: unknown direction "${direction}"`);
      return Promise.resolve(false);
    }

    const newTX = this.tileX + delta.dx;
    const newTY = this.tileY + delta.dy;

    // Bounds check
    const cols = this.gridManager ? this.gridManager.cols : GRID_COLS;
    const rows = this.gridManager ? this.gridManager.rows : GRID_ROWS;

    if (newTX < 0 || newTX >= cols || newTY < 0 || newTY >= rows) {
      // Snap immediately back to spawn position
      this.setTilePosition(this.spawnX, this.spawnY);
      
      // Stop bobbing and set error status
      this.setStatus('error');
      
      // Throw rejection error
      throw new Error(`Out of bounds! Drone attempted to fly outside the grid to (${newTX}, ${newTY}) and was forced to emergency reset to spawn point (${this.spawnX}, ${this.spawnY}).`);
    }

    // Bounds check (grid manager may also reject the move)
    if (this.gridManager && typeof this.gridManager.isWalkable === 'function') {
      if (!this.gridManager.isWalkable(newTX, newTY, true)) {
        return Promise.resolve(false);
      }
    }

    // Stop bobbing tween to prevent property collision on y during tween
    if (this._bobTween) {
      this._bobTween.stop();
      this._bobTween = null;
    }

    // Pixel targets
    const targetX = newTX * TILE_SIZE + TILE_SIZE / 2;
    const targetY = newTY * TILE_SIZE + TILE_SIZE / 2;

    // Update logical position immediately so queued actions see the new tile
    this.tileX = newTX;
    this.tileY = newTY;
    this.facing = direction;

    // Target duration from profile upgrades
    let duration = this.profileSystem ? this.profileSystem.getUpgradeValue('speed') : DRONE_MOVE_SPEED;
    if (this.module === 'speed_booster') {
      duration = Math.floor(duration / 2);
    }

    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        x: targetX,
        y: targetY,
        duration: duration,
        ease: 'Power2',
        onUpdate: () => this._syncAttachments(),
        onComplete: () => {
          this._syncAttachments();
          // Restart bobbing around the new position
          this._startBobbing();
          resolve(true);
        },
      });
    });
  }

  /**
   * Play a small visual effect that corresponds to the given action.
   * @param {string} actionName
   */
  animateAction(actionName) {
    const scene = this.scene;
    if (!scene) return;

    switch (actionName) {
      case 'water': {
        for (let i = 0; i < 5; i++) {
          const drop = scene.add.circle(
            this.x + Phaser.Math.Between(-8, 8),
            this.y + 8,
            2,
            0x4488ff,
            0.8,
          );
          drop.setDepth(16);
          scene.tweens.add({
            targets: drop,
            y: drop.y + 16,
            alpha: 0,
            duration: 400,
            delay: i * 60,
            onComplete: () => drop.destroy(),
          });
        }
        break;
      }

      case 'till': {
        for (let i = 0; i < 4; i++) {
          const dust = scene.add.circle(
            this.x + Phaser.Math.Between(-6, 6),
            this.y + 10,
            3,
            0x8b6914,
            0.6,
          );
          dust.setDepth(16);
          scene.tweens.add({
            targets: dust,
            y: dust.y - 8,
            alpha: 0,
            scaleX: 2,
            scaleY: 2,
            duration: 350,
            delay: i * 50,
            onComplete: () => dust.destroy(),
          });
        }
        break;
      }

      case 'mine': {
        for (let i = 0; i < 6; i++) {
          const spark = scene.add.circle(
            this.x + Phaser.Math.Between(-12, 12),
            this.y + 8,
            2,
            0xaaaaaa, // silver sparks for mining
            0.9
          );
          spark.setDepth(16);
          scene.tweens.add({
            targets: spark,
            x: spark.x + Phaser.Math.Between(-10, 10),
            y: spark.y + Phaser.Math.Between(10, 20),
            alpha: 0,
            duration: 400,
            delay: i * 50,
            onComplete: () => spark.destroy()
          });
        }
        break;
      }

      case 'crop':
      case 'harvest': {
        for (let i = 0; i < 6; i++) {
          const spark = scene.add.circle(
            this.x + Phaser.Math.Between(-10, 10),
            this.y,
            2,
            0x44ff44,
            0.9,
          );
          spark.setDepth(16);
          scene.tweens.add({
            targets: spark,
            y: spark.y - 20,
            alpha: 0,
            duration: 500,
            delay: i * 40,
            onComplete: () => spark.destroy(),
          });
        }
        break;
      }

      case 'plant': {
        const seed = scene.add.circle(this.x, this.y - 4, 3, 0xdaa520, 1);
        seed.setDepth(16);
        scene.tweens.add({
          targets: seed,
          y: this.y + 10,
          alpha: 0,
          duration: 350,
          onComplete: () => seed.destroy(),
        });
        break;
      }

      case 'flip': {
        scene.tweens.add({
          targets: this,
          scaleX: -this.scaleX,
          duration: 200,
          yoyo: true,
        });
        break;
      }

      case 'transfer': {
        // Quick pulse in gold to indicate item transfer
        scene.tweens.add({
          targets: this,
          alpha: 0.5,
          duration: 150,
          yoyo: true,
          repeat: 2,
          onComplete: () => { this.alpha = 1; },
        });
        break;
      }

      default:
        scene.tweens.add({
          targets: this,
          scaleX: 1.15,
          scaleY: 1.15,
          duration: 120,
          yoyo: true,
        });
        break;
    }
  }

  /* ================================================================
   *  PRIVATE HELPERS
   * ================================================================ */

  /**
   * Keep shadow, LED, and label in sync with the sprite position.
   * @private
   */
  _syncAttachments() {
    if (this.shadow) {
      this.shadow.setPosition(this.x, this.y + 12);
    }
    if (this.statusIndicator) {
      this.statusIndicator.setPosition(this.x, this.y - 14);
    }
    if (this.idLabel) {
      this.idLabel.setPosition(this.x, this.y + 18);
    }
    if (this.speechBubble) {
      this.speechBubble.setPosition(this.x, this.y);
    }
  }

  /**
   * Display a speech bubble container above the drone.
   */
  showSpeechBubble(text) {
    if (this.speechBubble) {
      this.speechBubble.destroy();
    }

    const padding = 8;
    const txt = this.scene.add.text(0, 0, text, {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '12px',
      color: '#000000',
      align: 'center',
      wordWrap: { width: 140 },
      resolution: 4,
    });

    const textWidth = txt.width;
    const textHeight = txt.height;

    const width = textWidth + padding * 2;
    const height = textHeight + padding * 2;

    const bubbleBg = this.scene.add.graphics();
    bubbleBg.fillStyle(0xffffff, 0.95);
    bubbleBg.lineStyle(1.5, 0x111122, 1);

    // Draw bubble rounded rect relative to container origin
    bubbleBg.fillRoundedRect(-width / 2, -height - 18, width, height, 4);
    bubbleBg.strokeRoundedRect(-width / 2, -height - 18, width, height, 4);

    // Tail pointing down
    const tailHeight = 6;
    const tailWidth = 8;
    bubbleBg.fillStyle(0xffffff, 0.95);
    bubbleBg.beginPath();
    bubbleBg.moveTo(-tailWidth / 2, -18);
    bubbleBg.lineTo(0, -18 + tailHeight);
    bubbleBg.lineTo(tailWidth / 2, -18);
    bubbleBg.closePath();
    bubbleBg.fill();
    bubbleBg.stroke();

    txt.setPosition(-textWidth / 2, -height - 18 + padding);
    txt.setDepth(18);
    bubbleBg.setDepth(17);

    this.speechBubble = this.scene.add.container(this.x, this.y);
    this.speechBubble.add([bubbleBg, txt]);
    this.speechBubble.setDepth(17);
  }

  /**
   * Clear the active speech bubble.
   */
  clearSpeechBubble() {
    if (this.speechBubble) {
      this.speechBubble.destroy();
      this.speechBubble = null;
    }
  }

  /**
   * Split long text into chunks of at most limit characters, keeping words intact.
   * @private
   */
  _splitTextIntoChunks(text, limit = 50) {
    if (text.length <= limit) return [text];
    const words = text.split(/\s+/);
    const chunks = [];
    let currentChunk = '';

    for (const word of words) {
      if ((currentChunk + ' ' + word).trim().length > limit) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = word;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + word;
      }
    }
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    return chunks;
  }

  /**
   * Display a message in speech bubbles sequentially.
   * @param {string} text
   * @returns {Promise<void>}
   */
  async say(text) {
    const chunks = this._splitTextIntoChunks(text, 50);

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      this.showSpeechBubble(chunk);

      const wordCount = chunk.split(/\s+/).length;
      const readDelay = Math.max(1200, wordCount * 350 + 800);

      await new Promise((resolve) => {
        this.scene.time.delayedCall(readDelay, resolve);
      });
    }

    this.clearSpeechBubble();
  }

  /**
   * Start the gentle idle bobbing tween (sine wave).
   * @private
   */
  _startBobbing() {
    this._bobTween = this.scene.tweens.add({
      targets: this,
      y: this.y - 3,
      duration: 1200,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      onUpdate: () => this._syncAttachments(),
    });
  }

  /**
   * Clean up when the drone is destroyed.
   */
  destroy(fromScene) {
    if (this._bobTween) this._bobTween.stop();
    if (this.shadow) this.shadow.destroy();
    if (this.statusIndicator) this.statusIndicator.destroy();
    if (this.idLabel) this.idLabel.destroy();
    if (this.speechBubble) this.speechBubble.destroy();
    super.destroy(fromScene);
  }
}
