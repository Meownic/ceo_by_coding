/**
 * @fileoverview HUD – in-game heads-up display rendered with Phaser
 * GameObjects.  Shows coins, current action, seed count, and can
 * flash temporary messages.
 *
 * All elements use setScrollFactor(0) so they stay fixed to the camera.
 */

import { GAME_WIDTH, COLORS } from '../config/constants.js';

/** Height of the top HUD bar in pixels */
const BAR_HEIGHT = 28;

/** Shared text style for the HUD */
const TEXT_STYLE = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '14px',
  color: '#ffffff',
  resolution: 4,
};

/** Style for the floating message */
const MESSAGE_STYLE = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '16px',
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 3,
  align: 'center',
  resolution: 4,
};

export default class HUD {
  /**
   * @param {Phaser.Scene} scene
   * @param {import('../systems/InventorySystem.js').default} inventory
   */
  constructor(scene, inventory) {
    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {import('../systems/InventorySystem.js').default} */
    this.inventory = inventory;

    // ── Background bar ───────────────────────────────────────────
    this._bar = scene.add.rectangle(
      GAME_WIDTH / 2, BAR_HEIGHT / 2,
      GAME_WIDTH, BAR_HEIGHT,
      COLORS.UI_BG, 0.75,
    );
    this._bar.setScrollFactor(0).setDepth(100);

    // ── Coin display (left) ──────────────────────────────────────
    this._coinText = scene.add.text(8, 6, '', TEXT_STYLE);
    this._coinText.setScrollFactor(0).setDepth(101);

    // ── Action indicator (centre) ────────────────────────────────
    this._actionText = scene.add.text(
      GAME_WIDTH / 2, 6, '',
      { ...TEXT_STYLE, color: '#ffd700' },
    );
    this._actionText.setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);

    this._currentAction = '';

    // ── Seed count display (right) ───────────────────────────────
    this._seedText = scene.add.text(GAME_WIDTH - 8, 6, '', TEXT_STYLE);
    this._seedText.setOrigin(1, 0).setScrollFactor(0).setDepth(101);

    // ── Floating message (hidden by default) ─────────────────────
    this._messageText = scene.add.text(
      GAME_WIDTH / 2, 200, '', MESSAGE_STYLE,
    );
    this._messageText
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(102)
      .setAlpha(0);

    /** @private Timer event for the current floating message */
    this._messageTween = null;

    // ── Listen for inventory changes ─────────────────────────────
    this.inventory.events.on('inventory-changed', () => this.update());
    this.inventory.events.on('coins-changed', () => this.update());

    // Initial render
    this.update();
  }

  /* ================================================================
   *  PUBLIC API
   * ================================================================ */

  /**
   * Refresh all displayed values from the inventory.
   * Called automatically on inventory events, but can also be called
   * manually if needed.
   */
  update() {
    // Coins
    this._coinText.setText(`\u{1FA99} ${this.inventory.getCoins()}`);

    // Action
    this._actionText.setText(this._currentAction || '');

    // Seeds – sum up all items ending with '_seed'
    let totalSeeds = 0;
    for (const { id, count } of this.inventory.getAllItems()) {
      if (id.endsWith('_seed')) totalSeeds += count;
    }
    this._seedText.setText(`Seeds: ${totalSeeds}`);
  }

  /**
   * Show a temporary floating message in the centre of the screen.
   *
   * @param {string} text     – Message to display.
   * @param {number} [duration=2000] – Display time in ms before fade-out.
   */
  showMessage(text, duration = 2000) {
    // Kill any existing message tween
    if (this._messageTween) {
      this._messageTween.stop();
      this._messageTween = null;
    }

    this._messageText.setText(text).setAlpha(1).setY(200);

    this._messageTween = this.scene.tweens.add({
      targets: this._messageText,
      alpha: 0,
      y: 180,
      delay: duration,
      duration: 400,
      ease: 'Power2',
      onComplete: () => {
        this._messageTween = null;
      },
    });
  }

  /**
   * Update the current-action indicator text shown in the centre
   * of the HUD bar.
   *
   * @param {string} actionName – e.g. 'Tilling', 'Planting', 'Watering'
   */
  setCurrentAction(actionName) {
    this._currentAction = actionName;
    this._actionText.setText(actionName);
  }

  /**
   * Destroy all HUD game objects.
   */
  destroy() {
    if (this._messageTween) this._messageTween.stop();
    this._bar.destroy();
    this._coinText.destroy();
    this._actionText.destroy();
    this._seedText.destroy();
    this._messageText.destroy();
  }
}
