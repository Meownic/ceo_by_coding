/**
 * GameScene — Main Gameplay Scene
 * Handles the farm world, player, drone, and all game systems.
 */
import Phaser from 'phaser';
import {
  TILE_SIZE, GRID_COLS, GRID_ROWS,
  GAME_WIDTH, GAME_HEIGHT, COLORS,
  STARTING_COINS, GATES, ZONE_BOUNDS
} from '../config/constants.js';
import GridManager from '../systems/GridManager.js';
import GrowthSystem from '../systems/GrowthSystem.js';
import Player from '../entities/Player.js';
import Drone from '../entities/Drone.js';
import Warehouse from '../entities/Warehouse.js';
import InventorySystem from '../systems/InventorySystem.js';
import EconomySystem from '../systems/EconomySystem.js';
import ProfileSystem from '../systems/ProfileSystem.js';
import DroneAPI from '../systems/DroneAPI.js';
import ScriptSandbox from '../systems/ScriptSandbox.js';
import ScriptManager from '../systems/ScriptManager.js';
import HUD from '../ui/HUD.js';
import Hotbar from '../ui/Hotbar.js';
import MarketUI from '../ui/MarketUI.js';
import MachineUI from '../ui/MachineUI.js';
import DeviceManager from '../ui/DeviceManager.js';
import { EditorBridge } from '../ui/EditorBridge.js';
import { ConsoleManager } from '../ui/ConsoleManager.js';
import { PLANT_TYPES } from '../data/plants.js';
import CloudSaveSystem from '../systems/CloudSaveSystem.js';
import SaveSystem from '../systems/SaveSystem.js';
import SharedMemory from '../systems/SharedMemory.js';
import MachineSystem from '../systems/MachineSystem.js';
import SpecialBuyerSystem from '../systems/SpecialBuyerSystem.js';
import { MODULE_ITEM_IDS, getModuleTypeFromItemId } from '../data/modules.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.cameras.main.fadeIn(500);

    // ── Initialize Systems ──
    this.gridManager = new GridManager(GRID_COLS, GRID_ROWS);
    this.growthSystem = new GrowthSystem(this.gridManager);
    this.inventorySystem = new InventorySystem();
    this.profileSystem = new ProfileSystem();
    this.economySystem = new EconomySystem(this.inventorySystem, this.profileSystem);
    this.scriptManager = new ScriptManager();
    this.deviceManager = new DeviceManager();
    this.sharedMemory = new SharedMemory();   // ← global inter-drone bulletin board
    this.machineSystem = new MachineSystem();
    this.specialBuyerSystem = new SpecialBuyerSystem();
    this.minedOres = [];
    this.cloudSaveSystem = new CloudSaveSystem();
    this.saveSystem = new SaveSystem(this);

    // Initialize Unlocked Zones state
    this.unlockedZones = {
      zone2: false,
      zone3: false,
      zone4: false
    };

    // ── Give player starting items ──
    this.inventorySystem.addItem('wheat_seed', 5);
    this.inventorySystem.addItem('potato_seed', 3);
    // Starting tools
    this.inventorySystem.addItem('watering_can', 1);
    this.inventorySystem.addItem('plow', 1);
    // Starting module (one farming module to equip to drone)
    this.inventorySystem.addItem(MODULE_ITEM_IDS.farming, 1);

    // ── Render the tile grid ──
    this.tileSprites = [];
    this.plantSprites = [];
    this._createTileGrid();

    // ── Create farm layout ──
    this._createFarmLayout();

    // ── Create Warehouse ──
    this.warehouse = new Warehouse(this, 10, 2, 2, 2);

    // ── Create Player ──
    this.player = new Player(this, 5, 5);
    this.player.gridManager = this.gridManager; // Enable boundary checking
    this.add.existing(this.player);

    this.lastPlayerZone = 'zone1';

    // Camera follow and bounds
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this._updateCameraBounds();

    // ── Create Drone ──
    // NOTE: Drone constructor calls scene.add.existing(this) internally.
    this.drone = new Drone(this, 3, 3, this.gridManager, this.profileSystem);

    // Register drone with device manager
    this.deviceManager.register(this.drone);

    // ── Create UI ──
    this.hud = new HUD(this, this.inventorySystem);
    this.hotbar = new Hotbar(this, this.inventorySystem);
    this.marketUI = new MarketUI(this, this.economySystem, this.inventorySystem);
    this.machineUI = new MachineUI(this, this.machineSystem, this.inventorySystem);

    // Buyer NPC sprite field
    this.buyerNPCSprite = null;

    // ── Setup Special Buyer Event Listeners ──
    this.specialBuyerSystem.events.on('buyer-arrived', (buyer) => {
      if (this.hud) {
        this.hud.showMessage(`✨ Special Buyer ${buyer.name} arrived! Wants ${buyer.reqCount}x ${buyer.reqItem.replace('_', ' ')}. Reward: ${buyer.reward}g!`, 5000);
      }
      this._spawnSpecialBuyerNPC();
    });

    this.specialBuyerSystem.events.on('buyer-left', (buyer) => {
      if (this.hud) {
        this.hud.showMessage(`💨 Special Buyer ${buyer.name} left.`, 3000);
      }
      this._destroySpecialBuyerNPC();
    });

    this.specialBuyerSystem.events.on('buyer-fulfilled', (buyer) => {
      if (this.hud) {
        this.hud.showMessage(`💰 Order fulfilled for ${buyer.name}! +${buyer.reward}g!`, 4000);
      }
      this.inventorySystem.addCoins(buyer.reward);
      this.profileSystem.addXp(50);
      this.events.emit('xp-gain', { x: this.player.tileX, y: this.player.tileY, amount: 50 });
      this._destroySpecialBuyerNPC();
      this._emitFruitParticles(17, 3); // Celebration at market dock
    });

    // Equip default tools to hotbar (automatically registers and deducts from general inventory)
    this.hotbar.moveItemToHotbar('plow', 0);
    this.hotbar.moveItemToHotbar('watering_can', 1);
    this.hotbar.moveItemToHotbar('wheat_seed', 2);
    this.hotbar.moveItemToHotbar('potato_seed', 3);

    // ── Create selection cursor ──
    this.selectionCursor = this.add.image(0, 0, 'cursor');
    this.selectionCursor.setDepth(20);
    this.selectionCursor.setAlpha(0.8);

    // Cursor blink
    this.tweens.add({
      targets: this.selectionCursor,
      alpha: { from: 0.8, to: 0.4 },
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    // ── Setup Input ──
    this._setupInput();

    // ── Setup Editor Bridge (connects to DOM Monaco editor) ──
    this.consoleManager = new ConsoleManager();
    this.editorBridge = new EditorBridge(
      this,
      this.scriptManager,
      this.drone.scriptSandbox,
      this.consoleManager,
      this.deviceManager
    );

    // Load local save if it exists
    const loaded = this.saveSystem.loadLocalSave();
    if (loaded) {
      if (this.editorBridge) {
        this.editorBridge.setEditorContent(this.editorBridge._getActiveCode());
        this.editorBridge._renderTabs();
        this.editorBridge._renderDevicesTab();
        this.editorBridge._renderProfile();
        this.editorBridge._renderBackpack();
      }
    }

    // ── Setup Conveyor Belt Ticker ──
    this.time.addEvent({
      delay: 1000,
      callback: () => {
        if (this.gridManager) {
          this.gridManager.tickConveyorItems(this);
        }
      },
      loop: true
    });

    // Check simulated offline progress
    this.checkOfflineProgress();

    // Hook window beforeunload to record active script production rates
    window.addEventListener('beforeunload', () => {
      // Auto-save the game first
      this.saveSystem.saveLocal();

      // Measure the rates of all running drones
      const activeRates = {};
      let hasCrash = false;
      let crashedDrone = '';
      let runningCount = 0;

      if (this.deviceManager) {
        this.deviceManager.getAll().forEach((drone) => {
          if (drone.status === 'running') {
            runningCount++;
            if (drone.productionRates) {
              for (const [itemId, rate] of Object.entries(drone.productionRates)) {
                activeRates[itemId] = (activeRates[itemId] || 0) + rate;
              }
            } else if (drone.benchmarkError) {
              hasCrash = true;
              crashedDrone = drone.label || drone.id;
            }
          }
        });
      }

      const sessionData = {
        lastActiveTimestamp: Date.now(),
        activeRates,
        hasCrash: hasCrash || (runningCount > 0 && Object.keys(activeRates).length === 0),
        crashedDrone
      };
      localStorage.setItem('LOGISTICS_IDLE_DATA', JSON.stringify(sessionData));
    });

    // Set up auto-save timer every 10 seconds
    this.time.addEvent({
      delay: 10000,
      callback: () => {
        this.saveSystem.saveLocal();
      },
      loop: true
    });

    // ── Setup Growth Event Listeners ──
    this.growthSystem.events.on('stage-change', (data) => {
      this._updatePlantSprite(data.x, data.y);
      this._emitGrowthParticles(data.x, data.y);
    });

    this.growthSystem.events.on('fruit-ready', (data) => {
      this._updatePlantSprite(data.x, data.y);
      this._emitFruitParticles(data.x, data.y);
    });

    // ── Setup XP Gain Event Listener ──
    this.events.on('xp-gain', (data) => {
      this._showFloatingText(data.x, data.y, `+${data.amount} XP`, 0x00ffff);
    });

    // ── Setup Level Up Listener ──
    this.profileSystem.events.on('level-up', (data) => {
      this.hud.showMessage(`🎉 LEVEL UP! Reached Level ${data.level}!`, 4000);
      this._emitFruitParticles(this.player.tileX, this.player.tileY);
    });

    // ── Market zone (tile area) ──
    this.marketZone = { x: 17, y: 1, w: 3, h: 2 };
    // ── Warehouse zone ──
    this.warehouseZone = { x: 10, y: 2 };

    // ── Create market building sprite ──
    if (this.textures.exists('market')) {
      this.marketSprite = this.add.image(
        this.marketZone.x * TILE_SIZE + (this.marketZone.w * TILE_SIZE) / 2,
        this.marketZone.y * TILE_SIZE + (this.marketZone.h * TILE_SIZE) / 2,
        'market'
      );
      this.marketSprite.setDepth(5);
    }

    // Show welcome message
    this.hud.showMessage('Welcome! Hotbar: 1-8 to select tool. SPACE to use. E to interact.', 5000);
  }

  spawnNewDrone() {
    const dm = this.deviceManager;
    if (!dm) return null;

    const count = dm.getAll().length;
    if (count >= 5) {
      if (this.hud) this.hud.showMessage('Maximum drone limit reached (5)!', 3000);
      return null;
    }

    // Spread new drones so they don't all stack on the same tile
    const spawnPositions = [
      { tx: 3, ty: 3 },
      { tx: 5, ty: 3 },
      { tx: 7, ty: 3 },
      { tx: 3, ty: 5 },
      { tx: 5, ty: 5 },
    ];
    const { tx, ty } = spawnPositions[count] || { tx: 3 + count, ty: 3 };

    // NOTE: Drone constructor calls scene.add.existing(this) internally.
    // Do NOT call this.add.existing() again here — it would double-register the sprite.
    const newDrone = new Drone(this, tx, ty, this.gridManager, this.profileSystem);

    dm.register(newDrone);

    // Greet the player with a say bubble
    setTimeout(() => {
      newDrone.say(`Hi! I am ${newDrone.label}. Equip a module in the Devices tab to get started!`);
    }, 500);

    return newDrone;
  }

  update(time, delta) {
    // Update growth system
    this.growthSystem.update(time, delta);

    // Update refineries and special buyers
    if (this.machineSystem) this.machineSystem.update(delta);
    if (this.specialBuyerSystem) this.specialBuyerSystem.update(delta);

    // Update mined ores regeneration
    if (this.minedOres) {
      this.minedOres = this.minedOres.filter(ore => {
        ore.respawnTime -= delta;
        if (ore.respawnTime <= 0) {
          this.gridManager.setOre(ore.x, ore.y, ore.type);
          this._updateTileSprite(ore.x, ore.y);
          return false;
        }
        return true;
      });
    }

    // Update player
    if (this.player) {
      this.player.update(time, delta);
    }

    // Update all drones
    if (this.deviceManager) {
      this.deviceManager.getAll().forEach(drone => {
        drone.update(time, delta);
      });
    }

    // Update HUD
    if (this.hud) {
      this.hud.update();
    }

    // Update floating interaction prompts
    this._updateInteractionPrompts();

    // Check for zone transitions
    const currentZone = this._getPlayerZone();
    if (currentZone !== this.lastPlayerZone) {
      this.lastPlayerZone = currentZone;
      this._showZoneBanner(currentZone);
    }

    // Update selection cursor position
    this._updateCursor();
  }

  // ══════════════════════════════════════
  //  TILE GRID RENDERING
  // ══════════════════════════════════════

  _createTileGrid() {
    for (let y = 0; y < GRID_ROWS; y++) {
      this.tileSprites[y] = [];
      this.plantSprites[y] = [];
      for (let x = 0; x < GRID_COLS; x++) {
        const tileSprite = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          'tile_grass'
        );
        tileSprite.setDepth(0);
        this.tileSprites[y][x] = tileSprite;
        this.plantSprites[y][x] = null;
      }
    }
  }

  _createFarmLayout() {
    // 1. Draw all fences
    // Outer border fences
    for (let x = 0; x < GRID_COLS; x++) {
      this._setTileTexture(x, 0, 'tile_fence');
      this._setTileTexture(x, GRID_ROWS - 1, 'tile_fence');
    }
    for (let y = 0; y < GRID_ROWS; y++) {
      this._setTileTexture(0, y, 'tile_fence');
      this._setTileTexture(GRID_COLS - 1, y, 'tile_fence');
    }

    // Zone separators fences
    // separator x=19 (rows 0-19)
    for (let y = 0; y <= 19; y++) {
      this._setTileTexture(19, y, 'tile_fence');
    }
    // separator y=19 (cols 0-39)
    for (let x = 0; x <= 39; x++) {
      this._setTileTexture(x, 19, 'tile_fence');
    }
    // separator x=39 (rows 0-39)
    for (let y = 0; y <= 39; y++) {
      this._setTileTexture(39, y, 'tile_fence');
    }

    // Path to market
    for (let x = 15; x < 18; x++) {
      this._setTileTexture(x, 1, 'tile_path');
      this._setTileTexture(x, 2, 'tile_path');
    }

    // Path to warehouse
    for (let x = 9; x <= 12; x++) {
      this._setTileTexture(x, 1, 'tile_path');
    }

    // Pre-till some tiles for tutorial
    for (let x = 3; x <= 7; x++) {
      for (let y = 3; y <= 6; y++) {
        this.gridManager.tillTile(x, y);
        this._updateTileSprite(x, y);
      }
    }

    // 2. Set locked gates on grid manager
    this.gridManager.setGate(19, 10, 'zone2', !this.unlockedZones.zone2);
    this.gridManager.setGate(10, 19, 'zone3', !this.unlockedZones.zone3);
    this.gridManager.setGate(39, 20, 'zone4', !this.unlockedZones.zone4);

    // Apply gate textures
    this._updateTileSprite(19, 10);
    this._updateTileSprite(10, 19);
    this._updateTileSprite(39, 20);

    // 3. Register Crafting Refineries in Zone 2
    this.machineSystem.registerMachine('mill_001', 'mill', 25, 5);
    this.gridManager.setMachine(25, 5, 'mill_001', 'mill');
    this._updateTileSprite(25, 5);

    this.machineSystem.registerMachine('bakery_001', 'bakery', 25, 12);
    this.gridManager.setMachine(25, 12, 'bakery_001', 'bakery');
    this._updateTileSprite(25, 12);

    this.machineSystem.registerMachine('press_001', 'press', 32, 5);
    this.gridManager.setMachine(32, 5, 'press_001', 'press');
    this._updateTileSprite(32, 5);

    this.machineSystem.registerMachine('boiler_001', 'boiler', 32, 12);
    this.gridManager.setMachine(32, 12, 'boiler_001', 'boiler');
    this._updateTileSprite(32, 12);

    this.machineSystem.registerMachine('purifier_001', 'purifier', 36, 5);
    this.gridManager.setMachine(36, 5, 'purifier_001', 'purifier');
    this._updateTileSprite(36, 5);

    this.machineSystem.registerMachine('fryer_001', 'fryer', 36, 12);
    this.gridManager.setMachine(36, 12, 'fryer_001', 'fryer');
    this._updateTileSprite(36, 12);

    // 4. Register Smelter in Zone 3
    this.machineSystem.registerMachine('smelter_001', 'smelter', 15, 22);
    this.gridManager.setMachine(15, 22, 'smelter_001', 'smelter');
    this._updateTileSprite(15, 22);

    // 5. Register Ore Rocks in Zone 3
    const oreNodes = [
      { x: 5, y: 25, type: 'coal' },
      { x: 6, y: 25, type: 'coal' },
      { x: 5, y: 26, type: 'coal' },
      { x: 15, y: 30, type: 'copper' },
      { x: 16, y: 30, type: 'copper' },
      { x: 25, y: 32, type: 'iron' },
      { x: 26, y: 32, type: 'iron' },
      { x: 35, y: 35, type: 'gold' }
    ];
    oreNodes.forEach(node => {
      this.gridManager.setOre(node.x, node.y, node.type);
      this._updateTileSprite(node.x, node.y);
    });

    // 6. Register Advanced Refineries in Zone 4
    this.machineSystem.registerMachine('assembler_001', 'assembler', 48, 10);
    this.gridManager.setMachine(48, 10, 'assembler_001', 'assembler');
    this._updateTileSprite(48, 10);

    this.machineSystem.registerMachine('crafter_001', 'module_crafter', 48, 20);
    this.gridManager.setMachine(48, 20, 'crafter_001', 'module_crafter');
    this._updateTileSprite(48, 20);
  }

  _setTileTexture(x, y, textureKey) {
    if (this.tileSprites[y] && this.tileSprites[y][x]) {
      this.tileSprites[y][x].setTexture(textureKey);
    }
  }

  /** Public method for DroneAPI to call when tile state changes */
  updateTileSprite(x, y) {
    this._updateTileSprite(x, y);
  }

  _updateTileSprite(x, y) {
    const tile = this.gridManager.getTile(x, y);
    if (!tile) return;

    const sprite = this.tileSprites[y]?.[x];
    if (!sprite) return;

    if (tile.isOre) {
      sprite.setTexture(`tile_ore_${tile.oreType}`);
    } else if (tile.isMachine) {
      sprite.setTexture(`machine_${tile.machineType}`);
    } else if (tile.isGate) {
      if (tile.isLocked) {
        if (tile.gateKey === 'zone2') sprite.setTexture('tile_gate_debris');
        else if (tile.gateKey === 'zone3') sprite.setTexture('tile_gate_iron');
        else if (tile.gateKey === 'zone4') sprite.setTexture('tile_gate_laser');
      } else {
        sprite.setTexture('tile_path');
      }
    } else if (tile.isWatered) {
      sprite.setTexture('tile_watered');
    } else if (tile.isTilled) {
      sprite.setTexture('tile_tilled');
    } else {
      // Revert to layout-default texture
      if (x === 0 || x === this.gridManager.cols - 1 || y === 0 || y === this.gridManager.rows - 1) {
        sprite.setTexture('tile_fence');
      } else if (x === 19 && y >= 0 && y <= 19 && y !== 10) {
        sprite.setTexture('tile_fence');
      } else if (y === 19 && x >= 0 && x <= 39 && x !== 10) {
        sprite.setTexture('tile_fence');
      } else if (x === 39 && y >= 0 && y <= 39 && y !== 20) {
        sprite.setTexture('tile_fence');
      } else {
        const isPath = (x >= 15 && x < 18 && y >= 1 && y <= 2) || (x >= 9 && x <= 12 && y === 1);
        sprite.setTexture(isPath ? 'tile_path' : 'tile_grass');
      }
    }

    this._updatePlantSprite(x, y);
  }

  _updatePlantSprite(x, y) {
    const tile = this.gridManager.getTile(x, y);
    if (!tile) return;

    if (this.plantSprites[y]?.[x]) {
      this.plantSprites[y][x].destroy();
      this.plantSprites[y][x] = null;
    }

    if (tile.hasPlant && tile.plantType !== 'none') {
      const stage = tile.growthStage;
      const textureKey = `plant_${tile.plantType}_${stage}`;

      if (this.textures.exists(textureKey)) {
        const plantSprite = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          textureKey
        );
        plantSprite.setDepth(3);
        plantSprite.setScale(0.8);
        this.tweens.add({
          targets: plantSprite,
          scaleX: 1,
          scaleY: 1,
          duration: 200,
          ease: 'Back.easeOut',
        });

        if (tile.hasFruit) {
          this.tweens.add({
            targets: plantSprite,
            alpha: { from: 0.9, to: 1 },
            duration: 800,
            yoyo: true,
            repeat: -1,
          });
        }

        this.plantSprites[y][x] = plantSprite;
      }
    }
  }

  // ══════════════════════════════════════
  //  INPUT HANDLING
  // ══════════════════════════════════════

  _setupInput() {
    // SPACE uses active hotbar item on facing tile
    this.input.keyboard.on('keydown-SPACE', () => {
      if (this._isDOMInputFocused()) return;
      if (this.marketUI.isVisible()) return;
      if (this.machineUI && this.machineUI.isVisible()) return;
      this._useHotbarItem();
    });

    // E to interact (market, warehouse, drone, machine)
    this.input.keyboard.on('keydown-E', () => {
      if (this._isDOMInputFocused()) return;
      if (this.marketUI.isVisible()) {
        this.marketUI.hide();
      } else if (this.machineUI && this.machineUI.isVisible()) {
        this.machineUI.hide();
      } else {
        this._doInteract();
      }
    });

    // ESC to close overlays
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.marketUI.isVisible()) {
        this.marketUI.hide();
      }
      if (this.machineUI && this.machineUI.isVisible()) {
        this.machineUI.hide();
      }
    });

    // Q — Toggle Eli's Smartphone Overlay
    this.input.keyboard.on('keydown-Q', () => {
      if (this._isDOMInputFocused()) return;
      if (this.editorBridge) {
        this.editorBridge.toggleSmartphone();
      }
    });

    // B — Toggle Backpack Popup Overlay
    this.input.keyboard.on('keydown-B', () => {
      if (this._isDOMInputFocused()) return;
      if (this.editorBridge) {
        this.editorBridge.toggleBackpack();
      }
    });

    // Mouse click on ground to perform action
    this.input.on('pointerdown', (pointer, gameObjects) => {
      if (this._isDOMInputFocused()) return;
      if (this.marketUI.isVisible()) return;
      if (this.machineUI && this.machineUI.isVisible()) return;

      // Verify targeted target is the game canvas
      if (pointer.event && pointer.event.target !== this.sys.game.canvas) return;

      // Ignore click if it lands on a Phaser Hotbar UI object
      const isClickingHotbar = gameObjects.some(go => this.hotbar && this.hotbar.isHotbarObject(go));
      if (isClickingHotbar) return;

      // Execute action
      this._useHotbarItem();
    });

    // Remove captures for SPACE, E, Q, ESC, and Number keys to ensure DOM inputs work
    if (this.input && this.input.keyboard) {
      const keysToRelease = [
        Phaser.Input.Keyboard.KeyCodes.SPACE,
        Phaser.Input.Keyboard.KeyCodes.E,
        Phaser.Input.Keyboard.KeyCodes.Q,
        Phaser.Input.Keyboard.KeyCodes.ESC,
        Phaser.Input.Keyboard.KeyCodes.ONE,
        Phaser.Input.Keyboard.KeyCodes.TWO,
        Phaser.Input.Keyboard.KeyCodes.THREE,
        Phaser.Input.Keyboard.KeyCodes.FOUR,
        Phaser.Input.Keyboard.KeyCodes.FIVE,
        Phaser.Input.Keyboard.KeyCodes.SIX,
        Phaser.Input.Keyboard.KeyCodes.SEVEN,
        Phaser.Input.Keyboard.KeyCodes.EIGHT,
      ];
      this.input.keyboard.removeCapture(keysToRelease);
    }
  }

  /** Check if DOM editor/input is focused — guards all game key handlers */
  _isDOMInputFocused() {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
    const mc = document.getElementById('monaco-container');
    if (mc && mc.contains(active)) return true;
    return false;
  }

  /** Use the active hotbar item on the tile targeted by the mouse cursor */
  _useHotbarItem() {
    if (this.cursorTileX === undefined || this.cursorTileY === undefined) return;
    const x = this.cursorTileX;
    const y = this.cursorTileY;

    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) {
      this.hud.showMessage('Nothing there!', 1000);
      return;
    }

    // Check distance - must be within 2 tiles radius (Chebyshev distance)
    const dx = x - this.player.tileX;
    const dy = y - this.player.tileY;
    const inRange = (Math.max(Math.abs(dx), Math.abs(dy)) <= 2);

    if (!inRange) {
      this.hud.showMessage('Too far away!', 1000);
      return;
    }

    if (this.machineUI && this.machineUI.isVisible()) return;

    // Check if near market
    if (this._isTileInMarketZone(x, y)) {
      this.marketUI.show();
      return;
    }

    const actionInfo = this.hotbar.getActiveItemAction();
    if (!actionInfo) {
      // No item — try smart action
      const tile = this.gridManager.getTile(x, y);
      if (tile) this._doSmartAction(x, y, tile);
      return;
    }

    const tile = this.gridManager.getTile(x, y);
    if (!tile) return;

    switch (actionInfo.action) {
      case 'till':
        this._doTill(x, y, tile);
        break;
      case 'water':
        this._doWater(x, y, tile);
        break;
      case 'plant':
        this.selectedSeed = actionInfo.plantType;
        this._doPlant(x, y, tile);
        break;
      default:
        this._doSmartAction(x, y, tile);
        break;
    }
  }

  /** E key interaction — market, warehouse, drone equip */
  _doInteract() {
    if (!this.player) return;
    const px = this.player.tileX;
    const py = this.player.tileY;

    // Near market?
    if (this._isNearMarket()) {
      this.marketUI.show();
      return;
    }

    // Near warehouse?
    if (this.warehouse && this.warehouse.isAdjacentTo(px, py)) {
      if (this.editorBridge) {
        this.editorBridge.toggleWarehouse();
        this.hud.showMessage('Warehouse Storage: Opened Warehouse Storage Panel!', 4000);
      } else {
        this.hud.showMessage('Warehouse: Go to Devices tab in Code panel to manage storage!', 4000);
      }
      return;
    }

    // Facing tile action
    const facing = this.player.getFacingTile();
    const tile = this.gridManager.getTile(facing.x, facing.y);
    if (tile) {
      if (tile.isGate && tile.isLocked) {
        this._interactWithGate(facing.x, facing.y, tile);
        return;
      }
      if (tile.isMachine && tile.machineId) {
        this.machineUI.show(tile.machineId);
        return;
      }
      this._doSmartAction(facing.x, facing.y, tile);
    }
  }

  _cycleSeedHotbar() {
    const seeds = ['wheat_seed', 'potato_seed', 'cactus_seed', 'apple_tree_seed'];
    const currentActive = this.hotbar.activeSlot;
    
    // Find the next slot in the hotbar that already contains seeds
    for (let offset = 1; offset <= 8; offset++) {
      const nextIdx = (currentActive + offset) % 8;
      const itemId = this.hotbar.slots[nextIdx];
      if (itemId && seeds.includes(itemId)) {
        this.hotbar.setActiveSlot(nextIdx);
        const cropName = itemId.replace('_seed', '');
        const displayName = PLANT_TYPES[cropName]?.name || cropName;
        this.hud.showMessage(`Selected: ${displayName}`, 1000);
        return;
      }
    }
    this.hud.showMessage('No other seeds in hotbar!', 1000);
  }

  _doTill(x, y, tile) {
    const result = this.gridManager.tillTile(x, y);
    if (result) {
      this._updateTileSprite(x, y);
      this.hud.showMessage('Tilled the soil!', 1000);
      this._emitDirtParticles(x, y);
    } else {
      this.hud.showMessage('Cannot till here.', 1000);
    }
  }

  _doWater(x, y, tile) {
    const result = this.gridManager.waterTile(x, y);
    if (result) {
      this._updateTileSprite(x, y);
      this.hud.showMessage('Watered!', 1000);
      this._emitWaterParticles(x, y);
    } else {
      this.hud.showMessage('Cannot water here.', 1000);
    }
  }

  _doPlant(x, y, tile) {
    const activeSlotIdx = this.hotbar.activeSlot;
    const seed = this.hotbar.getActivePlantType();
    if (!seed) {
      this.hud.showMessage('No seed selected in hotbar.', 1500);
      return;
    }

    // Check quantity in the active hotbar slot instead of player inventory
    const slotQty = this.hotbar.slotQuantities[activeSlotIdx];
    if (slotQty <= 0) {
      this.hud.showMessage(`No seeds in active hotbar slot!`, 1500);
      return;
    }

    const result = this.gridManager.plantSeed(x, y, seed);
    if (result) {
      // Decrement quantity from hotbar slot directly
      this.hotbar.useItem(activeSlotIdx, 1);
      this._updateTileSprite(x, y);
      this._updatePlantSprite(x, y);
      this.hud.showMessage(`Planted ${PLANT_TYPES[seed]?.name || seed}!`, 1000);
    } else {
      this.hud.showMessage('Cannot plant here. Need tilled & watered soil.', 1500);
    }
  }

  _doHarvest(x, y, tile) {
    if (!tile.hasPlant) {
      this.hud.showMessage('No plant here.', 1000);
      return;
    }

    const plantInfo = PLANT_TYPES[tile.plantType];

    if (plantInfo.type === 'fruit') {
      if (this.gridManager.canHarvest(x, y)) {
        this.gridManager.harvestFruit(x, y);
        const yield_ = Phaser.Math.Between(plantInfo.harvestYield.min, plantInfo.harvestYield.max);
        this.inventorySystem.addItem(tile.plantType, yield_);
        this._updatePlantSprite(x, y);
        this.hud.showMessage(`Harvested ${yield_} ${plantInfo.name}!`, 1500);
        this._emitHarvestParticles(x, y);
        if (this.profileSystem) this.profileSystem.addXp(10);
        this.events.emit('xp-gain', { x, y, amount: 10 });
      } else {
        this.hud.showMessage('Fruit not ready yet!', 1000);
      }
    } else {
      const plantType = tile.plantType;
      if (this.gridManager.canCrop(x, y)) {
        this.gridManager.cropPlant(x, y);
        const yield_ = Phaser.Math.Between(plantInfo.harvestYield.min, plantInfo.harvestYield.max);
        this.inventorySystem.addItem(plantType, yield_);
        this._updateTileSprite(x, y);
        this._updatePlantSprite(x, y);
        this.hud.showMessage(`Cropped ${yield_} ${plantInfo.name}!`, 1500);
        this._emitHarvestParticles(x, y);
        if (this.profileSystem) this.profileSystem.addXp(10);
        this.events.emit('xp-gain', { x, y, amount: 10 });
      } else if (tile.hasPlant) {
        this.gridManager.cropPlant(x, y);
        this._updateTileSprite(x, y);
        this._updatePlantSprite(x, y);
        this.hud.showMessage('⚠️ Premature harvest! Growth reset.', 2000);
      }
    }
  }

  _doSmartAction(x, y, tile) {
    if (tile.hasPlant) {
      this._doHarvest(x, y, tile);
    } else if (tile.isTilled && tile.isWatered) {
      if (this.hotbar.getActivePlantType()) {
        this.selectedSeed = this.hotbar.getActivePlantType();
        this._doPlant(x, y, tile);
      } else {
        this.hud.showMessage('Select a seed in your hotbar to plant.', 1500);
      }
    } else if (tile.isTilled) {
      this._doWater(x, y, tile);
    } else {
      this._doTill(x, y, tile);
    }
  }

  // ══════════════════════════════════════
  //  CURSOR & HELPERS
  // ══════════════════════════════════════

  _updateCursor() {
    if (this.player) {
      // Get target tile under mouse pointer
      const pointer = this.input.activePointer;
      const tileX = Math.floor(pointer.worldX / TILE_SIZE);
      const tileY = Math.floor(pointer.worldY / TILE_SIZE);

      // Bind cursor inside grid boundaries
      this.cursorTileX = Phaser.Math.Clamp(tileX, 0, GRID_COLS - 1);
      this.cursorTileY = Phaser.Math.Clamp(tileY, 0, GRID_ROWS - 1);

      // Update selector graphic coordinates
      this.selectionCursor.setPosition(
        this.cursorTileX * TILE_SIZE + TILE_SIZE / 2,
        this.cursorTileY * TILE_SIZE + TILE_SIZE / 2
      );

      // Check Chebyshev distance from player
      const dx = this.cursorTileX - this.player.tileX;
      const dy = this.cursorTileY - this.player.tileY;
      const inRange = (Math.max(Math.abs(dx), Math.abs(dy)) <= 2);

      if (inRange) {
        // Cyan/green visual hint when within 2-tile radius interaction range
        this.selectionCursor.setTint(0x00ffcc);
      } else {
        // Red visual hint when out of range
        this.selectionCursor.setTint(0xff3333);
      }

      // Hover glow highlight for buildings, gates, machines, fences, ores
      if (this.lastHoveredTileSprite) {
        this.lastHoveredTileSprite.clearTint();
        this.lastHoveredTileSprite = null;
      }

      if (this.marketSprite) {
        this.marketSprite.clearTint();
      }

      const tile = this.gridManager.getTile(this.cursorTileX, this.cursorTileY);
      const isMarket = this._isTileInMarketZone(this.cursorTileX, this.cursorTileY);

      if (isMarket && this.marketSprite) {
        this.marketSprite.setTint(0xffe082); // soft gold glow for shop
      } else if (tile) {
        const sprite = this.tileSprites[this.cursorTileY]?.[this.cursorTileX];
        const isFence = (this.cursorTileX === 0 || this.cursorTileX === GRID_COLS - 1 || 
                         this.cursorTileY === 0 || this.cursorTileY === GRID_ROWS - 1 ||
                         (this.cursorTileX === 19 && this.cursorTileY >= 0 && this.cursorTileY <= 19 && this.cursorTileY !== 10) ||
                         (this.cursorTileY === 19 && this.cursorTileX >= 0 && this.cursorTileX <= 39 && this.cursorTileX !== 10) ||
                         (this.cursorTileX === 39 && this.cursorTileY >= 0 && this.cursorTileY <= 39 && this.cursorTileY !== 20));

        if (sprite && (tile.isMachine || tile.isOre || tile.isGate || isFence)) {
          sprite.setTint(0x80deea); // Cyan glow for interactable structures and fences
          this.lastHoveredTileSprite = sprite;
        }
      }
    }
  }

  _isNearMarket() {
    if (!this.player) return false;
    const px = this.player.tileX;
    const py = this.player.tileY;
    const mz = this.marketZone;
    return (
      px >= mz.x - 1 && px <= mz.x + mz.w &&
      py >= mz.y - 1 && py <= mz.y + mz.h
    );
  }

  _isTileInMarketZone(x, y) {
    const mz = this.marketZone;
    return x >= mz.x && x < mz.x + mz.w && y >= mz.y && y < mz.y + mz.h;
  }

  // ══════════════════════════════════════
  //  PARTICLE EFFECTS
  // ══════════════════════════════════════

  _emitGrowthParticles(x, y) {
    const px = x * TILE_SIZE + TILE_SIZE / 2;
    const py = y * TILE_SIZE + TILE_SIZE / 2;
    for (let i = 0; i < 5; i++) {
      const p = this.add.image(px + Phaser.Math.Between(-8, 8), py + Phaser.Math.Between(-8, 8), 'particle');
      p.setTint(0x76ff03).setDepth(25).setScale(0.5);
      this.tweens.add({ targets: p, y: p.y - 20, alpha: 0, scale: 0, duration: 600, ease: 'Power2', onComplete: () => p.destroy() });
    }
  }

  _emitFruitParticles(x, y) {
    const px = x * TILE_SIZE + TILE_SIZE / 2;
    const py = y * TILE_SIZE + TILE_SIZE / 2;
    for (let i = 0; i < 8; i++) {
      const p = this.add.image(px + Phaser.Math.Between(-10, 10), py + Phaser.Math.Between(-10, 10), 'particle');
      p.setTint(0xffd700).setDepth(25);
      this.tweens.add({ targets: p, y: p.y - 25, alpha: 0, duration: 800, ease: 'Power2', delay: i * 50, onComplete: () => p.destroy() });
    }
  }

  _emitHarvestParticles(x, y) {
    const px = x * TILE_SIZE + TILE_SIZE / 2;
    const py = y * TILE_SIZE + TILE_SIZE / 2;
    for (let i = 0; i < 12; i++) {
      const p = this.add.image(px + Phaser.Math.Between(-6, 6), py + Phaser.Math.Between(-6, 6), 'particle');
      p.setTint(Phaser.Math.RND.pick([0xffd700, 0xff9800, 0x76ff03])).setDepth(25);
      const angle = (i / 12) * Math.PI * 2;
      const dist = Phaser.Math.Between(15, 30);
      this.tweens.add({ targets: p, x: px + Math.cos(angle) * dist, y: py + Math.sin(angle) * dist - 10, alpha: 0, scale: 0, duration: 500, ease: 'Power2', delay: i * 30, onComplete: () => p.destroy() });
    }
  }

  _emitWaterParticles(x, y) {
    const px = x * TILE_SIZE + TILE_SIZE / 2;
    const py = y * TILE_SIZE + TILE_SIZE / 2;
    for (let i = 0; i < 6; i++) {
      const texKey = this.textures.exists('particle_water') ? 'particle_water' : 'particle';
      const p = this.add.image(px + Phaser.Math.Between(-10, 10), py - 10, texKey);
      p.setTint(0x4fc3f7).setDepth(25);
      this.tweens.add({ targets: p, y: py + Phaser.Math.Between(0, 10), alpha: 0, duration: 400, ease: 'Power1', delay: i * 60, onComplete: () => p.destroy() });
    }
  }

  _emitDirtParticles(x, y) {
    const px = x * TILE_SIZE + TILE_SIZE / 2;
    const py = y * TILE_SIZE + TILE_SIZE / 2;
    for (let i = 0; i < 6; i++) {
      const p = this.add.image(px + Phaser.Math.Between(-6, 6), py + Phaser.Math.Between(-2, 4), 'particle');
      p.setTint(0x8B6914).setDepth(25);
      this.tweens.add({ targets: p, y: p.y - Phaser.Math.Between(8, 20), x: p.x + Phaser.Math.Between(-10, 10), alpha: 0, duration: 400, ease: 'Power2', delay: i * 40, onComplete: () => p.destroy() });
    }
  }

  _showFloatingText(tx, ty, text, color) {
    const px = tx * TILE_SIZE + TILE_SIZE / 2;
    const py = ty * TILE_SIZE + TILE_SIZE / 2;
    const txt = this.add.text(px, py - 10, text, {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '22px',
      color: '#' + color.toString(16).padStart(6, '0'),
      fontWeight: 'bold',
      resolution: 3,
    }).setOrigin(0.5).setDepth(30).setScale(0.5);
    this.tweens.add({ targets: txt, y: py - 30, alpha: 0, duration: 1000, onComplete: () => txt.destroy() });
  }

  _updateCameraBounds() {
    let maxCols = 20;
    let maxRows = 20;
    if (this.unlockedZones && this.unlockedZones.zone2) maxCols = 40;
    if (this.unlockedZones && this.unlockedZones.zone3) maxRows = 40;
    if (this.unlockedZones && this.unlockedZones.zone4) {
      maxCols = 60;
      maxRows = 40;
    }
    if (this.cameras && this.cameras.main) {
      this.cameras.main.setBounds(0, 0, maxCols * TILE_SIZE, maxRows * TILE_SIZE);
    }
  }

  _spawnSpecialBuyerNPC() {
    this._destroySpecialBuyerNPC();
    this.buyerNPCSprite = this.add.sprite(17 * TILE_SIZE + TILE_SIZE / 2, 3 * TILE_SIZE + TILE_SIZE / 2, 'buyer_npc');
    this.buyerNPCSprite.setDepth(10);
    this.buyerNPCSprite.setFrame(0);
  }

  _destroySpecialBuyerNPC() {
    if (this.buyerNPCSprite) {
      this.buyerNPCSprite.destroy();
      this.buyerNPCSprite = null;
    }
  }

  _interactWithGate(x, y, tile) {
    const gateInfo = Object.values(GATES).find(g => g.x === x && g.y === y);
    if (!gateInfo) return;

    const keyItemId = `key_${gateInfo.key}`;
    const hasKey = this.inventorySystem.hasItem(keyItemId, 1);

    if (!hasKey) {
      const keyNames = {
        zone2: 'Artisan Key',
        zone3: 'Mining Key',
        zone4: 'Lab Key'
      };
      const keyName = keyNames[gateInfo.key] || 'Zone Key';
      this.hud.showMessage(`🔒 Locked! You need the ${keyName} to unlock this gate.\nBuy it at the shop for ${gateInfo.cost}g (Requires Level ${gateInfo.level}).`, 5000);
      return;
    }

    const keyNames = {
      zone2: 'Artisan Key',
      zone3: 'Mining Key',
      zone4: 'Lab Key'
    };
    const keyName = keyNames[gateInfo.key] || 'Zone Key';

    const confirm = window.confirm(`Clear barrier to unlock ${gateInfo.key.toUpperCase()}?\nThis will consume your ${keyName}.`);
    if (confirm) {
      this.inventorySystem.removeItem(keyItemId, 1);

      tile.isLocked = false;
      this.unlockedZones[gateInfo.key] = true;
      this._updateTileSprite(x, y);
      this._updateCameraBounds();

      this.hud.showMessage(`🎉 Unlocked ${gateInfo.key.toUpperCase()}! Map expanded!`, 4000);
      this._emitFruitParticles(x, y);
    }
  }

  _getPlayerZone() {
    const px = this.player ? this.player.tileX : 5;
    const py = this.player ? this.player.tileY : 5;
    if (px <= 19 && py <= 19) return 'zone1';
    if (px >= 20 && px <= 39 && py <= 19) return 'zone2';
    if (px <= 39 && py >= 20) return 'zone3';
    return 'zone4';
  }

  _showZoneBanner(zoneKey) {
    const zoneNames = {
      zone1: 'Zone 1: Starter Farm',
      zone2: 'Zone 2: Artisan Refineries',
      zone3: 'Zone 3: Mining Cave',
      zone4: 'Zone 4: Advanced Tech Lab'
    };
    const displayName = zoneNames[zoneKey] || 'Unknown Area';

    // Destroy previous banner if animating
    if (this.zoneBannerContainer) {
      this.zoneBannerContainer.destroy();
    }

    // Create container fixed to camera
    const container = this.add.container(GAME_WIDTH / 2, -50);
    container.setScrollFactor(0).setDepth(150);

    // Banner background panel
    const width = displayName.length * 9 + 40;
    const bg = this.add.rectangle(0, 0, width, 30, 0x1a1a2e, 0.95);
    bg.setStrokeStyle(1.5, 0x00ffff, 0.9);

    // Banner text
    const text = this.add.text(0, 0, displayName, {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '12px',
      color: '#00ffff',
      fontWeight: 'bold',
      resolution: 4,
    }).setOrigin(0.5);

    container.add([bg, text]);
    this.zoneBannerContainer = container;

    // Tweens for premium slide-in/slide-out animation
    this.tweens.add({
      targets: container,
      y: 50,
      duration: 600,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(2000, () => {
          if (!container || !container.scene) return;
          this.tweens.add({
            targets: container,
            y: -50,
            duration: 500,
            ease: 'Power2.easeIn',
            onComplete: () => {
              if (container) container.destroy();
              if (this.zoneBannerContainer === container) {
                this.zoneBannerContainer = null;
              }
            }
          });
        });
      }
    });
  }

  _updateInteractionPrompts() {
    if (!this.player) return;

    // 1. Check near buyer NPC
    const dxBuyer = Math.abs(this.player.tileX - 17);
    const dyBuyer = Math.abs(this.player.tileY - 3);
    const nearBuyer = (dxBuyer <= 1 && dyBuyer <= 1) && this.buyerNPCSprite;

    if (nearBuyer) {
      this._showPromptAt(17 * TILE_SIZE + TILE_SIZE / 2, 3 * TILE_SIZE - 12, '[E] Talk to Buyer');
      return;
    }

    // 2. Check near warehouse
    if (this.warehouse && this.warehouse.isAdjacentTo(this.player.tileX, this.player.tileY)) {
      this._showPromptAt((this.warehouse.tileX + this.warehouse.tileW / 2) * TILE_SIZE, this.warehouse.tileY * TILE_SIZE - 12, '[E] Manage Warehouse');
      return;
    }

    // 3. Check facing a locked gate
    const facing = this.player.getFacingTile();
    const tile = this.gridManager.getTile(facing.x, facing.y);
    if (tile && tile.isGate && tile.isLocked) {
      this._showPromptAt(facing.x * TILE_SIZE + TILE_SIZE / 2, facing.y * TILE_SIZE - 12, '[E] Unlock Gate');
      return;
    }

    // 4. Check facing a machine
    if (tile && tile.isMachine && tile.machineId) {
      this._showPromptAt(facing.x * TILE_SIZE + TILE_SIZE / 2, facing.y * TILE_SIZE - 12, '[E] Inspect Machine');
      return;
    }

    // None of the above - hide prompt
    if (this.promptText) {
      this.promptText.setVisible(false);
    }
  }

  _showPromptAt(x, y, text) {
    if (!this.promptText) {
      this.promptText = this.add.text(x, y, text, {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: '#1a1a2e',
        padding: { x: 6, y: 3 },
        stroke: '#00ffff',
        strokeThickness: 1,
        resolution: 4,
      }).setOrigin(0.5).setDepth(40);
    } else {
      this.promptText.setText(text);
      this.promptText.setPosition(x, y);
      this.promptText.setVisible(true);
    }
  }

  // ── Smart Idle welcome back sequence ──
  checkOfflineProgress() {
    const raw = localStorage.getItem('LOGISTICS_IDLE_DATA');
    if (!raw) return;
    localStorage.removeItem('LOGISTICS_IDLE_DATA');

    try {
      const data = JSON.parse(raw);
      const offlineMs = Date.now() - data.lastActiveTimestamp;
      if (offlineMs < 15000) return; // wait at least 15s to trigger

      const minutes = offlineMs / 60000;
      const earnings = {};
      let hasEarnings = false;

      if (data.activeRates) {
        for (const [itemId, rate] of Object.entries(data.activeRates)) {
          const qty = Math.floor(rate * minutes);
          if (qty > 0) {
            earnings[itemId] = qty;
            hasEarnings = true;
          }
        }
      }

      const isEfficient = hasEarnings && !data.hasCrash;
      this.triggerWelcomeBack(isEfficient, earnings, data.crashedDrone || 'drone');
    } catch (e) {
      console.error('Error in checkOfflineProgress:', e);
    }
  }

  triggerWelcomeBack(isEfficient, earnings, crashedDroneName) {
    // Spawn Eli NPC near player
    const spawnX = this.player.x + 128;
    const spawnY = this.player.y;
    
    this.eliNPC = this.add.sprite(spawnX, spawnY, 'eli_npc');
    this.eliNPC.setDepth(10);

    // Walks automatically towards the player
    this.tweens.add({
      targets: this.eliNPC,
      x: this.player.x + 32,
      y: this.player.y,
      duration: 1500,
      ease: 'Power1',
      onComplete: () => {
        this._showInWorldSpeechBubble(this.eliNPC, "Cek hape kamu.");
        
        // Open the phone drawer (HTML Overlay)
        if (this.editorBridge) {
          this.editorBridge.openInGameSmartphoneUI(isEfficient, earnings, crashedDroneName, this.eliNPC);
        }
      }
    });
  }

  _showInWorldSpeechBubble(parent, text) {
    if (this.speechBubbleContainer) {
      this.speechBubbleContainer.destroy();
    }
    const container = this.add.container(parent.x, parent.y - 24);
    container.setDepth(45);

    const txt = this.add.text(0, -6, text, {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '8px',
      color: '#ffffff',
      backgroundColor: '#16213e',
      padding: { x: 5, y: 3 },
      resolution: 4
    }).setOrigin(0.5);
    txt.setStroke('#ff0055', 1);

    container.add(txt);
    this.speechBubbleContainer = container;

    this.tweens.add({
      targets: container,
      y: parent.y - 28,
      duration: 500,
      yoyo: true,
      repeat: -1
    });
  }

  claimOfflineResources(earnings) {
    let addedToWarehouseCount = 0;
    let addedToBackpackCount = 0;

    for (const [itemId, qty] of Object.entries(earnings)) {
      if (this.warehouse) {
        this.warehouse.deposit(itemId, qty);
        addedToWarehouseCount += qty;
      } else {
        this.inventorySystem.addItem(itemId, qty);
        addedToBackpackCount += qty;
      }
    }

    if (addedToWarehouseCount > 0) {
      this.hud.showMessage(`📦 Deposited +${addedToWarehouseCount} items into the Warehouse!`, 4000);
    } else if (addedToBackpackCount > 0) {
      this.hud.showMessage(`🎒 Added +${addedToBackpackCount} items to Backpack!`, 4000);
    }

    // Refresh inventory and devices tabs
    if (this.editorBridge) {
      this.editorBridge._renderBackpack();
      this.editorBridge._renderDevicesTab();
    }
  }
}
