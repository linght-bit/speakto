/**
 * /core/gameState.js
 * ЕДИНОЕ СОСТОЯНИЕ ИГРЫ
 * 
 * Здесь хранится ВСЕДЛЯ ПИСА о прогрессе игры.
 * Любые изменения состояния идут ТОЛЬКО через функции в этом файле.
 * Никаких побочных переменных вне этого файла!
 */

// Состояние по умолчанию
const DEFAULT_STATE = {
  player: {
    language: 'pt-br',    // язык игрока (pt-br)
    inventory: [],        // массив id предметов в инвентаре
    x: 100,               // позиция X на экране
    y: 100,               // позиция Y на экране
    targetX: null,        // целевая позиция X для движения
    targetY: null,        // целевая позиция Y для движения
    isMoving: false,      // движется ли персонаж сейчас
    position: null,       // текущая позиция {x, y} или null (для совместимости)
    state: 'idle',        // 'idle', 'walking', 'talking', 'thinking'
    direction: 'right',   // 'left', 'right'
  },
  
  ui: {
    language: 'ru',       // язык UI (русский)
    currentScreen: 'game', // 'game', 'menu', 'dialogue', и т.д.
  },
  
  quests: {
    active: [],           // массив id активных квестов
    completed: [],        // массив id завершённых квестов
    current: null,        // текущий квест для лисёнка
  },
  
  world: {
    flags: {},            // любые флаги мира (gate_open, horse_fed и т.д.)
    objects: [],          // предметы на земле: {id, itemId, x, y, taken}
    mapObjects: [],       // объекты на карте: {id, objectId, x, y, width, height}
  },
  
  dialogue: {
    active: false,        // есть ли активный диалог
    npc: null,            // id NPC
    step: 0,              // номер шага в диалоге
  },
  
  voice: {
    isListening: false,   // слушаем ли голос
    lastCommand: null,    // последняя распознанная команда
    lastCommandTime: 0,   // время последней команды
    lastAction: null,     // последнее выполненное действие
  },
};

// Рабочая копия состояния
let gameState = JSON.parse(JSON.stringify(DEFAULT_STATE));

/**
 * Получить текущее состояние (или часть)
 * @param {string} path - например 'player.inventory' или null для всего
 */
function getGameState(path = null) {
  if (!path) return gameState;
  
  const parts = path.split('.');
  let value = gameState;
  for (const part of parts) {
    value = value?.[part];
  }
  return value;
}

/**
 * Обновить состояние (глубокое слияние)
 * @param {object} updates - что обновить
 */
function updateGameState(updates) {
  gameState = deepMerge(gameState, updates);
  
  // Выслать событие об изменении
  if (window.eventSystem) {
    window.eventSystem.emit('game:state-changed', { updates, newState: gameState });
  }
}

/**
 * Сбросить состояние на умолчание
 */
function resetGameState() {
  gameState = JSON.parse(JSON.stringify(DEFAULT_STATE));
  
  // Загружаем worldObjects если они доступны
  if (window.worldObjectsData?.objects) {
    gameState.world.objects = JSON.parse(JSON.stringify(window.worldObjectsData.objects));
  }
  
  // Загружаем mapObjects (объекты на карте) если они доступны
  if (window.mapObjectsData?.objects) {
    gameState.world.mapObjects = JSON.parse(JSON.stringify(window.mapObjectsData.objects));
  }
  
  if (window.eventSystem) {
    window.eventSystem.emit('game:state-reset', gameState);
  }
}

/**
 * Вспомогательная функция для глубокого слияния объектов
 */
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

// Прикрепляем к window для глобального доступа
window.getGameState = getGameState;
window.updateGameState = updateGameState;
window.resetGameState = resetGameState;

// Экспортируем функции (для модульной системы)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getGameState,
    updateGameState,
    resetGameState,
    DEFAULT_STATE,
  };
}
