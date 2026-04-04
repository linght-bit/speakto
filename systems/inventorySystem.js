class InventorySystem {
  
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

const inventorySystem = new InventorySystem();
window.inventorySystem = inventorySystem;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = inventorySystem;
}
