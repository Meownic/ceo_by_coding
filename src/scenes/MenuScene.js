/**
 * MenuScene — Title Screen / Main Menu
 * Shows the game title and a "Start Game" prompt.
 */
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config/constants.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    // Background gradient effect
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a1a2e, 0x1a1a2e, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Animated grass tiles in background
    this._createBackgroundTiles();

    // Dark overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x0a0a1a, 0.6);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    overlay.setDepth(1);

    // Title
    const titleStyle = {
      fontSize: '28px',
      fontFamily: '"Press Start 2P", monospace',
      color: '#e94560',
      align: 'center',
    };

    const title = this.add.text(GAME_WIDTH / 2, 140, 'DRONE\nHARVEST', titleStyle);
    title.setOrigin(0.5);
    title.setDepth(2);
    title.setShadow(3, 3, '#000000', 4);

    // Title glow animation
    this.tweens.add({
      targets: title,
      alpha: { from: 0.8, to: 1 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Subtitle
    const subtitleStyle = {
      fontSize: '10px',
      fontFamily: '"JetBrains Mono", monospace',
      color: '#0f3460',
      align: 'center',
    };

    const subtitle = this.add.text(GAME_WIDTH / 2, 210, '// code your farm_', subtitleStyle);
    subtitle.setOrigin(0.5);
    subtitle.setDepth(2);

    // Blinking cursor effect for subtitle
    const cursor = this.add.text(subtitle.x + subtitle.width / 2 + 4, 210, '█', {
      fontSize: '10px',
      fontFamily: '"JetBrains Mono", monospace',
      color: '#0f3460',
    });
    cursor.setOrigin(0, 0.5);
    cursor.setDepth(2);

    this.tweens.add({
      targets: cursor,
      alpha: { from: 1, to: 0 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Version info
    const versionStyle = {
      fontSize: '8px',
      fontFamily: '"JetBrains Mono", monospace',
      color: '#333',
    };

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, 'v0.1.0 — Alpha Build', versionStyle)
      .setOrigin(0.5)
      .setDepth(2);

    // Drone sprite floating
    if (this.textures.exists('drone')) {
      const drone = this.add.image(GAME_WIDTH / 2, 280, 'drone');
      drone.setDepth(2);
      drone.setScale(2);

      this.tweens.add({
        targets: drone,
        y: drone.y - 8,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // "Press ENTER to start" prompt
    const promptStyle = {
      fontSize: '11px',
      fontFamily: '"Press Start 2P", monospace',
      color: '#ffd700',
      align: 'center',
    };

    const startPrompt = this.add.text(GAME_WIDTH / 2, 360, '[ PRESS ENTER ]', promptStyle);
    startPrompt.setOrigin(0.5);
    startPrompt.setDepth(2);

    this.tweens.add({
      targets: startPrompt,
      alpha: { from: 0.4, to: 1 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // Input handling
    this.input.keyboard.once('keydown-ENTER', () => {
      this._startGame();
    });

    this.input.keyboard.once('keydown-SPACE', () => {
      this._startGame();
    });

    // Also allow click to start
    this.input.once('pointerdown', () => {
      this._startGame();
    });
  }

  _createBackgroundTiles() {
    // Create a grid of grass tiles for ambience
    if (!this.textures.exists('tile_grass')) return;

    for (let x = 0; x < GAME_WIDTH; x += 32) {
      for (let y = 0; y < GAME_HEIGHT; y += 32) {
        const tile = this.add.image(x + 16, y + 16, 'tile_grass');
        tile.setAlpha(0.3);
      }
    }
  }

  _startGame() {
    // Fade transition
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene');
    });
  }
}
