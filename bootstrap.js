/**
 * /bootstrap.js
 * ИНИЦИАЛИЗАЦИЯ ИГРЫ
 * 
 * Точка входа. Загружает все модули, инициализирует системы, запускает игру.
 */

async function initGame() {
  try {
    const ensureAppContext = () => {
      if (!window.appContext) {
        window.appContext = {
          data: {},
          i18n: {},
          services: {},
        };
      }
      return window.appContext;
    };

    const syncLegacyGlobals = (ctx) => {
      // Legacy aliases are kept intentionally during migration.
      window.charactersData = ctx.data.characters;
      window.itemsData = ctx.data.items;
      window.actionsData = ctx.data.actions;
      window.worldObjectsData = ctx.data.worldObjects;
      window.mapObjectsData = ctx.data.mapObjects;
      window.spritesData = ctx.data.sprites;
      window.mapData = ctx.data.map;
      window.ruTexts = ctx.i18n.ru;
      window.ptTexts = ctx.i18n.pt;
    };

    const appContext = ensureAppContext();
    window.getAppContext = () => appContext;

    const fail = (key) => { throw new Error(key); };
    const t = (key, lang = null) => {
      const text = window.getText?.(key, lang);
      return (text && text !== key) ? text : key;
    };
    const formatText = (key, params = {}, lang = null) => {
      let text = t(key, lang || undefined);
      for (const [paramKey, paramValue] of Object.entries(params)) {
        text = text.replaceAll(`{${paramKey}}`, String(paramValue ?? ''));
      }
      return text;
    };

    // 1. Убедиться, что все глобальные системы загружены
    if (!window.eventSystem) {
      fail('bootstrap.event_system_missing');
    }
    if (!window.gameConfig) {
      fail('bootstrap.game_config_missing');
    }

    // 2. Загрузить JSON данные (с fallback если не загружаются)
    let questsData = { quests: [] };
    let ruTexts = {};
    let ptTexts = {};
    let charactersData = { characters: [] };
    let actionsData = { actions: [] };
    let itemsData = { items: [] };
    let worldObjectsData = { objects: [] };
    let mapObjectsData = { objects: [] };
    let spritesData = { sprites: {}, palette: {} };
    let mapData = { worldGrid: { cols: 80, rows: 130 }, ship: null };

    try {
      const [questsRes, ruRes, ptRes, charsRes, actionsRes, itemsRes, worldRes, objectsRes, spritesRes] = await Promise.all([
        fetch('./data/quests.json').catch(e => null),
        fetch('./i18n/ru.json').catch(e => null),
        fetch('./i18n/pt.json').catch(e => null),
        fetch('./data/characters.json').catch(e => null),
        fetch('./data/actions.json').catch(e => null),
        fetch('./data/items.json').catch(e => null),
        fetch('./data/worldObjects.json').catch(e => null),
        fetch('./data/objects.json').catch(e => null),
        fetch('./data/sprites.json').catch(e => null),
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
        if (mapObjectsData?.map) {
          mapData = mapObjectsData.map;
        }
      }
      if (spritesRes?.ok) {
        spritesData = await spritesRes.json();
      }
    } catch (fetchError) {
      console.error(fetchError);
    }

    // Сохраняем данные в едином контейнере приложения
    appContext.data.characters = charactersData;
    appContext.data.items = itemsData;
    appContext.data.actions = actionsData;
    appContext.data.worldObjects = worldObjectsData;
    appContext.data.mapObjects = mapObjectsData;
    appContext.data.sprites = spritesData;
    appContext.data.map = mapData;
    appContext.data.quests = questsData;

    appContext.i18n.ru = ruTexts;
    appContext.i18n.pt = ptTexts;

    appContext.services.eventSystem = window.eventSystem;
    appContext.services.pathfindingSystem = window.pathfindingSystem;
    appContext.services.actionSystem = window.actionSystem;
    appContext.services.voiceSystem = window.voiceSystem;
    appContext.services.questSystem = window.questSystem;
    appContext.services.gameRenderer = window.gameRenderer;

    syncLegacyGlobals(appContext);

    // Передаём геометрию карты в pathfindingSystem
    if (window.pathfindingSystem) {
      window.pathfindingSystem.loadMapData(mapData);
    }

    // 3. Инициализировать i18n
    if (window.initI18n) {
      window.initI18n(ruTexts, ptTexts);
    }

    // 3.4 Загрузить голосовые команды в actionSystem из i18n
    if (window.actionSystem) {
      window.actionSystem.loadVoiceCommands(ptTexts);
    }

    // 3.5 Инициализировать voiceSystem
    if (window.voiceSystem) {
      window.voiceSystem.loadActions(actionsData);
    }

    // 3.6 Инициализировать actionSystem
    if (window.actionSystem) {
      window.actionSystem.loadActions(actionsData);
    }

    // 4. Загрузить квесты в систему
    if (window.questSystem) {
      window.questSystem.loadQuests(questsData.quests || []);
    }

    // 5. Инициализировать состояние игры
    if (window.resetGameState) {
      window.resetGameState();
    }

    // 5.5 Запустить голосовое управление
    if (window.voiceSystem) {
      window.voiceSystem.start();
    }

    // 6. Запустить рендеринг
    if (window.gameRenderer) {
      window.gameRenderer.render();
    }

    if (window.eventSystem) {
      window.eventSystem.emit('game:initialized');
    }

    // ── Игровые логи ─────────────────────────────────────────────────────────
    // Подписываемся на события и выводим читабельный лог в консоль.
    // Слушаем через eventSystem, не трогая никакие системы.
    if (window.eventSystem) {
      window.eventSystem.on('voice:listening', () => {
        console.log(`%c🎤 ${formatText('bootstrap.logs.voice_listening')}`, 'color:#4fc3f7');
      });

      // Первым делом — что сказал пользователь (до обработки)
      window.eventSystem.on('voice:recognized', ({ transcript }) => {
        console.log(`%c🎙 ${formatText('bootstrap.logs.voice_recognized', { transcript })}`, 'color:#81c784;font-weight:bold');
      });

      window.eventSystem.on('action:notFound', ({ command }) => {
        console.log(`%c❓ ${formatText('bootstrap.logs.action_not_found', { command })}`, 'color:#ffb74d');
      });

      window.eventSystem.on('action:failed', ({ actionId, failureCode, badToken }) => {
        const detail = badToken ? ` ("${badToken}")` : '';
        console.log(`%c⚠️ ${formatText('bootstrap.logs.action_failed', { actionId, failureCode, detail })}`, 'color:#ff8a65');
      });

      window.eventSystem.on('fox:say', ({ text }) => {
        console.log(`%c🦊 ${formatText('bootstrap.logs.fox_say', { text })}`, 'color:#ffd54f');
      });

      window.eventSystem.on('action:executed', ({ actionId, params }) => {
        const key = params?.itemId || params?.containerId || params?.doorId || params?.targetId || params?.direction || '';
        const detail = key ? ` -> ${key}` : '';
        console.log(`%c✅ ${formatText('bootstrap.logs.action_executed', { actionId, detail })}`, 'color:#aed581;font-weight:bold');
      });

      window.eventSystem.on('player:approaching', ({ targetId }) => {
        console.log(`%c🚶 ${formatText('bootstrap.logs.player_approaching', { targetId: targetId || '?' })}`, 'color:#80cbc4');
      });

      window.eventSystem.on('item:taken', ({ itemId }) => {
        console.log(`%c📦 ${formatText('bootstrap.logs.item_taken', { itemId })}`, 'color:#a5d6a7');
      });

      window.eventSystem.on('door:opened', ({ doorId }) => {
        console.log(`%c🚪 ${formatText('bootstrap.logs.door_opened', { doorId })}`, 'color:#90caf9');
      });

      window.eventSystem.on('door:closed', ({ doorId }) => {
        console.log(`%c🚪 ${formatText('bootstrap.logs.door_closed', { doorId })}`, 'color:#90caf9');
      });

      window.eventSystem.on('container:opened', ({ containerId }) => {
        console.log(`%c📬 ${formatText('bootstrap.logs.container_opened', { containerId })}`, 'color:#ce93d8');
      });
    }

  } catch (error) {
    console.error(error);
    
    // Показать ошибку на экране
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#2a3f2f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ff6b6b';
        ctx.font = '16px Arial';
        ctx.fillText(t('messages.error'), 20, 50);
        ctx.fillText(t(error.message), 20, 80);
      }
    }
    
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
      const errorTextEl = document.getElementById('error-text');
      const errorTitleEl = document.getElementById('error-title');
      if (errorTitleEl) errorTitleEl.textContent = t('messages.error');
      if (errorTextEl) errorTextEl.textContent = t(error.message);
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
