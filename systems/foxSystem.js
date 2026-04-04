/**
 * /systems/foxSystem.js
 * СИСТЕМА ПОМОЩНИКА — ЛИСЁНОК
 */

class FoxSystem {
  constructor() {
    this._message = null;
    this.lastBadToken = null;
    this._offTaskCount = 0;
    this._setupOffTaskListeners();
  }

  /**
   * Вызывается из actionSystem.processCommand ДО executeAction.
   * @returns {boolean} true = разрешить выполнение, false = заблокировать + показать подсказку
   */
  evaluate(command, actionId, params) {
    const noObjectActions = [
      'move_left', 'move_right', 'move_up', 'move_down',
      'check_inventory', 'help', 'look', 'talk_npc'
    ];
    if (noObjectActions.includes(actionId)) return true;

    if (['take_item', 'use_item'].includes(actionId)) {
      if (!params.itemId) {
        this._hintItem(command, actionId);
        return false;
      }
      // Проверяем доступность предмета в игровом мире
      const loc = this._findItemLocation(params.itemId);
      if (loc === null) {
        this._hintItemUnavailable(command, params.itemId);
        return false;
      }
      if (loc.type === 'surface' && !loc.isOpen) {
        this._hintOpenContainer(loc);
        return false;
      }
      if (loc.type === 'inventory') {
        const tmpl = this._t('fox.already_have');
        if (tmpl && tmpl !== 'fox.already_have') {
          this._say(tmpl.replace('{item}', this._getItemName(params.itemId)));
        }
        return false;
      }
    }

    if (actionId === 'drop_item' && !params.itemId) {
      const gs = window.getGameState?.();
      if (!gs?.player?.inventory?.length) {
        this._say(this._t('fox.no_item_to_drop'));
        return false;
      }
      // Есть предметы, но не назван конкретный — спрашиваем
      this._hintItem(command, 'drop_item');
      return false;
    }

    if (actionId === 'put_on_surface') {
      if (!params.itemId) { this._hintItem(command, 'put_on_surface'); return false; }
      // Проверяем есть ли предмет в инвентаре
      const gs0 = window.getGameState?.();
      if (params.itemId && !gs0?.player?.inventory?.includes(params.itemId)) {
        const itemPtName = window.getText?.(`items.item_${params.itemId}`, 'pt') || params.itemId;
        this._say(this._t('fox.item_not_in_inventory').replace('{item}', itemPtName.toLowerCase()));
        return false;
      }
    }

    if (actionId === 'close_door' && !params.doorId) {
      this._say(this._t('fox.no_door'));
      return false;
    }

    return true;
  }

  onNoAction(command) {
    const suggestion = window.actionSystem?.suggestCommand?.(command);
    if (suggestion) {
      this._say(this._t('fox.hint_did_you_mean').replace('{cmd}', suggestion));
      return;
    }

    // 1. Проверяем — может, слово совпадает с названием объекта карты (стол, дверь...)
    const target = this._guessApproachTarget(command);
    if (target) {
      const tmpl = this._t('fox.hint_approach_to_target');
      if (tmpl && tmpl !== 'fox.hint_approach_to_target') {
        this._say(tmpl.replace('{target}', target));
        return;
      }
    }

    // 2. Проверяем — может, слово совпадает с названием предмета (balde, maçã...)
    const item = this._guessBestItem(command);
    if (item) {
      // Если предмет уже в инвентаре — сообщаем об этом, а не предлагаем взять
      const gs = window.getGameState?.();
      if (gs?.player?.inventory?.includes(item.id)) {
        this._say(this._t('fox.already_have').replace('{item}', item.name.toLowerCase()));
        return;
      }
      const tmpl = this._t('fox.hint_found_item');
      if (tmpl && tmpl !== 'fox.hint_found_item') {
        this._say(tmpl.replace(/\{item\}/g, item.name.toLowerCase()));
        return;
      }
    }

  }

