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
    this.lastFailure = null;
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

    } catch (error) {
      console.error(error);
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
  }

  /**
   * Обработать распознанную команду
   * @param {string} command - распознанная команда
   */
  processCommand(command) {
    try {
      const normalized = command.toLowerCase().trim();

      // Найти соответствующее действие
      const actionId = this.findActionId(normalized);
      if (!actionId) {
        window.foxSystem?.onNoAction(normalized);
        window.eventSystem?.emit('action:notFound', { command: normalized });
        return false;
      }

      // Извлечь параметры команды
      const params = this.extractParameters(normalized, actionId);
      if (params === false) {
        // Формула: ищем первый токен, который не является глаголом/стоп-словом/именем параметра.
        // Такой токен — это то «непонятное слово», о котором должен сообщить лисёнок.
        if (!this.lastFailure) {
          const badToken = this._findBadToken(normalized, actionId, {});
          this._setFailure(
            badToken ? 'unknown_word' : 'missing_params',
            badToken ? { word: badToken } : { actionId, command: normalized }
          );
        }
        const badToken = this.lastFailure?.code === 'unknown_word' ? this.lastFailure.meta?.word : null;
        window.foxSystem?.onActionFailed?.(actionId, {}, this.lastFailure);
        window.eventSystem?.emit('action:failed', {
          actionId, params: {}, failureCode: this.lastFailure?.code || 'missing_params', badToken,
        });
        return false;
      }

      // Лисёнок проверяет достаточность параметров — может заблокировать выполнение
      if (window.foxSystem && window.foxSystem.evaluate(normalized, actionId, params) === false) {
        return false;
      }

      // Проверяем «посторонние» токены — слова, не покрытые глаголом, параметрами или стоп-словами.
      // Формула: consumed = verbWords(actionId) ∪ paramNameWords ∪ stopWords
      //          badToken = первое слово ≥3 символов вне consumed.
      // Это универсальная проверка, не зависящая от конкретного действия.
      const badToken = this._findBadToken(normalized, actionId, params);
      if (badToken) {
        this._setFailure('unknown_word', { word: badToken });
        window.foxSystem?.onActionFailed?.(actionId, params, this.lastFailure);
        window.eventSystem?.emit('action:failed', {
          actionId, params, failureCode: 'unknown_word', badToken,
        });
        return false;
      }

      // Выполнить действие
      return this.executeAction(actionId, params);
    } catch (error) {
      console.error(error);
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
      return 'open_container';
    }

    // 0b. PRE-CHECK: "положить в/на поверхность"
    if (this._commandHasSurface(command)) {
      return 'put_on_surface';
    }

    // 0c. PRE-CHECK: approach_to — требует хотя бы одно существительное-цель.
    //     Без этого "vai parar mesmo" / "vai" в одиночку не должны триггерить.
    //     Если есть неопознанный токен — лисёнок называет его конкретно.
    if (this._commandHasApproachVerb(command) && !this._commandHasApproachTarget(command)) {
      const badToken = this._findBadToken(command, 'approach_to', {});
      if (badToken) {
        this._setFailure('unknown_word', { word: badToken });
        window.foxSystem?.onActionFailed?.('approach_to', {}, this.lastFailure);
        window.eventSystem?.emit('action:failed', {
          actionId: 'approach_to', params: {}, failureCode: 'unknown_word', badToken,
        });
      } else {
        window.foxSystem?.onNoAction?.(command);
        window.eventSystem?.emit('action:notFound', { command });
      }
      return null;
    }

    // 1. Многословные фразы — длинные первыми, чтобы более специфичные побеждали
    const phrases = Object.keys(this.commandMappings)
      .filter(k => k.includes(' '))
      .sort((a, b) => b.length - a.length);

    for (const phrase of phrases) {
      if (command.includes(phrase)) {
        return this.commandMappings[phrase];
      }
    }

    // 2. Отдельные слова
    const words = command.split(/\s+/);

    for (const word of words) {
      if (this.commandMappings[word]) {
        return this.commandMappings[word];
      }
    }

    return null;
  }

  /**
   * Нормализует токен: нижний регистр, убирает диакритику и пунктуацию.
   * Используется в _findBadToken для единообразного сравнения слов.
   */
  _normTok(word) {
    return (word || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Универсальная формула поиска «постороннего» токена в команде.
   *
   * Принцип: consumed = verbWords(actionId) ∪ paramNameWords ∪ stopWords
   *          badToken = первое слово ≥3 символов, не входящее в consumed
   *
   * Работает для ЛЮБОГО действия без перечисления правил вручную:
   * - verbWords строятся из commandMappings для данного actionId
   * - paramNameWords — из переведённых имён успешно извлечённых параметров
   * - stopWords — португальские предлоги, артикли, союзы
   *
   * @param {string} command
   * @param {string} actionId
   * @param {object} params - уже извлечённые параметры (могут быть пустым {})
   * @returns {string|null} оригинальный bad-токен или null
   */
  _findBadToken(command, actionId, params) {
    // 1. Стоп-слова: артикли, предлоги, союзы португальского языка
    const STOP = new Set([
      'o','a','os','as','um','uma','de','do','da','dos','das',
      'no','na','nos','nas','ao','aos','em','por','para','com',
      'que','se','ou','mas','nem','todo','tudo','este','esta',
    ]);

    // 2. Слова-глаголы: все синонимы из commandMappings, соответствующие actionId
    const verbWords = new Set();
    for (const [phrase, id] of Object.entries(this.commandMappings)) {
      if (id === actionId) {
        phrase.toLowerCase().split(/\s+/).forEach(w => {
          const n = this._normTok(w);
          if (n.length >= 2) verbWords.add(n);
        });
      }
    }

    // 3. Слова из имён разрешённых параметров (item/container/surface/door/target)
    const paramWords = new Set();
    const addName = (key, lang = 'pt') => {
      const name = window.getText?.(key, lang);
      if (!name || name === key) return;
      name.toLowerCase().split(/\s+/).forEach(w => {
        const n = this._normTok(w);
        if (n.length >= 2) paramWords.add(n);
      });
    };
    if (params.itemId)     addName(`items.item_${params.itemId}`);
    if (params.containerId) {
      const obj = window.getGameState?.()?.world?.mapObjects?.find(o => o.id === params.containerId);
      if (obj) addName(`objects.object_${obj.objectId}`);
    }
    if (params.surfaceId) {
      const obj = window.getGameState?.()?.world?.mapObjects?.find(o => o.id === params.surfaceId);
      if (obj) addName(`objects.object_${obj.objectId}`);
    }
    if (params.doorId) {
      const obj = window.getGameState?.()?.world?.mapObjects?.find(o => o.id === params.doorId);
      if (obj) addName(`objects.object_${obj.objectId}`);
    }
    if (params.targetId) {
      addName(`items.item_${params.targetId}`);
      const obj = window.getGameState?.()?.world?.mapObjects?.find(o => o.id === params.targetId);
      if (obj) addName(`objects.object_${obj.objectId}`);
    }

    // 4. Проходим по токенам команды и ищем первый «лишний»
    for (const raw of command.split(/\s+/)) {
      const tok = this._normTok(raw);
      // Пустые токены — пропускаем
      if (tok.length === 0) continue;
      // Короткие алфа-токены — предлоги/артикли, пропускаем
      if (tok.length < 3 && /^[a-z]+$/.test(tok)) continue;
      // Любой не-алфа-токен (цифра, спецсимвол) любой длины — проверяем
      if (STOP.has(tok)) continue;
      if (verbWords.has(tok)) continue;
      if (paramWords.has(tok)) continue;
      // Частичное совпадение: «parar» ⊃ «para», «chaves» ⊃ «chave»
      let partial = false;
      for (const kw of verbWords) { if (kw.startsWith(tok) || tok.startsWith(kw)) { partial = true; break; } }
      if (!partial) {
        for (const kw of paramWords) { if (kw.startsWith(tok) || tok.startsWith(kw)) { partial = true; break; } }
      }
      if (partial) continue;
      return raw.toLowerCase(); // ← посторонний токен найден
    }
    return null;
  }

  /**
   * Есть ли в команде глагол подхода (vai/ir/aproximar...) без направления?
   */
  _commandHasApproachVerb(command) {
    // направления — не approach
    if (/\b(esquerda|direita|cima|baixo|left|right|up|down)\b/.test(command)) return false;
    return /\b(vai|vir|ir|aproxima|aproximar|perto|go|approach|passa[rn]|passar)\b/.test(command);
  }

  /**
   * Есть ли в команде слово-цель из предметов/объектов карты?
   */
  _commandHasApproachTarget(command) {
    const gs = window.getGameState?.();
    if (!gs) return false;
    const itemsData = window.itemsData?.items || [];
    // Проверяем предметы
    for (const item of itemsData) {
      const name = window.getText?.(`items.${item.name}`, 'pt')?.toLowerCase();
      if (name && this._nameAnyWordMatch(command, name)) return true;
    }
    // Проверяем объекты карты
    for (const obj of gs.world?.mapObjects || []) {
      const name = window.getText?.(`objects.object_${obj.objectId}`, 'pt')?.toLowerCase();
      if (name && this._nameAnyWordMatch(command, name)) return true;
    }
    return false;
  }

  /**
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
      const matched = this._nameAllWordsMatch(command, name) || this._nameAnyWordMatch(command, name);
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
      const matched = this._nameAllWordsMatch(command, name) || this._nameAnyWordMatch(command, name);
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

    switch (actionId) {
      case 'take_item':
      case 'use_item': {
        const itemName = this.extractItemNameFromCommand(command);
        if (!itemName) return false;
        params.itemId = itemName;
        break;
      }

      case 'drop_item': {
        // Имя предмета обязательно. Нет fallback на inventory[0]:
        // «жога 4» не должно выбрасывать первый предмет из инвентаря.
        // Если предмет не назван — лисёнок спросит «какой именно?».
        const dropItem = this.extractItemNameFromCommand(command);
        if (!dropItem) return false;
        params.itemId = dropItem;
        break;
      }

      case 'put_on_surface': {
        // Сначала находим поверхность, потом вырезаем её слова из команды,
        // чтобы «mesa» не попало как уточнение к имени предмета
        const surfaceId = this.extractSurfaceFromCommand(command);
        let cmdForItem = command;
        if (surfaceId) {
          const surfaceObj = gameState.world.mapObjects?.find(o => o.id === surfaceId && o.isSurface);
          if (surfaceObj) {
            const sname = window.getText?.(`objects.object_${surfaceObj.objectId}`, 'pt')?.toLowerCase() || '';
            for (const w of sname.split(/\s+/)) {
              if (w.length >= 2) {
                cmdForItem = cmdForItem.replace(new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'), ' ');
              }
            }
          }
        }
        const putItem = this.extractItemNameFromCommand(cmdForItem.trim());
        if (!putItem) return false;
        params.itemId = putItem;
        params.surfaceId = surfaceId;
        break;
      }

      case 'approach_to': {
        // Найти объект или предмет для приближения
        const targetName = this.extractTargetNameFromCommand(command);
        params.targetId = targetName;
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
   * Алгоритм: ВСЕ значимые слова имени (≥3 символов) должны присутствовать
   * в команде с допуском на флексии ("chaves" → "chave", "maçãs" → "maçã").
   * Кандидаты сортируются по длине — "Chave Verde" (2 слова) проверяется раньше
   * чем "Chave" (1 слово), поэтому "chaves verde" → key_green, а не key.
   */
  extractItemNameFromCommand(command) {
    const itemsData = window.itemsData?.items || [];
    const cmd = command.toLowerCase().trim();

    const candidates = [];
    for (const item of itemsData) {
      const lookupKey = `items.${item.name}`;
      const name = window.getText?.(lookupKey, 'pt-br');
      if (name && name !== lookupKey) candidates.push({ id: item.id, name: name.toLowerCase() });
    }
    candidates.sort((a, b) => b.name.length - a.name.length);

    // Для каждого кандидата (длинные первыми): все значимые слова имени должны
    // совпадать с каким-нибудь словом команды (точно или через флексию).
    let matched = null;
    for (const c of candidates) {
      if (this._nameAllWordsMatch(cmd, c.name)) {
        matched = c;
        break;
      }
    }

    if (matched) {
      const unresolved = this._getUnmatchedEntityWords(cmd, matched.name);
      const family = this._getEntityFamilyCandidates(candidates, matched.name);
      // Если есть неразрешённое уточнение и есть несколько вариантов сущности —
      // запрещаем опасный fallback к общему имени (напр. "chave cinza" -> "chave").
      if (unresolved.length && family.length > 1) {
        this._setFailure('item_variant_not_found', {
          requested: unresolved.join(' '),
          options: family.map(x => x.name)
        });
        return null;
      }
      return matched.id;
    }

    const related = this._findRelatedCandidatesByCommand(candidates, cmd);
    if (related.length > 1) {
      this._setFailure('item_variant_not_found', { options: related.map(x => x.name) });
    }
    return null;
  }

  /**
   * Найти цель (предмет или объект) по имени в команде.
   * Те же правила что у extractItemNameFromCommand — все слова имени через флексию.
   */
  extractTargetNameFromCommand(command) {
    const itemsData = window.itemsData?.items || [];
    const gs = window.getGameState?.();
    const mapObjects = gs?.world?.mapObjects || [];
    const cmd = command.toLowerCase();

    const candidates = [];
    for (const item of itemsData) {
      const k = `items.${item.name}`;
      const name = window.getText?.(k, 'pt-br')?.toLowerCase();
      if (name && name !== k.toLowerCase()) candidates.push({ id: item.id, name });
    }
    for (const obj of mapObjects) {
      const k = `objects.object_${obj.objectId}`;
      const name = window.getText?.(k, 'pt-br')?.toLowerCase();
      if (name && name !== k.toLowerCase()) candidates.push({ id: obj.id, name });
    }
    candidates.sort((a, b) => b.name.length - a.name.length);

    for (const c of candidates) {
      if (this._nameAllWordsMatch(cmd, c.name)) {
        const unresolved = this._getUnmatchedEntityWords(cmd, c.name);
        const family = this._getEntityFamilyCandidates(candidates, c.name);
        if (unresolved.length && family.length > 1) {
          this._setFailure('target_variant_not_found', {
            requested: unresolved.join(' '),
            options: family.map(x => x.name)
          });
          return null;
        }
        return c.id;
      }
    }

    for (const c of candidates) {
      if (this._nameAnyWordMatch(cmd, c.name)) return c.id;
    }

    const related = this._findRelatedCandidatesByCommand(candidates, cmd);
    if (related.length > 1) {
      this._setFailure('target_variant_not_found', { options: related.map(x => x.name) });
    }

    return null;
  }

  /**
   * Найти поверхность по имени в команде.
   * Шаг 1: все слова имени совпадают ("baú vermelho" требует оба слова).
   * Шаг 2: хотя бы одно слово → для "coloca no baú" без цвета.
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

    // 1. Все значимые слова совпадают (точный выбор)
    for (const c of candidates) {
      if (this._nameAllWordsMatch(cmd, c.name)) {
        return c.id;
      }
    }
    // 2. Любое значимое слово (fallback для "coloca no baú" без цвета)
    for (const c of candidates) {
      if (this._nameAnyWordMatch(cmd, c.name)) return c.id;
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
      return false;
    }

    // Ищем ближайшую свободную клетку (исключая все предметы уже на полу)
    const cell = window.pathfindingSystem?.findNearestFreeCell(
      gameState.player.x, gameState.player.y, gameState
    );
    if (!cell) return false;

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
    if (!surface) return false;

    // Проверяем слоты
    const CELL = 20;
    const slots = Math.round(surface.width / CELL) * Math.round(surface.height / CELL);
    const currentItems = gameState.world.surfaceItems?.[surface.id] || [];
    if (currentItems.length >= slots) {
      const msg = window.getText?.('voice.surface_full', 'pt');
      window.eventSystem?.emit('ui:message', { text: msg, lang: 'pt' });
      return false;
    }

    // Если контейнер — должен быть открыт
    if (surface.isContainer) {
      if (gameState.world.containerStates?.[surface.id] !== 'open') {
        const msg = window.getText?.('voice.container_closed', 'pt');
        window.eventSystem?.emit('ui:message', { text: msg, lang: 'pt' });
        return false;
      }
    }

    // Нужно подойти?
    const dist = Math.hypot(gameState.player.x - surface.x, gameState.player.y - surface.y);
    if (dist > 80) {
      if (!window.pathfindingSystem) return false;
      const path = window.pathfindingSystem.findPath(
        gameState.player.x, gameState.player.y,
        surface.x, surface.y, gameState
      );
      if (!path) return false;
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
        const msg = window.getText?.('voice.container_closed', 'pt');
        window.eventSystem?.emit('ui:message', { text: msg, lang: 'pt' });
        return false;
      }
    }

    const CELL = 20;
    const slots = Math.round(surface.width / CELL) * Math.round(surface.height / CELL);
    const current = gs.world.surfaceItems?.[surfaceId] || [];
    if (current.length >= slots) {
      const msg = window.getText?.('voice.surface_full', 'pt');
      window.eventSystem?.emit('ui:message', { text: msg, lang: 'pt' });
      return false;
    }

    window.inventorySystem?.removeItem(itemId);
    const updated = { ...gs.world.surfaceItems, [surfaceId]: [...current, itemId] };
    window.updateGameState?.({ world: { surfaceItems: updated } });

    window.eventSystem?.emit('item:placed_on_surface', { itemId, surfaceId });
    return true;
  }

  /**
   * ДЕЙСТВИЕ: Приближиться к объекту/предмету
   */
  action_approach(params) {
    if (!params.targetId) {
      this._setFailure('approach_target_missing');
      return false;
    }

    const gameState = window.getGameState?.();
    if (!gameState) return false;

    // Ищем предмет или объект
    const item = gameState.world.objects.find(o => o.itemId === params.targetId && !o.taken);
    const mapObj = gameState.world.mapObjects?.find(o => o.id === params.targetId || o.objectId === params.targetId);

    if (!item && !mapObj) {
      this._setFailure('approach_target_not_found', { targetId: params.targetId });
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
        this._setFailure('path_not_found', { targetId: params.targetId });
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
      return false;
    }

    // Проверяем расстояние
    const distance = Math.hypot(gameState.player.x - door.x, gameState.player.y - door.y);

    if (distance > 100) {
      if (window.pathfindingSystem) {
        const path = window.pathfindingSystem.findPath(
          gameState.player.x, gameState.player.y, door.x, door.y, gameState
        );
        if (!path) return false;
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
        const msg = window.getText?.('voice.door_locked_msg', 'pt');
        window.eventSystem?.emit('ui:message', { text: msg, lang: 'pt' });
        return false;
      }
    }

    // Открываем — флаг по типу двери
    const flagKey = door.objectId === 'door' ? 'door_open' : 'door_locked_open';
    // Проверяем если дверь уже открыта
    if (gameState.world.flags?.[flagKey]) {
      this._setFailure('door_already_open', { doorId: door.id });
      return false;
    }
    window.updateGameState?.({ world: { flags: { ...gameState.world.flags, [flagKey]: true } } });
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

    // Если дверь уже закрыта — сообщаем
    if (!gameState.world.flags?.[flagKey]) {
      this._setFailure('door_already_closed', { doorId: door.id });
      return false;
    }
    window.updateGameState?.({ world: { flags: { ...gameState.world.flags, [flagKey]: false } } });
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
    if (!container) {
      this._setFailure('container_not_found');
      return false;
    }

    // Уже открыт?
    if (gameState.world.containerStates?.[container.id] === 'open') {
      return true;
    }

    // Проверяем ключ
    if (container.containerKey && !gameState.player.inventory.includes(container.containerKey)) {
      const msg = window.getText?.('voice.no_key', 'pt');
      this._setFailure('container_no_key', { containerId: container.id, keyId: container.containerKey });
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
      if (!path) {
        this._setFailure('path_not_found', { targetId: container.id });
        return false;
      }
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
      const msg = window.getText?.('voice.no_key', 'pt');
      this._setFailure('container_no_key', { containerId, keyId: container.containerKey });
      window.eventSystem?.emit('ui:message', { text: msg, lang: 'pt' });
      return false;
    }

    const updated = { ...gs.world.containerStates, [containerId]: 'open' };
    window.updateGameState?.({ world: { containerStates: updated } });
    window.eventSystem?.emit('container:opened', { containerId });
    return true;
  }

  /**
   * Взять предмет из открытой емкости (контейнер или обычная поверхность)
   */
  _tryTakeFromContainer(itemId, gameState) {
    const surfaceItems = gameState.world.surfaceItems || {};
    const candidates = [];
    for (const [containerId, items] of Object.entries(surfaceItems)) {
      if (!items.includes(itemId)) continue;
      const container = gameState.world.mapObjects?.find(o => o.id === containerId) || null;
      const isAlwaysOpen = !container?.isContainer;
      const isOpen = isAlwaysOpen || (gameState.world.containerStates?.[containerId] === 'open');
      const dist = container
        ? Math.hypot(gameState.player.x - container.x, gameState.player.y - container.y)
        : 0;
      candidates.push({ containerId, container, isOpen, dist });
    }

    if (!candidates.length) {
      this._setFailure('item_not_found_anywhere', { itemId });
      return false;
    }

    const openCandidates = candidates
      .filter(c => c.isOpen)
      .sort((a, b) => a.dist - b.dist);

    if (!openCandidates.length) {
      const closed = candidates[0];
      const msg = window.getText?.('voice.container_closed', 'pt');
      window.eventSystem?.emit('ui:message', { text: msg, lang: 'pt' });
      this._setFailure('item_in_closed_container', { itemId, containerId: closed.containerId });
      return false;
    }

    const selected = openCandidates[0];
    const containerId = selected.containerId;
    const container = selected.container;

    if (container) {
      const dist = selected.dist;
      if (dist > 80) {
        if (!window.pathfindingSystem) return false;
        const path = window.pathfindingSystem.findPath(
          gameState.player.x, gameState.player.y, container.x, container.y, gameState
        );
        if (!path) return false;
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

  /**
   * Фактически берём предмет из контейнера/поверхности
   */
  _doTakeFromContainer(itemId, containerId) {
    const gs = window.getGameState?.();
    if (!gs) return false;
    const items = gs.world.surfaceItems?.[containerId] || [];
    const idx = items.indexOf(itemId);
    if (idx === -1) {
      this._setFailure('item_not_found_anywhere', { itemId });
      return false;
    }

    window.inventorySystem?.addItem(itemId);
    const newItems = items.filter((_, i) => i !== idx);
    window.updateGameState?.({ world: { surfaceItems: { ...gs.world.surfaceItems, [containerId]: newItems } } });
    window.eventSystem?.emit('item:taken', { itemId });
    return true;
  }

  /**
   * Найти контейнер по названию в команде.
   * Те же правила: все слова → fallback на любое слово → единственный контейнер.
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

    // 1. Все слова совпадают
    for (const c of candidates) {
      if (this._nameAllWordsMatch(cmd, c.name)) {
        return c.id;
      }
    }
    // 2. Любое значимое слово
    for (const c of candidates) {
      if (this._nameAnyWordMatch(cmd, c.name)) return c.id;
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
      if (!gameState) return false;

      this.lastAction = { actionId, params, timestamp: Date.now() };
      this.lastFailure = null;
      let success = false;

      switch (actionId) {
        case 'take_item':
          success = this.action_takeItem(params);
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
          return false;
      }

      if (success) {
        window.updateGameState?.({
          voice: { lastAction: actionId },
        });
        window.eventSystem?.emit('action:executed', {
          actionId,
          params,
          success: true,
        });
      } else {
        window.foxSystem?.onActionFailed?.(actionId, params, this.lastFailure);
        window.eventSystem?.emit('action:failed', {
          actionId,
          params,
          failureCode: this.lastFailure?.code || 'unknown',
        });
      }

      return success;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  /**
   * ДЕЙСТВИЕ: Взять предмет
   */
  action_takeItem(params) {
    const gameState = window.getGameState?.();
    if (!gameState || !params.itemId) return false;

    // Найти предмет в мире
    const groundCandidates = (gameState.world.objects || [])
      .map((o, i) => ({ o, i }))
      .filter(x => x.o.itemId === params.itemId && !x.o.taken)
      .sort((a, b) => {
        const da = Math.hypot(a.o.x - gameState.player.x, a.o.y - gameState.player.y);
        const db = Math.hypot(b.o.x - gameState.player.x, b.o.y - gameState.player.y);
        return da - db;
      });
    const objIndex = groundCandidates.length ? groundCandidates[0].i : -1;

    if (objIndex === -1) {
      return this._tryTakeFromContainer(params.itemId, gameState);
    }

    const obj = gameState.world.objects[objIndex];
    const playerX = gameState.player.x;
    const playerY = gameState.player.y;
    
    const distance = Math.hypot(obj.x - playerX, obj.y - playerY);

    if (distance > 100) {
      // Использовать grid-based pathfinding если доступен
      if (window.pathfindingSystem) {
        // excludeItemId: целевой предмет НЕ блокирует путь к себе
        const path = window.pathfindingSystem.findPath(
          playerX, playerY,
          obj.x, obj.y,
          gameState,
          params.itemId
        );

        if (!path) {
          return this._tryTakeFromContainer(params.itemId, gameState);
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

    // Добавить в инвентарь
          window.inventorySystem?.addItem(params.itemId);

    // БЕЗОПАСНОЕ: Создаём новый массив без мутации
    const updatedObjects = gameState.world.objects.map(o => {
      if (o.itemId === params.itemId && !o.taken) {
        return { ...o, taken: true };  // Создаём новый объект с taken: true
      }
      return o;
    });
    
    // Обновляем state через безопасный API
    window.updateGameState?.({ world: { objects: updatedObjects } });

    window.eventSystem?.emit('item:taken', { itemId: params.itemId });
    return true;
  }

  _setFailure(code, meta = {}) {
    this.lastFailure = { code, meta, timestamp: Date.now() };
  }

  _normalizeWord(word) {
    return (word || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .replace(/(inhas|inhos|inha|inho|mente)$/g, '')
      .replace(/(oes|aes)$/g, 'ao')
      .replace(/(es|as|os|s)$/g, '')
      .replace(/(a|o)$/g, '');
  }

  _wordFlexMatch(commandWord, nameWord) {
    const cw = this._normalizeWord(commandWord);
    const nw = this._normalizeWord(nameWord);
    if (!cw || !nw) return false;
    if (cw === nw) return true;
    if (cw.startsWith(nw) || nw.startsWith(cw)) return true;
    const min = Math.min(cw.length, nw.length);
    return min >= 4 && cw.slice(0, min) === nw.slice(0, min);
  }

  _nameAllWordsMatch(command, name) {
    const cmdWords = (command || '').toLowerCase().split(/\s+/).filter(Boolean);
    const nameWords = (name || '').toLowerCase().split(/\s+/).filter(w => w.length >= 3);
    if (!nameWords.length) return false;
    return nameWords.every(nw => cmdWords.some(cw => this._wordFlexMatch(cw, nw)));
  }

  _nameAnyWordMatch(command, name) {
    const cmdWords = (command || '').toLowerCase().split(/\s+/).filter(Boolean);
    const nameWords = (name || '').toLowerCase().split(/\s+/).filter(w => w.length >= 3);
    if (!nameWords.length) return false;
    return nameWords.some(nw => cmdWords.some(cw => this._wordFlexMatch(cw, nw)));
  }

  _extractContentWords(command) {
    const stop = new Set([
      'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
      'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'para', 'pra', 'com', 'sem', 'sobre', 'dentro',
      'pega', 'pegar', 'pegue', 'apanha', 'apanhar', 'usa', 'usar', 'utiliza', 'utilizar',
      'coloca', 'colocar', 'poe', 'põe', 'por', 'pôr', 'deixa', 'deixar', 'botar', 'meter',
      'abre', 'abrir', 'abra', 'fecha', 'fechar', 'feche',
      'vai', 'vir', 'ir', 'aproxima', 'aproximar', 'perto',
      'agora', 'depois', 'por', 'favor'
    ].map(word => this._normalizeWord(word)).filter(Boolean));
    return (command || '')
      .toLowerCase()
      .split(/\s+/)
      .map(w => this._normalizeWord(w))
      .filter(w => w.length >= 3 && !stop.has(w));
  }

  _getUnmatchedEntityWords(command, entityName) {
    const content = this._extractContentWords(command);
    const entityWords = (entityName || '')
      .toLowerCase()
      .split(/\s+/)
      .map(w => this._normalizeWord(w))
      .filter(w => w.length >= 3);
    return content.filter(cw => !entityWords.some(ew => this._wordFlexMatch(cw, ew)));
  }

  _getEntityFamilyCandidates(candidates, entityName) {
    const head = (entityName || '').toLowerCase().split(/\s+/)[0] || '';
    return (candidates || []).filter(c => {
      const cHead = c.name.toLowerCase().split(/\s+/)[0] || '';
      return this._wordFlexMatch(cHead, head);
    });
  }

  _findRelatedCandidatesByCommand(candidates, command) {
    const content = this._extractContentWords(command);
    return (candidates || []).filter(c => {
      const nameWords = c.name.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
      return nameWords.some(nw => content.some(cw => this._wordFlexMatch(cw, nw)));
    });
  }

  /**
   * ДЕЙСТВИЕ: Использовать предмет
   */
  action_useItem(params) {
    if (!params.itemId) return false;

    const gameState = window.getGameState?.();
    if (!gameState?.player?.inventory?.includes(params.itemId)) {
      return false;
    }

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
        return true;
      }
    }

    // Fallback без pathfinding
    window.updateGameState?.({
      player: { targetX, targetY, isMoving: true, direction: faceDir }
    });
    return true;
  }

  /**
   * ДЕЙСТВИЕ: Проверить инвентарь
   */
  action_checkInventory() {
    const gameState = window.getGameState?.();
    if (!gameState?.player?.inventory) return false;

    const inv = gameState.player.inventory;
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

    window.eventSystem?.emit('world:looked', { objects });
    return true;
  }

  /**
   * ДЕЙСТВИЕ: Справка
   */
  action_help() {
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
