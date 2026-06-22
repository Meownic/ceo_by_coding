/**
 * @fileoverview MarketUI – full-screen buy / sell overlay.
 *
 * Two tabs:
 *   • "Buy Seeds" – purchase seeds with coins.
 *   • "Sell Crops" – sell harvested crops for coins.
 *
 * Rendered entirely with Phaser Graphics + Text objects.
 * Depth 200 (above HUD).  Closes with Escape or the X button.
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config/constants.js';
import { PLANT_TYPES } from '../data/plants.js';
import { REFINED_PRICES } from '../systems/EconomySystem.js';

// ── Layout constants ─────────────────────────────────────────────────
const PANEL_MARGIN = 32;
const PANEL_X      = PANEL_MARGIN;
const PANEL_Y      = PANEL_MARGIN;
const PANEL_W      = GAME_WIDTH  - PANEL_MARGIN * 2;
const PANEL_H      = GAME_HEIGHT - PANEL_MARGIN * 2;
const TAB_HEIGHT   = 30;
const ROW_HEIGHT   = 36;
const CONTENT_TOP  = PANEL_Y + TAB_HEIGHT + 12;
const DEPTH_BASE   = 200;

/** Shared text style */
const TEXT_STYLE = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '12px',
  color: '#ffffff',
  resolution: 4,
};

export default class MarketUI {
  /**
   * @param {Phaser.Scene} scene
   * @param {import('../systems/EconomySystem.js').default} economy
   * @param {import('../systems/InventorySystem.js').default} inventory
   */
  constructor(scene, economy, inventory) {
    /** @type {Phaser.Scene} */
    this.scene = scene;
    /** @type {import('../systems/EconomySystem.js').default} */
    this.economy = economy;
    /** @type {import('../systems/InventorySystem.js').default} */
    this.inventory = inventory;

    /** @type {boolean} */
    this._visible = false;

    /** @type {'buy'|'sell'|'modules'} */
    this._activeTab = 'buy';

    /**
     * Container holding every Phaser object so we can show/hide in bulk.
     * @type {Phaser.GameObjects.Container}
     */
    this._container = scene.add.container(0, 0);
    this._container.setDepth(DEPTH_BASE).setScrollFactor(0).setVisible(false);

    // ── Build static background ──────────────────────────────────
    this._buildBackground();

    // ── Build tabs ───────────────────────────────────────────────
    this._buildTabs();

    // ── Close button ─────────────────────────────────────────────
    this._buildCloseButton();

    // ── Escape key binding ───────────────────────────────────────
    this._escKey = scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ESC,
    );
    this._escKey.on('down', () => {
      if (this._visible) this.hide();
    });

