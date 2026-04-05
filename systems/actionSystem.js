class ActionSystem {
  constructor() {
    this.actions = {};
    this.commandMappings = {};
    this.lastAction = null;
    this.lastFailure = null;
    this._commandContext = { lastTargetId: null, lastTargetType: null };
  }

  _ptValue(key, fallback = null) {
    const value = window.getText?.(key, 'pt');
    return (value && value !== key) ? value : fallback;
  }

  _ptArray(key, fallback = []) {
    const value = this._ptValue(key, fallback);
    return Array.isArray(value) ? value : fallback;
  }

  _ptMap(key, fallback = {}) {
    const value = this._ptValue(key, fallback);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
  }

  _escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  _commandMatchesAnyPhrase(command, phrases = []) {
    const compactCommand = String(command || '').toLowerCase().trim().replace(/\s+/g, ' ');
    if (!compactCommand) return false;
    const normalizedCommand = compactCommand
      .split(/\s+/)
      .map((word) => this._normTok(word))
      .filter(Boolean)
      .join(' ');

    return (phrases || []).some((phrase) => {
      const compactPhrase = String(phrase || '').toLowerCase().trim().replace(/\s+/g, ' ');
      if (!compactPhrase) return false;
      if (compactCommand.includes(compactPhrase)) return true;
      const normalizedPhrase = compactPhrase
        .split(/\s+/)
        .map((word) => this._normTok(word))
        .filter(Boolean)
        .join(' ');
      return !!normalizedPhrase && normalizedCommand.includes(normalizedPhrase);
    });
  }

  _normalizedIncludesAny(command, terms = []) {
    const normalized = this._normalize(command);
    return (terms || []).some((term) => {
      const token = this._normalize(term);
      return !!token && normalized.includes(token);
    });
  }

  _voiceExample(actionId) {
    const key = `voice.command_examples.${actionId}`;
    const value = this._ptValue(key, null);
    return typeof value === 'string' ? value : null;
  }

  _voiceTemplate(key, params = {}) {
    const templateKey = `voice.templates.${key}`;
    let template = this._ptValue(templateKey, '');
    if (!template) return '';
    for (const [paramKey, paramValue] of Object.entries(params)) {
      template = template.replaceAll(`{${paramKey}}`, String(paramValue ?? ''));
    }
    return template;
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

  _isContainerObject(obj) {
    return !!obj && !!obj.isContainer;
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

  _containerFlagKey(container) {
    if (!container?.id) return null;
    return `container_open_${container.id}`;
  }

  _isContainerOpen(container, gameState) {
    if (!container) return false;
    if (container.alwaysOpen) return true;
    const key = this._containerFlagKey(container);
    return !!(key && gameState?.world?.flags?.[key]);
  }

  _interactionReachPx() {
    return 15;
  }

  _interactionRectForObject(obj) {
    if (!obj) return null;

    const CELL = 20;
    const width = Math.max(CELL, Math.round((obj.width || CELL) / CELL) * CELL);
    const height = Math.max(CELL, Math.round((obj.height || CELL) / CELL) * CELL);

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

  _directionFromTo(fromX, fromY, toX, toY) {
    const dx = (toX || 0) - (fromX || 0);
    const dy = (toY || 0) - (fromY || 0);
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
    return dy >= 0 ? 'down' : 'up';
  }

  _semanticScore(command, candidateName) {
    const cmd = String(command || '').toLowerCase();
    const name = String(candidateName || '').toLowerCase();
    if (!cmd || !name) return 0;

    let score = 0;
    if (cmd.includes(name)) score += 6;
    if (this._nameAllWordsMatch(cmd, name)) score += 4;
    if (this._nameAnyWordMatch(cmd, name)) score += 2;

    const colorWords = this._ptArray('voice.lexicon.color_stems', []);
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

  _pickPreferredActionTarget(command, candidates, gameState, {
    maxRadiusPx = Infinity,
    isPreferred = null,
  } = {}) {
    if (!Array.isArray(candidates) || !candidates.length) return null;

    const normalized = String(command || '').toLowerCase().trim();
    const contentWords = this._extractContentWords(normalized);
    const isGenericRequest = contentWords.length <= 1;

    if (isGenericRequest && typeof isPreferred === 'function') {
      const preferredCandidates = candidates.filter((candidate) => {
        try {
          return !!isPreferred(candidate);
        } catch {
          return false;
        }
      });
      const preferred = this._pickBestByWeightedScore(normalized, preferredCandidates, gameState, maxRadiusPx);
      if (preferred) return preferred;
    }

    return this._pickBestByWeightedScore(normalized, candidates, gameState, maxRadiusPx);
  }

  _splitCompoundCommand(command) {
    const normalized = String(command || '').toLowerCase().trim().replace(/\s+/g, ' ');
    if (!normalized) return [];
    const joiners = this._ptArray('voice.lexicon.sequence_joiners', ['and']);
    const pattern = joiners
      .map((joiner) => this._escapeRegex(joiner))
      .filter(Boolean)
      .join('|');
    const parts = pattern
      ? normalized.split(new RegExp(`\\s+(?:${pattern})\\s+`, 'i')).map((part) => part.trim()).filter(Boolean)
      : [normalized];
    if (parts.length <= 1) return [normalized];
    return [parts[0], parts.slice(1).join(' ')].filter(Boolean);
  }

  _emitActionSuccess(actionId, params = {}) {
    window.updateGameState?.({ voice: { lastAction: actionId } });
    window.eventSystem?.emit('action:executed', {
      actionId,
      params,
      success: true,
    });
  }

  _emitActionFailure(actionId, params = {}) {
    window.foxSystem?.onActionFailed?.(actionId, params, this.lastFailure);
    window.eventSystem?.emit('action:failed', {
      actionId,
      params,
      failureCode: this.lastFailure?.code || 'unknown',
    });
  }

  _hasDeferredMovement(player = {}) {
    return !!(
      player?.isMoving && (
        player?._pendingMoveAction ||
        player?._pendingItemPickup ||
        player?._pendingDoorOpen ||
        player?._pendingDoorClose ||
        player?._pendingPutOnSurface ||
        player?._pendingOpenContainer ||
        player?._pendingCloseContainer ||
        player?._pendingTakeFromContainer ||
        player?._pendingApproachTarget
      )
    );
  }

  finalizeDeferredAction(actionId, params = {}, success = false) {
    if (success) {
      this._emitActionSuccess(actionId, params);
      return true;
    }
    this._emitActionFailure(actionId, params);
    return false;
  }

  _interactionCandidatePositions(obj) {
    const rect = this._interactionRectForObject(obj);
    const cell = window.pathfindingSystem?.GRID_SIZE || 20;
    if (!rect) return [];

    const positions = [];
    const seen = new Set();
    const pushUnique = (x, y) => {
      const key = `${x},${y}`;
      if (seen.has(key)) return;
      seen.add(key);
      positions.push({ x, y });
    };

    for (let x = rect.left; x < rect.left + rect.width; x += cell) {
      pushUnique(x + cell / 2, rect.top - cell / 2);
      pushUnique(x + cell / 2, rect.top + rect.height + cell / 2);
    }
    for (let y = rect.top; y < rect.top + rect.height; y += cell) {
      pushUnique(rect.left - cell / 2, y + cell / 2);
      pushUnique(rect.left + rect.width + cell / 2, y + cell / 2);
    }

    return positions;
  }

  _pathLength(path = [], fromX = 0, fromY = 0) {
    if (!Array.isArray(path) || !path.length) return Infinity;
    let total = 0;
    let prevX = fromX;
    let prevY = fromY;
    for (const point of path) {
      total += Math.hypot((point.x || 0) - prevX, (point.y || 0) - prevY);
      prevX = point.x || 0;
      prevY = point.y || 0;
    }
    return total;
  }

  _findBestInteractionPath(target, gameState, excludeItemId = null) {
    if (!window.pathfindingSystem || !target || !gameState?.player) return null;

    const pf = window.pathfindingSystem;
    const candidates = this._interactionCandidatePositions(target);
    let bestPath = null;
    let bestScore = Infinity;

    for (const pos of candidates) {
      const path = pf.findPath(gameState.player.x, gameState.player.y, pos.x, pos.y, gameState, excludeItemId);
      if (!path || !path.length) continue;
      const lastPoint = path[path.length - 1] || null;
      if (!lastPoint || Math.hypot((lastPoint.x || 0) - pos.x, (lastPoint.y || 0) - pos.y) > 0.5) continue;
      const score = this._pathLength(path, gameState.player.x, gameState.player.y);
      if (score < bestScore) {
        bestPath = path;
        bestScore = score;
      }
    }

    return bestPath;
  }

  _targetTypeById(targetId, gameState) {
    if (!targetId || !gameState) return null;
    if (targetId === 'wall') return 'wall';
    const obj = (gameState.world?.mapObjects || []).find((entry) => entry.id === targetId);
    if (obj) {
      if (this._isDoorObject(obj)) return 'door';
      if (this._isContainerObject(obj)) return 'container';
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

  _hasCandidateWordMatch(command, candidates) {
    const cmd = String(command || '').toLowerCase();
    return (candidates || []).some((candidate) => {
      if (!candidate?.name) return false;
      return this._nameAnyWordMatch(cmd, candidate.name) || this._nameAllWordsMatch(cmd, candidate.name);
    });
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

    if (window.questSystem?.checkActionGate?.(actionId, params) === false) {
      this._setFailure('quest_gate_blocked', { actionId, command: normalized });
      window.eventSystem?.emit('action:failed', {
        actionId,
        params,
        failureCode: 'quest_gate_blocked',
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

  
  loadVoiceCommands(ptTexts) {
    try {
     
      const commands = ptTexts?.voice?.commands || {};

     
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

  
  loadActions(actionsData) {
    if (!actionsData?.actions) return;

    this.actions = {};
    actionsData.actions.forEach(action => {
      this.actions[action.id] = action;
    });
  }

  
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

  
  findActionId(command) {
   
    if (this._commandIsCloseContainer(command)) {
      return 'close_container';
    }

    if (this._commandIsOpenContainer(command)) {
      return 'open_container';
    }

   
    if (this._commandHasSurface(command)) {
      return 'put_on_surface';
    }

   
   
   
    if (this._commandHasApproachVerb(command) && !this._commandHasApproachTarget(command)) {
      const extractedTarget = this.extractTargetNameFromCommand(command);
      if (extractedTarget) {
        return 'approach_to';
      }

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
    return this._voiceExample(actionId);
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

    const fillerWords = new Set(
      this._ptArray('voice.lexicon.movement_fillers', ['go', 'to', 'the'])
        .map((word) => this._normTok(word))
        .filter(Boolean)
    );

    const directions = [
      { actionId: 'move_left', words: this._ptArray('voice.commands.move_left', ['left']) },
      { actionId: 'move_right', words: this._ptArray('voice.commands.move_right', ['right']) },
      { actionId: 'move_up', words: this._ptArray('voice.commands.move_up', ['up']) },
      { actionId: 'move_down', words: this._ptArray('voice.commands.move_down', ['down']) },
    ];

    let matchedAction = null;

    for (const rawWord of rawWords) {
      const word = this._normTok(rawWord);
      if (!word) continue;

      let actionForWord = null;
      for (const direction of directions) {
        const exactMatch = direction.words.some((candidate) => this._normTok(candidate) === word);
        const fuzzyMatch = !exactMatch && allowFuzzy && word.length >= 4 && direction.words.some((candidate) => {
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
          return this._voiceTemplate('suggest_approach', { target: objName.toLowerCase() }) || objName.toLowerCase();
        }
      }
    }

    return this._canonicalCommandForAction(actionId);
  }

  
  _normTok(word) {
    return (word || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  
  _findBadToken(command, actionId, params) {
    if (actionId === 'approach_to') {
      const resolvedTarget = params?.targetId || this.extractTargetNameFromCommand(command);
      if (resolvedTarget) return null;
    }

    if (actionId === 'look' && (params?.focus === 'pockets' || this._normalizedIncludesAny(command, this._ptArray('voice.lexicon.pocket_terms', ['pocket', 'pockets'])))) {
      return null;
    }

    const STOP = new Set(
      this._ptArray('voice.lexicon.stop_words', ['the', 'and', 'to', 'of', 'in', 'on'])
        .map((word) => this._normTok(word))
        .filter(Boolean)
    );

   
    const verbWords = new Set();
    for (const [phrase, id] of Object.entries(this.commandMappings)) {
      if (id === actionId) {
        phrase.toLowerCase().split(/\s+/).forEach(w => {
          const n = this._normTok(w);
          if (n.length >= 2) verbWords.add(n);
        });
      }
    }

   
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
   
    for (const raw of command.split(/\s+/)) {
      const tok = this._normTok(raw);
     
      if (tok.length === 0) continue;
     
      if (tok.length < 3 && /^[a-z]+$/.test(tok)) continue;
     
      if (STOP.has(tok)) continue;
      if (verbWords.has(tok)) continue;
      if (paramWords.has(tok)) continue;
     
      let partial = false;
      for (const kw of verbWords) { if (kw.startsWith(tok) || tok.startsWith(kw)) { partial = true; break; } }
      if (!partial) {
        for (const kw of paramWords) { if (kw.startsWith(tok) || tok.startsWith(kw)) { partial = true; break; } }
      }
      if (partial) continue;
      return raw.toLowerCase();
    }
    return null;
  }

  
  _commandHasApproachVerb(command) {
    const directionalPhrases = [
      ...this._ptArray('voice.commands.move_left', []),
      ...this._ptArray('voice.commands.move_right', []),
      ...this._ptArray('voice.commands.move_up', []),
      ...this._ptArray('voice.commands.move_down', []),
    ];
    if (this._commandMatchesAnyPhrase(command, directionalPhrases)) return false;
    return this._commandMatchesAnyPhrase(command, this._ptArray('voice.commands.approach_to', ['go', 'approach']));
  }

  
  _commandHasApproachTarget(command) {
    const gs = window.getGameState?.();
    if (!gs) return false;
    const normalizedCommand = this._normalize(command);

   
    const wallName = window.getText?.('objects.object_wall', 'pt')?.toLowerCase();
    if (wallName) {
      for (const part of wallName.split(/\s+/)) {
        if (part.length >= 3 && normalizedCommand.includes(this._normalize(part))) return true;
      }
    }
    if (this._normalizedIncludesAny(normalizedCommand, this._ptArray('voice.lexicon.wall_terms', ['wall']))) return true;

    const itemsData = window.itemsData?.items || [];
    for (const item of itemsData) {
      const name = window.getText?.(`items.${item.name}`, 'pt')?.toLowerCase();
      if (name && this._nameAnyWordMatch(normalizedCommand, name)) return true;
    }
    for (const obj of gs.world?.mapObjects || []) {
      const name = window.getText?.(`objects.object_${obj.objectId}`, 'pt')?.toLowerCase();
      if (name && this._nameAnyWordMatch(normalizedCommand, name)) return true;
    }

    const commandWords = this._extractContentWords(normalizedCommand);
    if (!commandWords.length) return false;

    for (const obj of gs.world?.mapObjects || []) {
      const terms = this._entityTerms(obj, 'objects.object_');
      if (this._commandEntityMatchScore(commandWords, terms) > 0) return true;
    }

    for (const worldItem of gs.world?.objects || []) {
      if (worldItem.taken) continue;
      const itemData = (window.itemsData?.items || []).find((entry) => entry.id === worldItem.itemId)
        || { id: worldItem.itemId, name: `item_${worldItem.itemId}` };
      const terms = this._entityTerms(itemData, 'items.');
      if (this._commandEntityMatchScore(commandWords, terms) > 0) return true;
    }

    return false;
  }

  
  _commandHasSurface(command) {
    const gs = window.getGameState?.();
    if (!gs) return false;
    const hasPutVerb = this._commandMatchesAnyPhrase(command, this._ptArray('voice.commands.put_on_surface', []));
    if (!hasPutVerb) return false;
    const hasSurfacePrep = this._normalizedIncludesAny(command, this._ptArray('voice.lexicon.surface_prepositions', ['on', 'in', 'inside']));
    if (!hasSurfacePrep) return false;
    for (const obj of gs.world?.mapObjects || []) {
      if (!obj.isSurface && !this._isContainerObject(obj)) continue;
      const name = window.getText?.(`objects.object_${obj.objectId}`, 'pt')?.toLowerCase();
      if (!name) continue;
      const matched = this._nameAllWordsMatch(command, name) || this._nameAnyWordMatch(command, name);
      if (matched) return true;
    }
    return false;
  }

  _commandIsCloseContainer(command) {
    const gs = window.getGameState?.();
    if (!gs) return false;
    const normalized = this._normalize(command);
    const hasCloseVerb = this._commandMatchesAnyPhrase(
      normalized,
      [
        ...this._ptArray('voice.commands.close_container', []),
        ...this._ptArray('voice.commands.close_door', []),
      ]
    );
    if (!hasCloseVerb) return false;

    if (this._normalizedIncludesAny(normalized, this._ptArray('voice.lexicon.container_terms', ['container']))) {
      return true;
    }

    for (const obj of gs.world?.mapObjects || []) {
      if (!this._isContainerObject(obj)) continue;
      const name = window.getText?.(`objects.object_${obj.objectId}`, 'pt')?.toLowerCase();
      if (!name) continue;
      const matched = this._nameAllWordsMatch(normalized, name) || this._nameAnyWordMatch(normalized, name);
      if (matched) return true;
    }
    return false;
  }

  
  _commandIsOpenContainer(command) {
    const gs = window.getGameState?.();
    if (!gs) return false;
    const normalized = this._normalize(command);
    const hasOpenVerb = this._commandMatchesAnyPhrase(
      normalized,
      [
        ...this._ptArray('voice.commands.open_container', []),
        ...this._ptArray('voice.commands.open_door', []),
      ]
    );
    if (!hasOpenVerb) return false;

    if (this._normalizedIncludesAny(normalized, this._ptArray('voice.lexicon.container_terms', ['container']))) {
      return true;
    }

    for (const obj of gs.world?.mapObjects || []) {
      if (!this._isContainerObject(obj)) continue;
      const name = window.getText?.(`objects.object_${obj.objectId}`, 'pt')?.toLowerCase();
      if (!name) continue;
      const matched = this._nameAllWordsMatch(normalized, name) || this._nameAnyWordMatch(normalized, name);
      if (matched) return true;
    }
    return false;
  }

  
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
       
       
       
        const dropItem = this.extractItemNameFromCommand(command);
        if (!dropItem) return false;
        params.itemId = dropItem;
        break;
      }

      case 'put_on_surface': {
       
       
        const surfaceId = this.extractSurfaceFromCommand(command);
        let cmdForItem = command;
        if (surfaceId) {
          const surfaceObj = gameState.world.mapObjects?.find(o => o.id === surfaceId && (o.isSurface || this._isContainerObject(o)));
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
       
        const gsDoor = window.getGameState?.();
        const sourceDoors = gsDoor?.world?.mapObjects || [];
        const doorCandidates = [];
        for (const obj of sourceDoors) {
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

      case 'open_container':
      case 'close_container': {
        params.containerId = this.extractContainerFromCommand(command) || context?.lastTargetId || null;
        break;
      }

      case 'look': {
        const normalized = this._normalize(command);
        if (this._normalizedIncludesAny(normalized, this._ptArray('voice.lexicon.pocket_terms', ['pocket', 'pockets']))) {
          params.focus = 'pockets';
        }
        break;
      }

      case 'talk_npc': {
        params.npcId = this.findClosestNPC();
        break;
      }
    }

    return params;
  }

  
  extractItemNameFromCommand(command) {
    const itemsData = window.itemsData?.items || [];
    const cmd = command.toLowerCase().trim();

    const candidates = [];
    for (const item of itemsData) {
      const lookupKey = `items.${item.name}`;
      const name = window.getText?.(lookupKey, 'pt');
      if (name && name !== lookupKey) candidates.push({ id: item.id, name: name.toLowerCase() });
    }
    candidates.sort((a, b) => b.name.length - a.name.length);

   
   
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
      return null;
    }
    if (related.length === 1) {
      return related[0].id;
    }
    return null;
  }

  
  extractTargetNameFromCommand(command, preferredIds = null) {
    const itemsData = window.itemsData?.items || [];
    const gs = window.getGameState?.();
    const mapObjects = gs?.world?.mapObjects || [];
    const cmd = command.toLowerCase();

    if (this._normalizedIncludesAny(cmd, this._ptArray('voice.lexicon.wall_terms', ['wall']))) return 'wall';

    const candidates = [];
    for (const item of itemsData) {
      const k = `items.${item.name}`;
      const name = window.getText?.(k, 'pt')?.toLowerCase();
      if (name && name !== k.toLowerCase()) candidates.push({ id: item.id, name });
    }
    for (const obj of mapObjects) {
      if (Array.isArray(preferredIds) && preferredIds.length && !preferredIds.includes(obj.id)) continue;
      const k = `objects.object_${obj.objectId}`;
      const name = window.getText?.(k, 'pt')?.toLowerCase();
      if (name && name !== k.toLowerCase()) candidates.push({ id: obj.id, name });
    }
    const mapped = candidates.map(c => {
      const obj = mapObjects.find(o => o.id === c.id) || gs?.world?.objects?.find(o => o.itemId === c.id && !o.taken) || null;
      return { ...c, obj: obj || { x: gs?.player?.x || 0, y: gs?.player?.y || 0 } };
    });

    if (Array.isArray(preferredIds) && preferredIds.length) {
      const preferredMapped = mapped.filter((candidate) => preferredIds.includes(candidate.id));
      const preferredBest = this._pickBestByWeightedScore(cmd, preferredMapped, gs, Infinity);
      if (preferredBest && this._hasCandidateWordMatch(cmd, [preferredBest])) {
        return preferredBest.id;
      }
    }

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

    const commandWords = this._extractContentWords(cmd);
    if (commandWords.length) {
      const fallbackCandidates = [];
      for (const obj of mapObjects) {
        if (Array.isArray(preferredIds) && preferredIds.length && !preferredIds.includes(obj.id)) continue;
        const terms = this._entityTerms(obj, 'objects.object_');
        const score = this._commandEntityMatchScore(commandWords, terms);
        if (score <= 0) continue;
        fallbackCandidates.push({ id: obj.id, score, dist: this._distanceToObjectCenter(obj, gs) });
      }

      for (const worldItem of gs?.world?.objects || []) {
        if (worldItem.taken) continue;
        const itemData = itemsData.find((entry) => entry.id === worldItem.itemId)
          || { id: worldItem.itemId, name: `item_${worldItem.itemId}` };
        const terms = this._entityTerms(itemData, 'items.');
        const score = this._commandEntityMatchScore(commandWords, terms);
        if (score <= 0) continue;
        fallbackCandidates.push({
          id: worldItem.itemId,
          score,
          dist: this._distanceToObjectCenter({ x: worldItem.x, y: worldItem.y }, gs),
        });
      }

      fallbackCandidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.dist !== b.dist) return a.dist - b.dist;
        return String(a.id).localeCompare(String(b.id));
      });

      if (fallbackCandidates.length) return fallbackCandidates[0].id;
    }

    return null;
  }

  
  extractSurfaceFromCommand(command) {
    const gameState = window.getGameState?.();
    if (!gameState) return null;
    const cmd = command.toLowerCase();

    const candidates = [];
    for (const obj of gameState.world.mapObjects || []) {
      if (!obj.isSurface && !this._isContainerObject(obj)) continue;
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

  
  action_dropItem(params) {
    const gameState = window.getGameState?.();
    if (!gameState || !params.itemId) return false;

    if (!gameState.player.inventory.includes(params.itemId)) {
      return false;
    }

   
    const cell = window.pathfindingSystem?.findNearestFreeCell(
      gameState.player.x, gameState.player.y, gameState
    );
    if (!cell) return false;

   
    window.inventorySystem?.removeItem(params.itemId);

   
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

  
  action_putOnSurface(params) {
    const gameState = window.getGameState?.();
    if (!gameState || !params.itemId) return false;

    if (!gameState.player.inventory.includes(params.itemId)) {
      return false;
    }

   
    let surface = null;
    if (params.surfaceId) {
      surface = gameState.world.mapObjects?.find(o => o.id === params.surfaceId && (o.isSurface || this._isContainerObject(o)));
    }
    if (!surface) {
      let minDist = Infinity;
      for (const obj of gameState.world.mapObjects || []) {
        if (!obj.isSurface && !this._isContainerObject(obj)) continue;
        const d = Math.hypot(gameState.player.x - obj.x, gameState.player.y - obj.y);
        if (d < minDist) { minDist = d; surface = obj; }
      }
    }
    if (!surface) return false;
    if (this._distanceToObjectCenter(surface, gameState) > this._autoResolveRadiusPx()) {
      return false;
    }

   
    const CELL = 20;
    const slots = Math.round(surface.width / CELL) * Math.round(surface.height / CELL);
    const currentItems = gameState.world.surfaceItems?.[surface.id] || [];
    if (currentItems.length >= slots) {
      const msg = window.getText?.('voice.surface_full', 'pt');
      window.eventSystem?.emit('ui:message', { text: msg, lang: 'pt' });
      return false;
    }

   
    if (this._isContainerObject(surface) && !surface.alwaysOpen) {
      if (!this._isContainerOpen(surface, gameState)) {
        const msg = window.getText?.('voice.container_closed', 'pt');
        window.eventSystem?.emit('ui:message', { text: msg, lang: 'pt' });
        return false;
      }
    }

   
    const dist = this._distanceToInteraction(surface, gameState);
    if (dist > this._interactionReachPx()) {
      const path = this._findBestInteractionPath(surface, gameState);
      if (!path) {
        this._setFailure('path_not_found', { targetId: surface.id });
        return false;
      }
      window.updateGameState?.({
        player: {
          pathWaypoints: path,
          currentWaypoint: 0,
          isMoving: true,
          targetX: null,
          targetY: null,
          direction: this._directionFromTo(gameState.player.x, gameState.player.y, surface.x, surface.y),
          _pendingPutOnSurface: { itemId: params.itemId, surfaceId: surface.id }
        }
      });
      return true;
    }

    return this._doPlaceOnSurface(params.itemId, surface.id);
  }

  
  _doPlaceOnSurface(itemId, surfaceId) {
    const gs = window.getGameState?.();
    if (!gs) return false;
    const surface = gs.world.mapObjects?.find(o => o.id === surfaceId);
    if (!surface) return false;

   
    if (this._isContainerObject(surface) && !surface.alwaysOpen) {
      if (!this._isContainerOpen(surface, gs)) {
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

  
  action_approach(params) {
    if (!params.targetId) {
      this._setFailure('approach_target_missing');
      return false;
    }

    const gameState = window.getGameState?.();
    if (!gameState) return false;

   
   
   
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
     
    }

   
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
        player: {
          pathWaypoints: path,
          currentWaypoint: 0,
          isMoving: true,
          targetX: null,
          targetY: null,
          direction: this._directionFromTo(gameState.player.x, gameState.player.y, wallPos.x, wallPos.y),
          _pendingApproachTarget: { targetId: 'wall', x: wallPos.x, y: wallPos.y }
        }
      });
      window.eventSystem?.emit('player:approaching', { targetId: params.targetId });
      return true;
    }

   
    const item = gameState.world.objects.find(o => o.itemId === params.targetId && !o.taken);
    let mapObj = gameState.world.mapObjects?.find(o => o.id === params.targetId) || null;
    if (!mapObj && typeof params.targetId === 'string') {
      const sameType = (gameState.world.mapObjects || []).filter((o) => o.objectId === params.targetId);
      if (sameType.length) {
        mapObj = sameType.reduce((best, candidate) => {
          if (!best) return candidate;
          const bestDist = Math.hypot((best.x || 0) - gameState.player.x, (best.y || 0) - gameState.player.y);
          const candidateDist = Math.hypot((candidate.x || 0) - gameState.player.x, (candidate.y || 0) - gameState.player.y);
          return candidateDist < bestDist ? candidate : best;
        }, null);
      }
    }

    if (!item && !mapObj) {
      this._setFailure('approach_target_not_found', { targetId: params.targetId });
      return false;
    }

   
    const target = item || mapObj;

    if (window.pathfindingSystem) {
      const path = this._findBestInteractionPath(target, gameState, item?.itemId || null);
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
          targetY: null,
          direction: this._directionFromTo(gameState.player.x, gameState.player.y, target.x, target.y),
          _pendingApproachTarget: { targetId: params.targetId, x: target.x, y: target.y }
        }
      });
    } else {
      window.updateGameState?.({
        player: {
          targetX: target.x,
          targetY: target.y,
          isMoving: true,
          direction: this._directionFromTo(gameState.player.x, gameState.player.y, target.x, target.y),
          _pendingApproachTarget: { targetId: params.targetId, x: target.x, y: target.y }
        }
      });
    }

    window.eventSystem?.emit('player:approaching', { targetId: params.targetId });
    return true;
  }

  
  action_openDoor(params) {
    const gameState = window.getGameState?.();
    if (!gameState) return false;

   
    let door = null;
    let interactionPath = null;
    const sourceCommand = String(params?._sourceCommand || '').toLowerCase();
    const isGenericDoorRequest = this._extractContentWords(sourceCommand).length <= 1;
    if (params.doorId) {
      door = gameState.world.mapObjects?.find(o => o.id === params.doorId);
      if (door && !this._isDoorObject(door)) {
        door = null;
      }
      if (door) {
        interactionPath = this._findBestInteractionPath(door, gameState);
        if (isGenericDoorRequest && (this._isDoorOpen(door, gameState) || (!interactionPath && this._distanceToInteraction(door, gameState) > this._interactionReachPx()))) {
          door = null;
          interactionPath = null;
        }
      }
    }
    if (!door) {
      const doors = [];
      for (const obj of gameState.world.mapObjects || []) {
        if (!this._isDoorObject(obj)) continue;
        const path = this._findBestInteractionPath(obj, gameState);
        const isReachable = this._distanceToInteraction(obj, gameState) <= this._interactionReachPx() || !!path;
        if (!isReachable) continue;
        const name = window.getText?.(`objects.object_${obj.objectId}`, 'pt')?.toLowerCase() || obj.id;
        doors.push({ id: obj.id, name, obj, kind: 'door', interactionPath: path });
      }

      const pickOptions = {
        maxRadiusPx: this._autoResolveRadiusPx(),
        isPreferred: ({ obj }) => !this._isDoorOpen(obj, gameState),
      };
      const chosen = this._pickPreferredActionTarget(sourceCommand, doors, gameState, pickOptions)
        || this._pickPreferredActionTarget('', doors, gameState, pickOptions);

      if (chosen?.kind === 'door') {
        door = chosen.obj;
        interactionPath = chosen.interactionPath || null;
      }
    }
    if (!door) {
      this._setFailure('openable_not_found', { command: sourceCommand });
      return false;
    }

   
    const distance = this._distanceToInteraction(door, gameState);

    if (distance > this._interactionReachPx()) {
      if (window.pathfindingSystem) {
        const path = interactionPath || this._findBestInteractionPath(door, gameState);
        if (!path) {
          this._setFailure('path_not_found', { targetId: door.id });
          return false;
        }
        window.updateGameState?.({
          player: {
            pathWaypoints: path,
            currentWaypoint: 0,
            isMoving: true,
            _pendingDoorOpen: { doorId: door.id },
            targetX: null,
            targetY: null,
            direction: this._directionFromTo(gameState.player.x, gameState.player.y, door.x, door.y)
          }
        });
      } else {
        window.updateGameState?.({
          player: {
            targetX: door.x,
            targetY: door.y,
            isMoving: true,
            _pendingDoorOpen: { doorId: door.id },
            direction: this._directionFromTo(gameState.player.x, gameState.player.y, door.x, door.y)
          }
        });
      }
      return true;
    }

   
    if (door.isLocked) {
      if (!gameState.player.inventory.includes(door.lockKey)) {
        this._setFailure('door_locked', { doorId: door.id, keyId: door.lockKey });
        this._emitMissingKeyMessage(door.lockKey, 'voice.door_locked_msg');
        return false;
      }
    }

   
    const flagKey = this._doorFlagKey(door);
   
    if (this._isDoorOpen(door, gameState)) {
      this._setFailure('door_already_open', { doorId: door.id });
      return false;
    }
    window.updateGameState?.({ world: { flags: { ...gameState.world.flags, [flagKey]: true } } });
    window.eventSystem?.emit('door:opened', { doorId: door.id });
    return true;
  }

  
  action_closeDoor(params) {
    const gameState = window.getGameState?.();
    if (!gameState) return false;

    const sourceCommand = String(params?._sourceCommand || '').toLowerCase();
    const isGenericDoorRequest = this._extractContentWords(sourceCommand).length <= 1;

    let door = null;
    if (params.doorId) {
      door = gameState.world.mapObjects?.find(o => o.id === params.doorId);
      if (door && isGenericDoorRequest && !this._isDoorOpen(door, gameState)) {
        door = null;
      }
    }
    if (!door) {
      const doors = (gameState.world.mapObjects || [])
        .filter(obj => this._isDoorObject(obj))
        .map(obj => ({
          id: obj.id,
          name: window.getText?.(`objects.object_${obj.objectId}`, 'pt')?.toLowerCase() || obj.id,
          obj,
        }));

      const chosen = this._pickPreferredActionTarget(sourceCommand, doors, gameState, {
        maxRadiusPx: this._autoResolveRadiusPx(),
        isPreferred: ({ obj }) => this._isDoorOpen(obj, gameState),
      }) || this._pickPreferredActionTarget('', doors, gameState, {
        maxRadiusPx: this._autoResolveRadiusPx(),
        isPreferred: ({ obj }) => this._isDoorOpen(obj, gameState),
      });

      door = chosen?.obj || null;
    }
    if (!door) {
      this._setFailure('openable_not_found', { command: sourceCommand });
      return false;
    }

    const distance = this._distanceToInteraction(door, gameState);
    if (distance > this._interactionReachPx()) {
      const path = this._findBestInteractionPath(door, gameState);
      if (!path) {
        this._setFailure('path_not_found', { targetId: door.id });
        return false;
      }
      window.updateGameState?.({
        player: {
          pathWaypoints: path,
          currentWaypoint: 0,
          isMoving: true,
          _pendingDoorClose: { doorId: door.id },
          targetX: null,
          targetY: null,
          direction: this._directionFromTo(gameState.player.x, gameState.player.y, door.x, door.y)
        }
      });
      return true;
    }

    const flagKey = this._doorFlagKey(door);

   
    if (!this._isDoorOpen(door, gameState)) {
      this._setFailure('door_already_closed', { doorId: door.id });
      return false;
    }
    window.updateGameState?.({ world: { flags: { ...gameState.world.flags, [flagKey]: false } } });
    window.eventSystem?.emit('door:closed', { doorId: door.id });
    return true;
  }

  
  _resolveContainerActionTarget(sourceCommand, gameState, containerId = null, { preferOpen = null } = {}) {
    let container = null;
    const isGenericContainerRequest = this._extractContentWords(sourceCommand).length <= 1;
    const matchesPreferredState = (obj) => {
      const isOpen = this._isContainerOpen(obj, gameState);
      if (preferOpen === true) return !obj?.alwaysOpen && isOpen;
      if (preferOpen === false) return !obj?.alwaysOpen && !isOpen;
      return true;
    };

    const allContainers = (gameState.world.mapObjects || []).filter(obj => this._isContainerObject(obj));

    if (isGenericContainerRequest) {
      const nearbyPreferred = allContainers
        .filter(obj => matchesPreferredState(obj))
        .map((obj) => ({
          obj,
          interactionDist: this._distanceToInteraction(obj, gameState),
          centerDist: this._distanceToObjectCenter(obj, gameState),
        }))
        .filter(({ centerDist }) => centerDist <= this._autoResolveRadiusPx())
        .sort((a, b) => {
          if (a.interactionDist !== b.interactionDist) return a.interactionDist - b.interactionDist;
          if (a.centerDist !== b.centerDist) return a.centerDist - b.centerDist;
          return String(a.obj.id).localeCompare(String(b.obj.id));
        });

      if (nearbyPreferred.length) {
        container = nearbyPreferred[0].obj;
      }
    }

    if (!container && containerId) {
      container = gameState.world.mapObjects?.find(o => o.id === containerId && this._isContainerObject(o)) || null;
      if (container && isGenericContainerRequest && !matchesPreferredState(container)) {
        container = null;
      }
    }

    if (!container) {
      const containers = allContainers.map(obj => ({
        id: obj.id,
        name: window.getText?.(`objects.object_${obj.objectId}`, 'pt')?.toLowerCase() || obj.id,
        obj,
      }));
      const best = this._pickPreferredActionTarget(sourceCommand, containers, gameState, {
        maxRadiusPx: this._autoResolveRadiusPx(),
        isPreferred: ({ obj }) => matchesPreferredState(obj),
      }) || this._pickPreferredActionTarget('', containers, gameState, {
        maxRadiusPx: this._autoResolveRadiusPx(),
        isPreferred: ({ obj }) => matchesPreferredState(obj),
      });
      container = best?.obj || null;
    }

    return container;
  }

  _queueDeferredContainerAction(container, gameState, pendingKey) {
    const path = this._findBestInteractionPath(container, gameState);
    if (!path) {
      this._setFailure('path_not_found', { targetId: container.id });
      return false;
    }

    window.updateGameState?.({
      player: {
        pathWaypoints: path,
        currentWaypoint: 0,
        isMoving: true,
        targetX: null,
        targetY: null,
        direction: this._directionFromTo(gameState.player.x, gameState.player.y, container.x, container.y),
        [pendingKey]: { containerId: container.id }
      }
    });
    return true;
  }

  _collectContainerDropCells(container, gameState, count = 1) {
    const pf = window.pathfindingSystem;
    if (!pf || !container || !gameState || count <= 0) return [];

    const cols = pf.GRID_COLS || 0;
    const rows = pf.GRID_ROWS || 0;
    const cell = pf.GRID_SIZE || 20;
    const walkable = pf.buildWalkableGrid(gameState);
    const queue = [];
    const seen = new Set();
    const occupied = new Set();

    for (const worldObj of gameState.world.objects || []) {
      if (worldObj?.taken) continue;
      const pos = pf.posToGrid(worldObj.x, worldObj.y);
      occupied.add(`${pos.x},${pos.y}`);
    }
    if (gameState.player) {
      const playerPos = pf.posToGrid(gameState.player.x, gameState.player.y);
      occupied.add(`${playerPos.x},${playerPos.y}`);
    }

    const push = (gx, gy) => {
      if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return;
      const key = `${gx},${gy}`;
      if (seen.has(key)) return;
      seen.add(key);
      queue.push({ gx, gy });
    };

    const seeds = this._interactionCandidatePositions(container)
      .map(({ x, y }) => pf.posToGrid(x, y));

    if (seeds.length) {
      seeds.forEach(({ x, y }) => push(x, y));
    } else {
      const center = pf.posToGrid(container.x, container.y);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => push(center.x + dx, center.y + dy));
    }

    const result = [];
    while (queue.length && result.length < count) {
      const { gx, gy } = queue.shift();
      const idx = gy * cols + gx;
      const key = `${gx},${gy}`;

      if (walkable[idx] === 1 && !occupied.has(key)) {
        result.push({
          gx,
          gy,
          x: gx * cell + cell / 2,
          y: gy * cell + cell / 2,
        });
        occupied.add(key);
      }

      [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dy]) => push(gx + dx, gy + dy));
    }

    return result;
  }

  _spillContainerContents(container, gameState) {
    if (!container || !gameState) return false;

    const storedItems = [...(gameState.world.surfaceItems?.[container.id] || [])];
    if (!storedItems.length) return false;

    const spillStamp = Date.now();
    const dropCells = this._collectContainerDropCells(container, gameState, storedItems.length);
    if (!dropCells.length) return false;

    const nextObjects = [...(gameState.world.objects || [])];
    const nextSurfaceItems = { ...(gameState.world.surfaceItems || {}) };
    const remainingItems = [];

    storedItems.forEach((itemId, index) => {
      const cell = dropCells[index];
      if (!cell) {
        remainingItems.push(itemId);
        return;
      }

      nextObjects.push({
        id: `obj_${itemId}_spill_${container.id}_${spillStamp}_${index}`,
        itemId,
        x: cell.x,
        y: cell.y,
        taken: false,
      });
      window.eventSystem?.emit('item:dropped', { itemId, x: cell.x, y: cell.y });
    });

    nextSurfaceItems[container.id] = remainingItems;
    window.updateGameState?.({ world: { objects: nextObjects, surfaceItems: nextSurfaceItems } });
    return true;
  }

  action_openContainer(params = {}) {
    const gameState = window.getGameState?.();
    if (!gameState) return false;

    const sourceCommand = String(params?._sourceCommand || '').toLowerCase();
    const container = this._resolveContainerActionTarget(sourceCommand, gameState, params.containerId || null, {
      preferOpen: false,
    });

    if (!container) {
      this._setFailure('container_not_found');
      return false;
    }

    const dist = this._distanceToInteraction(container, gameState);
    if (dist > this._interactionReachPx()) {
      return this._queueDeferredContainerAction(container, gameState, '_pendingOpenContainer');
    }

    return this._doOpenContainer(container.id);
  }

  action_closeContainer(params = {}) {
    const gameState = window.getGameState?.();
    if (!gameState) return false;

    const sourceCommand = String(params?._sourceCommand || '').toLowerCase();
    const container = this._resolveContainerActionTarget(sourceCommand, gameState, params.containerId || null, {
      preferOpen: true,
    });

    if (!container) {
      this._setFailure('container_not_found');
      return false;
    }

    const dist = this._distanceToInteraction(container, gameState);
    if (dist > this._interactionReachPx()) {
      return this._queueDeferredContainerAction(container, gameState, '_pendingCloseContainer');
    }

    return this._doCloseContainer(container.id);
  }

  _doOpenContainer(containerId) {
    const gs = window.getGameState?.();
    if (!gs) return false;
    const container = gs.world.mapObjects?.find(o => o.id === containerId);
    if (!container) return false;

    if (container.containerKey && !gs.player.inventory.includes(container.containerKey)) {
      this._setFailure('container_no_key', { containerId, keyId: container.containerKey });
      this._emitMissingKeyMessage(container.containerKey, 'voice.no_key');
      return false;
    }

    if (container.alwaysOpen) return true;

    const flagKey = this._containerFlagKey(container);
    if (!flagKey) return false;
    if (this._isContainerOpen(container, gs)) {
      return true;
    }

    window.updateGameState?.({
      world: {
        flags: {
          ...gs.world.flags,
          [flagKey]: true,
        },
      },
    });

    const freshState = window.getGameState?.() || gs;
    this._spillContainerContents(container, freshState);
    window.eventSystem?.emit('container:opened', { containerId });
    return true;
  }

  _doCloseContainer(containerId) {
    const gs = window.getGameState?.();
    if (!gs) return false;
    const container = gs.world.mapObjects?.find(o => o.id === containerId);
    if (!container) return false;
    if (container.alwaysOpen) return true;

    const flagKey = this._containerFlagKey(container);
    if (!flagKey) return false;

    if (!this._isContainerOpen(container, gs)) {
      return true;
    }

    window.updateGameState?.({
      world: {
        flags: {
          ...gs.world.flags,
          [flagKey]: false,
        },
      },
    });
    window.eventSystem?.emit('container:closed', { containerId });
    return true;
  }

  
  _tryTakeFromContainer(itemId, gameState) {
    const surfaceItems = gameState.world.surfaceItems || {};
    const candidates = [];
    for (const [containerId, items] of Object.entries(surfaceItems)) {
      if (!items.includes(itemId)) continue;
      const container = gameState.world.mapObjects?.find(o => o.id === containerId) || null;
      const isAlwaysOpen = !container || !this._isContainerObject(container) || !!container?.alwaysOpen;
      const isOpen = isAlwaysOpen || this._isContainerOpen(container, gameState);
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
        const path = this._findBestInteractionPath(container, gameState);
        if (!path) {
          this._setFailure('path_not_found', { targetId: container.id });
          return false;
        }
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

  
  extractContainerFromCommand(command, preferredIds = null) {
    const gs = window.getGameState?.();
    if (!gs) return null;
    const cmd = this._normalize(command);

    const candidates = [];
    for (const obj of gs.world.mapObjects || []) {
      if (!this._isContainerObject(obj)) continue;
      if (Array.isArray(preferredIds) && preferredIds.length && !preferredIds.includes(obj.id)) continue;
      const name = window.getText?.(`objects.object_${obj.objectId}`, 'pt')?.toLowerCase();
      if (name) candidates.push({ id: obj.id, name });
    }
    const mapped = candidates.map(c => ({
      ...c,
      obj: gs.world.mapObjects.find(o => o.id === c.id),
    }));
    const scored = this._pickBestByWeightedScore(cmd, mapped, gs, Infinity);
    if (scored?.semantic > 0) return scored.id;

   
    const hasContainerWord = this._normalizedIncludesAny(cmd, this._ptArray('voice.lexicon.container_terms', ['container']));

   
    const containers = (gs.world.mapObjects || []).filter(o => this._isContainerObject(o) && (!Array.isArray(preferredIds) || !preferredIds.length || preferredIds.includes(o.id)));
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

    if (hasContainerWord) return nearest?.id || null;
    return nearest?.id || null;
  }

  
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
          success = this.action_look(params);
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
        case 'close_container':
          success = this.action_closeContainer(params);
          break;
        case 'close_door':
          success = this.action_closeDoor(params);
          break;
        default:
          return false;
      }

      const freshState = window.getGameState?.();
      const deferred = success && this._hasDeferredMovement(freshState?.player || {});

      if (deferred) return true;

      if (success) {
        this._emitActionSuccess(actionId, params);
      } else {
        this._emitActionFailure(actionId, params);
      }

      return success;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  
  action_takeItem(params) {
    const gameState = window.getGameState?.();
    if (!gameState || !params.itemId) return false;

   
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
     
      if (window.pathfindingSystem) {
        const path = this._findBestInteractionPath(obj, gameState, params.itemId);

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
       
        window.updateGameState?.({
          player: { targetX: obj.x, targetY: obj.y, isMoving: true, _pendingItemPickup: params.itemId }
        });
      }
      
      return true;
    }

   
          window.inventorySystem?.addItem(params.itemId);

   
    const updatedObjects = gameState.world.objects.map(o => {
      if (o.itemId === params.itemId && !o.taken) {
        return { ...o, taken: true }; 
      }
      return o;
    });
    
   
    window.updateGameState?.({ world: { objects: updatedObjects } });

    window.eventSystem?.emit('item:taken', { itemId: params.itemId });
    return true;
  }

  _setFailure(code, meta = {}) {
    this.lastFailure = { code, meta, timestamp: Date.now() };
  }

  _normalize(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
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

    const synonymGroups = this._ptArray('voice.lexicon.synonym_groups', [['suit', 'uniform']]);
    if (synonymGroups.some(group => Array.isArray(group) && group.some(token => cw.startsWith(token)) && group.some(token => nw.startsWith(token)))) {
      return true;
    }

    const min = Math.min(cw.length, nw.length);
    if (min >= 4 && (cw.startsWith(nw) || nw.startsWith(cw))) return true;
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

  _termsFromText(value) {
    return String(value || '')
      .toLowerCase()
      .split(/[^A-Za-zÀ-ÿ0-9_]+/)
      .flatMap((part) => part.split('_'))
      .map((part) => this._normalizeWord(part))
      .filter((part) => part.length >= 3);
  }

  _entityTerms(entry, keyPrefix) {
    const terms = new Set();
    const key = `${keyPrefix}${entry.objectId || entry.name || ''}`;
    const namePt = window.getText?.(key, 'pt');
    const nameUi = window.getText?.(key);
    const variants = [namePt, nameUi, entry.objectId, entry.id, entry.name];
    for (const value of variants) {
      for (const term of this._termsFromText(value)) terms.add(term);
    }
    return [...terms];
  }

  _commandEntityMatchScore(commandWords, entityTerms) {
    if (!commandWords.length || !entityTerms.length) return 0;
    const alias = this._ptMap('voice.alias_terms', {});
    let score = 0;
    for (const cw of commandWords) {
      if (entityTerms.some((term) => this._wordFlexMatch(cw, term))) {
        score += 1;
        continue;
      }
      const mapped = alias[cw] || [];
      if (mapped.some((token) => entityTerms.some((term) => this._wordFlexMatch(token, term)))) {
        score += 1;
      }
    }
    return score;
  }

  _extractContentWords(command) {
    const stop = new Set(
      this._ptArray('voice.lexicon.content_stop_words', ['the', 'and', 'to', 'of', 'with'])
        .map((word) => this._normalizeWord(word))
        .filter(Boolean)
    );
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

  
  action_useItem(params) {
    if (!params.itemId) return false;

    const gameState = window.getGameState?.();
    if (!gameState?.player?.inventory?.includes(params.itemId)) {
      return false;
    }

    if (params.itemId === 'engineer_suit' && !gameState.player?.engineerSuit) {
      window.updateGameState?.({ player: { engineerSuit: true } });
    }

    window.eventSystem?.emit('item:used', {
      itemId: params.itemId,
      equipped: params.itemId === 'engineer_suit',
    });
    return true;
  }

  
  action_move(direction) {
    const gameState = window.getGameState?.();
    if (!gameState) return false;

    if (!direction) return false;

    const CELLS = 4;
    const px = gameState.player.x;
    const py = gameState.player.y;
    const moveActionId = `move_${direction}`;

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
    const desiredGX = Math.max(0, Math.min(cols - 1, start.x + dx * CELLS));
    const desiredGY = Math.max(0, Math.min(rows - 1, start.y + dy * CELLS));
    const desiredTarget = pf.gridToPos(desiredGX, desiredGY);

    const detourPath = pf.findPath(px, py, desiredTarget.x, desiredTarget.y, gameState);
    if (detourPath && detourPath.length > 0) {
      const nextDir = detourPath.length > 1
        ? this._directionFromTo(px, py, detourPath[0].x, detourPath[0].y)
        : faceDir;
      window.updateGameState?.({
        player: {
          pathWaypoints: detourPath,
          currentWaypoint: 0,
          isMoving: true,
          direction: nextDir || faceDir,
          targetX: null,
          targetY: null,
          _pendingMoveAction: { actionId: moveActionId },
        }
      });
      return true;
    }

    let gx = start.x;
    let gy = start.y;
    let moved = false;
    for (let step = 0; step < CELLS; step++) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) break;
      if (walkable[ny * cols + nx] !== 1) break;
      gx = nx;
      gy = ny;
      moved = true;
    }

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
        _pendingMoveAction: { actionId: moveActionId },
      }
    });
    return true;
  }

  
  action_checkInventory() {
    const gameState = window.getGameState?.();
    if (!gameState?.player?.inventory) return false;

    const inv = gameState.player.inventory;
    window.eventSystem?.emit('inventory:checked', { inventory: inv });
    return true;
  }

  
  action_look(params = {}) {
    const gameState = window.getGameState?.();
    if (!gameState) return false;

    if (params?.focus === 'pockets') {
      const questPocketResult = window.questSystem?.handlePocketInspection?.() || { handled: false };
      if (!questPocketResult.handled) {
        const text = window.getText?.('fox.pockets_empty', 'ru');
        if (text && text !== 'fox.pockets_empty') {
          window.eventSystem?.emit('fox:say', { text });
        }
      }
      return true;
    }

    const objects = gameState.world.objects.filter(o => !o.taken);

    window.eventSystem?.emit('world:looked', { objects });
    return true;
  }

  
  action_help() {
    window.eventSystem?.emit('help:shown');
    return true;
  }

  
  getLastAction() {
    return this.lastAction;
  }
}

const actionSystem = new ActionSystem();
window.actionSystem = actionSystem;

if (window.eventSystem) {
  window.eventSystem.emit('system:action-loaded');
}
