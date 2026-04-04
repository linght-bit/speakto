let i18nData = {
  ru: {},
  pt: {}
};

function initI18n(ruTexts, ptTexts) {
  i18nData.ru = ruTexts;
  i18nData.pt = ptTexts;
}

function getText(key, lang = null) {
 
  if (!lang) {
    try {
      const state = window.getGameState?.('ui.language') || 'ru';
      lang = state;
    } catch (e) {
      lang = 'ru';
    }
  }
  
 
  const normalizedLang = lang === 'pt-br' ? 'pt' : lang;
  
 
  const parts = key.split('.');
  let result = i18nData[normalizedLang] || {};
  
  for (const part of parts) {
    result = result[part];
    if (!result) {
      return key;
    }
  }
  
  return result || key;
}

function getTextRU(key) {
  return getText(key, 'ru');
}

function getTextPT(key) {
  return getText(key, 'pt');
}

window.initI18n = initI18n;
window.getText = getText;
window.getTextRU = getTextRU;
window.getTextPT = getTextPT;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initI18n,
    getText,
    getTextRU,
    getTextPT,
  };
}
