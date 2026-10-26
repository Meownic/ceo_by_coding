/**
 * Player-placeable construction definitions. A kit is a normal inventory item
 * until it is placed through Build Mode.
 */
export const BUILDING_DEFINITIONS = Object.freeze({
  crafting_table: {
    kitId: 'crafting_table_kit',
    label: 'Crafting Table',
    width: 1,
    height: 1,
    machineType: 'crafting_table',
    description: 'Merakit kit bangunan dari hasil tambang.',
  },
  warehouse_depot: {
    kitId: 'warehouse_depot_kit',
    label: 'Warehouse Depot',
    width: 2,
    height: 2,
    storage: true,
    description: 'Akses tambahan ke stok gudang pusat.',
  },
  conveyor: {
    kitId: 'conveyor_kit',
    label: 'Conveyor',
    width: 1,
    height: 1,
    conveyor: true,
    description: 'Memindahkan satu item per detik.',
  },
});

export const BUILDING_KIT_IDS = Object.freeze(Object.fromEntries(
  Object.entries(BUILDING_DEFINITIONS).map(([type, definition]) => [definition.kitId, type]),
));

export const BUILDING_KITS = Object.freeze(Object.entries(BUILDING_DEFINITIONS).map(([type, definition]) => ({
  type,
  ...definition,
})));

export function buildingTypeFromKit(itemId) {
  return BUILDING_KIT_IDS[itemId] || null;
}

export function isWarehouseStorable(itemId) {
  return itemId !== 'plow' && itemId !== 'watering_can' && !itemId.startsWith('key_');
}
