class QuestSystem {
  constructor() {
    this.quests = [];
    this.questById = new Map();
    this.micHighlight = false;
    this._pendingDialogId = null;
    this.setupListeners();
  }

  loadQuests(questsData) {
    this.quests = Array.isArray(questsData) ? questsData : (questsData?.quests || []);
    this.questById = new Map(this.quests.map(quest => [quest.id, quest]));
  }

  activateQuest(questId) {
    this._patchQuests((draft) => {
      if (!draft.active.includes(questId) && !draft.completed.includes(questId)) {
        draft.active.push(questId);
      }
      draft.current = questId;
      return draft;
    });
    window.eventSystem?.emit('quest:activated', { questId });
    window.eventSystem?.emit('quest:tasksChanged');
  }

  completeQuest(questId) {
    this._patchQuests((draft) => {
      draft.active = draft.active.filter(id => id !== questId);
      if (!draft.completed.includes(questId)) {
        draft.completed.push(questId);
      }
      return draft;
    });
    window.eventSystem?.emit('quest:completed', { questId });
    window.eventSystem?.emit('quest:tasksChanged');
  }

  isMicHintActive() {
    return !!this.micHighlight;
  }

  getTrackedTasks() {
    const state = this._state();
    const quest = this._getCurrentQuest();
    const showTasks = !!state?.quests?.progress?.showTasks;
    if (!quest || !showTasks) return [];

    const taskStates = state?.quests?.taskStates || {};
    return (quest.tasks || []).map(task => ({
      id: task.id,
      textKey: task.textKey,
      completed: !!taskStates[task.id],
    }));
  }

  setupListeners() {
    if (!window.eventSystem) return;

    window.eventSystem.on('game:initialized', () => {
      this.startIntroFlow();
    });

    window.eventSystem.on('voice:recognized', ({ transcript }) => {
      this.handleVoiceRecognized(transcript || '');
    });

    window.eventSystem.on('action:executed', ({ actionId, params }) => {
      this.handleActionExecuted(actionId, params || {});
    });

    window.eventSystem.on('action:failed', ({ actionId, params, failureCode }) => {
      this.handleActionFailed(actionId, params || {}, failureCode || null);
    });

    window.eventSystem.on('player:approachArrived', ({ targetId }) => {
      this.handleApproachArrived(targetId);
    });

    window.eventSystem.on('container:opened', ({ containerId }) => {
      this.onContainerOpened(containerId);
    });

    window.eventSystem.on('door:opened', ({ doorId }) => {
      this.onDoorOpened(doorId);
    });

    window.eventSystem.on('quest:dialogContinue', ({ dialogId }) => {
      this.handleDialogContinue(dialogId);
    });
  }

  startIntroFlow() {
    const quest = this.quests[0];
    const state = this._state();
    if (!quest || state?.quests?.progress?.stage) return;

    if (window.voiceSystem?.isListening) {
      window.voiceSystem.stop();
    }

    this.micHighlight = true;
    window.eventSystem?.emit('quest:micHighlight', { active: true });

    this._patchQuests((draft) => {
      draft.current = quest.id;
      draft.progress = {
        ...(draft.progress || {}),
        stage: 'await_ola',
        showTasks: false,
        movementDone: {},
      };
      draft.taskStates = { ...(draft.taskStates || {}) };
      return draft;
    });

    this._prepareQuest2Environment();

    window.eventSystem?.emit('quest:actBanner', { textKey: quest.actTitleKey });

    const introText = (quest.introFoxKeys || [])
      .map(textKey => this._formatText(textKey))
      .filter(Boolean)
      .join('\n');

    if (introText) {
      window.setTimeout(() => {
        window.eventSystem?.emit('fox:say', { text: introText });
      }, 350);
    }
  }

