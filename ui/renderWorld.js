/**
 * /ui/renderWorld.js
 * Мир и canvas-слои: фон, пол, стены, объекты, игрок, предметы и debug-grid.
 * Только отрисовка мира, без DOM-панелей и бизнес-логики.
 */

window.GameRendererWorld = {
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
  },

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
  },

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
  },

  _spaceGradColor(rel, band = 0) {
    const r = Math.round(7 + band * 3 + rel * 5);
    const g = Math.round(10 + band * 4 + rel * 8);
    const b = Math.round(24 + (1 - rel) * 30 - band * 2);
    return `rgb(${r}, ${g}, ${b})`;
  },

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
  },

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
  },

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
  },

  _getFloorZone(cx, cy, pf, zones) {
    return zones?.cellZones?.get(`${cx},${cy}`) || 'default';
  },

  _isFloorZoneBlocker(objectId) {
    return objectId === 'wall' ||
      objectId === 'bulkhead_heavy_v' ||
      objectId === 'bulkhead_heavy_h' ||
      objectId === 'door_inner_v' ||
      objectId === 'door_inner_h' ||
      objectId === 'airlock_door_v' ||
      objectId === 'airlock_door_h' ||
      String(objectId || '').startsWith('door_color_');
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

  _getPlayerFacingDirection(playerData) {
    const waypoint = playerData?.pathWaypoints?.[playerData.currentWaypoint || 0] || null;
    const targetX = waypoint?.x ?? playerData?.targetX;
    const targetY = waypoint?.y ?? playerData?.targetY;
    const px = playerData?.x ?? 0;
    const py = playerData?.y ?? 0;

    if (typeof targetX === 'number' && typeof targetY === 'number') {
      const dx = targetX - px;
      const dy = targetY - py;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        return Math.abs(dx) > Math.abs(dy)
          ? (dx >= 0 ? 'right' : 'left')
          : (dy >= 0 ? 'down' : 'up');
      }
    }

    return ['left', 'right', 'up', 'down'].includes(playerData?.direction)
      ? playerData.direction
      : 'up';
  },

  _getPlayerFacingAngle(facing) {
    switch (facing) {
      case 'right': return 0;
      case 'down': return Math.PI / 2;
      case 'left': return Math.PI;
      case 'up':
      default: return -Math.PI / 2;
    }
  },

  _drawPlayerVisionCone(centerX, centerY, facing) {
    if (!this.ctx) return;
    const angle = this._getPlayerFacingAngle(facing);
    const spread = (100 * Math.PI) / 180;
    const radius = 118;
    const ox = centerX + Math.cos(angle) * 4;
    const oy = centerY + Math.sin(angle) * 4;

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(ox, oy);
    this.ctx.arc(ox, oy, radius, angle - spread / 2, angle + spread / 2);
    this.ctx.closePath();

    const gradient = this.ctx.createRadialGradient(ox, oy, 4, ox, oy, radius);
    gradient.addColorStop(0, 'rgba(255, 244, 184, 0.22)');
    gradient.addColorStop(0.4, 'rgba(156, 232, 255, 0.13)');
    gradient.addColorStop(1, 'rgba(156, 232, 255, 0)');
    this.ctx.fillStyle = gradient;
    this.ctx.fill();

    this.ctx.strokeStyle = 'rgba(170, 245, 255, 0.08)';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
    this.ctx.restore();
  },

  _drawPlayerTopDown(drawX, drawY, size, facing = 'up') {
    const ctx = this.ctx;
    if (!ctx) return;

    const unit = Math.max(1, Math.floor(size / 10));
    const colors = {
      outline: '#10202c',
      suit: '#7ca7bf',
      suitShade: '#557189',
      suitLight: '#b9d6e6',
      skin: '#f2c7a5',
      skinShade: '#d7a27a',
      accent: '#78efff',
      pack: '#344b60',
      boots: '#273341',
    };

    const block = (x, y, w, h, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(drawX + x * unit, drawY + y * unit, w * unit, h * unit);
    };

    const designs = {
      up: [
        [3, 1, 4, 1, colors.outline],
        [2, 2, 6, 2, colors.skinShade],
        [3, 4, 4, 1, colors.outline],
        [2, 5, 6, 1, colors.suitLight],
        [1, 6, 8, 3, colors.suit],
        [3, 6, 4, 1, colors.pack],
        [2, 9, 2, 1, colors.boots],
        [6, 9, 2, 1, colors.boots]
      ],
      down: [
        [3, 1, 4, 1, colors.outline],
        [2, 2, 6, 2, colors.skin],
        [3, 3, 1, 1, colors.skinShade],
        [6, 3, 1, 1, colors.skinShade],
        [3, 4, 4, 1, colors.accent],
        [2, 5, 6, 1, colors.suitLight],
        [1, 6, 8, 3, colors.suit],
        [3, 7, 4, 1, colors.suitShade],
        [2, 9, 2, 1, colors.boots],
        [6, 9, 2, 1, colors.boots]
      ],
      left: [
        [2, 2, 4, 2, colors.skin],
        [5, 2, 1, 2, colors.skinShade],
        [1, 5, 6, 1, colors.suitLight],
        [1, 6, 7, 3, colors.suit],
        [1, 7, 1, 2, colors.suitShade],
        [3, 7, 3, 1, colors.accent],
        [5, 6, 2, 1, colors.pack],
        [2, 9, 2, 1, colors.boots],
        [5, 9, 2, 1, colors.boots]
      ],
      right: [
        [4, 2, 4, 2, colors.skin],
        [4, 2, 1, 2, colors.skinShade],
        [3, 5, 6, 1, colors.suitLight],
        [2, 6, 7, 3, colors.suit],
        [8, 7, 1, 2, colors.suitShade],
        [4, 7, 3, 1, colors.accent],
        [3, 6, 2, 1, colors.pack],
        [3, 9, 2, 1, colors.boots],
        [6, 9, 2, 1, colors.boots]
      ]
    };

    for (const [x, y, w, h, color] of (designs[facing] || designs.up)) {
      block(x, y, w, h, color);
    }

    ctx.strokeStyle = 'rgba(12, 20, 28, 0.85)';
    ctx.lineWidth = 1;
    ctx.strokeRect(drawX + 2.5, drawY + 2.5, size - 5, size - 5);
  },

  /**
   * Рендерим персонажа
   */
  renderPlayer(playerData) {
    if (!this.ctx || !playerData) return;
    
    try {
      window.updatePlayerMovement?.(playerData);

      playerData = window.getGameState?.().player;
      const x = playerData.x ?? 100;
      const y = playerData.y ?? 100;
      const facing = this._getPlayerFacingDirection(playerData);

      const CELL = 20;
      const drawX = x - CELL / 2;
      const drawY = y - CELL / 2;

      this._drawPlayerVisionCone(x, y, facing);

      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      this.ctx.beginPath();
      this.ctx.ellipse(drawX + CELL / 2, drawY + CELL - 1, CELL / 2.7, 2.2, 0, 0, Math.PI * 2);
      this.ctx.fill();

      this._drawPlayerTopDown(drawX, drawY, CELL, facing);

    } catch (error) {
      console.error(error);
    }
  },

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
  },

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
  },

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
  },
};
