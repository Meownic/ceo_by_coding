import { pixelIcon } from '../rendering/PixelAssets.js';
import { isWarehouseStorable } from '../data/buildings.js';

const SORTS = {
  category: (a, b) => a.id.localeCompare(b.id),
  name: (a, b) => a.id.localeCompare(b.id),
  quantity: (a, b) => b.count - a.count || a.id.localeCompare(b.id),
};

const title = id => id.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());

/**
 * Side-dock storage interaction. This deliberately uses Pointer Events rather
 * than native HTML drag/drop so the carried icon tracks mouse, touch and pen.
 */
export default class StorageUI {
  constructor(scene) {
    this.scene = scene;
    this.root = document.getElementById('storage-panel');
    this.editorPanel = document.getElementById('editor-panel');
    this.resizeHandle = document.getElementById('editor-resize-handle');
    this.sort = { backpack: 'category', warehouse: 'category' };
    this.selected = null;
    this.drag = null;
    this._onInventory = () => this.render();
    scene.inventorySystem.events.on('inventory-changed', this._onInventory);
    scene.warehouse.events.on('changed', this._onInventory);
    this._bind();
    scene.events.once('shutdown', () => this.destroy());
  }

  _bind() {
    this.root?.addEventListener('click', event => {
      const close = event.target.closest('[data-storage-close]');
      if (close) return this.close();
      const sort = event.target.closest('[data-storage-sort]');
      if (sort) {
        const target = sort.dataset.storageSort;
        const entries = Object.keys(SORTS);
        this.sort[target] = entries[(entries.indexOf(this.sort[target]) + 1) % entries.length];
        this.render();
        return;
      }
      const move = event.target.closest('[data-storage-move]');
      if (move) this.moveSelected(move.dataset.storageMove);
      const split = event.target.closest('[data-storage-split]');
      if (split) this.splitSelected();
    });
    this.root?.addEventListener('pointerdown', event => {
      const slot = event.target.closest('[data-storage-source]');
      if (slot) this._startPointer(event, slot);
    });
    this.root?.addEventListener('keydown', event => {
      const slot = event.target.closest('[data-storage-source]');
      if (!slot) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.selected = { source: slot.dataset.storageSource, id: slot.dataset.itemId, count: Number(slot.dataset.itemCount) };
        this.render();
      }
    });
  }

  open() {
    if (!this.root) return;
    this.closeModalIfNeeded();
    this.root.hidden = false;
    this.editorPanel.hidden = true;
    this.resizeHandle.hidden = true;
    document.body.classList.add('storage-open');
    this.render();
    requestAnimationFrame(() => this.root.querySelector('[data-storage-close]')?.focus({ preventScroll: true }));
  }

  closeModalIfNeeded() {
    if (this.scene.panelManager.current) this.scene.panelManager.close(false);
  }

  close() {
    this.cancelDrag();
    if (!this.root) return;
    this.root.hidden = true;
    this.editorPanel.hidden = false;
    this.resizeHandle.hidden = false;
    document.body.classList.remove('storage-open');
    this.scene.editorBridge?.editor?.layout();
    document.getElementById('btn-toggle-editor')?.focus({ preventScroll: true });
  }

  isOpen() { return Boolean(this.root && !this.root.hidden); }
  toggle() { this.isOpen() ? this.close() : this.open(); }

  _items(source) {
    const raw = source === 'warehouse' ? this.scene.warehouse.getAll() : this.scene.inventorySystem.getAllItems();
    return raw.filter(item => item.count > 0).sort(SORTS[this.sort[source]]);
  }

  render() {
    if (!this.isOpen()) return;
    const containers = this.root.querySelectorAll('[data-storage-container]');
    containers.forEach(container => {
      const source = container.dataset.storageContainer;
      const grid = container.querySelector('.storage-grid');
      const items = this._items(source);
      const sortButton = container.querySelector('[data-storage-sort]');
      if (sortButton) sortButton.textContent = `Sort: ${this.sort[source] === 'quantity' ? 'Jumlah' : this.sort[source] === 'name' ? 'A–Z' : 'Kategori'}`;
      grid.innerHTML = items.map(({ id, count }) => {
        const selected = this.selected?.source === source && this.selected?.id === id;
        const allowed = source !== 'backpack' || isWarehouseStorable(id);
        return `<button class="storage-slot ${selected ? 'selected' : ''}" data-storage-source="${source}" data-item-id="${id}" data-item-count="${count}" aria-label="${title(id)}, ${count}" title="${title(id)} ×${count}${allowed ? '' : ' — tidak dapat disimpan'}">${pixelIcon(id, 'inventory-slot-emoji')}<span>${count}</span></button>`;
      }).join('') || '<p class="storage-empty">Kosong</p>';
    });
    const info = this.root.querySelector('[data-storage-selection]');
    if (info) info.textContent = this.selected ? `${title(this.selected.id)} ×${this.selected.count} dipilih` : 'Tarik stack untuk memindahkan. Shift + tarik memindahkan 1.';
  }

  _startPointer(event, slot) {
    if (event.button !== undefined && event.button !== 0) return;
    const source = slot.dataset.storageSource;
    const id = slot.dataset.itemId;
    const count = Number(slot.dataset.itemCount);
    this.selected = { source, id, count };
    this.drag = { pointerId: event.pointerId, slot, source, id, count, startX: event.clientX, startY: event.clientY, moved: false, amount: event.shiftKey ? 1 : count };
    slot.setPointerCapture?.(event.pointerId);
    slot.addEventListener('pointermove', this._boundMove ||= e => this._movePointer(e));
    slot.addEventListener('pointerup', this._boundUp ||= e => this._finishPointer(e));
    slot.addEventListener('pointercancel', this._boundCancel ||= () => this.cancelDrag());
  }

  _movePointer(event) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    const delta = Math.hypot(event.clientX - this.drag.startX, event.clientY - this.drag.startY);
    if (!this.drag.moved && delta < 6) return;
    if (!this.drag.moved) this._beginDragGhost();
    this.drag.ghost.style.transform = `translate(${event.clientX + 12}px, ${event.clientY + 12}px)`;
    this.root.querySelectorAll('[data-storage-container]').forEach(target => target.classList.toggle('drop-target', target.contains(document.elementFromPoint(event.clientX, event.clientY)) && target.dataset.storageContainer !== this.drag.source));
  }

  _beginDragGhost() {
    this.drag.moved = true;
    this.drag.slot.classList.add('dragging');
    const ghost = document.createElement('div');
    ghost.className = 'inventory-drag-ghost';
    ghost.innerHTML = `${pixelIcon(this.drag.id, 'inventory-slot-emoji')}<strong>${this.drag.amount}</strong>`;
    document.body.appendChild(ghost);
    this.drag.ghost = ghost;
    document.body.classList.add('storage-dragging');
  }

  _finishPointer(event) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    const drag = this.drag;
    const destination = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-storage-container]')?.dataset.storageContainer;
    if (drag.moved && destination && destination !== drag.source) this.transfer(drag.source, destination, drag.id, drag.amount);
    else if (!drag.moved) {
      this.selected = { source: drag.source, id: drag.id, count: drag.count };
      this.render();
    }
    this.cancelDrag();
  }

  cancelDrag() {
    if (!this.drag) return;
    this.drag.slot?.classList.remove('dragging');
    this.drag.ghost?.remove();
    this.root?.querySelectorAll('.drop-target').forEach(target => target.classList.remove('drop-target'));
    document.body.classList.remove('storage-dragging');
    this.drag = null;
  }

  moveSelected(destination) {
    if (!this.selected || destination === this.selected.source) return;
    this.transfer(this.selected.source, destination, this.selected.id, this.selected.count);
  }

  splitSelected() {
    if (!this.selected) return;
    const requested = Number(window.prompt(`Jumlah ${title(this.selected.id)} yang dipindahkan`, Math.max(1, Math.floor(this.selected.count / 2))));
    if (!Number.isSafeInteger(requested) || requested < 1 || requested > this.selected.count) return;
    const destination = this.selected.source === 'backpack' ? 'warehouse' : 'backpack';
    this.transfer(this.selected.source, destination, this.selected.id, requested);
  }

  transfer(source, destination, id, amount) {
    if (!Number.isSafeInteger(amount) || amount < 1 || source === destination) return false;
    if (destination === 'warehouse' && !isWarehouseStorable(id)) {
      this.scene.hud.showMessage('Peralatan dan kunci harus tetap dibawa.', 2400);
      return false;
    }
    const from = source === 'warehouse' ? this.scene.warehouse : this.scene.inventorySystem;
    const to = destination === 'warehouse' ? this.scene.warehouse : this.scene.inventorySystem;
    const has = source === 'warehouse' ? from.getItemCount(id) : from.getItemCount(id);
    if (has < amount) return false;
    const removed = source === 'warehouse' ? from.withdraw(id, amount) : from.removeItem(id, amount);
    if (!removed) return false;
    to.addItem ? to.addItem(id, amount) : to.deposit(id, amount);
    this.selected = { source: destination, id, count: (destination === 'warehouse' ? this.scene.warehouse.getItemCount(id) : this.scene.inventorySystem.getItemCount(id)) };
    this.scene.saveSystem.saveLocal();
    this.render();
    return true;
  }

  destroy() {
    this.cancelDrag();
    this.scene.inventorySystem.events.off('inventory-changed', this._onInventory);
    this.scene.warehouse.events.off('changed', this._onInventory);
  }
}