  handleVoiceRecognized(transcript) {
    const quest = this._getCurrentQuest();
    const stage = this._state()?.quests?.progress?.stage;
    const normalized = this._norm(transcript);
    if (!quest || !stage) return false;

    const isDialogContinueCommand = this._matchesVoiceSignal('dialog_continue', normalized);
    if (this._pendingDialogId && isDialogContinueCommand) {
      const dialogId = this._pendingDialogId;
      this._pendingDialogId = null;
      window.eventSystem?.emit('quest:dialogHide', { dialogId });
      window.eventSystem?.emit('quest:dialogContinue', { dialogId });
      return true;
    }

    const isWearSuitCommand = this._matchesVoiceSignal('wear_suit', normalized);
    const isPocketsCommand = this._matchesVoiceSignal('check_pockets', normalized);

    if (stage === 'await_ola' && this._matchesVoiceSignal('greet_ola', normalized)) {
      this.micHighlight = false;
      window.eventSystem?.emit('quest:micHighlight', { active: false });
      this._patchQuests((draft) => {
        draft.progress = {
          ...(draft.progress || {}),
          stage: 'await_vamos',
        };
        return draft;
      });
      this._emitFoxText(quest.afterOlaKey);
      return true;
    }

    if (stage === 'await_vamos' && this._matchesVoiceSignal('start_vamos', normalized)) {
      this._patchQuests((draft) => {
        draft.progress = {
          ...(draft.progress || {}),
          stage: 'dialog_open',
        };
        return draft;
      });
      window.eventSystem?.emit('quest:dialogShow', {
        dialogId: `${quest.id}:intro`,
        titleKey: quest.titleKey,
        bodyKeys: quest.dialogBodyKeys || [],
        taskKeys: (quest.tasks || []).map(t => t.textKey),
        params: {
          voiceLanguage: this._formatText('quests.voice_locale_label'),
        },
      });
      this._pendingDialogId = `${quest.id}:intro`;
      return true;
    }

    if (isWearSuitCommand) {
      const gs = this._state();
      const hasSuit = !!gs?.player?.inventory?.includes('engineer_suit');
      if (hasSuit) {
        window.updateGameState?.({ player: { engineerSuit: true } });
        this._syncQuest2Stage({ emitHint: true });
        return true;
      }
    }

    if (isPocketsCommand) {
      const result = this.handlePocketInspection();
      if (result?.handled) return true;
    }

    return false;
  }

  handleDialogContinue(dialogId) {
    this._pendingDialogId = null;
    const quest = this._getCurrentQuest();
    if (!quest || dialogId !== `${quest.id}:intro`) return;

    if (quest.id === 'quest_act1_who_are_you') {
      this._prepareQuest2Environment();
      this._patchQuests((draft) => {
        draft.progress = {
          ...(draft.progress || {}),
          stage: 'q2_to_chair',
          showTasks: true,
        };
        draft.taskStates = { ...(draft.taskStates || {}) };
        for (const task of (quest.tasks || [])) {
          if (!(task.id in draft.taskStates)) draft.taskStates[task.id] = false;
        }
        return draft;
      });
      window.eventSystem?.emit('quest:tasksChanged');
      this._emitFoxText('quests.q2_to_chair');
      return;
    }

    this.activateQuest(quest.id);

    this._patchQuests((draft) => {
      draft.progress = {
        ...(draft.progress || {}),
        stage: 'movement_training',
        showTasks: true,
        movementDone: { ...((draft.progress || {}).movementDone || {}) },
      };
      draft.taskStates = { ...(draft.taskStates || {}) };
      for (const task of (quest.tasks || [])) {
        if (!(task.id in draft.taskStates)) {
          draft.taskStates[task.id] = false;
        }
      }
      return draft;
    });

    window.eventSystem?.emit('quest:tasksChanged');
    this.promptNextMovement();
  }

  handleActionExecuted(actionId, params = {}) {
    const quest = this._getCurrentQuest();
    const stage = this._state()?.quests?.progress?.stage;
    const moveIds = ['move_down', 'move_up', 'move_right', 'move_left'];
    if (!quest) return;

    if (stage === 'movement_training' && moveIds.includes(actionId)) {
      const state = this._state();
      const done = {
        ...(state?.quests?.progress?.movementDone || {}),
        [actionId]: true,
      };

      this._patchQuests((draft) => {
        draft.progress = {
          ...(draft.progress || {}),
          movementDone: done,
        };
        return draft;
      });

      const allDone = moveIds.every(id => !!done[id]);
      if (allDone) {
        const firstTaskId = quest.tasks?.[0]?.id;
        this._patchQuests((draft) => {
          draft.taskStates = {
            ...(draft.taskStates || {}),
            ...(firstTaskId ? { [firstTaskId]: true } : {}),
          };
          return draft;
        });
        window.eventSystem?.emit('quest:tasksChanged');
        this._emitFoxText(quest.walkCompleteKey);
        window.setTimeout(() => this._startQuest2IntroFlow(), 450);
        return;
      }

      window.eventSystem?.emit('quest:tasksChanged');
      this.promptNextMovement(done);
      return;
    }

    if (actionId === 'take_item' && params.itemId === 'engineer_suit') {
      this._syncQuest2Stage({ emitHint: true });
      return;
    }

    if (actionId === 'use_item' && params.itemId === 'engineer_suit') {
      window.updateGameState?.({ player: { engineerSuit: true } });
      this._syncQuest2Stage({ emitHint: true });
      return;
    }

    if (actionId === 'open_door' && this._targetMatchesAnyObjectId(params.doorId, ['door_color_red', 'door_inner_h', 'door_inner_v'])) {
      this._syncQuest2Stage({ emitHint: true });
      return;
    }

  }

