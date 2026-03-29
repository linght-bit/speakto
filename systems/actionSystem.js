/**
 * /systems/actionSystem.js
 * СИСТЕМА ОБРАБОТКИ ДЕЙСТВИЙ
 * 
 * Преобразует распознанные команды в игровые действия.
 * Все командные параметры берутся из данных поля мира и инвентаря.
 */

class ActionSystem {
  constructor() {
    this.actions = {};
    this.commandMappings = {}; // Загружается из i18n/pt.json dynamically
    this.lastAction = null;
    console.log('✓ ActionSystem инициализирован');
  }

  /**
   * Загрузить команды голоса из i18n данных
   * Вызывается в bootstrap после инициализации getText
   */
  loadVoiceCommands() {
    try {
      // Получаем команды из португальских текстов (voice.commands)
      const ptTexts = window.ptTexts || {};
      const commands = ptTexts.voice?.commands || {};

      // Строим командные маппинги: слово -> ID действия
      this.commandMappings = {};
      for (const [actionId, synonyms] of Object.entries(commands)) {
        if (Array.isArray(synonyms)) {
          for (const synonym of synonyms) {
            this.commandMappings[synonym.toLowerCase()] = actionId;
          }
        }
      }

      console.log(`✓ Загружено ${Object.keys(this.commandMappings).length} голосовых команд из i18n`);
    } catch (error) {
      console.error('Ошибка при загрузке голосовых команд:', error);
    }
  }

  /**
   * Загрузить действия из данных
   * @param {object} actionsData - {actions: [...]}
   */
  loadActions(actionsData) {
    if (!actionsData?.actions) return;

    this.actions = {};
    actionsData.actions.forEach(action => {
      this.actions[action.id] = action;
    });
    console.log(`✓ Загружено ${Object.keys(this.actions).length} действий`);
  }

  /**
   * Обработать распознанную команду
   * @param {string} command - распознанная команда
   */
  processCommand(command) {
    try {
      const normalized = command.toLowerCase().trim();
      console.log(`🎯 Обработка: "${normalized}"`);

      // Найти соответствующее действие
      const actionId = this.findActionId(normalized);
      if (!actionId) {
        console.log(`❌ Действие не найдено для: "${normalized}"`);
        window.eventSystem?.emit('action:notFound', { command: normalized });
        return false;
      }

      // Извлечь параметры команды
      const params = this.extractParameters(normalized, actionId);

      // Выполнить действие
      return this.executeAction(actionId, params);
    } catch (error) {
      console.error('Ошибка при обработке команды:', error);
      return false;
    }
  }

  /**
   * Найти ID действия по команде
   * @param {string} command - команда
   * @returns {string} ID действия
   */
  findActionId(command) {
    console.log(`📋 CommandMappings (${Object.keys(this.commandMappings).length} записей):`, Object.keys(this.commandMappings).slice(0, 10));
    
    // Проверяем все слова в команде
    const words = command.split(/\s+/);
    console.log(`📝 Слова в команде: ${words.join(', ')}`);

    for (const word of words) {
      console.log(`  - Проверяю слово "${word}": ${this.commandMappings[word] ? '✓ найдено' : '✗ не найдено'}`);
      if (this.commandMappings[word]) {
        console.log(`  ✅ Найдено действие: ${this.commandMappings[word]}`);
        return this.commandMappings[word];
      }
    }

    // Проверяем частичные совпадения
    console.log(`🔍 Ищу частичные совпадения...`);
    for (const [key, actionId] of Object.entries(this.commandMappings)) {
      if (command.includes(key)) {
        console.log(`  ✅ Найдено частичное совпадение: "${key}" -> ${actionId}`);
        return actionId;
      }
    }

    return null;
  }

  /**
   * Извлечь параметры из команды
   * @param {string} command - команда
   * @param {string} actionId - ID действия
   */
  extractParameters(command, actionId) {
    const gameState = window.getGameState?.();
    if (!gameState) return {};

    const params = {};
    console.log(`⚙️  Извлечение параметров для действия: ${actionId}`);

    switch (actionId) {
      case 'take_item':
      case 'use_item':
      case 'drop_item': {
        // Найти ближайший предмет по команде
        const itemName = this.extractItemNameFromCommand(command);
        params.itemId = itemName || this.findClosestItem();
        console.log(`  → itemId: ${params.itemId}`);
        break;
      }

      case 'approach_to': {
        // Найти объект или предмет для приближения
        const targetName = this.extractTargetNameFromCommand(command);
        params.targetId = targetName;
        console.log(`  → targetId: ${params.targetId}`);
        break;
      }

      case 'move_left':
        params.direction = 'left';
        break;
      case 'move_right':
        params.direction = 'right';
        break;
      case 'move_up':
        params.direction = 'up';
        break;
      case 'move_down':
        params.direction = 'down';
        break;

      case 'open_door': {
        params.doorId = 'door'; // пока только одна дверь на карте
        break;
      }

      case 'talk_npc': {
        params.npcId = this.findClosestNPC();
        break;
      }
    }

    return params;
  }

