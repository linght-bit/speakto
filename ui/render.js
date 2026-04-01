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
    this.questTaskPanelEls = null;
    this.questTaskPanelCollapsed = false;
    this._questTaskPanelSignature = '';
    this.questDialogEls = null;
    this.questDialogState = null;
    this.actBannerState = null;
    this.micQuestHighlight = false;
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
    this.setupQuestTaskPanel();
    this.setupQuestDialogPanel();
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

  _formatUiText(key, params = {}) {
    let text = this._t(key) || '';
    for (const [paramKey, paramValue] of Object.entries(params || {})) {
      text = text.replaceAll(`{${paramKey}}`, String(paramValue ?? ''));
    }
    return text;
  }

  setupQuestTaskPanel() {
    const root = document.body;
    if (!root || this.questTaskPanelEls) return;

    const panel = document.createElement('div');
    panel.style.position = 'fixed';
    panel.style.top = '118px';
    panel.style.left = '10px';
    panel.style.transform = 'none';
    panel.style.width = '340px';
    panel.style.maxWidth = 'calc(100vw - 20px)';
    panel.style.background = 'rgba(9, 14, 20, 0.94)';
    panel.style.border = '1px solid rgba(110, 218, 255, 0.35)';
    panel.style.borderRadius = '8px';
    panel.style.zIndex = '1280';
    panel.style.color = '#d7ebff';
    panel.style.font = '12px Arial, sans-serif';
    panel.style.display = 'none';
    panel.style.pointerEvents = 'auto';
    panel.style.resize = 'both';
    panel.style.overflow = 'auto';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.padding = '6px 8px';
    header.style.borderBottom = '1px solid rgba(110, 218, 255, 0.20)';
    header.style.background = 'rgba(17, 28, 40, 0.90)';
    header.style.cursor = 'grab';
    header.style.userSelect = 'none';

    const title = document.createElement('strong');
    title.style.fontSize = '12px';
    title.style.fontWeight = '700';

    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.style.background = '#20384e';
    collapseBtn.style.border = '1px solid #4c83a7';
    collapseBtn.style.color = '#d7ebff';
    collapseBtn.style.borderRadius = '4px';
    collapseBtn.style.padding = '1px 6px';
    collapseBtn.style.cursor = 'pointer';
    collapseBtn.style.fontSize = '10px';
    collapseBtn.addEventListener('click', () => {
      this.questTaskPanelCollapsed = !this.questTaskPanelCollapsed;
      this._questTaskPanelSignature = '';
      this.refreshQuestTaskPanel();
    });

    const body = document.createElement('div');
    body.style.padding = '6px 8px';

    const compact = document.createElement('div');
    compact.style.display = 'none';
    compact.style.padding = '6px 8px';
    compact.style.whiteSpace = 'nowrap';
    compact.style.overflow = 'hidden';
    compact.style.textOverflow = 'ellipsis';

    header.appendChild(title);
    header.appendChild(collapseBtn);
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

    this.questTaskPanelEls = { panel, header, title, body, compact, collapseBtn };
    this.refreshQuestTaskPanel();
  }

  refreshQuestTaskPanel() {
    if (!this.questTaskPanelEls) return;
    const tasks = window.questSystem?.getTrackedTasks?.() || [];
    const gameState = window.getGameState?.();
    const els = this.questTaskPanelEls;
    const signature = JSON.stringify({
      collapsed: this.questTaskPanelCollapsed,
      lang: gameState?.ui?.language || '',
      tasks,
    });
    if (signature === this._questTaskPanelSignature) return;
    this._questTaskPanelSignature = signature;

    els.title.textContent = this._t('ui.current_tasks_title');
    els.collapseBtn.textContent = this.questTaskPanelCollapsed ? '▸' : '▾';
    els.panel.style.display = tasks.length ? 'block' : 'none';
    els.body.style.display = this.questTaskPanelCollapsed ? 'none' : 'block';
    els.compact.style.display = this.questTaskPanelCollapsed ? 'block' : 'none';
    els.body.innerHTML = '';
    els.compact.innerHTML = '';

    if (!tasks.length) {
      const empty = document.createElement('div');
      empty.textContent = this._t('ui.tasks_empty');
      empty.style.color = '#a8b6c6';
      els.body.appendChild(empty);
      return;
    }

    const currentTask = tasks.find(task => !task.completed) || tasks[tasks.length - 1];
    const compactRow = document.createElement('div');
    compactRow.style.display = 'flex';
    compactRow.style.alignItems = 'center';
    compactRow.style.gap = '8px';

    const compactBox = document.createElement('div');
    compactBox.style.width = '14px';
    compactBox.style.height = '14px';
    compactBox.style.borderRadius = '3px';
    compactBox.style.border = '1px solid rgba(188, 220, 240, 0.75)';
    compactBox.style.display = 'inline-flex';
    compactBox.style.alignItems = 'center';
    compactBox.style.justifyContent = 'center';
    compactBox.style.fontSize = '11px';
    if (currentTask.completed) {
      compactBox.textContent = '✓';
      compactBox.style.background = '#2d9f5b';
      compactBox.style.color = '#fff';
      compactBox.style.borderColor = '#7cf0a3';
    }

    const compactText = document.createElement('div');
    compactText.textContent = this._formatUiText(currentTask.textKey);
    compactText.style.whiteSpace = 'nowrap';
    compactText.style.overflow = 'hidden';
    compactText.style.textOverflow = 'ellipsis';
    if (currentTask.completed) {
      compactText.style.textDecoration = 'line-through';
      compactText.style.color = '#9ce6af';
    }

    compactRow.appendChild(compactBox);
    compactRow.appendChild(compactText);
    els.compact.appendChild(compactRow);

    tasks.forEach((task) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '8px';
      row.style.padding = '4px 0';

      const box = document.createElement('div');
      box.style.width = '16px';
      box.style.height = '16px';
      box.style.borderRadius = '3px';
      box.style.border = '1px solid rgba(188, 220, 240, 0.75)';
      box.style.display = 'inline-flex';
      box.style.alignItems = 'center';
      box.style.justifyContent = 'center';
      box.style.fontSize = '12px';
      box.style.flex = '0 0 auto';
      if (task.completed) {
        box.textContent = '✓';
        box.style.background = '#2d9f5b';
        box.style.color = '#fff';
        box.style.borderColor = '#7cf0a3';
      }

      const text = document.createElement('div');
      text.textContent = this._formatUiText(task.textKey);
      text.style.flex = '1';
      text.style.color = task.completed ? '#9ce6af' : '#d7ebff';
      if (task.completed) {
        text.style.textDecoration = 'line-through';
      }

      row.appendChild(box);
      row.appendChild(text);
      els.body.appendChild(row);
    });
  }

  setupQuestDialogPanel() {
    const root = document.body;
    if (!root || this.questDialogEls) return;

    const panel = document.createElement('div');
    panel.style.position = 'fixed';
    panel.style.left = '50%';
    panel.style.top = '50%';
    panel.style.transform = 'translate(-50%, -50%)';
    panel.style.width = '560px';
    panel.style.maxWidth = 'calc(100vw - 30px)';
    panel.style.maxHeight = 'calc(100vh - 40px)';
    panel.style.background = 'rgba(9, 14, 20, 0.96)';
    panel.style.border = '1px solid rgba(112, 214, 255, 0.40)';
    panel.style.borderRadius = '10px';
    panel.style.boxShadow = '0 14px 40px rgba(0, 0, 0, 0.42)';
    panel.style.zIndex = '1500';
    panel.style.color = '#d7ebff';
    panel.style.font = '13px Arial, sans-serif';
    panel.style.display = 'none';
    panel.style.pointerEvents = 'auto';

    const header = document.createElement('div');
    header.style.padding = '10px 12px';
    header.style.borderBottom = '1px solid rgba(112, 214, 255, 0.22)';
    header.style.background = 'rgba(17, 28, 40, 0.92)';

    const title = document.createElement('div');
    title.style.fontSize = '15px';
    title.style.fontWeight = '700';
    title.style.color = '#eef7ff';

    const speaker = document.createElement('div');
    speaker.style.marginTop = '8px';
    speaker.style.fontSize = '12px';
    speaker.style.fontWeight = '700';
    speaker.style.color = '#8fe9ff';

    const body = document.createElement('div');
    body.style.padding = '12px';
    body.style.maxHeight = '360px';
    body.style.overflowY = 'auto';
    body.style.whiteSpace = 'pre-wrap';
    body.style.lineHeight = '1.45';

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.padding = '0 12px 12px';

    const continueBtn = document.createElement('button');
    continueBtn.type = 'button';
    continueBtn.style.background = '#24527a';
    continueBtn.style.border = '1px solid #76cfff';
    continueBtn.style.color = '#ffffff';
    continueBtn.style.borderRadius = '6px';
    continueBtn.style.padding = '8px 12px';
    continueBtn.style.cursor = 'pointer';
    continueBtn.style.fontSize = '12px';
    continueBtn.addEventListener('click', () => {
      const dialogId = this.questDialogState?.dialogId;
      this._hideQuestDialog();
      if (dialogId) {
        window.eventSystem?.emit('quest:dialogContinue', { dialogId });
      }
    });

    header.appendChild(title);
    header.appendChild(speaker);
    footer.appendChild(continueBtn);
    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(footer);
    root.appendChild(panel);

    this.questDialogEls = { panel, title, speaker, body, continueBtn };
  }

  _showQuestDialog({ dialogId, titleKey, bodyKeys = [], params = {} } = {}) {
    if (!this.questDialogEls) return;
    this.questDialogState = { dialogId, titleKey, bodyKeys, params };

    const els = this.questDialogEls;
    els.title.textContent = this._formatUiText(titleKey, params);
    els.speaker.textContent = this._t('ui.fox_history_title');
    els.continueBtn.textContent = this._t('ui.resume');
    els.body.innerHTML = '';

    (bodyKeys || []).forEach((key) => {
      const block = document.createElement('div');
      block.textContent = this._formatUiText(key, params);
      block.style.marginBottom = '12px';
      block.style.padding = '8px 10px';
      block.style.border = '1px solid rgba(112, 214, 255, 0.16)';
      block.style.borderRadius = '8px';
      block.style.background = 'rgba(112, 214, 255, 0.05)';
      block.style.whiteSpace = 'pre-wrap';
      els.body.appendChild(block);
    });

    els.panel.style.display = 'block';
  }

  _hideQuestDialog() {
    if (this.questDialogEls) {
      this.questDialogEls.panel.style.display = 'none';
    }
    this.questDialogState = null;
  }

  renderActBanner() {
    if (!this.ctx || !this.actBannerState?.text) return;
    const now = Date.now();
    const { startedAt = now, visibleUntil = now, text = '' } = this.actBannerState;
    if (now >= visibleUntil) {
      this.actBannerState = null;
      return;
    }

    const duration = Math.max(1, visibleUntil - startedAt);
    const progress = (now - startedAt) / duration;
    const alpha = progress < 0.18
      ? progress / 0.18
      : progress > 0.82
        ? (1 - progress) / 0.18
        : 1;
    const scale = 0.94 + alpha * 0.06;

    this.ctx.save();
    this.ctx.translate(this._logW / 2, this._logH / 2 - 80);
    this.ctx.scale(scale, scale);
    this.ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    const w = 220;
    const h = 56;
    this.ctx.fillStyle = 'rgba(10, 18, 28, 0.86)';
    this.ctx.fillRect(-w / 2, -h / 2, w, h);
    this.ctx.strokeStyle = 'rgba(112, 214, 255, 0.72)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1);
    this.ctx.fillStyle = 'rgba(124, 241, 255, 0.22)';
    this.ctx.fillRect(-w / 2 + 8, -h / 2 + 8, w - 16, 4);
    this.ctx.fillStyle = '#eef7ff';
    this.ctx.font = 'bold 24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(text, 0, 8);
    this.ctx.textAlign = 'left';
    this.ctx.restore();
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

  _escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  _appendDecoratedEntryText(container, text, { badToken = '', highlightPortuguese = false } = {}) {
    const source = String(text ?? '');
    const patterns = [];

    if (badToken) {
      patterns.push(this._escapeRegExp(badToken));
    }
    if (highlightPortuguese) {
      patterns.push('[“"\'`][^“”"\'`\\n]{1,48}[”"\'`]|[A-Za-zÀ-ÿ]{2,}(?:\\s+[A-Za-zÀ-ÿ]{1,}){0,4}');
    }

    if (!patterns.length) {
      container.textContent = source;
      return;
    }

    const matcher = new RegExp(patterns.join('|'), 'gi');
    let lastIndex = 0;
    let match;

    while ((match = matcher.exec(source))) {
      const value = match[0];
      if (match.index > lastIndex) {
        container.appendChild(document.createTextNode(source.slice(lastIndex, match.index)));
      }

      const span = document.createElement('span');
      span.textContent = value;

      const isBadToken = badToken && value.toLowerCase().includes(String(badToken).toLowerCase());
      if (isBadToken) {
        span.style.color = '#ff8c8c';
        span.style.fontWeight = '700';
      } else {
        span.style.color = '#7cf0a3';
        span.style.fontWeight = '700';
        span.style.background = 'rgba(56, 161, 105, 0.18)';
        span.style.borderRadius = '4px';
        span.style.padding = '0 3px';
      }

      container.appendChild(span);
      lastIndex = match.index + value.length;
    }

    if (lastIndex < source.length) {
      container.appendChild(document.createTextNode(source.slice(lastIndex)));
    }
  }

  renderPanelEntries(body, entries, collapsed, currentLine = '', panelKind = 'voice') {
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

    const isFoxPanel = panelKind === 'fox';

    visibleEntries.forEach((entry) => {
      const row = document.createElement('div');
      row.style.padding = isFoxPanel ? '6px 8px' : '2px 0';
      row.style.margin = isFoxPanel ? '0 0 6px 0' : '0';
      row.style.whiteSpace = collapsed ? 'nowrap' : 'pre-wrap';
      row.style.overflow = 'hidden';
      row.style.textOverflow = 'ellipsis';
      row.style.borderRadius = isFoxPanel ? '6px' : '0';

      const baseColor = entry.status === 'executed' ? '#8ff7a7'
        : entry.status === 'error' ? '#ffccaa'
        : '#d7ebff';
      row.style.color = baseColor;

      if (isFoxPanel) {
        const borderColor = entry.status === 'error' ? 'rgba(255, 140, 110, 0.55)' : 'rgba(110, 218, 255, 0.40)';
        const fillColor = entry.status === 'error' ? 'rgba(76, 24, 18, 0.48)' : 'rgba(16, 32, 44, 0.56)';
        row.style.background = fillColor;
        row.style.border = `1px solid ${borderColor}`;
        row.style.borderLeft = `3px solid ${entry.status === 'error' ? '#ff8c6f' : '#6edaff'}`;
        row.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.03)';
      }

      this._appendDecoratedEntryText(row, entry.text, {
        badToken: entry.badToken,
        highlightPortuguese: isFoxPanel,
      });

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
    this.renderPanelEntries(voice.body, this.voiceHistory, !this.voicePanelExpanded, this.currentVoiceLine, 'voice');
    if (this.voicePanelExpanded) {
      voice.body.scrollTop = voice.body.scrollHeight;
    }

    // Fox panel
    const fox = this.foxPanelEls;
    fox.title.textContent = t('ui.fox_history_title');
    fox.toggleBtn.textContent = this.foxPanelExpanded ? '▼' : '▲';
    fox.body.style.display = 'block';
    fox.body.style.maxHeight = this.foxPanelExpanded ? '260px' : '32px';
    this.renderPanelEntries(fox.body, this.foxHistory, !this.foxPanelExpanded, this.foxHistory[this.foxHistory.length - 1]?.text || '', 'fox');
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

    const relTop = Math.max(0, camY) / worldH;
    const relBot = Math.min(1, (camY + visH) / worldH);

    const grad = this.ctx.createLinearGradient(camX, camY, camX, camY + visH);
    grad.addColorStop(0, this._spaceGradColor(relTop, 0));
    grad.addColorStop(0.55, this._spaceGradColor((relTop + relBot) / 2, 1));
    grad.addColorStop(1, this._spaceGradColor(relBot, 2));
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(camX, camY, visW, visH);

    const nebulaA = this.ctx.createRadialGradient(camX + visW * 0.18, camY + visH * 0.22, 8, camX + visW * 0.18, camY + visH * 0.22, visW * 0.45);
    nebulaA.addColorStop(0, 'rgba(78, 58, 142, 0.24)');
    nebulaA.addColorStop(1, 'rgba(78, 58, 142, 0)');
    this.ctx.fillStyle = nebulaA;
    this.ctx.fillRect(camX, camY, visW, visH);

    const nebulaB = this.ctx.createRadialGradient(camX + visW * 0.82, camY + visH * 0.68, 10, camX + visW * 0.82, camY + visH * 0.68, visW * 0.38);
    nebulaB.addColorStop(0, 'rgba(56, 132, 154, 0.16)');
    nebulaB.addColorStop(1, 'rgba(56, 132, 154, 0)');
    this.ctx.fillStyle = nebulaB;
    this.ctx.fillRect(camX, camY, visW, visH);

    if (!this._stars) {
      const worldW = (window.pathfindingSystem?.GRID_COLS || 80) * CELL;
      this._stars = this._generateStars(520, worldW, worldH);
    }

    for (const s of this._stars) {
      if (s.x < camX - s.r * 6 || s.x > camX + visW + s.r * 6) continue;
      if (s.y < camY - s.r * 6 || s.y > camY + visH + s.r * 6) continue;

      this.ctx.save();
      this.ctx.globalAlpha = s.alpha;
      if (s.r > 1.15) {
        this.ctx.fillStyle = s.glow;
        this.ctx.beginPath();
        this.ctx.arc(s.x, s.y, s.r * 3.2, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.fillStyle = s.color;
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
    this.ctx.globalAlpha = 1;
  }

  _spaceGradColor(rel, band = 0) {
    const r = Math.round(7 + band * 3 + rel * 5);
    const g = Math.round(10 + band * 4 + rel * 8);
    const b = Math.round(24 + (1 - rel) * 30 - band * 2);
    return `rgb(${r}, ${g}, ${b})`;
  }

  /** Генерируем список звёзд с фиксированным seed — одинаковые каждый запуск */
  _generateStars(count, worldW, worldH) {
    const stars = [];
    let s = 0x9e3779b9;
    const rand = () => {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      return ((s >>> 0) / 0xffffffff);
    };
    const colors = ['#eef7ff', '#c8f6ff', '#ffd98b', '#d9d5ff', '#ffffff'];
    const glows = ['rgba(128, 236, 255, 0.18)', 'rgba(170, 160, 255, 0.18)', 'rgba(255, 214, 120, 0.14)'];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: rand() * worldW,
        y: rand() * worldH,
        r: rand() * 1.6 + 0.35,
        color: colors[Math.floor(rand() * colors.length)],
        glow: glows[Math.floor(rand() * glows.length)],
        alpha: rand() * 0.55 + 0.35,
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

        // Локальный световой акцент по типу помещения
        if (palette.accent) {
          this.ctx.save();
          this.ctx.fillStyle = palette.accent;
          this.ctx.shadowColor = palette.glow || palette.accent;
          this.ctx.shadowBlur = zone === 'reactor' ? 10 : 6;
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
          this.ctx.restore();
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
        return { a: '#556579', b: '#617287', grid: 'rgba(188,212,230,0.24)', accent: 'rgba(92, 239, 255, 0.10)', glow: 'rgba(92, 239, 255, 0.16)' };
      case 'cabin':
        return { a: '#676376', b: '#726d80', grid: 'rgba(198,192,218,0.18)', accent: 'rgba(160, 202, 255, 0.05)', glow: 'rgba(160, 202, 255, 0.08)' };
      case 'technical':
        return { a: '#53697a', b: '#607788', grid: 'rgba(182,210,230,0.22)', accent: 'rgba(99, 228, 255, 0.12)', glow: 'rgba(99, 228, 255, 0.16)' };
      case 'reactor':
        return { a: '#5b5876', b: '#686381', grid: 'rgba(188,192,235,0.24)', accent: 'rgba(135, 247, 255, 0.18)', glow: 'rgba(135, 247, 255, 0.22)' };
      case 'bridge':
        return { a: '#5a6878', b: '#667587', grid: 'rgba(194,214,232,0.22)', accent: 'rgba(255, 214, 110, 0.10)', glow: 'rgba(255, 214, 110, 0.14)' };
      case 'hall':
        return { a: '#616b7c', b: '#6d7788', grid: 'rgba(192,202,218,0.18)', accent: 'rgba(255, 214, 110, 0.06)', glow: 'rgba(255, 214, 110, 0.10)' };
      default:
        return { a: '#596677', b: '#657283', grid: 'rgba(182,198,216,0.18)', accent: null, glow: null };
    }
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
    const plate = ctx.createLinearGradient(px, py, px + size, py + size);
    plate.addColorStop(0, '#8e9caf');
    plate.addColorStop(0.5, '#738298');
    plate.addColorStop(1, '#5c697c');
    ctx.fillStyle = plate;
    ctx.fillRect(px, py, size, size);

    ctx.strokeStyle = 'rgba(225, 238, 248, 0.62)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fillRect(px + 2, py + 2, size - 4, 3);
    ctx.fillStyle = 'rgba(18, 24, 34, 0.10)';
    ctx.fillRect(px + 2, py + size - 5, size - 4, 3);

    ctx.fillStyle = 'rgba(114, 129, 150, 0.88)';
    const rv = 1.1;
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
        const isHoriz = w >= h;

        this.ctx.save();
        this.ctx.fillStyle = 'rgba(34, 55, 74, 0.78)';
        this.ctx.fillRect(px, py, pw, ph);
        this.ctx.shadowColor = 'rgba(90, 232, 255, 0.35)';
        this.ctx.shadowBlur = 10;
        this.ctx.fillStyle = 'rgba(92, 220, 255, 0.24)';
        this.ctx.fillRect(px + 1.5, py + 1.5, pw - 3, ph - 3);
        this.ctx.restore();

        this.ctx.strokeStyle = '#7de7ff';
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeRect(px, py, pw, ph);

        this.ctx.fillStyle = 'rgba(210, 248, 255, 0.26)';
        if (isHoriz) {
          this.ctx.fillRect(px + 2, py + 2, pw - 4, Math.min(3, ph - 3));
        } else {
          this.ctx.fillRect(px + 2, py + 2, Math.min(3, pw - 3), ph - 4);
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
      this.refreshQuestTaskPanel();

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
      
      // Правый HUD: DEV сверху, микрофон со статусом ниже
      this.renderDevModeButton();
      this.renderMicrophoneButton(window.voiceSystem?.isListening || false);

      this.renderHoveredItemTooltip();
      this.renderActBanner();

      // Короткий пузырь лисёнка оставляем выключенным: постоянная история в отдельном окне
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
      const btnWidth = 156;
      const btnHeight = 40;
      const btnX = this._logW - btnWidth - 10;
      const btnY = 46;
      const label = isListening ? this._t('voice.listening') : this._t('ui.mic_button_idle');
      
      // Проверяем если кнопка только что нажата (визуальный отклик)
      const isPressed = this.micButtonPressed && (Date.now() - this.micButtonPressedTime < 100);
      const offset = isPressed ? 3 : 0;
      
      // Фон кнопки (цвет зависит от состояния)
      const bgColor = isListening ? '#c94a1d' : '#1b6f52';
      this.ctx.fillStyle = bgColor;
      this.ctx.fillRect(btnX + offset, btnY + offset, btnWidth, btnHeight);
      
      const questHighlight = this.micQuestHighlight || window.questSystem?.isMicHintActive?.();
      if (questHighlight) {
        this.ctx.save();
        this.ctx.shadowColor = 'rgba(255, 230, 120, 0.65)';
        this.ctx.shadowBlur = 14 + Math.sin(Date.now() / 180) * 4;
        this.ctx.strokeStyle = '#ffe66f';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(btnX - 2 + offset, btnY - 2 + offset, btnWidth + 4, btnHeight + 4);
        this.ctx.restore();
      }

      // Граница
      this.ctx.strokeStyle = questHighlight ? '#ffe66f' : (isListening ? '#ffcc00' : '#d7ebff');
      this.ctx.lineWidth = isPressed ? 3 : (questHighlight ? 3 : 2);
      this.ctx.strokeRect(btnX + offset, btnY + offset, btnWidth, btnHeight);

      this.drawPixelSprite(isListening ? 'ui_mic_on' : 'ui_mic_off', btnX + offset + 8, btnY + offset + 8, 24, 24);

      this.ctx.fillStyle = 'rgba(255,255,255,0.18)';
      this.ctx.fillRect(btnX + offset + 40, btnY + offset + 6, 1, btnHeight - 12);

      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 13px Arial';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(label, btnX + offset + 50, btnY + offset + 25);

      if (isListening) {
        const pulse = 3 + (Math.sin(Date.now() / 300) + 1) * 1.5;
        this.ctx.fillStyle = '#ffef6b';
        this.ctx.beginPath();
        this.ctx.arc(btnX + offset + btnWidth - 14, btnY + offset + btnHeight / 2, pulse, 0, Math.PI * 2);
        this.ctx.fill();
      }
      
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

    window.eventSystem.on('quest:tasksChanged', () => {
      this._questTaskPanelSignature = '';
      this.refreshQuestTaskPanel();
    });

    window.eventSystem.on('quest:micHighlight', ({ active }) => {
      this.micQuestHighlight = !!active;
    });

    window.eventSystem.on('quest:actBanner', ({ textKey }) => {
      const text = this._formatUiText(textKey);
      const now = Date.now();
      this.actBannerState = {
        text,
        startedAt: now,
        visibleUntil: now + 2600,
      };
    });

    window.eventSystem.on('quest:dialogShow', (payload) => {
      this._showQuestDialog(payload);
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
