/**
 * /ui/render.js
 * РЕНДЕРИНГ ИГРЫ
 * 
 * Отрисовка мира, UI, персонажей на canvas.
 * Берёт текуры из i18n ключей.
 */

class GameRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = null;
    this.animationFrameId = null;
    this.micButtonRect = null; // область для нажатия кнопки микрофона
    this.micButtonPressed = false; // флаг нажатия кнопки (для визуального отклика)
    this.micButtonPressedTime = 0; // время нажатия кнопки
    
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    }
    
    this.setupCanvas();
    this.setupListeners();
  }

  setupCanvas() {
    if (!this.canvas) {
      console.warn('⚠️ Canvas element not found');
      return;
    }

    const config = window.gameConfig || {};
    this.canvas.width = config.canvas?.width || 800;
    this.canvas.height = config.canvas?.height || 600;
    
    console.log(`✓ Canvas установлен: ${this.canvas.width}x${this.canvas.height}`);
  }

  /**
   * Главный цикл рендеринга
   */
  render() {
    if (!this.canvas || !this.ctx) {
      console.warn('⚠️ Canvas или context недоступны, рендеринг невозможен');
      return;
    }

    this.clear();
    this.renderWorld();
    this.renderUI();
    
    // Продолжаем цикл
    this.animationFrameId = requestAnimationFrame(() => this.render());
  }

  /**
   * Остановить рендеринг
   */
  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Очистить canvas
   */
  clear() {
    if (!this.ctx) return;
    
    const config = window.gameConfig || {};
    const bg = config.canvas?.backgroundColor || '#2a3f2f';
    
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Рендерим мир
   */
  renderWorld() {
    if (!this.ctx) return;
    
    try {
      const gameState = window.getGameState?.();
      
      // Рисуем фон мира
      this.ctx.fillStyle = '#1a2a1f';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Рисуем земли (простая сетка для тестирования)
      this.ctx.strokeStyle = '#3a4a3f';
      this.ctx.lineWidth = 1;
      for (let x = 0; x < this.canvas.width; x += 50) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.canvas.height);
        this.ctx.stroke();
      }
      for (let y = 0; y < this.canvas.height; y += 50) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(this.canvas.width, y);
        this.ctx.stroke();
      }
      
      // Рисуем объекты на карте (здания, столы и т.д.)
      if (gameState && gameState.world?.mapObjects) {
        this.renderMapObjects(gameState.world.mapObjects);
      }
      
      // Рисуем персонажа
      if (gameState && gameState.player) {
        this.renderPlayer(gameState.player);
      }
      
      // Рисуем предметы в мире (яблоко, ключ и т.д.)
      if (gameState && gameState.world?.objects) {
        this.renderWorldObjects(gameState.world.objects);
      }
      
      // Статус информация
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '14px Arial';
      this.ctx.fillText('Game Running...', 20, 30);
      
      this.ctx.fillStyle = '#4ade80';
      this.ctx.font = '12px Arial';
      if (gameState) {
        this.ctx.fillText(`Language: ${gameState.ui.language}`, 20, 50);
        this.ctx.fillText(`Player: (${gameState.player?.x || 0}, ${gameState.player?.y || 0})`, 20, 70);
      }
    } catch (error) {
      console.error('Error in renderWorld:', error);
    }
  }

  /**
   * Рендерим объекты на карте (дом, стол, дверь, колодец)
   */
  renderMapObjects(mapObjects) {
    if (!this.ctx || !mapObjects || mapObjects.length === 0) return;

    try {
      mapObjects.forEach(obj => {
        this.renderMapObject(obj);
      });
    } catch (error) {
      console.error('Error rendering map objects:', error);
    }
  }

  /**
   * Рендерим один объект на карте
   */
  renderMapObject(obj) {
    if (!this.ctx || !obj) return;

    try {
      const x = obj.x || 0;
      const y = obj.y || 0;
      const width = obj.width || 60;
      const height = obj.height || 40;

      // Выбираем цвет и иконку в зависимости от типа объекта
      let color = '#8B7355';  // коричневый по умолчанию
      let icon = '?';

      switch (obj.objectId) {
        case 'house':
          color = '#8B4513';
          icon = '🏠';
          break;
        case 'table':
          color = '#654321';
          icon = '🪵';
          break;
        case 'door':
          color = '#A0826D';
          icon = '🚪';
          break;
        case 'well':
          color = '#696969';
          icon = '🪦';
          break;
      }

      // Рисуем основу объекта
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x - width / 2, y - height / 2, width, height);

      // Граница
      this.ctx.strokeStyle = '#FFD700';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x - width / 2, y - height / 2, width, height);

      // Иконка объекта
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 24px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(icon, x, y + 8);
      this.ctx.textAlign = 'left';

      // Название объекта (если нужно)
      const objName = window.getText?.(`objects.object_${obj.objectId}`, 'ru') || obj.objectId;
      this.ctx.fillStyle = '#FFFF00';
      this.ctx.font = '10px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(objName, x, y - height / 2 - 5);
      this.ctx.textAlign = 'left';
    } catch (error) {
      console.error('Error rendering map object:', error);
    }
  }

  /**
   * Рендерим персонажа
   */
  renderPlayer(playerData) {
    if (!this.ctx) return;
    
    try {
      let x = playerData.x || 100;
      let y = playerData.y || 100;

      // Если персонаж движется к цели, обновляем позицию
      if (playerData.isMoving && playerData.targetX !== null && playerData.targetY !== null) {
        const speed = 3; // пиксели за кадр
        const dx = playerData.targetX - x;
        const dy = playerData.targetY - y;
        const distance = Math.hypot(dx, dy);

        if (distance > speed) {
          // Движемся к цели
          x += (dx / distance) * speed;
          y += (dy / distance) * speed;
          
          // Обновляем текущую позицию в gameState
          window.updateGameState?.({
            player: { x, y }
          });
        } else {
          // Достигли цели
          x = playerData.targetX;
          y = playerData.targetY;
          window.updateGameState?.({
            player: {
              x,
              y,
              isMoving: false,
              targetX: null,
              targetY: null
            }
          });
        }
      }
      
      // Рисуем квадрат персонажа (или кружок для улучшения)
      this.ctx.fillStyle = '#ff9800';
      this.ctx.fillRect(x - 20, y - 20, 40, 40);
      
      // Рисуем границу
      this.ctx.strokeStyle = '#ff6b35';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x - 20, y - 20, 40, 40);
      
      // Рисуем имя персонажа над ним
      const playerName = window.getText?.('characters.player_name') || 'Player';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(playerName, x, y - 30);
      this.ctx.textAlign = 'left';
    } catch (error) {
      console.error('Error rendering player:', error);
    }
  }

  /**
   * Рендерим предметы в мире
   */
  renderWorldObjects(objects) {
    if (!this.ctx || !objects || objects.length === 0) return;

    try {
      objects.forEach(obj => {
        // Пропускаем уже взятые предметы
        if (obj.taken) return;

        this.renderWorldObject(obj);
      });
    } catch (error) {
      console.error('Error rendering world objects:', error);
    }
  }

  /**
   * Рендерим один предмет в мире
   */
  renderWorldObject(obj) {
    if (!this.ctx || !obj) return;

    try {
      // Ищем данные предмета
      const itemData = this.findItemData(obj.itemId);
      const icon = itemData?.icon || '?';

      const x = obj.x || 0;
      const y = obj.y || 0;
      const size = 35;

      // Рисуем тень от предмета
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      this.ctx.fillRect(x - size / 2, y + size / 2 - 3, size, 4);

      // Рисуем квадрат предмета с картинкой
      this.ctx.fillStyle = '#4a5f4f';
      this.ctx.fillRect(x - size / 2, y - size / 2, size, size);

      // Граница (более яркая для подсветки)
      this.ctx.strokeStyle = '#7ade80';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x - size / 2, y - size / 2, size, size);

      // Иконка предмета
      this.ctx.fillStyle = '#ffff00';
      this.ctx.font = 'bold 20px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(icon, x, y + 6);

      // Уникальный ID под иконкой (для отладки)
      this.ctx.fillStyle = '#cccccc';
      this.ctx.font = '9px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(obj.id.substring(0, 4), x, y + 18);

      this.ctx.textAlign = 'left';
    } catch (error) {
      console.error('Error rendering world object:', error);
    }
  }

  renderUI() {
    if (!this.ctx) return;
    
    try {
      const gameState = window.getGameState?.();
      if (!gameState) return;
      
      // Рисуем панель инвентаря внизу
      this.renderInventoryUI(gameState.player.inventory || []);
      
      // Рисуем строку последней распознанной речи
      this.renderVoiceTranscript(gameState.voice?.lastCommand || null);
      
      // Рисуем кнопку микрофона
      this.renderMicrophoneButton(window.voiceSystem?.isListening || false);
      
      // Рисуем статус голоса если слушаем
      if (window.voiceSystem?.isListening) {
        this.renderVoiceStatus();
      }
    } catch (error) {
      console.error('Error in renderUI:', error);
    }
  }

  /**
   * Рендерим инвентарь внизу экрана
   */
  renderInventoryUI(inventory) {
    if (!this.ctx) return;
    
    try {
      const padding = 10;
      const panelHeight = 80;
      const panelY = this.canvas.height - panelHeight;
      
      // Фон панели инвентаря
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(0, panelY, this.canvas.width, panelHeight);
      
      // Граница
      this.ctx.strokeStyle = '#ff9800';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(0, panelY, this.canvas.width, panelHeight);
      
      // Заголовок инвентаря
      this.ctx.fillStyle = '#ff9800';
      this.ctx.font = 'bold 12px Arial';
      this.ctx.fillText('INVENTORY', padding, panelY + 20);
      
      // Если инвентарь пуст
      if (!inventory || inventory.length === 0) {
        this.ctx.fillStyle = '#999999';
        this.ctx.font = '12px Arial';
        this.ctx.fillText('(empty)', padding, panelY + 45);
        return;
      }
      
      // Рисуем предметы в инвентаре
      let x = padding;
      const itemY = panelY + 35;
      const itemSize = 40;
      const itemSpacing = 10;
      
      inventory.forEach((itemId, index) => {
        if (x + itemSize > this.canvas.width - padding) {
          // Переходим на новую строку если не влезает
          x = padding;
          return;
        }
        
        // Ищем иконку предмета в данных
        const itemData = this.findItemData(itemId);
        const icon = itemData?.icon || '?';
        
        // Рисуем квадрат предмета
        this.ctx.fillStyle = '#4a5f4a';
        this.ctx.fillRect(x, itemY, itemSize, itemSize);
        
        // Граница
        this.ctx.strokeStyle = '#7ade80';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, itemY, itemSize, itemSize);
        
        // Иконка
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(icon, x + itemSize / 2, itemY + 28);
        this.ctx.textAlign = 'left';
        
        // Количество внизу (если несколько)
        const count = inventory.filter(i => i === itemId).length;
        if (count > 1) {
          this.ctx.fillStyle = '#ffff00';
          this.ctx.font = 'bold 10px Arial';
          this.ctx.textAlign = 'right';
          this.ctx.fillText(count.toString(), x + itemSize - 3, itemY + itemSize - 2);
          this.ctx.textAlign = 'left';
        }
        
        x += itemSize + itemSpacing;
      });
    } catch (error) {
      console.error('Error rendering inventory:', error);
    }
  }

  /**
   * Ищем данные предмета из /data/items.json
   */
  findItemData(itemId) {
    try {
      const itemsData = window.itemsData;
      if (!itemsData || !itemsData.items) return null;
      return itemsData.items.find(item => item.id === itemId);
    } catch (error) {
      console.error('Error finding item data:', error);
      return null;
    }
  }

  /**
   * Рендерим кнопку микрофона
   */
  renderMicrophoneButton(isListening) {
    if (!this.ctx) return;
    
    try {
      const btnX = 10;
      const btnY = 10;
      const btnWidth = 60;
      const btnHeight = 40;
      
      // Проверяем если кнопка только что нажата (визуальный отклик)
      const isPressed = this.micButtonPressed && (Date.now() - this.micButtonPressedTime < 100);
      const offset = isPressed ? 3 : 0;
      
      // Фон кнопки (цвет зависит от состояния)
      const bgColor = isListening ? '#ff5722' : '#4CAF50';
      this.ctx.fillStyle = bgColor;
      this.ctx.fillRect(btnX + offset, btnY + offset, btnWidth, btnHeight);
      
      // Граница
      this.ctx.strokeStyle = isListening ? '#ffcc00' : '#ffffff';
      this.ctx.lineWidth = isPressed ? 3 : 2;
      this.ctx.strokeRect(btnX + offset, btnY + offset, btnWidth, btnHeight);
      
      // Иконка микрофона
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 24px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(isListening ? '🎤' : '🔇', btnX + btnWidth / 2 + offset, btnY + 28 + offset);
      this.ctx.textAlign = 'left';
      
      // Сохраняем область для нажатия
      this.micButtonRect = { x: btnX, y: btnY, width: btnWidth, height: btnHeight };
    } catch (error) {
      console.error('Error rendering microphone button:', error);
    }
  }

  /**
   * Рендерим строку с последней распознанной речью
   */
  renderVoiceTranscript(transcript) {
    if (!this.ctx) return;
    
    try {
      const padding = 10;
      const panelY = this.canvas.height - 100; // дополнительная панель над инвентарем
      const panelHeight = 20;
      
      // Если нет текста, не рисуем
      if (!transcript) {
        return;
      }
      
      // Проверяем не старая ли команда (показываем 3 секунды)
      const gameState = window.getGameState?.();
      const timeSinceCommand = gameState?.voice?.lastCommandTime 
        ? Date.now() - gameState.voice.lastCommandTime 
        : 0;
      
      if (timeSinceCommand > 3000) {
        return; // Не показываем если прошло больше 3 секунд
      }
      
      // Фон панели
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      this.ctx.fillRect(0, panelY, this.canvas.width, panelHeight);
      
      // Граница
      this.ctx.strokeStyle = '#2196F3';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(0, panelY, this.canvas.width, panelHeight);
      
      // Текст
      this.ctx.fillStyle = '#2196F3';
      this.ctx.font = '12px Arial';
      this.ctx.fillText('🎤 ' + transcript, padding, panelY + 15);
    } catch (error) {
      console.error('Error rendering voice transcript:', error);
    }
  }

  /**
   * Рендерим статус голоса
   */
  renderVoiceStatus() {
    if (!this.ctx) return;
    
    try {
      const statusText = window.getText?.('voice.listening') || 'Слушаю...';
      
      // Анимированный индикатор
      const pulse = Math.sin(Date.now() / 300) * 20;
      
      // Фон
      this.ctx.fillStyle = 'rgba(255, 152, 0, 0.3)';
      this.ctx.fillRect(this.canvas.width - 180, 10, 170, 40);
      
      // Граница
      this.ctx.strokeStyle = '#ff9800';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(this.canvas.width - 180, 10, 170, 40);
      
      // Текст
      this.ctx.fillStyle = '#ffff00';
      this.ctx.font = 'bold 14px Arial';
      this.ctx.fillText('🎤 ' + statusText, this.canvas.width - 170, 35);
      
      // Пульсирующие точки
      this.ctx.fillStyle = '#ff5722';
      this.ctx.beginPath();
      this.ctx.arc(this.canvas.width - 15, 30, 3 + (pulse / 20), 0, Math.PI * 2);
      this.ctx.fill();
    } catch (error) {
      console.error('Error rendering voice status:', error);
    }
  }

  setupListeners() {
    if (!window.eventSystem) return;
    
    window.eventSystem.on('game:state-changed', () => {
      // Стейт изменился, следующий фрейм перерендерит
    });

    // Обработчик клика на canvas для кнопки микрофона
    if (this.canvas) {
      this.canvas.addEventListener('click', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Проверяем нажата ли кнопка микрофона
        if (this.micButtonRect && 
            x > this.micButtonRect.x && 
            x < this.micButtonRect.x + this.micButtonRect.width &&
            y > this.micButtonRect.y && 
            y < this.micButtonRect.y + this.micButtonRect.height) {
          
          // Визуальный отклик - кнопка прижимается
          this.micButtonPressed = true;
          this.micButtonPressedTime = Date.now();
          
          // Переключаем состояние микрофона
          if (window.voiceSystem) {
            console.log('🖱️ Клик по кнопке микрофона, isListening=', window.voiceSystem.isListening);
            
            if (window.voiceSystem.isListening) {
              console.log('  → Отключаю микрофон');
              window.voiceSystem.stop();
              console.log('🎤 Микрофон выключен');
            } else {
              console.log('  → Включаю микрофон (браузер может запросить разрешение)');
              window.voiceSystem.start();
              console.log('🎤 Микрофон включен (ожидание разрешения)');
            }
          } else {
            console.warn('⚠️ voiceSystem не найдена');
          }
        }
      });
    }
  }
}

// Создаём и прикрепляем к window
const gameRenderer = new GameRenderer('game-canvas');
window.gameRenderer = gameRenderer;

// Для модульной системы
if (typeof module !== 'undefined' && module.exports) {
  module.exports = gameRenderer;
}
