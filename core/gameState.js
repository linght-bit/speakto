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
    x: 270,               // стартовая клетка в каюте (сдвинута левее на 5 клеток)
    y: 1150,              // стартовая клетка в каюте (левая жилая секция)
    targetX: null,        // целевая позиция X для движения
    targetY: null,        // целевая позиция Y для движения
    isMoving: false,      // движется ли персонаж сейчас
    pathWaypoints: null,  // массив контрольных точек [{x, y}, ...] для grid pathfinding
    currentWaypoint: 0,   // индекс текущей контрольной точки
    _pendingItemPickup: null, // ID предмета для взятия когда достигнет цели
    _pendingDoorOpen: null,   // {doorId} — открыть дверь при достижении
    _pendingPutOnSurface: null, // {itemId, surfaceId} — положить на поверхность по приходу
    _pendingOpenContainer: null, // {containerId} — открыть контейнер по приходу
    _pendingTakeFromContainer: null, // {itemId, containerId} — взять из контейнера по приходу
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
    progress: {},         // прогресс сценариев и актов
    taskStates: {},       // выполненность задач по id
  },
  
  world: {
    flags: {},            // любые флаги мира (gate_open, horse_fed и т.д.)
    objects: [],          // предметы на земле: {id, itemId, x, y, taken}
    mapObjects: [],       // объекты на карте: {id, objectId, x, y, width, height, isSurface}
    surfaceItems: {},     // предметы в/на емкостях: { "obj_table_1": ["apple", "key"] }
    containerStates: {},  // состояния контейнеров: { "obj_chest_red_1": "open"|"closed" }
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
// Счетчик обновлений для защиты от зависания
let updateGameStateCallCount = 0;
const MAX_UPDATES_PER_FRAME = 10;
let lastFrameUpdateCount = 0;

// Счетчик фреймов для сброса
let frameCounter = 0;

function updateGameState(updates) {
  updateGameStateCallCount++;
  
  // ЗАЩИТА: Если слишком много обновлений за один фрейм - логируем и игнорируем
  if (updateGameStateCallCount > MAX_UPDATES_PER_FRAME) {
    return; // Не обновляем!
  }
  
  gameState = deepMerge(gameState, updates);
  
  // Выслать событие об изменении
  if (window.eventSystem) {
    window.eventSystem.emit('game:state-changed', { updates, newState: gameState });
  }
}

// Сбросить счетчик каждый фрейм (из render.js)
function resetUpdateCounter() {
  frameCounter++;
  lastFrameUpdateCount = updateGameStateCallCount;
  updateGameStateCallCount = 0;
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

    // Инициализируем состояния контейнеров (все закрыты по умолчанию)
    for (const obj of gameState.world.mapObjects) {
      if (obj.isContainer) {
        gameState.world.containerStates[obj.id] = obj.alwaysOpen ? 'open' : 'closed';
      }
    }

    // Инициализируем содержимое контейнеров из initialItems
    for (const obj of gameState.world.mapObjects) {
      if (obj.isSurface && obj.initialItems?.length > 0) {
        gameState.world.surfaceItems[obj.id] = [...obj.initialItems];
      }
    }
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
window.resetUpdateCounter = resetUpdateCounter;

// Экспортируем функции (для модульной системы)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getGameState,
    updateGameState,
    resetGameState,
    DEFAULT_STATE,
  };
}
