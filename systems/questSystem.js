/**
 * /systems/questSystem.js
 * СИСТЕМА КВЕСТОВ
 *
 * Управляет актами, задачами и сюжетными триггерами.
 * Все пользовательские тексты берутся из i18n и /data/quests.json.
 */

class QuestSystem {
  constructor() {
    this.quests = [];
    this.questById = new Map();
    this.micHighlight = false;
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

    window.eventSystem.on('action:executed', ({ actionId }) => {
      this.handleActionExecuted(actionId);
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

    if (stage === 'await_ola' && normalized.includes('ola')) {
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

    if (stage === 'await_vamos' && normalized.includes('vamos')) {
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
        params: {
          voiceLanguage: this._formatText('quests.voice_locale_label'),
        },
      });
      return true;
    }

    return false;
  }

  handleDialogContinue(dialogId) {
    const quest = this._getCurrentQuest();
    if (!quest || dialogId !== `${quest.id}:intro`) return;

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

  handleActionExecuted(actionId) {
    const quest = this._getCurrentQuest();
    const stage = this._state()?.quests?.progress?.stage;
    const moveIds = ['move_down', 'move_up', 'move_right', 'move_left'];
    if (!quest || stage !== 'movement_training' || !moveIds.includes(actionId)) return;

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
      return;
    }

    window.eventSystem?.emit('quest:tasksChanged');
    this.promptNextMovement(done);
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

  /**
   * Возвращает массив ID действий, ожидаемых на текущем шаге квеста.
   * Возвращает null, если слежение за отклонениями не нужно.
   */
  currentExpectedActions() {
    const state = this._state();
    const stage = state?.quests?.progress?.stage;
    const quest = this._getCurrentQuest();
    if (!quest || !stage) return null;

    if (stage === 'movement_training') {
      const done = state?.quests?.progress?.movementDone || {};
      const order = ['move_down', 'move_up', 'move_right', 'move_left'];
      if (order.every(id => !!done[id])) return null; // все выполнены
      return order;
    }

    // Для будущих квестов: expectedActions из текущей незавершённой задачи
    const taskStates = state?.quests?.taskStates || {};
    const pendingTask = (quest.tasks || []).find(t => !taskStates[t.id]);
    return pendingTask?.expectedActions || null;
  }

  _getCurrentQuest() {
    const currentId = this._state()?.quests?.current;
    return this.questById.get(currentId) || this.quests[0] || null;
  }

  _emitFoxText(textKey, params = {}) {
    const text = this._formatText(textKey, params);
    if (text) {
      window.eventSystem?.emit('fox:say', { text });
    }
  }

  _formatText(key, params = {}) {
    let text = window.getText?.(key);
    if (!text || text === key) return '';
    for (const [paramKey, paramValue] of Object.entries(params)) {
      text = text.replaceAll(`{${paramKey}}`, String(paramValue ?? ''));
    }
    return text;
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
