/**
 * /systems/questSystem.js
 * СИСТЕМА КВЕСТОВ
 * 
 * Обрабатывает добавление, удаление, завершение квестов.
 * Все данные берутся из /data/quests.json.
 */

class QuestSystem {
  constructor() {
    this.quests = [];
    this.setupListeners();
  }

  /**
   * Инициализировать квесты из данных
   */
  loadQuests(questsData) {
    this.quests = questsData;
    console.log(`✓ Загружено квестов: ${this.quests.length}`);
  }

  /**
   * Активировать квест
   */
  activateQuest(questId) {
    try {
      const state = window.getGameState?.();
      if (!state) {
        console.warn('⚠️ gameState не инициализирована');
        return;
      }
      
      if (state.quests.active.includes(questId)) return;
      
      state.quests.active.push(questId);
      window.updateGameState?.(state);
      
      window.eventSystem?.emit('quest:activated', { questId });
    } catch (e) {
      console.error('Ошибка при активации квеста:', e);
    }
  }

  /**
   * Завершить квест
   */
  completeQuest(questId) {
    try {
      const state = window.getGameState?.();
      if (!state) {
        console.warn('⚠️ gameState не инициализирована');
        return;
      }
      
      state.quests.active = state.quests.active.filter(id => id !== questId);
      state.quests.completed.push(questId);
      
      window.updateGameState?.(state);
      window.eventSystem?.emit('quest:completed', { questId });
    } catch (e) {
      console.error('Ошибка при завершении квеста:', e);
    }
  }

  setupListeners() {
    // Слушаем события изменения состояния
    window.eventSystem?.on('game:state-changed', (data) => {
      // Здесь можно добавить дополнительную логику
    });
  }
}

// Создаём и прикрепляем к window
const questSystem = new QuestSystem();
window.questSystem = questSystem;

// Для модульной системы
if (typeof module !== 'undefined' && module.exports) {
  module.exports = questSystem;
}
