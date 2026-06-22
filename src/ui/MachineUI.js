/**
 * @fileoverview MachineUI – inspect panel for refineries and processors.
 *
 * Allows players to manually deposit ingredients and retrieve outputs.
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config/constants.js';
import { RECIPES } from '../systems/MachineSystem.js';

const ITEM_METADATA = {
  plow: { name: 'Plow', emoji: '🔨' },
  watering_can: { name: 'Watering Can', emoji: '🚿' },
  wheat_seed: { name: 'Wheat Seed', emoji: '🌾' },
  wheat: { name: 'Wheat', emoji: '🌾' },
  potato_seed: { name: 'Potato Seed', emoji: '🥔' },
  potato: { name: 'Potato', emoji: '🥔' },
  cactus_seed: { name: 'Cactus Seed', emoji: '🌵' },
  cactus: { name: 'Cactus Crop', emoji: '🌵' },
  apple_tree_seed: { name: 'Apple Seed', emoji: '🍏' },
  apple_tree: { name: 'Apple Fruit', emoji: '🍎' },
  coal: { name: 'Coal', emoji: '🌑' },
  copper_ore: { name: 'Copper Ore', emoji: '🟫' },
  iron_ore: { name: 'Iron Ore', emoji: '⬜' },
  gold_ore: { name: 'Gold Ore', emoji: '🟨' },
  copper_ingot: { name: 'Copper Ingot', emoji: '🧱' },
  iron_ingot: { name: 'Iron Ingot', emoji: '🪙' },
  gold_ingot: { name: 'Gold Ingot', emoji: '👑' },
  flour: { name: 'Flour', emoji: '🍚' },
  bread: { name: 'Bread', emoji: '🍞' },
  apple_juice: { name: 'Apple Juice', emoji: '🧃' },
  apple_jam: { name: 'Apple Jam', emoji: '🏺' },
  potato_starch: { name: 'Potato Starch', emoji: '🥣' },
  chips: { name: 'Potato Chips', emoji: '🍟' },
  wire: { name: 'Copper Wire', emoji: '➰' },
  gear: { name: 'Iron Gear', emoji: '⚙️' },
  chip: { name: 'Microchip', emoji: '🎛️' },
  key_zone2: { name: 'Artisan Key', emoji: '🔑' },
  key_zone3: { name: 'Mining Key', emoji: '🗝️' },
  key_zone4: { name: 'Lab Key', emoji: '💳' },
  module_farming: { name: 'Farming Mod', emoji: '🚜' },
  module_supplier: { name: 'Supplier Mod', emoji: '📦' },
  module_seller: { name: 'Seller Mod', emoji: '💰' },
  module_mining: { name: 'Mining Mod', emoji: '⛏️' },
  module_bigger_seller: { name: 'Bigger Seller Mod', emoji: '📈' },
  module_super_carrier: { name: 'Super Carrier Mod', emoji: '🚀' },
  module_advanced_farming: { name: 'Advanced Farming Mod', emoji: '🚜' },
  module_speed_booster: { name: 'Speed Booster Mod', emoji: '⚡' },
  stone: { name: 'Stone', emoji: '🪨' }
};

const PANEL_W = 320;
const PANEL_H = 260;
const PANEL_X = (GAME_WIDTH - PANEL_W) / 2;
const PANEL_Y = (GAME_HEIGHT - PANEL_H) / 2;
const DEPTH_BASE = 210;

const TEXT_STYLE = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '11px',
  color: '#ffffff',
  resolution: 4,
};

export default class MachineUI {
  constructor(scene, machineSystem, inventorySystem) {
    this.scene = scene;
    this.machineSystem = machineSystem;
    this.inventorySystem = inventorySystem;

    this._visible = false;
    this._machineId = null;

    // Container to hold UI components
    this._container = scene.add.container(0, 0);
    this._container.setDepth(DEPTH_BASE).setScrollFactor(0).setVisible(false);

    this._buildChrome();

    this._contentObjects = [];

    // Periodic refresh timer when visible
    this._refreshEvent = null;
  }

  show(machineId) {
    this._machineId = machineId;
    this._visible = true;
    this._container.setVisible(true);
    this._rebuildContent();

    // Start auto-refresh every 500ms to update progress bars
    this._refreshEvent = this.scene.time.addEvent({
      delay: 500,
      callback: () => this._rebuildContent(),
      loop: true
    });
  }

  hide() {
    this._visible = false;
    this._container.setVisible(false);
    this._clearContent();
    if (this._refreshEvent) {
      this._refreshEvent.destroy();
      this._refreshEvent = null;
    }
  }

  isVisible() {
    return this._visible;
  }

  _buildChrome() {
    // Dim background behind panel
    const dim = this.scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.4
    ).setInteractive().setScrollFactor(0);
    this._container.add(dim);

    // Panel body
    const bg = this.scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      PANEL_W, PANEL_H,
      COLORS.UI_PANEL, 0.95
    ).setScrollFactor(0);
    bg.setStrokeStyle(2, COLORS.UI_ACCENT, 1);
    this._container.add(bg);

    // Title Text (updated dynamically)
    this._titleText = this.scene.add.text(
      GAME_WIDTH / 2, PANEL_Y + 12,
      'MACHINE INSPECTOR',
      { ...TEXT_STYLE, fontSize: '13px', color: '#ffd700', fontWeight: 'bold' }
    ).setOrigin(0.5).setScrollFactor(0);
    this._container.add(this._titleText);

    // Close button
    const closeBtn = this.scene.add.text(
      PANEL_X + PANEL_W - 16, PANEL_Y + 12,
      'X',
      { ...TEXT_STYLE, color: '#ff4444', fontSize: '13px', fontWeight: 'bold' }
    ).setOrigin(0.5).setInteractive({ useHandCursor: true }).setScrollFactor(0);

    closeBtn.on('pointerdown', () => this.hide());
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff8888'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ff4444'));
    this._container.add(closeBtn);
  }

  _clearContent() {
    for (const obj of this._contentObjects) {
      this._container.remove(obj, true);
    }
    this._contentObjects = [];
  }

  _rebuildContent() {
    if (!this._visible || !this._machineId) return;

    this._clearContent();

    const machineState = this.machineSystem.getMachineState(this._machineId);
    if (!machineState) {
      this.hide();
      return;
    }

    const typeUpper = machineState.type.toUpperCase().replace('_', ' ');
    this._titleText.setText(`🏭 ${typeUpper} (${machineState.id})`);

    let y = PANEL_Y + 36;

    // ── 1. ACTIVE RECIPE & PROGRESS ──
    this._addText(PANEL_X + 16, y, 'STATUS & PROCESS', { ...TEXT_STYLE, color: '#00ffff', fontWeight: 'bold' });
    y += 16;

    if (machineState.isProcessing) {
      this._addText(PANEL_X + 24, y, `Processing: ${machineState.activeRecipeName}`, TEXT_STYLE);
      y += 14;

      // Draw custom progress bar
      const barW = PANEL_W - 48;
      const barH = 8;
      const barGfx = this.scene.add.graphics();
      
      // Background bar
      barGfx.fillStyle(COLORS.UI_ACCENT, 0.5);
      barGfx.fillRoundedRect(PANEL_X + 24, y, barW, barH, 2);
      
      // Progress fill
      const progressW = barW * (machineState.progress / 100);
      barGfx.fillStyle(0x00ffcc, 1);
      barGfx.fillRoundedRect(PANEL_X + 24, y, progressW, barH, 2);
      
      this._addObj(barGfx);
      this._addText(PANEL_X + PANEL_W - 24, y - 2, `${machineState.timeRemaining}s`, { ...TEXT_STYLE, fontSize: '10px' }, 1.0);
      y += 18;
    } else {
      this._addText(PANEL_X + 24, y, 'Status: Idle (Awaiting ingredients)', { ...TEXT_STYLE, color: '#aaaaaa' });
      y += 18;
    }

// ── 2. MANAGE INGREDIENTS (INPUTS) ──
    this._addText(PANEL_X + 16, PANEL_Y + 84, 'INGREDIENTS (Click to Deposit)', { ...TEXT_STYLE, color: '#00ffff', fontWeight: 'bold' });

    // Find valid recipe inputs for this machine
    const recipeData = RECIPES[machineState.type];
    const validInputs = new Set();
    if (recipeData) {
      const recipes = Array.isArray(recipeData) ? recipeData : [recipeData];
      for (const r of recipes) {
        for (const inputKey of Object.keys(r.inputs)) {
          validInputs.add(inputKey);
        }
      }
    }

    // Render input slots
    const inputList = Array.from(validInputs);
    const SLOT_SIZE = 38;
    const SLOT_SPACING = 46;
    const startX = PANEL_X + 24;
    const inputY = PANEL_Y + 102;

    inputList.forEach((itemId, index) => {
      const slotX = startX + index * SLOT_SPACING;
      
      // Get count inside machine
      const countInMachine = machineState.inputs.find(i => i.id === itemId)?.count || 0;
      // Get count in player inventory
      const countInPlayer = this.inventorySystem.getItemCount(itemId);

      const meta = ITEM_METADATA[itemId] || { name: itemId, emoji: '📦' };

      // Background Graphics
      const gfx = this.scene.add.graphics();
      gfx.fillStyle(0x0c0c14, 0.9);
      gfx.fillRoundedRect(slotX, inputY, SLOT_SIZE, SLOT_SIZE, 4);

      // Border: highlighted if player has items to deposit
      const hasItem = countInPlayer > 0;
      const borderColor = hasItem ? 0x00ffcc : COLORS.UI_ACCENT;
      const borderThickness = hasItem ? 2 : 1;
      gfx.lineStyle(borderThickness, borderColor, 1);
      gfx.strokeRoundedRect(slotX, inputY, SLOT_SIZE, SLOT_SIZE, 4);
      this._addObj(gfx);

      // Hover glow border (initially hidden)
      const hoverGfx = this.scene.add.graphics();
      hoverGfx.lineStyle(2, 0xffd700, 1); // gold hover border
      hoverGfx.strokeRoundedRect(slotX, inputY, SLOT_SIZE, SLOT_SIZE, 4);
      hoverGfx.setVisible(false);
      this._addObj(hoverGfx);

      // Emoji text
      const emojiTxt = this._addText(slotX + SLOT_SIZE / 2, inputY + SLOT_SIZE / 2, meta.emoji, { ...TEXT_STYLE, fontSize: '18px' });
      emojiTxt.setOrigin(0.5);
      if (!hasItem && countInMachine === 0) {
        emojiTxt.setAlpha(0.35); // ghosted if empty
      }

      // Quantity inside machine (Top-Left)
      this._addText(slotX + 4, inputY + 2, countInMachine.toString(), {
        ...TEXT_STYLE,
        fontSize: '9px',
        color: countInMachine > 0 ? '#00ffff' : '#666666'
      });

      // Quantity in player inventory (Bottom-Right)
      const inPlayerTxt = this._addText(slotX + SLOT_SIZE - 4, inputY + SLOT_SIZE - 12, countInPlayer.toString(), {
        ...TEXT_STYLE,
        fontSize: '9px',
        color: countInPlayer > 0 ? '#ffd700' : '#666666'
      });
      inPlayerTxt.setOrigin(1, 0);

      // Interactive Area (Click Zone)
      const clickZone = this.scene.add.rectangle(slotX + SLOT_SIZE / 2, inputY + SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE, 0, 0);
      clickZone.setOrigin(0.5).setInteractive({ useHandCursor: hasItem });
      this._addObj(clickZone);

      if (hasItem) {
        clickZone.on('pointerdown', (pointer) => {
          // Deposit 1, or shift-click for all
          const depositAmt = pointer.shiftKey ? countInPlayer : 1;
          const deposited = this.machineSystem.deposit(this._machineId, itemId, depositAmt);
          if (deposited > 0) {
            this.inventorySystem.removeItem(itemId, deposited);
            if (this.scene._emitWaterParticles) {
              this.scene._emitWaterParticles(this.scene.player.tileX, this.scene.player.tileY);
            }
          }
          this._rebuildContent();
        });

        clickZone.on('pointerover', () => {
          hoverGfx.setVisible(true);
        });

        clickZone.on('pointerout', () => {
          hoverGfx.setVisible(false);
        });
      }
    });

    if (inputList.length === 0) {
      this._addText(PANEL_X + 24, inputY + 12, 'No inputs required.', { ...TEXT_STYLE, color: '#888888' });
    }

    // ── 3. MANAGE OUTPUTS ──
    const outputY = PANEL_Y + 160;
    this._addText(PANEL_X + 16, outputY, 'OUTPUTS (Click to Retrieve)', { ...TEXT_STYLE, color: '#00ffff', fontWeight: 'bold' });

    const outputSlotsY = outputY + 18;
    
    if (machineState.outputs.length === 0) {
      // Draw placeholder empty output slot
      const slotX = startX;
      
      const gfx = this.scene.add.graphics();
      gfx.fillStyle(0x0c0c14, 0.9);
      gfx.fillRoundedRect(slotX, outputSlotsY, SLOT_SIZE, SLOT_SIZE, 4);
      gfx.lineStyle(1, 0x333344, 1);
      gfx.strokeRoundedRect(slotX, outputSlotsY, SLOT_SIZE, SLOT_SIZE, 4);
      this._addObj(gfx);

      const placeholderEmoji = this._addText(slotX + SLOT_SIZE / 2, outputSlotsY + SLOT_SIZE / 2, '📦', { ...TEXT_STYLE, fontSize: '18px' });
      placeholderEmoji.setOrigin(0.5).setAlpha(0.2);

      this._addText(slotX + SLOT_SPACING + 4, outputSlotsY + 14, 'Outputs: Empty', { ...TEXT_STYLE, color: '#666666', fontSize: '10px' });
    } else {
      machineState.outputs.forEach((outItem, index) => {
        const slotX = startX + index * SLOT_SPACING;
        const itemId = outItem.id;
        const qty = outItem.count;

        const meta = ITEM_METADATA[itemId] || { name: itemId, emoji: '📦' };

        // Background
        const gfx = this.scene.add.graphics();
        gfx.fillStyle(0x0c0c14, 0.9);
        gfx.fillRoundedRect(slotX, outputSlotsY, SLOT_SIZE, SLOT_SIZE, 4);
        
        // Border: glowing green since outputs are ready
        gfx.lineStyle(2, 0x00ff66, 1);
        gfx.strokeRoundedRect(slotX, outputSlotsY, SLOT_SIZE, SLOT_SIZE, 4);
        this._addObj(gfx);

        // Hover Border
        const hoverGfx = this.scene.add.graphics();
        hoverGfx.lineStyle(2, 0xffffff, 1); // white hover border
        hoverGfx.strokeRoundedRect(slotX, outputSlotsY, SLOT_SIZE, SLOT_SIZE, 4);
        hoverGfx.setVisible(false);
        this._addObj(hoverGfx);

        // Emoji
        const emojiTxt = this._addText(slotX + SLOT_SIZE / 2, outputSlotsY + SLOT_SIZE / 2, meta.emoji, { ...TEXT_STYLE, fontSize: '18px' });
        emojiTxt.setOrigin(0.5);

        // Quantity (Bottom-Right)
        const qtyTxt = this._addText(slotX + SLOT_SIZE - 4, outputSlotsY + SLOT_SIZE - 12, qty.toString(), {
          ...TEXT_STYLE,
          fontSize: '9px',
          color: '#00ff66'
        });
        qtyTxt.setOrigin(1, 0);

        // Click Zone
        const clickZone = this.scene.add.rectangle(slotX + SLOT_SIZE / 2, outputSlotsY + SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE, 0, 0);
        clickZone.setOrigin(0.5).setInteractive({ useHandCursor: true });
        this._addObj(clickZone);

        clickZone.on('pointerdown', () => {
          // Retrieve outputs
          const outputs = this.machineSystem.retrieve(this._machineId);
          for (const item of outputs) {
            this.inventorySystem.addItem(item.id, item.count);
          }
          if (this.scene._emitFruitParticles) {
            this.scene._emitFruitParticles(this.scene.player.tileX, this.scene.player.tileY);
          }
          this._rebuildContent();
        });

        clickZone.on('pointerover', () => {
          hoverGfx.setVisible(true);
        });

        clickZone.on('pointerout', () => {
          hoverGfx.setVisible(false);
        });
      });
    }
  }

  _addText(x, y, str, style, originX = 0) {
    const t = this.scene.add.text(x, y, str, style);
    if (originX !== 0) t.setOrigin(originX, 0);
    t.setScrollFactor(0);
    this._contentObjects.push(t);
    this._container.add(t);
    return t;
  }

  _addObj(obj) {
    obj.setScrollFactor(0);
    this._contentObjects.push(obj);
    this._container.add(obj);
    return obj;
  }

  _createButton(x, y, label, onClick) {
    const bw = label.length * 6.5 + 12;
    const bh = 18;

    const bg = this.scene.add.graphics();
    bg.fillStyle(COLORS.UI_HIGHLIGHT, 0.85);
    bg.fillRoundedRect(x, y, bw, bh, 3);
    this._addObj(bg);

    const txt = this.scene.add.text(x + bw / 2, y + bh / 2, label, {
      ...TEXT_STYLE,
      fontSize: '9px',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setScrollFactor(0);

    txt.on('pointerdown', onClick);
    txt.on('pointerover', () => txt.setColor('#ffff88'));
    txt.on('pointerout', () => txt.setColor('#ffffff'));

    this._contentObjects.push(txt);
    this._container.add(txt);
    return txt;
  }

  destroy() {
    this.hide();
    this._container.destroy(true);
  }
}
