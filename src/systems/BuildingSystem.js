import Phaser from 'phaser';
import Warehouse from '../entities/Warehouse.js';
import { TILE_SIZE } from '../config/constants.js';
import { BUILDING_DEFINITIONS, BUILDING_KITS, buildingTypeFromKit } from '../data/buildings.js';

/**
 * Owns player-built world objects. It intentionally delegates recipes and
 * conveyor simulation to the existing MachineSystem and GridManager.
 */
export default class BuildingSystem {
  constructor(scene) {
    this.scene = scene;
    this.buildings = new Map();
    this.depots = new Map();
    this.serial = 0;
    this.activeKitId = null;
    this.direction = 'right';
    this.preview = null;
    this.events = new Phaser.Events.EventEmitter();
    this._bindToolbar();
  }

  _bindToolbar() {
    this.toolbar = document.getElementById('build-toolbar');
    document.getElementById('btn-build-mode')?.addEventListener('click', () => this.toggle());
    this.toolbar?.addEventListener('click', event => {
      const button = event.target.closest('[data-build-kit]');
      if (!button || button.disabled) return;
      this.setActiveKit(button.dataset.buildKit);
    });
    this.scene.events.once('shutdown', () => this.destroy());
  }

  get isActive() { return Boolean(this.activeKitId); }

  toggle() {
    if (this.isActive) this.cancel();
    else {
      const first = BUILDING_KITS.find(({ kitId }) => this.scene.inventorySystem.hasItem(kitId, 1));
      if (!first) {
        this.scene.hud.showMessage('Belum ada building kit. Buat conveyor atau depot di Crafting Table.', 3600);
        return;
      }
      this.setActiveKit(first.kitId);
    }
  }

  setActiveKit(kitId) {
    const type = buildingTypeFromKit(kitId);
    if (!type || !this.scene.inventorySystem.hasItem(kitId, 1)) return;
    this.activeKitId = kitId;
    this.direction = this.direction || 'right';
    this._ensurePreview();
    this._renderToolbar();
    this.scene.hud.showMessage(`${BUILDING_DEFINITIONS[type].label} siap dipasang. Klik petak hijau · R putar · Esc batal.`, 3200);
  }

  cancel() {
    this.activeKitId = null;
    this.preview?.destroy();
    this.preview = null;
    this._renderToolbar();
  }

  rotate() {
    if (!this.isActive) return;
    const dirs = ['up', 'right', 'down', 'left'];
    this.direction = dirs[(dirs.indexOf(this.direction) + 1) % dirs.length];
    this._updatePreview(this.scene.input.activePointer);
  }