  handleApproachArrived(targetId) {
    if (!targetId) return;

    if (this._targetMatchesObjectId(targetId, 'chair')) {
      this._patchQuest2Flags({ chairSeen: true });
      this._syncQuest2Stage({ emitHint: true });
      return;
    }

    if (this._targetMatchesObjectId(targetId, 'plant_pot')) {
      this._patchQuest2Flags({ plantSeen: true });
      this._syncQuest2Stage({ emitHint: true });
      return;
    }

    if (this._targetMatchesObjectId(targetId, 'crate_small')) {
      this._patchQuest2Flags({ drawerReached: true });
      this._syncQuest2Stage({ emitHint: true });
      return;
    }

    if (this._targetMatchesObjectId(targetId, 'table')) {
      this._patchQuest2Flags({ tableReached: true });
      this._syncQuest2Stage({ emitHint: true });
      return;
    }

    if (this._targetMatchesObjectId(targetId, 'door_color_white')) {
      this._patchQuest2Flags({ whiteDoorReached: true });
      this._syncQuest2Stage({ emitHint: true });
    }
  }

  handleActionFailed(actionId, params = {}, failureCode = null) {
    if (actionId !== 'open_door') return;
    if (failureCode !== 'door_locked') return;
    if (!this._targetMatchesObjectId(params.doorId, 'door_color_white')) return;
    this._patchQuest2Flags({ whiteDoorLockedTried: true });
    this._syncQuest2Stage({ emitHint: true });
  }

  onContainerOpened(containerId) {
    if (!this._targetMatchesObjectId(containerId, 'crate_small')) return;
    this._patchQuest2Flags({ drawerOpened: true });
    this._syncQuest2Stage({ emitHint: true });
  }

  onDoorOpened(doorId) {
    if (!this._targetMatchesObjectId(doorId, 'door_color_white')) {
      this._syncQuest2Stage({ emitHint: true });
      return;
    }

    const quest = this._getQuestById('quest_act1_who_are_you');
    const state = this._state();
    if (!quest || state?.quests?.completed?.includes(quest.id)) return;

    const taskId = quest.tasks?.[0]?.id;
    this._patchQuests((draft) => {
      draft.taskStates = {
        ...(draft.taskStates || {}),
        ...(taskId ? { [taskId]: true } : {}),
      };
      return draft;
    });
    window.eventSystem?.emit('quest:tasksChanged');
    this.completeQuest(quest.id);
    this._emitFoxText('quests.q2_done');
  }

  promptNextMovement(doneMap = null) {
    const quest = this._getCurrentQuest();
    if (!quest) return;

    const done = doneMap || this._state()?.quests?.progress?.movementDone || {};
    const order = ['move_down', 'move_up', 'move_right', 'move_left'];
    const nextActionId = order.find(id => !done[id]);
    if (!nextActionId) return;

    const textKey = quest.walkPromptKeys?.[nextActionId];
    if (textKey) this._emitFoxText(textKey);
  }

  
  currentExpectedActions() {
    const state = this._state();
    const stage = state?.quests?.progress?.stage;
    const quest = this._getCurrentQuest();
    if (!quest || !stage) return null;

    if (stage === 'movement_training') {
      const done = state?.quests?.progress?.movementDone || {};
      const order = ['move_down', 'move_up', 'move_right', 'move_left'];
      if (order.every(id => !!done[id])) return null;
      return order;
    }

    if (stage === 'q2_to_chair' || stage === 'q2_to_plant' || stage === 'q2_to_drawer' || stage === 'q2_to_table' || stage === 'q2_to_white_door') {
      return ['approach_to'];
    }
    if (stage === 'q2_open_drawer') return ['open_container'];
    if (stage === 'q2_wear_suit') return ['take_item'];
    if (stage === 'q2_put_on_suit') return ['use_item'];
    if (stage === 'q2_open_first_door' || stage === 'q2_try_white_door' || stage === 'q2_open_exit') return ['open_door'];

   
    const taskStates = state?.quests?.taskStates || {};
    const pendingTask = (quest.tasks || []).find(t => !taskStates[t.id]);
    return pendingTask?.expectedActions || null;
  }

