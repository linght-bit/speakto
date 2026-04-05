class GameRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = null;
    this.animationFrameId = null;
    this.micButtonRect = null;
    this.devButtonRect = null;
    this.micButtonPressed = false;
    this.micButtonPressedTime = 0;
    this.devMode = false;
    this.voiceHistory = [];
    this.foxHistory = [];
    this.voiceHistoryLimit = 100;
    this.foxHistoryLimit = 50;
    this.voicePanelExpanded = true;
    this.foxPanelExpanded = true;
    this.inventoryPanelCollapsed = true;
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
    this._pendingBadToken = null;
    
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

    const globalPalette = window.spritesData?.palette || {};
    const localPalette = Array.isArray(sprite.palette)
      ? Object.fromEntries(sprite.palette.map((color, index) => [String(index), color]))
      : (sprite.palette || {});
    const palette = { ...globalPalette, ...localPalette };
    const rows = sprite.pixels;
    const spriteH = rows.length;
    const spriteW = Array.isArray(rows[0]) ? (rows[0]?.length || 0) : (rows[0]?.length || 0);
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
        if (key === undefined || key === null || key === '.') continue;
        const color = palette[key] ?? palette[String(key)];
        if (!color || color === '#00000000' || color === 'transparent') continue;
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

   
    const voice = this.voicePanelEls;
    voice.title.textContent = t('ui.voice_history_title');
    voice.toggleBtn.textContent = this.voicePanelExpanded ? '▼' : '▲';
    voice.body.style.display = 'block';
    voice.body.style.maxHeight = this.voicePanelExpanded ? '220px' : '32px';
    this.renderPanelEntries(voice.body, this.voiceHistory, !this.voicePanelExpanded, this.currentVoiceLine, 'voice');
    if (this.voicePanelExpanded) {
      voice.body.scrollTop = voice.body.scrollHeight;
    }

   
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

   
    this.canvas.width = Math.round(logW * dpr);
    this.canvas.height = Math.round(logH * dpr);
   
    this.canvas.style.width = logW + 'px';
    this.canvas.style.height = logH + 'px';

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  
  render() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    this.inventoryHoverRects = [];
    this.worldItemHoverRects = [];

   
    window.resetUpdateCounter?.();

    this.clear();

   
    const ZOOM = 1.6;
    const _gs = window.getGameState?.();
    const _px = (_gs?.player?.x ?? 100) + 10;
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
    
   
    this.animationFrameId = requestAnimationFrame(() => this.render());
  }

  
  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  
  clear() {
    if (!this.ctx) return;
    
    const config = window.gameConfig || {};
    const bg = config.canvas?.backgroundColor || '#2a3f2f';
    
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, this._logW, this._logH);
  }

  renderUI() {
    if (!this.ctx) return;
    
    try {
      const gameState = window.getGameState?.();
      if (!gameState) return;

      this.refreshInventoryPanel();
      this.refreshQuestTaskPanel();

     
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '14px Arial';
      this.ctx.fillText(this._t('ui.game_title'), 80, 25);
      this.ctx.fillStyle = '#4ade80';
      this.ctx.font = '12px Arial';
      this.ctx.fillText(`${this._t('ui.language_label')}: ${gameState.ui.language}`, 80, 44);

     
      if (gameState.voice?.lastCommand && gameState.voice?.lastCommandTime && gameState.voice.lastCommandTime > this.lastVoiceCommandTime) {
        this.lastVoiceCommandTime = gameState.voice.lastCommandTime;
        this.currentVoiceLine = gameState.voice.lastCommand;
        this.appendHistory(this.voiceHistory, gameState.voice.lastCommand, this.voiceHistoryLimit);
       
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
      
     
      this.renderDevModeButton();
      this.renderMicrophoneButton(window.voiceSystem?.isListening || false);

      this.renderHoveredItemTooltip();
      this.renderActBanner();

     
    } catch (error) {
      console.error(error);
    }
  }

  
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

  
  renderMicrophoneButton(isListening) {
    if (!this.ctx) return;
    
   
   
    this.micButtonRect = null;
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
    if (direction === 'up') { dy = -1; faceDir = 'up'; }
    if (direction === 'down') { dy = 1; faceDir = 'down'; }

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

  
  renderVoiceStatus() {
    if (!this.ctx) return;
    
    try {
      const statusText = this._t('voice.listening');
      
     
      const pulse = Math.sin(Date.now() / 300) * 20;
      
     
      this.ctx.fillStyle = 'rgba(255, 152, 0, 0.3)';
      this.ctx.fillRect(this._logW - 180, 10, 170, 40);
      
     
      this.ctx.strokeStyle = '#ff9800';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(this._logW - 180, 10, 170, 40);
      
     
      this.ctx.fillStyle = '#ffff00';
      this.ctx.font = 'bold 14px Arial';
      this.ctx.fillText(statusText, this._logW - 170, 35);
      
     
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
     
    });

    window.eventSystem.on('fox:say', ({ text, badToken, questHint = false, questStage = null }) => {
      this.appendHistory(this.foxHistory, { text, badToken, questHint, questStage }, this.foxHistoryLimit);
     
      if (badToken) this._pendingBadToken = badToken;
      this.refreshHistoryPanels();
    });

    window.eventSystem.on('voice:commandExecuted', ({ transcript }) => {
      this.lastExecutedVoiceLine = transcript || '';
      this.markVoiceCommandExecuted(transcript);
    });

    window.eventSystem.on('voice:listening', () => {
      this.refreshHistoryPanels();
    });

    window.eventSystem.on('voice:stopped', () => {
      this.refreshHistoryPanels();
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

    window.eventSystem.on('quest:dialogHide', () => {
      this._hideQuestDialog();
    });

    window.eventSystem.on('quest:dialogContinue', () => {
      this._hideQuestDialog();
    });

   
    if (this.canvas) {
      this.canvas.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = (e.clientX - rect.left) * (this._logW / rect.width);
        const screenY = (e.clientY - rect.top) * (this._logH / rect.height);
       
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

       
        if (this.micButtonRect && 
            x > this.micButtonRect.x && 
            x < this.micButtonRect.x + this.micButtonRect.width &&
            y > this.micButtonRect.y && 
            y < this.micButtonRect.y + this.micButtonRect.height) {
          
         
          this.micButtonPressed = true;
          this.micButtonPressedTime = Date.now();
          
         
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

if (window.GameRendererWorld) {
  Object.assign(GameRenderer.prototype, window.GameRendererWorld);
}

if (window.GameRendererPanels) {
  Object.assign(GameRenderer.prototype, window.GameRendererPanels);
}

const gameRenderer = new GameRenderer('game-canvas');
window.gameRenderer = gameRenderer;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = gameRenderer;
}