  /**
   * Найти название предмета в команде
   */
  extractItemNameFromCommand(command) {
    const itemsData = window.itemsData?.items || [];
    const commandLower = command.toLowerCase().trim();
    
    console.log(`🔎 Ищу предмет в команде "${command}"`);

    // 1️⃣ Сначала проверяем по ID
    for (const item of itemsData) {
      if (commandLower.includes(item.id.toLowerCase())) {
        console.log(`  ✓ Найден по ID: ${item.id}`);
        return item.id;
      }
    }

    // 2️⃣ Проверяем по португальским названиям (из i18n)
    console.log(`  → Ищу по названиям на португальском...`);
    for (const item of itemsData) {
      try {
        const itemName = window.getText?.(`items.${item.name}`, 'pt-br');
        
        if (itemName) {
          // Точное совпадение слова
          if (commandLower.includes(itemName.toLowerCase())) {
            console.log(`  ✓ Найден: "${itemName}" → ${item.id}`);
            return item.id;
          }
          
          // Частичное совпадение (слово внутри слова)
          const words = commandLower.split(/\s+/);
          for (const word of words) {
            if (itemName.toLowerCase().includes(word) || word.includes(itemName.toLowerCase())) {
              console.log(`  ✓ Найден (частичное): "${itemName}" → ${item.id}`);
              return item.id;
            }
          }
        }
      } catch (e) {
        console.warn(`  ⚠️ Ошибка для ${item.name}:`, e.message);
      }
    }

    console.log(`  ✗ Предмет не найден в "${command}"`);
    return null;
  }

  /**
   * Найти ближайший предмет
   */
  findClosestItem() {
    const gameState = window.getGameState?.();
    if (!gameState?.world?.objects?.length) return null;

    const playerPos = { x: gameState.player.x, y: gameState.player.y };
    let closest = null;
    let minDist = Infinity;

    for (const obj of gameState.world.objects) {
      if (obj.taken) continue;

      const dist = Math.hypot(obj.x - playerPos.x, obj.y - playerPos.y);
      if (dist < minDist) {
        minDist = dist;
        closest = obj.itemId;
      }
    }

    return closest;
  }

  /**
   * Найти ближайший нужный предмет/объект по названию
   */
  extractTargetNameFromCommand(command) {
    const itemsData = window.itemsData?.items || [];
    const objectsData = window.mapObjectsData?.objects || [];

    // Ищем по названиям предметов
    for (const item of itemsData) {
      const itemName = window.getText?.(`items.${item.name}`, 'pt-br');
      if (itemName && command.toLowerCase().includes(itemName.toLowerCase())) {
        return item.id;
      }
    }

    // Ищем по объектам на карте
    for (const obj of objectsData) {
      const objName = window.getText?.(`objects.object_${obj.objectId}`, 'pt-br');
      if (objName && command.toLowerCase().includes(objName.toLowerCase())) {
        return obj.objectId;
      }
    }

    return null;
  }

  /**
   * ДЕЙСТВИЕ: Приближиться к объекту/предмету
   */
  action_approach(params) {
    if (!params.targetId) {
      console.log(`❌ Не указана цель для приближения`);
      return false;
    }

    const gameState = window.getGameState?.();
    if (!gameState) return false;

    // Ищем предмет или объект
    const item = gameState.world.objects.find(o => o.itemId === params.targetId && !o.taken);
    const mapObj = gameState.world.mapObjects?.find(o => o.objectId === params.targetId);

    if (!item && !mapObj) {
      console.log(`❌ Цель не найдена: ${params.targetId}`);
      return false;
    }

    // Устанавливаем целевую позицию
    const target = item || mapObj;
    window.updateGameState?.({
      player: {
        targetX: target.x,
        targetY: target.y,
        isMoving: true
      }
    });

    console.log(`✅ Идёшь к: ${params.targetId}`);
    window.eventSystem?.emit('player:approaching', { targetId: params.targetId });
    return true;
  }