  handlePocketInspection() {
    const gs = this._state();
    const quest2 = this._getQuestById('quest_act1_who_are_you');
    if (!gs || !quest2) return { handled: false };

    const isQuest2Active = !gs.quests?.completed?.includes(quest2.id)
      && (gs.quests?.current === quest2.id || gs.quests?.active?.includes(quest2.id));
    const hasSuitOn = !!gs.player?.engineerSuit;
    const hasKey = !!gs.player?.inventory?.includes('key_white');
    const alreadyChecked = !!gs.quests?.progress?.q2Flags?.pocketsChecked;

    if (!isQuest2Active || !hasSuitOn || hasKey || alreadyChecked) {
      return { handled: false };
    }

    const inv = new Set(gs.player.inventory || []);
    inv.add('key_white');
    window.updateGameState?.({ player: { inventory: [...inv] } });
    this._patchQuest2Flags({ pocketsChecked: true, tableReached: true });
    this._syncQuest2Stage({ emitHint: false, forceTextKey: 'quests.q2_got_key' });
    return { handled: true, foundKey: true };
  }

  checkActionGate(actionId, params = {}) {
    const quest2 = this._getQuestById('quest_act1_who_are_you');
    const state = this._state();
    if (!quest2 || !state?.quests || state.quests.completed?.includes(quest2.id)) return true;

    const isQuest2Active = state.quests.current === quest2.id || state.quests.active?.includes(quest2.id);
    if (!isQuest2Active) return true;

    const targets = state.quests.progress?.q2Targets || {};
    const isQuestDoorAction = actionId === 'open_door' && [targets.firstDoorId, targets.whiteDoorId].includes(params.doorId);
    if (!isQuestDoorAction) return true;

    const hasSuitItem = !!state.player?.inventory?.includes('engineer_suit');
    const hasSuitOn = !!state.player?.engineerSuit;
    const hasKey = !!state.player?.inventory?.includes('key_white');

    if (!hasSuitOn) {
      this._patchQuest2Flags({ chairSeen: true, plantSeen: true });
      this._syncQuest2Stage({ emitHint: false });
      this._emitFoxText(hasSuitItem ? 'quests.q2_got_suit' : 'quests.q2_gate_need_suit');
      return false;
    }

    const isWhiteDoorAction = (actionId === 'open_door' && params.doorId === targets.whiteDoorId)
      || (actionId === 'approach_to' && params.targetId === targets.whiteDoorId);

    if (isWhiteDoorAction && !hasKey) {
      this._patchQuest2Flags({ whiteDoorLockedTried: true, tableReached: true });
      this._syncQuest2Stage({ emitHint: false });
      this._emitFoxText('quests.q2_gate_need_key');
      return false;
    }

    return true;
  }

  _getQuest2Flags() {
    return { ...(this._state()?.quests?.progress?.q2Flags || {}) };
  }

  _patchQuest2Flags(patch = {}) {
    if (!patch || !Object.keys(patch).length) return;
    this._patchQuests((draft) => {
      draft.progress = {
        ...(draft.progress || {}),
        q2Flags: {
          ...(draft.progress?.q2Flags || {}),
          ...patch,
        },
      };
      return draft;
    });
  }

