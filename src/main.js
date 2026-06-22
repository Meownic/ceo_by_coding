/**
 * DroneHarvest — Main Entry Point
 * Initializes the Phaser 3 game engine and sets up all scenes.
 */
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config/constants.js';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { MenuScene } from './scenes/MenuScene.js';

/** Phaser Game Configuration */
const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  resolution: window.devicePixelRatio || 1,
  backgroundColor: `#${COLORS.GRASS.toString(16).padStart(6, '0')}`,
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, GameScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { y: 0 },
    },
  },
  // Disable right-click context menu on canvas
  input: {
    mouse: {
      preventDefaultDown: true,
    },
  },
};

/** Create and start the game */
const game = new Phaser.Game(config);

// Expose game instance for debugging (dev only)
if (import.meta.env.DEV) {
  window.__game = game;
}

export default game;
