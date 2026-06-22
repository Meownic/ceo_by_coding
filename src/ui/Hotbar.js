/**
 * @fileoverview Hotbar — in-game item bar rendered at the bottom-center of the screen.
 *
 * 8 slots. The active slot is selected with number keys 1–8 or clicking.
 * SPACE or clicking on the map uses the equipped item in the active slot.
 *
 * Items that can be hotbarred:
 *   'watering_can'   → waters the targeted tile
 *   'plow'           → tills the targeted tile
 *   'wheat_seed'     → plants wheat on the targeted tile
 *   'potato_seed'    → plants potato on the targeted tile
 *   'cactus_seed'    → plants cactus on the targeted tile
 *   'apple_tree_seed'→ plants apple_tree on the targeted tile
 *   (other items)    → shows "cannot use here" message
 */

import { HOTBAR_SLOTS, GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../config/constants.js';

/** Width/height of each hotbar slot */
const SLOT_SIZE = 36;
/** Gap between slots */
const SLOT_GAP = 4;
/** Total hotbar width */
const HOTBAR_W = HOTBAR_SLOTS * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP;
/** Margin from bottom of canvas */
const BOTTOM_MARGIN = 8;

/** Maps item ID to action type and plant type (if applicable) */
const ITEM_ACTIONS = {
  watering_can:    { action: 'water',   plantType: null },
  plow:            { action: 'till',    plantType: null },
  wheat_seed:      { action: 'plant',   plantType: 'wheat' },
  potato_seed:     { action: 'plant',   plantType: 'potato' },
  cactus_seed:     { action: 'plant',   plantType: 'cactus' },
  apple_tree_seed: { action: 'plant',   plantType: 'apple_tree' },
};

/** Emoji icons for items */
const ITEM_EMOJIS = {
  watering_can:    '🚿',
  plow:            '🔨',
  wheat_seed:      '🌾',
  potato_seed:     '🥔',
  cactus_seed:     '🌵',
  apple_tree_seed: '🍏',
  wheat:           '🌿',
  potato:          '🥔',
  cactus:          '🌵',
  apple_tree:      '🍎',
  module_farming:  '🌾',
  module_supplier: '📦',
  module_seller:   '💰',
};

export default class Hotbar {
  /**
   * @param {Phaser.Scene} scene
   * @param {import('../systems/InventorySystem.js').default} inventorySystem
   */
  constructor(scene, inventorySystem) {
    /** @type {Phaser.Scene} */
    this.scene = scene;
    /** @type {import('../systems/InventorySystem.js').default} */
    this.inventorySystem = inventorySystem;

    /** @type {Array<string|null>} Item ID in each slot, or null if empty */
    this.slots = new Array(HOTBAR_SLOTS).fill(null);

    /** @type {Array<number>} Quantity of item in each slot */
    this.slotQuantities = new Array(HOTBAR_SLOTS).fill(0);

    /** @type {number} Currently active slot index (0-based) */
    this.activeSlot = 0;

    // ── Calculate position ──────────────────────────────────────
    const startX = GAME_WIDTH / 2 - HOTBAR_W / 2;
    const startY = GAME_HEIGHT - SLOT_SIZE - BOTTOM_MARGIN;

    this._startX = startX;
    this._startY = startY;

    // ── Build slot graphics ──────────────────────────────────────
    this._slotBgs = [];
    this._slotTexts = [];
    this._slotCountTexts = [];
    this._slotKeyTexts = [];

    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const sx = startX + i * (SLOT_SIZE + SLOT_GAP);
      const sy = startY;
      const cx = sx + SLOT_SIZE / 2;
      const cy = sy + SLOT_SIZE / 2;

      // Slot background
      const bg = scene.add.rectangle(cx, cy, SLOT_SIZE, SLOT_SIZE, 0x0a0a1a, 0.85);
      bg.setStrokeStyle(1.5, i === 0 ? 0x00ffcc : 0x333355, 1);
      bg.setScrollFactor(0).setDepth(101);
      bg.setInteractive({ useHandCursor: true });
      
      // Make background draggable in Phaser
      scene.input.setDraggable(bg);

      // Handle selection or unequip clicks
      bg.on('pointerdown', (pointer) => {
        if (pointer.rightButtonDown()) {
          // Right-click: unequip item in slot back to backpack
          this.unequipSlot(i);
        } else {
          // Left-click: select slot
          this.setActiveSlot(i);
        }
      });

      // Handle slot drag sorting / unequip
      bg.on('dragstart', () => {
        bg.setScale(1.1);
        bg.setAlpha(0.7);
        bg.setDepth(110);
      });

      bg.on('drag', (pointer) => {
        // Track pointer screen coordinate directly
        bg.x = pointer.x;
        bg.y = pointer.y;

        // Move text elements along with the background rectangle
        this._slotTexts[i].setPosition(bg.x, bg.y - 4);
        this._slotCountTexts[i].setPosition(bg.x + 10, bg.y + 8);
        this._slotKeyTexts[i].setPosition(bg.x - SLOT_SIZE / 2 + 3, bg.y - SLOT_SIZE / 2 + 2);
      });

      bg.on('dragend', (pointer) => {
        bg.setScale(1);
        bg.setAlpha(0.85);
        bg.setDepth(101);

        // Calculate original slot positions
        const originalSx = startX + i * (SLOT_SIZE + SLOT_GAP);
        const originalSy = startY;
        const originalCx = originalSx + SLOT_SIZE / 2;
        const originalCy = originalSy + SLOT_SIZE / 2;

        // Check if dropped outside canvas or over the Monaco/Backpack DOM Editor panel
        const editorPanel = document.getElementById('editor-panel');
        if (editorPanel) {
          const rect = editorPanel.getBoundingClientRect();
          const cx = pointer.event.clientX;
          const cy = pointer.event.clientY;

          if (cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom) {
            // Dragged to editor panel -> unequip slot
            this.unequipSlot(i);
            // Reset visual position
            bg.setPosition(originalCx, originalCy);
            this._slotTexts[i].setPosition(originalCx, originalCy - 4);
            this._slotCountTexts[i].setPosition(originalCx + 10, originalCy + 8);
            this._slotKeyTexts[i].setPosition(originalSx + 3, originalSy + 2);
            return;
          }
        }

        // Check if dropped on another hotbar slot to swap
        const localX = pointer.x;
        const localY = pointer.y;
        const targetSlot = this.getSlotIndexAt(localX, localY);

        if (targetSlot !== -1 && targetSlot !== i) {
          // Swap item IDs
          const tempId = this.slots[i];
          this.slots[i] = this.slots[targetSlot];
          this.slots[targetSlot] = tempId;

          // Swap quantities
          const tempQty = this.slotQuantities[i];
          this.slotQuantities[i] = this.slotQuantities[targetSlot];
          this.slotQuantities[targetSlot] = tempQty;

          // Re-render both slots
          this._renderSlot(i);
          this._renderSlot(targetSlot);
        }

        // Return components back to their aligned grid positions
        bg.setPosition(originalCx, originalCy);
        this._slotTexts[i].setPosition(originalCx, originalCy - 4);
        this._slotCountTexts[i].setPosition(originalCx + 10, originalCy + 8);
        this._slotKeyTexts[i].setPosition(originalSx + 3, originalSy + 2);
      });

      this._slotBgs.push(bg);

      // Item emoji text
      const txt = scene.add.text(cx, cy - 4, '', {
        fontSize: '18px',
        resolution: 2,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
      this._slotTexts.push(txt);

      // Count badge
      const countTxt = scene.add.text(cx + 10, cy + 8, '', {
        fontFamily: '"Courier New", monospace',
        fontSize: '16px',
        color: '#ffffff',
        resolution: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(103).setScale(0.5);
      this._slotCountTexts.push(countTxt);

      // Key number hint
      const keyTxt = scene.add.text(sx + 3, sy + 2, String(i + 1), {
        fontFamily: '"Courier New", monospace',
        fontSize: '14px',
        color: '#555577',
        resolution: 3,
      }).setScrollFactor(0).setDepth(103).setScale(0.5);
      this._slotKeyTexts.push(keyTxt);
    }

    // ── Keyboard input ──────────────────────────────────────────
    this._setupKeys();

    // ── HTML Drag and Drop on Canvas Setup ──────────────────────
    this._setupDOMDropZone();
  }

  /* ================================================================
   *  HTML DRAG AND DROP INTEGRATION
   * ================================================================ */

  /** Bind DOM event listeners to the Phaser canvas for dragging items from HTML */
  _setupDOMDropZone() {
    const canvas = this.scene.sys.game.canvas;
    if (!canvas) return;

    this._dragOverHandler = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    };

    this._dropHandler = (e) => {
      e.preventDefault();
      const itemId = e.dataTransfer.getData('text/plain');
      if (!itemId) return;

      // Map client screen coordinate to local Phaser game coordinate
      const rect = canvas.getBoundingClientRect();
      const localX = (e.clientX - rect.left) * (GAME_WIDTH / rect.width);
      const localY = (e.clientY - rect.top) * (GAME_HEIGHT / rect.height);

      const slotIdx = this.getSlotIndexAt(localX, localY);
      if (slotIdx !== -1) {
        this.moveItemToHotbar(itemId, slotIdx);
      }
    };

    canvas.addEventListener('dragover', this._dragOverHandler);
    canvas.addEventListener('drop', this._dropHandler);
  }

  /** Calculate slot index (0-7) at the specified local canvas coordinate, or -1 */
  getSlotIndexAt(x, y) {
    if (y < this._startY || y > this._startY + SLOT_SIZE) return -1;

    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const sx = this._startX + i * (SLOT_SIZE + SLOT_GAP);
      if (x >= sx && x <= sx + SLOT_SIZE) {
        return i;
      }
    }
    return -1;
  }

  /* ================================================================
   *  PUBLIC API
   * ================================================================ */

  /**
   * Directly equips an item into the hotbar, with state management.
   * Pulls the item stack out of player inventory (making it 0 there).
   * Returns any pre-existing slot item back to player inventory.
   * 
   * @param {string} itemId
   * @param {number} slotIdx
   */
  moveItemToHotbar(itemId, slotIdx) {
    if (slotIdx < 0 || slotIdx >= HOTBAR_SLOTS) return;

    // Get current inventory quantity of the item
    let qty = this.inventorySystem.getItemCount(itemId);

    // Tools do not have count values, but verify the player possesses them
    const isTool = (itemId === 'plow' || itemId === 'watering_can');
    if (isTool) {
      if (!this.inventorySystem.hasItem(itemId, 1)) return;
      qty = 1;
    }

    if (qty <= 0) return;

    // If same item is already in that slot: merge quantities (for non-tools)
    const existingId = this.slots[slotIdx];
    const existingQty = this.slotQuantities[slotIdx];

    if (existingId === itemId) {
      if (!isTool) {
        this.slotQuantities[slotIdx] += qty;
        this.inventorySystem.removeItem(itemId, qty); // sets to 0 in inventory
        this._renderSlot(slotIdx);
      }
      return;
    }

    // Return any existing slot item back to general inventory
    if (existingId) {
      const isExistingTool = (existingId === 'plow' || existingId === 'watering_can');
      this.inventorySystem.addItem(existingId, isExistingTool ? 1 : existingQty);
    }

    // Assign new item to slot
    this.slots[slotIdx] = itemId;
    this.slotQuantities[slotIdx] = isTool ? 1 : qty;

    // Remove item stack entirely from general backpack inventory
    this.inventorySystem.removeItem(itemId, qty);

    this._renderSlot(slotIdx);
  }

  /**
   * Unequips the item in a hotbar slot and returns it to player inventory.
   * @param {number} slotIdx
   */
  unequipSlot(slotIdx) {
    if (slotIdx < 0 || slotIdx >= HOTBAR_SLOTS) return;

    const itemId = this.slots[slotIdx];
    if (!itemId) return;

    const qty = this.slotQuantities[slotIdx];
    const isTool = (itemId === 'plow' || itemId === 'watering_can');

    // Return item/quantity back to the backpack inventory
    this.inventorySystem.addItem(itemId, isTool ? 1 : qty);

    // Reset slot states
    this.slots[slotIdx] = null;
    this.slotQuantities[slotIdx] = 0;

    this._renderSlot(slotIdx);
  }

  /**
   * Deducts quantity from a slot. Clears slot if quantity reaches 0.
   * @param {number} slotIdx
   * @param {number} qty
   */
  useItem(slotIdx, qty = 1) {
    if (slotIdx < 0 || slotIdx >= HOTBAR_SLOTS) return;

    const itemId = this.slots[slotIdx];
    if (!itemId) return;

    // Tools don't degrade or lose quantity
    if (itemId === 'plow' || itemId === 'watering_can') return;

    this.slotQuantities[slotIdx] -= qty;
    if (this.slotQuantities[slotIdx] <= 0) {
      this.slots[slotIdx] = null;
      this.slotQuantities[slotIdx] = 0;
    }

    this._renderSlot(slotIdx);
  }

  /**
   * Check if a Phaser GameObject is a component of the Hotbar
   * @param {Phaser.GameObjects.GameObject} go
   * @returns {boolean}
   */
  isHotbarObject(go) {
    return (
      this._slotBgs.includes(go) ||
      this._slotTexts.includes(go) ||
      this._slotCountTexts.includes(go) ||
      this._slotKeyTexts.includes(go)
    );
  }

  /**
   * Set the item in a slot. (Simple override for backward compatibility if needed)
   * @param {number} slotIdx - 0-based index
   * @param {string|null} itemId
   */
  setSlot(slotIdx, itemId) {
    if (slotIdx < 0 || slotIdx >= HOTBAR_SLOTS) return;
    this.slots[slotIdx] = itemId;
    this.slotQuantities[slotIdx] = itemId ? 1 : 0;
    this._renderSlot(slotIdx);
  }

  /**
   * Clear a slot.
   * @param {number} slotIdx
   */
  clearSlot(slotIdx) {
    this.slots[slotIdx] = null;
    this.slotQuantities[slotIdx] = 0;
    this._renderSlot(slotIdx);
  }

  /**
   * Get the item ID in the active slot, or null if empty.
   * @returns {string|null}
   */
  getActiveItem() {
    return this.slots[this.activeSlot] || null;
  }

  /**
   * Set active slot by index.
   * @param {number} idx
   */
  setActiveSlot(idx) {
    if (idx < 0 || idx >= HOTBAR_SLOTS) return;
    // Deactivate old
    this._slotBgs[this.activeSlot].setStrokeStyle(1.5, 0x333355, 1);
    this.activeSlot = idx;
    // Activate new
    this._slotBgs[this.activeSlot].setStrokeStyle(2.5, 0x00ffcc, 1);
  }

  /**
   * Get the action associated with the item in the active slot.
   * @returns {{ action: string, plantType: string|null } | null}
   */
  getActiveItemAction() {
    const itemId = this.getActiveItem();
    if (!itemId) return null;
    return ITEM_ACTIONS[itemId] || null;
  }

  /**
   * Check if the active item is a seed and return the plant type.
   * @returns {string|null}
   */
  getActivePlantType() {
    const action = this.getActiveItemAction();
    if (!action || action.action !== 'plant') return null;
    return action.plantType;
  }

  /* ================================================================
   *  PRIVATE HELPERS
   * ================================================================ */

  _setupKeys() {
    const scene = this.scene;
    // Number keys 1–8 select slots
    const keyMap = {
      ONE: 0, TWO: 1, THREE: 2, FOUR: 3,
      FIVE: 4, SIX: 5, SEVEN: 6, EIGHT: 7,
    };

    for (const [keyName, slotIdx] of Object.entries(keyMap)) {
      scene.input.keyboard.on(`keydown-${keyName}`, () => {
        // Only respond if editor is NOT focused
        if (this._isDOMInputFocused()) return;
        this.setActiveSlot(slotIdx);
      });
    }
  }

  _isDOMInputFocused() {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
    const monacoContainer = document.getElementById('monaco-container');
    if (monacoContainer && monacoContainer.contains(active)) return true;
    return false;
  }

  _renderSlot(idx) {
    const itemId = this.slots[idx];
    const emoji = itemId ? (ITEM_EMOJIS[itemId] || '📦') : '';
    this._slotTexts[idx].setText(emoji);
    this._updateCountBadge(idx);
  }

  _updateCountBadges() {
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      this._updateCountBadge(i);
    }
  }

  _updateCountBadge(idx) {
    const itemId = this.slots[idx];
    if (!itemId) {
      this._slotCountTexts[idx].setText('');
      return;
    }
    // Tools (watering can, plow) don't have counts
    if (itemId === 'watering_can' || itemId === 'plow') {
      this._slotCountTexts[idx].setText('');
      return;
    }
    const count = this.slotQuantities[idx];
    this._slotCountTexts[idx].setText(count > 0 ? String(count) : '');
  }

  /** Cleanup event listeners when object is destroyed */
  destroy() {
    const canvas = this.scene.sys.game.canvas;
    if (canvas) {
      canvas.removeEventListener('dragover', this._dragOverHandler);
      canvas.removeEventListener('drop', this._dropHandler);
    }
  }
}
