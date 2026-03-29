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

    // Сброс счетчика обновлений для каждого фрейма
    window.resetUpdateCounter?.();

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

      // Рисуем 20px сетку навигации с подсветкой занятых клеток
      this.renderDebugGrid(gameState);
      
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
      this.ctx.fillText('Speak To v2.0.1', 20, 30);
      
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
   * Рендерим один объект на карте.
   * Все размеры привязаны к 20px-сетке.
   */
  renderMapObject(obj) {
    if (!this.ctx || !obj) return;

    try {
      const CELL = 20;
      // Выравниваем левый верхний угол по сетке
      const w = Math.round((obj.width  || 20) / CELL) * CELL;
      const h = Math.round((obj.height || 20) / CELL) * CELL;
      // obj.x/y — центр → snap left/top на ячейку
      const left = Math.round((obj.x - w / 2) / CELL) * CELL;
      const top  = Math.round((obj.y - h / 2) / CELL) * CELL;
      const cx = left + w / 2;
      const cy = top  + h / 2;

      const gameState = window.getGameState?.();

      // ── ЗАПЕРТАЯ ДВЕРЬ ────────────────────────────────────────────
      if (obj.objectId === 'door_locked') {
        const lockedOpen = gameState?.world?.flags?.door_locked_open || false;
        if (lockedOpen) {
          this.ctx.fillStyle = 'rgba(144,238,144,0.35)';
          this.ctx.fillRect(left, top, w, h);
          this.ctx.strokeStyle = '#228B22';
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);
          this.ctx.fillStyle = '#228B22';
          this.ctx.font = '8px Arial';
          this.ctx.textAlign = 'center';
          this.ctx.fillText('ABERTO', cx, cy + 3);
        } else {
          this.ctx.fillStyle = '#5B3A1A';
          this.ctx.fillRect(left, top, w, h);
          this.ctx.strokeStyle = '#8B4513';
          this.ctx.lineWidth = 1.5;
          this.ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);
          // Замок
          this.ctx.font = '10px Arial';
          this.ctx.textAlign = 'center';
          this.ctx.fillText('🔒', cx, cy + 4);
        }
        const lockName = window.getText?.(`objects.object_door_locked`, 'pt') || 'Porta Trancada';
        this.ctx.fillStyle = '#FF8888';
        this.ctx.font = '8px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(lockName, cx, top - 3);
        this.ctx.textAlign = 'left';
        return;
      }

      // ── ДВЕРЬ ──────────────────────────────────────────────────────
      if (obj.objectId === 'door') {
        const doorOpen = gameState?.world?.flags?.door_open || false;
        if (doorOpen) {
          // Открыта — светлый проход
          this.ctx.fillStyle = 'rgba(144,238,144,0.35)';
          this.ctx.fillRect(left, top, w, h);
          this.ctx.strokeStyle = '#228B22';
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);
          this.ctx.fillStyle = '#228B22';
          this.ctx.font = '8px Arial';
          this.ctx.textAlign = 'center';
          this.ctx.fillText('ABERTO', cx, cy + 3);
        } else {
          // Закрыта
          this.ctx.fillStyle = '#8B4513';
          this.ctx.fillRect(left, top, w, h);
          this.ctx.strokeStyle = '#DAA520';
          this.ctx.lineWidth = 1.5;
          this.ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);
          // Засов
          this.ctx.fillStyle = '#DAA520';
          this.ctx.beginPath();
          this.ctx.arc(cx, cy, 3, 0, Math.PI * 2);
          this.ctx.fill();
        }
        const doorName = window.getText?.(`objects.object_door`, 'pt') || 'Porta';
        this.ctx.fillStyle = '#FFFF00';
        this.ctx.font = '9px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(doorName, cx, top - 3);
        this.ctx.textAlign = 'left';
        return;
      }

      // ── СУНДУКИ (контейнеры) ──────────────────────────────────────
      if (obj.objectId === 'chest_red' || obj.objectId === 'chest_green') {
        const isOpen = gameState?.world?.containerStates?.[obj.id] === 'open';
        const mainColor  = obj.objectId === 'chest_red' ? '#6B1A1A' : '#1A5C1A';
        const lidColor   = obj.objectId === 'chest_red' ? '#9B2020' : '#2A7A2A';
        const rimColor   = obj.objectId === 'chest_red' ? '#FF6666' : '#66FF66';

        // Корпус сундука
        this.ctx.fillStyle = mainColor;
        this.ctx.fillRect(left, top + h / 2, w, h / 2);

        // Крышка (приоткрыта или закрыта)
        this.ctx.fillStyle = lidColor;
        if (isOpen) {
          // Открытая крышка — тонкая полоска сверху
          this.ctx.fillRect(left, top, w, h / 4);
        } else {
          this.ctx.fillRect(left, top, w, h / 2);
        }

        // Граница
        this.ctx.strokeStyle = rimColor;
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);

        // Иконка по центру
        this.ctx.font = '11px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(isOpen ? '📭' : '🔒', cx, cy + 4);

        // Предметы внутри открытого сундука
        if (isOpen && gameState) {
          const items = gameState.world.surfaceItems?.[obj.id] || [];
          const cols = Math.max(1, Math.round(w / 20));
          items.forEach((itemId, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const ix = left + col * 20 + 10;
            const iy = top  + row * 20 + 10;
            const itemData = this.findItemData(itemId);
            this.ctx.font = '11px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(itemData?.icon || '·', ix, iy + 4);
          });
        }

        // Название
        const chestName = window.getText?.(`objects.object_${obj.objectId}`, 'pt') || obj.objectId;
        this.ctx.fillStyle = '#FFFF00';
        this.ctx.font = '9px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(chestName, cx, top - 3);
        this.ctx.textAlign = 'left';
        return;
      }

      // ── СТАНДАРТНЫЕ ОБЪЕКТЫ ────────────────────────────────────────
      let color = '#8B7355';
      let icon  = '?';
      switch (obj.objectId) {
        case 'house': color = '#8B4513'; icon = '🏠'; break;
        case 'table': color = '#5c3a1e'; icon = '📦'; break;
        case 'well':  color = '#4a4a6a'; icon = '🪣'; break;
      }

      this.ctx.fillStyle = color;
      this.ctx.fillRect(left, top, w, h);

      // Граница — золотая для обычных, голубая для поверхностей
      this.ctx.strokeStyle = obj.isSurface ? '#88ddff' : '#FFD700';
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);

      // Иконка
      this.ctx.font = `${Math.min(w, h) - 4}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(icon, cx, cy + Math.min(w, h) / 4);

      // Название
      const objName = window.getText?.(`objects.object_${obj.objectId}`, 'pt') || obj.objectId;
      this.ctx.fillStyle = '#FFFF00';
      this.ctx.font = '9px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(objName, cx, top - 3);
      this.ctx.textAlign = 'left';

      // ── Предметы НА ПОВЕРХНОСТИ ────────────────────────────────────
      if (obj.isSurface && gameState) {
        const items = gameState.world.surfaceItems?.[obj.id] || [];
        const CELL2 = CELL;
        items.forEach((itemId, idx) => {
          // Кладём по одному предмету в каждую клетку поверхности (слева направо)
          const col = idx % Math.round(w / CELL2);
          const row = Math.floor(idx / Math.round(w / CELL2));
          const ix = left + col * CELL2 + CELL2 / 2;
          const iy = top  + row * CELL2 + CELL2 / 2;
          const itemData = this.findItemData(itemId);
          const iicon = itemData?.icon || '·';
          this.ctx.font = '11px Arial';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(iicon, ix, iy + 4);
        });
      }

    } catch (error) {
      console.error('Error rendering map object:', error);
    }
  }

  /**
   * Рендерим персонажа
   */
  renderPlayer(playerData) {
    if (!this.ctx || !playerData) return;
    
    try {
      // Используем упрощенную функцию движения (максимум одно обновление за фрейм)
      window.updatePlayerMovement?.(playerData);

      // Перечитываем обновленные данные для рендеринга
      playerData = window.getGameState?.().player;
      const x = playerData.x || 100;
      const y = playerData.y || 100;
      
      // Персонаж занимает ровно одну клетку сетки (20×20px)
      const CELL = 20;
      const cellX = Math.floor(x / CELL) * CELL;
      const cellY = Math.floor(y / CELL) * CELL;

      this.ctx.fillStyle = '#ff9800';
      this.ctx.fillRect(cellX, cellY, CELL, CELL);

      // Граница
      this.ctx.strokeStyle = '#ff6b35';
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeRect(cellX + 0.5, cellY + 0.5, CELL - 1, CELL - 1);

      // Имя персонажа над клеткой
      const playerName = window.getText?.('characters.player_name') || 'Player';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 9px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(playerName, cellX + CELL / 2, cellY - 3);
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
   * Рендерим один предмет в мире — ровно 20×20px (одна клетка сетки)
   */
  renderWorldObject(obj) {
    if (!this.ctx || !obj) return;

    try {
      const CELL = 20;
      const itemData = this.findItemData(obj.itemId);
      const icon = itemData?.icon || '?';

      // Привязываем к клетке сетки: левый верхний угол клетки
      const gx = Math.floor((obj.x || 0) / CELL);
      const gy = Math.floor((obj.y || 0) / CELL);
      const cellX = gx * CELL;
      const cellY = gy * CELL;

      // Заливка клетки (тёмно-зелёная)
      this.ctx.fillStyle = '#1e4d2e';
      this.ctx.fillRect(cellX, cellY, CELL, CELL);

      // Яркая граница — видно что предмет занимает ровно клетку
      this.ctx.strokeStyle = '#7aff7a';
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeRect(cellX + 0.5, cellY + 0.5, CELL - 1, CELL - 1);

      // Иконка предмета по центру клетки
      this.ctx.font = '13px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(icon, cellX + CELL / 2, cellY + CELL / 2 + 5);

      // Название мелко под клеткой
      const itemName = window.getText?.(`items.item_${obj.itemId}`, 'pt') || obj.itemId;
      this.ctx.fillStyle = '#c8ffc8';
      this.ctx.font = '8px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(itemName, cellX + CELL / 2, cellY + CELL + 8);

      this.ctx.textAlign = 'left';
    } catch (error) {
      console.error('Error rendering world object:', error);
    }
  }

  /**
   * Рисуем 20px навигационную сетку с подсветкой занятых клеток.
   * Красные клетки — непроходимо. Зелёная сетка — навигационные линии.
   */
  renderDebugGrid(gameState) {
    if (!this.ctx) return;

    const CELL = 20;
    const cols = Math.ceil(this.canvas.width / CELL);
    const rows = Math.ceil(this.canvas.height / CELL);

    // Подсвечиваем заблокированные клетки
    if (gameState && window.pathfindingSystem) {
      const walkable = window.pathfindingSystem.buildWalkableGrid(gameState);
      this.ctx.fillStyle = 'rgba(220, 50, 50, 0.22)';
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          if (walkable[gy * cols + gx] === 0) {
            this.ctx.fillRect(gx * CELL, gy * CELL, CELL, CELL);
          }
        }
      }
    }

    // Рисуем линии сетки поверх
    this.ctx.strokeStyle = 'rgba(80, 160, 80, 0.18)';
    this.ctx.lineWidth = 0.5;
    for (let x = 0; x <= cols * CELL; x += CELL) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    for (let y = 0; y <= rows * CELL; y += CELL) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
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
