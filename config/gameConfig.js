/**
 * /config/gameConfig.js
 * КОНФИГУРАЦИЯ ИГРЫ
 * 
 * Глобальные параметры, баланс, стартовые значения.
 */

const gameConfig = {
  // Языки
  languages: {
    ui: 'ru',        // использовать русский для интерфейса (лисёнок)
    player: 'pt-br', // использовать португальский для игрока
  },

  // Видео
  canvas: {
    width: 800,
    height: 600,
    backgroundColor: '#08000e',
  },

  // Микрофон и речь
  voice: {
    enabled: true,
    language: 'pt-BR',  // язык распознавания (португальский)
    continuous: true,
  },

  // Камера (если будет)
  camera: {
    zoomLevel: 1.5,
    smoothing: 0.1,
  },

  // Частицы и эффекты
  fx: {
    particlesEnabled: true,
    soundEnabled: true,
  },

  // Debug
  debug: {
    enabled: false,
    showHitboxes: false,
    showGrid: false,
    fps: true,
  },

  // Инвентарь
  inventory: {
    maxItems: 10,
  },
};

// Прикрепляем к window для глобального доступа
window.gameConfig = gameConfig;

// Экспортируем для модульной системы
if (typeof module !== 'undefined' && module.exports) {
  module.exports = gameConfig;
}
