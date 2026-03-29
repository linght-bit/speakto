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
   * @param {object} ptTexts - португальские данные i18n
   */
  loadVoiceCommands(ptTexts) {
    try {
      // Получаем команды из португальских текстов (voice.commands)
      const commands = ptTexts?.voice?.commands || {};

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
   * Найти ID действия по команде.
   * Сначала проверяем многословные фразы (самые длинные первыми),
   * затем individual слова. Это позволяет "vai para a direita"
   * матчить move_right, а не approach_to (через слово "vai").
   * @param {string} command - команда
   * @returns {string} ID действия или null
   */
  findActionId(command) {
    // 0. PRE-CHECK: "положить на поверхность"
    //    Срабатывает когда команда содержит название поверхности (mesa/poço) + предлог (na/no/em/sobre).
    //    Это нужно, т.к. "colocar a maçã na mesa" не совпадает с подстрокой "colocar na" (слова разделены).
    if (this._commandHasSurface(command)) {
      console.log(`📝 Найдено действие (поверхность в команде): put_on_surface`);
      return 'put_on_surface';
    }

    // 1. Многословные фразы — длинные первыми, чтобы более специфичные побеждали
    const phrases = Object.keys(this.commandMappings)
      .filter(k => k.includes(' '))
      .sort((a, b) => b.length - a.length);

    for (const phrase of phrases) {
      if (command.includes(phrase)) {
        console.log(`📝 Найдено действие (фраза "${phrase}"): ${this.commandMappings[phrase]}`);
        return this.commandMappings[phrase];
      }
    }

    // 2. Отдельные слова
    const words = command.split(/\s+/);
    console.log(`📝 Слова в команде: ${words.join(', ')}`);

    for (const word of words) {
      if (this.commandMappings[word]) {
        console.log(`  ✅ Найдено действие: ${this.commandMappings[word]}`);
        return this.commandMappings[word];
      }
    }

    console.log(`  ❌ Действие не найдено`);
    return null;
  }

  /**
   * Вспомогательный метод: проверяет, есть ли в команде имя поверхности + предлог.
   * Пример: "joga a maçã na mesa" → есть "mesa" + "na" → true
   */
  _commandHasSurface(command) {
    const gs = window.getGameState?.();
    if (!gs) return false;
    for (const obj of gs.world?.mapObjects || []) {
      if (!obj.isSurface) continue;
      const name = window.getText?.(`objects.object_${obj.objectId}`, 'pt')?.toLowerCase();
      if (!name) continue;
      if (!command.includes(name)) continue;
      // Surface name found — check at least one preposition near it
      if (/\bna\b|\bno\b|\bsobre\b|\bem\b/.test(command)) return true;
    }
    return false;
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
      case 'use_item': {
        const itemName = this.extractItemNameFromCommand(command);
        if (!itemName) { console.log(`  ❌ Предмет не найден в команде`); return false; }
        params.itemId = itemName;
        console.log(`  → itemId: ${params.itemId}`);
        break;
      }

      case 'drop_item': {
        // Имя предмета необязательно — если не указан, бросаем первый из инвентаря
        const dropItem = this.extractItemNameFromCommand(command)
          || gameState.player.inventory[0];
        if (!dropItem) { console.log(`  ❌ Инвентарь пуст`); return false; }
        params.itemId = dropItem;
        console.log(`  → drop itemId: ${params.itemId}`);
        break;
      }

      case 'put_on_surface': {
        const putItem = this.extractItemNameFromCommand(command)
          || gameState.player.inventory[0];
        const surfaceId = this.extractSurfaceFromCommand(command);
        if (!putItem) { console.log(`  ❌ Предмет не указан`); return false; }
        params.itemId = putItem;
        params.surfaceId = surfaceId;
        console.log(`  → put itemId: ${params.itemId}, surface: ${params.surfaceId}`);
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
   * Найти название предмета в команде (точное совпадение!)
   */
  extractItemNameFromCommand(command) {
    const itemsData = window.itemsData?.items || [];
    const commandLower = command.toLowerCase().trim();
    const words = commandLower.split(/\s+/);
    
    console.log(`🔎 Ищу предмет в команде "${command}"`);

    // Для каждого предмета - проверяем точное совпадение
    for (const item of itemsData) {
      try {
        const itemName = window.getText?.(`items.${item.name}`, 'pt-br');
        
        if (itemName) {
          const itemNameLower = itemName.toLowerCase();
          
          // Проверяем ТОЧНОЕ совпадение каждого слова в команде
          for (const word of words) {
            // Точное совпадение слова или начинается с него (для множественного числа)
            if (word === itemNameLower || itemNameLower.startsWith(word)) {
              console.log(`  ✓ НАЙДЕН (точное): "${itemName}" → ${item.id}`);
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
   * Найти поверхность (isSurface: true) по названию в команде
   * Возвращает id объекта или null
   */
  extractSurfaceFromCommand(command) {
    const gameState = window.getGameState?.();
    if (!gameState) return null;
    const cmd = command.toLowerCase();
    for (const obj of gameState.world.mapObjects || []) {
      if (!obj.isSurface) continue;
      const name = window.getText?.(`objects.object_${obj.objectId}`, 'pt') || '';
      if (name && cmd.includes(name.toLowerCase())) return obj.id;
    }
    return null;
  }

  /**
   * ДЕЙСТВИЕ: Выбросить предмет на ближайшую свободную клетку
   * Можно выбрасывать подряд много предметов — каждый занимает свою клетку
   */
  action_dropItem(params) {
    const gameState = window.getGameState?.();
    if (!gameState || !params.itemId) return false;

    if (!gameState.player.inventory.includes(params.itemId)) {
      console.log(`❌ Предмет "${params.itemId}" не в инвентаре`);
      return false;
    }

    // Ищем ближайшую свободную клетку (исключая все предметы уже на полу)
    const cell = window.pathfindingSystem?.findNearestFreeCell(
      gameState.player.x, gameState.player.y, gameState
    );
    if (!cell) {
      console.log(`❌ Нет свободной клетки рядом`);
      return false;
    }

    // Удаляем из инвентаря
    window.inventorySystem?.removeItem(params.itemId);

    // Добавляем на пол — читаем АКТУАЛЬНЫЙ state после removeItem
    const freshState = window.getGameState?.();
    const newObj = {
      id: `obj_${params.itemId}_d${Date.now()}`,
      itemId: params.itemId,
      x: cell.x,
      y: cell.y,
      taken: false
    };
    const updatedObjects = [...(freshState.world.objects || []), newObj];
    window.updateGameState?.({ world: { objects: updatedObjects } });

    console.log(`✅ Выброшен "${params.itemId}" → клетка (${cell.gx},${cell.gy})`);
    window.eventSystem?.emit('item:dropped', { itemId: params.itemId, x: cell.x, y: cell.y });
    return true;
  }

  /**
   * ДЕЙСТВИЕ: Положить предмет на поверхность
   * Слоты = (ширина/20) × (высота/20) — вычисляется из размера объекта
   */
  action_putOnSurface(params) {
    const gameState = window.getGameState?.();
    if (!gameState || !params.itemId) return false;

    if (!gameState.player.inventory.includes(params.itemId)) {
      console.log(`❌ "${params.itemId}" не в инвентаре`);
      return false;
    }

    // Находим нужную поверхность или ближайшую
    let surface = null;
    if (params.surfaceId) {
      surface = gameState.world.mapObjects?.find(o => o.id === params.surfaceId && o.isSurface);
    }
    if (!surface) {
      let minDist = Infinity;
      for (const obj of gameState.world.mapObjects || []) {
        if (!obj.isSurface) continue;
        const d = Math.hypot(gameState.player.x - obj.x, gameState.player.y - obj.y);
        if (d < minDist) { minDist = d; surface = obj; }
      }
    }
    if (!surface) {
      console.log(`❌ Поверхностей на карте нет`);
      return false;
    }

    // Проверяем слоты
    const CELL = 20;
    const slots = Math.round(surface.width / CELL) * Math.round(surface.height / CELL);
    const currentItems = gameState.world.surfaceItems?.[surface.id] || [];
    if (currentItems.length >= slots) {
      const msg = window.ptTexts?.voice?.surface_full || 'Não consigo colocar mais aqui!';
      console.log(`❌ Поверхность "${surface.objectId}" заполнена (${slots} слотов)`);
      window.eventSystem?.emit('ui:message', { text: msg, lang: 'pt' });
      return false;
    }

    // Нужно подойти?
    const dist = Math.hypot(gameState.player.x - surface.x, gameState.player.y - surface.y);
    if (dist > 80) {
      console.log(`🚶 Идём к поверхности "${surface.objectId}"`);
      if (!window.pathfindingSystem) return false;
      const path = window.pathfindingSystem.findPath(
        gameState.player.x, gameState.player.y,
        surface.x, surface.y, gameState
      );
      if (!path) { console.log(`❌ Путь к поверхности не найден`); return false; }
      window.updateGameState?.({
        player: {
          pathWaypoints: path, currentWaypoint: 0, isMoving: true,
          targetX: null, targetY: null,
          _pendingPutOnSurface: { itemId: params.itemId, surfaceId: surface.id }
        }
      });
      return true;
    }

    return this._doPlaceOnSurface(params.itemId, surface.id);
  }

  /**
   * Фактически кладём предмет на поверхность (вызывается после подхода)
   */
  _doPlaceOnSurface(itemId, surfaceId) {
    const gs = window.getGameState?.();
    if (!gs) return false;
    const surface = gs.world.mapObjects?.find(o => o.id === surfaceId);
    if (!surface) return false;

    const CELL = 20;
    const slots = Math.round(surface.width / CELL) * Math.round(surface.height / CELL);
    const current = gs.world.surfaceItems?.[surfaceId] || [];
    if (current.length >= slots) {
      const msg = window.ptTexts?.voice?.surface_full || 'Não consigo colocar mais aqui!';
      window.eventSystem?.emit('ui:message', { text: msg, lang: 'pt' });
      return false;
    }

    window.inventorySystem?.removeItem(itemId);
    const updated = { ...gs.world.surfaceItems, [surfaceId]: [...current, itemId] };
    window.updateGameState?.({ world: { surfaceItems: updated } });

    console.log(`✅ Положил "${itemId}" на "${surface.objectId}" (слот ${current.length + 1}/${slots})`);
    window.eventSystem?.emit('item:placed_on_surface', { itemId, surfaceId });
    return true;
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

    // Идём к цели через pathfinding — не сквозь стены
    const target = item || mapObj;

    if (window.pathfindingSystem) {
      const path = window.pathfindingSystem.findPath(
        gameState.player.x, gameState.player.y,
        target.x, target.y,
        gameState
      );
      if (!path) {
        console.log(`❌ Путь к "${params.targetId}" не найден — цель недостижима`);
        return false;
      }
      window.updateGameState?.({
        player: {
          pathWaypoints: path,
          currentWaypoint: 0,
          isMoving: true,
          targetX: null,
          targetY: null
        }
      });
    } else {
      // pathfinding не загружен — прямое движение как крайний fallback
      window.updateGameState?.({
        player: { targetX: target.x, targetY: target.y, isMoving: true }
      });
    }

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
      // 🚶 Если далеко - отправляем персонажа туда
      console.log(`🚶 Ты далеко! Идёшь к двери (расстояние: ${distance.toFixed(0)}px)`);
      
      // Использовать grid-based pathfinding если доступен
      if (window.pathfindingSystem) {
        const path = window.pathfindingSystem.findPath(
          gameState.player.x, gameState.player.y,
          door.x, door.y,
          gameState
        );
        console.log(`  📍 Путь к двери: ${path?.length || 0} контрольных точек`);
        
        if (!path) {
          console.log(`  ❌ Путь к двери не найден — недостижима`);
          return false;
        }
        window.updateGameState?.({
          player: {
            pathWaypoints: path,
            currentWaypoint: 0,
            isMoving: true,
            _pendingDoorOpen: true,
            targetX: null,
            targetY: null
          }
        });
      } else {
        // pathfinding не загружен — крайний fallback
        window.updateGameState?.({
          player: { targetX: door.x, targetY: door.y, isMoving: true, _pendingDoorOpen: true }
        });
      }
      return true;
    }

    console.log(`✅ Ты открыл дверь!`);
    
    // Сохранить состояние двери в мире
    window.updateGameState?.({
      world: {
        flags: {
          ...gameState.world.flags,
          door_open: true
        }
      }
    });
    
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
        case 'put_on_surface':
          success = this.action_putOnSurface(params);
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
      
      // Использовать grid-based pathfinding если доступен
      if (window.pathfindingSystem) {
        // excludeItemId: целевой предмет НЕ блокирует путь к себе
        const path = window.pathfindingSystem.findPath(
          playerX, playerY,
          obj.x, obj.y,
          gameState,
          params.itemId
        );
        console.log(`  📍 Путь: ${path?.length || 0} контрольных точек`);
        
        if (!path) {
          console.log(`  ❌ Путь к "${params.itemId}" не найден — недостижим`);
          return false;
        }
        window.updateGameState?.({
          player: {
            pathWaypoints: path,
            currentWaypoint: 0,
            isMoving: true,
            _pendingItemPickup: params.itemId,
            targetX: null,
            targetY: null
          }
        });
      } else {
        // pathfinding не загружен — крайний fallback
        window.updateGameState?.({
          player: { targetX: obj.x, targetY: obj.y, isMoving: true, _pendingItemPickup: params.itemId }
        });
      }
      
      return true; // Успех - начали движение
    }

    // 3️⃣ Если близко - берём сразу
    console.log(`✓ Близко! Берём предмет: ${params.itemId}`);

    // Добавить в инвентарь
    const addResult = window.inventorySystem?.addItem(params.itemId);
    console.log(`  Добавление в инвентарь: ${addResult}`);

    // БЕЗОПАСНОЕ: Создаём новый массив без мутации
    const updatedObjects = gameState.world.objects.map(o => {
      if (o.itemId === params.itemId && !o.taken) {
        return { ...o, taken: true };  // Создаём новый объект с taken: true
      }
      return o;
    });
    
    // Обновляем state через безопасный API
    window.updateGameState?.({ world: { objects: updatedObjects } });

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
   * ДЕЙСТВИЕ: Двигаться на 4 клетки в заданном направлении
   * Использует pathfinding — огибает препятствия
   */
  action_move(direction) {
    const gameState = window.getGameState?.();
    if (!gameState) return false;

    if (!direction) return false;

    const GRID_SIZE = 20;  // px на клетку
    const CELLS = 4;       // шагов
    const dist = GRID_SIZE * CELLS; // 80px

    const W = window.gameConfig?.canvas?.width || 800;
    const H = window.gameConfig?.canvas?.height || 600;
    const px = gameState.player.x;
    const py = gameState.player.y;

    let targetX = px;
    let targetY = py;
    let faceDir = gameState.player.direction || 'right';

    switch (direction) {
      case 'left':  targetX = px - dist; faceDir = 'left';  break;
      case 'right': targetX = px + dist; faceDir = 'right'; break;
      case 'up':    targetY = py - dist; break;
      case 'down':  targetY = py + dist; break;
      default: return false;
    }

    // Зажимаем в границах канваса (отступ 10px со всех сторон)
    targetX = Math.max(10, Math.min(W - 10, targetX));
    targetY = Math.max(10, Math.min(H - 10, targetY));

    console.log(`🚶 action_move: ${direction} → (${targetX},${targetY})`);

    if (window.pathfindingSystem) {
      const path = window.pathfindingSystem.findPath(px, py, targetX, targetY, gameState);

      if (path && path.length > 0) {
        window.updateGameState?.({
          player: {
            pathWaypoints: path,
            currentWaypoint: 0,
            isMoving: true,
            direction: faceDir,
            targetX: null,
            targetY: null
          }
        });
        console.log(`✅ Движение ${direction}: путь из ${path.length} точек`);
        return true;
      }
    }

    // Fallback без pathfinding
    window.updateGameState?.({
      player: { targetX, targetY, isMoving: true, direction: faceDir }
    });
    console.log(`✅ Движение ${direction} (прямое)`);
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