  /**
   * ДЕЙСТВИЕ: Открыть дверь
   */
  action_openDoor(params) {
    const gameState = window.getGameState?.();
    if (!gameState) return false;

    // Проверяем, есть ли дверь на карте
    const door = gameState.world.mapObjects?.find(o => o.objectId === 'door');
    if (!door) {
      console.log(`❌ Двери не найдено на карте`);
      return false;
    }

    // Проверяем расстояние до двери (должен быть рядом)
    const distance = Math.hypot(
      gameState.player.x - door.x,
      gameState.player.y - door.y
    );

    if (distance > 100) {
      console.log(`❌ Ты слишком далеко от двери (расстояние: ${distance})`);
      return false;
    }

    console.log(`✅ Ты открыл дверь!`);
    window.eventSystem?.emit('door:opened', { doorId: 'door' });
    return true;
  }

  /**
   * Выполнить действие
   * @param {string} actionId - ID действия
   * @param {object} params - параметры действия
   */
  executeAction(actionId, params = {}) {
    try {
      const gameState = window.getGameState?.();
      if (!gameState) {
        console.warn('gameState не доступно!');
        return false;
      }

      this.lastAction = { actionId, params, timestamp: Date.now() };
      let success = false;
      
      console.log(`⚡ executeAction: ${actionId}, params:`, params);

      switch (actionId) {
        case 'take_item':
          console.log(`  → вызываю action_takeItem`);
          success = this.action_takeItem(params);
          console.log(`  ← результат: ${success}`);
          break;
        case 'use_item':
          success = this.action_useItem(params);
          break;
        case 'drop_item':
          success = this.action_dropItem(params);
          break;
        case 'move_left':
        case 'move_right':
        case 'move_up':
        case 'move_down':
          success = this.action_move(params.direction || '');
          break;
        case 'check_inventory':
          success = this.action_checkInventory();
          break;
        case 'look':
          success = this.action_look();
          break;
        case 'help':
          success = this.action_help();
          break;
        case 'approach_to':
          success = this.action_approach(params);
          break;
        case 'open_door':
          success = this.action_openDoor(params);
          break;
        default:
          console.warn(`Неизвестное действие: ${actionId}`);
          return false;
      }

      if (success) {
        console.log(`✅ Действие выполнено: ${actionId}`);
        window.updateGameState?.({
          voice: { lastAction: actionId },
        });
        window.eventSystem?.emit('action:executed', {
          actionId,
          params,
          success: true,
        });
      } else {
        console.log(`❌ Действие НЕ выполнено: ${actionId}`);
      }

      return success;
    } catch (error) {
      console.error('Ошибка при выполнении действия:', error);
      return false;
    }
  }

  /**
   * ДЕЙСТВИЕ: Взять предмет
   */
  action_takeItem(params) {
    const gameState = window.getGameState?.();
    if (!gameState || !params.itemId) {
      console.log(`🚫 Нет gameState или itemId`);
      return false;
    }

    console.log(`📦 action_takeItem: ищу предмет "${params.itemId}"`);

    // Найти предмет в мире
    const objIndex = gameState.world.objects.findIndex(
      o => o.itemId === params.itemId && !o.taken
    );

    if (objIndex === -1) {
      console.log(`✗ Предмет "${params.itemId}" не найден в мире (или уже взят)`);
      return false;
    }

    const obj = gameState.world.objects[objIndex];
    const playerX = gameState.player.x;
    const playerY = gameState.player.y;
    
    // 1️⃣ Проверяем расстояние до предмета (макс 100 пикселей)
    const distance = Math.hypot(obj.x - playerX, obj.y - playerY);
    console.log(`  📍 Расстояние до предмета: ${distance.toFixed(1)}px`);

    if (distance > 100) {
      // 2️⃣ Если далеко - отправляем персонажа к предмету
      console.log(`  🚶 Слишком далеко! Идёшь к "${params.itemId}"`);
      
      // Отправить персонажа туда
      window.updateGameState?.({
        player: {
          targetX: obj.x,
          targetY: obj.y,
          isMoving: true,
          _pendingItemPickup: params.itemId  // Отметить что нужно взять потом
        }
      });
      
      return true; // Успех - начали движение
    }

    // 3️⃣ Если близко - берём сразу
    console.log(`✓ Близко! Берём предмет: ${params.itemId}`);

    // Добавить в инвентарь
    const addResult = window.inventorySystem?.addItem(params.itemId);
    console.log(`  Добавление в инвентарь: ${addResult}`);

    // Отметить как взятый
    gameState.world.objects[objIndex].taken = true;
    window.updateGameState?.({ world: { objects: gameState.world.objects } });

    console.log(`✅ Успешно взял: ${params.itemId}`);
    window.eventSystem?.emit('item:taken', { itemId: params.itemId });
    return true;
  }

