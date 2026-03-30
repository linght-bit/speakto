/**
 * VOICE SYSTEM
 * Handles speech recognition, voice input processing, and voice commands
 * All text via getText(), all data from /data/actions.json
 * All state via gameState
 */

class VoiceSystem {
  constructor() {
    this.recognition = null;
    this.actions = {};
    this.isListening = false;
    this.pauseListening = false; // флаг для паузы слушания
    this.micReady = false; // готов ли микрофон к использованию
    this.initializeSpeechRecognition();
  }

  _t(key, lang = null) {
    const text = window.getText?.(key, lang);
    return (text && text !== key) ? text : '';
  }

  initializeSpeechRecognition() {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        window.eventSystem?.emit('voice:unavailable');
        return;
      }

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'pt-PT'; // Player uses Portuguese

      this.recognition.onstart = () => {
        this.isListening = true;
        this.micReady = true; // Микрофон успешно запустился - разрешение есть
        window.eventSystem?.emit('voice:listening', { status: 'listening' });
      };

      this.recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('')
          .toLowerCase()
          .trim();

        this.processVoiceCommand(transcript);
      };

      this.recognition.onerror = (event) => {
        // Обработка отказа в разрешении на микрофон
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          this.isListening = false;
          this.pauseListening = true; // Не пытаться снова автоматически
          window.eventSystem?.emit('voice:permission-denied', { error: event.error });
        } else {
          window.eventSystem?.emit('voice:error', { error: event.error });
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        
        // Автоматически перезапустить для непрерывного слушания
        if (this.recognition && !this.pauseListening) {
          setTimeout(() => {
            try {
              this.recognition.start();
            } catch (error) {
              // Игнорируем ошибку если уже слушает
            }
          }, 100);
        }
      };
    } catch (error) {
      console.error(error);
    }
  }

  loadActions(actionsData) {
    try {
      if (!actionsData || !actionsData.actions) return;

      this.actions = {};
      actionsData.actions.forEach(action => {
        this.actions[action.id] = action;
      });

    } catch (error) {
      console.error(error);
    }
  }

  start() {
    if (!this.recognition) {
      window.eventSystem?.emit('voice:unavailable');
      return false;
    }

    try {
      this.pauseListening = false; // Разрешаем автоматический перезапуск
      
      // При первом вызове браузер покажет окно разрешения
      // Это может быть медленно, но это нормально
      this.recognition.start();
      
      // Проверяем через 2 секунды если микрофон не готов
      if (!this.micReady) {
        setTimeout(() => {
          if (this.isListening && !this.micReady) {
            window.eventSystem?.emit('voice:waiting-permission');
          }
        }, 2000);
      }
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  stop() {
    if (this.recognition) {
      this.pauseListening = true; // Запретим автоматический перезапуск
      try {
        if (this.isListening) {
          this.recognition.stop();
        }
      } catch (error) {
        console.error(error);
      }
    }
  }

  pause() {
    this.pauseListening = true;
    this.stop();
  }

  resume() {
    this.pauseListening = false;
    this.start();
  }

  processVoiceCommand(transcript) {
    try {
      const gameState = window.getGameState?.();
      if (!gameState) return;

      // Сохраняем последнюю распознанную команду в gameState
      window.updateGameState?.({
        voice: {
          lastCommand: transcript,
          lastCommandTime: Date.now()
        }
      });

      // Передаём команду в actionSystem если он существует
      if (window.actionSystem) {
        const success = window.actionSystem.processCommand(transcript);
        if (success) {
          window.eventSystem?.emit('voice:commandExecuted', { transcript });
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  parseCommand(transcript) {
    try {
      // Simple pattern matching for commands
      const lowerText = transcript.toLowerCase().trim();

      // Check for "take" command
      if (lowerText.includes('take') || lowerText.includes('pegar')) {
        const itemName = this.extractItemName(lowerText);
        if (itemName) {
          return { action: 'take_item', params: { itemId: itemName } };
        }
      }

      // Check for "use" command
      if (lowerText.includes('use') || lowerText.includes('usar')) {
        const itemName = this.extractItemName(lowerText);
        if (itemName) {
          return { action: 'use_item', params: { itemId: itemName } };
        }
      }

      // Check for "inventory" or "inv" command
      if (lowerText.includes('inventory') || lowerText.includes('inventário') || lowerText.includes('inv')) {
        return { action: 'check_inventory', params: {} };
      }

      // Check for "help" command
      if (lowerText.includes('help') || lowerText.includes('ajuda')) {
        return { action: 'help', params: {} };
      }

      // No recognized command
      return null;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  extractItemName(text) {
    // Data-driven: ищем по переведённым именам предметов в i18n
    const items = window.itemsData?.items || [];
    const cmd = (text || '').toLowerCase();
    const cmdWords = cmd.split(/\s+/).filter(Boolean);
    const candidates = [];

    for (const item of items) {
      const key = `items.${item.name}`;
      const name = window.getText?.(key, 'pt');
      if (!name || name === key) continue;
      candidates.push({ id: item.id, name: name.toLowerCase() });
    }

    candidates.sort((a, b) => b.name.length - a.name.length);
    for (const c of candidates) {
      const nameWords = c.name.split(/\s+/).filter(w => w.length >= 3);
      if (!nameWords.length) continue;
      const ok = nameWords.every(nw =>
        cmdWords.some(cw => cw === nw || cw.startsWith(nw) || nw.startsWith(cw))
      );
      if (ok) return c.id;
    }
    return null;
  }

  executeCommand(command) {
    try {
      const gameState = window.getGameState?.();
      const updateGameState = window.updateGameState;

      if (!gameState || !updateGameState) return;

      switch (command.action) {
        case 'take_item': {
          const itemId = command.params.itemId;
          const success = window.inventorySystem?.addItem(itemId);
          if (success) {
            window.eventSystem?.emit('voice:commandExecuted', { action: command.action, itemId });
          }
          break;
        }

        case 'use_item': {
          const itemId = command.params.itemId;
          const hasItem = window.inventorySystem?.hasItem(itemId);
          if (hasItem) {
            window.eventSystem?.emit('voice:commandExecuted', { action: command.action, itemId });
          }
          break;
        }

        case 'check_inventory': {
          window.eventSystem?.emit('voice:commandExecuted', { action: command.action });
          break;
        }

        case 'help': {
          this.showHelp(gameState.ui.language);
          window.eventSystem?.emit('voice:commandExecuted', { action: command.action });
          break;
        }

        default:
          break;
      }
    } catch (error) {
      console.error(error);
    }
  }

  showHelp(language = 'ru') {
    try {
      const help = this._t('voice.help', language);
      if (help) {
        window.eventSystem?.emit('ui:message', { text: help, lang: language });
      }
    } catch (error) {
      console.error(error);
    }
  }
}

// Create global instance
const voiceSystem = new VoiceSystem();
window.voiceSystem = voiceSystem;
