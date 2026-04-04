console.log('%c🎨 renderWorld build: 20260404r2', 'color:#00ff88;font-weight:bold');
window.GameRendererWorld = {
  
  renderWorld() {
    if (!this.ctx) return;

    try {
      const gameState = window.getGameState?.();

     
      this.renderSpaceBackground();

     
      this.renderShipFloor();

     
      this.renderShipWalls(gameState);

     

     
      if (gameState && gameState.world?.mapObjects) {
        this.renderMapObjects(gameState.world.mapObjects);
      }

     
      if (gameState && gameState.player) {
        this.renderPlayer(gameState.player);
      }

     
      if (gameState && gameState.world?.objects) {
        this.renderWorldObjects(gameState.world.objects);
      }

     
      if (gameState && gameState.player) {
        this.renderFogOfWar(gameState);
      }

     
      if (window.gameConfig?.debug?.showGrid) {
        this.renderDebugGrid(gameState);
      }

    } catch (error) {
      console.error(error);
    }
  },

  _fogFacingAngle(direction = 'down') {
    switch (direction) {
      case 'right': return 0;
      case 'down': return Math.PI / 2;
      case 'left': return Math.PI;
      case 'up': return -Math.PI / 2;
      default: return Math.PI / 2;
    }
  },

  _fogAngleDelta(a, b) {
    let diff = a - b;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff);
  },

  _isWindowObject(obj) {
    const id = String(obj?.objectId || '');
    return id === 'window' || id === 'window_v_small' || id === 'window_h_small' || id === 'viewport_wide';
  },

  _isVisionBlockingObject(obj, gameState) {
    if (!obj || this._isWindowObject(obj)) return false;

    const id = String(obj.objectId || '');
    if (id === 'wall') return true;

    const isDoor = id === 'door' || id === 'door_locked' || id === 'door_inner_v' || id === 'door_inner_h'
      || id === 'airlock_door_v' || id === 'airlock_door_h' || id.startsWith('door_color_');
    if (!isDoor) return false;

    const isOpen = (id === 'door' && gameState?.world?.flags?.door_open)
      || (id === 'door_locked' && gameState?.world?.flags?.door_locked_open)
      || ((id === 'door_inner_v' || id === 'door_inner_h' || id === 'airlock_door_v' || id === 'airlock_door_h' || id.startsWith('door_color_'))
        && gameState?.world?.flags?.[`door_open_${obj.id}`]);

    return !isOpen;
  },

  _buildVisionBlockers(gameState) {
    const CELL = 20;
    const pf = window.pathfindingSystem;
    const blockers = new Set();
    const windowCells = new Set();

    for (const obj of gameState?.world?.mapObjects || []) {
      if (!this._isWindowObject(obj)) continue;
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

    const { x0, y0, x1, y1 } = this._visibleCellRange();
    for (let gy = y0 - 12; gy <= y1 + 12; gy++) {
      for (let gx = x0 - 12; gx <= x1 + 12; gx++) {
        if (pf?._classifyHullCell?.(gx, gy) === 'wall' && !windowCells.has(`${gx},${gy}`)) {
          blockers.add(`${gx},${gy}`);
        }
      }
    }

    for (const obj of gameState?.world?.mapObjects || []) {
      if (!this._isVisionBlockingObject(obj, gameState)) continue;
      const objGrid = pf?.posToGrid?.(obj.x || 0, obj.y || 0) || { x: Math.floor((obj.x || 0) / CELL), y: Math.floor((obj.y || 0) / CELL) };
      const objWidthGrid = Math.max(1, Math.ceil((obj.width || CELL) / CELL));
      const objHeightGrid = Math.max(1, Math.ceil((obj.height || CELL) / CELL));
      const minX = objGrid.x - Math.floor(objWidthGrid / 2);
      const maxX = objGrid.x + Math.ceil(objWidthGrid / 2);
      const minY = objGrid.y - Math.floor(objHeightGrid / 2);
      const maxY = objGrid.y + Math.ceil(objHeightGrid / 2);
      for (let gx = minX; gx < maxX; gx++) {
        for (let gy = minY; gy < maxY; gy++) {
          if (!windowCells.has(`${gx},${gy}`)) blockers.add(`${gx},${gy}`);
        }
      }
    }

    return blockers;
  },

  _hasFogLineOfSight(fromGX, fromGY, toGX, toGY, blockers) {
    let x = fromGX;
    let y = fromGY;
    const dx = Math.abs(toGX - fromGX);
    const sx = fromGX < toGX ? 1 : -1;
    const dy = -Math.abs(toGY - fromGY);
    const sy = fromGY < toGY ? 1 : -1;
    let err = dx + dy;

    while (!(x === toGX && y === toGY)) {
      const e2 = err * 2;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
      if (x === toGX && y === toGY) return true;
      if (blockers.has(`${x},${y}`)) return false;
    }

    return true;
  },

  _computeVisibleFogCells(gameState) {
    const CELL = 20;
    const pf = window.pathfindingSystem;
    const player = gameState?.player;
    if (!player) return new Set();

    const center = pf?.posToGrid?.(player.x, player.y) || { x: Math.floor(player.x / CELL), y: Math.floor(player.y / CELL) };
    const blockers = this._buildVisionBlockers(gameState);
    const facing = this._fogFacingAngle(player.direction || 'down');
    const visible = new Set();
    const nearRadius = 5;
    const farRadius = 14;
    const halfFov = (100 * Math.PI / 180) / 2;

    for (let gy = center.y - farRadius; gy <= center.y + farRadius; gy++) {
      for (let gx = center.x - farRadius; gx <= center.x + farRadius; gx++) {
        const cellType = pf?._classifyHullCell?.(gx, gy) || 'floor';
        if (cellType === 'space') continue;

        const dx = gx - center.x;
        const dy = gy - center.y;
        const dist = Math.hypot(dx, dy);
        if (dist > farRadius + 0.001) continue;

        const inNearVision = dist <= nearRadius + 0.001;
        const angle = Math.atan2(dy, dx);
        const inFrontVision = dist <= farRadius + 0.001 && this._fogAngleDelta(angle, facing) <= halfFov;
        if (!inNearVision && !inFrontVision) continue;

        if (!this._hasFogLineOfSight(center.x, center.y, gx, gy, blockers)) continue;
        visible.add(`${gx},${gy}`);
      }
    }

    visible.add(`${center.x},${center.y}`);
    return visible;
  },

  _computeCurrentRoomFogCells(gameState) {
    const CELL = 20;
    const pf = window.pathfindingSystem;
    const player = gameState?.player;
    if (!player) return new Set();

    const center = pf?.posToGrid?.(player.x, player.y) || { x: Math.floor(player.x / CELL), y: Math.floor(player.y / CELL) };
    const openDoorSignature = Object.entries(gameState?.world?.flags || {})
      .filter(([key, value]) => !!value && (key === 'door_open' || key === 'door_locked_open' || key.startsWith('door_open_')))
      .map(([key]) => key)
      .sort()
      .join('|');
    const cacheKey = `${center.x},${center.y}|${openDoorSignature}`;

    if (this._fogRoomCacheKey === cacheKey && Array.isArray(this._fogRoomCache)) {
      return new Set(this._fogRoomCache);
    }

    const blockers = this._buildVisionBlockers(gameState);
    const roomCells = new Set();
    const queue = [[center.x, center.y]];

    for (let idx = 0; idx < queue.length; idx++) {
      const [gx, gy] = queue[idx];
      const key = `${gx},${gy}`;
      if (roomCells.has(key)) continue;

      const cellType = pf?._classifyHullCell?.(gx, gy) || 'floor';
      if (cellType === 'space' || cellType === 'wall') continue;
      if (blockers.has(key)) continue;

      roomCells.add(key);
      queue.push([gx - 1, gy], [gx + 1, gy], [gx, gy - 1], [gx, gy + 1]);
    }

    for (const key of [...roomCells]) {
      const [gx, gy] = key.split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = gx + dx;
        const ny = gy + dy;
        if ((pf?._classifyHullCell?.(nx, ny) || 'floor') === 'wall') {
          roomCells.add(`${nx},${ny}`);
        }
      }
    }

    this._fogRoomCacheKey = cacheKey;
    this._fogRoomCache = [...roomCells];
    return roomCells;
  },

  _isFogBoundaryCell(gx, gy, visibleCells) {
    return ![
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].every(([dx, dy]) => visibleCells.has(`${gx + dx},${gy + dy}`));
  },

  _fogOpacityFactor(gx, gy, visibleCells, fullFog = false) {
    let touchingVisible = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (visibleCells.has(`${gx + dx},${gy + dy}`)) touchingVisible++;
      }
    }
    if (!touchingVisible) return 1;
    return Math.max(fullFog ? 0.94 : 0.62, 1 - touchingVisible * (fullFog ? 0.018 : 0.08));
  },

  renderFogOfWar(gameState) {
    if (!this.ctx || !gameState?.player) return;

    const CELL = 20;
    const pf = window.pathfindingSystem;
    const visibleCells = this._computeVisibleFogCells(gameState);
    const currentRoomCells = this._computeCurrentRoomFogCells(gameState);
    this._fogSeenCells = this._fogSeenCells || new Set();
    this._fogRevealedRoomCells = this._fogRevealedRoomCells || new Set();

    for (const key of visibleCells) this._fogSeenCells.add(key);
    for (const key of currentRoomCells) this._fogRevealedRoomCells.add(key);

    const { x0, y0, x1, y1 } = this._visibleCellRange();

    this.ctx.save();
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const cellType = pf?._classifyHullCell?.(gx, gy) || 'floor';
        if (cellType === 'space') continue;

        const key = `${gx},${gy}`;
        if (visibleCells.has(key)) continue;

        const isPartialFog = this._fogSeenCells.has(key) || this._fogRevealedRoomCells.has(key);
        const alphaBase = isPartialFog ? 0.28 : 0.96;
        const alpha = Math.min(0.98, alphaBase * this._fogOpacityFactor(gx, gy, visibleCells, !isPartialFog));
        this.ctx.fillStyle = `rgba(4, 8, 18, ${alpha.toFixed(3)})`;
        this.ctx.fillRect(gx * CELL, gy * CELL, CELL, CELL);
      }
    }

    this.ctx.globalCompositeOperation = 'destination-out';
    for (const key of visibleCells) {
      const [gx, gy] = key.split(',').map(Number);
      if (!this._isFogBoundaryCell(gx, gy, visibleCells)) continue;

      const cx = gx * CELL + CELL / 2;
      const cy = gy * CELL + CELL / 2;
      const grad = this.ctx.createRadialGradient(cx, cy, CELL * 0.15, cx, cy, CELL * 1.15);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.18)');
      grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.09)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(cx - CELL * 1.2, cy - CELL * 1.2, CELL * 2.4, CELL * 2.4);
    }

    this.ctx.restore();
  },

  
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

  _getDoorVisualTone(palette = null, heavy = false) {
    const palettes = {
      red: { a: '#8d98a8', b: '#69788c', border: '#ebf2f8', accent: '#ff6b78', glow: 'rgba(255, 107, 120, 0.28)' },
      blue: { a: '#8ca2ba', b: '#6a809a', border: '#e6f2fb', accent: '#73ddff', glow: 'rgba(115, 221, 255, 0.24)' },
      green: { a: '#91aa9b', b: '#6d8778', border: '#e8f7ef', accent: '#7ff0b4', glow: 'rgba(127, 240, 180, 0.22)' },
      yellow: { a: '#aca27f', b: '#887c5c', border: '#fcf2d6', accent: '#ffd86a', glow: 'rgba(255, 216, 106, 0.24)' },
      white: { a: '#98a5b5', b: '#727f92', border: '#f4f7fb', accent: '#8eefff', glow: 'rgba(142, 239, 255, 0.20)' }
    };

    if (palette && palettes[palette]) return palettes[palette];
    if (heavy) {
      return { a: '#8b99ab', b: '#65758a', border: '#eef4f9', accent: '#b8d7ef', glow: 'rgba(184, 215, 239, 0.20)' };
    }
    return { a: '#8998ab', b: '#64748a', border: '#e7eff8', accent: '#78e9ff', glow: 'rgba(120, 233, 255, 0.18)' };
  },

  _drawDoorLockDots(px, py, width, height, axis, color) {
    const dots = axis === 'vertical'
      ? [[px + 3.5, py + height / 2], [px + width - 3.5, py + height / 2]]
      : [[px + width / 2, py + 3.5], [px + width / 2, py + height - 3.5]];

    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = 'rgba(10, 16, 24, 0.9)';
    this.ctx.lineWidth = 0.8;
    for (const [dx, dy] of dots) {
      this.ctx.beginPath();
      this.ctx.arc(dx, dy, 1.8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    }
    this.ctx.restore();
  },

  _inferDoorAxis(obj, cell = 20) {
    const objectId = String(obj?.objectId || '');
    if (objectId.endsWith('_h')) return 'horizontal';
    if (objectId.endsWith('_v')) return 'vertical';

    const pf = window.pathfindingSystem;
    const gx = Math.round(((obj?.x || 0) - cell / 2) / cell);
    const gy = Math.round(((obj?.y || 0) - cell / 2) / cell);
    const isWall = (x, y) => pf?._classifyHullCell?.(x, y) === 'wall';

    const leftWall = isWall(gx - 1, gy);
    const rightWall = isWall(gx + 1, gy);
    const upWall = isWall(gx, gy - 1);
    const downWall = isWall(gx, gy + 1);

    if ((upWall || downWall) && !(leftWall || rightWall)) return 'vertical';
    if ((leftWall || rightWall) && !(upWall || downWall)) return 'horizontal';
    return 'vertical';
  },

  _getDoorRenderBox(obj, left, top, cell = 20) {
    const axis = this._inferDoorAxis(obj, cell);
    const gx = Math.round(left / cell);
    const gy = Math.round(top / cell);
    const pf = window.pathfindingSystem;
    const isWall = (x, y) => pf?._classifyHullCell?.(x, y) === 'wall';

    let dx = 0;
    let dy = 0;
    if (axis === 'vertical') {
      if (isWall(gx, gy - 1) && !isWall(gx, gy + 1)) dy = -1;
      else if (isWall(gx, gy + 1)) dy = 1;
      else dy = 1;
    } else {
      if (isWall(gx - 1, gy) && !isWall(gx + 1, gy)) dx = -1;
      else if (isWall(gx + 1, gy)) dx = 1;
      else dx = 1;
    }

    const startX = Math.min(gx, gx + dx) * cell;
    const startY = Math.min(gy, gy + dy) * cell;
    return {
      axis,
      left: startX,
      top: startY,
      width: axis === 'horizontal' ? cell * 2 : cell,
      height: axis === 'vertical' ? cell * 2 : cell,
    };
  },

  _drawInnerDoorCell(px, py, width, height, axis = 'vertical', isOpen = false, options = {}) {
    const { heavy = false, palette = null, showLockDots = false } = options;
    const tone = this._getDoorVisualTone(palette, heavy);
    const ctx = this.ctx;
    if (!ctx) return;

    const band = Math.max(6, Math.round((axis === 'vertical' ? width : height) / 3));
    const leafLength = Math.max(8, Math.floor((axis === 'vertical' ? height : width) / 4));

    const drawLeaf = (x, y, w, h) => {
      const grad = ctx.createLinearGradient(x, y, x + (axis === 'horizontal' ? w : 0), y + (axis === 'vertical' ? h : 0));
      grad.addColorStop(0, tone.a);
      grad.addColorStop(1, tone.b);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = tone.border;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
    };

    ctx.save();
    ctx.fillStyle = 'rgba(96, 110, 126, 0.34)';
    ctx.fillRect(px + 1, py + 1, width - 2, height - 2);
    ctx.strokeStyle = 'rgba(210, 224, 236, 0.18)';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(px + 1.5, py + 1.5, width - 3, height - 3);

    ctx.fillStyle = heavy ? 'rgba(54, 68, 82, 0.72)' : 'rgba(42, 56, 70, 0.62)';

    if (axis === 'vertical') {
      const centerX = px + Math.floor(width / 2) - Math.floor(band / 2);
      ctx.fillRect(centerX, py + 1, band, 5);
      ctx.fillRect(centerX, py + height - 6, band, 5);

      if (isOpen) {
        drawLeaf(centerX, py + 2, band, 1);
        drawLeaf(centerX, py + height - 3, band, 1);
        ctx.fillStyle = 'rgba(150, 228, 255, 0.10)';
        ctx.fillRect(centerX, py + 4, band, height - 8);
      } else {
        const centerY = py + Math.floor(height / 2);
        drawLeaf(centerX, centerY - leafLength, band, leafLength - 1);
        drawLeaf(centerX, centerY + 1, band, leafLength - 1);
        ctx.fillStyle = 'rgba(240, 246, 252, 0.22)';
        ctx.fillRect(centerX + 1, py + 4, Math.max(1, band - 2), 1);
      }
    } else {
      const centerY = py + Math.floor(height / 2) - Math.floor(band / 2);
      ctx.fillRect(px + 1, centerY, 5, band);
      ctx.fillRect(px + width - 6, centerY, 5, band);

      if (isOpen) {
        drawLeaf(px + 2, centerY, 1, band);
        drawLeaf(px + width - 3, centerY, 1, band);
        ctx.fillStyle = 'rgba(150, 228, 255, 0.10)';
        ctx.fillRect(px + 4, centerY, width - 8, band);
      } else {
        const centerX = px + Math.floor(width / 2);
        drawLeaf(centerX - leafLength, centerY, leafLength - 1, band);
        drawLeaf(centerX + 1, centerY, leafLength - 1, band);
        ctx.fillStyle = 'rgba(240, 246, 252, 0.22)';
        ctx.fillRect(px + 4, centerY + 1, 1, Math.max(1, band - 2));
      }
    }

    if (showLockDots) {
      this._drawDoorLockDots(px, py, width, height, axis, tone.accent);
    }

    ctx.restore();
  },

  _drawChestCell(px, py, width, height, isOpen = false, options = {}) {
    const ctx = this.ctx;
    if (!ctx) return;

    const { accent = '#7cefff', accentDark = '#5a7d91' } = options;

    // Debug log
    if (this._lastChestDrawState !== isOpen) {
      this._lastChestDrawState = isOpen;
      console.log('%c🧰 _drawChestCell:', `color:${isOpen ? '#00ff88' : '#ff9900'};font-weight:bold`, {
        isOpen,
        pos: { x: px, y: py },
        size: { w: width, h: height }
      });
    }

    ctx.save();

    // ОТКРЫТЫЙ СУНДУК - просто белый квадрат
    if (isOpen) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px, py, width, height);
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, width, height);
      ctx.restore();
      return;
    }

    // ЗАКРЫТЫЙ СУНДУК - как было
    const halfW = Math.ceil(width / 2);
    const lidW = halfW + 2;
    const lidH = Math.max(6, Math.floor(height * 0.34));
    const bodyTop = py + 7;
    const bodyH = Math.max(8, height - 9);
    const cavityX = px + 3;
    const cavityY = py + 5;
    const cavityW = width - 6;
    const cavityH = height - 8;

    const roundedRectPath = (x, y, w, h, radius = 3) => {
      const r = Math.max(1, Math.min(radius, Math.floor(w / 2), Math.floor(h / 2)));
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    const drawLid = (x, y) => {
      roundedRectPath(x, y, lidW, lidH, 2);
      const lidGrad = ctx.createLinearGradient(x, y, x, y + lidH);
      lidGrad.addColorStop(0, '#f4fbff');
      lidGrad.addColorStop(1, '#b8cad8');
      ctx.fillStyle = lidGrad;
      ctx.fill();
      ctx.strokeStyle = '#7f95a8';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(x + 1, y + 1, lidW - 2, 1);
    };

    roundedRectPath(px + 1.5, py + 2, width - 3, height - 4, 3);
    const shellGrad = ctx.createLinearGradient(px, py + 2, px, py + height - 1);
    shellGrad.addColorStop(0, '#eef6fb');
    shellGrad.addColorStop(1, '#9fb2c4');
    ctx.fillStyle = shellGrad;
    ctx.fill();
    ctx.strokeStyle = '#f5fbff';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    if (typeof this._drawPixelSpriteToContext === 'function') {
      this._drawPixelSpriteToContext(ctx, 'ui_chest_closed', px, py, width, height);
    }
    ctx.fillStyle = accent;
    ctx.fillRect(px + 5, py + height - 6, width - 10, 1.5);
    ctx.fillStyle = accentDark;
    ctx.fillRect(px + Math.floor(width / 2) - 1, py + 7, 2, 3);
    ctx.fillRect(px + 4, py + height - 4, width - 8, 2);
    ctx.strokeStyle = accentDark;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(px + 2.5, py + 2.5, width - 5, height - 5);
    ctx.restore();
  }
  },

  _drawRecognizableObject(objectId, left, top, w, h, options = {}) {
    const ctx = this.ctx;
    if (!ctx) return false;

    const roundedRectPath = (x, y, width, height, radius = 3) => {
      const r = Math.max(1, Math.min(radius, Math.floor(width / 2), Math.floor(height / 2)));
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    switch (objectId) {
      case 'crate_large': {
        ctx.save();
        const bodyGrad = ctx.createLinearGradient(left + 2, top + 3, left + 2, top + h - 3);
        bodyGrad.addColorStop(0, '#b7c6d3');
        bodyGrad.addColorStop(1, '#70859a');
        roundedRectPath(left + 2, top + 3, w - 4, h - 6, 2);
        ctx.fillStyle = bodyGrad;
        ctx.fill();
        ctx.strokeStyle = '#edf3f8';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#506477';
        ctx.fillRect(left + 4, top + 5, w - 8, 2);
        ctx.fillRect(left + 4, top + Math.floor(h / 2), w - 8, 1.5);
        ctx.fillRect(left + Math.floor(w / 2) - 0.75, top + 6, 1.5, h - 10);
        ctx.fillStyle = '#eaf2f8';
        ctx.fillRect(left + 5, top + 4, w - 10, 1);
        ctx.fillStyle = '#7cf1ff';
        ctx.fillRect(left + Math.floor(w / 2) - 1, top + Math.floor(h / 2) + 2, 2, 2);
        ctx.restore();
        return true;
      }
      case 'chair': {
        ctx.save();
        ctx.fillStyle = '#9db4c7';
        ctx.fillRect(left + 5, top + 7, 2, 9);
        ctx.fillRect(left + 13, top + 7, 2, 9);
        roundedRectPath(left + 5, top + 3, 10, 4, 2);
        ctx.fillStyle = '#90a7bb';
        ctx.fill();
        ctx.strokeStyle = '#edf4fa';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        roundedRectPath(left + 4, top + 8, 12, 5, 2);
        ctx.fillStyle = '#7897af';
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#6d879c';
        ctx.fillRect(left + 5, top + 7, 2, 2);
        ctx.fillRect(left + 13, top + 7, 2, 2);
        ctx.fillStyle = '#77efff';
        ctx.fillRect(left + 7, top + 9, 6, 1.5);
        ctx.restore();
        return true;
      }
      case 'table': {
        ctx.save();
        const topInset = 2;
        const topHeight = Math.min(h - 3, Math.max(17, Math.floor(h * 0.86)));
        const legTop = top + topInset + topHeight - 1;
        const legHeight = Math.max(1, Math.round((h - topHeight - 2) / 4));
        ctx.fillStyle = '#9eb4c7';
        ctx.fillRect(left + 4, legTop, 2, legHeight);
        ctx.fillRect(left + w - 6, legTop, 2, legHeight);
        ctx.fillStyle = '#7f97ab';
        ctx.fillRect(left + 3, legTop + legHeight, w - 6, 1);
        roundedRectPath(left + 2, top + topInset, w - 4, topHeight, 2);
        const deskGrad = ctx.createLinearGradient(left + 2, top + topInset, left + 2, top + topInset + topHeight);
        deskGrad.addColorStop(0, '#dce7ef');
        deskGrad.addColorStop(1, '#9fb3c3');
        ctx.fillStyle = deskGrad;
        ctx.fill();
        ctx.strokeStyle = '#eef5fa';
        ctx.lineWidth = 0.9;
        ctx.stroke();

        ctx.fillStyle = '#6f889d';
        ctx.fillRect(left + 4, top + topInset + 2, w - 8, 1.5);
        ctx.fillStyle = '#77efff';
        ctx.fillRect(left + 5, top + topInset + 5, w - 10, 1.5);
        ctx.restore();
        return true;
      }
      case 'crate_small':
      case 'chest_red':
      case 'chest_green':
      case 'chest_blue':
      case 'chest_yellow':
      case 'chest_white': {
        const isOpen = !!options.isOpen;
        const paletteByObject = {
          crate_small: ['#7cefff', '#5a7d91'],
          chest_red: ['#ff9ea3', '#d26870'],
          chest_green: ['#8df2c4', '#4f9f79'],
          chest_blue: ['#8fd6ff', '#5d8fbb'],
          chest_yellow: ['#ffe08d', '#c79f4d'],
          chest_white: ['#dff5ff', '#97b3c5'],
        };
        const [accent, accentDark] = paletteByObject[objectId] || paletteByObject.crate_small;
        console.log('%c📦 _drawRecognizableObject chest:', 'color:#ff6b6b;font-weight:bold', {
          objectId,
          isOpen,
          options
        });
        this._drawChestCell(left, top, w, h, isOpen, { accent, accentDark });
        return true;
      }
      default:
        return false;
    }
  },

  _getContainerOpenProgress(containerId, isOpen) {
    this._containerAnimState = this._containerAnimState || {};
    const now = Date.now();
    const target = isOpen ? 1 : 0;
    let entry = this._containerAnimState[containerId];

    if (!entry) {
      entry = { from: target, to: target, startedAt: now };
      this._containerAnimState[containerId] = entry;
      return target;
    }

    const elapsed = Math.min(1, (now - entry.startedAt) / 220);
    const eased = elapsed * (2 - elapsed);
    const current = entry.from + (entry.to - entry.from) * eased;

    if (entry.to !== target) {
      entry = { from: current, to: target, startedAt: now };
      this._containerAnimState[containerId] = entry;
      return Math.max(0, Math.min(1, current));
    }

    if (elapsed >= 1) {
      this._containerAnimState[containerId] = { from: target, to: target, startedAt: now };
      return target;
    }

    return Math.max(0, Math.min(1, current));
  },

  
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

  
  renderMapObject(obj) {
    if (!this.ctx || !obj) return;

    try {
      const CELL = 20;
     
      const w = Math.round((obj.width  || 20) / CELL) * CELL;
      const h = Math.round((obj.height || 20) / CELL) * CELL;
     
      const left = Math.round((obj.x - w / 2) / CELL) * CELL;
      const top  = Math.round((obj.y - h / 2) / CELL) * CELL;
      const cx = left + w / 2;
      const cy = top  + h / 2;

      const gameState = window.getGameState?.();
      const doorInfo = this._getDoorRenderBox(obj, left, top, CELL);
      const isContainerObject = !!(obj.isContainer || obj.objectId === 'crate_small' || String(obj.objectId || '').startsWith('chest_'));

     
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

     
      if (
        obj.objectId === 'door_inner_v' || obj.objectId === 'door_inner_h' ||
        obj.objectId === 'airlock_door_v' || obj.objectId === 'airlock_door_h' ||
        String(obj.objectId || '').startsWith('door_color_')
      ) {
        const flagKey = `door_open_${obj.id}`;
        const isOpen = !!gameState?.world?.flags?.[flagKey];
        const heavy = obj.objectId === 'airlock_door_v' || obj.objectId === 'airlock_door_h';
        const palette = String(obj.objectId || '').startsWith('door_color_')
          ? obj.objectId.replace('door_color_', '')
          : null;
        this._drawInnerDoorCell(doorInfo.left, doorInfo.top, doorInfo.width, doorInfo.height, doorInfo.axis, isOpen, {
          heavy,
          palette,
          showLockDots: !!palette,
        });
        return;
      }

     
      if (obj.objectId === 'door_locked') {
        const lockedOpen = gameState?.world?.flags?.door_locked_open || false;
        this._drawInnerDoorCell(doorInfo.left, doorInfo.top, doorInfo.width, doorInfo.height, doorInfo.axis, lockedOpen, {
          palette: 'yellow',
          showLockDots: true,
        });
        const lockName = this._t(`objects.object_door_locked`, 'pt');
        this.ctx.fillStyle = '#FF8888';
        this.ctx.font = '8px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(lockName, (doorInfo?.left ?? left) + (doorInfo?.width ?? w) / 2, top - 3);
        this.ctx.textAlign = 'left';
        return;
      }

     
      if (obj.objectId === 'door') {
        const doorOpen = gameState?.world?.flags?.door_open || false;
        this._drawInnerDoorCell(doorInfo.left, doorInfo.top, doorInfo.width, doorInfo.height, doorInfo.axis, doorOpen, {
          showLockDots: false,
        });
        const doorName = this._t(`objects.object_door`, 'pt');
        this.ctx.fillStyle = '#FFFF00';
        this.ctx.font = '9px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(doorName, (doorInfo?.left ?? left) + (doorInfo?.width ?? w) / 2, top - 3);
        this.ctx.textAlign = 'left';
        return;
      }

     
      if (isContainerObject) {
        const flagKey = `container_open_${obj.id}`;
        const isOpen = !!gameState?.world?.flags?.[flagKey];

        console.log('%c🎯 renderMapObject CONTAINER:', 'color:#ffd700;font-weight:bold', {
          id: obj.id,
          objectId: obj.objectId,
          flagKey,
          isOpen,
          flagValue: gameState?.world?.flags?.[flagKey]
        });

        const itemCount = (gameState?.world?.surfaceItems?.[obj.id] || []).length;

        this._drawRecognizableObject(obj.objectId, left, top, w, h, { isOpen });

        if (isOpen && gameState) {
          const items = (gameState.world.surfaceItems?.[obj.id] || []).slice(0, 2);
          if (items.length > 0) {
            const iconSize = Math.max(7, Math.round(Math.min(w, h) * 0.36));
            const cavityX = left + 6;
            const cavityY = top + 7;
            const cavityW = Math.max(4, w - 12);
            const cavityH = Math.max(4, h - 9);

            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.rect(cavityX, cavityY, cavityW, cavityH);
            this.ctx.clip();

            items.forEach((itemId, idx) => {
              const offsetX = items.length > 1 ? (idx === 0 ? -iconSize * 0.45 : iconSize * 0.15) : -iconSize * 0.1;
              const drawItemX = cx + offsetX - iconSize / 2;
              const drawItemY = cavityY + cavityH - iconSize - 1 - (idx % 2);
              this.ctx.fillStyle = 'rgba(124, 236, 255, 0.18)';
              this.ctx.fillRect(drawItemX - 1, drawItemY + iconSize - 3, iconSize + 2, 2);
              this.drawPixelSprite(`item_${itemId}`, drawItemX, drawItemY, iconSize, iconSize);
              this.worldItemHoverRects.push({ itemId, x: drawItemX, y: drawItemY, width: iconSize, height: iconSize });
            });

            this.ctx.restore();
          }
        }

        const containerName = this._t(`objects.object_${obj.objectId}`, 'pt');
        const openShort = this._t('ui.open_short') || 'OPEN';
        this.ctx.textAlign = 'center';

        if (isOpen) {
          this.ctx.font = 'bold 12px Arial';
          const badgeText = `${openShort}`;
          const badgeWidth = this.ctx.measureText(badgeText).width + 8;
          this.ctx.fillStyle = 'rgba(0, 20, 0, 0.88)';
          this.ctx.fillRect(cx - badgeWidth / 2, top - 26, badgeWidth, 14);
          this.ctx.strokeStyle = '#00ff88';
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(cx - badgeWidth / 2, top - 26, badgeWidth, 14);
          this.ctx.fillStyle = '#00ff88';
          this.ctx.fillText(badgeText, cx, top - 15);
        }

        this.ctx.fillStyle = isOpen ? '#7df7a1' : '#FFFF00';
        this.ctx.font = '9px Arial';
        this.ctx.fillText(containerName, cx, top - 3);
        this.ctx.textAlign = 'left';
        return;
      }

     
      const renderedCustomObject = this._drawRecognizableObject(obj.objectId, left, top, w, h, {});
      if (!renderedCustomObject) {
       
        this.ctx.strokeStyle = obj.isSurface ? 'rgba(136,221,255,0.35)' : 'rgba(255,215,0,0.25)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);

        this.drawPixelSprite(`object_${obj.objectId}`, left, top, w, h);
      }

     
      const objName = this._t(`objects.object_${obj.objectId}`, 'pt');
      this.ctx.fillStyle = '#FFFF00';
      this.ctx.font = '9px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(objName, cx, top - 3);
      this.ctx.textAlign = 'left';

     
      if (obj.isSurface && gameState) {
        const items = gameState.world.surfaceItems?.[obj.id] || [];
        const CELL2 = CELL;
        items.forEach((itemId, idx) => {
         
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

  _getPlayerFacingAngleFromPlayer(playerData) {
    const waypoint = playerData?.pathWaypoints?.[playerData.currentWaypoint || 0] || null;
    const targetX = waypoint?.x ?? playerData?.targetX;
    const targetY = waypoint?.y ?? playerData?.targetY;
    const px = playerData?.x ?? 0;
    const py = playerData?.y ?? 0;

    if (typeof targetX === 'number' && typeof targetY === 'number') {
      const dx = targetX - px;
      const dy = targetY - py;
      if (Math.abs(dx) > 0.35 || Math.abs(dy) > 0.35) {
        return Math.atan2(dy, dx);
      }
    }

    return this._getPlayerFacingAngle(this._getPlayerFacingDirection(playerData));
  },

  _drawPlayerVisionCone(centerX, centerY, facingOrAngle) {
    if (!this.ctx) return;
    const angle = typeof facingOrAngle === 'number'
      ? facingOrAngle
      : this._getPlayerFacingAngle(facingOrAngle);
    const spread = (100 * Math.PI) / 180;
    const radius = 14 * 20;
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

  _isPlayerMoving(playerData) {
    const waypoint = playerData?.pathWaypoints?.[playerData.currentWaypoint || 0] || null;
    const targetX = waypoint?.x ?? playerData?.targetX ?? playerData?.x ?? 0;
    const targetY = waypoint?.y ?? playerData?.targetY ?? playerData?.y ?? 0;
    const px = playerData?.x ?? 0;
    const py = playerData?.y ?? 0;

    return Math.abs(targetX - px) > 0.35 || Math.abs(targetY - py) > 0.35;
  },

  _drawPlayerTopDown(centerX, centerY, size, facing = 'up', isMoving = false, playerData = null) {
    const ctx = this.ctx;
    if (!ctx) return;

    const unit = Math.max(1, Math.round(size / 10));
    const step = isMoving ? (Math.sin(Date.now() / 120) >= 0 ? 1 : -1) : 0;
    const armA = Math.max(0, step);
    const armB = Math.max(0, -step);
    const legA = Math.max(0, -step);
    const legB = Math.max(0, step);
    const prevSmoothing = ctx.imageSmoothingEnabled;
    const isEngineerSuit = !!playerData?.engineerSuit;
    const colors = isEngineerSuit ? {
      skin: '#e7bd9b',
      skinShade: '#c89674',
      suitLight: '#eef3f8',
      suit: '#c5d2dd',
      suitDark: '#778b9c',
      accent: '#9fe6ff',
      limb: '#8ea2b4',
      boot: '#314050',
      pack: '#5a6d7d'
    } : {
      skin: '#e7bd9b',
      skinShade: '#c89674',
      suitLight: '#7fb4ff',
      suit: '#4e83d1',
      suitDark: '#2f5896',
      accent: '#9be8ff',
      limb: '#4d76b0',
      boot: '#1f2e43',
      pack: '#29486d'
    };

    const px = (x, y, w, h, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(
        Math.round(centerX + (x - 4) * unit),
        Math.round(centerY + (y - 5) * unit),
        w * unit,
        h * unit
      );
    };

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (facing === 'up') {
      px(1, 4 + armA, 1, 2, colors.limb);
      px(6, 4 + armB, 1, 2, colors.limb);
      px(2, 0, 4, 1, colors.skinShade);
      px(1, 1, 6, 2, colors.skin);
      px(2, 3, 4, 1, colors.skinShade);
      px(1, 4, 6, 1, colors.suitLight);
      px(0, 5, 8, 1, colors.suit);
      px(1, 6, 6, 2, colors.suit);
      px(2, 5, 4, 2, colors.pack);
      px(2, 8 + legA, 2, 2, colors.boot);
      px(4, 8 + legB, 2, 2, colors.boot);
    } else if (facing === 'down') {
      px(1, 4 + armB, 1, 2, colors.limb);
      px(6, 4 + armA, 1, 2, colors.limb);
      px(2, 0, 4, 1, colors.skinShade);
      px(1, 1, 6, 2, colors.skin);
      px(2, 3, 4, 1, colors.skinShade);
      px(1, 4, 6, 1, colors.suitLight);
      px(0, 5, 8, 1, colors.suit);
      px(1, 6, 6, 2, colors.suit);
      px(3, 2, 1, 1, 'rgba(26, 40, 52, 0.40)');
      px(4, 2, 1, 1, 'rgba(26, 40, 52, 0.40)');
      px(3, 5, 2, 1, colors.accent);
      px(2, 8 + legB, 2, 2, colors.boot);
      px(4, 8 + legA, 2, 2, colors.boot);
    } else if (facing === 'left') {
      px(1, 4 + armA, 1, 2, colors.limb);
      px(5, 4 + armB, 1, 2, colors.pack);
      px(1, 1, 4, 3, colors.skin);
      px(0, 2, 1, 1, colors.skinShade);
      px(2, 4, 4, 1, colors.suitLight);
      px(1, 5, 5, 1, colors.suit);
      px(2, 6, 4, 2, colors.suit);
      px(4, 6, 2, 1, colors.suitDark);
      px(2, 8 + legA, 2, 2, colors.boot);
      px(4, 8 + legB, 2, 2, colors.boot);
      px(2, 5, 1, 1, colors.accent);
    } else {
      px(6, 4 + armA, 1, 2, colors.limb);
      px(2, 4 + armB, 1, 2, colors.pack);
      px(3, 1, 4, 3, colors.skin);
      px(7, 2, 1, 1, colors.skinShade);
      px(2, 4, 4, 1, colors.suitLight);
      px(2, 5, 5, 1, colors.suit);
      px(2, 6, 4, 2, colors.suit);
      px(2, 6, 2, 1, colors.suitDark);
      px(2, 8 + legB, 2, 2, colors.boot);
      px(4, 8 + legA, 2, 2, colors.boot);
      px(5, 5, 1, 1, colors.accent);
    }

    ctx.restore();
    ctx.imageSmoothingEnabled = prevSmoothing;
  },

  
  renderPlayer(playerData) {
    if (!this.ctx || !playerData) return;
    
    try {
      window.updatePlayerMovement?.(playerData);

      playerData = window.getGameState?.().player;
      const x = playerData.x ?? 100;
      const y = playerData.y ?? 100;
      const facing = this._getPlayerFacingDirection(playerData);
      const facingAngle = this._getPlayerFacingAngleFromPlayer(playerData);
      const isMoving = this._isPlayerMoving(playerData);

      const CELL = 20;
      const drawX = x - CELL / 2;
      const drawY = y - CELL / 2;

      this._drawPlayerVisionCone(x, y, facingAngle);

      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      this.ctx.beginPath();
      this.ctx.ellipse(drawX + CELL / 2, drawY + CELL - 1, CELL / 2.5, 2.4, 0, 0, Math.PI * 2);
      this.ctx.fill();

      this._drawPlayerTopDown(x, y, CELL, facing, isMoving, playerData);

    } catch (error) {
      console.error(error);
    }
  },

  
  renderWorldObjects(objects) {
    if (!this.ctx || !objects || objects.length === 0) return;

    try {
      objects.forEach(obj => {
       
        if (obj.taken) return;

        this.renderWorldObject(obj);
      });
    } catch (error) {
      console.error(error);
    }
  },

  
  renderWorldObject(obj) {
    if (!this.ctx || !obj) return;

    try {
      const CELL = 20;
     
      const gx = Math.floor((obj.x || 0) / CELL);
      const gy = Math.floor((obj.y || 0) / CELL);
      const cellX = gx * CELL;
      const cellY = gy * CELL;

     
      this.ctx.fillStyle = 'rgba(122, 255, 122, 0.12)';
      this.ctx.beginPath();
      this.ctx.ellipse(cellX + CELL / 2, cellY + CELL - 1, CELL / 2.2, 2.5, 0, 0, Math.PI * 2);
      this.ctx.fill();

      this.drawPixelSprite(`item_${obj.itemId}`, cellX, cellY, CELL, CELL);

     
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

  
  renderDebugGrid(gameState) {
    if (!this.ctx) return;

    const CELL = 20;
    const { x0, y0, x1, y1 } = this._visibleCellRange();

   
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