  /**
   * ДЕЙСТВИЕ: Использовать предмет
   */
  action_useItem(params) {
    if (!params.itemId) return false;

    const gameState = window.getGameState?.();
    if (!gameState?.player?.inventory?.includes(params.itemId)) {
      console.log(`❌ Предмета "${params.itemId}" нет в инвентаре`);
      return false;
    }

    console.log(`✅ Использовал: ${params.itemId}`);
    window.eventSystem?.emit('item:used', { itemId: params.itemId });
    return true;
  }

  /**
   * ДЕЙСТВИЕ: Выбросить предмет
   */
  action_dropItem(params) {
    if (!params.itemId) return false;

    const gameState = window.getGameState?.();
    if (!gameState?.player?.inventory?.includes(params.itemId)) {
      console.log(`❌ Предмета "${params.itemId}" нет в инвентаре`);
      return false;
    }

    window.inventorySystem?.removeItem(params.itemId);
    console.log(`✅ Выбросил: ${params.itemId}`);
    window.eventSystem?.emit('item:dropped', { itemId: params.itemId });
    return true;
  }

  /**
   * ДЕЙСТВИЕ: Двигаться
   */
  action_move(direction) {
    const gameState = window.getGameState?.();
    if (!gameState) return false;

    const speed = 20;
    const newState = { player: { ...gameState.player } };

    switch (direction) {
      case 'left':
        newState.player.x = Math.max(0, gameState.player.x - speed);
        newState.player.direction = 'left';
        break;
      case 'right':
        newState.player.x = Math.min(
          (window.gameConfig?.canvas?.width || 800) - gameState.player.width || 40,
          gameState.player.x + speed
        );
        newState.player.direction = 'right';
        break;
      case 'up':
        newState.player.y = Math.max(0, gameState.player.y - speed);
        break;
      case 'down':
        newState.player.y = Math.min(
          (window.gameConfig?.canvas?.height || 600) - gameState.player.height || 40,
          gameState.player.y + speed
        );
        break;
    }

    window.updateGameState?.(newState);
    console.log(`✅ Переместился: ${direction}`);
    return true;
  }

  /**
   * ДЕЙСТВИЕ: Проверить инвентарь
   */
  action_checkInventory() {
    const gameState = window.getGameState?.();
    if (!gameState?.player?.inventory) return false;

    const inv = gameState.player.inventory;
    console.log(`📦 Инвентарь (${inv.length} предметов):`, inv);
    window.eventSystem?.emit('inventory:checked', { inventory: inv });
    return true;
  }

  /**
   * ДЕЙСТВИЕ: Посмотреть вокруг
   */
  action_look() {
    const gameState = window.getGameState?.();
    if (!gameState) return false;

    const objects = gameState.world.objects.filter(o => !o.taken);
    console.log(`👀 Вижу ${objects.length} предметов:`);
    objects.forEach(obj => {
      console.log(`  - ${obj.itemId} в (${obj.x}, ${obj.y})`);
    });

    window.eventSystem?.emit('world:looked', { objects });
    return true;
  }

  /**
   * ДЕЙСТВИЕ: Справка
   */
  action_help() {
    const RU = window.getTextRU;
    if (!RU) return false;

    console.log('📖 Доступные команды:');
    console.log('  PEGAR - взять предмет');
    console.log('  USAR - использовать предмет');
    console.log('  LARGAR - выбросить предмет');
    console.log('  DIREITA/ESQUERDA/CIMA/BAIXO - двигаться');
    console.log('  INVENTÁRIO - проверить инвентарь');
    console.log('  OLHAR - посмотреть вокруг');

    window.eventSystem?.emit('help:shown');
    return true;
  }

  /**
   * Получить последнее действие
   */
  getLastAction() {
    return this.lastAction;
  }
}

// Создаём глобальный экземпляр
const actionSystem = new ActionSystem();
window.actionSystem = actionSystem;

if (window.eventSystem) {
  window.eventSystem.emit('system:action-loaded');
}
