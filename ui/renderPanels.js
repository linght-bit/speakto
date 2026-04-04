window.GameRendererPanels = {
  _ensurePanelThemeStyles() {
    const styleId = 'game-ui-panel-theme';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .game-ui-panel {
        overflow: hidden;
      }
      .game-ui-panel::-webkit-scrollbar {
        width: 0;
        height: 0;
      }
      .game-ui-scroll {
        scrollbar-width: thin;
        scrollbar-color: rgba(110, 218, 255, 0.65) rgba(9, 14, 20, 0.45);
      }
      .game-ui-scroll::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .game-ui-scroll::-webkit-scrollbar-track {
        background: rgba(9, 14, 20, 0.45);
        border-radius: 8px;
      }
      .game-ui-scroll::-webkit-scrollbar-thumb {
        background: rgba(110, 218, 255, 0.55);
        border-radius: 8px;
        border: 1px solid rgba(16, 32, 44, 0.65);
      }
      .game-ui-scroll::-webkit-scrollbar-thumb:hover {
        background: rgba(142, 233, 255, 0.75);
      }
      .voice-mic-btn {
        width: 24px;
        height: 24px;
        border-radius: 999px;
        border: 1px solid rgba(111, 235, 191, 0.75);
        background: radial-gradient(circle at 35% 35%, rgba(104, 228, 184, 0.95), rgba(20, 86, 66, 0.96));
        color: #08231b;
        font-size: 9px;
        font-weight: 700;
        line-height: 24px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 0 0 1px rgba(111, 235, 191, 0.35), inset 0 1px 0 rgba(255,255,255,0.32);
      }
      .voice-mic-btn.listening {
        border-color: rgba(255, 170, 138, 0.95);
        background: radial-gradient(circle at 35% 35%, rgba(255, 162, 128, 0.96), rgba(148, 44, 28, 0.96));
        color: #fff1ea;
        box-shadow: 0 0 0 1px rgba(255, 170, 138, 0.45), 0 0 10px rgba(255, 134, 99, 0.55);
        animation: voice-mic-pulse 1.1s ease-in-out infinite;
      }
      @keyframes voice-mic-pulse {
        0% { transform: scale(1); box-shadow: 0 0 0 1px rgba(255,170,138,0.42), 0 0 8px rgba(255,134,99,0.45); }
        50% { transform: scale(1.08); box-shadow: 0 0 0 1px rgba(255,170,138,0.6), 0 0 14px rgba(255,134,99,0.7); }
        100% { transform: scale(1); box-shadow: 0 0 0 1px rgba(255,170,138,0.42), 0 0 8px rgba(255,134,99,0.45); }
      }
    `;
    document.head?.appendChild(style);
  },

  setupHistoryPanels() {
   
    const root = document.body;
    if (!root) return;
    this._ensurePanelThemeStyles();

    const makePanel = (side) => {
      const isVoice = side === 'left';
      const panel = document.createElement('div');
      panel.className = 'game-ui-panel';
      panel.style.position = 'fixed';
      panel.style.bottom = isVoice ? '10px' : '108px';
      panel.style[side] = '10px';
      panel.style.width = isVoice ? '260px' : '360px';
      panel.style.maxWidth = 'calc(100vw - 20px)';
      panel.style.background = 'rgba(8, 12, 16, 0.92)';
      panel.style.border = '1px solid rgba(99, 179, 237, 0.45)';
      panel.style.borderRadius = '8px';
      panel.style.color = '#d7ebff';
      panel.style.font = '12px Arial, sans-serif';
      panel.style.zIndex = '1200';
      panel.style.pointerEvents = 'auto';
      panel.style.backdropFilter = 'blur(2px)';
      panel.style.minWidth = isVoice ? '220px' : '260px';
      panel.style.minHeight = isVoice ? '76px' : '120px';
      panel.style.height = isVoice ? '124px' : '256px';
      panel.style.resize = 'both';
      panel.style.overflow = 'hidden';

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

      let micBtn = null;
      if (isVoice) {
        micBtn = document.createElement('button');
        micBtn.type = 'button';
        micBtn.title = this._t('ui.mic_button_idle') || 'Mic';
        micBtn.className = 'voice-mic-btn';
        micBtn.textContent = 'MIC';
      }

     
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
      body.className = 'game-ui-scroll';
      body.style.maxHeight = isVoice ? '96px' : '220px';
      body.style.overflowY = 'auto';
      body.style.padding = '6px 8px';
      body.style.whiteSpace = 'pre-wrap';
      body.style.wordBreak = 'break-word';
      body.style.lineHeight = '1.35';
      body.style.display = 'block';

      header.appendChild(title);
      actions.appendChild(toggleBtn);
      if (micBtn) actions.appendChild(micBtn);
      header.appendChild(actions);
      panel.appendChild(header);
      panel.appendChild(body);
      root.appendChild(panel);

      return { panel, header, title, body, toggleBtn, micBtn };
    };

    this.voicePanelEls = makePanel('left');
    this.foxPanelEls = makePanel('right');

    this.voicePanelEls.toggleBtn.addEventListener('click', () => {
      this.voicePanelExpanded = !this.voicePanelExpanded;
      this.refreshHistoryPanels();
    });

    if (this.voicePanelEls.micBtn) {
      this.voicePanelEls.micBtn.addEventListener('click', () => {
        if (!window.voiceSystem) return;
        if (window.voiceSystem.isListening) {
          window.voiceSystem.stop();
        } else {
          window.voiceSystem.start();
        }
      });
    }

    this.foxPanelEls.toggleBtn.addEventListener('click', () => {
      this.foxPanelExpanded = !this.foxPanelExpanded;
      this.refreshHistoryPanels();
    });

    this.refreshHistoryPanels();
  },

  setupInventoryPanel() {
    const root = document.body;
    if (!root || this.inventoryPanelEls) return;

    const panel = document.createElement('div');
    panel.className = 'game-ui-panel';
    panel.style.position = 'fixed';
    panel.style.left = '50%';
    panel.style.bottom = '10px';
    panel.style.top = 'auto';
    panel.style.transform = 'translateX(-50%)';
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
    panel.style.overflow = 'hidden';

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
    body.className = 'game-ui-scroll';
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
      panel.style.transform = 'none';
      panel.style.bottom = 'auto';
      panel.style.left = rect.left + 'px';
      panel.style.top = rect.top + 'px';
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
  },

  _buildInventoryEntries(inventory) {
    const counts = new Map();
    for (const itemId of inventory || []) {
      counts.set(itemId, (counts.get(itemId) || 0) + 1);
    }
    return [...counts.entries()].map(([itemId, count]) => ({ itemId, count }));
  },

  _makeInventoryIcon(itemId, count, { isEquipped = false } = {}) {
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.width = '28px';
    wrap.style.height = '28px';
    wrap.style.border = isEquipped
      ? '2px solid rgba(109, 247, 126, 0.95)'
      : '1px solid rgba(122,222,128,0.45)';
    wrap.style.borderRadius = '4px';
    wrap.style.background = isEquipped
      ? 'rgba(36, 96, 44, 0.30)'
      : 'rgba(0, 0, 0, 0.18)';
    wrap.style.boxShadow = isEquipped
      ? '0 0 10px rgba(109, 247, 126, 0.35), inset 0 0 6px rgba(109, 247, 126, 0.18)'
      : 'none';
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
  },

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
      engineerSuit: !!gameState?.player?.engineerSuit,
    });
    if (signature === this._inventoryPanelSignature) return;
    this._inventoryPanelSignature = signature;

    const panelWasCollapsed = els.panel.dataset.collapsedState === 'true';
    if (!els.panel.dataset.expandedWidth) {
      els.panel.dataset.expandedWidth = `${els.panel.offsetWidth || 420}px`;
      els.panel.dataset.expandedHeight = `${els.panel.offsetHeight || 120}px`;
    }

    if (this.inventoryPanelCollapsed) {
      if (!panelWasCollapsed) {
        els.panel.dataset.expandedWidth = `${els.panel.offsetWidth || parseInt(els.panel.dataset.expandedWidth, 10) || 420}px`;
        els.panel.dataset.expandedHeight = `${els.panel.offsetHeight || parseInt(els.panel.dataset.expandedHeight, 10) || 120}px`;
      }
      els.panel.style.resize = 'none';
      els.panel.style.overflow = 'hidden';
      els.panel.style.width = '260px';
      els.panel.style.height = 'auto';
      els.panel.style.minHeight = '0';
      els.panel.dataset.collapsedState = 'true';
    } else {
      els.panel.style.resize = 'both';
      els.panel.style.overflow = 'hidden';
      els.panel.style.minHeight = '100px';
      if (panelWasCollapsed) {
        els.panel.style.width = els.panel.dataset.expandedWidth;
        els.panel.style.height = els.panel.dataset.expandedHeight;
      }
      els.panel.dataset.collapsedState = 'false';
      els.panel.dataset.expandedWidth = `${els.panel.offsetWidth || parseInt(els.panel.dataset.expandedWidth, 10) || 420}px`;
      els.panel.dataset.expandedHeight = `${els.panel.offsetHeight || parseInt(els.panel.dataset.expandedHeight, 10) || 120}px`;
    }

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
      const isEquipped = itemId === 'engineer_suit' && !!gameState?.player?.engineerSuit;

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '8px';
      row.style.padding = '4px 6px';
      row.style.border = isEquipped
        ? '1px solid rgba(109,247,126,0.72)'
        : '1px solid rgba(255,152,0,0.18)';
      row.style.borderRadius = '6px';
      row.style.background = isEquipped
        ? 'rgba(64, 126, 72, 0.16)'
        : 'rgba(255,152,0,0.06)';
      row.title = desc ? `${name} - ${desc}` : name;

      const icon = this._makeInventoryIcon(itemId, count, { isEquipped });
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

      const compactCell = this._makeInventoryIcon(itemId, count, { isEquipped });
      compactCell.title = name;
      compactRow.appendChild(compactCell);
    }

    els.body.appendChild(grid);
    els.compact.appendChild(compactRow);
  },

  _formatUiText(key, params = {}) {
    let text = this._t(key) || '';
    for (const [paramKey, paramValue] of Object.entries(params || {})) {
      text = text.replaceAll(`{${paramKey}}`, String(paramValue ?? ''));
    }
    return text;
  },

  setupQuestTaskPanel() {
    const root = document.body;
    if (!root || this.questTaskPanelEls) return;

    const panel = document.createElement('div');
    panel.className = 'game-ui-panel';
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
    panel.style.overflow = 'hidden';

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
    body.className = 'game-ui-scroll';
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
  },

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

    const panelWasCollapsed = els.panel.dataset.collapsedState === 'true';
    if (!els.panel.dataset.expandedWidth) {
      els.panel.dataset.expandedWidth = `${els.panel.offsetWidth || 340}px`;
      els.panel.dataset.expandedHeight = `${els.panel.offsetHeight || 120}px`;
    }

    if (this.questTaskPanelCollapsed) {
      if (!panelWasCollapsed) {
        els.panel.dataset.expandedWidth = `${els.panel.offsetWidth || parseInt(els.panel.dataset.expandedWidth, 10) || 340}px`;
        els.panel.dataset.expandedHeight = `${els.panel.offsetHeight || parseInt(els.panel.dataset.expandedHeight, 10) || 120}px`;
      }
      els.panel.style.resize = 'none';
      els.panel.style.overflow = 'hidden';
      els.panel.style.width = '280px';
      els.panel.style.height = 'auto';
      els.panel.style.minHeight = '0';
      els.panel.dataset.collapsedState = 'true';
    } else {
      els.panel.style.resize = 'both';
      els.panel.style.overflow = 'hidden';
      els.panel.style.minHeight = '90px';
      if (panelWasCollapsed) {
        els.panel.style.width = els.panel.dataset.expandedWidth;
        els.panel.style.height = els.panel.dataset.expandedHeight;
      }
      els.panel.dataset.collapsedState = 'false';
      els.panel.dataset.expandedWidth = `${els.panel.offsetWidth || parseInt(els.panel.dataset.expandedWidth, 10) || 340}px`;
      els.panel.dataset.expandedHeight = `${els.panel.offsetHeight || parseInt(els.panel.dataset.expandedHeight, 10) || 120}px`;
    }

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
  },

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
    body.className = 'game-ui-scroll';
    body.style.padding = '12px';
    body.style.maxHeight = '360px';
    body.style.overflowY = 'auto';
    body.style.whiteSpace = 'pre-wrap';
    body.style.lineHeight = '1.45';

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.padding = '0 12px 12px';

    const voiceHint = document.createElement('div');
    voiceHint.style.fontSize = '12px';
    voiceHint.style.color = 'rgba(140, 220, 255, 0.70)';
    voiceHint.style.fontStyle = 'italic';
    voiceHint.style.display = 'flex';
    voiceHint.style.alignItems = 'center';
    voiceHint.style.gap = '6px';

   
    const continueBtn = document.createElement('button');
    continueBtn.type = 'button';
    continueBtn.style.display = 'none';
    continueBtn.addEventListener('click', () => {
      const dialogId = this.questDialogState?.dialogId;
      this._hideQuestDialog();
      if (dialogId) {
        window.eventSystem?.emit('quest:dialogContinue', { dialogId });
      }
    });

   
    panel.style.cursor = 'pointer';
    panel.addEventListener('click', (e) => {
      if (!this.questDialogState) return;
      const dialogId = this.questDialogState.dialogId;
      this._hideQuestDialog();
      if (dialogId) {
        window.eventSystem?.emit('quest:dialogContinue', { dialogId });
      }
    });

    header.appendChild(title);
    header.appendChild(speaker);
    footer.appendChild(voiceHint);
    footer.appendChild(continueBtn);
    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(footer);
    root.appendChild(panel);

    this.questDialogEls = { panel, title, speaker, body, continueBtn, voiceHint };
  },

  _showQuestDialog({ dialogId, titleKey, bodyKeys = [], params = {}, taskKeys = [] } = {}) {
    if (!this.questDialogEls) return;
    this.questDialogState = { dialogId, titleKey, bodyKeys, params, taskKeys };

    const els = this.questDialogEls;
    els.title.textContent = this._formatUiText(titleKey, params);
    els.speaker.textContent = this._t('ui.fox_history_title');
    els.body.innerHTML = '';

   
    const combinedText = (bodyKeys || [])
      .map((key) => this._formatUiText(key, params))
      .filter(Boolean)
      .join('\n');

    if (combinedText) {
      const block = document.createElement('div');
      block.textContent = combinedText;
      block.style.marginBottom = '12px';
      block.style.padding = '8px 10px';
      block.style.border = '1px solid rgba(112, 214, 255, 0.16)';
      block.style.borderRadius = '8px';
      block.style.background = 'rgba(112, 214, 255, 0.05)';
      block.style.whiteSpace = 'pre-wrap';
      els.body.appendChild(block);
    }

   
    const tasks = (taskKeys || []).map((k) => this._formatUiText(k, params)).filter(Boolean);
    if (tasks.length) {
      const tasksWrap = document.createElement('div');
      tasksWrap.style.marginTop = '8px';
      tasksWrap.style.padding = '8px 10px';
      tasksWrap.style.border = '1px solid rgba(255, 230, 100, 0.25)';
      tasksWrap.style.borderRadius = '8px';
      tasksWrap.style.background = 'rgba(255, 220, 60, 0.06)';

      const label = document.createElement('div');
      label.textContent = this._t('ui.current_tasks_title') || 'TASKS';
      label.style.fontSize = '10px';
      label.style.fontWeight = '700';
      label.style.color = 'rgba(255, 220, 80, 0.75)';
      label.style.marginBottom = '5px';
      label.style.letterSpacing = '0.06em';
      tasksWrap.appendChild(label);

      for (const taskText of tasks) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '6px';
        row.style.fontSize = '12px';
        row.style.color = '#e8f4ff';
        row.style.padding = '2px 0';

        const dot = document.createElement('span');
        dot.textContent = '◆';
        dot.style.color = '#ffe96a';
        dot.style.fontSize = '8px';
        dot.style.flexShrink = '0';

        const txt = document.createElement('span');
        txt.textContent = taskText;

        row.appendChild(dot);
        row.appendChild(txt);
        tasksWrap.appendChild(row);
      }

      els.body.appendChild(tasksWrap);
    }

    els.body.scrollTop = els.body.scrollHeight;

   
    if (els.voiceHint) {
      const continueCommand = String(window.getText?.('voice.command_examples.dialog_continue', 'pt') || 'OK').trim() || 'OK';
      const hintText = this._formatUiText('ui.say_ok_hint', { command: continueCommand }) || `Say “${continueCommand}” to continue`;
      els.voiceHint.innerHTML = '';
      const mic = document.createElement('span');
      mic.textContent = '🎙';
      const txt = document.createElement('span');
      const tokenRegex = new RegExp(this._escapeRegExp(continueCommand), 'i');
      const match = hintText.match(tokenRegex);

      if (!match) {
        txt.textContent = hintText;
      } else {
        const token = match[0];
        const start = hintText.indexOf(token);
        if (start > 0) txt.appendChild(document.createTextNode(hintText.slice(0, start)));

        const accent = document.createElement('span');
        accent.textContent = token;
        accent.style.color = '#7adf7a';
        accent.style.fontWeight = '700';
        txt.appendChild(accent);

        const rest = hintText.slice(start + token.length);
        if (rest) txt.appendChild(document.createTextNode(rest));
      }

      els.voiceHint.appendChild(mic);
      els.voiceHint.appendChild(txt);
    }

    els.panel.style.display = 'block';
  },

  _hideQuestDialog() {
    if (this.questDialogEls) {
      this.questDialogEls.panel.style.display = 'none';
    }
    this.questDialogState = null;
  },

  appendHistory(list, entry, limit) {
    const normalized = typeof entry === 'string'
      ? { text: entry, status: 'default' }
      : { ...(entry || {}) };
    if (!normalized.text || !String(normalized.text).trim()) return;
    list.push({
      text: String(normalized.text),
      status: normalized.status || 'default',
      badToken: normalized.badToken || '',
      questHint: !!normalized.questHint,
      questStage: normalized.questStage || null,
    });
    if (list.length > limit) {
      list.splice(0, list.length - limit);
    }
  },

  markVoiceCommandExecuted(text) {
    if (!text) return;
    for (let idx = this.voiceHistory.length - 1; idx >= 0; idx--) {
      if (this.voiceHistory[idx]?.text === text) {
        this.voiceHistory[idx] = { ...this.voiceHistory[idx], status: 'executed' };
        break;
      }
    }
    this.refreshHistoryPanels();
  },

  _escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

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
        span.style.color = '#ffa040';
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
  },

  _measureCollapsedFoxWidth(text) {
    const source = String(text || '').trim();
    if (!source) return '320px';

    const measurer = document.createElement('div');
    measurer.style.position = 'fixed';
    measurer.style.visibility = 'hidden';
    measurer.style.pointerEvents = 'none';
    measurer.style.left = '-9999px';
    measurer.style.top = '-9999px';
    measurer.style.font = '12px Arial, sans-serif';
    measurer.style.padding = '6px 8px';
    measurer.style.whiteSpace = 'nowrap';
    measurer.textContent = source;
    document.body.appendChild(measurer);

    const measured = Math.ceil(measurer.getBoundingClientRect().width + 44);
    measurer.remove();

    const max = Math.max(260, window.innerWidth - 20);
    const width = Math.max(260, Math.min(max, measured));
    return `${width}px`;
  },

  renderPanelEntries(body, entries, collapsed, currentLine = '', panelKind = 'voice') {
    body.innerHTML = '';
    let visibleEntries = collapsed
      ? (currentLine
        ? [{ text: currentLine, status: entries[entries.length - 1]?.status || 'default' }]
        : (entries.length ? [entries[entries.length - 1]] : []))
      : [...entries];

    if (!visibleEntries.length) {
      body.textContent = this._t('ui.history_empty');
      return;
    }

    const isFoxPanel = panelKind === 'fox';
    const currentQuestStage = window.getGameState?.()?.quests?.progress?.stage || null;
    let stickyQuestEntry = null;
    if (isFoxPanel && !collapsed) {
      for (let idx = visibleEntries.length - 1; idx >= 0; idx--) {
        const candidate = visibleEntries[idx];
        if (candidate?.questHint && candidate?.questStage && candidate.questStage === currentQuestStage) {
          stickyQuestEntry = candidate;
          break;
        }
      }
      const latest = visibleEntries[visibleEntries.length - 1] || null;
      if (stickyQuestEntry && latest && stickyQuestEntry !== latest) {
        const filtered = visibleEntries.filter((entry) => entry !== stickyQuestEntry);
        filtered.splice(Math.max(filtered.length - 1, 0), 0, stickyQuestEntry);
        visibleEntries = filtered;
      }
    }
    const lastEntry = !collapsed && visibleEntries.length ? visibleEntries[visibleEntries.length - 1] : null;

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
        const isLatestFoxEntry = entry === lastEntry;
        const isStickyQuest = !!stickyQuestEntry && entry === stickyQuestEntry;
        const borderColor = entry.status === 'error' ? 'rgba(255, 140, 110, 0.55)' : 'rgba(110, 218, 255, 0.40)';
        const fillColor = entry.status === 'error' ? 'rgba(76, 24, 18, 0.48)' : 'rgba(16, 32, 44, 0.56)';
        const shouldHighlight = isLatestFoxEntry || isStickyQuest;
        row.style.background = shouldHighlight ? fillColor : 'rgba(16, 32, 44, 0.34)';
        row.style.border = `1px solid ${shouldHighlight ? borderColor : 'rgba(110, 218, 255, 0.18)'}`;
        row.style.borderLeft = `3px solid ${shouldHighlight ? (entry.status === 'error' ? '#ff8c6f' : '#6edaff') : 'rgba(110, 218, 255, 0.35)'}`;
        if (entry.questHint && !collapsed) {
          row.style.borderWidth = '2px';
          row.style.borderLeftWidth = '4px';
          row.style.borderColor = 'rgba(255, 233, 128, 0.75)';
          row.style.borderLeftColor = '#ffe980';
        }
        row.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.03)';
        row.style.opacity = shouldHighlight ? '1' : '0.72';
        row.style.color = shouldHighlight ? baseColor : (entry.status === 'error' ? '#d8b39f' : '#a9bfd1');
      }

      this._appendDecoratedEntryText(row, entry.text, {
        badToken: entry.badToken,
        highlightPortuguese: isFoxPanel,
      });

      body.appendChild(row);
    });
  },

  refreshHistoryPanels() {
    if (!this.voicePanelEls || !this.foxPanelEls) return;

    const t = (key) => this._t(key);

    const applyCollapsedMode = (panelEl, collapsed, compactWidth = '320px') => {
      if (!panelEl) return;
      const wasCollapsed = panelEl.dataset.collapsedState === 'true';

      if (!panelEl.dataset.expandedWidth) {
        panelEl.dataset.expandedWidth = `${panelEl.offsetWidth || 360}px`;
      }
      if (!panelEl.dataset.expandedHeight) {
        panelEl.dataset.expandedHeight = `${panelEl.offsetHeight || 120}px`;
      }

      if (!collapsed) {
        panelEl.style.resize = 'both';
        panelEl.style.overflow = 'hidden';
        panelEl.style.minHeight = '90px';
        if (wasCollapsed) {
          panelEl.style.width = panelEl.dataset.expandedWidth;
          panelEl.style.height = panelEl.dataset.expandedHeight;
        }
        panelEl.dataset.collapsedState = 'false';
        panelEl.dataset.expandedWidth = `${panelEl.offsetWidth || parseInt(panelEl.dataset.expandedWidth, 10) || 360}px`;
        panelEl.dataset.expandedHeight = `${panelEl.offsetHeight || parseInt(panelEl.dataset.expandedHeight, 10) || 120}px`;
        return;
      }

      if (!wasCollapsed) {
        panelEl.dataset.expandedWidth = `${panelEl.offsetWidth || parseInt(panelEl.dataset.expandedWidth, 10) || 360}px`;
        panelEl.dataset.expandedHeight = `${panelEl.offsetHeight || parseInt(panelEl.dataset.expandedHeight, 10) || 120}px`;
      }
      panelEl.style.resize = 'none';
      panelEl.style.overflow = 'hidden';
      panelEl.style.width = compactWidth;
      panelEl.style.height = 'auto';
      panelEl.style.minHeight = '0';
      panelEl.dataset.collapsedState = 'true';
    };

   
    const voice = this.voicePanelEls;
    voice.title.textContent = t('ui.voice_history_title');
    voice.toggleBtn.textContent = this.voicePanelExpanded ? '▼' : '▲';
    if (voice.micBtn) {
      const listening = !!window.voiceSystem?.isListening;
      voice.micBtn.classList.toggle('listening', listening);
      voice.micBtn.textContent = listening ? 'REC' : 'MIC';
      voice.micBtn.title = listening ? (this._t('voice.listening') || 'Listening') : (this._t('ui.mic_button_idle') || 'Mic');
    }
    applyCollapsedMode(voice.panel, !this.voicePanelExpanded, '260px');
    voice.body.style.display = 'block';
    voice.body.style.maxHeight = this.voicePanelExpanded ? '96px' : '32px';
    this.renderPanelEntries(voice.body, this.voiceHistory, !this.voicePanelExpanded, this.currentVoiceLine, 'voice');
    voice.body.scrollTop = voice.body.scrollHeight;

   
    const fox = this.foxPanelEls;
    fox.title.textContent = t('ui.fox_history_title');
    fox.toggleBtn.textContent = this.foxPanelExpanded ? '▼' : '▲';
    applyCollapsedMode(fox.panel, !this.foxPanelExpanded, this._measureCollapsedFoxWidth(this.foxHistory[this.foxHistory.length - 1]?.text || ''));
    fox.body.style.display = 'block';
    fox.body.style.maxHeight = this.foxPanelExpanded ? '220px' : '32px';
    this.renderPanelEntries(fox.body, this.foxHistory, !this.foxPanelExpanded, this.foxHistory[this.foxHistory.length - 1]?.text || '', 'fox');
    fox.body.scrollTop = fox.body.scrollHeight;
  },
};
