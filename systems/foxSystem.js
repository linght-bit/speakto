class FoxSystem {
  constructor() {
    this._message = null;
    this.lastBadToken = null;
    this._offTaskCount = 0;
    this._setupOffTaskListeners();
  }

  
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
     
      this._hintItem(command, 'drop_item');
      return false;
    }

    if (actionId === 'put_on_surface') {
      if (!params.itemId) { this._hintItem(command, 'put_on_surface'); return false; }
     
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

   
    const target = this._guessApproachTarget(command);
    if (target) {
      const tmpl = this._t('fox.hint_approach_to_target');
      if (tmpl && tmpl !== 'fox.hint_approach_to_target') {
        this._say(tmpl.replace('{target}', target));
        return;
      }
    }

   
    const item = this._guessBestItem(command);
    if (item) {
     
      const gs = window.getGameState?.();
      if (gs?.player?.inventory?.includes(item.id)) {
        this._say(this._t('fox.already_have').replace('{item}', (item.ruName || item.name).toLowerCase()));
        return;
      }
      const tmpl = this._t('fox.hint_found_item');
      if (tmpl && tmpl !== 'fox.hint_found_item') {
        const hint = this._buildSimpleTakeHint(item.id);
        this._say(
          tmpl
            .replace(/\{item\}/g, (item.ruName || item.name).toLowerCase())
            .replace(/\{hint\}/g, hint)
        );
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

       
        const basePtName = options.length
          ? options[0].toLowerCase().split(/\s+/)[0]
          : (failure.meta?.requested || '');

       
        const inInventory = options.filter(optName => {
          const item = allItems.find(i => {
            const n = window.getText?.(`items.${i.name}`, 'pt')?.toLowerCase();
            return n === optName.toLowerCase() || n?.startsWith(optName.toLowerCase());
          });
          return item && inventory.includes(item.id);
        });

        if (inInventory.length === 0) {
         
          this._say(this._t('fox.item_not_in_inventory').replace('{item}', basePtName));
        } else if (inInventory.length === 1) {
         
          const surfaceName = (() => {
            if (actionId !== 'put_on_surface' || !params.surfaceId) return null;
            const s = gs?.world?.mapObjects?.find(o => o.id === params.surfaceId);
            if (!s) return null;
            return window.getText?.(`objects.object_${s.objectId}`, 'pt')?.toLowerCase();
          })();
          const suggestion = surfaceName
            ? this._ptTemplate('put_on_surface', { surface: surfaceName, item: inInventory[0] })
            : this._ptTemplate('take_with_item', { item: inInventory[0] });
          this._say(this._t('fox.hint_did_you_mean').replace('{cmd}', suggestion));
        } else {
         
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
      case 'door_locked': {
        const keyName = this._getItemName(failure.meta?.keyId || '', 'ru').toLowerCase();
        const template = this._pickTextVariant('fox.door_locked_need_key_variants');
        if (template) {
          this._say(template.replace(/\{key\}/g, keyName));
        }
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

        const bagTerms = window.getText?.('voice.lexicon.bag_terms', 'pt');
        if (stage === 'q2_check_pockets' && Array.isArray(bagTerms) && bagTerms.some((term) => normalizedWord.includes(this._normalizeWord(term)))) {
          const hint = this._t('quests.q2_wrong_bag_hint');
          if (hint && hint !== 'quests.q2_wrong_bag_hint') {
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
        const fallback = this._pickTextVariant('fox.unknown_word_variants');
        if (fallback) {
          this._say(fallback.replaceAll('{word}', word), word);
        }
        return;
      }
      default:
        return;
    }
  }

 

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
    const containerName = this._getContainerName(loc.containerObj, 'ru');
    const hint = this._buildOpenContainerHint(loc.containerObj);
    const tmpl = this._t('fox.hint_open_chest');
    if (tmpl && tmpl !== 'fox.hint_open_chest') {
      this._say(
        tmpl
          .replace(/\{container\}/g, containerName)
          .replace(/\{hint\}/g, hint)
      );
    }
  }

  _pickTextVariant(key) {
    const value = this._t(key);
    if (Array.isArray(value) && value.length) {
      return value[Math.floor(Math.random() * value.length)];
    }
    return typeof value === 'string' ? value : '';
  }

  _resolveCommandRefs(text) {
    return String(text || '').replace(/\{cmd\.([a-z0-9_]+)\}/gi, (_, token) => {
      const exampleKey = `voice.command_examples.${token}`;
      const example = window.getText?.(exampleKey, 'pt');
      if (example && example !== exampleKey) return String(example);
      const templateKey = `voice.templates.${token}`;
      const template = window.getText?.(templateKey, 'pt');
      if (template && template !== templateKey) return String(template);
      return '';
    });
  }

  _ptTemplate(key, params = {}) {
    const templateKey = `voice.templates.${key}`;
    let template = window.getText?.(templateKey, 'pt');
    if (!template || template === templateKey) return '';
    for (const [paramKey, paramValue] of Object.entries(params)) {
      template = template.replaceAll(`{${paramKey}}`, String(paramValue ?? ''));
    }
    return String(template);
  }

  _articleForPtName(name) {
    const normalized = String(name || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const endings = window.getText?.('voice.lexicon.feminine_endings', 'pt');
    const articles = window.getText?.('voice.lexicon.articles', 'pt');
    const feminine = articles?.feminine || '';
    const masculine = articles?.masculine || '';
    if (Array.isArray(endings) && endings.some((ending) => normalized.endsWith(String(ending)))) {
      return feminine || masculine;
    }
    return masculine || feminine;
  }

  _getItemHintName(itemId, lang = 'pt') {
    const hintKey = `items.item_${itemId}_hint`;
    const hinted = window.getText?.(hintKey, lang);
    if (hinted && hinted !== hintKey) return String(hinted).toLowerCase();

    const fullName = this._getItemName(itemId, lang);
    return String(fullName || itemId)
      .toLowerCase()
      .split(/\s+(?:do|da|de|dos|das)\s+/i)[0]
      .trim();
  }

  _buildSimpleTakeHint(itemId) {
    const name = this._getItemHintName(itemId, 'pt');
    const article = this._articleForPtName(name);
    return this._ptTemplate('take_item', { article, item: name }) || name;
  }

  _buildOpenContainerHint(containerObj) {
    const containerName = this._getContainerName(containerObj, 'pt');
    return this._ptTemplate('open_container', { container: containerName }) || containerName;
  }

  
  _findItemLocation(itemId) {
    const gs = window.getGameState?.();
    if (!gs) return null;
    if (gs.player.inventory?.includes(itemId)) return { type: 'inventory' };
    const onGround = (gs.world.objects || []).find(o => o.itemId === itemId && !o.taken);
    if (onGround) return { type: 'ground' };
    for (const [containerId, items] of Object.entries(gs.world.surfaceItems || {})) {
      if (items.includes(itemId)) {
        const containerObj = (gs.world.mapObjects || []).find(o => o.id === containerId);
       
       
        const isContainer = containerObj?.isContainer === true;
        const isOpen = !isContainer || !!gs.world.flags?.[`container_open_${containerId}`];
        return { type: 'surface', containerId, containerObj, isOpen };
      }
    }
    return null;
  }

  
  _findClosestAvailableItem(targetItemId) {
    const gs = window.getGameState?.();
    if (!gs) return null;
    const available = new Set();
    (gs.world.objects || []).forEach(o => { if (!o.taken) available.add(o.itemId); });
    for (const [cid, items] of Object.entries(gs.world.surfaceItems || {})) {
      if (gs.world.flags?.[`container_open_${cid}`]) {
        items.forEach(id => available.add(id));
      }
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

  
  _guessBestItem(command) {
    const items = window.itemsData?.items || [];
    const cmdWords = command.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
    let best = null;
    let bestScore = -1;

    for (const item of items) {
      const key = `items.${item.name}`;
      const ptName = window.getText?.(key, 'pt');
      if (!ptName || ptName === key) continue;
      const nameWords = ptName.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
      if (!nameWords.length) continue;
      let hits = 0;
      for (const nw of nameWords) {
        if (cmdWords.some(cw => cw === nw || cw.startsWith(nw) || nw.startsWith(cw))) hits++;
      }
      if (!hits) continue;
      const score = hits / nameWords.length + nameWords.length * 0.01;
      if (score > bestScore) {
        bestScore = score;
        best = {
          id: item.id,
          name: ptName,
          ruName: window.getText?.(key, 'ru') || ptName,
        };
      }
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

  _getItemName(itemId, lang = 'ru') {
    const key = `items.item_${itemId}`;
    const name = window.getText?.(key, lang);
    return (name && name !== key) ? name : itemId;
  }

  _getContainerName(containerObj, lang = 'ru') {
    if (!containerObj) return this._t('fox.container_generic');
    const key = `objects.object_${containerObj.objectId}`;
    const name = window.getText?.(key, lang);
    return (name && name !== key) ? name.toLowerCase() : this._t('fox.container_generic');
  }

  _findContainerById(containerId) {
    const gs = window.getGameState?.();
    if (!gs || !containerId) return null;
    return (gs.world.mapObjects || []).find(o => o.id === containerId) || null;
  }

 

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

   
    const neutral = new Set(['check_inventory', 'help', 'look', 'talk_npc']);
    if (neutral.has(actionId)) return;

    const expected = window.questSystem?.currentExpectedActions?.();
    if (!expected) return;

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
    const phrase = this._pickTextVariant('fox.off_task_variants');
    if (!phrase) return;
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

   
    const taskStates = state?.quests?.taskStates || {};
    const pendingTask = (quest.tasks || []).find(t => !taskStates[t.id]);
    if (!pendingTask?.voiceHintKey) return null;
    const text = window.getText?.(pendingTask.voiceHintKey, 'ru');
    if (!text || text === pendingTask.voiceHintKey) return null;
    return this._extractVoiceCommandLine(text);
  }

  _extractVoiceCommandLine(text) {
   
    const lines = (text || '').split('\n');
    return lines.find(line => /[a-z]{4,}/i.test(line)) || null;
  }

  _t(key) {
    const text = window.getText?.(key, 'ru');
    if (!text || text === key) return key;
    if (Array.isArray(text)) {
      return text.map((entry) => this._resolveCommandRefs(entry));
    }
    return this._resolveCommandRefs(text);
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