  _resolveQuest2Stage() {
    const state = this._state();
    const targets = state?.quests?.progress?.q2Targets || {};
    const flags = this._getQuest2Flags();
    const inventory = state?.player?.inventory || [];
    const hasSuit = inventory.includes('engineer_suit');
    const hasSuitOn = !!state?.player?.engineerSuit;
    const hasKey = inventory.includes('key_white');
    const drawerOpen = !!(targets.drawerId && state?.world?.flags?.[`container_open_${targets.drawerId}`]);
    const firstDoorOpen = !!(targets.firstDoorId && state?.world?.flags?.[`door_open_${targets.firstDoorId}`]);
    const whiteDoorOpen = !!(targets.whiteDoorId && state?.world?.flags?.[`door_open_${targets.whiteDoorId}`]);
    const advancedPastChair = !!(flags.plantSeen || flags.drawerReached || drawerOpen || hasSuit || hasSuitOn || firstDoorOpen || hasKey || flags.tableReached || flags.whiteDoorLockedTried || flags.whiteDoorReached || whiteDoorOpen);
    const advancedPastPlant = !!(flags.drawerReached || drawerOpen || hasSuit || hasSuitOn || firstDoorOpen || hasKey || flags.tableReached || flags.whiteDoorLockedTried || flags.whiteDoorReached || whiteDoorOpen);
    const advancedPastDrawer = !!(drawerOpen || hasSuit || hasSuitOn || firstDoorOpen || hasKey || flags.tableReached || flags.whiteDoorLockedTried || flags.whiteDoorReached || whiteDoorOpen);

    if (!flags.chairSeen && !advancedPastChair) return { stage: 'q2_to_chair', textKey: 'quests.q2_to_chair' };
    if (!flags.plantSeen && !advancedPastPlant) return { stage: 'q2_to_plant', textKey: 'quests.q2_to_plant' };
    if (!flags.drawerReached && !advancedPastDrawer) return { stage: 'q2_to_drawer', textKey: 'quests.q2_to_drawer' };
    if (!drawerOpen) return { stage: 'q2_open_drawer', textKey: null };
    if (!hasSuit) return { stage: 'q2_wear_suit', textKey: 'quests.q2_wear_suit' };
    if (!hasSuitOn) return { stage: 'q2_put_on_suit', textKey: 'quests.q2_got_suit' };
    if (!firstDoorOpen) return { stage: 'q2_open_first_door', textKey: 'quests.q2_open_first_door' };
    if (!flags.whiteDoorLockedTried && !hasKey) return { stage: 'q2_try_white_door', textKey: 'quests.q2_try_white_door' };
    if (!hasKey && !flags.tableReached) return { stage: 'q2_to_table', textKey: 'quests.q2_to_table' };
    if (!hasKey) return { stage: 'q2_check_pockets', textKey: 'quests.q2_check_pockets' };
    if (!flags.whiteDoorReached) return { stage: 'q2_to_white_door', textKey: 'quests.q2_got_key' };
    if (!whiteDoorOpen) return { stage: 'q2_open_exit', textKey: 'quests.q2_open_exit' };
    return { stage: 'q2_open_exit', textKey: null, completed: true };
  }

  _syncQuest2Stage({ emitHint = false, forceTextKey = null } = {}) {
    const quest2 = this._getQuestById('quest_act1_who_are_you');
    const state = this._state();
    if (!quest2 || !state?.quests || state.quests.completed?.includes(quest2.id)) return false;

    const isQuest2Active = state.quests.current === quest2.id || state.quests.active?.includes(quest2.id);
    if (!isQuest2Active) return false;

    const resolved = this._resolveQuest2Stage();
    const nextStage = resolved?.stage || null;
    const currentStage = state.quests.progress?.stage || null;
    const shouldUpdate = !!nextStage && currentStage !== nextStage;

    if (shouldUpdate) {
      this._patchQuests((draft) => {
        draft.progress = {
          ...(draft.progress || {}),
          stage: nextStage,
          showTasks: true,
          q2Targets: { ...(draft.progress?.q2Targets || {}) },
          q2Flags: { ...(draft.progress?.q2Flags || {}) },
        };
        return draft;
      });
      window.eventSystem?.emit('quest:tasksChanged');
    }

    const hintKey = forceTextKey || (resolved?.textKey || null);
    if (hintKey && (forceTextKey || (emitHint && shouldUpdate))) {
      this._emitFoxText(hintKey);
    }

    return shouldUpdate;
  }

