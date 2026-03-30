/**
 * /utils/getText.js
 * ПОЛУЧЕНИЕ ТЕКСТОВ ПО КЛЮЧАМ
 * 
 * Единая функция для получения текстов из i18n.
 * Испщльзуется везде, где нужен текст.
 */

let i18nData = {
  ru: {},
  pt: {}
};

/**
 * Инициализировать i18n данные
 * @param {object} ruTexts - русские тексты
 * @param {object} ptTexts - португальские тексты
 */
function initI18n(ruTexts, ptTexts) {
  i18nData.ru = ruTexts;
  i18nData.pt = ptTexts;
}

/**
 * Получить текст по ключу
 * @param {string} key - путь к тексту (например 'ui.startGame' или 'dialogue.hello')
 * @param {string} lang - язык ('ru' или 'pt')
 * @returns {string}
 */
function getText(key, lang = null) {
  // Если язык не указан, использовать язык UI из gameState
  if (!lang) {
    try {
      const state = window.getGameState?.('ui.language') || 'ru';
      lang = state;
    } catch (e) {
      lang = 'ru'; // дефолт на русский
    }
  }
  
  // Нормализовать язык
  const normalizedLang = lang === 'pt-br' ? 'pt' : lang;
  
  // Получить текст по пути
  const parts = key.split('.');
  let result = i18nData[normalizedLang] || {};
  
  for (const part of parts) {
    result = result[part];
    if (!result) {
      return key; // возврат ключа, если текст не найден
    }
  }
  
  return result || key;
}

/**
 * Получить текст на русском (для лисёнка)
 */
function getTextRU(key) {
  return getText(key, 'ru');
}

/**
 * Получить текст на португальском (для игрока)
 */
function getTextPT(key) {
  return getText(key, 'pt');
}

// Прикрепляем к window для глобального доступа
window.initI18n = initI18n;
window.getText = getText;
window.getTextRU = getTextRU;
window.getTextPT = getTextPT;

// Экспортируем для модульной системы
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initI18n,
    getText,
    getTextRU,
    getTextPT,
  };
}
