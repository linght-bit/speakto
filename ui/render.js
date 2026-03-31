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
    this.devButtonRect = null; // область кнопки dev-режима
    this.micButtonPressed = false; // флаг нажатия кнопки (для визуального отклика)
    this.micButtonPressedTime = 0; // время нажатия кнопки
    this.devMode = false;
    this.voiceHistory = [];
    this.foxHistory = [];
    this.voiceHistoryLimit = 100;
    this.foxHistoryLimit = 50;
    this.voicePanelExpanded = false;
    this.foxPanelExpanded = false;
    this.inventoryPanelCollapsed = false;
    this.lastVoiceCommandTime = 0;
    this.currentVoiceLine = '';
    this.lastExecutedVoiceLine = '';
    this.voicePanelEls = null;
    this.foxPanelEls = null;
    this.inventoryPanelEls = null;
    this._inventoryPanelSignature = '';
    this.inventoryHoverRects = [];
    this.worldItemHoverRects = [];
    this.hoveredItem = null;
    this._camOffX = 0;
    this._camOffY = 0;
    this._zoom = 1;
    this._floorZoneCache = null;
    this._pendingBadToken = null; // последний bad-токен от лисёнка — применяется при добавлении записи в историю
    
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    }
    
    this.setupCanvas();
    this.setupHistoryPanels();
    this.setupInventoryPanel();
    this.setupListeners();

    window.addEventListener('resize', () => this.setupCanvas());
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
    this._drawPixelSpriteToContext(this.ctx, spriteId, x, y, width, height);
  }

  _drawPixelSpriteToContext(ctx, spriteId, x, y, width = 20, height = width) {
    if (!ctx) return;
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
        ctx.fillStyle = color;
        ctx.fillRect(ox + rx * px, oy + ry * px, px, px);
      }
    }

    if (sprite.overlay) {
      const [fx, fy] = sprite.overlay.from || [0, 0];
      const [tx, ty] = sprite.overlay.to || [spriteW - 1, spriteH - 1];
      ctx.strokeStyle = sprite.overlay.color || '#ff4d4d';
      ctx.lineWidth = Math.max(1, Math.floor(px / 2));
      ctx.beginPath();
      ctx.moveTo(ox + fx * px + px / 2, oy + fy * px + px / 2);
      ctx.lineTo(ox + tx * px + px / 2, oy + ty * px + px / 2);
      ctx.stroke();
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
      panel.style.font = '12px Arial, sans-serif';
      panel.style.zIndex = '1200';
      panel.style.pointerEvents = 'auto';
      panel.style.backdropFilter = 'blur(2px)';
      panel.style.minWidth = '240px';
      panel.style.minHeight = '90px';
      panel.style.resize = 'both';
      panel.style.overflow = 'auto';

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
      toggleBtn.style.borderRadius = '4px';
      toggleBtn.style.padding = '1px 5px';
      toggleBtn.style.cursor = 'pointer';
      toggleBtn.style.fontSize = '10px';
      toggleBtn.style.lineHeight = '1';
      toggleBtn.style.minWidth = '18px';

      // Drag logic — перетаскивание за заголовок
      let _isDragging = false;
      let _dragOffX = 0;
      let _dragOffY = 0;
      header.style.cursor = 'grab';
      header.style.userSelect = 'none';
      header.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        const rect = panel.getBoundingClientRect();
        panel.style.left = rect.left + 'px';
        panel.style.top = rect.top + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        _dragOffX = e.clientX - rect.left;
        _dragOffY = e.clientY - rect.top;
        _isDragging = true;
        header.style.cursor = 'grabbing';
        e.preventDefault();
      });
      document.addEventListener('mousemove', (e) => {
        if (!_isDragging) return;
        const maxL = window.innerWidth - panel.offsetWidth;
        const maxT = window.innerHeight - panel.offsetHeight;
        panel.style.left = Math.max(0, Math.min(maxL, e.clientX - _dragOffX)) + 'px';
        panel.style.top = Math.max(0, Math.min(maxT, e.clientY - _dragOffY)) + 'px';
      });
      document.addEventListener('mouseup', () => {
        if (_isDragging) { _isDragging = false; header.style.cursor = 'grab'; }
      });

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

  setupInventoryPanel() {
    const root = document.body;
    if (!root || this.inventoryPanelEls) return;

    const panel = document.createElement('div');
    panel.style.position = 'fixed';
    panel.style.left = '10px';
    panel.style.top = '10px';
    panel.style.width = '420px';
    panel.style.maxWidth = 'calc(100vw - 20px)';
    panel.style.background = 'rgba(8, 12, 16, 0.94)';
    panel.style.border = '1px solid rgba(255, 152, 0, 0.45)';
    panel.style.borderRadius = '8px';
    panel.style.color = '#ffe4b8';
    panel.style.font = '12px Arial, sans-serif';
    panel.style.zIndex = '1250';
    panel.style.pointerEvents = 'auto';
    panel.style.backdropFilter = 'blur(2px)';
    panel.style.minWidth = '260px';
    panel.style.minHeight = '100px';
    panel.style.resize = 'both';
    panel.style.overflow = 'auto';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.padding = '6px 8px';
    header.style.borderBottom = '1px solid rgba(255, 152, 0, 0.25)';
    header.style.background = 'rgba(28, 18, 10, 0.92)';
    header.style.cursor = 'grab';
    header.style.userSelect = 'none';

    const title = document.createElement('strong');
    title.style.fontSize = '12px';
    title.style.fontWeight = '700';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '6px';

    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.style.background = '#4c2f12';
    collapseBtn.style.border = '1px solid #8b5a1d';
    collapseBtn.style.color = '#ffe4b8';
    collapseBtn.style.borderRadius = '4px';
    collapseBtn.style.padding = '1px 6px';
    collapseBtn.style.cursor = 'pointer';
    collapseBtn.style.fontSize = '10px';
    collapseBtn.style.lineHeight = '1';
    collapseBtn.style.minWidth = '20px';

    const body = document.createElement('div');
    body.style.maxHeight = '190px';
    body.style.overflowY = 'auto';
    body.style.padding = '8px';

    const compact = document.createElement('div');
    compact.style.display = 'none';
    compact.style.padding = '6px 8px';
    compact.style.overflowX = 'auto';

    actions.appendChild(collapseBtn);
    header.appendChild(title);
    header.appendChild(actions);
    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(compact);
    root.appendChild(panel);

    let isDragging = false;
    let dragOffX = 0;
    let dragOffY = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('button')) return;
      const rect = panel.getBoundingClientRect();
      dragOffX = e.clientX - rect.left;
      dragOffY = e.clientY - rect.top;
      isDragging = true;
      header.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const maxL = Math.max(0, window.innerWidth - panel.offsetWidth);
      const maxT = Math.max(0, window.innerHeight - panel.offsetHeight);
      panel.style.left = Math.max(0, Math.min(maxL, e.clientX - dragOffX)) + 'px';
      panel.style.top = Math.max(0, Math.min(maxT, e.clientY - dragOffY)) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      header.style.cursor = 'grab';
    });

    collapseBtn.addEventListener('click', () => {
      this.inventoryPanelCollapsed = !this.inventoryPanelCollapsed;
      this._inventoryPanelSignature = '';
      this.refreshInventoryPanel();
    });

    this.inventoryPanelEls = { panel, header, title, body, compact, collapseBtn };
    this.refreshInventoryPanel();
  }

  _buildInventoryEntries(inventory) {
    const counts = new Map();
    for (const itemId of inventory || []) {
      counts.set(itemId, (counts.get(itemId) || 0) + 1);
    }
    return [...counts.entries()].map(([itemId, count]) => ({ itemId, count }));
  }

  _makeInventoryIcon(itemId, count) {
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.width = '28px';
    wrap.style.height = '28px';
    wrap.style.border = '1px solid rgba(122,222,128,0.45)';
    wrap.style.borderRadius = '4px';
    wrap.style.background = 'rgba(0, 0, 0, 0.18)';
    wrap.style.flex = '0 0 auto';

    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 24;
    canvas.style.width = '24px';
    canvas.style.height = '24px';
    canvas.style.display = 'block';
    canvas.style.margin = '1px auto 0';
    const ctx = canvas.getContext('2d');
    this._drawPixelSpriteToContext(ctx, `item_${itemId}`, 0, 0, 24, 24);
    wrap.appendChild(canvas);

    if (count > 1) {
      const badge = document.createElement('div');
      badge.textContent = String(count);
      badge.style.position = 'absolute';
      badge.style.right = '2px';
      badge.style.bottom = '0';
      badge.style.fontSize = '10px';
      badge.style.fontWeight = '700';
      badge.style.color = '#ffff66';
      wrap.appendChild(badge);
    }

    return wrap;
  }

  refreshInventoryPanel() {
    if (!this.inventoryPanelEls) return;
    const gameState = window.getGameState?.();
    const inventory = gameState?.player?.inventory || [];
    const entries = this._buildInventoryEntries(inventory);
    const t = (key) => this._t(key);
    const els = this.inventoryPanelEls;
    const signature = JSON.stringify({
      collapsed: this.inventoryPanelCollapsed,
      lang: gameState?.ui?.language || '',
      items: entries,
    });
    if (signature === this._inventoryPanelSignature) return;
    this._inventoryPanelSignature = signature;

    els.title.textContent = t('ui.inventory_title');
    els.collapseBtn.textContent = this.inventoryPanelCollapsed ? '▸' : '▾';
    els.body.style.display = this.inventoryPanelCollapsed ? 'none' : 'block';
    els.compact.style.display = this.inventoryPanelCollapsed ? 'block' : 'none';

    els.body.innerHTML = '';
    els.compact.innerHTML = '';

    if (!entries.length) {
      const empty = document.createElement('div');
      empty.textContent = t('ui.inventory_empty');
      empty.style.color = '#a4a4a4';
      empty.style.fontSize = '12px';
      els.body.appendChild(empty);

      const emptyCompact = document.createElement('div');
      emptyCompact.textContent = t('ui.inventory_empty');
      emptyCompact.style.color = '#a4a4a4';
      emptyCompact.style.fontSize = '12px';
      els.compact.appendChild(emptyCompact);
      return;
    }

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))';
    grid.style.gap = '6px';

    const compactRow = document.createElement('div');
    compactRow.style.display = 'flex';
    compactRow.style.gap = '6px';
    compactRow.style.flexWrap = 'nowrap';

    for (const { itemId, count } of entries) {
      const name = this._t(`items.item_${itemId}`) || itemId;
      const desc = this._t(`items.item_${itemId}_desc`) || '';

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '8px';
      row.style.padding = '4px 6px';
      row.style.border = '1px solid rgba(255,152,0,0.18)';
      row.style.borderRadius = '6px';
      row.style.background = 'rgba(255,152,0,0.06)';
      row.title = desc ? `${name} - ${desc}` : name;

      const icon = this._makeInventoryIcon(itemId, count);
      row.appendChild(icon);

      const meta = document.createElement('div');
      meta.style.minWidth = '0';
      meta.style.flex = '1';

      const nameEl = document.createElement('div');
      nameEl.textContent = name;
      nameEl.style.color = '#ffe4b8';
      nameEl.style.fontWeight = '700';
      nameEl.style.fontSize = '12px';
      nameEl.style.whiteSpace = 'nowrap';
      nameEl.style.overflow = 'hidden';
      nameEl.style.textOverflow = 'ellipsis';

      const countEl = document.createElement('div');
      countEl.textContent = `x${count}`;
      countEl.style.color = '#ffcc66';
      countEl.style.fontSize = '11px';

      meta.appendChild(nameEl);
      meta.appendChild(countEl);
      row.appendChild(meta);
      grid.appendChild(row);

      const compactCell = this._makeInventoryIcon(itemId, count);
      compactCell.title = name;
      compactRow.appendChild(compactCell);
    }

    els.body.appendChild(grid);
    els.compact.appendChild(compactRow);
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
      row.style.padding = '2px 0';
      row.style.whiteSpace = collapsed ? 'nowrap' : 'pre-wrap';
      row.style.overflow = 'hidden';
      row.style.textOverflow = 'ellipsis';

      // Определяем цвет записи
      const baseColor = entry.status === 'executed' ? '#8ff7a7'
        : entry.status === 'error' ? '#ffccaa'
        : '#d7ebff';
      row.style.color = baseColor;

      // Если есть bad-токен — подсвечиваем его красным
      if (entry.badToken) {
        const txt = entry.text;
        const badLow = entry.badToken.toLowerCase();
        const txtLow = txt.toLowerCase();
        const idx = txtLow.indexOf(badLow);
        if (idx >= 0) {
          const before = document.createTextNode(txt.slice(0, idx));
          const bad = document.createElement('span');
          bad.textContent = txt.slice(idx, idx + entry.badToken.length);
          bad.style.color = '#ff6b6b';
          bad.style.fontWeight = 'bold';
          const after = document.createTextNode(txt.slice(idx + entry.badToken.length));
          row.appendChild(before);
          row.appendChild(bad);
          row.appendChild(after);
        } else {
          row.textContent = txt;
        }
      } else {
        row.textContent = entry.text;
      }

      body.appendChild(row);
    });
  }

  refreshHistoryPanels() {
    if (!this.voicePanelEls || !this.foxPanelEls) return;

    const t = (key) => this._t(key);

    // Voice panel
    const voice = this.voicePanelEls;
    voice.title.textContent = t('ui.voice_history_title');
    voice.toggleBtn.textContent = this.voicePanelExpanded ? '▼' : '▲';
    voice.body.style.display = 'block';
    voice.body.style.maxHeight = this.voicePanelExpanded ? '220px' : '32px';
    this.renderPanelEntries(voice.body, this.voiceHistory, !this.voicePanelExpanded, this.currentVoiceLine);
    if (this.voicePanelExpanded) {
      voice.body.scrollTop = voice.body.scrollHeight;
    }

    // Fox panel
    const fox = this.foxPanelEls;
    fox.title.textContent = t('ui.fox_history_title');
    fox.toggleBtn.textContent = this.foxPanelExpanded ? '▼' : '▲';
    fox.body.style.display = 'block';
    fox.body.style.maxHeight = this.foxPanelExpanded ? '260px' : '32px';
    this.renderPanelEntries(fox.body, this.foxHistory, !this.foxPanelExpanded, this.foxHistory[this.foxHistory.length - 1]?.text || '');
    if (this.foxPanelExpanded) {
      fox.body.scrollTop = fox.body.scrollHeight;
    }
  }

  setupCanvas() {
    if (!this.canvas) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const logW = Math.max(320, window.innerWidth || 800);
    const logH = Math.max(240, window.innerHeight || 600);

    this._logW = logW;
    this._logH = logH;
    this._dpr = dpr;

    // Физический буфер = logical × dpr → чёткий текст на HiDPI-экранах
    this.canvas.width = Math.round(logW * dpr);
    this.canvas.height = Math.round(logH * dpr);
    // CSS размер остаётся логическим
    this.canvas.style.width = logW + 'px';
    this.canvas.style.height = logH + 'px';

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

    // Камера: следим за персонажем, масштаб 1.6x
    const ZOOM = 1.6;
    const _gs = window.getGameState?.();
    const _px = (_gs?.player?.x ?? 100) + 10; // центр клетки
    const _py = (_gs?.player?.y ?? 100) + 10;
    const _camX = this._logW / 2 - _px * ZOOM;
    const _camY = this._logH / 2 - _py * ZOOM;
    this._camOffX = _camX;
    this._camOffY = _camY;
    this._zoom = ZOOM;

    this.ctx.save();
    this.ctx.translate(_camX, _camY);
    this.ctx.scale(ZOOM, ZOOM);
    this.renderWorld();
    this.ctx.restore();

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
    this.ctx.fillRect(0, 0, this._logW, this._logH);
  }

  /**
   * Рендерим мир
   */
  renderWorld() {
    if (!this.ctx) return;

    try {
      const gameState = window.getGameState?.();

      // 1. Космический фон (за всем)
      this.renderSpaceBackground();

      // 2. Пол корабля — плиточная текстура
      this.renderShipFloor();

      // 3. Стены корпуса
      this.renderShipWalls(gameState);

      // Внутренняя планировка переведена в творческий режим (runtime map editor).

      // 4. Объекты карты (окна и т.д.)
      if (gameState && gameState.world?.mapObjects) {
        this.renderMapObjects(gameState.world.mapObjects);
      }

      // 5. Персонаж
      if (gameState && gameState.player) {
        this.renderPlayer(gameState.player);
      }

      // 6. Предметы в мире
      if (gameState && gameState.world?.objects) {
        this.renderWorldObjects(gameState.world.objects);
      }

      // 7. Отладочная сетка (только при debug.showGrid)
      if (window.gameConfig?.debug?.showGrid) {
        this.renderDebugGrid(gameState);
      }

    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Вернуть диапазон видимых клеток (с нужным запасом)
   */
  _visibleCellRange() {
    const CELL = 20;
    const zoom = this._zoom || 1;
    const camX = -(this._camOffX || 0) / zoom;
    const camY = -(this._camOffY || 0) / zoom;
    const visW = (this._logW || 800) / zoom;
    const visH = (this._logH || 600) / zoom;
    const cols = window.pathfindingSystem?.GRID_COLS || 80;
    const rows = window.pathfindingSystem?.GRID_ROWS || 130;
    return {
      x0: Math.max(0, Math.floor(camX / CELL) - 1),
      y0: Math.max(0, Math.floor(camY / CELL) - 1),
      x1: Math.min(cols - 1, Math.ceil((camX + visW) / CELL) + 1),
      y1: Math.min(rows - 1, Math.ceil((camY + visH) / CELL) + 1),
    };
  }

  /**
   * Рисуем космический фон: фиолетово-чёрный градиент + звёзды.
   * Покрывает весь видимый viewport.
   */
  renderSpaceBackground() {
    if (!this.ctx) return;
    const CELL = 20;
    const zoom = this._zoom || 1;
    const camX = -(this._camOffX || 0) / zoom;
    const camY = -(this._camOffY || 0) / zoom;
    const visW = (this._logW || 800) / zoom;
    const visH = (this._logH || 600) / zoom;
    const worldH = (window.pathfindingSystem?.GRID_ROWS || 130) * CELL;

    // Вертикальный градиент — глубокий космос
    const grad = this.ctx.createLinearGradient(camX, camY, camX, camY + visH);
    const relTop = Math.max(0, camY) / worldH;
    const relBot = Math.min(1, (camY + visH) / worldH);
    // Оттенки фиолетово-чёрного
    const topColor = this._spaceGradColor(relTop);
    const botColor = this._spaceGradColor(relBot);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, botColor);
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(camX, camY, visW, visH);

    // Звёзды
    if (!this._stars) {
      const wW = (window.pathfindingSystem?.GRID_COLS || 80) * CELL;
      this._stars = this._generateStars(500, wW, worldH);
    }
    for (const s of this._stars) {
      if (s.x < camX - s.r * 2 || s.x > camX + visW + s.r * 2) continue;
      if (s.y < camY - s.r * 2 || s.y > camY + visH + s.r * 2) continue;
      this.ctx.globalAlpha = s.alpha;
      this.ctx.fillStyle = s.color;
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
  }

  _spaceGradColor(rel) {
    // rel: 0 (верх мира) → 1 (низ мира)
    // Переходим от тёмно-фиолетового сверху к почти чёрному снизу
    const r = Math.round(8 + rel * 4);
    const g = Math.round(0 + rel * 2);
    const b = Math.round(22 + rel * (-8));
    return `rgb(${r},${g},${b})`;
  }

  /** Генерируем список звёзд с фиксированным seed — одинаковые каждый запуск */
  _generateStars(count, worldW, worldH) {
    const stars = [];
    let s = 0x9e3779b9; // фиксированный seed
    const rand = () => {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      return ((s >>> 0) / 0xffffffff);
    };
    const colors = ['#ffffff', '#ffe8c0', '#c8e0ff', '#ffe0b0', '#ddeeff'];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: rand() * worldW,
        y: rand() * worldH,
        r: rand() * 1.8 + 0.4,
        color: colors[Math.floor(rand() * colors.length)],
        alpha: rand() * 0.55 + 0.45,
      });
    }
    return stars;
  }

  /**
   * Рисуем плиточный пол корабля.
   * Каждая игровая клетка 20×20 содержит 4 плитки 10×10 (слегка заметные).
   */
  renderShipFloor() {
    if (!this.ctx) return;
    const CELL = 20;
    const TILE = 10;
    const { x0, y0, x1, y1 } = this._visibleCellRange();
    const pf = window.pathfindingSystem;
    const gs = window.getGameState?.();
    const zones = this._buildFloorZoneHints(gs, pf);

    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (pf?._classifyHullCell(cx, cy) !== 'floor') continue;
        const zone = this._getFloorZone(cx, cy, pf, zones);
        const px = cx * CELL;
        const py = cy * CELL;
        const palette = this._floorPaletteForZone(zone);

        for (let ty = 0; ty < 2; ty++) {
          for (let tx = 0; tx < 2; tx++) {
            const bx = px + tx * TILE;
            const by = py + ty * TILE;
            const shade = (tx + ty) % 2 === 0 ? palette.a : palette.b;
            this.ctx.fillStyle = shade;
            this.ctx.fillRect(bx, by, TILE, TILE);
            this.ctx.strokeStyle = palette.grid;
            this.ctx.lineWidth = 0.5;
            this.ctx.strokeRect(bx + 0.25, by + 0.25, TILE - 0.5, TILE - 0.5);
          }
        }

        // Легкий характерный акцент по типу помещения
        if (palette.accent) {
          this.ctx.fillStyle = palette.accent;
          if (zone === 'corridor') {
            this.ctx.fillRect(px + 2, py + 9, CELL - 4, 2);
          } else if (zone === 'technical') {
            this.ctx.fillRect(px + 8, py + 2, 4, CELL - 4);
          } else if (zone === 'reactor') {
            this.ctx.beginPath();
            this.ctx.arc(px + 10, py + 10, 3, 0, Math.PI * 2);
            this.ctx.fill();
          } else if (zone === 'bridge') {
            this.ctx.fillRect(px + 3, py + 3, CELL - 6, 2);
          } else if (zone === 'hall') {
            this.ctx.fillRect(px + 3, py + 3, 2, CELL - 6);
            this.ctx.fillRect(px + 15, py + 3, 2, CELL - 6);
          }
        }
      }
    }
  }

  _buildFloorZoneHints(gameState, pf = window.pathfindingSystem) {
    const mapObjects = gameState?.world?.mapObjects || [];
    const ship = pf?._shipCfg;
    if (this._floorZoneCache?.mapObjectsRef === mapObjects) {
      return this._floorZoneCache.data;
    }
    const signature = mapObjects
      .map(obj => [obj.id, obj.objectId, obj.x, obj.y, obj.width, obj.height].join(':'))
      .join('|');

    if (this._floorZoneCache?.signature === signature) {
      return this._floorZoneCache.data;
    }

    const blocked = new Set();
    const objectCells = new Map();
    const CELL = 20;

    for (const obj of mapObjects) {
      const w = Math.max(1, Math.round((obj.width || CELL) / CELL));
      const h = Math.max(1, Math.round((obj.height || CELL) / CELL));
      const cx = Math.floor((obj.x || 0) / CELL);
      const cy = Math.floor((obj.y || 0) / CELL);
      const minX = cx - Math.floor(w / 2);
      const minY = cy - Math.floor(h / 2);
      for (let gx = minX; gx < minX + w; gx++) {
        for (let gy = minY; gy < minY + h; gy++) {
          const key = `${gx},${gy}`;
          if (!objectCells.has(key)) objectCells.set(key, []);
          objectCells.get(key).push(obj.objectId);
          if (this._isFloorZoneBlocker(obj.objectId)) blocked.add(key);
        }
      }
    }

    const cellZones = new Map();
    const visited = new Set();
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

    for (let gy = 0; gy < (pf?.GRID_ROWS || 0); gy++) {
      for (let gx = 0; gx < (pf?.GRID_COLS || 0); gx++) {
        const startKey = `${gx},${gy}`;
        if (visited.has(startKey)) continue;
        if (pf?._classifyHullCell(gx, gy) !== 'floor') continue;
        if (blocked.has(startKey)) continue;

        const queue = [[gx, gy]];
        visited.add(startKey);
        const cells = [];
        let minX = gx;
        let maxX = gx;
        let minY = gy;
        let maxY = gy;
        const nearbyObjects = new Set();

        while (queue.length) {
          const [cx, cy] = queue.shift();
          cells.push([cx, cy]);
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          for (let sy = cy - 1; sy <= cy + 1; sy++) {
            for (let sx = cx - 1; sx <= cx + 1; sx++) {
              const ids = objectCells.get(`${sx},${sy}`) || [];
              for (const objectId of ids) nearbyObjects.add(objectId);
            }
          }

          for (const [dx, dy] of dirs) {
            const nx = cx + dx;
            const ny = cy + dy;
            const key = `${nx},${ny}`;
            if (visited.has(key)) continue;
            if (pf?._classifyHullCell(nx, ny) !== 'floor') continue;
            if (blocked.has(key)) continue;
            visited.add(key);
            queue.push([nx, ny]);
          }
        }

        const zone = this._classifyFloorRegion({
          cells,
          minX,
          maxX,
          minY,
          maxY,
          area: cells.length,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
          nearbyObjects,
        }, ship);

        for (const [cx, cy] of cells) {
          cellZones.set(`${cx},${cy}`, zone);
        }
      }
    }

    const data = { cellZones };
    this._floorZoneCache = { signature, data, mapObjectsRef: mapObjects };
    return data;
  }

  _getFloorZone(cx, cy, pf, zones) {
    return zones?.cellZones?.get(`${cx},${cy}`) || 'default';
  }

  _isFloorZoneBlocker(objectId) {
    return objectId === 'wall' ||
      objectId === 'bulkhead_heavy_v' ||
      objectId === 'bulkhead_heavy_h' ||
      objectId === 'door_inner_v' ||
      objectId === 'door_inner_h' ||
      objectId === 'airlock_door_v' ||
      objectId === 'airlock_door_h' ||
      String(objectId || '').startsWith('door_color_');
  }

  _classifyFloorRegion(region, ship) {
    const centerX = Math.floor((region.minX + region.maxX) / 2);
    const centerY = Math.floor((region.minY + region.maxY) / 2);
    const hasObject = (ids) => ids.some(id => region.nearbyObjects.has(id));

    if (ship && region.minY <= ship.noseBaseRow + 16) return 'bridge';

    if (hasObject(['agg_reactor_cluster', 'reactor_core'])) return 'reactor';

    if (hasObject(['agg_engine_block', 'agg_life_support', 'agg_hyperdrive', 'agg_coolant_matrix', 'tech_block', 'battery_rack', 'console', 'terminal', 'pipe_v', 'pipe_h', 'pipe_corner', 'cable_tray'])) {
      return centerX >= 44 ? 'technical' : 'hall';
    }

    const isMainCorridor = (
      (centerX >= 37 && centerX <= 43 && region.width <= 9) ||
      (centerY >= 60 && centerY <= 64 && region.height <= 7) ||
      (centerY >= 78 && centerY <= 82 && region.height <= 7) ||
      (centerY >= 96 && centerY <= 100 && region.height <= 7)
    );
    if (isMainCorridor) return 'corridor';

    if (region.width <= 5 || region.height <= 5) return 'corridor';

    if (centerX <= 36) return 'cabin';
    if (centerX >= 44 && region.maxY < 108) return 'technical';
    if (region.area >= 90 || region.width >= 14 || region.height >= 14) return 'hall';

    return centerX <= 40 ? 'cabin' : 'technical';
  }

  _floorPaletteForZone(zone) {
    switch (zone) {
      case 'corridor':
        return { a: '#c2cad4', b: '#d0d7df', grid: 'rgba(126,142,160,0.38)', accent: 'rgba(236,246,255,0.25)' };
      case 'cabin':
        return { a: '#cbc4b7', b: '#d9d1c3', grid: 'rgba(140,128,112,0.28)', accent: null };
      case 'technical':
        return { a: '#a8b5c2', b: '#b7c3cf', grid: 'rgba(86,104,122,0.35)', accent: 'rgba(160,220,255,0.18)' };
      case 'reactor':
        return { a: '#7e8792', b: '#8a949f', grid: 'rgba(36,54,72,0.40)', accent: 'rgba(120,220,255,0.30)' };
      case 'bridge':
        return { a: '#b8cad8', b: '#c7d7e3', grid: 'rgba(100,128,150,0.34)', accent: 'rgba(255,255,255,0.25)' };
      case 'hall':
        return { a: '#c8cfc5', b: '#d8ddd4', grid: 'rgba(134,146,134,0.30)', accent: 'rgba(255,240,180,0.14)' };
      default:
        return { a: '#cdd4db', b: '#d6dce3', grid: 'rgba(130,145,160,0.35)', accent: null };
    }
  }

  /**
   * Этап 1 внутренней планировки: два вертикальных коридора в нижней части.
   * Только визуальная разметка, без влияния на механику и проходимость.
   */
  renderLowerDeckCorridorsPhase1() {
    if (!this.ctx) return;
    const pf = window.pathfindingSystem;
    const ship = pf?._shipCfg;
    if (!pf || !ship) return;

    const CELL = 20;
    const { x0, y0, x1, y1 } = this._visibleCellRange();

    const hullLeft = ship.hullLeft;
    const hullRight = ship.hullRight;
    const hullBottom = ship.hullBottom;

    // По ТЗ: коридоры шириной 10 клеток, длиной 50 клеток,
    // нижний край на 20 клеток выше нижней стены корпуса.
    const corridorWidth = 10;
    const corridorLen = 50;
    const corridorBottom = hullBottom - 20;
    const corridorTop = corridorBottom - corridorLen + 1;

    // Левый коридор: отступ 12 клеток от левой внешней стены.
    const leftCorrX0 = hullLeft + 12;
    const leftCorrX1 = leftCorrX0 + corridorWidth - 1;

    // Правый коридор: отступ 15 клеток от правой внешней стены.
    const rightCorrX1 = hullRight - 15;
    const rightCorrX0 = rightCorrX1 - corridorWidth + 1;

    const corridors = [
      { x0: leftCorrX0, x1: leftCorrX1, y0: corridorTop, y1: corridorBottom },
      { x0: rightCorrX0, x1: rightCorrX1, y0: corridorTop, y1: corridorBottom },
    ];

    for (const c of corridors) {
      const drawX0 = Math.max(c.x0, x0);
      const drawX1 = Math.min(c.x1, x1);
      const drawY0 = Math.max(c.y0, y0);
      const drawY1 = Math.min(c.y1, y1);
      if (drawX0 > drawX1 || drawY0 > drawY1) continue;

      for (let cy = drawY0; cy <= drawY1; cy++) {
        for (let cx = drawX0; cx <= drawX1; cx++) {
          if (pf._classifyHullCell(cx, cy) !== 'floor') continue;
          const px = cx * CELL;
          const py = cy * CELL;

          // Контрастная, но мягкая заливка коридора
          this.ctx.fillStyle = 'rgba(108, 122, 138, 0.45)';
          this.ctx.fillRect(px, py, CELL, CELL);

          // Лёгкая внутренняя полоска, чтобы коридор читался как путь
          this.ctx.fillStyle = 'rgba(196, 210, 224, 0.14)';
          this.ctx.fillRect(px + 2, py + 8, CELL - 4, 4);
        }
      }

      // Граница коридора
      this.ctx.strokeStyle = 'rgba(210, 220, 232, 0.45)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(
        c.x0 * CELL + 0.5,
        c.y0 * CELL + 0.5,
        (c.x1 - c.x0 + 1) * CELL - 1,
        (c.y1 - c.y0 + 1) * CELL - 1
      );
    }
  }

  /**
   * Этап 2 внутренней планировки: левый ряд кают.
   * У каждой каюты: окно во внешней стене и дверь в левый коридор.
   * Только визуал, проходимость/механика не меняются.
   */
  renderLowerDeckLeftCabinsPhase2() {
    if (!this.ctx) return;
    const pf = window.pathfindingSystem;
    const ship = pf?._shipCfg;
    if (!pf || !ship) return;

    const CELL = 20;
    const { x0, y0, x1, y1 } = this._visibleCellRange();

    const hullLeft = ship.hullLeft;
    const hullBottom = ship.hullBottom;

    // Те же базовые параметры, что у коридоров в этапе 1
    const corridorWidth = 10;
    const corridorLen = 50;
    const corridorBottom = hullBottom - 20;
    const corridorTop = corridorBottom - corridorLen + 1;
    const leftCorrX0 = hullLeft + 12;

    // Зона кают слева от коридора: между внешней стеной и стенкой коридора
    const roomX0 = hullLeft + 1;
    const roomX1 = leftCorrX0 - 2;
    const roomWallX = leftCorrX0 - 1; // стенка с дверями в коридор

    // Высоты кают: 9..13 клеток
    const cabinHeights = [10, 12, 9, 11];
    let cursorY = corridorTop;

    for (let i = 0; i < cabinHeights.length; i++) {
      const h = cabinHeights[i];
      const cabinY0 = cursorY;
      const cabinY1 = Math.min(corridorBottom, cabinY0 + h - 1);
      if (cabinY0 > corridorBottom) break;

      // Внутренняя заливка каюты
      const drawX0 = Math.max(roomX0, x0);
      const drawX1 = Math.min(roomX1, x1);
      const drawY0 = Math.max(cabinY0, y0);
      const drawY1 = Math.min(cabinY1, y1);
      if (drawX0 <= drawX1 && drawY0 <= drawY1) {
        for (let cy = drawY0; cy <= drawY1; cy++) {
          for (let cx = drawX0; cx <= drawX1; cx++) {
            if (pf._classifyHullCell(cx, cy) !== 'floor') continue;
            const px = cx * CELL;
            const py = cy * CELL;
            this.ctx.fillStyle = (i % 2 === 0)
              ? 'rgba(170, 178, 188, 0.20)'
              : 'rgba(154, 166, 178, 0.20)';
            this.ctx.fillRect(px, py, CELL, CELL);
          }
        }
      }

      // Горизонтальные перегородки каюты: верх рисуем только у первой,
      // а низ — у каждой. Это даёт одинарные стены между каютами.
      const ys = i === 0 ? [cabinY0, cabinY1] : [cabinY1];
      for (const wy of ys) {
        if (wy < y0 || wy > y1) continue;
        for (let cx = roomX0; cx <= roomWallX; cx++) {
          if (cx < x0 || cx > x1) continue;
          if (pf._classifyHullCell(cx, wy) !== 'floor') continue;
          this._drawInnerBulkheadCell(cx * CELL, wy * CELL, CELL);
        }
      }

      const doorCenter = Math.round((cabinY0 + cabinY1) / 2);

      // Вертикальная стенка у коридора (с проёмом под дверь)
      for (let cy = cabinY0; cy <= cabinY1; cy++) {
        if (cy < y0 || cy > y1) continue;
        if (roomWallX < x0 || roomWallX > x1) continue;
        if (pf._classifyHullCell(roomWallX, cy) !== 'floor') continue;
        if (cy === doorCenter) continue;
        this._drawInnerBulkheadCell(roomWallX * CELL, cy * CELL, CELL);
      }

      // Окно по центру внешней стены: 3-5 клеток (чередуем 3/4/5)
      const winLen = [3, 4, 5][i % 3];
      const winStart = Math.max(cabinY0 + 1, Math.round((cabinY0 + cabinY1 - winLen + 1) / 2));
      const wallX = hullLeft;
      for (let k = 0; k < winLen; k++) {
        const cy = winStart + k;
        if (cy < cabinY0 || cy > cabinY1) continue;
        if (cy < y0 || cy > y1) continue;
        if (wallX < x0 || wallX > x1) continue;

        const px = wallX * CELL;
        const py = cy * CELL;
        // Прорезь в стене (убираем металл)
        this.ctx.fillStyle = 'rgba(24, 10, 36, 0.95)';
        this.ctx.fillRect(px, py, CELL, CELL);
        // Само окно
        this.ctx.fillStyle = 'rgba(110, 210, 255, 0.42)';
        this.ctx.fillRect(px + 3, py + 2, CELL - 6, CELL - 4);
        this.ctx.strokeStyle = '#6cd6ff';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(px + 3.5, py + 2.5, CELL - 7, CELL - 5);
      }

      cursorY = cabinY1 + 1;
    }
  }

  /**
   * Этап 3: правый ряд более крупных помещений.
   * Каждое помещение имеет одну дверь в правый коридор.
   */
  renderLowerDeckRightRoomsPhase3() {
    if (!this.ctx) return;
    const pf = window.pathfindingSystem;
    const ship = pf?._shipCfg;
    if (!pf || !ship) return;

    const CELL = 20;
    const { x0, y0, x1, y1 } = this._visibleCellRange();

    const hullRight = ship.hullRight;
    const hullBottom = ship.hullBottom;

    const corridorWidth = 10;
    const corridorLen = 50;
    const corridorBottom = hullBottom - 20;
    const corridorTop = corridorBottom - corridorLen + 1;

    const rightCorrX1 = hullRight - 15;
    const rightCorrX0 = rightCorrX1 - corridorWidth + 1;

    const roomWallX = rightCorrX1 + 1; // левая стенка правых помещений
    const roomX0 = rightCorrX1 + 2;
    const roomX1 = hullRight - 1;

    const roomHeights = [14, 15, 13, 8];
    let cursorY = corridorTop;

    for (let i = 0; i < roomHeights.length; i++) {
      const h = roomHeights[i];
      const roomY0 = cursorY;
      const roomY1 = Math.min(corridorBottom, roomY0 + h - 1);
      if (roomY0 > corridorBottom) break;

      const drawX0 = Math.max(roomX0, x0);
      const drawX1 = Math.min(roomX1, x1);
      const drawY0 = Math.max(roomY0, y0);
      const drawY1 = Math.min(roomY1, y1);
      if (drawX0 <= drawX1 && drawY0 <= drawY1) {
        for (let cy = drawY0; cy <= drawY1; cy++) {
          for (let cx = drawX0; cx <= drawX1; cx++) {
            if (pf._classifyHullCell(cx, cy) !== 'floor') continue;
            const px = cx * CELL;
            const py = cy * CELL;
            this.ctx.fillStyle = (i % 2 === 0)
              ? 'rgba(156, 170, 184, 0.18)'
              : 'rgba(140, 158, 174, 0.18)';
            this.ctx.fillRect(px, py, CELL, CELL);
          }
        }
      }

      // Горизонтальные перегородки: верх только у первой, низ у каждой.
      const ys = i === 0 ? [roomY0, roomY1] : [roomY1];
      for (const wy of ys) {
        if (wy < y0 || wy > y1) continue;
        for (let cx = roomWallX; cx <= roomX1; cx++) {
          if (cx < x0 || cx > x1) continue;
          if (pf._classifyHullCell(cx, wy) !== 'floor') continue;
          this._drawInnerBulkheadCell(cx * CELL, wy * CELL, CELL);
        }
      }

      const doorY = Math.round((roomY0 + roomY1) / 2);

      // Стенка у коридора (с проёмом под дверь)
      for (let cy = roomY0; cy <= roomY1; cy++) {
        if (cy < y0 || cy > y1) continue;
        if (roomWallX < x0 || roomWallX > x1) continue;
        if (pf._classifyHullCell(roomWallX, cy) !== 'floor') continue;
        if (cy === doorY) continue;
        this._drawInnerBulkheadCell(roomWallX * CELL, cy * CELL, CELL);
      }

      cursorY = roomY1 + 1;
    }
  }

  _drawInnerBulkheadCell(px, py, size) {
    this.ctx.fillStyle = '#9aa8b6';
    this.ctx.fillRect(px, py, size, size);
    this.ctx.strokeStyle = '#7d8f9f';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
  }

  _drawInnerDoorCell(px, py, size, axis = 'vertical', isOpen = false) {
    this.ctx.fillStyle = 'rgba(70, 90, 110, 0.90)';
    this.ctx.fillRect(px + 2, py + 2, size - 4, size - 4);

    if (isOpen) {
      this.ctx.fillStyle = 'rgba(150, 220, 255, 0.35)';
      if (axis === 'vertical') {
        this.ctx.fillRect(px + 8, py + 3, 4, size - 6);
      } else {
        this.ctx.fillRect(px + 3, py + 8, size - 6, 4);
      }
    } else {
      this.ctx.fillStyle = 'rgba(30, 42, 58, 0.85)';
      if (axis === 'vertical') {
        this.ctx.fillRect(px + 7, py + 2, 6, size - 4);
      } else {
        this.ctx.fillRect(px + 2, py + 7, size - 4, 6);
      }
    }

    this.ctx.strokeStyle = 'rgba(180, 210, 235, 0.72)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(px + 3.5, py + 3.5, size - 7, size - 7);
  }

  /**
   * Этап 4: техзона между коридорами (визуальный фон).
   */
  renderCentralTechZonePhase4() {
    if (!this.ctx) return;
    const pf = window.pathfindingSystem;
    const ship = pf?._shipCfg;
    if (!pf || !ship) return;

    const CELL = 20;
    const { x0, y0, x1, y1 } = this._visibleCellRange();
    const hullLeft = ship.hullLeft;
    const hullRight = ship.hullRight;
    const hullBottom = ship.hullBottom;

    const corridorBottom = hullBottom - 20;
    const corridorTop = corridorBottom - 50 + 1;

    const leftCorrX0 = hullLeft + 12;
    const leftCorrX1 = leftCorrX0 + 10 - 1;
    const rightCorrX1 = hullRight - 15;
    const rightCorrX0 = rightCorrX1 - 10 + 1;

    const techX0 = leftCorrX1 + 1;
    const techX1 = rightCorrX0 - 1;
    const techY0 = corridorTop;
    const techY1 = corridorBottom;

    // Фоновая заливка техзоны
    for (let cy = Math.max(techY0, y0); cy <= Math.min(techY1, y1); cy++) {
      for (let cx = Math.max(techX0, x0); cx <= Math.min(techX1, x1); cx++) {
        if (pf._classifyHullCell(cx, cy) !== 'floor') continue;
        const px = cx * CELL;
        const py = cy * CELL;
        this.ctx.fillStyle = 'rgba(132, 146, 160, 0.13)';
        this.ctx.fillRect(px, py, CELL, CELL);
      }
    }

    // Несколько мелких технических блоков
    const blocks = [
      { x0: techX0 + 2, x1: techX0 + 8, y0: techY0 + 2, y1: techY0 + 10 },
      { x0: techX0 + 11, x1: techX0 + 18, y0: techY0 + 6, y1: techY0 + 16 },
      { x0: techX1 - 9, x1: techX1 - 3, y0: techY0 + 20, y1: techY0 + 30 },
      { x0: techX0 + 5, x1: techX0 + 13, y0: techY1 - 13, y1: techY1 - 4 },
    ];

    for (const b of blocks) {
      for (let cx = b.x0; cx <= b.x1; cx++) {
        for (const cy of [b.y0, b.y1]) {
          if (cx < x0 || cx > x1 || cy < y0 || cy > y1) continue;
          if (pf._classifyHullCell(cx, cy) !== 'floor') continue;
          this._drawInnerBulkheadCell(cx * CELL, cy * CELL, CELL);
        }
      }
      for (let cy = b.y0; cy <= b.y1; cy++) {
        for (const cx of [b.x0, b.x1]) {
          if (cx < x0 || cx > x1 || cy < y0 || cy > y1) continue;
          if (pf._classifyHullCell(cx, cy) !== 'floor') continue;
          this._drawInnerBulkheadCell(cx * CELL, cy * CELL, CELL);
        }
      }

      // Внутренний агрегат и трубопровод
      const ix0 = b.x0 + 1;
      const ix1 = b.x1 - 1;
      const iy0 = b.y0 + 1;
      const iy1 = b.y1 - 1;
      for (let cy = Math.max(iy0, y0); cy <= Math.min(iy1, y1); cy++) {
        for (let cx = Math.max(ix0, x0); cx <= Math.min(ix1, x1); cx++) {
          if (pf._classifyHullCell(cx, cy) !== 'floor') continue;
          const px = cx * CELL;
          const py = cy * CELL;
          this.ctx.fillStyle = 'rgba(88, 108, 126, 0.38)';
          this.ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
        }
      }
    }
  }

  /**
   * Этап 4: верхний мостик и нижний грузовой отсек (визуально).
   */
  renderBridgeAndCargoPhase4() {
    if (!this.ctx) return;
    const pf = window.pathfindingSystem;
    const ship = pf?._shipCfg;
    if (!pf || !ship) return;

    const CELL = 20;
    const { x0, y0, x1, y1 } = this._visibleCellRange();
    const hullLeft = ship.hullLeft;
    const hullRight = ship.hullRight;
    const hullBottom = ship.hullBottom;
    const noseBaseRow = ship.noseBaseRow;

    // Мостик (верх)
    const bridge = {
      x0: hullLeft + 6,
      x1: hullRight - 6,
      y0: noseBaseRow + 4,
      y1: noseBaseRow + 14,
      doorX: Math.round((hullLeft + hullRight) / 2),
      doorY: noseBaseRow + 14,
    };

    // Грузовой отсек (низ)
    const cargoTop = hullBottom - 18;
    const cargo = {
      x0: hullLeft + 4,
      x1: hullRight - 4,
      y0: cargoTop,
      y1: hullBottom - 2,
      doorX: Math.round((hullLeft + hullRight) / 2),
      doorY: cargoTop,
    };

    const drawRoom = (room, fillColor) => {
      for (let cy = Math.max(room.y0 + 1, y0); cy <= Math.min(room.y1 - 1, y1); cy++) {
        for (let cx = Math.max(room.x0 + 1, x0); cx <= Math.min(room.x1 - 1, x1); cx++) {
          if (pf._classifyHullCell(cx, cy) !== 'floor') continue;
          this.ctx.fillStyle = fillColor;
          this.ctx.fillRect(cx * CELL, cy * CELL, CELL, CELL);
        }
      }

      for (let cx = room.x0; cx <= room.x1; cx++) {
        for (const cy of [room.y0, room.y1]) {
          if (cx < x0 || cx > x1 || cy < y0 || cy > y1) continue;
          if (pf._classifyHullCell(cx, cy) !== 'floor') continue;
          this._drawInnerBulkheadCell(cx * CELL, cy * CELL, CELL);
        }
      }
      for (let cy = room.y0; cy <= room.y1; cy++) {
        for (const cx of [room.x0, room.x1]) {
          if (cx < x0 || cx > x1 || cy < y0 || cy > y1) continue;
          if (pf._classifyHullCell(cx, cy) !== 'floor') continue;
          this._drawInnerBulkheadCell(cx * CELL, cy * CELL, CELL);
        }
      }

      // Двери мостика/отсека рендерятся отдельными объектами карты.
    };

    drawRoom(bridge, 'rgba(152, 170, 188, 0.18)');
    drawRoom(cargo, 'rgba(124, 138, 152, 0.18)');
  }

  /**
   * Рисуем стены корпуса — металлические панели корабля.
   */
  renderShipWalls(gameState = null) {
    if (!this.ctx) return;
    const CELL = 20;
    const { x0, y0, x1, y1 } = this._visibleCellRange();
    const pf = window.pathfindingSystem;
    const removedWalls = new Set(gameState?.world?.flags?.creative_removed_walls || []);
    const windowCells = new Set();

    for (const obj of gameState?.world?.mapObjects || []) {
      const isWindow = obj.objectId === 'window' || obj.objectId === 'window_v_small' || obj.objectId === 'window_h_small' || obj.objectId === 'viewport_wide';
      if (!isWindow) continue;
      const w = Math.max(1, Math.round((obj.width || CELL) / CELL));
      const h = Math.max(1, Math.round((obj.height || CELL) / CELL));
      const cx = Math.floor((obj.x || 0) / CELL);
      const cy = Math.floor((obj.y || 0) / CELL);
      const minX = cx - Math.floor(w / 2);
      const minY = cy - Math.floor(h / 2);
      for (let gy = minY; gy < minY + h; gy++) {
        for (let gx = minX; gx < minX + w; gx++) {
          windowCells.add(`${gx},${gy}`);
        }
      }
    }

    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (pf?._classifyHullCell(cx, cy) !== 'wall') continue;
        if (removedWalls.has(`${cx},${cy}`)) continue;
        if (windowCells.has(`${cx},${cy}`)) continue;
        this._drawWallCell(cx * CELL, cy * CELL, CELL);
      }
    }
  }

  /** Рисуем одну клетку-стену корпуса (белая с серым, заклёпки) */
  _drawWallCell(px, py, size) {
    const ctx = this.ctx;
    // Основа панели — светло-голубоватый металл
    ctx.fillStyle = '#bec8d4';
    ctx.fillRect(px, py, size, size);
    // Внутренняя рамка
    ctx.strokeStyle = '#8fa0b0';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
    // Лёгкий блик сверху
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(px + 2, py + 2, size - 4, 4);
    // Заклёпки по углам
    ctx.fillStyle = '#7a8e9e';
    const rv = 1.2;
    const off = 3;
    [[off, off], [size - off, off], [off, size - off], [size - off, size - off]].forEach(([ox, oy]) => {
      ctx.beginPath();
      ctx.arc(px + ox, py + oy, rv, 0, Math.PI * 2);
      ctx.fill();
    });
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

      // ── ОКНО / ИЛЛЮМИНАТОР ────────────────────────────────────────
      if (obj.objectId === 'window') {
        const px = left + 0.5;
        const py = top + 0.5;
        const pw = w - 1;
        const ph = h - 1;
        // Полоса голубого стекла — ориентация зависит от пропорций
        let isHoriz = w >= h;
        this.ctx.fillStyle = 'rgba(90,200,255,0.30)';
        this.ctx.fillRect(px, py, pw, ph);
        this.ctx.strokeStyle = '#55ccff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(px, py, pw, ph);
        // Внутренний блик
        this.ctx.fillStyle = 'rgba(180,240,255,0.35)';
        if (isHoriz) {
          this.ctx.fillRect(px + 2, py + 2, pw - 4, Math.min(4, ph - 3));
        } else {
          this.ctx.fillRect(px + 2, py + 2, Math.min(4, pw - 3), ph - 4);
        }
        return;
      }

      // ── ВНУТРЕННЯЯ ДВЕРЬ ──────────────────────────────────────────
      if (obj.objectId === 'door_inner_v' || obj.objectId === 'door_inner_h') {
        const flagKey = `door_open_${obj.id}`;
        const isOpen = !!gameState?.world?.flags?.[flagKey];
        const axis = obj.objectId === 'door_inner_h' ? 'horizontal' : 'vertical';
        this._drawInnerDoorCell(left, top, CELL, axis, isOpen);
        return;
      }

      // ── ЗАПЕРТАЯ ДВЕРЬ ────────────────────────────────────────────
      if (obj.objectId === 'door_locked') {
        const lockedOpen = gameState?.world?.flags?.door_locked_open || false;
        if (lockedOpen) {
          this.drawPixelSprite('object_door_open', left, top, w, h);
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
          this.drawPixelSprite('object_door_open', left, top, w, h);
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
      const x = playerData.x ?? 100;
      const y = playerData.y ?? 100;

      // drawX/drawY — левый верхний угол спрайта 20×20.
      // x,y — центр персонажа (waypoints от gridToPos = col*20+10).
      // НЕ используем Math.round: он «притягивает» к клетке и создаёт скачки.
      const CELL = 20;
      const drawX = x - CELL / 2;
      const drawY = y - CELL / 2;

      // Мягкая тень под персонажем
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      this.ctx.beginPath();
      this.ctx.ellipse(drawX + CELL / 2, drawY + CELL - 1, CELL / 2.5, 2, 0, 0, Math.PI * 2);
      this.ctx.fill();

      this.drawPixelSprite('player_passenger', drawX, drawY, CELL, CELL);

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
   */
  renderDebugGrid(gameState) {
    if (!this.ctx) return;

    const CELL = 20;
    const { x0, y0, x1, y1 } = this._visibleCellRange();

    // Подсвечиваем заблокированные клетки
    if (gameState && window.pathfindingSystem) {
      const walkable = window.pathfindingSystem.buildWalkableGrid(gameState);
      const cols = window.pathfindingSystem.GRID_COLS;
      this.ctx.fillStyle = 'rgba(220, 50, 50, 0.22)';
      for (let gy = y0; gy <= y1; gy++) {
        for (let gx = x0; gx <= x1; gx++) {
          if (walkable[gy * cols + gx] === 0) {
            this.ctx.fillRect(gx * CELL, gy * CELL, CELL, CELL);
          }
        }
      }
    }

    // Рисуем линии сетки поверх
    this.ctx.strokeStyle = 'rgba(80, 160, 80, 0.18)';
    this.ctx.lineWidth = 0.5;
    for (let gx = x0; gx <= x1 + 1; gx++) {
      this.ctx.beginPath();
      this.ctx.moveTo(gx * CELL, y0 * CELL);
      this.ctx.lineTo(gx * CELL, (y1 + 1) * CELL);
      this.ctx.stroke();
    }
    for (let gy = y0; gy <= y1 + 1; gy++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x0 * CELL, gy * CELL);
      this.ctx.lineTo((x1 + 1) * CELL, gy * CELL);
      this.ctx.stroke();
    }
  }

  renderUI() {
    if (!this.ctx) return;
    
    try {
      const gameState = window.getGameState?.();
      if (!gameState) return;

      this.refreshInventoryPanel();

      // Заголовок и позиция игрока (экранные координаты, поверх мира)
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '14px Arial';
      this.ctx.fillText(this._t('ui.game_title'), 80, 25);
      this.ctx.fillStyle = '#4ade80';
      this.ctx.font = '12px Arial';
      this.ctx.fillText(`${this._t('ui.language_label')}: ${gameState.ui.language}`, 80, 44);

      // Обновляем историю голосовых сообщений (до 100 строк)
      if (gameState.voice?.lastCommand && gameState.voice?.lastCommandTime && gameState.voice.lastCommandTime > this.lastVoiceCommandTime) {
        this.lastVoiceCommandTime = gameState.voice.lastCommandTime;
        this.currentVoiceLine = gameState.voice.lastCommand;
        this.appendHistory(this.voiceHistory, gameState.voice.lastCommand, this.voiceHistoryLimit);
        // Применяем bad-токен, если он был установлен лисёнком до этого фрейма
        if (this._pendingBadToken && this.voiceHistory.length > 0) {
          const last = this.voiceHistory[this.voiceHistory.length - 1];
          this.voiceHistory[this.voiceHistory.length - 1] = {
            ...last, badToken: this._pendingBadToken, status: 'error',
          };
          this._pendingBadToken = null;
        }
        if (this.lastExecutedVoiceLine && this.lastExecutedVoiceLine === gameState.voice.lastCommand) {
          this.markVoiceCommandExecuted(this.lastExecutedVoiceLine);
        }
        this.refreshHistoryPanels();
      }
      
      // Рисуем кнопку микрофона
      this.renderMicrophoneButton(window.voiceSystem?.isListening || false);
      this.renderDevModeButton();
      
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
    this.refreshInventoryPanel();
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

  renderDevModeButton() {
    if (!this.ctx) return;

    const btnWidth = 60;
    const btnHeight = 28;
    const btnX = this._logW - btnWidth - 10;
    const btnY = 10;

    this.ctx.fillStyle = this.devMode ? '#ff8c42' : '#4b5563';
    this.ctx.fillRect(btnX, btnY, btnWidth, btnHeight);

    this.ctx.strokeStyle = this.devMode ? '#ffe7c7' : '#cfd8e3';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('DEV', btnX + btnWidth / 2, btnY + 18);
    this.ctx.textAlign = 'left';

    this.devButtonRect = { x: btnX, y: btnY, width: btnWidth, height: btnHeight };
  }

  _tryDevStep(direction) {
    const gs = window.getGameState?.();
    const pf = window.pathfindingSystem;
    if (!gs || !pf) return;
    if (gs.player?.isMoving) return;

    const start = pf.posToGrid(gs.player.x, gs.player.y);
    let dx = 0;
    let dy = 0;
    let faceDir = gs.player.direction || 'right';
    if (direction === 'left') { dx = -1; faceDir = 'left'; }
    if (direction === 'right') { dx = 1; faceDir = 'right'; }
    if (direction === 'up') dy = -1;
    if (direction === 'down') dy = 1;

    const nx = start.x + dx;
    const ny = start.y + dy;
    const walkable = pf.buildWalkableGrid(gs);
    if (nx < 0 || nx >= pf.GRID_COLS || ny < 0 || ny >= pf.GRID_ROWS) return;
    if (walkable[ny * pf.GRID_COLS + nx] !== 1) return;

    const target = pf.gridToPos(nx, ny);
    window.updateGameState?.({
      player: {
        targetX: target.x,
        targetY: target.y,
        isMoving: true,
        direction: faceDir,
        pathWaypoints: null,
        currentWaypoint: 0,
      }
    });
  }

  /**
   * Рендерим строку с последней распознанной речью
   */
  renderVoiceTranscript(transcript) {
    if (!this.ctx) return;
    
    try {
      const padding = 10;
      const panelY = this._logH - 100; // дополнительная панель над инвентарем
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
      this.ctx.fillRect(0, panelY, this._logW, panelHeight);
      
      // Граница
      this.ctx.strokeStyle = '#2196F3';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(0, panelY, this._logW, panelHeight);
      
      // Текст
      this.ctx.fillStyle = '#2196F3';
      this.ctx.font = '12px Arial, sans-serif';
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
      this.ctx.fillRect(this._logW - 180, 10, 170, 40);
      
      // Граница
      this.ctx.strokeStyle = '#ff9800';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(this._logW - 180, 10, 170, 40);
      
      // Текст
      this.ctx.fillStyle = '#ffff00';
      this.ctx.font = 'bold 14px Arial';
      this.ctx.fillText(statusText, this._logW - 170, 35);
      
      // Пульсирующие точки
      this.ctx.fillStyle = '#ff5722';
      this.ctx.beginPath();
      this.ctx.arc(this._logW - 15, 30, 3 + (pulse / 20), 0, Math.PI * 2);
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
    const boxX = Math.min(this._logW - boxWidth - 8, this.hoveredItem.x + 12);
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
      const by = this._logH - 100 - bubbleH - 8;

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

    window.eventSystem.on('fox:say', ({ text, badToken }) => {
      this.appendHistory(this.foxHistory, text, this.foxHistoryLimit);
      // Запоминаем bad-токен: будет применён к текущей записи голосовой истории при следующем рендере.
      if (badToken) this._pendingBadToken = badToken;
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
        const screenX = (e.clientX - rect.left) * (this._logW / rect.width);
        const screenY = (e.clientY - rect.top) * (this._logH / rect.height);
        // Конвертируем в мировые координаты для worldItemHoverRects
        const zoom = this._zoom || 1;
        const worldX = (screenX - (this._camOffX || 0)) / zoom;
        const worldY = (screenY - (this._camOffY || 0)) / zoom;
        const hoveredInv = this.inventoryHoverRects.find(r =>
          screenX >= r.x && screenX <= r.x + r.width && screenY >= r.y && screenY <= r.y + r.height
        );
        const hoveredWorld = this.worldItemHoverRects.find(r =>
          worldX >= r.x && worldX <= r.x + r.width && worldY >= r.y && worldY <= r.y + r.height
        );
        const hovered = hoveredInv || hoveredWorld;
        this.hoveredItem = hovered ? { itemId: hovered.itemId, x: screenX, y: screenY } : null;
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
          return;
        }

        if (this.devButtonRect &&
            x > this.devButtonRect.x &&
            x < this.devButtonRect.x + this.devButtonRect.width &&
            y > this.devButtonRect.y &&
            y < this.devButtonRect.y + this.devButtonRect.height) {
          this.devMode = !this.devMode;
        }
      });
    }

    window.addEventListener('keydown', (e) => {
      if (!this.devMode) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); this._tryDevStep('left'); }
      if (e.key === 'ArrowRight') { e.preventDefault(); this._tryDevStep('right'); }
      if (e.key === 'ArrowUp') { e.preventDefault(); this._tryDevStep('up'); }
      if (e.key === 'ArrowDown') { e.preventDefault(); this._tryDevStep('down'); }
    });
  }
}

// Создаём и прикрепляем к window
const gameRenderer = new GameRenderer('game-canvas');
window.gameRenderer = gameRenderer;

// Для модульной системы
if (typeof module !== 'undefined' && module.exports) {
  module.exports = gameRenderer;
}