  _startQuest2IntroFlow() {
    const quest1 = this._getQuestById('quest_act1_strange_body');
    const quest2 = this._getQuestById('quest_act1_who_are_you');
    if (!quest2) return;

    if (quest1) this.completeQuest(quest1.id);
    this.activateQuest(quest2.id);

    this._patchQuests((draft) => {
      draft.progress = {
        ...(draft.progress || {}),
        stage: 'q2_dialog_open',
        showTasks: false,
        q2Targets: { ...(draft.progress?.q2Targets || {}) },
      };
      draft.taskStates = { ...(draft.taskStates || {}) };
      for (const task of (quest2.tasks || [])) {
        if (!(task.id in draft.taskStates)) draft.taskStates[task.id] = false;
      }
      return draft;
    });

    window.eventSystem?.emit('quest:dialogShow', {
      dialogId: `${quest2.id}:intro`,
      titleKey: quest2.titleKey,
      bodyKeys: quest2.dialogBodyKeys || [],
      taskKeys: (quest2.tasks || []).map(t => t.textKey),
      params: {
       
        engineerName: this._formatText('quests.engineer_name_native'),
      },
    });
    this._pendingDialogId = `${quest2.id}:intro`;
  }

  _prepareQuest2Environment() {
    const state = this._state();
    if (!state) return;
    const mapObjects = [...(state.world?.mapObjects || [])];
    const toiletDoorId = 'creative_door_v_1774966145073_274';
    const preferredExitDoorId = 'creative_door_red_1774961505145_43';
    const nearestChair = this._nearestReachableObjectByObjectId('chair');
    const nearestPlant = this._nearestReachableObjectByObjectId('plant_pot');
    const nearestDrawer = this._nearestReachableObjectByObjectId('crate_small');
    const nearestRedDoor = this._nearestReachableObjectByObjectId('door_color_red')
      || this._nearestReachableObjectByObjectId('door_inner_h')
      || this._nearestReachableObjectByObjectId('door_inner_v');
    const nearestTable = this._nearestReachableObjectByObjectId('table');
    const preferredExitDoor = mapObjects.find((obj) => obj.id === preferredExitDoorId) || null;
    const nearestWhiteDoor = preferredExitDoor || this._nearestObjectByObjectIdsToPoint(
      ['door_color_white', 'door_inner_h', 'door_inner_v', 'door_color_blue', 'door_color_red'],
      { x: nearestTable?.x ?? state.player.x, y: nearestTable?.y ?? state.player.y },
      [
        ...(nearestRedDoor?.id ? [nearestRedDoor.id] : []),
        toiletDoorId,
      ]
    );

    const patched = mapObjects.map((obj) => {
      if (nearestDrawer && obj.id === nearestDrawer.id) {
        return {
          ...obj,
          isSurface: true,
          isContainer: true,
          alwaysOpen: false,
          initialItems: Array.isArray(obj.initialItems) ? [...obj.initialItems] : [],
        };
      }
      if (obj.id === toiletDoorId) {
        const { isLocked, lockKey, ...rest } = obj;
        return {
          ...rest,
          objectId: 'door_inner_v',
        };
      }
      if (nearestWhiteDoor && obj.id === nearestWhiteDoor.id) {
        return {
          ...obj,
          objectId: 'door_color_white',
          isLocked: true,
          lockKey: 'key_white',
        };
      }
      return obj;
    });

    const flags = { ...(state.world?.flags || {}) };
    if (nearestDrawer) flags[`container_open_${nearestDrawer.id}`] = false;

    const surfaceItems = { ...(state.world?.surfaceItems || {}) };
    if (nearestDrawer && !Array.isArray(surfaceItems[nearestDrawer.id])) {
      const drawerObj = patched.find((obj) => obj.id === nearestDrawer.id);
      surfaceItems[nearestDrawer.id] = Array.isArray(drawerObj?.initialItems) ? [...drawerObj.initialItems] : [];
    }

    window.updateGameState?.({
      world: {
        mapObjects: patched,
        flags,
        surfaceItems,
      },
    });

    this._patchQuests((draft) => {
      draft.progress = {
        ...(draft.progress || {}),
        q2Targets: {
          chairId: nearestChair?.id || null,
          plantId: nearestPlant?.id || null,
          drawerId: nearestDrawer?.id || null,
          tableId: nearestTable?.id || null,
          firstDoorId: nearestRedDoor?.id || null,
          whiteDoorId: nearestWhiteDoor?.id || null,
        },
      };
      return draft;
    });
  }

