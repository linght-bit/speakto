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

  initializeSpeechRecognition() {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.warn('🎤 Speech Recognition not available in this browser');
        return;
      }

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'pt-PT'; // Player uses Portuguese

      this.recognition.onstart = () => {
        this.isListening = true;
        this.micReady = true; // Микрофон успешно запустился - разрешение есть
        const listeningText = window.getText?.('voice.listening') || 'Слушаю...';
        console.log('🎤 ' + listeningText);
        window.eventSystem?.emit('voice:listening', { status: 'listening' });
      };

      this.recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('')
          .toLowerCase()
          .trim();

        console.log('🎤 Recognized:', transcript);
        this.processVoiceCommand(transcript);
      };

      this.recognition.onerror = (event) => {
        const errorText = window.getText?.('voice.error') || 'Ошибка микрофона';
        console.error('🎤 ' + errorText + ':', event.error);
        
        // Обработка отказа в разрешении на микрофон
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          console.error('🚫 Браузер запросил разрешение на микрофон, но получил отказ');
          this.isListening = false;
          this.pauseListening = true; // Не пытаться снова автоматически
          window.eventSystem?.emit('voice:permission-denied', { error: event.error });
        } else {
          window.eventSystem?.emit('voice:error', { error: event.error });
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        console.log('🎤 Прослушивание остановлено');
        
        // Автоматически перезапустить для непрерывного слушания
        if (this.recognition && !this.pauseListening) {
          setTimeout(() => {
            try {
              this.recognition.start();
            } catch (error) {
              // Игнорируем ошибку если уже слушает
              console.log('🎤 Перезапуск слушания...');
            }
          }, 100);
        }
      };
    } catch (error) {
      console.error('Voice System init error:', error);
    }
  }

  loadActions(actionsData) {
    try {
      if (!actionsData || !actionsData.actions) {
        console.warn('No actions data provided to VoiceSystem');
        return;
      }

      this.actions = {};
      actionsData.actions.forEach(action => {
        this.actions[action.id] = action;
      });

      console.log('🎤 Loaded', Object.keys(this.actions).length, 'actions');
    } catch (error) {
      console.error('Error loading actions:', error);
    }
  }

  start() {
    if (!this.recognition) {
      console.warn('🎤 Speech Recognition not available');
      return false;
    }

    try {
      this.pauseListening = false; // Разрешаем автоматический перезапуск
      console.log('🎤 Вызываю start()...');
      
      // При первом вызове браузер покажет окно разрешения
      // Это может быть медленно, но это нормально
      this.recognition.start();
      
      // Проверяем через 2 секунды если микрофон не готов
      if (!this.micReady) {
        setTimeout(() => {
          if (this.isListening && !this.micReady) {
            console.warn('🎤 Микрофон не ответил - возможно браузер ждет разрешения');
          }
        }, 2000);
      }
      return true;
    } catch (error) {
      console.error('❌ Error starting voice recognition:', error);
      return false;
    }
  }

  stop() {
    console.log('🎤 Вызываю stop(), isListening=', this.isListening);
    if (this.recognition) {
      this.pauseListening = true; // Запретим автоматический перезапуск
      try {
        if (this.isListening) {
          console.log('🎤 Вызываю recognition.stop()');
          this.recognition.stop();
        } else {
          console.log('🎤 Уже не слушаю, больше ничего не делаю');
        }
      } catch (error) {
        console.error('❌ Error stopping voice recognition:', error);
      }
    } else {
      console.warn('🎤 recognition не инициализирована');
    }
  }

  pause() {
    this.pauseListening = true;
    this.stop();
    console.log('🎤 Слушание паузировано');
  }

  resume() {
    this.pauseListening = false;
    this.start();
    console.log('🎤 Слушание возобновлено');
  }

  processVoiceCommand(transcript) {
    try {
      const gameState = window.getGameState?.();
      if (!gameState) {
        console.warn('Game state not available');
        return;
      }

      console.log('💬 Распознанный текст:', transcript);

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
      console.error('Error processing voice command:', error);
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
      console.error('Error parsing command:', error);
      return null;
    }
  }

  extractItemName(text) {
    // Only look in the transcript for known item names
    const items = ['apple', 'maçã', 'key', 'chave', 'coin', 'moeda', 'torch', 'tocha'];
    for (const item of items) {
      if (text.includes(item)) {
        // Map to standard item ID
        if (item === 'apple' || item === 'maçã') return 'apple';
        if (item === 'key' || item === 'chave') return 'key';
        if (item === 'coin' || item === 'moeda') return 'coin';
        if (item === 'torch' || item === 'tocha') return 'torch';
      }
    }
    return null;
  }

  executeCommand(command) {
    try {
      const gameState = window.getGameState?.();
      const updateGameState = window.updateGameState;

      if (!gameState || !updateGameState) {
        console.warn('Game state not available');
        return;
      }

      switch (command.action) {
        case 'take_item': {
          const itemId = command.params.itemId;
          const success = window.inventorySystem?.addItem(itemId);
          if (success) {
            const itemName = window.getText?.(`items.item_${itemId}`, gameState.ui.language) || itemId;
            console.log(`✅ Added ${itemName} to inventory`);
            window.eventSystem?.emit('voice:commandExecuted', { action: command.action, itemId });
          }
          break;
        }

        case 'use_item': {
          const itemId = command.params.itemId;
          const hasItem = window.inventorySystem?.hasItem(itemId);
          if (hasItem) {
            const itemName = window.getText?.(`items.item_${itemId}`, gameState.ui.language) || itemId;
            console.log(`✅ Using ${itemName}`);
            window.eventSystem?.emit('voice:commandExecuted', { action: command.action, itemId });
          } else {
            console.log(`❌ Don't have ${itemId}`);
          }
          break;
        }

        case 'check_inventory': {
          const inventory = window.inventorySystem?.getInventory() || [];
          console.log('📦 Inventory:', inventory);
          window.eventSystem?.emit('voice:commandExecuted', { action: command.action });
          break;
        }

        case 'help': {
          this.showHelp(gameState.ui.language);
          window.eventSystem?.emit('voice:commandExecuted', { action: command.action });
          break;
        }

        default:
          console.log('Unknown action:', command.action);
      }
    } catch (error) {
      console.error('Error executing command:', error);
    }
  }

  showHelp(language = 'ru') {
    try {
      console.log('📖 Available commands:');
      const commands = [
        'take apple/key/coin/torch - Pegar item',
        'use apple/key/coin/torch - Usar item',
        'inventory - Ver inventário',
        'help - Mostrar ajuda'
      ];
      commands.forEach(cmd => console.log('  • ' + cmd));
    } catch (error) {
      console.error('Error showing help:', error);
    }
  }
}

// Create global instance
const voiceSystem = new VoiceSystem();
window.voiceSystem = voiceSystem;

console.log('✅ voiceSystem loaded');
