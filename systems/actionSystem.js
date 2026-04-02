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
    this._commandContext = { lastTargetId: null, lastTargetType: null };
  }

  _isDoorObject(obj) {
    return !!obj && (
      obj.objectId === 'door' ||
      obj.objectId === 'door_locked' ||
      obj.objectId === 'door_inner_v' ||
      obj.objectId === 'door_inner_h' ||
      obj.objectId === 'airlock_door_v' ||
      obj.objectId === 'airlock_door_h' ||
      String(obj.objectId || '').startsWith('door_color_')
    );
  }

  _doorFlagKey(door) {
    if (!door) return null;
    if (door.objectId === 'door') return 'door_open';
    if (door.objectId === 'door_locked') return 'door_locked_open';
    return `door_open_${door.id}`;
  }

  _isDoorOpen(door, gameState) {
    const key = this._doorFlagKey(door);
    return !!(key && gameState?.world?.flags?.[key]);
  }

  _interactionReachPx() {
    return 15;
  }

  _interactionRectForObject(obj) {
    if (!obj) return null;

    const CELL = 20;
    let width = Math.max(CELL, Math.round((obj.width || CELL) / CELL) * CELL);
    let height = Math.max(CELL, Math.round((obj.height || CELL) / CELL) * CELL);

    if (this._isDoorObject(obj)) {
      const objectId = String(obj.objectId || '');
      const axis = objectId.endsWith('_h')
        ? 'horizontal'
        : objectId.endsWith('_v')
          ? 'vertical'
          : width >= height
            ? 'horizontal'
            : 'vertical';
      width = axis === 'horizontal' ? CELL * 2 : CELL;
      height = axis === 'vertical' ? CELL * 2 : CELL;
    }

    const left = Math.round(((obj.x || 0) - width / 2) / CELL) * CELL;
    const top = Math.round(((obj.y || 0) - height / 2) / CELL) * CELL;
    return { left, top, width, height };
  }

  _distanceToInteraction(obj, gameState) {
    if (!obj || !gameState?.player) return Infinity;
    const rect = this._interactionRectForObject(obj);
    if (!rect) return Infinity;

    const px = gameState.player.x;
    const py = gameState.player.y;
    const dx = Math.max(rect.left - px, 0, px - (rect.left + rect.width));
    const dy = Math.max(rect.top - py, 0, py - (rect.top + rect.height));
    return Math.hypot(dx, dy);
  }

  _autoResolveRadiusPx() {
    return 20 * 7;
  }

  _distanceToObjectCenter(obj, gameState) {
    if (!obj || !gameState?.player) return Infinity;
    return Math.hypot(gameState.player.x - obj.x, gameState.player.y - obj.y);
  }

  _semanticScore(command, candidateName) {
    const cmd = String(command || '').toLowerCase();
    const name = String(candidateName || '').toLowerCase();
    if (!cmd || !name) return 0;

    let score = 0;
    if (cmd.includes(name)) score += 6;
    if (this._nameAllWordsMatch(cmd, name)) score += 4;
    if (this._nameAnyWordMatch(cmd, name)) score += 2;

    const colorWords = ['vermelh', 'verde', 'azul', 'amarel', 'branc', 'marrom', 'castanh'];
    const normCmd = this._normalizeWord(cmd);
    const normName = this._normalizeWord(name);
    for (const color of colorWords) {
      if (normCmd.includes(color) && normName.includes(color)) score += 2;
    }

    return score;
  }

  _pickBestByWeightedScore(command, candidates, gameState, maxRadiusPx = Infinity) {
    if (!Array.isArray(candidates) || !candidates.length) return null;

    const withScores = candidates
      .map((candidate) => {
        const semantic = this._semanticScore(command, candidate.name);
        const dist = this._distanceToObjectCenter(candidate.obj, gameState);
        if (dist > maxRadiusPx) return null;
        const distanceBonus = Math.max(0, 3 - dist / 40);
        return {
          ...candidate,
          dist,
          score: semantic + distanceBonus,
          semantic,
        };
      })
      .filter(Boolean);

    if (!withScores.length) return null;

    withScores.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.dist !== b.dist) return a.dist - b.dist;
      return String(a.id).localeCompare(String(b.id));
    });

    const top = withScores[0];
    if (top.semantic > 0) return top;

    withScores.sort((a, b) => {
      if (a.dist !== b.dist) return a.dist - b.dist;
      return String(a.id).localeCompare(String(b.id));
    });
    return withScores[0] || null;
  }

  _splitCompoundCommand(command) {
    const normalized = String(command || '').toLowerCase().trim().replace(/\s+/g, ' ');
    if (!normalized) return [];
    const parts = normalized.split(/\s+(?:e|depois|entao|então)\s+/i).map(s => s.trim()).filter(Boolean);
    if (parts.length <= 1) return [normalized];
    return [parts[0], parts.slice(1).join(' ')].filter(Boolean);
  }

  _targetTypeById(targetId, gameState) {
    if (!targetId || !gameState) return null;
    if (targetId === 'wall') return 'wall';
    const obj = (gameState.world?.mapObjects || []).find((entry) => entry.id === targetId);
    if (obj) {
      if (this._isDoorObject(obj)) return 'door';
      if (obj.isContainer) return 'container';
      if (obj.isSurface) return 'surface';
      return 'object';
    }
    const item = (gameState.world?.objects || []).find((entry) => entry.itemId === targetId && !entry.taken);
    if (item) return 'item';
    return null;
  }

  _applyContextToParams(actionId, params, context, gameState) {
    if (!context?.lastTargetId) return params;
    const targetType = context.lastTargetType || this._targetTypeById(context.lastTargetId, gameState);
    if (actionId === 'open_door' && !params.doorId && targetType === 'door') {
      return { ...params, doorId: context.lastTargetId };
    }
    if (actionId === 'open_container' && !params.containerId && targetType === 'container') {
      return { ...params, containerId: context.lastTargetId };
    }
    if (actionId === 'put_on_surface' && !params.surfaceId && (targetType === 'surface' || targetType === 'container')) {
      return { ...params, surfaceId: context.lastTargetId };
    }
    return params;
  }

  _processSingleCommand(command, inheritedContext = null) {
    const normalized = String(command || '').toLowerCase().trim();
    if (!normalized) return false;

    const actionId = this.findActionId(normalized);
    if (!actionId) {
      window.foxSystem?.onNoAction(normalized);
      window.eventSystem?.emit('action:notFound', { command: normalized });
      return false;
    }

    const paramsRaw = this.extractParameters(normalized, actionId, inheritedContext || this._commandContext);
    if (paramsRaw === false) {
      if (!this.lastFailure) {
        const badToken = this._findBadToken(normalized, actionId, {});
        const suggestion = this.suggestCommand(normalized, actionId, {});
        this._setFailure(
          badToken ? 'unknown_word' : 'missing_params',
          badToken
            ? { word: badToken, suggestion }
            : { actionId, command: normalized, suggestion }
        );
      }
      const badToken = this.lastFailure?.code === 'unknown_word' ? this.lastFailure.meta?.word : null;
      window.foxSystem?.onActionFailed?.(actionId, {}, this.lastFailure);
      window.eventSystem?.emit('action:failed', {
        actionId, params: {}, failureCode: this.lastFailure?.code || 'missing_params', badToken,
      });
      return false;
    }

    const gameState = window.getGameState?.();
    let params = this._applyContextToParams(actionId, paramsRaw || {}, inheritedContext || this._commandContext, gameState);
    params = { ...params, _sourceCommand: normalized };

    if (window.foxSystem && window.foxSystem.evaluate(normalized, actionId, params) === false) {
      return false;
    }

    const badToken = this._findBadToken(normalized, actionId, params);
    if (badToken) {
      const suggestion = this.suggestCommand(normalized, actionId, params);
      this._setFailure('unknown_word', suggestion ? { word: badToken, suggestion } : { word: badToken });
      window.foxSystem?.onActionFailed?.(actionId, params, this.lastFailure);
      window.eventSystem?.emit('action:failed', {
        actionId, params, failureCode: 'unknown_word', badToken,
      });
      return false;
    }

    const success = this.executeAction(actionId, params);
    if (success && actionId === 'approach_to' && params?.targetId) {
      const latestState = window.getGameState?.();
      const nextType = this._targetTypeById(params.targetId, latestState);
      this._commandContext = { lastTargetId: params.targetId, lastTargetType: nextType };
      if (inheritedContext) {
        inheritedContext.lastTargetId = params.targetId;
        inheritedContext.lastTargetType = nextType;
      }
    }
    return success;
  }

  _emitMissingKeyMessage(keyId, fallbackKey = 'voice.no_key') {
    const keyName = keyId
      ? (window.getText?.(`items.item_${keyId}`, 'pt') || keyId)
      : '';
    const template = keyName
      ? (window.getText?.('voice.need_specific_key', 'pt') || window.getText?.(fallbackKey, 'pt') || '')
      : (window.getText?.(fallbackKey, 'pt') || '');
    const message = keyName ? template.replace('{keyName}', keyName) : template;
    if (message) {
      window.eventSystem?.emit('ui:message', { text: message, lang: 'pt' });
    }
  }

  /**
   * Загрузить команды голоса из i18n данных
   * @param {object} ptTexts - португальские данные i18n
   */
  loadVoiceCommands(ptTexts) {
    try {
      // Получаем команды из португальских текстов (voice.commands)
      const commands = ptTexts?.voice?.commands || {};

      // Строим командные маппинги: слово/фраза -> ID действия
      this.commandMappings = {};
      for (const [actionId, synonyms] of Object.entries(commands)) {
        if (Array.isArray(synonyms)) {
          for (const synonym of synonyms) {
            const compact = synonym.toLowerCase().trim().replace(/\s+/g, ' ');
            this.commandMappings[compact] = actionId;

            const normalized = compact
              .split(/\s+/)
              .map(word => this._normTok(word))
              .filter(Boolean)
              .join(' ');
            if (normalized) {
              this.commandMappings[normalized] = actionId;
            }
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
      const parts = this._splitCompoundCommand(command);
      if (!parts.length) return false;

      const chainedContext = { ...this._commandContext };
      let overall = true;
      for (const part of parts.slice(0, 2)) {
        const ok = this._processSingleCommand(part, chainedContext);
        if (!ok) {
          overall = false;
          break;
        }
      }
      return overall;
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
        const suggestion = this.suggestCommand(command, 'approach_to', {});
        this._setFailure('unknown_word', suggestion ? { word: badToken, suggestion } : { word: badToken });
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

    const movementAction = this._detectMovementAction(command, false);
    if (movementAction) {
      return movementAction;
    }

    // 1. Многословные фразы — длинные первыми, чтобы более специфичные побеждали
    const compactCommand = command.toLowerCase().trim().replace(/\s+/g, ' ');
    const normalizedCommand = compactCommand
      .split(/\s+/)
      .map(word => this._normTok(word))
      .filter(Boolean)
      .join(' ');

    const phrases = Object.keys(this.commandMappings)
      .filter(k => k.includes(' '))
      .sort((a, b) => b.length - a.length);

    for (const phrase of phrases) {
      if (compactCommand.includes(phrase) || normalizedCommand.includes(phrase)) {
        return this.commandMappings[phrase];
      }
    }

    // 2. Отдельные слова
    const words = compactCommand.split(/\s+/);

    for (const word of words) {
      const mapped = this.commandMappings[word] || this.commandMappings[this._normTok(word)];
      if (mapped) {
        return mapped;
      }
    }

    return null;
  }

  _canonicalCommandForAction(actionId) {
    switch (actionId) {
      case 'move_left':
        return 'ir para a esquerda';
      case 'move_right':
        return 'ir para a direita';
      case 'move_up':
        return 'ir para cima';
      case 'move_down':
        return 'ir para baixo';
      case 'open_door':
        return 'abre a porta';
      case 'close_door':
        return 'fecha a porta';
      case 'check_inventory':
        return 'inventário';
      case 'look':
        return 'olhar';
      case 'help':
        return 'ajuda';
      default:
        return null;
    }
  }

  _editDistance(a, b) {
    const left = String(a || '');
    const right = String(b || '');
    if (left === right) return 0;
    if (!left.length) return right.length;
    if (!right.length) return left.length;

    const dp = Array.from({ length: left.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= right.length; j++) dp[0][j] = j;

    for (let i = 1; i <= left.length; i++) {
      for (let j = 1; j <= right.length; j++) {
        const cost = left[i - 1] === right[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }

    return dp[left.length][right.length];
  }

  _detectMovementAction(command, allowFuzzy = false) {
    const rawWords = String(command || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!rawWords.length) return null;

    const fillerWords = new Set([
      'vai', 'va', 'vá', 'ir', 'para', 'pra', 'a', 'o', 'ao', 'na', 'no',
      'anda', 'andar', 'move', 'mover', 'segue', 'seguir', 'vire', 'vira'
    ].map(word => this._normTok(word)));

    const directions = [
      { actionId: 'move_left', words: ['esquerda', 'left'] },
      { actionId: 'move_right', words: ['direita', 'right'] },
      { actionId: 'move_up', words: ['cima', 'up'] },
      { actionId: 'move_down', words: ['baixo', 'down'] },
    ];

    let matchedAction = null;

    for (const rawWord of rawWords) {
      const word = this._normTok(rawWord);
      if (!word) continue;

      let actionForWord = null;
      for (const direction of directions) {
        const exactMatch = direction.words.some(candidate => this._normTok(candidate) === word);
        const fuzzyMatch = !exactMatch && allowFuzzy && word.length >= 4 && direction.words.some(candidate => {
          const normalizedCandidate = this._normTok(candidate);
          if (!normalizedCandidate || normalizedCandidate.length < 4) return false;
          if (Math.abs(word.length - normalizedCandidate.length) > 2) return false;
          return this._editDistance(word, normalizedCandidate) <= 2;
        });
        if (exactMatch || fuzzyMatch) {
          actionForWord = direction.actionId;
          break;
        }
      }

      if (actionForWord) {
        if (matchedAction && matchedAction !== actionForWord) {
          return null;
        }
        matchedAction = actionForWord;
        continue;
      }

      if (fillerWords.has(word)) continue;
      return null;
    }

    return matchedAction;
  }

  suggestCommand(command, actionId = null, params = {}) {
    const movementAction = this._detectMovementAction(command, true)
      || (String(actionId || '').startsWith('move_') ? actionId : null);
    if (movementAction) {
      return this._canonicalCommandForAction(movementAction);
    }

    if (actionId === 'approach_to' && params?.targetId) {
      const itemName = window.getText?.(`items.item_${params.targetId}`, 'pt');
      if (itemName && itemName !== `items.item_${params.targetId}`) {
        return `vai para ${itemName.toLowerCase()}`;
      }
      const obj = window.getGameState?.()?.world?.mapObjects?.find(entry => entry.id === params.targetId);
      if (obj) {
        const objName = window.getText?.(`objects.object_${obj.objectId}`, 'pt');
        if (objName && objName !== `objects.object_${obj.objectId}`) {
          return `vai para ${objName.toLowerCase()}`;
        }
      }
    }

    return this._canonicalCommandForAction(actionId);
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
      'no','na','nos','nas','ao','aos','em','por','para','pra','pro','pras','pros','com',
      'ate','até','num','numa','que','se','ou','mas','nem','todo','tudo','este','esta',
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
   * Также проверяем "parede/revestimento/casco" — цель-стена корпуса.
   */
  _commandHasApproachTarget(command) {
    const gs = window.getGameState?.();
    if (!gs) return false;

    // Стена корпуса: не хранится в mapObjects, проверяем по i18n
    const wallName = window.getText?.('objects.object_wall', 'pt')?.toLowerCase();
    if (wallName) {
      for (const part of wallName.split(/\s+/)) {
        if (part.length >= 3 && command.includes(part)) return true;
      }
    }
    // Синонимы стены из pt.json (commands.approach_to уже включает слово "parede" если добавлено)
    if (/\b(parede|revestimento|casco|blindagem|fuselagem)\b/.test(command)) return true;

    const itemsData = window.itemsData?.items || [];
    for (const item of itemsData) {
      const name = window.getText?.(`items.${item.name}`, 'pt')?.toLowerCase();
      if (name && this._nameAnyWordMatch(command, name)) return true;
    }
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
  extractParameters(command, actionId, context = null) {
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
        params.surfaceId = surfaceId || context?.lastTargetId || null;
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
          if (!this._isDoorObject(obj)) continue;
          const dname = window.getText?.(`objects.object_${obj.objectId}`, 'pt')?.toLowerCase();
          if (dname) doorCandidates.push({ id: obj.id, name: dname, x: obj.x, y: obj.y });
        }
        const scored = this._pickBestByWeightedScore(
          command,
          doorCandidates.map(d => ({ id: d.id, name: d.name, obj: d })),
          gsDoor,
          Infinity
        );
        params.doorId = scored?.id || context?.lastTargetId || null;
        break;
      }

      case 'open_container': {
        params.containerId = this.extractContainerFromCommand(command) || context?.lastTargetId || null;
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

    // СПЕЦИАЛЬНЫЙ СЛУЧАЙ: стена корпуса (не в mapObjects, но поддержана геометрией)
    const wallName = window.getText?.('objects.object_wall', 'pt')?.toLowerCase();
    if (wallName && this._nameAnyWordMatch(cmd, wallName)) return 'wall';
    if (/\b(parede|revestimento|casco|blindagem|fuselagem)\b/.test(cmd)) return 'wall';

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
    const mapped = candidates.map(c => {
      const obj = mapObjects.find(o => o.id === c.id) || gs?.world?.objects?.find(o => o.itemId === c.id && !o.taken) || null;
      return { ...c, obj: obj || { x: gs?.player?.x || 0, y: gs?.player?.y || 0 } };
    });
    const best = this._pickBestByWeightedScore(cmd, mapped, gs, Infinity);
    if (best?.semantic > 0) {
      const unresolved = this._getUnmatchedEntityWords(cmd, best.name);
      const family = this._getEntityFamilyCandidates(candidates, best.name);
      if (unresolved.length && family.length > 1) {
        this._setFailure('target_variant_not_found', {
          requested: unresolved.join(' '),
          options: family.map(x => x.name)
        });
        return null;
      }
      return best.id;
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
    const mapped = candidates.map(c => ({
      ...c,
      obj: gameState.world.mapObjects.find(o => o.id === c.id),
    }));

    const scored = this._pickBestByWeightedScore(cmd, mapped, gameState, Infinity);
    if (scored?.semantic > 0) return scored.id;

    const nearest = this._pickBestByWeightedScore('', mapped, gameState, this._autoResolveRadiusPx());
    return nearest?.id || null;
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
    if (this._distanceToObjectCenter(surface, gameState) > this._autoResolveRadiusPx()) {
      return false;
    }

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
    if (surface.isContainer && !surface.alwaysOpen) {
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
    if (surface.isContainer && !surface.alwaysOpen) {
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

    // СПЕЦИАЛЬНЫЙ СЛУЧАЙ: цель — стена корпуса (wall / parede)
    // Стены не хранятся в mapObjects, они описаны геометрией корпуса.
    // Узнаём по имени через pt.json: "Parede" → "object_wall"
    const wallName = window.getText?.('objects.object_wall', 'pt')?.toLowerCase();
    const isWallTarget = wallName &&
      (params.targetId === 'wall' ||
       (typeof params.targetId === 'string' &&
        this._normTok(params.targetId).startsWith(this._normTok(wallName.split(' ')[0]))));
    if (
      !isWallTarget &&
      params.targetId !== 'wall' &&
      typeof params.targetId === 'string' &&
      /^wall|parede|revestimento|casco/i.test(params.targetId)
    ) {
      // повторная проверка по ключевым словам
    }

    // Проверяем совпадение по объектному ID "wall" или по переданному id = "obj_wall_..."
    const isWall = (typeof params.targetId === 'string' &&
      (params.targetId === 'wall' ||
       params.targetId.startsWith('obj_wall') ||
       isWallTarget));

    if (isWall && window.pathfindingSystem?.findNearestWallCell) {
      const wallPos = window.pathfindingSystem.findNearestWallCell(
        gameState.player.x, gameState.player.y
      );
      if (!wallPos) {
        this._setFailure('path_not_found', { targetId: params.targetId });
        return false;
      }
      const path = window.pathfindingSystem.findPath(
        gameState.player.x, gameState.player.y,
        wallPos.x, wallPos.y, gameState
      );
      if (!path) {
        this._setFailure('path_not_found', { targetId: params.targetId });
        return false;
      }
      window.updateGameState?.({
        player: { pathWaypoints: path, currentWaypoint: 0, isMoving: true, targetX: null, targetY: null }
      });
      window.eventSystem?.emit('player:approaching', { targetId: params.targetId });
      return true;
    }

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

    // Найти нужную дверь (по ID из params или через семантику/ближайший openable)
    let door = null;
    const sourceCommand = String(params?._sourceCommand || '').toLowerCase();
    if (params.doorId) {
      door = gameState.world.mapObjects?.find(o => o.id === params.doorId);
    }
    if (!door) {
      const openables = [];
      for (const obj of gameState.world.mapObjects || []) {
        if (this._isDoorObject(obj) || obj.isContainer) {
          const name = window.getText?.(`objects.object_${obj.objectId}`, 'pt')?.toLowerCase() || obj.id;
          openables.push({ id: obj.id, name, obj, kind: this._isDoorObject(obj) ? 'door' : 'container' });
        }
      }

      const semantic = sourceCommand
        ? this._pickBestByWeightedScore(sourceCommand, openables, gameState, this._autoResolveRadiusPx())
        : null;
      const chosen = semantic || this._pickBestByWeightedScore('', openables, gameState, this._autoResolveRadiusPx());

      if (chosen?.kind === 'container') {
        return this.action_openContainer({ containerId: chosen.id, _sourceCommand: sourceCommand });
      }
      if (chosen?.kind === 'door') {
        door = chosen.obj;
      }
    }
    if (!door) {
      this._setFailure('openable_not_found', { command: sourceCommand });
      return false;
    }

    // Проверяем расстояние
    const distance = this._distanceToInteraction(door, gameState);

    if (distance > this._interactionReachPx()) {
      if (window.pathfindingSystem) {
        const path = window.pathfindingSystem.findPath(
          gameState.player.x, gameState.player.y, door.x, door.y, gameState
        );
        if (!path) return false;
        window.updateGameState?.({
          player: { pathWaypoints: path, currentWaypoint: 0, isMoving: true,
            _pendingDoorOpen: { doorId: door.id }, targetX: null, targetY: null }
        });
      } else {
        window.updateGameState?.({ player: { targetX: door.x, targetY: door.y, isMoving: true, _pendingDoorOpen: { doorId: door.id } } });
      }
      return true;
    }

    // Запертая дверь — нужен ключ
    if (door.isLocked) {
      if (!gameState.player.inventory.includes(door.lockKey)) {
        this._emitMissingKeyMessage(door.lockKey, 'voice.door_locked_msg');
        return false;
      }
    }

    // Открываем — флаг по типу двери
    const flagKey = this._doorFlagKey(door);
    // Проверяем если дверь уже открыта
    if (this._isDoorOpen(door, gameState)) {
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
        if (!this._isDoorObject(obj)) continue;
        const d = Math.hypot(gameState.player.x - obj.x, gameState.player.y - obj.y);
        if (d < minDist) { minDist = d; door = obj; }
      }
    }
    if (!door) return false;

    const flagKey = this._doorFlagKey(door);

    // Если дверь уже закрыта — сообщаем
    if (!this._isDoorOpen(door, gameState)) {
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
      const sourceCommand = String(params?._sourceCommand || '').toLowerCase();
      const containers = (gameState.world.mapObjects || [])
        .filter(obj => obj.isContainer)
        .map(obj => ({
          id: obj.id,
          name: window.getText?.(`objects.object_${obj.objectId}`, 'pt')?.toLowerCase() || obj.id,
          obj,
        }));
      const best = sourceCommand
        ? this._pickBestByWeightedScore(sourceCommand, containers, gameState, this._autoResolveRadiusPx())
        : this._pickBestByWeightedScore('', containers, gameState, this._autoResolveRadiusPx());
      container = best?.obj || null;
    }
    if (!container) {
      this._setFailure('container_not_found');
      return false;
    }

    // Уже открыт?
    if (container.alwaysOpen || gameState.world.containerStates?.[container.id] === 'open') {
      return true;
    }

    // Проверяем ключ
    if (container.containerKey && !gameState.player.inventory.includes(container.containerKey)) {
      this._setFailure('container_no_key', { containerId: container.id, keyId: container.containerKey });
      this._emitMissingKeyMessage(container.containerKey, 'voice.no_key');
      return false;
    }

    // Подойти если далеко
    const dist = this._distanceToInteraction(container, gameState);
    if (dist > this._interactionReachPx()) {
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
      this._setFailure('container_no_key', { containerId, keyId: container.containerKey });
      this._emitMissingKeyMessage(container.containerKey, 'voice.no_key');
      return false;
    }

    if (container.alwaysOpen) return true;

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
      const isAlwaysOpen = !container?.isContainer || !!container?.alwaysOpen;
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
      const dist = this._distanceToInteraction(container, gameState);
      if (dist > this._interactionReachPx()) {
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
    const mapped = candidates.map(c => ({
      ...c,
      obj: gs.world.mapObjects.find(o => o.id === c.id),
    }));
    const scored = this._pickBestByWeightedScore(cmd, mapped, gs, Infinity);
    if (scored?.semantic > 0) return scored.id;

    // Один контейнер на карте — вернуть его
    const containers = (gs.world.mapObjects || []).filter(o => o.isContainer);
    if (containers.length === 1) return containers[0].id;

    const nearest = this._pickBestByWeightedScore(
      '',
      containers.map(obj => ({
        id: obj.id,
        name: window.getText?.(`objects.object_${obj.objectId}`, 'pt')?.toLowerCase() || obj.id,
        obj,
      })),
      gs,
      this._autoResolveRadiusPx()
    );
    return nearest?.id || null;
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
    
    const distance = this._distanceToInteraction(obj, gameState);

    if (distance > this._interactionReachPx()) {
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
   * ДЕЙСТВИЕ: Двигаться на 4 клетки в заданном направлении.
   * Правило: идём только по прямой и останавливаемся перед препятствием
   * (стена, закрытая дверь, окно и т.д.), без обхода.
   */
  action_move(direction) {
    const gameState = window.getGameState?.();
    if (!gameState) return false;

    if (!direction) return false;

    const CELLS = 4;
    const px = gameState.player.x;
    const py = gameState.player.y;

    let faceDir = gameState.player.direction || 'right';
    let dx = 0;
    let dy = 0;

    switch (direction) {
      case 'left':  dx = -1; dy = 0; faceDir = 'left';  break;
      case 'right': dx = 1;  dy = 0; faceDir = 'right'; break;
      case 'up':    dx = 0;  dy = -1; faceDir = 'up';   break;
      case 'down':  dx = 0;  dy = 1;  faceDir = 'down'; break;
      default: return false;
    }

    const pf = window.pathfindingSystem;
    if (!pf) return false;

    const walkable = pf.buildWalkableGrid(gameState);
    const cols = pf.GRID_COLS;
    const rows = pf.GRID_ROWS;
    const start = pf.posToGrid(px, py);

    let gx = start.x;
    let gy = start.y;
    let moved = false;

    // Ищем дальнюю достижимую клетку строго по направлению.
    for (let step = 0; step < CELLS; step++) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) break;
      if (walkable[ny * cols + nx] !== 1) break;
      gx = nx;
      gy = ny;
      moved = true;
    }

    // Если упёрлись сразу — просто повернуться лицом и остаться на месте.
    if (!moved) {
      window.updateGameState?.({
        player: {
          isMoving: false,
          direction: faceDir,
          targetX: null,
          targetY: null,
          pathWaypoints: null,
          currentWaypoint: 0,
        }
      });
      return true;
    }

    const target = pf.gridToPos(gx, gy);

    window.updateGameState?.({
      player: {
        targetX: target.x,
        targetY: target.y,
        isMoving: true,
        direction: faceDir,
        pathWaypoints: null,
        currentWaypoint: 0,
      }
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