  _targetMatchesObjectId(targetId, objectId) {
    if (!targetId || !objectId) return false;
    const gs = this._state();
    const obj = gs?.world?.mapObjects?.find((entry) => entry.id === targetId);
    return obj?.objectId === objectId;
  }

  _targetMatchesAnyObjectId(targetId, objectIds = []) {
    return (objectIds || []).some((objectId) => this._targetMatchesObjectId(targetId, objectId));
  }

  _isPlayerNearObjectId(objectId, maxDistancePx = 28) {
    const gs = this._state();
    if (!gs?.player || !gs?.world?.mapObjects?.length) return false;
    return gs.world.mapObjects.some((obj) => {
      if (obj.objectId !== objectId) return false;
      return Math.hypot((obj.x || 0) - gs.player.x, (obj.y || 0) - gs.player.y) <= maxDistancePx;
    });
  }

  _isQuest2ApproachStepDone(actionId, params, objectId) {
    if (actionId === 'approach_to' && this._targetMatchesObjectId(params.targetId, objectId) && this._isPlayerNearObjectId(objectId, 36)) {
      return true;
    }
    if (actionId && actionId.startsWith('move_') && this._isPlayerNearObjectId(objectId, 36)) {
      return true;
    }
    return false;
  }

  _quest2StageOrder() {
    return [
      'q2_dialog_open',
      'q2_to_chair',
      'q2_to_plant',
      'q2_to_drawer',
      'q2_open_drawer',
      'q2_wear_suit',
      'q2_put_on_suit',
      'q2_open_first_door',
      'q2_try_white_door',
      'q2_to_table',
      'q2_check_pockets',
      'q2_to_white_door',
      'q2_open_exit',
    ];
  }

  _questStageRank(stage) {
    if (!stage) return -1;
    if (['await_ola', 'await_vamos', 'dialog_open', 'movement_training'].includes(stage)) return -100;
    return this._quest2StageOrder().indexOf(stage);
  }

  _finishIntroQuestForSkip() {
    const state = this._state();
    const quest1 = this._getQuestById('quest_act1_strange_body');
    if (!state?.quests || !quest1) return;

    this.micHighlight = false;
    window.eventSystem?.emit('quest:micHighlight', { active: false });

    if (this._pendingDialogId) {
      window.eventSystem?.emit('quest:dialogHide', { dialogId: this._pendingDialogId });
      this._pendingDialogId = null;
    }

    const taskId = quest1.tasks?.[0]?.id;
    this._patchQuests((draft) => {
      draft.taskStates = {
        ...(draft.taskStates || {}),
        ...(taskId ? { [taskId]: true } : {}),
      };
      return draft;
    });

    if (!state.quests.completed?.includes(quest1.id)) {
      this.completeQuest(quest1.id);
    }
  }

  _jumpToQuest2Stage(stage, foxTextKey = null) {
    const quest2 = this._getQuestById('quest_act1_who_are_you');
    const state = this._state();
    const currentQuestId = state?.quests?.current || null;
    const currentStage = state?.quests?.progress?.stage || null;
    const currentRank = this._questStageRank(currentStage);
    const targetRank = this._questStageRank(stage);

    if (!quest2 || targetRank === -1) return false;
    if (currentQuestId === quest2.id && currentRank >= targetRank) return false;

    this._finishIntroQuestForSkip();
    this._prepareQuest2Environment();

    const freshState = this._state();
    if (freshState?.quests?.current !== quest2.id && !freshState?.quests?.completed?.includes(quest2.id)) {
      this.activateQuest(quest2.id);
    }

    this._patchQuests((draft) => {
      draft.current = quest2.id;
      draft.active = Array.isArray(draft.active)
        ? [...new Set([...(draft.active || []), quest2.id])]
        : [quest2.id];
      draft.progress = {
        ...(draft.progress || {}),
        stage,
        showTasks: true,
        q2Targets: { ...(draft.progress?.q2Targets || {}) },
      };
      draft.taskStates = { ...(draft.taskStates || {}) };
      for (const task of (quest2.tasks || [])) {
        if (!(task.id in draft.taskStates)) draft.taskStates[task.id] = false;
      }
      return draft;
    });

    window.eventSystem?.emit('quest:tasksChanged');
    if (foxTextKey) this._emitFoxText(foxTextKey);
    return true;
  }

