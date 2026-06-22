/**
 * BootScene — Asset Preloader
 * Loads all game assets and shows a loading bar.
 */
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, COLORS } from '../config/constants.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Update loading screen progress bar
    const loadingBar = document.getElementById('loading-bar');
    const loadingText = document.getElementById('loading-text');

    this.load.on('progress', (value) => {
      if (loadingBar) loadingBar.style.width = `${value * 100}%`;
    });

    this.load.on('fileprogress', (file) => {
      if (loadingText) loadingText.textContent = `Loading: ${file.key}`;
    });

    this.load.on('complete', () => {
      if (loadingText) loadingText.textContent = 'Complete!';
    });

    // ── Generate placeholder assets programmatically ──
    this._generatePlaceholderAssets();
  }

  create() {
    // Fade out loading screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 500);
    }

    // Transition to menu scene
    this.scene.start('MenuScene');
  }

  /**
   * Generate all placeholder pixel art assets as canvas textures.
   * These can be replaced with real sprite assets later.
   */
  _generatePlaceholderAssets() {
    this._generateTileTextures();
    this._generatePlayerTexture();
    this._generateDroneTexture();
    this._generatePlantTextures();
    this._generateUITextures();
    this._generateMarketTexture();
    this._generateParticleTexture();
    this._generateExpansionTextures();
  }

  /** Ground tile textures */
  _generateTileTextures() {
    const T = TILE_SIZE;

    // Grass tile
    const grass = this.textures.createCanvas('tile_grass', T, T);
    const gctx = grass.getContext();
    gctx.fillStyle = '#4a7c59';
    gctx.fillRect(0, 0, T, T);
    // Add grass detail
    gctx.fillStyle = '#5a8c69';
    for (let i = 0; i < 6; i++) {
      const gx = Math.floor(Math.random() * (T - 2)) + 1;
      const gy = Math.floor(Math.random() * (T - 2)) + 1;
      gctx.fillRect(gx, gy, 2, 3);
    }
    gctx.fillStyle = '#3a6c49';
    for (let i = 0; i < 4; i++) {
      const gx = Math.floor(Math.random() * (T - 2)) + 1;
      const gy = Math.floor(Math.random() * (T - 2)) + 1;
      gctx.fillRect(gx, gy, 1, 2);
    }
    grass.refresh();

    // Tilled dirt tile
    const tilled = this.textures.createCanvas('tile_tilled', T, T);
    const tctx = tilled.getContext();
    tctx.fillStyle = '#8B6914';
    tctx.fillRect(0, 0, T, T);
    // Furrow lines
    tctx.fillStyle = '#7a5a0a';
    for (let row = 4; row < T; row += 6) {
      tctx.fillRect(2, row, T - 4, 2);
    }
    tctx.fillStyle = '#9b7924';
    for (let row = 6; row < T; row += 6) {
      tctx.fillRect(2, row, T - 4, 1);
    }
    tilled.refresh();

    // Watered dirt tile
    const watered = this.textures.createCanvas('tile_watered', T, T);
    const wctx = watered.getContext();
    wctx.fillStyle = '#5a4a2a';
    wctx.fillRect(0, 0, T, T);
    // Darker furrow lines (wet)
    wctx.fillStyle = '#4a3a1a';
    for (let row = 4; row < T; row += 6) {
      wctx.fillRect(2, row, T - 4, 2);
    }
    // Moisture shine spots
    wctx.fillStyle = 'rgba(100, 150, 255, 0.15)';
    for (let i = 0; i < 5; i++) {
      const mx = Math.floor(Math.random() * (T - 4)) + 2;
      const my = Math.floor(Math.random() * (T - 4)) + 2;
      wctx.fillRect(mx, my, 3, 2);
    }
    watered.refresh();

    // Fence tile (horizontal)
    const fence = this.textures.createCanvas('tile_fence', T, T);
    const fctx = fence.getContext();
    fctx.fillStyle = '#4a7c59'; // grass bg
    fctx.fillRect(0, 0, T, T);
    // Fence posts
    fctx.fillStyle = '#8B6535';
    fctx.fillRect(2, 8, 4, 20);
    fctx.fillRect(T - 6, 8, 4, 20);
    // Horizontal rails
    fctx.fillStyle = '#A07840';
    fctx.fillRect(0, 12, T, 3);
    fctx.fillRect(0, 22, T, 3);
    // Post tops
    fctx.fillStyle = '#705020';
    fctx.fillRect(2, 6, 4, 3);
    fctx.fillRect(T - 6, 6, 4, 3);
    fence.refresh();

    // Path tile
    const path = this.textures.createCanvas('tile_path', T, T);
    const pctx = path.getContext();
    pctx.fillStyle = '#c4a97d';
    pctx.fillRect(0, 0, T, T);
    pctx.fillStyle = '#b49a6e';
    for (let i = 0; i < 8; i++) {
      const px = Math.floor(Math.random() * (T - 3));
      const py = Math.floor(Math.random() * (T - 3));
      pctx.fillRect(px, py, 3, 3);
    }
    path.refresh();
  }

  /** Player character texture (simple colored sprite) */
  _generatePlayerTexture() {
    const T = TILE_SIZE;
    const canvas = this.textures.createCanvas('player', T * 4, T); // 4 frames: down, up, left, right
    const ctx = canvas.getContext();

    const directions = [
      { color: '#4fc3f7', eyeOffsetX: 0 },   // down
      { color: '#4fc3f7', eyeOffsetX: 0 },   // up
      { color: '#4fc3f7', eyeOffsetX: -2 },  // left
      { color: '#4fc3f7', eyeOffsetX: 2 },   // right
    ];

    directions.forEach((dir, i) => {
      const ox = i * T;

      // Body
      ctx.fillStyle = dir.color;
      ctx.fillRect(ox + 10, 8, 12, 16);

      // Head
      ctx.fillStyle = '#ffcc88';
      ctx.fillRect(ox + 11, 4, 10, 10);

      // Eyes
      ctx.fillStyle = '#333';
      if (i === 1) {
        // facing up — no eyes visible
      } else {
        ctx.fillRect(ox + 13 + dir.eyeOffsetX, 7, 2, 2);
        ctx.fillRect(ox + 18 + dir.eyeOffsetX, 7, 2, 2);
      }

      // Legs
      ctx.fillStyle = '#2962ff';
      ctx.fillRect(ox + 11, 24, 4, 6);
      ctx.fillRect(ox + 17, 24, 4, 6);

      // Boots
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(ox + 10, 28, 5, 4);
      ctx.fillRect(ox + 17, 28, 5, 4);

      // Hat
      ctx.fillStyle = '#e94560';
      ctx.fillRect(ox + 9, 2, 14, 4);
      ctx.fillRect(ox + 11, 0, 10, 3);
    });

    canvas.refresh();

    // Add frames to the spritesheet
    this.textures.get('player').add(0, 0, 0, 0, T, T);       // down
    this.textures.get('player').add(1, 0, T, 0, T, T);       // up
    this.textures.get('player').add(2, 0, T * 2, 0, T, T);   // left
    this.textures.get('player').add(3, 0, T * 3, 0, T, T);   // right
  }

  /** Drone texture (small robot) */
  _generateDroneTexture() {
    const T = TILE_SIZE;
    const canvas = this.textures.createCanvas('drone', T, T);
    const ctx = canvas.getContext();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(T / 2, T - 4, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#b0bec5';
    ctx.fillRect(8, 8, 16, 12);

    // Top dome
    ctx.fillStyle = '#cfd8dc';
    ctx.fillRect(10, 5, 12, 5);

    // Eye/sensor
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(13, 10, 3, 3);
    ctx.fillRect(18, 10, 3, 3);

    // Propeller left
    ctx.fillStyle = '#78909c';
    ctx.fillRect(2, 6, 8, 2);
    // Propeller right
    ctx.fillRect(22, 6, 8, 2);

    // Propeller stems
    ctx.fillStyle = '#607d8b';
    ctx.fillRect(6, 7, 2, 4);
    ctx.fillRect(24, 7, 2, 4);

    // Bottom detail
    ctx.fillStyle = '#90a4ae';
    ctx.fillRect(10, 20, 12, 3);

    // Antenna
    ctx.fillStyle = '#ff5252';
    ctx.fillRect(15, 2, 2, 4);
    ctx.fillRect(14, 1, 4, 2);

    canvas.refresh();
  }

  /** Plant growth stage textures */
  _generatePlantTextures() {
    const T = TILE_SIZE;
    const plants = {
      wheat: ['#8d6e2e', '#6b8e23', '#7cb342', '#fdd835'],
      potato: ['#8d6e2e', '#558b2f', '#7cb342', '#a1887f'],
      apple_tree: ['#6d4c41', '#558b2f', '#33691e', '#c62828'],
      cactus: ['#558b2f', '#2e7d32', '#388e3c', '#e91e63'],
    };

    for (const [plantName, stageColors] of Object.entries(plants)) {
      for (let stage = 0; stage < 4; stage++) {
        const key = `plant_${plantName}_${stage}`;
        const canvas = this.textures.createCanvas(key, T, T);
        const ctx = canvas.getContext();

        // Transparent background
        ctx.clearRect(0, 0, T, T);

        const color = stageColors[stage];

        if (plantName === 'wheat') {
          this._drawWheat(ctx, T, stage, color);
        } else if (plantName === 'potato') {
          this._drawPotato(ctx, T, stage, color);
        } else if (plantName === 'apple_tree') {
          this._drawTree(ctx, T, stage, color);
        } else if (plantName === 'cactus') {
          this._drawCactus(ctx, T, stage, color);
        }

        canvas.refresh();
      }
    }
  }

  _drawWheat(ctx, T, stage, color) {
    const cx = T / 2;
    if (stage === 0) {
      // Seed — tiny mound
      ctx.fillStyle = '#8d6e2e';
      ctx.fillRect(cx - 3, T - 8, 6, 4);
      ctx.fillRect(cx - 2, T - 10, 4, 2);
    } else if (stage === 1) {
      // Sprout
      ctx.fillStyle = color;
      ctx.fillRect(cx - 1, T - 14, 2, 10);
      ctx.fillRect(cx - 3, T - 12, 2, 4);
    } else if (stage === 2) {
      // Young plant
      ctx.fillStyle = color;
      ctx.fillRect(cx - 1, T - 20, 2, 16);
      ctx.fillRect(cx - 4, T - 18, 3, 6);
      ctx.fillRect(cx + 2, T - 16, 3, 6);
    } else {
      // Mature wheat — golden
      ctx.fillStyle = color;
      ctx.fillRect(cx - 1, T - 24, 2, 20);
      ctx.fillRect(cx - 4, T - 22, 3, 8);
      ctx.fillRect(cx + 2, T - 20, 3, 8);
      // Wheat head
      ctx.fillRect(cx - 3, T - 28, 6, 6);
      ctx.fillStyle = '#fbc02d';
      ctx.fillRect(cx - 2, T - 27, 4, 4);
    }
  }

  _drawPotato(ctx, T, stage, color) {
    const cx = T / 2;
    if (stage === 0) {
      ctx.fillStyle = '#8d6e2e';
      ctx.fillRect(cx - 3, T - 8, 6, 4);
    } else if (stage === 1) {
      ctx.fillStyle = color;
      ctx.fillRect(cx - 1, T - 12, 2, 8);
      ctx.fillRect(cx - 3, T - 10, 6, 3);
    } else if (stage === 2) {
      ctx.fillStyle = color;
      ctx.fillRect(cx - 1, T - 18, 2, 14);
      ctx.fillRect(cx - 5, T - 16, 10, 6);
      ctx.fillRect(cx - 3, T - 14, 6, 4);
    } else {
      // Mature — bushy top, tubers visible
      ctx.fillStyle = color;
      ctx.fillRect(cx - 6, T - 18, 12, 8);
      ctx.fillRect(cx - 4, T - 22, 8, 6);
      // Stem
      ctx.fillStyle = '#558b2f';
      ctx.fillRect(cx - 1, T - 24, 2, 12);
      // Potato tubers peeking from soil
      ctx.fillStyle = '#a1887f';
      ctx.fillRect(cx - 5, T - 6, 5, 4);
      ctx.fillRect(cx + 1, T - 7, 5, 5);
    }
  }

  _drawTree(ctx, T, stage, color) {
    const cx = T / 2;
    if (stage === 0) {
      // Sapling
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(cx - 1, T - 12, 2, 8);
      ctx.fillStyle = '#81c784';
      ctx.fillRect(cx - 3, T - 14, 6, 4);
    } else if (stage === 1) {
      // Young tree
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(cx - 2, T - 18, 4, 14);
      ctx.fillStyle = color;
      ctx.fillRect(cx - 5, T - 22, 10, 8);
    } else if (stage === 2) {
      // Full tree no fruit
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(cx - 2, T - 22, 4, 18);
      ctx.fillStyle = color;
      ctx.fillRect(cx - 8, T - 28, 16, 12);
      ctx.fillRect(cx - 6, T - 30, 12, 4);
      // Leaf highlights
      ctx.fillStyle = '#43a047';
      ctx.fillRect(cx - 5, T - 26, 4, 4);
      ctx.fillRect(cx + 2, T - 24, 4, 4);
    } else {
      // Mature tree with red apples
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(cx - 2, T - 22, 4, 18);
      ctx.fillStyle = '#2e7d32';
      ctx.fillRect(cx - 8, T - 28, 16, 12);
      ctx.fillRect(cx - 6, T - 30, 12, 4);
      ctx.fillStyle = '#43a047';
      ctx.fillRect(cx - 5, T - 26, 4, 4);
      ctx.fillRect(cx + 2, T - 24, 4, 4);
      // Apples!
      ctx.fillStyle = color; // red
      ctx.fillRect(cx - 6, T - 24, 3, 3);
      ctx.fillRect(cx + 4, T - 26, 3, 3);
      ctx.fillRect(cx - 1, T - 22, 3, 3);
    }
  }

  _drawCactus(ctx, T, stage, color) {
    const cx = T / 2;
    if (stage === 0) {
      // Small cactus segment
      ctx.fillStyle = color;
      ctx.fillRect(cx - 3, T - 10, 6, 6);
      ctx.fillRect(cx - 2, T - 12, 4, 2);
    } else if (stage === 1) {
      // Growing stem
      ctx.fillStyle = color;
      ctx.fillRect(cx - 3, T - 18, 6, 14);
      ctx.fillRect(cx - 2, T - 20, 4, 2);
      // Spines
      ctx.fillStyle = '#a5d6a7';
      ctx.fillRect(cx - 5, T - 14, 2, 1);
      ctx.fillRect(cx + 4, T - 12, 2, 1);
    } else if (stage === 2) {
      // With arms
      ctx.fillStyle = color;
      ctx.fillRect(cx - 3, T - 24, 6, 20);
      // Left arm
      ctx.fillRect(cx - 8, T - 18, 5, 4);
      ctx.fillRect(cx - 8, T - 22, 4, 4);
      // Right arm
      ctx.fillRect(cx + 4, T - 16, 5, 4);
      ctx.fillRect(cx + 5, T - 20, 4, 4);
    } else {
      // Mature with flower/fruit
      ctx.fillStyle = color;
      ctx.fillRect(cx - 3, T - 26, 6, 22);
      ctx.fillRect(cx - 8, T - 20, 5, 4);
      ctx.fillRect(cx - 8, T - 24, 4, 4);
      ctx.fillRect(cx + 4, T - 18, 5, 4);
      ctx.fillRect(cx + 5, T - 22, 4, 4);
      // Flower on top
      ctx.fillStyle = color; // pink
      ctx.fillRect(cx - 2, T - 30, 4, 4);
      ctx.fillStyle = '#fff176';
      ctx.fillRect(cx - 1, T - 29, 2, 2);
    }
  }

  /** UI button textures */
  _generateUITextures() {
    // Coin icon
    const coin = this.textures.createCanvas('icon_coin', 16, 16);
    const cctx = coin.getContext();
    cctx.fillStyle = '#ffd700';
    cctx.beginPath();
    cctx.arc(8, 8, 6, 0, Math.PI * 2);
    cctx.fill();
    cctx.fillStyle = '#b8860b';
    cctx.fillRect(6, 6, 4, 4);
    cctx.fillStyle = '#ffd700';
    cctx.fillRect(7, 7, 2, 2);
    coin.refresh();

    // Seed bag icon
    const seedBag = this.textures.createCanvas('icon_seed', 16, 16);
    const sctx = seedBag.getContext();
    sctx.fillStyle = '#8d6e63';
    sctx.fillRect(3, 4, 10, 10);
    sctx.fillRect(5, 2, 6, 3);
    sctx.fillStyle = '#6d4c41';
    sctx.fillRect(5, 14, 6, 2);
    // Seeds inside
    sctx.fillStyle = '#fdd835';
    sctx.fillRect(6, 7, 2, 2);
    sctx.fillRect(9, 8, 2, 2);
    sctx.fillRect(7, 10, 2, 2);
    seedBag.refresh();

    // Selection cursor
    const cursor = this.textures.createCanvas('cursor', TILE_SIZE, TILE_SIZE);
    const curCtx = cursor.getContext();
    curCtx.strokeStyle = '#ffd700';
    curCtx.lineWidth = 2;
    // Corner brackets
    const c = 8;
    // Top-left
    curCtx.fillStyle = '#ffd700';
    curCtx.fillRect(0, 0, c, 2);
    curCtx.fillRect(0, 0, 2, c);
    // Top-right
    curCtx.fillRect(TILE_SIZE - c, 0, c, 2);
    curCtx.fillRect(TILE_SIZE - 2, 0, 2, c);
    // Bottom-left
    curCtx.fillRect(0, TILE_SIZE - 2, c, 2);
    curCtx.fillRect(0, TILE_SIZE - c, 2, c);
    // Bottom-right
    curCtx.fillRect(TILE_SIZE - c, TILE_SIZE - 2, c, 2);
    curCtx.fillRect(TILE_SIZE - 2, TILE_SIZE - c, 2, c);
    cursor.refresh();
  }

  /** Market building texture */
  _generateMarketTexture() {
    const W = TILE_SIZE * 3;
    const H = TILE_SIZE * 2;
    const canvas = this.textures.createCanvas('market', W, H);
    const ctx = canvas.getContext();

    // Building body
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(4, H / 3, W - 8, H * 2 / 3 - 4);

    // Roof
    ctx.fillStyle = '#c62828';
    ctx.fillRect(0, H / 3 - 8, W, 12);
    ctx.fillStyle = '#b71c1c';
    ctx.fillRect(4, H / 3 - 14, W - 8, 8);

    // Door
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(W / 2 - 8, H / 2, 16, H / 2 - 4);

    // Window left
    ctx.fillStyle = '#bbdefb';
    ctx.fillRect(12, H / 2 + 2, 12, 10);
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(17, H / 2 + 2, 2, 10);
    ctx.fillRect(12, H / 2 + 6, 12, 2);

    // Window right
    ctx.fillStyle = '#bbdefb';
    ctx.fillRect(W - 24, H / 2 + 2, 12, 10);
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(W - 19, H / 2 + 2, 2, 10);
    ctx.fillRect(W - 24, H / 2 + 6, 12, 2);

    // Sign
    ctx.fillStyle = '#fff9c4';
    ctx.fillRect(W / 2 - 16, H / 3 - 4, 32, 10);
    ctx.fillStyle = '#d32f2f';
    ctx.font = '8px monospace';
    ctx.fillText('SHOP', W / 2 - 10, H / 3 + 4);

    canvas.refresh();
  }

  /** Particle texture */
  _generateParticleTexture() {
    const canvas = this.textures.createCanvas('particle', 4, 4);
    const ctx = canvas.getContext();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(1, 1, 2, 2);
    canvas.refresh();

    // Water drop particle
    const waterDrop = this.textures.createCanvas('particle_water', 4, 6);
    const wctx = waterDrop.getContext();
    wctx.fillStyle = '#4fc3f7';
    wctx.fillRect(1, 0, 2, 2);
    wctx.fillRect(0, 2, 4, 3);
    wctx.fillRect(1, 5, 2, 1);
    waterDrop.refresh();
  }

  _generateExpansionTextures() {
    const T = TILE_SIZE;

    // 1. Ore Rock Tiles
    const ores = {
      coal: '#212121',
      copper: '#d84315',
      iron: '#b0bec5',
      gold: '#ffd700'
    };
    for (const [ore, spotColor] of Object.entries(ores)) {
      const canvas = this.textures.createCanvas(`tile_ore_${ore}`, T, T);
      const ctx = canvas.getContext();
      ctx.fillStyle = '#607d8b'; // Rock background
      ctx.fillRect(0, 0, T, T);
      // Rock texture outline
      ctx.strokeStyle = '#455a64';
      ctx.strokeRect(2, 2, T - 4, T - 4);
      // Ore flecks
      ctx.fillStyle = spotColor;
      ctx.fillRect(6, 6, 4, 4);
      ctx.fillRect(18, 8, 5, 4);
      ctx.fillRect(10, 18, 4, 5);
      ctx.fillRect(20, 20, 6, 4);
      canvas.refresh();
    }

    // 2. Gates
    // Gate Debris
    const debris = this.textures.createCanvas('tile_gate_debris', T, T);
    const dctx = debris.getContext();
    dctx.fillStyle = '#8b6914'; // dirt/wood
    dctx.fillRect(0, 0, T, T);
    // Crossed logs
    dctx.fillStyle = '#5d4037';
    dctx.fillRect(4, 4, T - 8, 6);
    dctx.fillRect(4, 20, T - 8, 6);
    dctx.fillStyle = '#3e2723';
    dctx.fillRect(8, 4, 6, T - 8);
    debris.refresh();

    // Gate Iron
    const ironGate = this.textures.createCanvas('tile_gate_iron', T, T);
    const igctx = ironGate.getContext();
    igctx.fillStyle = '#455a64';
    igctx.fillRect(0, 0, T, T);
    // Gate bars
    igctx.fillStyle = '#90a4ae';
    for (let x = 4; x < T; x += 8) {
      igctx.fillRect(x, 2, 2, T - 4);
    }
    igctx.fillRect(2, 8, T - 4, 3);
    igctx.fillRect(2, 22, T - 4, 3);
    ironGate.refresh();

    // Gate Laser
    const laserGate = this.textures.createCanvas('tile_gate_laser', T, T);
    const lgctx = laserGate.getContext();
    lgctx.fillStyle = '#1a1a2e';
    lgctx.fillRect(0, 0, T, T);
    // Red pulsing core
    lgctx.fillStyle = '#ff1744';
    lgctx.fillRect(14, 0, 4, T);
    lgctx.fillStyle = '#ff8a80';
    lgctx.fillRect(15, 0, 2, T);
    laserGate.refresh();

    // 3. Machines
    const machines = {
      mill: { base: '#7d5633', detail: '#cfd8dc', shape: 'mill' },
      bakery: { base: '#424242', detail: '#ff3d00', shape: 'oven' },
      press: { base: '#006064', detail: '#80deea', shape: 'press' },
      boiler: { base: '#4e342e', detail: '#ff6d00', shape: 'boiler' },
      purifier: { base: '#0d47a1', detail: '#90caf9', shape: 'purifier' },
      fryer: { base: '#ff6f00', detail: '#ffd54f', shape: 'fryer' },
      smelter: { base: '#bf360c', detail: '#ffab00', shape: 'smelter' },
      assembler: { base: '#37474f', detail: '#00e5ff', shape: 'assembler' },
      module_crafter: { base: '#4a148c', detail: '#ea80fc', shape: 'crafter' },
    };

    for (const [mName, mConfig] of Object.entries(machines)) {
      const canvas = this.textures.createCanvas(`machine_${mName}`, T, T);
      const ctx = canvas.getContext();
      ctx.fillStyle = mConfig.base;
      ctx.fillRect(2, 2, T - 4, T - 4);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(4, 4, T - 8, T - 8);

      // Unique machine visuals
      ctx.fillStyle = mConfig.detail;
      if (mConfig.shape === 'mill') {
        ctx.fillRect(T / 2 - 1, 4, 2, T - 8);
        ctx.fillRect(4, T / 2 - 1, T - 8, 2);
      } else if (mConfig.shape === 'oven') {
        ctx.fillStyle = '#212121';
        ctx.fillRect(8, 16, 16, 10);
        ctx.fillStyle = '#ff6d00';
        ctx.fillRect(12, 19, 8, 4);
      } else if (mConfig.shape === 'press') {
        ctx.fillRect(8, 6, 16, 4);
        ctx.fillRect(12, 10, 8, 16);
      } else if (mConfig.shape === 'boiler') {
        ctx.fillRect(6, 10, 20, 14);
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(10, 6, 12, 4);
      } else if (mConfig.shape === 'purifier') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(8, 8, 16, 16);
        ctx.fillStyle = '#0288d1';
        ctx.fillRect(10, 10, 12, 12);
      } else if (mConfig.shape === 'fryer') {
        ctx.fillRect(6, 12, 20, 12);
        ctx.fillStyle = '#ffd54f';
        ctx.fillRect(8, 8, 6, 4);
      } else if (mConfig.shape === 'smelter') {
        ctx.fillRect(8, 18, 16, 8);
        ctx.fillStyle = '#ff3d00';
        ctx.fillRect(10, 8, 12, 10);
      } else if (mConfig.shape === 'assembler') {
        ctx.fillRect(14, 4, 4, 16);
        ctx.fillRect(10, 16, 12, 4);
      } else if (mConfig.shape === 'crafter') {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(6, 6, 20, 12);
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(10, 8, 12, 2);
        ctx.fillRect(8, 12, 6, 4);
      }
      canvas.refresh();
    }

    // 4. Special NPC Buyer
    const buyer = this.textures.createCanvas('buyer_npc', T * 4, T);
    const bctx = buyer.getContext();
    const colors = ['#ffd54f', '#ffb74d', '#ff8a65', '#a1887f'];
    for (let i = 0; i < 4; i++) {
      const ox = i * T;
      bctx.fillStyle = colors[i];
      bctx.fillRect(ox + 10, 8, 12, 16);
      bctx.fillStyle = '#ffcc88';
      bctx.fillRect(ox + 11, 4, 10, 10);
      bctx.fillStyle = '#e94560'; // Red eyes/glasses
      bctx.fillRect(ox + 13, 7, 2, 2);
      bctx.fillRect(ox + 18, 7, 2, 2);
      bctx.fillStyle = '#4a148c'; // Purple hat
      bctx.fillRect(ox + 9, 2, 14, 4);
      bctx.fillRect(ox + 11, 0, 10, 3);
    }
    buyer.refresh();
    this.textures.get('buyer_npc').add(0, 0, 0, 0, T, T);
    this.textures.get('buyer_npc').add(1, 0, T, 0, T, T);
    this.textures.get('buyer_npc').add(2, 0, T * 2, 0, T, T);
    this.textures.get('buyer_npc').add(3, 0, T * 3, 0, T, T);

    // 5. Item Icons (16x16)
    const items = {
      coal: '#212121',
      copper_ore: '#bf360c',
      iron_ore: '#78909c',
      gold_ore: '#ffd700',
      copper_ingot: '#ff7043',
      iron_ingot: '#cfd8dc',
      gold_ingot: '#ffea00',
      flour: '#f5f5f5',
      bread: '#8d6e63',
      apple_juice: '#ff8a80',
      apple_jam: '#c62828',
      potato_starch: '#eceff1',
      chips: '#ffd54f',
      wire: '#ff7043',
      gear: '#37474f',
      chip: '#00e5ff',
    };

    for (const [iName, iColor] of Object.entries(items)) {
      const canvas = this.textures.createCanvas(`icon_${iName}`, 16, 16);
      const ctx = canvas.getContext();
      ctx.fillStyle = iColor;
      if (iName.endsWith('_ingot')) {
        ctx.fillRect(2, 4, 12, 8);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(3, 5, 10, 6);
      } else if (iName.endsWith('_ore')) {
        ctx.beginPath();
        ctx.arc(8, 8, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(6, 6, 2, 2);
      } else if (iName === 'coal') {
        ctx.fillRect(4, 4, 8, 8);
        ctx.fillRect(6, 3, 4, 10);
      } else if (iName === 'flour') {
        ctx.fillRect(3, 3, 10, 11);
        ctx.fillStyle = '#795548';
        ctx.fillRect(3, 9, 10, 2); // bag tie
      } else if (iName === 'bread') {
        ctx.beginPath();
        ctx.ellipse(8, 8, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffb74d';
        ctx.fillRect(5, 7, 2, 2);
        ctx.fillRect(9, 7, 2, 2);
      } else if (iName === 'apple_juice') {
        ctx.fillStyle = '#cfd8dc';
        ctx.fillRect(5, 2, 6, 12);
        ctx.fillStyle = iColor;
        ctx.fillRect(6, 5, 4, 8);
      } else if (iName === 'apple_jam') {
        ctx.fillStyle = iColor;
        ctx.fillRect(4, 5, 8, 9);
        ctx.fillStyle = '#ffd700'; // gold lid
        ctx.fillRect(5, 3, 6, 2);
      } else if (iName === 'potato_starch') {
        ctx.fillStyle = '#90a4ae';
        ctx.fillRect(4, 4, 8, 10);
        ctx.fillStyle = iColor;
        ctx.fillRect(5, 6, 6, 7);
      } else if (iName === 'chips') {
        ctx.fillRect(3, 2, 10, 12);
        ctx.fillStyle = '#d84315';
        ctx.fillRect(5, 7, 6, 2);
      } else if (iName === 'wire') {
        ctx.strokeStyle = iColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(8, 8, 5, 0, Math.PI * 2);
        ctx.stroke();
      } else if (iName === 'gear') {
        ctx.beginPath();
        ctx.arc(8, 8, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(8, 8, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (iName === 'chip') {
        ctx.fillRect(3, 3, 10, 10);
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(5, 5, 6, 6);
      }
      canvas.refresh();
    }

    // 6. Custom modules icons
    const modules = {
      module_mining: '⛏️',
      module_bigger_seller: '💸',
      module_super_carrier: '🚚',
      module_advanced_farming: '🚜',
      module_speed_booster: '⚡'
    };
    for (const [modId, emoji] of Object.entries(modules)) {
      const canvas = this.textures.createCanvas(`icon_${modId}`, 16, 16);
      const ctx = canvas.getContext();
      ctx.fillStyle = '#0f3460';
      ctx.fillRect(0, 0, 16, 16);
      ctx.strokeStyle = '#ffd700';
      ctx.strokeRect(0, 0, 16, 16);
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 8, 8);
      canvas.refresh();
    }

    // 7. Eli NPC Texture (Waifu industrial manager)
    const eli = this.textures.createCanvas('eli_npc', T * 4, T);
    const ectx = eli.getContext();
    const eliColors = {
      hair: '#ff7043',   // orange hair
      suit: '#1a1a2e',   // dark blue/grey suit
      shirt: '#ffffff',  // white shirt
      skin: '#ffcc88',   // light skin
      tie: '#ff0055'     // pink tie / accent
    };
    for (let i = 0; i < 4; i++) {
      const ox = i * T;
      ectx.fillStyle = eliColors.hair;
      ectx.fillRect(ox + 8, 4, 16, 12);
      ectx.fillStyle = eliColors.suit;
      ectx.fillRect(ox + 10, 12, 12, 16);
      ectx.fillStyle = eliColors.shirt;
      ectx.fillRect(ox + 14, 12, 4, 6);
      ectx.fillStyle = eliColors.tie;
      ectx.fillRect(ox + 15, 14, 2, 4);
      ectx.fillStyle = eliColors.skin;
      ectx.fillRect(ox + 11, 4, 10, 9);
      ectx.fillStyle = eliColors.hair;
      ectx.fillRect(ox + 10, 3, 12, 3);
      ectx.fillRect(ox + 9, 6, 2, 4);
      ectx.fillRect(ox + 21, 6, 2, 4);
      ectx.fillStyle = '#ff0055';
      if (i !== 1) {
        const eyeOffset = (i === 2) ? -1 : (i === 3) ? 1 : 0;
        ectx.fillRect(ox + 13 + eyeOffset, 7, 1, 2);
        ectx.fillRect(ox + 18 + eyeOffset, 7, 1, 2);
      }
      ectx.fillStyle = '#000000';
      ectx.fillRect(ox + 11, 28, 4, 4);
      ectx.fillRect(ox + 17, 28, 4, 4);
    }
    eli.refresh();
    this.textures.get('eli_npc').add(0, 0, 0, 0, T, T);
    this.textures.get('eli_npc').add(1, 0, T, 0, T, T);
    this.textures.get('eli_npc').add(2, 0, T * 2, 0, T, T);
    this.textures.get('eli_npc').add(3, 0, T * 3, 0, T, T);

    // 8. Conveyor Belt Tiles
    const dirs = ['up', 'down', 'left', 'right'];
    dirs.forEach(dir => {
      const conveyor = this.textures.createCanvas(`tile_conveyor_${dir}`, T, T);
      const cctx = conveyor.getContext();
      cctx.fillStyle = '#2d2d3a';
      cctx.fillRect(0, 0, T, T);
      cctx.fillStyle = '#4e4e5a';
      cctx.fillRect(0, 0, T, 2);
      cctx.fillRect(0, T - 2, T, 2);
      cctx.fillRect(0, 0, 2, T);
      cctx.fillRect(T - 2, 0, 2, T);
      cctx.fillStyle = '#1e1e24';
      if (dir === 'left' || dir === 'right') {
        for (let x = 4; x < T; x += 6) {
          cctx.fillRect(x, 2, 2, T - 4);
        }
        cctx.fillStyle = '#ff0055';
        if (dir === 'right') {
          cctx.beginPath();
          cctx.moveTo(12, 10);
          cctx.lineTo(20, 16);
          cctx.lineTo(12, 22);
          cctx.fill();
        } else {
          cctx.beginPath();
          cctx.moveTo(20, 10);
          cctx.lineTo(12, 16);
          cctx.lineTo(20, 22);
          cctx.fill();
        }
      } else {
        for (let y = 4; y < T; y += 6) {
          cctx.fillRect(2, y, T - 4, 2);
        }
        cctx.fillStyle = '#ff0055';
        if (dir === 'down') {
          cctx.beginPath();
          cctx.moveTo(10, 12);
          cctx.lineTo(16, 20);
          cctx.lineTo(22, 12);
          cctx.fill();
        } else {
          cctx.beginPath();
          cctx.moveTo(10, 20);
          cctx.lineTo(16, 12);
          cctx.lineTo(22, 20);
          cctx.fill();
        }
      }
      conveyor.refresh();
    });
  }
}
