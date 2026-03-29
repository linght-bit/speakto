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
      if (!state) {
        console.warn('🚫 gameState не инициализирована');
        return false;
      }
      
      console.log(`📦 addItem(${itemId}) - инвентарь текущий:`, state.player.inventory);
      
      if (state.player.inventory.length >= (window.gameConfig?.inventory?.maxItems || 10)) {
        console.warn('🚫 Инвентарь переполнен!');
        window.eventSystem?.emit('inventory:full', { itemId });
        return false;
      }

      if (!state.player.inventory.includes(itemId)) {
        state.player.inventory.push(itemId);
        console.log(`  ✓ Добавил в массив, новый инвентарь:`, state.player.inventory);
        
        window.updateGameState?.(state);
        console.log(`  ✓ Вызвал updateGameState`);
        
        window.eventSystem?.emit('inventory:item-added', { itemId });
        console.log(`  ✓ Эмитил события inventory:item-added`);
        return true;
      } else {
        console.log(`  ⚠️ Предмет ${itemId} уже в инвентаре`);
        return false;
      }
    } catch (e) {
      console.error('🚫 Ошибка при добавлении предмета:', e);
      return false;
    }
  }

  /**
   * Удалить предмет из инвентаря
   */
  removeItem(itemId) {
    try {
      const state = window.getGameState?.();
      if (!state) {
        console.warn('⚠️ gameState не инициализирована');
        return false;
      }
      
      const index = state.player.inventory.indexOf(itemId);

      if (index > -1) {
        state.player.inventory.splice(index, 1);
        window.updateGameState?.(state);
        window.eventSystem?.emit('inventory:item-removed', { itemId });
        return true;
      }

      return false;
    } catch (e) {
      console.error('Ошибка при удалении предмета:', e);
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
      console.error('Ошибка при проверке предмета:', e);
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
      console.error('Ошибка при получении инвентаря:', e);
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