    // ── Dynamic content container (rebuilt on tab switch / show) ─
    /** @type {Phaser.GameObjects.GameObject[]} */
    this._contentObjects = [];
  }

  /* ================================================================
   *  PUBLIC API
   * ================================================================ */

  /** Show the market overlay and build content for the active tab. */
  show() {
    this._visible = true;
    this._container.setVisible(true);
    this._rebuildContent();
  }

  /** Hide the market overlay. */
  hide() {
    this._visible = false;
    this._container.setVisible(false);
    this._clearContent();
  }

  /**
   * Whether the market is currently visible.
   * @returns {boolean}
   */
  isVisible() {
    return this._visible;
  }

  /* ================================================================
   *  BACKGROUND / CHROME
   * ================================================================ */

  /** @private */
  _buildBackground() {
    // Semi-transparent full-screen dim
    const dim = this.scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.6,
    )
      .setScrollFactor(0)
      .setInteractive(); // absorb clicks behind the panel
    this._container.add(dim);

    // Panel background (rounded rect via Graphics)
    const gfx = this.scene.add.graphics().setScrollFactor(0);
    gfx.fillStyle(COLORS.UI_PANEL, 0.95);
    gfx.fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 10);
    gfx.lineStyle(2, COLORS.UI_ACCENT, 1);
    gfx.strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 10);
    this._container.add(gfx);

    // Title
    const title = this.scene.add.text(
      GAME_WIDTH / 2, PANEL_Y + 14,
      'MARKET',
      { ...TEXT_STYLE, fontSize: '16px', color: '#ffd700' },
    ).setOrigin(0.5).setScrollFactor(0);
    this._container.add(title);
  }

  _buildTabs() {
    const tabY = PANEL_Y + TAB_HEIGHT + 2;
    const quarterW = (PANEL_W - 8) / 4;

    this._buyTabBg     = this._createTab(PANEL_X + 4, tabY, quarterW, '🌱 Seeds', 'buy');
    this._sellTabBg    = this._createTab(PANEL_X + 4 + quarterW, tabY, quarterW, '💰 Sell', 'sell');
    this._modulesTabBg = this._createTab(PANEL_X + 4 + quarterW * 2, tabY, quarterW, '⚙️ Modules', 'modules');
    this._dronesTabBg  = this._createTab(PANEL_X + 4 + quarterW * 3, tabY, quarterW, '🤖 Drones', 'drones');
  }

  /**
   * Create a clickable tab button.
   * @private
   * @returns {Phaser.GameObjects.Graphics}
   */
  _createTab(x, y, w, label, tabKey) {
    const gfx = this.scene.add.graphics().setScrollFactor(0);
    this._container.add(gfx);

    const txt = this.scene.add.text(x + w / 2, y + 10, label, {
      ...TEXT_STYLE,
      fontSize: '10px',
    }).setOrigin(0.5).setScrollFactor(0);
    this._container.add(txt);

    // Interactive zone
    const zone = this.scene.add.zone(x + w / 2, y + 10, w, 20)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      this._activeTab = tabKey;
      this._rebuildContent();
    });
    this._container.add(zone);

    // Store for highlight updates
    gfx._tabMeta = { x, y, w, h: 20, key: tabKey };
    return gfx;
  }

  /** @private Redraw tab highlight colours. */
  _updateTabHighlights() {
    for (const bg of [this._buyTabBg, this._sellTabBg, this._modulesTabBg, this._dronesTabBg]) {
      if (!bg || !bg._tabMeta) continue;
      const { x, y, w, h, key } = bg._tabMeta;
      bg.clear();
      const isActive = key === this._activeTab;
      bg.fillStyle(isActive ? COLORS.UI_HIGHLIGHT : COLORS.UI_ACCENT, isActive ? 1 : 0.6);
      bg.fillRoundedRect(x, y, w, h, 6);
    }
  }

  /** @private */
  _buildCloseButton() {
    const bx = PANEL_X + PANEL_W - 20;
    const by = PANEL_Y + 14;

    const closeText = this.scene.add.text(bx, by, 'X', {
      ...TEXT_STYLE,
      fontSize: '14px',
      color: '#ff4444',
    })
      .setOrigin(0.5)
      .setPadding(15) // generous clickable hit box padding
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    closeText.on('pointerdown', () => this.hide());
    closeText.on('pointerover', () => closeText.setColor('#ff8888'));
    closeText.on('pointerout',  () => closeText.setColor('#ff4444'));

    this._container.add(closeText);
  }

  /* ================================================================
   *  DYNAMIC CONTENT
   * ================================================================ */

  /** @private Remove all dynamic content objects. */
  _clearContent() {
    for (const obj of this._contentObjects) {
      this._container.remove(obj, true);
    }
    this._contentObjects = [];
  }

  /** @private Rebuild content for the active tab. */
  _rebuildContent() {
    this._clearContent();
    this._updateTabHighlights();

    if (this._activeTab === 'buy') {
      this._buildBuyContent();
    } else if (this._activeTab === 'sell') {
      this._buildSellContent();
    } else if (this._activeTab === 'modules') {
      this._buildModulesContent();
    } else if (this._activeTab === 'drones') {
      this._buildDronesContent();
    }

    // Coin balance footer
    this._addText(
      PANEL_X + PANEL_W / 2,
      PANEL_Y + PANEL_H - 16,
      `🪙 ${this.inventory.getCoins()} coins`,
      { ...TEXT_STYLE, color: '#ffd700' },
      0.5,
    );
  }

  /** @private */
  _buildBuyContent() {
    const shopItems = this.economy.getShopItems();
    let y = CONTENT_TOP + 14;

    // Column headers
    this._addText(PANEL_X + 12, y, 'Seed',  { ...TEXT_STYLE, color: '#aaaaaa' });
    this._addText(PANEL_X + 130, y, 'Cost',  { ...TEXT_STYLE, color: '#aaaaaa' });
    this._addText(PANEL_X + 190, y, 'Sells', { ...TEXT_STYLE, color: '#aaaaaa' });
    this._addText(PANEL_X + 250, y, 'Info',  { ...TEXT_STYLE, color: '#aaaaaa' });
    y += 20;

    const currentLevel = this.scene.profileSystem ? this.scene.profileSystem.level : 1;

    for (const item of shopItems) {
      const rowY = y;
      const plantDef = PLANT_TYPES[item.id];
      const unlockLevel = plantDef ? (plantDef.unlockLevel || 1) : 1;
      const isLocked = currentLevel < unlockLevel;

      // Row background (highlight on hover)
      const rowBg = this.scene.add.graphics();
      rowBg.fillStyle(isLocked ? 0x222233 : COLORS.UI_ACCENT, isLocked ? 0.2 : 0.3);
      rowBg.fillRoundedRect(PANEL_X + 6, rowY - 4, PANEL_W - 12, ROW_HEIGHT - 4, 4);
      this._addObj(rowBg);

      // Text colors based on lock state
      const nameColor = isLocked ? '#666666' : '#ffffff';
      const costColor = isLocked ? '#666666' : '#ffd700';
      const sellColor = isLocked ? '#666666' : '#88ff88';
      const descColor = isLocked ? '#555555' : '#aaaaaa';

      this._addText(PANEL_X + 12, rowY, isLocked ? `\u{1F512} ${item.name}` : `${item.name}`, { ...TEXT_STYLE, color: nameColor });
      this._addText(PANEL_X + 130, rowY, `${item.seedCost}`, { ...TEXT_STYLE, color: costColor });
      this._addText(PANEL_X + 190, rowY, `${item.sellPrice}`, { ...TEXT_STYLE, color: sellColor });

      const descText = isLocked
        ? `LOCKED: Requires Level ${unlockLevel}.`
        : item.description;

      this._addText(PANEL_X + 250, rowY, descText, {
        ...TEXT_STYLE, fontSize: '10px', color: descColor,
        wordWrap: { width: PANEL_W - 260 },
      });

      // Buy button or lock level indicator
      if (!isLocked) {
        this._createButton(
          PANEL_X + PANEL_W - 46, rowY + 2,
          'BUY', () => {
            const result = item.isKey ? this.economy.buyKey(item.id) : this.economy.buySeed(item.id);
            if (!result.success) {
              console.log(result.message);
            }
            this._rebuildContent(); // refresh balances & counts
          },
        );
      } else {
        this._addText(
          PANEL_X + PANEL_W - 46, rowY + 4,
          `LVL ${unlockLevel}`,
          { ...TEXT_STYLE, fontSize: '10px', color: '#ff4444' }
        );
      }

      y += ROW_HEIGHT;
    }
  }

  /** @private */
  _buildSellContent() {
    const allItems = this.inventory.getAllItems()
      .filter(({ id }) => !id.endsWith('_seed') && (PLANT_TYPES[id] || REFINED_PRICES[id]));

    let y = CONTENT_TOP + 14;

    if (allItems.length === 0) {
      this._addText(
        GAME_WIDTH / 2, y + 40,
        'No crops or refined items to sell.\nGrow, refine, and harvest some first!',
        { ...TEXT_STYLE, fontSize: '14px', align: 'center' },
        0.5,
      );
      return;
    }

    // Column headers
    this._addText(PANEL_X + 12, y, 'Item', { ...TEXT_STYLE, color: '#aaaaaa' });
    this._addText(PANEL_X + 130, y, 'Qty',  { ...TEXT_STYLE, color: '#aaaaaa' });
    this._addText(PANEL_X + 190, y, 'Each', { ...TEXT_STYLE, color: '#aaaaaa' });
    this._addText(PANEL_X + 250, y, 'Total', { ...TEXT_STYLE, color: '#aaaaaa' });
    y += 20;

    for (const { id, count } of allItems) {
      const def = PLANT_TYPES[id] || REFINED_PRICES[id];
      if (!def) continue;

      const rowY = y;
      const totalValue = def.sellPrice * count;

      // Row background
      const rowBg = this.scene.add.graphics();
      rowBg.fillStyle(COLORS.UI_ACCENT, 0.3);
      rowBg.fillRoundedRect(PANEL_X + 6, rowY - 4, PANEL_W - 12, ROW_HEIGHT - 4, 4);
      this._addObj(rowBg);

      this._addText(PANEL_X + 12, rowY, def.name, TEXT_STYLE);
      this._addText(PANEL_X + 130, rowY, `${count}`, TEXT_STYLE);
      this._addText(PANEL_X + 190, rowY, `${def.sellPrice}`, { ...TEXT_STYLE, color: '#ffd700' });
      this._addText(PANEL_X + 250, rowY, `${totalValue}`, { ...TEXT_STYLE, color: '#88ff88' });

      // Sell 1
      this._createButton(
        PANEL_X + PANEL_W - 90, rowY + 2,
        'x1', () => {
          this.economy.sellCrop(id, 1);
          this._rebuildContent();
        },
      );

      // Sell All
      this._createButton(
        PANEL_X + PANEL_W - 46, rowY + 2,
        'ALL', () => {
          const current = this.inventory.getItemCount(id);
          if (current > 0) {
            this.economy.sellCrop(id, current);
          }
          this._rebuildContent();
        },
      );

      y += ROW_HEIGHT;
    }
  }

  /* ================================================================
   *  HELPERS
   * ================================================================ */

  /**
   * Create a text object, add to container and content list.
   * @private
   * @returns {Phaser.GameObjects.Text}
   */
  _addText(x, y, str, style, originX = 0) {
    const t = this.scene.add.text(x, y, str, style);
    if (originX !== 0) t.setOrigin(originX);
    t.setScrollFactor(0);
    this._contentObjects.push(t);
    this._container.add(t);
    return t;
  }

  /**
   * Build the Modules buy tab content.
   * @private
   */
  _buildModulesContent() {
    const modules = this.economy.getShopModules ? this.economy.getShopModules() : [];
    let y = CONTENT_TOP + 14;

    this._addText(PANEL_X + PANEL_W / 2, y, '⚙️ DRONE MODULES', {
      ...TEXT_STYLE, fontSize: '14px', color: '#00ffcc',
    }, 0.5);
    y += 24;

    this._addText(PANEL_X + 12, y, 'All drones can farm (till/water/plant/crop/harvest) by default.\nModules unlock advanced abilities: Selling, Buying, Drone-to-Drone supply.', {
      ...TEXT_STYLE, fontSize: '10px', color: '#666677',
    });
    y += 22;

    for (const mod of modules) {
      const rowY = y;
      const canAfford = this.inventory.getCoins() >= mod.cost;

      const rowBg = this.scene.add.graphics();
      rowBg.fillStyle(canAfford ? COLORS.UI_ACCENT : 0x222233, 0.4);
      rowBg.fillRoundedRect(PANEL_X + 6, rowY - 4, PANEL_W - 12, 44, 4);
      this._addObj(rowBg);

      this._addText(PANEL_X + 12, rowY + 2, `${mod.emoji} ${mod.name}`, {
        ...TEXT_STYLE, fontSize: '11px', color: canAfford ? '#ffffff' : '#666',
      });
      this._addText(PANEL_X + 12, rowY + 18, mod.description, {
        ...TEXT_STYLE, fontSize: '9px', color: '#888899',
      });
      this._addText(PANEL_X + PANEL_W - 80, rowY + 10, `${mod.cost} 🪙`, {
        ...TEXT_STYLE, fontSize: '11px', color: canAfford ? '#ffd700' : '#664',
      });

      if (canAfford) {
        this._createButton(PANEL_X + PANEL_W - 80, rowY + 24, 'BUY', () => {
          const result = this.economy.buyModule(mod.id);
          this._rebuildContent();
          if (this.scene.hud) {
            this.scene.hud.showMessage(result.message, 2000);
          }
        });
      }

      y += 52;
    }
  }

  /** @private */
  _buildDronesContent() {
    const dm = this.scene.deviceManager;
    const currentCount = dm ? dm.getAll().length : 1;
    const maxDrones = 5;
    let y = CONTENT_TOP + 14;

    this._addText(PANEL_X + PANEL_W / 2, y, '🤖 AUTOMATED DRONE FLEET', {
      ...TEXT_STYLE, fontSize: '14px', color: '#00ffcc',
    }, 0.5);
    y += 24;

    if (currentCount >= maxDrones) {
      this._addText(
        GAME_WIDTH / 2, y + 40,
        'Maximum Fleet Capacity Reached (5/5 Drones).\nYour automation capabilities are fully optimized!',
        { ...TEXT_STYLE, fontSize: '11px', color: '#ffd700', align: 'center' },
        0.5,
      );
      return;
    }

    const nextDroneNum = currentCount + 1;
    const cost = this.economy.getDroneCost(currentCount);
    const canAfford = this.inventory.getCoins() >= cost;

    // Next drone row background
    const rowBg = this.scene.add.graphics();
    rowBg.fillStyle(canAfford ? COLORS.UI_ACCENT : 0x222233, 0.4);
    rowBg.fillRoundedRect(PANEL_X + 6, y - 4, PANEL_W - 12, 48, 4);
    this._addObj(rowBg);

    this._addText(PANEL_X + 12, y + 2, `🤖 Buy Drone ${nextDroneNum}`, {
      ...TEXT_STYLE, fontSize: '11px', color: canAfford ? '#ffffff' : '#666',
    });
    this._addText(PANEL_X + 12, y + 20, `Spawns a new programmable drone at (3, 3). Limit 5.`, {
      ...TEXT_STYLE, fontSize: '9px', color: '#888899',
    });
    this._addText(PANEL_X + PANEL_W - 100, y + 14, `${cost} 🪙`, {
      ...TEXT_STYLE, fontSize: '11px', color: canAfford ? '#ffd700' : '#664',
    });

    if (canAfford) {
      this._createButton(PANEL_X + PANEL_W - 80, y + 10, 'BUY', () => {
        if (this.inventory.removeCoins(cost)) {
          const newDrone = this.scene.spawnNewDrone();
          if (newDrone) {
            if (this.scene.hud) {
              this.scene.hud.showMessage(`Purchased ${newDrone.label}!`, 3000);
            }
          }
        }
        this._rebuildContent();
      });
    }

    y += 64;

    // List current fleet members
    this._addText(PANEL_X + 12, y, 'Active Fleet Status:', { ...TEXT_STYLE, color: '#aaaaaa' });
    y += 18;

    const drones = dm ? dm.getAll() : [];
    drones.forEach((drone) => {
      this._addText(PANEL_X + 24, y, `• ${drone.label} (${drone.id}) — Position: (${drone.tileX}, ${drone.tileY}) — Status: ${drone.status.toUpperCase()}`, {
        ...TEXT_STYLE, fontSize: '9px', color: '#00ffcc',
      });
      y += 14;
    });
  }

  /**
   * Add any game object to the container and tracking list.
   * @private
   */
  _addObj(obj) {
    obj.setScrollFactor(0);
    this._contentObjects.push(obj);
    this._container.add(obj);
    return obj;
  }

  /**
   * Create a small interactive button.
   * @private
   * @returns {Phaser.GameObjects.Text}
   */
  _createButton(x, y, label, onClick) {
    // Button background
    const bg = this.scene.add.graphics();
    const bw = label.length * 8 + 16;
    const bh = 18;
    bg.fillStyle(COLORS.UI_HIGHLIGHT, 0.85);
    bg.fillRoundedRect(x, y, bw, bh, 4);
    this._addObj(bg);

    const txt = this.scene.add.text(x + bw / 2, y + bh / 2, label, {
      ...TEXT_STYLE,
      fontSize: '11px',
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    txt.on('pointerdown', onClick);
    txt.on('pointerover', () => txt.setColor('#ffff88'));
    txt.on('pointerout',  () => txt.setColor('#ffffff'));

    this._contentObjects.push(txt);
    this._container.add(txt);
    return txt;
  }

  /**
   * Destroy the entire UI.
   */
  destroy() {
    this._clearContent();
    this._container.destroy(true);
  }
}