  _ensurePreview() {
    if (this.preview) return;
    this.preview = this.scene.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE, 0x63d8d1, 0.28)
      .setStrokeStyle(2, 0x63d8d1, 1).setDepth(28).setVisible(false);
  }

  updatePreview(pointer) {
    if (!this.isActive || !pointer) return;
    this._updatePreview(pointer);
  }

  _updatePreview(pointer) {
    const type = buildingTypeFromKit(this.activeKitId);
    const definition = BUILDING_DEFINITIONS[type];
    if (!definition || !this.preview) return;
    const point = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const x = Math.floor(point.x / TILE_SIZE);
    const y = Math.floor(point.y / TILE_SIZE);
    const valid = this.canPlace(type, x, y);
    this.preview.setPosition(
      x * TILE_SIZE + definition.width * TILE_SIZE / 2,
      y * TILE_SIZE + definition.height * TILE_SIZE / 2,
    ).setSize(definition.width * TILE_SIZE, definition.height * TILE_SIZE)
      .setStrokeStyle(2, valid ? 0x63d8d1 : 0xd95f54, 1)
      .setFillStyle(valid ? 0x63d8d1 : 0xd95f54, 0.28)
      .setVisible(true);
    this.preview.setData('x', x);
    this.preview.setData('y', y);
    this.preview.setData('valid', valid);
  }

  tryPlaceAtPointer(pointer) {
    if (!this.isActive) return false;
    this._updatePreview(pointer);
    const { x, y, valid } = this.preview.getData();
    if (!valid) {
      this.scene.hud.showMessage('Bangunan tidak dapat dipasang di petak itu.', 1800);
      return false;
    }
    const placed = this.placeFromKit(this.activeKitId, x, y, this.direction);
    if (placed && !this.scene.inventorySystem.hasItem(this.activeKitId, 1)) this.cancel();
    else this._renderToolbar();
    return placed;
  }

  canPlace(type, x, y) {
    const definition = BUILDING_DEFINITIONS[type];
    if (!definition) return false;
    for (let dy = 0; dy < definition.height; dy += 1) {
      for (let dx = 0; dx < definition.width; dx += 1) {
        if (!this.scene.gridManager.isBuildable(x + dx, y + dy)) return false;
      }
    }
    return true;
  }

  placeFromKit(kitId, x, y, direction = 'right', { consume = true, id = null, persist = true } = {}) {
    const type = buildingTypeFromKit(kitId);
    const definition = BUILDING_DEFINITIONS[type];
    if (!definition || !this.canPlace(type, x, y)) return false;
    if (consume && !this.scene.inventorySystem.removeItem(kitId, 1)) return false;

    const buildingId = id || `${type}_${++this.serial}`;
    const building = { id: buildingId, type, x, y, direction };
    this.buildings.set(buildingId, building);

    if (definition.conveyor) {
      this.scene.gridManager.setConveyor(x, y, direction);
      this.scene.updateTileSprite(x, y);
    } else if (definition.machineType) {
      this.scene.machineSystem.registerMachine(buildingId, definition.machineType, x, y);
      this.scene.gridManager.setMachine(x, y, buildingId, definition.machineType);
      this.scene.updateTileSprite(x, y);
    } else if (definition.storage) {
      for (let dy = 0; dy < definition.height; dy += 1) {
        for (let dx = 0; dx < definition.width; dx += 1) this.scene.gridManager.setBuilding(x + dx, y + dy, buildingId, type);
      }
      const depot = new Warehouse(this.scene, x, y, definition.width, definition.height, this.scene.warehouse.storage, 'DEPOT');
      this.depots.set(buildingId, depot);
    }
    this.events.emit('changed', building);
    if (persist) this.scene.saveSystem?.saveLocal();
    return true;
  }

  getWarehouseAdjacentTo(x, y) {
    for (const depot of this.depots.values()) if (depot.isAdjacentTo(x, y)) return depot;
    return null;
  }

  getStorageAt(x, y) {
    if (this.scene.warehouse?.containsTile(x, y)) return this.scene.warehouse;
    for (const depot of this.depots.values()) if (depot.containsTile(x, y)) return depot;
    return null;
  }

  getSaveState() {
    return [...this.buildings.values()].map(building => {
      const tile = this.scene.gridManager.getTile(building.x, building.y);
      return { ...building, conveyorItem: tile?.isConveyor ? tile.conveyorItem : undefined };
    });
  }

  loadSaveState(state) {
    if (!Array.isArray(state)) return;
    for (const building of state) {
      const definition = BUILDING_DEFINITIONS[building.type];
      if (!definition || !Number.isInteger(building.x) || !Number.isInteger(building.y)) continue;
      this.serial = Math.max(this.serial, Number((building.id || '').split('_').at(-1)) || 0);
      const success = this.placeFromKit(definition.kitId, building.x, building.y, building.direction, { consume: false, id: building.id, persist: false });
      if (success && definition.conveyor && typeof building.conveyorItem === 'string') {
        const tile = this.scene.gridManager.getTile(building.x, building.y);
        tile.conveyorItem = building.conveyorItem;
      }
    }
  }

  /** Remove restored visuals and in-memory references before another restore. */
  reset() {
    this.cancel();
    for (const depot of this.depots.values()) depot.destroy();
    this.depots.clear();
    this.buildings.clear();
    this.serial = 0;
  }

  _renderToolbar() {
    if (!this.toolbar) return;
    this.toolbar.hidden = !this.isActive;
    document.getElementById('btn-build-mode')?.setAttribute('aria-pressed', String(this.isActive));
    if (!this.isActive) return;
    this.toolbar.innerHTML = BUILDING_KITS.map(({ kitId, label }) => {
      const count = this.scene.inventorySystem.getItemCount(kitId);
      return `<button data-build-kit="${kitId}" ${count ? '' : 'disabled'} class="${kitId === this.activeKitId ? 'active' : ''}">${label} ×${count}</button>`;
    }).join('') + '<span class="build-hint">R putar · Esc batal</span>';
  }

  destroy() {
    this.reset();
    this.preview?.destroy();
  }
}