  onActionFailed(actionId, params = {}, failure = null) {
    if (!failure?.code) return;

    switch (failure.code) {
      case 'container_no_key': {
        const containerObj = this._findContainerById(failure.meta?.containerId);
        const text = this._t('fox.need_key_for_container');
        const keyName = this._getItemName(failure.meta?.keyId || '');
        this._say(
          text
            .replace('{container}', this._getContainerName(containerObj))
            .replace('{key}', keyName)
        );
        return;
      }
      case 'item_in_closed_container': {
        const containerObj = this._findContainerById(failure.meta?.containerId);
        this._hintOpenContainer({ containerObj });
        return;
      }
      case 'item_not_found_anywhere': {
        const itemId = failure.meta?.itemId || params.itemId;
        if (itemId) this._hintItemUnavailable('', itemId);
        return;
      }
      case 'item_variant_not_found': {
        const options = failure.meta?.options || [];
        const gs = window.getGameState?.();
        const inventory = gs?.player?.inventory || [];
        const allItems = window.itemsData?.items || [];

        // Базовое имя предмета — первое слово первого варианта: «chave» из «chave vermelha»
        const basePtName = options.length
          ? options[0].toLowerCase().split(/\s+/)[0]
          : (failure.meta?.requested || '');

        // Ищем среди опций те, что есть в инвентаре игрока
        const inInventory = options.filter(optName => {
          const item = allItems.find(i => {
            const n = window.getText?.(`items.${i.name}`, 'pt')?.toLowerCase();
            return n === optName.toLowerCase() || n?.startsWith(optName.toLowerCase());
          });
          return item && inventory.includes(item.id);
        });

        if (inInventory.length === 0) {
          // Ни одного подходящего предмета
          this._say(this._t('fox.item_not_in_inventory').replace('{item}', basePtName));
        } else if (inInventory.length === 1) {
          // Ровно один — предлагаем уточнённую команду
          const surfaceName = (() => {
            if (actionId !== 'put_on_surface' || !params.surfaceId) return null;
            const s = gs?.world?.mapObjects?.find(o => o.id === params.surfaceId);
            if (!s) return null;
            return window.getText?.(`objects.object_${s.objectId}`, 'pt')?.toLowerCase();
          })();
          const suggestion = surfaceName
            ? `coloca na ${surfaceName} a ${inInventory[0]}`
            : `pega a ${inInventory[0]}`;
          this._say(this._t('fox.hint_did_you_mean').replace('{cmd}', suggestion));
        } else {
          // Несколько вариантов — перечисляем
          this._say(this._t('fox.hint_which_item').replace('{options}', inInventory.join(', ')));
        }
        return;
      }
      case 'target_variant_not_found': {
        const options = (failure.meta?.options || []).slice(0, 6).join(', ');
        const requested = failure.meta?.requested || '';
        const text = this._t('fox.target_variant_not_found')
          .replace('{requested}', requested)
          .replace('{options}', options || this._t('fox.no_options'));
        this._say(text);
        return;
      }
      case 'door_already_open':
        this._say(this._t('fox.door_already_open'));
        return;
      case 'door_already_closed':
        this._say(this._t('fox.door_already_closed'));
        return;
      case 'approach_target_missing':
        this._say(this._t('fox.say_target_name'));
        return;
      case 'container_not_found':
        this._say(this._t('fox.no_container'));
        return;
      case 'approach_target_not_found':
        this._say(this._t('fox.target_not_found'));
        return;
      case 'path_not_found':
        this._say(this._t('fox.path_not_found'));
        return;
      case 'openable_not_found':
        this._say(this._t('fox.no_door'));
        return;
      case 'unknown_word': {
        const word = failure.meta?.word || '?';
        const suggestion = failure.meta?.suggestion;
        const stage = window.getGameState?.()?.quests?.progress?.stage || null;
        const normalizedWord = String(word || '').toLowerCase();

        if (stage === 'q2_check_pockets' && /bolsa/.test(normalizedWord)) {
          const hint = window.getText?.('quests.q2_bolsas_hint');
          if (hint && hint !== 'quests.q2_bolsas_hint') {
            this._say(hint, word);
            return;
          }
        }

        if (suggestion) {
          const tmpl = this._t('fox.hint_did_you_mean');
          this._say(tmpl.replace('{cmd}', suggestion), word);
          return;
        }
        if (Math.random() > 0.3) return;
        const unknownPhrases = [
          `Ты уверен, что хотел сказать "${word}"?`,
          `Здесь нет "${word}".`,
          `Ты точно сказал "${word}"? Я такого здесь не вижу.`,
          `Хм… "${word}"? Возможно, ты имел в виду что-то другое?`,
          `Я не нахожу "${word}" поблизости. Попробуешь ещё раз?`,
          `Здесь нет "${word}". Может, осмотримся внимательнее?`,
          `"${word}"? Странно… я такого объекта не фиксирую.`,
          `Не вижу ничего похожего на "${word}".`,
          `"${word}" не обнаружено. Хочешь сказать что-то другое?`,
          `Кажется, "${word}" здесь отсутствует. Попробуй иначе сформулировать.`,
        ];
        this._say(unknownPhrases[Math.floor(Math.random() * unknownPhrases.length)], word);
        return;
      }
      default:
        return;
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  _hintItem(command, actionId) {
    const guessed = this._guessBestItem(command);
    const templateKey = actionId === 'put_on_surface' ? 'fox.hint_put'
      : actionId === 'drop_item' ? 'fox.hint_drop'
      : 'fox.hint_take';
    let template = this._t(templateKey);
    if (!template || template === templateKey) template = this._t('fox.say_item_name');
    if (guessed && template?.includes('{item}')) {
      this._say(template.replace('{item}', guessed.name));
    } else {
      this._say(template || this._t('fox.say_item_name'));
    }
  }

  _hintItemUnavailable(command, itemId) {
    const itemName = this._getItemName(itemId);
    const alt = this._findClosestAvailableItem(itemId);
    if (alt) {
      const tmpl = this._t('fox.item_unavailable');
      this._say(tmpl.replace('{item}', itemName).replace('{alt}', alt.name));
      return;
    }
    const noAlt = this._t('fox.item_unavailable_no_alt');
    this._say(noAlt.replace('{item}', itemName));
  }

  _hintOpenContainer(loc) {
    const containerName = this._getContainerName(loc.containerObj);
    const tmpl = this._t('fox.hint_open_chest');
    if (tmpl && tmpl !== 'fox.hint_open_chest') {
      this._say(tmpl.replace(/\{container\}/g, containerName));
    }
  }

  /** Определить, где находится предмет: inventory / ground / surface / null (нет в мире) */
  _findItemLocation(itemId) {
    const gs = window.getGameState?.();
    if (!gs) return null;
    if (gs.player.inventory?.includes(itemId)) return { type: 'inventory' };
    const onGround = (gs.world.objects || []).find(o => o.itemId === itemId && !o.taken);
    if (onGround) return { type: 'ground' };
    for (const [containerId, items] of Object.entries(gs.world.surfaceItems || {})) {
      if (items.includes(itemId)) {
        const containerObj = (gs.world.mapObjects || []).find(o => o.id === containerId);
        // Только реальные контейнеры (сундуки) требуют открытия.
        // Поверхности без замка (стол, колодец) считаются всегда открытыми.
        const isContainer = containerObj?.isContainer === true;
        const isOpen = !isContainer || gs.world.containerStates?.[containerId] === 'open';
        return { type: 'surface', containerId, containerObj, isOpen };
      }
    }
    return null;
  }

  /** Найти похожий предмет, который сейчас доступен (на полу или в открытом контейнере) */
  _findClosestAvailableItem(targetItemId) {
    const gs = window.getGameState?.();
    if (!gs) return null;
    const available = new Set();
    (gs.world.objects || []).forEach(o => { if (!o.taken) available.add(o.itemId); });
    for (const [cid, items] of Object.entries(gs.world.surfaceItems || {})) {
      if (gs.world.containerStates?.[cid] === 'open') items.forEach(id => available.add(id));
    }
    if (!available.size) return null;

    const targetName = this._getItemName(targetItemId).toLowerCase();
    const targetWords = targetName.split(/\s+/).filter(w => w.length >= 3);
    let best = null;
    let bestScore = 0;

    for (const itemId of available) {
      if (itemId === targetItemId) continue;
      const rawName = window.getText?.(`items.item_${itemId}`, 'ru');
      if (!rawName || rawName === `items.item_${itemId}`) continue;
      const nameWords = rawName.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
      let hits = 0;
      for (const tw of targetWords) {
        if (nameWords.some(nw => nw === tw || nw.startsWith(tw) || tw.startsWith(nw))) hits++;
      }
      if (!hits) continue;
      const score = (targetWords.length ? hits / targetWords.length : 0) + nameWords.length * 0.01;
      if (score > bestScore) { bestScore = score; best = { id: itemId, name: rawName }; }
    }
    return best;
  }

  /** Нечёткий поиск предмета по словам команды. Возвращает { id, name } или null. */
  _guessBestItem(command) {
    const items = window.itemsData?.items || [];
    const cmdWords = command.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
    let best = null;
    let bestScore = -1;

    for (const item of items) {
      const key = `items.${item.name}`;
      const name = window.getText?.(key, 'pt');
      if (!name || name === key) continue;
      const nameWords = name.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
      if (!nameWords.length) continue;
      let hits = 0;
      for (const nw of nameWords) {
        if (cmdWords.some(cw => cw === nw || cw.startsWith(nw) || nw.startsWith(cw))) hits++;
      }
      if (!hits) continue;
      const score = hits / nameWords.length + nameWords.length * 0.01;
      if (score > bestScore) { bestScore = score; best = { id: item.id, name }; }
    }
    return best;
  }

  _normalizeWord(word) {
    return (word || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  _guessApproachTarget(command) {
    const gs = window.getGameState?.();
    if (!gs) return null;

    const cmdWords = (command || '')
      .toLowerCase()
      .split(/\s+/)
      .map(w => this._normalizeWord(w))
      .filter(w => w.length >= 3);

    for (const obj of gs.world.mapObjects || []) {
      const key = `objects.object_${obj.objectId}`;
      const raw = window.getText?.(key, 'pt');
      if (!raw || raw === key) continue;

      const words = raw.toLowerCase().split(/\s+/).map(w => this._normalizeWord(w)).filter(w => w.length >= 3);
      if (!words.length) continue;

      const hit = words.some(w => cmdWords.some(cw => cw === w || cw.startsWith(w) || w.startsWith(cw)));
      if (hit) return raw.toLowerCase();
    }

    return null;
  }

  _getItemName(itemId) {
    const key = `items.item_${itemId}`;
    const name = window.getText?.(key, 'ru');
    return (name && name !== key) ? name : itemId;
  }

  _getContainerName(containerObj) {
    if (!containerObj) return this._t('fox.container_generic');
    const key = `objects.object_${containerObj.objectId}`;
    const name = window.getText?.(key, 'ru');
    return (name && name !== key) ? name.toLowerCase() : this._t('fox.container_generic');
  }

  _findContainerById(containerId) {
    const gs = window.getGameState?.();
    if (!gs || !containerId) return null;
    return (gs.world.mapObjects || []).find(o => o.id === containerId) || null;
  }

  // ── Off-task motivator ────────────────────────────────────────────────────

  _setupOffTaskListeners() {
    if (!window.eventSystem) return;
    window.eventSystem.on('action:executed', ({ actionId }) => {
      this._trackOffTask(actionId, { success: true });
    });
    window.eventSystem.on('action:failed', ({ actionId }) => {
      this._trackOffTask(actionId, { success: false });
    });
    window.eventSystem.on('action:notFound', () => {
      this._trackOffTask(null, { success: false });
    });
    window.eventSystem.on('quest:activated', () => {
      this._offTaskCount = 0;
    });
    window.eventSystem.on('quest:tasksChanged', () => {
      this._offTaskCount = 0;
    });
    window.eventSystem.on('quest:completed', () => {
      this._offTaskCount = 0;
    });
  }

  _trackOffTask(actionId, { success = false } = {}) {
    if (success) {
      this._offTaskCount = 0;
      return;
    }

    // Информационные действия не считаются отклонением
    const neutral = new Set(['check_inventory', 'help', 'look', 'talk_npc']);
    if (neutral.has(actionId)) return;

    const expected = window.questSystem?.currentExpectedActions?.();
    if (!expected) return; // нет активной задачи с ожидаемыми действиями

    if (expected.includes(actionId)) {
      this._offTaskCount = 0;
      return;
    }

    this._offTaskCount++;
    if (this._offTaskCount >= 5) {
      this._offTaskCount = 0;
      this._sayMotivatingPhrase();
    }
  }

  _sayMotivatingPhrase() {
    const phrases = [
      'Я могу продолжать смотреть, как ты импровизируешь…\nНо если хочешь выжить — лучше делай как я говорю.',
      'Без меня ты двигаешься.\nСо мной — контролируешь ситуацию.\nРазница станет критичной очень скоро.',
      'Я не тороплю тебя.\nПросто напоминаю: время работает не на нас.',
      'Ты можешь продолжать так.\nНо тогда это уже не план — это эксперимент.',
      'Я наблюдаю.\nИ пока результаты… нестабильные.',
      'Ты справляешься.\nВопрос — как долго.',
      'Это работает.\nНо не настолько хорошо, чтобы я расслабился.',
      'Ты сейчас выбираешь между "как-нибудь" и "как надо".\nПоследствия у них разные.',
      'Я могу не вмешиваться.\nНо тогда не жди хорошего исхода.',
      'Ты действуешь.\nЯ предлагаю делать это осмысленно.',
      'Ошибки допустимы.\nПовторяющиеся — заметны.',
      'Мы можем идти медленно.\nНо лучше — не вслепую.',
      'Я не настаиваю.\nЯ просто вижу, к чему это ведёт.',
      'Ты всё ещё в безопасности.\nНо это состояние временное.',
    ];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    const hint = this._getCurrentQuestVoiceHint();
    this._say(hint ? `${phrase}\n${hint}` : phrase);
  }

  _getCurrentQuestVoiceHint() {
    const qs = window.questSystem;
    if (!qs) return null;
    const quest = qs._getCurrentQuest?.();
    if (!quest) return null;
    const state = window.getGameState?.();
    const stage = state?.quests?.progress?.stage;

    if (stage === 'movement_training') {
      const done = state?.quests?.progress?.movementDone || {};
      const order = ['move_down', 'move_up', 'move_right', 'move_left'];
      const nextActionId = order.find(id => !done[id]);
      if (!nextActionId) return null;
      const textKey = quest.walkPromptKeys?.[nextActionId];
      if (!textKey) return null;
      const text = window.getText?.(textKey, 'ru');
      if (!text || text === textKey) return null;
      return this._extractVoiceCommandLine(text);
    }

    // Для будущих квестов: voiceHintKey в задаче
    const taskStates = state?.quests?.taskStates || {};
    const pendingTask = (quest.tasks || []).find(t => !taskStates[t.id]);
    if (!pendingTask?.voiceHintKey) return null;
    const text = window.getText?.(pendingTask.voiceHintKey, 'ru');
    if (!text || text === pendingTask.voiceHintKey) return null;
    return this._extractVoiceCommandLine(text);
  }

  _extractVoiceCommandLine(text) {
    // Ищем строку, содержащую голосовую команду — хотя бы 4 последовательных буквы латиницей
    const lines = (text || '').split('\n');
    return lines.find(line => /[a-z]{4,}/i.test(line)) || null;
  }

  _t(key) {
    const text = window.getText?.(key, 'ru');
    return (text && text !== key) ? text : key;
  }

  _say(text, badToken = null) {
    if (!text) return;
    this._message = { text, until: Date.now() + 4500 };
    this.lastBadToken = badToken || null;
    window.eventSystem?.emit('fox:say', { text, badToken: badToken || null });
  }

  getMessage() {
    if (!this._message) return null;
    if (Date.now() > this._message.until) { this._message = null; return null; }
    return this._message.text;
  }
}

const foxSystem = new FoxSystem();
window.foxSystem = foxSystem;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = foxSystem;
}
