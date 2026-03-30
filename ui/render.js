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
    this.voiceHistory = [];
    this.foxHistory = [];
    this.voiceHistoryLimit = 100;
    this.foxHistoryLimit = 50;
    this.voicePanelExpanded = false;
    this.foxPanelExpanded = false;
    this.lastVoiceCommandTime = 0;
    this.currentVoiceLine = '';
    this.lastExecutedVoiceLine = '';
    this.voicePanelEls = null;
    this.foxPanelEls = null;
    this.inventoryHoverRects = [];
    this.worldItemHoverRects = [];
    this.hoveredItem = null;
    
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    }
    
    this.setupCanvas();
    this.setupHistoryPanels();
    this.setupListeners();
  }

  _t(key, lang = null) {
    const text = window.getText?.(key, lang);
    return (text && text !== key) ? text : '';
  }

  getSprite(spriteId) {
    return window.spritesData?.sprites?.[spriteId] || null;
  }

  drawPixelSprite(spriteId, x, y, width = 20, height = width) {
    if (!this.ctx) return;
    const sprite = this.getSprite(spriteId);
    if (!sprite?.pixels?.length) return;

    const palette = window.spritesData?.palette || {};
    const rows = sprite.pixels;
    const spriteH = rows.length;
    const spriteW = rows[0]?.length || 0;
    if (!spriteW || !spriteH) return;

    const pxRaw = Math.min(width / spriteW, height / spriteH);
    const px = Math.max(1, pxRaw >= 1.5 ? Math.round(pxRaw) : pxRaw);
    const drawW = spriteW * px;
    const drawH = spriteH * px;
    const ox = x + (width - drawW) / 2;
    const oy = y + (height - drawH) / 2;

    for (let ry = 0; ry < spriteH; ry++) {
      const row = rows[ry] || '';
      for (let rx = 0; rx < spriteW; rx++) {
        const key = row[rx];
        if (!key || key === '.') continue;
        const color = palette[key];
        if (!color) continue;
        this.ctx.fillStyle = color;
        this.ctx.fillRect(ox + rx * px, oy + ry * px, px, px);
      }
    }

    if (sprite.overlay) {
      const [fx, fy] = sprite.overlay.from || [0, 0];
      const [tx, ty] = sprite.overlay.to || [spriteW - 1, spriteH - 1];
      this.ctx.strokeStyle = sprite.overlay.color || '#ff4d4d';
      this.ctx.lineWidth = Math.max(1, Math.floor(px / 2));
      this.ctx.beginPath();
      this.ctx.moveTo(ox + fx * px + px / 2, oy + fy * px + px / 2);
      this.ctx.lineTo(ox + tx * px + px / 2, oy + ty * px + px / 2);
      this.ctx.stroke();
    }
  }

  setupHistoryPanels() {
    // Создаём DOM-панели поверх canvas: история голоса и история лисёнка
    const root = document.body;
    if (!root) return;

    const makePanel = (side) => {
      const panel = document.createElement('div');
      panel.style.position = 'fixed';
      panel.style.bottom = '88px';
      panel.style[side] = '10px';
      panel.style.width = '360px';
      panel.style.maxWidth = 'calc(100vw - 20px)';
      panel.style.background = 'rgba(8, 12, 16, 0.92)';
      panel.style.border = '1px solid rgba(99, 179, 237, 0.45)';
      panel.style.borderRadius = '8px';
      panel.style.color = '#d7ebff';
      panel.style.font = '12px "Courier New", monospace';
      panel.style.zIndex = '1200';
      panel.style.pointerEvents = 'auto';
      panel.style.backdropFilter = 'blur(2px)';

      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.justifyContent = 'space-between';
      header.style.padding = '6px 8px';
      header.style.borderBottom = '1px solid rgba(99, 179, 237, 0.25)';
      header.style.background = 'rgba(16, 26, 38, 0.9)';

      const title = document.createElement('strong');
      title.style.fontSize = '12px';
      title.style.fontWeight = '700';

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '6px';

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.style.background = '#1d3550';
      toggleBtn.style.border = '1px solid #2f5f86';
      toggleBtn.style.color = '#d7ebff';
      toggleBtn.style.borderRadius = '6px';
      toggleBtn.style.padding = '2px 8px';
      toggleBtn.style.cursor = 'pointer';

      const body = document.createElement('div');
      body.style.maxHeight = '220px';
      body.style.overflowY = 'auto';
      body.style.padding = '6px 8px';
      body.style.whiteSpace = 'pre-wrap';
      body.style.wordBreak = 'break-word';
      body.style.lineHeight = '1.35';
      body.style.display = 'block';

      header.appendChild(title);
      actions.appendChild(toggleBtn);
      header.appendChild(actions);
      panel.appendChild(header);
      panel.appendChild(body);
      root.appendChild(panel);

      return { panel, header, title, body, toggleBtn };
    };

    this.voicePanelEls = makePanel('left');
    this.foxPanelEls = makePanel('right');

    this.voicePanelEls.toggleBtn.addEventListener('click', () => {
      this.voicePanelExpanded = !this.voicePanelExpanded;
      this.refreshHistoryPanels();
    });

    this.foxPanelEls.toggleBtn.addEventListener('click', () => {
      this.foxPanelExpanded = !this.foxPanelExpanded;
      this.refreshHistoryPanels();
    });

    this.refreshHistoryPanels();
  }

  appendHistory(list, text, limit) {
    if (!text || !String(text).trim()) return;
    list.push({ text: String(text), status: 'default' });
    if (list.length > limit) {
      list.splice(0, list.length - limit);
    }
  }

  markVoiceCommandExecuted(text) {
    if (!text) return;
    for (let idx = this.voiceHistory.length - 1; idx >= 0; idx--) {
      if (this.voiceHistory[idx]?.text === text) {
        this.voiceHistory[idx] = { ...this.voiceHistory[idx], status: 'executed' };
        break;
      }
    }
    this.refreshHistoryPanels();
  }

  renderPanelEntries(body, entries, collapsed, currentLine = '') {
    body.innerHTML = '';
    const visibleEntries = collapsed
      ? (currentLine
        ? [{ text: currentLine, status: entries[entries.length - 1]?.status || 'default' }]
        : (entries.length ? [entries[entries.length - 1]] : []))
      : entries;

    if (!visibleEntries.length) {
      body.textContent = this._t('ui.history_empty');
      return;
    }

    visibleEntries.forEach((entry) => {
      const row = document.createElement('div');
      row.textContent = entry.text;
      row.style.padding = '2px 0';
      row.style.whiteSpace = collapsed ? 'nowrap' : 'pre-wrap';
      row.style.overflow = 'hidden';
      row.style.textOverflow = 'ellipsis';
      row.style.color = entry.status === 'executed' ? '#8ff7a7' : '#d7ebff';
      body.appendChild(row);
    });
  }

  refreshHistoryPanels() {
    if (!this.voicePanelEls || !this.foxPanelEls) return;

    const t = (key) => this._t(key);

    // Voice panel
    const voice = this.voicePanelEls;
    voice.title.textContent = t('ui.voice_history_title');
    voice.toggleBtn.textContent = this.voicePanelExpanded
      ? t('ui.collapse')
      : t('ui.expand');
    voice.panel.style.width = this.voicePanelExpanded ? '540px' : '360px';
    voice.body.style.display = 'block';
    voice.body.style.maxHeight = '240px';
    this.renderPanelEntries(voice.body, this.voiceHistory, !this.voicePanelExpanded, this.currentVoiceLine);
    if (this.voicePanelExpanded) {
      voice.body.scrollTop = voice.body.scrollHeight;
    }

    // Fox panel
    const fox = this.foxPanelEls;
    fox.title.textContent = t('ui.fox_history_title');
    fox.toggleBtn.textContent = this.foxPanelExpanded
      ? t('ui.collapse')
      : t('ui.expand');
    fox.body.style.display = 'block';
    fox.panel.style.width = this.foxPanelExpanded ? '540px' : '360px';
    fox.body.style.maxHeight = '260px';
    this.renderPanelEntries(fox.body, this.foxHistory, !this.foxPanelExpanded, this.foxHistory[this.foxHistory.length - 1]?.text || '');
    if (this.foxPanelExpanded) {
      fox.body.scrollTop = fox.body.scrollHeight;
    }
  }

  setupCanvas() {
    if (!this.canvas) {
      return;
    }

    const config = window.gameConfig || {};
    this.canvas.width = config.canvas?.width || 800;
    this.canvas.height = config.canvas?.height || 600;
    
  }

  /**
   * Главный цикл рендеринга
   */
  render() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    this.inventoryHoverRects = [];
    this.worldItemHoverRects = [];

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
      this.ctx.fillText(this._t('ui.game_title'), 20, 30);
      
      this.ctx.fillStyle = '#4ade80';
      this.ctx.font = '12px Arial';
      if (gameState) {
        this.ctx.fillText(`${this._t('ui.language_label')}: ${gameState.ui.language}`, 20, 50);
        this.ctx.fillText(`${this._t('ui.player_label')}: (${gameState.player?.x || 0}, ${gameState.player?.y || 0})`, 20, 70);
      }
    } catch (error) {
      console.error(error);
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
      console.error(error);
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
          this.ctx.fillStyle = 'rgba(144,238,144,0.2)';
          this.ctx.fillRect(left, top, w, h);
          this.ctx.fillStyle = '#228B22';
          this.ctx.font = '8px Arial';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(this._t('ui.open_short', 'pt'), cx, cy + 3);
        } else {
          this.drawPixelSprite('object_door_locked', left, top, w, h);
        }
        const lockName = this._t(`objects.object_door_locked`, 'pt');
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
          this.ctx.fillStyle = 'rgba(144,238,144,0.2)';
          this.ctx.fillRect(left, top, w, h);
          this.ctx.fillStyle = '#228B22';
          this.ctx.font = '8px Arial';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(this._t('ui.open_short', 'pt'), cx, cy + 3);
        } else {
          this.drawPixelSprite('object_door', left, top, w, h);
        }
        const doorName = this._t(`objects.object_door`, 'pt');
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

        if (isOpen) {
          this.drawPixelSprite('ui_chest_open', left, top, w, h);
        } else {
          this.drawPixelSprite(`object_${obj.objectId}`, left, top, w, h);
        }

        // Предметы внутри открытого сундука
        if (isOpen && gameState) {
          const items = gameState.world.surfaceItems?.[obj.id] || [];
          const cols = Math.max(1, Math.round(w / 20));
          items.forEach((itemId, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const ix = left + col * 20 + 10;
            const iy = top  + row * 20 + 10;
            this.drawPixelSprite(`item_${itemId}`, ix - 10, iy - 10, 20, 20);
            this.worldItemHoverRects.push({ itemId, x: ix - 10, y: iy - 10, width: 20, height: 20 });
          });
        }

        // Название
        const chestName = this._t(`objects.object_${obj.objectId}`, 'pt');
        this.ctx.fillStyle = '#FFFF00';
        this.ctx.font = '9px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(chestName, cx, top - 3);
        this.ctx.textAlign = 'left';
        return;
      }

      // ── СТАНДАРТНЫЕ ОБЪЕКТЫ ────────────────────────────────────────
      // Тонкая рамка-подсветка вместо залитого фона
      this.ctx.strokeStyle = obj.isSurface ? 'rgba(136,221,255,0.35)' : 'rgba(255,215,0,0.25)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);

      this.drawPixelSprite(`object_${obj.objectId}`, left, top, w, h);

      // Название
      const objName = this._t(`objects.object_${obj.objectId}`, 'pt');
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
          this.drawPixelSprite(`item_${itemId}`, ix - 10, iy - 10, 20, 20);
          this.worldItemHoverRects.push({ itemId, x: ix - 10, y: iy - 10, width: 20, height: 20 });
        });
      }

    } catch (error) {
      console.error(error);
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

      // Мягкая тень под персонажем
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      this.ctx.beginPath();
      this.ctx.ellipse(cellX + CELL / 2, cellY + CELL - 1, CELL / 2.5, 2, 0, 0, Math.PI * 2);
      this.ctx.fill();

      this.drawPixelSprite('player_passenger', cellX, cellY, CELL, CELL);

      // Имя персонажа над клеткой
      const playerName = this._t('characters.player_name');
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 9px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(playerName, cellX + CELL / 2, cellY - 3);
      this.ctx.textAlign = 'left';
    } catch (error) {
      console.error(error);
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
      console.error(error);
    }
  }

  /**
   * Рендерим один предмет в мире — ровно 20×20px (одна клетка сетки)
   */
  renderWorldObject(obj) {
    if (!this.ctx || !obj) return;

    try {
      const CELL = 20;
      // Привязываем к клетке сетки: левый верхний угол клетки
      const gx = Math.floor((obj.x || 0) / CELL);
      const gy = Math.floor((obj.y || 0) / CELL);
      const cellX = gx * CELL;
      const cellY = gy * CELL;

      // Мягкое свечение под предметом
      this.ctx.fillStyle = 'rgba(122, 255, 122, 0.12)';
      this.ctx.beginPath();
      this.ctx.ellipse(cellX + CELL / 2, cellY + CELL - 1, CELL / 2.2, 2.5, 0, 0, Math.PI * 2);
      this.ctx.fill();

      this.drawPixelSprite(`item_${obj.itemId}`, cellX, cellY, CELL, CELL);

      // Название мелко под клеткой
      const itemName = this._t(`items.item_${obj.itemId}`, 'pt');
      this.ctx.fillStyle = '#c8ffc8';
      this.ctx.font = '8px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(itemName, cellX + CELL / 2, cellY + CELL + 8);
      this.worldItemHoverRects.push({ itemId: obj.itemId, x: cellX, y: cellY, width: CELL, height: CELL });

      this.ctx.textAlign = 'left';
    } catch (error) {
      console.error(error);
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
      
      // Обновляем историю голосовых сообщений (до 100 строк)
      if (gameState.voice?.lastCommand && gameState.voice?.lastCommandTime && gameState.voice.lastCommandTime > this.lastVoiceCommandTime) {
        this.lastVoiceCommandTime = gameState.voice.lastCommandTime;
        this.currentVoiceLine = gameState.voice.lastCommand;
        this.appendHistory(this.voiceHistory, gameState.voice.lastCommand, this.voiceHistoryLimit);
        if (this.lastExecutedVoiceLine && this.lastExecutedVoiceLine === gameState.voice.lastCommand) {
          this.markVoiceCommandExecuted(this.lastExecutedVoiceLine);
        }
        this.refreshHistoryPanels();
      }
      
      // Рисуем кнопку микрофона
      this.renderMicrophoneButton(window.voiceSystem?.isListening || false);
      
      // Рисуем статус голоса если слушаем
      if (window.voiceSystem?.isListening) {
        this.renderVoiceStatus();
      }

      this.renderHoveredItemTooltip();

      // Короткий пузырь лисёнка оставляем выключенным: постоянная история в отдельном окне
    } catch (error) {
      console.error(error);
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
      this.ctx.fillText(this._t('ui.inventory_title'), padding, panelY + 20);
      
      // Если инвентарь пуст
      if (!inventory || inventory.length === 0) {
        this.ctx.fillStyle = '#999999';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(this._t('ui.inventory_empty'), padding, panelY + 45);
        return;
      }
      
      // Рисуем предметы в инвентаре
      let x = padding;
      const itemY = panelY + 35;
      const itemSize = 20;
      const itemSpacing = 10;
      
      inventory.forEach((itemId, index) => {
        if (x + itemSize > this.canvas.width - padding) {
          // Переходим на новую строку если не влезает
          x = padding;
          return;
        }
        
        // Слот инвентаря — тонкая рамка без залитого фона
        this.ctx.strokeStyle = 'rgba(122,222,128,0.45)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x + 0.5, itemY + 0.5, itemSize - 1, itemSize - 1);
        
        this.drawPixelSprite(`item_${itemId}`, x, itemY, itemSize, itemSize);
        
        // Количество внизу (если несколько)
        const count = inventory.filter(i => i === itemId).length;
        if (count > 1) {
          this.ctx.fillStyle = '#ffff00';
          this.ctx.font = 'bold 10px Arial';
          this.ctx.textAlign = 'right';
          this.ctx.fillText(count.toString(), x + itemSize - 3, itemY + itemSize - 2);
          this.ctx.textAlign = 'left';
        }

        this.inventoryHoverRects.push({ itemId, x, y: itemY, width: itemSize, height: itemSize });
        
        x += itemSize + itemSpacing;
      });
    } catch (error) {
      console.error(error);
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
      console.error(error);
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
      
      this.drawPixelSprite(isListening ? 'ui_mic_on' : 'ui_mic_off', btnX + offset + 18, btnY + offset + 8, 24, 24);
      
      // Сохраняем область для нажатия
      this.micButtonRect = { x: btnX, y: btnY, width: btnWidth, height: btnHeight };
    } catch (error) {
      console.error(error);
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
      this.ctx.font = '12px monospace';
      this.ctx.fillText(transcript, padding, panelY + 15);
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Рендерим статус голоса
   */
  renderVoiceStatus() {
    if (!this.ctx) return;
    
    try {
      const statusText = this._t('voice.listening');
      
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
      this.ctx.fillText(statusText, this.canvas.width - 170, 35);
      
      // Пульсирующие точки
      this.ctx.fillStyle = '#ff5722';
      this.ctx.beginPath();
      this.ctx.arc(this.canvas.width - 15, 30, 3 + (pulse / 20), 0, Math.PI * 2);
      this.ctx.fill();
    } catch (error) {
      console.error(error);
    }
  }

  renderHoveredItemTooltip() {
    if (!this.ctx || !this.hoveredItem?.itemId) return;

    const itemName = this._t(`items.item_${this.hoveredItem.itemId}`, 'pt');
    if (!itemName) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.font = '12px Arial';
    const padding = 8;
    const boxWidth = ctx.measureText(itemName).width + padding * 2;
    const boxHeight = 24;
    const boxX = Math.min(this.canvas.width - boxWidth - 8, this.hoveredItem.x + 12);
    const boxY = Math.max(8, this.hoveredItem.y - boxHeight - 8);

    ctx.fillStyle = 'rgba(8, 12, 16, 0.92)';
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.strokeStyle = '#7ade80';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxWidth - 1, boxHeight - 1);
    ctx.fillStyle = '#d7ebff';
    ctx.fillText(itemName, boxX + padding, boxY + 16);
    ctx.restore();
  }

  /**
   * Рендерим речевой пузырь лисёнка в правом верхнем углу.
   * Показывается пока foxSystem.getMessage() возвращает текст.
   */
  renderFoxMessage(text) {
    if (!this.ctx || !text) return;
    try {
      const ctx = this.ctx;
      const padding = 10;
      const maxWidth = 220;
      const lineHeight = 18;
      const foxSize = 36;            // размер эмодзи лисёнка

      // Разбиваем текст на строки по ширине
      ctx.font = '13px Arial';
      const words = text.split(' ');
      const lines = [];
      let current = '';
      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth) {
          if (current) lines.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      if (current) lines.push(current);

      const bubbleW = maxWidth + padding * 2;
      const bubbleH = lines.length * lineHeight + padding * 2;

      // Позиция: левый нижний угол, над панелью транскрипта (canvas.height - 100)
      const bx = 10;
      const by = this.canvas.height - 100 - bubbleH - 8;

      // Фон пузыря
      ctx.save();
      ctx.fillStyle = 'rgba(255, 245, 200, 0.95)';
      ctx.strokeStyle = '#e0a020';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect?.(bx, by, bubbleW, bubbleH, 8)
        ?? ctx.rect(bx, by, bubbleW, bubbleH); // fallback для браузеров без roundRect
      ctx.fill();
      ctx.stroke();

      // Хвостик — треугольничек снизу (к иконке лисёнка снизу-слева)
      const tailX = bx + 20;
      const tailY = by + bubbleH;
      ctx.fillStyle = 'rgba(255, 245, 200, 0.95)';
      ctx.strokeStyle = '#e0a020';
      ctx.beginPath();
      ctx.moveTo(tailX - 6, tailY);
      ctx.lineTo(tailX + 6, tailY);
      ctx.lineTo(tailX, tailY + 8);
      ctx.fill();
      ctx.stroke();

      // Текст
      ctx.fillStyle = '#5a3000';
      ctx.font = '13px Arial';
      ctx.textAlign = 'left';
      lines.forEach((line, i) => {
        ctx.fillText(line, bx + padding, by + padding + lineHeight * i + 12);
      });

      // Лисёнок-эмодзи (справа от пузыря)
      this.drawPixelSprite('assistant_fox', bx + bubbleW + 8, by + Math.floor((bubbleH - foxSize) / 2), foxSize, foxSize);

      ctx.restore();
    } catch (e) {
      console.error(e);
    }
  }

  setupListeners() {
    if (!window.eventSystem) return;
    
    window.eventSystem.on('game:state-changed', () => {
      // Стейт изменился, следующий фрейм перерендерит
    });

    window.eventSystem.on('fox:say', ({ text }) => {
      this.appendHistory(this.foxHistory, text, this.foxHistoryLimit);
      this.refreshHistoryPanels();
    });

    window.eventSystem.on('voice:commandExecuted', ({ transcript }) => {
      this.lastExecutedVoiceLine = transcript || '';
      this.markVoiceCommandExecuted(transcript);
    });

    // Обработчик клика на canvas для кнопки микрофона
    if (this.canvas) {
      this.canvas.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        const hovered = [...this.inventoryHoverRects, ...this.worldItemHoverRects].find((item) => (
          x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height
        ));
        this.hoveredItem = hovered ? { itemId: hovered.itemId, x, y } : null;
      });

      this.canvas.addEventListener('mouseleave', () => {
        this.hoveredItem = null;
      });

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
            if (window.voiceSystem.isListening) {
              window.voiceSystem.stop();
            } else {
              window.voiceSystem.start();
            }
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
