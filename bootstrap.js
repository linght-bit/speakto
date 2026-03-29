/**
 * /bootstrap.js
 * ИНИЦИАЛИЗАЦИЯ ИГРЫ
 * 
 * Точка входа. Загружает все модули, инициализирует системы, запускает игру.
 */

async function initGame() {
  console.log('🎮 Инициализация игры...');

  try {
    // 1. Убедиться, что все глобальные системы загружены
    if (!window.eventSystem) {
      throw new Error('EventSystem не загружена!');
    }
    if (!window.gameConfig) {
      throw new Error('Game Config не загружена!');
    }

    console.log('✓ Основные системы загружены');

    // 2. Загрузить JSON данные (с fallback если не загружаются)
    console.log('📦 Загружаю данные...');
    
    let questsData = { quests: [] };
    let ruTexts = {};
    let ptTexts = {};
    let charactersData = { characters: [] };
    let actionsData = { actions: [] };
    let itemsData = { items: [] };
    let worldObjectsData = { objects: [] };
    let mapObjectsData = { objects: [] };

    try {
      const [questsRes, ruRes, ptRes, charsRes, actionsRes, itemsRes, worldRes, objectsRes] = await Promise.all([
        fetch('./data/quests.json').catch(e => null),
        fetch('./i18n/ru.json').catch(e => null),
        fetch('./i18n/pt.json').catch(e => null),
        fetch('./data/characters.json').catch(e => null),
        fetch('./data/actions.json').catch(e => null),
        fetch('./data/items.json').catch(e => null),
        fetch('./data/worldObjects.json').catch(e => null),
        fetch('./data/objects.json').catch(e => null),
      ]);

      if (questsRes?.ok) {
        questsData = await questsRes.json();
      }
      if (ruRes?.ok) {
        ruTexts = await ruRes.json();
      }
      if (ptRes?.ok) {
        ptTexts = await ptRes.json();
      }
      if (charsRes?.ok) {
        charactersData = await charsRes.json();
      }
      if (actionsRes?.ok) {
        actionsData = await actionsRes.json();
      }
      if (itemsRes?.ok) {
        itemsData = await itemsRes.json();
      }
      if (worldRes?.ok) {
        worldObjectsData = await worldRes.json();
      }
      if (objectsRes?.ok) {
        mapObjectsData = await objectsRes.json();
      }

      console.log('✓ Данные загружены (или используются дефолты)');
    } catch (fetchError) {
      console.warn('⚠️ Ошибка при загрузке данных, использую дефолты:', fetchError);
    }

    // Сохраняем данные глобально для доступа из систем
    window.charactersData = charactersData;
    window.itemsData = itemsData;
    window.actionsData = actionsData;
    window.worldObjectsData = worldObjectsData;
    window.mapObjectsData = mapObjectsData;


    // 3. Инициализировать i18n
    if (window.initI18n) {
      window.initI18n(ruTexts, ptTexts);
      console.log('✓ i18n инициализирована');
      console.log('  рус текстов:', Object.keys(ruTexts).length);
      console.log('  pt текстов:', Object.keys(ptTexts).length);
      if (ptTexts.voice?.commands) {
        console.log('  PT команды загружены:', Object.keys(ptTexts.voice.commands).length);
      }
    }

    // 3.4 Загрузить голосовые команды в actionSystem из i18n
    if (window.actionSystem) {
      console.log('📋 До loadVoiceCommands - commandMappings:', Object.keys(window.actionSystem.commandMappings).length);
      window.actionSystem.loadVoiceCommands();
      console.log('📋 После loadVoiceCommands - commandMappings:', Object.keys(window.actionSystem.commandMappings).length);
      console.log('    Примеры команд:', Object.keys(window.actionSystem.commandMappings).slice(0, 5).map(k => `${k}→${window.actionSystem.commandMappings[k]}`).join(', '));
    }

    // 3.5 Инициализировать voiceSystem
    if (window.voiceSystem) {
      window.voiceSystem.loadActions(actionsData);
      console.log('🎤 Голосовая система инициализирована');
    }

    // 3.6 Инициализировать actionSystem
    if (window.actionSystem) {
      window.actionSystem.loadActions(actionsData);
      console.log('⚡ Система действий инициализирована');
    }

    // 4. Загрузить квесты в систему
    if (window.questSystem) {
      window.questSystem.loadQuests(questsData.quests || []);
      console.log('✓ Квесты загружены');
    }

    // 5. Инициализировать состояние игры
    if (window.resetGameState) {
      window.resetGameState();
      console.log('✓ gameState инициализирован');
    }

    // 5.5 Запустить голосовое управление
    if (window.voiceSystem) {
      window.voiceSystem.start();
      console.log('🎤 Запустил голосовое управление');
    }

    // 6. Запустить рендеринг
    if (window.gameRenderer) {
      console.log('🎨 Запускаю рендеринг...');
      window.gameRenderer.render();
    } else {
      console.warn('⚠️ gameRenderer не найден');
    }

    console.log('✅ Игра инициализирована!');
    if (window.eventSystem) {
      window.eventSystem.emit('game:initialized');
    }

  } catch (error) {
    console.error('❌ Ошибка при инициализации:', error);
    
    // Показать ошибку на экране
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#2a3f2f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ff6b6b';
        ctx.font = '16px Arial';
        ctx.fillText('Ошибка при загрузке игры:', 20, 50);
        ctx.fillText(error.message, 20, 80);
      }
    }
    
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
      document.getElementById('error-text').textContent = error.message;
      errorDiv.classList.add('show');
    }
  }
}

// Запустить инициализацию, когда DOM готов
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}

window.initGame = initGame;
