/**
 * /systems/inventorySystem.js
 * СИСТЕМА ИНВЕНТАРЯ
 * 
 * Управление предметами игрока.
 */

class InventorySystem {
  /**
   * Добавить предмет в инвентарь
   */
  addItem(itemId) {
    try {
      const state = window.getGameState?.();
      if (!state) return false;
      
      if (state.player.inventory.length >= (window.gameConfig?.inventory?.maxItems || 10)) {
        window.eventSystem?.emit('inventory:full', { itemId });
        return false;
      }

      const nextInventory = [...(state.player.inventory || []), itemId];
      window.updateGameState?.({ player: { inventory: nextInventory } });

      window.eventSystem?.emit('inventory:item-added', { itemId });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  /**
   * Удалить предмет из инвентаря
   */
  removeItem(itemId) {
    try {
      const state = window.getGameState?.();
      if (!state) return false;
      
      const index = state.player.inventory.indexOf(itemId);

      if (index > -1) {
        const nextInventory = state.player.inventory.filter((_, idx) => idx !== index);
        window.updateGameState?.({ player: { inventory: nextInventory } });
        window.eventSystem?.emit('inventory:item-removed', { itemId });
        return true;
      }

      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  /**
   * Проверить есть ли предмет в инвентаре
   */
  hasItem(itemId) {
    try {
      const state = window.getGameState?.();
      if (!state) return false;
      return state.player.inventory.includes(itemId);
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  /**
   * Получить нынешний инвентарь
   */
  getInventory() {
    try {
      const state = window.getGameState?.();
      if (!state) return [];
      return state.player.inventory;
    } catch (e) {
      console.error(e);
      return [];
    }
  }
}

// Создаём и прикрепляем к window
const inventorySystem = new InventorySystem();
window.inventorySystem = inventorySystem;

// Для модульной системы
if (typeof module !== 'undefined' && module.exports) {
  module.exports = inventorySystem;
}
