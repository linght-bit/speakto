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
        window.foxSystem?.onNoAction(normalized);
        window.eventSystem?.emit('action:notFound', { command: normalized });
        return false;
      }

      // Извлечь параметры команды
      const params = this.extractParameters(normalized, actionId);

      // Лисёнок проверяет достаточность параметров — может заблокировать выполнение
      if (window.foxSystem && window.foxSystem.evaluate(normalized, actionId, params) === false) {
        return false;
      }

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
    // 0a. PRE-CHECK: "открыть контейнер" — есть глагол открытия + название сундука
    if (this._commandIsOpenContainer(command)) {
      console.log(`📝 Найдено действие (контейнер в команде): open_container`);
      return 'open_container';
    }

    // 0b. PRE-CHECK: "положить в/на поверхность"
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
    // Требуем явный глагол укладки — иначе "amassau na bau" без глагола триггерит случайно
    const hasPutVerb = /\bcoloca\b|\bcolocar\b|\bpõe\b|\bpoe\b|\bpor\b|\bpôr\b|\bdeixa\b|\bdeixar\b|\bbotar\b|\bmeter\b/.test(command);
    if (!hasPutVerb) return false;
    for (const obj of gs.world?.mapObjects || []) {
      if (!obj.isSurface) continue;
      const name = window.getText?.(`objects.object_${obj.objectId}`, 'pt')?.toLowerCase();
      if (!name) continue;
      // Проверяем полное имя или любое значимое слово из него (>2 символов)
      const matched = name === command ? true :
        name.split(' ').some(part => part.length > 2 && command.includes(part));
      if (!matched) continue;
      // Surface name found — check at least one preposition near it
      if (/\bna\b|\bno\b|\bsobre\b|\bem\b|\bdentro\b/.test(command)) return true;
    }
    return false;
  }

  /**
   * Проверяет, есть ли в команде ГЛАГОЛ ОТКРЫТИЯ + название контейнера.
   * "abre o baú vermelho" → true,  "joga a maçã no baú" → false
   */
  _commandIsOpenContainer(command) {
    const gs = window.getGameState?.();
    if (!gs) return false;
    const hasOpenVerb = /\babrir\b|\babre\b|\babra\b|\bopen\b/.test(command);
    if (!hasOpenVerb) return false;
    for (const obj of gs.world?.mapObjects || []) {
      if (!obj.isContainer) continue;
      const name = window.getText?.(`objects.object_${obj.objectId}`, 'pt')?.toLowerCase();
      if (!name) continue;
      const matched = name.split(' ').some(part => part.length > 2 && command.includes(part));
      if (matched) return true;
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
        const putItem = this.extractItemNameFromCommand(command);
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

      case 'open_door':
      case 'close_door': {
        // Ищем дверь по имени — самые длинные имена первыми ("Porta Trancada" > "Porta")
        const gsDoor = window.getGameState?.();
        const doorCandidates = [];
        for (const obj of gsDoor?.world?.mapObjects || []) {
          if (obj.objectId !== 'door' && obj.objectId !== 'door_locked') continue;
          const dname = window.getText?.(`objects.object_${obj.objectId}`, 'pt')?.toLowerCase();
          if (dname) doorCandidates.push({ id: obj.id, name: dname });
        }
        doorCandidates.sort((a, b) => b.name.length - a.name.length);
        let doorId = null;
        const cmdLower = command.toLowerCase();
        for (const d of doorCandidates) {
          if (cmdLower.includes(d.name)) { doorId = d.id; break; }
        }
        if (!doorId) {
          // Слово-совпадение (≥5 символов, чтобы не путать "porta" с другим)
          for (const d of doorCandidates) {
            for (const part of d.name.split(/\s+/)) {
              if (part.length >= 5 && cmdLower.includes(part)) { doorId = d.id; break; }
            }
            if (doorId) break;
          }
        }
        params.doorId = doorId; // null = найдём ближайшую
        break;
      }

      case 'open_container': {
        params.containerId = this.extractContainerFromCommand(command);
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
   * Найти название предмета в команде.
   * Сортируем по длине имени (самые длинные первыми) — "Chave Vermelha" побеждает "Chave".
   */
  extractItemNameFromCommand(command) {
    const itemsData = window.itemsData?.items || [];
    const cmd = command.toLowerCase().trim();

    console.log(`🔎 Ищу предмет в команде "${command}"`);

    // Строим кандидатов: id + имя на PT, сортируем по длине имени (длинные первыми)
    const candidates = [];
    for (const item of itemsData) {
      const lookupKey = `items.${item.name}`;
      const name = window.getText?.(lookupKey, 'pt-br');
      // Если getText вернул сам ключ — перевод не найден, пропускаем
      if (name && name !== lookupKey) candidates.push({ id: item.id, name: name.toLowerCase() });
    }
    candidates.sort((a, b) => b.name.length - a.name.length);
    console.log(`  📋 Кандидаты: ${candidates.map(c => `"${c.name}"→${c.id}`).join(', ')}`);

    // 1. Полное совпадение фразы
    for (const c of candidates) {
      if (cmd.includes(c.name)) {
        console.log(`  ✓ НАЙДЕН (фраза): "${c.name}" → ${c.id}`);
        return c.id;
      }
    }

    // 2. Любое значимое слово из имени предмета (≥3 символов)
    const cmdWords = cmd.split(/\s+/);
    for (const c of candidates) {
      for (const namePart of c.name.split(/\s+/)) {
        if (namePart.length < 3) continue;
        for (const cmdWord of cmdWords) {
          if (cmdWord === namePart || namePart.startsWith(cmdWord) || cmdWord.startsWith(namePart)) {
            console.log(`  ✓ НАЙДЕН (слово "${cmdWord}"): "${c.name}" → ${c.id}`);
            return c.id;
          }
        }
      }
    }

    console.log(`  ✗ Предмет не найден в "${command}"`);
    return null;
  }

  /**
   * Найти цель (предмет или объект) по имени в команде.
   * Самые длинные имена проверяются первыми — "Porta Trancada" побеждает "Porta".
   */
  extractTargetNameFromCommand(command) {
    const itemsData = window.itemsData?.items || [];
    const objectsData = window.mapObjectsData?.objects || [];
    const cmd = command.toLowerCase();

    // Строим всех кандидатов: предметы + объекты карты, сортируем по длине (длинные первыми)
    const candidates = [];
    for (const item of itemsData) {
      const k = `items.${item.name}`;
      const name = window.getText?.(k, 'pt-br')?.toLowerCase();
      if (name && name !== k.toLowerCase()) candidates.push({ id: item.id, name });
    }
    for (const obj of objectsData) {
      const k = `objects.object_${obj.objectId}`;
      const name = window.getText?.(k, 'pt-br')?.toLowerCase();
      if (name && name !== k.toLowerCase()) candidates.push({ id: obj.objectId, name });
    }
    candidates.sort((a, b) => b.name.length - a.name.length);

    // 1. Полное совпадение фразы
    for (const c of candidates) {
      if (cmd.includes(c.name)) return c.id;
    }

    // 2. Любое значимое слово (≥3 символов)
    for (const c of candidates) {
      for (const part of c.name.split(/\s+/)) {
        if (part.length >= 3 && cmd.includes(part)) return c.id;
      }
    }

    return null;
  }

  /**
   * Найти поверхность/ёмкость по имени в команде.
   * Самые длинные имена первыми — "Baú Vermelho" побеждает "Baú".
   */
  extractSurfaceFromCommand(command) {
    const gameState = window.getGameState?.();
    if (!gameState) return null;
    const cmd = command.toLowerCase();

    const candidates = [];
    for (const obj of gameState.world.mapObjects || []) {
      if (!obj.isSurface) continue;
      const name = window.getText?.(`objects.object_${obj.objectId}`, 'pt')?.toLowerCase();
      if (name) candidates.push({ id: obj.id, name });
    }
    candidates.sort((a, b) => b.name.length - a.name.length);

    // 1. Полная фраза
    for (const c of candidates) {
      if (cmd.includes(c.name)) return c.id;
    }
    // 2. Любое значимое слово (≥3 символов)
    for (const c of candidates) {
      for (const part of c.name.split(/\s+/)) {
        if (part.length >= 3 && cmd.includes(part)) return c.id;
      }
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

    // Если контейнер — должен быть открыт
    if (surface.isContainer) {
      if (gameState.world.containerStates?.[surface.id] !== 'open') {
        const msg = window.ptTexts?.voice?.container_closed || 'Está fechado!';
        window.eventSystem?.emit('ui:message', { text: msg, lang: 'pt' });
        return false;
      }
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

    // Если это контейнер — должен быть открыт
    if (surface.isContainer) {
      if (gs.world.containerStates?.[surfaceId] !== 'open') {
        const msg = window.ptTexts?.voice?.container_closed || 'Está fechado!';
        window.eventSystem?.emit('ui:message', { text: msg, lang: 'pt' });
        return false;
      }
    }

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
   * ДЕЙСТВИЕ: Открыть дверь (обычную или запертую)
   */
  action_openDoor(params) {
    const gameState = window.getGameState?.();
    if (!gameState) return false;

    // Найти нужную дверь (по ID из params или ближайшую)
    let door = null;
    if (params.doorId) {
      door = gameState.world.mapObjects?.find(o => o.id === params.doorId);
    }
    if (!door) {
      // Ближайшая дверь (любого типа)
      let minDist = Infinity;
      for (const obj of gameState.world.mapObjects || []) {
        if (obj.objectId !== 'door' && obj.objectId !== 'door_locked') continue;
        const d = Math.hypot(gameState.player.x - obj.x, gameState.player.y - obj.y);
        if (d < minDist) { minDist = d; door = obj; }
      }
    }
    if (!door) {
      console.log(`❌ Двери не найдено на карте`);
      return false;
    }

    // Проверяем расстояние
    const distance = Math.hypot(gameState.player.x - door.x, gameState.player.y - door.y);

    if (distance > 100) {
      console.log(`🚶 Далеко! Идёшь к двери "${door.objectId}" (${distance.toFixed(0)}px)`);
      if (window.pathfindingSystem) {
        const path = window.pathfindingSystem.findPath(
          gameState.player.x, gameState.player.y, door.x, door.y, gameState
        );
        if (!path) { console.log(`❌ Путь к двери не найден`); return false; }
        window.updateGameState?.({
          player: { pathWaypoints: path, currentWaypoint: 0, isMoving: true,
            _pendingDoorOpen: true, targetX: null, targetY: null }
        });
      } else {
        window.updateGameState?.({ player: { targetX: door.x, targetY: door.y, isMoving: true, _pendingDoorOpen: true } });
      }
      return true;
    }

    // Запертая дверь — нужен ключ
    if (door.isLocked) {
      if (!gameState.player.inventory.includes(door.lockKey)) {
        const msg = window.ptTexts?.voice?.door_locked_msg || 'A porta está trancada!';
        console.log(`❌ Нет ключа "${door.lockKey}" для двери`);
        window.eventSystem?.emit('ui:message', { text: msg, lang: 'pt' });
        return false;
      }
    }

    // Открываем — флаг по типу двери
    const flagKey = door.objectId === 'door' ? 'door_open' : 'door_locked_open';
    window.updateGameState?.({ world: { flags: { ...gameState.world.flags, [flagKey]: true } } });
    console.log(`✅ Открыл дверь "${door.objectId}"`);
    window.eventSystem?.emit('door:opened', { doorId: door.id });
    return true;
  }

  /**
   * ДЕЙСТВИЕ: Закрыть дверь
   */
  action_closeDoor(params) {
    const gameState = window.getGameState?.();
    if (!gameState) return false;

    let door = null;
    if (params.doorId) {
      door = gameState.world.mapObjects?.find(o => o.id === params.doorId);
    }
    if (!door) {
      let minDist = Infinity;
      for (const obj of gameState.world.mapObjects || []) {
        if (obj.objectId !== 'door' && obj.objectId !== 'door_locked') continue;
        const d = Math.hypot(gameState.player.x - obj.x, gameState.player.y - obj.y);
        if (d < minDist) { minDist = d; door = obj; }
      }
    }
    if (!door) return false;

    const flagKey = door.objectId === 'door' ? 'door_open' : 'door_locked_open';
    if (!gameState.world.flags?.[flagKey]) { console.log(`ℹ️ Дверь уже закрыта`); return true; }

    window.updateGameState?.({ world: { flags: { ...gameState.world.flags, [flagKey]: false } } });
    console.log(`✅ Закрыл дверь "${door.objectId}"`);
    window.eventSystem?.emit('door:closed', { doorId: door.id });
    return true;
  }

  /**
   * ДЕЙСТВИЕ: Открыть контейнер (сундук) — нужен подходящий ключ
   */
  action_openContainer(params) {
    const gameState = window.getGameState?.();
    if (!gameState) return false;

    // Найти контейнер
    let container = null;
    if (params.containerId) {
      container = gameState.world.mapObjects?.find(o => o.id === params.containerId && o.isContainer);
    }
    if (!container) {
      // Ближайший контейнер
      let minDist = Infinity;
      for (const obj of gameState.world.mapObjects || []) {
        if (!obj.isContainer) continue;
        const d = Math.hypot(gameState.player.x - obj.x, gameState.player.y - obj.y);
        if (d < minDist) { minDist = d; container = obj; }
      }
    }
    if (!container) { console.log(`❌ Контейнеров нет на карте`); return false; }

    // Уже открыт?
    if (gameState.world.containerStates?.[container.id] === 'open') {
      console.log(`ℹ️ Контейнер "${container.objectId}" уже открыт`);
      return true;
    }

    // Проверяем ключ
    if (container.containerKey && !gameState.player.inventory.includes(container.containerKey)) {
      const msg = window.ptTexts?.voice?.no_key || 'Preciso de uma chave para abrir!';
      console.log(`❌ Нет ключа "${container.containerKey}"`);
      window.eventSystem?.emit('ui:message', { text: msg, lang: 'pt' });
      return false;
    }

    // Подойти если далеко
    const dist = Math.hypot(gameState.player.x - container.x, gameState.player.y - container.y);
    if (dist > 80) {
      if (!window.pathfindingSystem) return false;
      const path = window.pathfindingSystem.findPath(
        gameState.player.x, gameState.player.y, container.x, container.y, gameState
      );
      if (!path) { console.log(`❌ Путь к контейнеру не найден`); return false; }
      window.updateGameState?.({
        player: { pathWaypoints: path, currentWaypoint: 0, isMoving: true,
          targetX: null, targetY: null,
          _pendingOpenContainer: { containerId: container.id } }
      });
      return true;
    }

    return this._doOpenContainer(container.id);
  }

  /**
   * Фактически открываем контейнер (вызывается после подхода)
   */
  _doOpenContainer(containerId) {
    const gs = window.getGameState?.();
    if (!gs) return false;
    const container = gs.world.mapObjects?.find(o => o.id === containerId);
    if (!container) return false;

    // Повторная проверка ключа
    if (container.containerKey && !gs.player.inventory.includes(container.containerKey)) {
      const msg = window.ptTexts?.voice?.no_key || 'Preciso de uma chave para abrir!';
      window.eventSystem?.emit('ui:message', { text: msg, lang: 'pt' });
      return false;
    }

    const updated = { ...gs.world.containerStates, [containerId]: 'open' };
    window.updateGameState?.({ world: { containerStates: updated } });
    console.log(`✅ Открыл контейнер "${container.objectId}"`);
    window.eventSystem?.emit('container:opened', { containerId });
    return true;
  }

  /**
   * Взять предмет из открытой емкости (контейнер или обычная поверхность)
   */
  _tryTakeFromContainer(itemId, gameState) {
    const surfaceItems = gameState.world.surfaceItems || {};
    for (const [containerId, items] of Object.entries(surfaceItems)) {
      if (!items.includes(itemId)) continue;

      const container = gameState.world.mapObjects?.find(o => o.id === containerId);
      // Не-контейнеры (стол, колодец) всегда открыты
      const isAlwaysOpen = !container?.isContainer;
      const isOpen = isAlwaysOpen || (gameState.world.containerStates?.[containerId] === 'open');

      if (!isOpen) {
        const msg = window.ptTexts?.voice?.container_closed || 'Está fechado!';
        window.eventSystem?.emit('ui:message', { text: msg, lang: 'pt' });
        console.log(`❌ Контейнер "${containerId}" закрыт`);
        return false;
      }

      // Подойти если далеко
      if (container) {
        const dist = Math.hypot(gameState.player.x - container.x, gameState.player.y - container.y);
        if (dist > 80) {
          if (!window.pathfindingSystem) return false;
          const path = window.pathfindingSystem.findPath(
            gameState.player.x, gameState.player.y, container.x, container.y, gameState
          );
          if (!path) { console.log(`❌ Путь к "${containerId}" не найден`); return false; }
          window.updateGameState?.({
            player: { pathWaypoints: path, currentWaypoint: 0, isMoving: true,
              targetX: null, targetY: null,
              _pendingTakeFromContainer: { itemId, containerId } }
          });
          return true;
        }
      }

      return this._doTakeFromContainer(itemId, containerId);
    }

    console.log(`✗ "${itemId}" не найден ни на полу, ни в открытых емкостях`);
    return false;
  }

  /**
   * Фактически берём предмет из контейнера/поверхности
   */
  _doTakeFromContainer(itemId, containerId) {
    const gs = window.getGameState?.();
    if (!gs) return false;
    const items = gs.world.surfaceItems?.[containerId] || [];
    const idx = items.indexOf(itemId);
    if (idx === -1) return false;

    window.inventorySystem?.addItem(itemId);
    const newItems = items.filter((_, i) => i !== idx);
    window.updateGameState?.({ world: { surfaceItems: { ...gs.world.surfaceItems, [containerId]: newItems } } });
    console.log(`✅ Взял "${itemId}" из "${containerId}"`);
    window.eventSystem?.emit('item:taken', { itemId });
    return true;
  }

  /**
   * Найти контейнер по названию в команде.
   * Самые длинные имена первыми — "Baú Verde" побеждает "Baú".
   */
  extractContainerFromCommand(command) {
    const gs = window.getGameState?.();
    if (!gs) return null;
    const cmd = command.toLowerCase();

    const candidates = [];
    for (const obj of gs.world.mapObjects || []) {
      if (!obj.isContainer) continue;
      const name = window.getText?.(`objects.object_${obj.objectId}`, 'pt')?.toLowerCase();
      if (name) candidates.push({ id: obj.id, name });
    }
    candidates.sort((a, b) => b.name.length - a.name.length);

    // 1. Полная фраза
    for (const c of candidates) {
      if (cmd.includes(c.name)) return c.id;
    }
    // 2. Любое значимое слово (≥3 символов)
    for (const c of candidates) {
      for (const part of c.name.split(/\s+/)) {
        if (part.length >= 3 && cmd.includes(part)) return c.id;
      }
    }
    // Один контейнер на карте — вернуть его
    const containers = (gs.world.mapObjects || []).filter(o => o.isContainer);
    return containers.length === 1 ? containers[0].id : null;
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
        case 'open_container':
          success = this.action_openContainer(params);
          break;
        case 'close_door':
          success = this.action_closeDoor(params);
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
      console.log(`✗ Предмет "${params.itemId}" не найден на земле, ищу в открытых емкостях`);
      return this._tryTakeFromContainer(params.itemId, gameState);
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
