import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants.js';

const MAX_FAUNA = 6;
const ZONE5 = { x1: 1, x2: 38, y1: 41, y2: 58 };

/** A small, passive ecosystem for the southern explore zone. */
export default class WildlifeSystem {
  constructor(scene) {
    this.scene = scene;
    this.fauna = new Map();
    this.drops = new Map();
    this.serial = 0;
    this.spawnElapsed = 0;
    this.events = new Phaser.Events.EventEmitter();
    scene.events.once('shutdown', () => this.destroy());
  }

  update(delta) {
    if (!this.scene.unlockedZones?.zone5) return;
    this.spawnElapsed += delta;
    if (this.spawnElapsed >= 3500 && this.fauna.size < MAX_FAUNA) {
      this.spawnElapsed = 0;
      this.spawn();
    }
    for (const animal of this.fauna.values()) {
      animal.dropCooldown -= delta;
      animal.moveCooldown -= delta;
      if (animal.moveCooldown <= 0) this._wander(animal);
      if (animal.dropCooldown <= 0) {
        animal.dropCooldown = 9000 + Math.floor(Math.random() * 5000);
        this._dropFiber(Math.round(animal.tileX), Math.round(animal.tileY));
      }
    }
  }

  spawn(state = null) {
    const type = state?.type || (this.serial % 2 ? 'hare' : 'deer');
    const x = state?.x ?? Phaser.Math.Between(ZONE5.x1, ZONE5.x2);
    const y = state?.y ?? Phaser.Math.Between(ZONE5.y1, ZONE5.y2);
    if (!this.scene.gridManager.isWalkable(x, y)) return null;
    const id = state?.id || `fauna_${++this.serial}`;
    const sprite = this.scene.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, `wildlife_${type}`).setDepth(8);
    const animal = { id, type, tileX: x, tileY: y, sprite, moveCooldown: state?.moveCooldown ?? 900, dropCooldown: state?.dropCooldown ?? 7000 };
    this.fauna.set(id, animal);
    return animal;
  }

  _wander(animal) {
    animal.moveCooldown = 900 + Math.floor(Math.random() * 1600);
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const [dx, dy] = Phaser.Utils.Array.GetRandom(dirs);
    const x = animal.tileX + dx, y = animal.tileY + dy;
    if (x < ZONE5.x1 || x > ZONE5.x2 || y < ZONE5.y1 || y > ZONE5.y2 || !this.scene.gridManager.isWalkable(x, y)) return;
    animal.tileX = x; animal.tileY = y;
    this.scene.tweens.add({ targets: animal.sprite, x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2, duration: 340, ease: 'Linear' });
  }

  _dropFiber(x, y) {
    const key = `${x},${y}`;
    if (this.drops.has(key) || !this.scene.gridManager.isWalkable(x, y)) return;
    const sprite = this.scene.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, 'icon_wild_fiber').setDepth(9);
    this.drops.set(key, { x, y, id: 'wild_fiber', count: 1, sprite });
    this.events.emit('drop-changed');
  }

  getDropAt(x, y) { return this.drops.get(`${x},${y}`) || null; }

  collectAt(x, y, inventory) {
    const key = `${x},${y}`;
    const drop = this.drops.get(key);
    if (!drop) return false;
    const capacity = Number(inventory.capacity);
    if (Number.isFinite(capacity) && typeof inventory.getTotalCount === 'function' && inventory.getTotalCount() + drop.count > capacity) return false;
    inventory.addItem(drop.id, drop.count);
    drop.sprite.destroy();
    this.drops.delete(key);
    this.events.emit('drop-changed');
    return true;
  }

  getSaveState() {
    return {
      fauna: [...this.fauna.values()].map(({ id, type, tileX, tileY, moveCooldown, dropCooldown }) => ({ id, type, x: tileX, y: tileY, moveCooldown, dropCooldown })),
      drops: [...this.drops.values()].map(({ x, y, id, count }) => ({ x, y, id, count })),
      spawnElapsed: this.spawnElapsed,
    };
  }

  loadSaveState(state) {
    if (!state || typeof state !== 'object') return;
    this.spawnElapsed = Number(state.spawnElapsed) || 0;
    (state.fauna || []).slice(0, MAX_FAUNA).forEach(animal => this.spawn(animal));
    (state.drops || []).forEach(drop => {
      if (!this.scene.gridManager.inBounds(drop.x, drop.y)) return;
      this._dropFiber(drop.x, drop.y);
    });
  }

  destroy() {
    for (const animal of this.fauna.values()) animal.sprite.destroy();
    for (const drop of this.drops.values()) drop.sprite.destroy();
    this.fauna.clear(); this.drops.clear();
  }
}