  _nearestObjectByObjectId(objectId) {
    const gs = this._state();
    if (!gs?.world?.mapObjects?.length || !gs?.player) return null;
    let best = null;
    let bestDist = Infinity;
    for (const obj of gs.world.mapObjects) {
      if (obj.objectId !== objectId) continue;
      const d = Math.hypot((obj.x || 0) - gs.player.x, (obj.y || 0) - gs.player.y);
      if (d < bestDist) {
        best = obj;
        bestDist = d;
      }
    }
    return best;
  }

  _nearestObjectByObjectIdsToPoint(objectIds = [], point = null, excludeIds = []) {
    const gs = this._state();
    if (!gs?.world?.mapObjects?.length || !point) return null;
    const exclude = new Set(excludeIds || []);
    let best = null;
    let bestDist = Infinity;
    for (const obj of gs.world.mapObjects) {
      if (exclude.has(obj.id)) continue;
      if (!objectIds.includes(obj.objectId)) continue;
      const d = Math.hypot((obj.x || 0) - point.x, (obj.y || 0) - point.y);
      if (d < bestDist) {
        best = obj;
        bestDist = d;
      }
    }
    return best;
  }

  _nearestReachableObjectByObjectId(objectId) {
    const gs = this._state();
    if (!gs?.world?.mapObjects?.length || !gs?.player || !window.pathfindingSystem) {
      return this._nearestObjectByObjectId(objectId);
    }

    let best = null;
    let bestDist = Infinity;
    for (const obj of gs.world.mapObjects) {
      if (obj.objectId !== objectId) continue;
      const path = window.pathfindingSystem.findPath(gs.player.x, gs.player.y, obj.x, obj.y, gs);
      if (!path || !path.length) continue;
      const d = Math.hypot((obj.x || 0) - gs.player.x, (obj.y || 0) - gs.player.y);
      if (d < bestDist) {
        best = obj;
        bestDist = d;
      }
    }

    return best || this._nearestObjectByObjectId(objectId);
  }

  _getQuestById(id) {
    return this.questById.get(id) || null;
  }

  _getCurrentQuest() {
    const currentId = this._state()?.quests?.current;
    return this.questById.get(currentId) || this.quests[0] || null;
  }

  _emitFoxText(textKey, params = {}) {
    const text = this._formatText(textKey, params);
    if (text) {
      window.eventSystem?.emit('fox:say', {
        text,
        questHint: true,
        questStage: this._state()?.quests?.progress?.stage || null,
      });
    }
  }

  _formatText(key, params = {}) {
    let text = window.getText?.(key);
    if (!text || text === key) return '';
    for (const [paramKey, paramValue] of Object.entries(params)) {
      text = text.replaceAll(`{${paramKey}}`, String(paramValue ?? ''));
    }
    text = String(text).replace(/\{cmd\.([a-z0-9_]+)\}/gi, (_, token) => {
      const exampleKey = `voice.command_examples.${token}`;
      const example = window.getText?.(exampleKey, 'pt');
      if (example && example !== exampleKey) return String(example);
      const templateKey = `voice.templates.${token}`;
      const template = window.getText?.(templateKey, 'pt');
      return template && template !== templateKey ? String(template) : '';
    });
    return text;
  }

  _matchesVoiceSignal(signalKey, normalizedText) {
    const normalized = typeof normalizedText === 'string' ? normalizedText : this._norm(normalizedText);
    const variants = window.getText?.(`voice.quest_signals.${signalKey}`, 'pt');
    if (!Array.isArray(variants)) return false;
    return variants.some((variant) => normalized.includes(this._norm(variant)));
  }

  _patchQuests(transform) {
    const state = this._state();
    if (!state) return;

    const base = JSON.parse(JSON.stringify(state.quests || {
      active: [],
      completed: [],
      current: null,
      progress: {},
      taskStates: {},
    }));

    const next = transform(base) || base;
    window.updateGameState?.({ quests: next });
  }

  _norm(text = '') {
    return String(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  _state() {
    return window.getGameState?.();
  }
}

const questSystem = new QuestSystem();
window.questSystem = questSystem;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = questSystem;
}
