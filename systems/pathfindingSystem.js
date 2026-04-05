class PathfindingSystem {
  constructor() {
    this.GRID_SIZE = 20;
    this.GRID_COLS = 80;  
    this.GRID_ROWS = 130; 
    this._shipCfg = null; 
    this._walkableGridCache = null;
  }

  
  loadMapData(mapData) {
    if (!mapData) return;
    if (mapData.worldGrid) {
      this.GRID_COLS = mapData.worldGrid.cols || 80;
      this.GRID_ROWS = mapData.worldGrid.rows || 130;
    }
    this._shipCfg = mapData.ship || null;
  }

  
  _classifyHullCell(cx, cy) {
    const cfg = this._shipCfg;
    if (!cfg) return 'floor';
    const { hullLeft: L, hullRight: R, noseBaseRow: NB,
            hullBottom: BOT, noseCX: NCX, noseCY: NCY, noseRadius: NR } = cfg;

    if (cx < 0 || cx >= this.GRID_COLS || cy < 0 || cy > BOT) return 'space';

    if (cy <= NB) {
     
      const d = Math.sqrt((cx - NCX) * (cx - NCX) + (cy - NCY) * (cy - NCY));
      if (d > NR) return 'space';
      if (d >= NR - 1) return 'wall';
      return 'floor';
    }

   
    if (cx < L || cx > R) return 'space';
    if (cx === L || cx === R || cy === BOT) return 'wall';
    return 'floor';
  }

  
  posToGrid(x, y) {
    return {
      x: Math.floor(x / this.GRID_SIZE),
      y: Math.floor(y / this.GRID_SIZE)
    };
  }

  
  gridToPos(gx, gy) {
    return {
      x: gx * this.GRID_SIZE + this.GRID_SIZE / 2,
      y: gy * this.GRID_SIZE + this.GRID_SIZE / 2
    };
  }

  _getObjectGridBounds(obj) {
    if (typeof window !== 'undefined' && typeof window.getMapObjectGridBounds === 'function') {
      return window.getMapObjectGridBounds(obj, this.GRID_SIZE);
    }

    const widthCells = Math.max(1, Math.round((obj?.width || this.GRID_SIZE) / this.GRID_SIZE));
    const heightCells = Math.max(1, Math.round((obj?.height || this.GRID_SIZE) / this.GRID_SIZE));
    const left = Math.round(((obj?.x || 0) - (widthCells * this.GRID_SIZE) / 2) / this.GRID_SIZE);
    const top = Math.round(((obj?.y || 0) - (heightCells * this.GRID_SIZE) / 2) / this.GRID_SIZE);
    return {
      left,
      top,
      right: left + widthCells - 1,
      bottom: top + heightCells - 1,
      width: widthCells,
      height: heightCells,
    };
  }

  _doorStateSignature(gameState) {
    const flags = gameState?.world?.flags || {};
    return Object.keys(flags)
      .filter(key => !!flags[key] && (key === 'door_open' || key === 'door_locked_open' || key.startsWith('door_open_')))
      .sort()
      .join('|');
  }

  _removedWallsSignature(gameState) {
    const removedWalls = gameState?.world?.flags?.creative_removed_walls || [];
    return Array.isArray(removedWalls) ? removedWalls.join('|') : '';
  }

  
  isWalkable(gx, gy, gameState) {
    if (gx < 0 || gx >= this.GRID_COLS || gy < 0 || gy >= this.GRID_ROWS) {
      return false;
    }

    for (const obj of gameState.world.mapObjects || []) {
      const isDoorObj = obj.objectId === 'door' ||
        obj.objectId === 'door_locked' ||
        obj.objectId === 'door_inner_v' ||
        obj.objectId === 'door_inner_h' ||
        obj.objectId === 'airlock_door_v' ||
        obj.objectId === 'airlock_door_h' ||
        String(obj.objectId || '').startsWith('door_color_');
      const isOpen = (obj.objectId === 'door' && gameState.world.flags?.door_open) ||
        (obj.objectId === 'door_locked' && gameState.world.flags?.door_locked_open) ||
        ((obj.objectId === 'door_inner_v' || obj.objectId === 'door_inner_h' || obj.objectId === 'airlock_door_v' || obj.objectId === 'airlock_door_h' || String(obj.objectId || '').startsWith('door_color_')) && gameState.world.flags?.[`door_open_${obj.id}`]);
      if (isDoorObj && isOpen) continue;

      const bounds = this._getObjectGridBounds(obj);
      if (gx >= bounds.left && gx <= bounds.right && gy >= bounds.top && gy <= bounds.bottom) {
        return false;
      }
    }

    for (const obj of gameState.world.objects || []) {
      if (obj.taken) continue;

      const objGrid = this.posToGrid(obj.x, obj.y);
      if (gx === objGrid.x && gy === objGrid.y) {
        return false;
      }
    }

    return true;
  }

  
  buildWalkableGrid(gameState, excludeItemId = null) {
    const mapObjectsRef = gameState?.world?.mapObjects || [];
    const worldObjectsRef = gameState?.world?.objects || [];
    const doorSignature = this._doorStateSignature(gameState);
    const removedWallsSignature = this._removedWallsSignature(gameState);
    const excludeKey = excludeItemId || null;

    if (
      this._walkableGridCache &&
      this._walkableGridCache.mapObjectsRef === mapObjectsRef &&
      this._walkableGridCache.worldObjectsRef === worldObjectsRef &&
      this._walkableGridCache.doorSignature === doorSignature &&
      this._walkableGridCache.removedWallsSignature === removedWallsSignature &&
      this._walkableGridCache.excludeItemId === excludeKey
    ) {
      return this._walkableGridCache.grid;
    }

    const total = this.GRID_COLS * this.GRID_ROWS;
    const grid = new Uint8Array(total).fill(0);

    for (let gy = 0; gy < this.GRID_ROWS; gy++) {
      for (let gx = 0; gx < this.GRID_COLS; gx++) {
        if (this._classifyHullCell(gx, gy) === 'floor') {
          grid[gy * this.GRID_COLS + gx] = 1;
        }
      }
    }

    for (const obj of mapObjectsRef) {
      const isDoorObj = obj.objectId === 'door' ||
        obj.objectId === 'door_locked' ||
        obj.objectId === 'door_inner_v' ||
        obj.objectId === 'door_inner_h' ||
        obj.objectId === 'airlock_door_v' ||
        obj.objectId === 'airlock_door_h' ||
        String(obj.objectId || '').startsWith('door_color_');
      const isOpen = (obj.objectId === 'door' && gameState.world.flags?.door_open) ||
        (obj.objectId === 'door_locked' && gameState.world.flags?.door_locked_open) ||
        ((obj.objectId === 'door_inner_v' || obj.objectId === 'door_inner_h' || obj.objectId === 'airlock_door_v' || obj.objectId === 'airlock_door_h' || String(obj.objectId || '').startsWith('door_color_')) && gameState.world.flags?.[`door_open_${obj.id}`]);
      if (isDoorObj && isOpen) continue;

      const bounds = this._getObjectGridBounds(obj);
      for (let gx = bounds.left; gx <= bounds.right; gx++) {
        for (let gy = bounds.top; gy <= bounds.bottom; gy++) {
          if (gx >= 0 && gx < this.GRID_COLS && gy >= 0 && gy < this.GRID_ROWS) {
            grid[gy * this.GRID_COLS + gx] = 0;
          }
        }
      }
    }

    for (const obj of worldObjectsRef) {
      if (obj.taken) continue;
      if (obj.itemId === excludeItemId) continue;
      const g = this.posToGrid(obj.x, obj.y);
      if (g.x >= 0 && g.x < this.GRID_COLS && g.y >= 0 && g.y < this.GRID_ROWS) {
        grid[g.y * this.GRID_COLS + g.x] = 0;
      }
    }

    const removedWalls = gameState.world?.flags?.creative_removed_walls || [];
    for (const key of removedWalls) {
      const [gxRaw, gyRaw] = String(key).split(',');
      const gx = Number(gxRaw);
      const gy = Number(gyRaw);
      if (gx >= 0 && gx < this.GRID_COLS && gy >= 0 && gy < this.GRID_ROWS) {
        grid[gy * this.GRID_COLS + gx] = 1;
      }
    }

    this._walkableGridCache = {
      mapObjectsRef,
      worldObjectsRef,
      doorSignature,
      removedWallsSignature,
      excludeItemId: excludeKey,
      grid,
    };

    return grid;
  }

  
  findNearestWallCell(playerX, playerY) {
    const { x: startCX, y: startCY } = this.posToGrid(playerX, playerY);
    let best = null;
    let bestDist = Infinity;
    for (let r = 1; r <= 80; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const cx = startCX + dx;
          const cy = startCY + dy;
          if (this._classifyHullCell(cx, cy) !== 'wall') continue;
          const dist = Math.hypot(dx, dy);
          if (dist < bestDist) {
            bestDist = dist;
            best = this.gridToPos(cx, cy);
          }
        }
      }
      if (best) break;
    }
    return best;
  }

  
  findPath(startX, startY, goalX, goalY, gameState, excludeItemId = null) {
    const start = this.posToGrid(startX, startY);
    const goal = this.posToGrid(goalX, goalY);

   
    const walkable = this.buildWalkableGrid(gameState, excludeItemId);
    const isWalkableCell = (gx, gy) =>
      gx >= 0 && gx < this.GRID_COLS && gy >= 0 && gy < this.GRID_ROWS &&
      walkable[gy * this.GRID_COLS + gx] === 1;

   
   
   
    let actualGoal = goal;
    if (!isWalkableCell(goal.x, goal.y)) {
      let found = false;
      outer: for (let r = 1; r <= 15 && !found; r++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            const nx = goal.x + dx;
            const ny = goal.y + dy;
            if (isWalkableCell(nx, ny)) {
              actualGoal = { x: nx, y: ny };
              found = true;
              break outer;
            }
          }
        }
      }
    }

   
    if (start.x === actualGoal.x && start.y === actualGoal.y) {
      return [{x: startX, y: startY}];
    }

   
    const key = (x, y) => `${x},${y}`;
    const openSet = [[0, start.x, start.y]];
    const openSetKeys = new Set([key(start.x, start.y)]);
    const closedSet = new Set();
    const cameFrom = {};
    const gScore = { [key(start.x, start.y)]: 0 };
    let iterations = 0;
    const MAX_ITERATIONS = 5000;

    while (openSet.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++;

     
      let minIdx = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i][0] < openSet[minIdx][0]) minIdx = i;
      }

      const [, cx, cy] = openSet[minIdx];
     
      openSet.splice(minIdx, 1);
      const cKey = key(cx, cy);
      openSetKeys.delete(cKey);

      if (closedSet.has(cKey)) continue;
      closedSet.add(cKey);

     
      if (cx === actualGoal.x && cy === actualGoal.y) {
        const path = [];
        let c = cKey;
        while (cameFrom[c]) {
          c = cameFrom[c];
          const [x, y] = c.split(',').map(Number);
          path.unshift(this.gridToPos(x, y));
        }
        path.push(this.gridToPos(actualGoal.x, actualGoal.y));
        return path;
      }

     
      const dirs = [
        [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1]
      ];

      for (const [dx, dy, cost] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!isWalkableCell(nx, ny)) continue;

        const nKey = key(nx, ny);
        if (closedSet.has(nKey)) continue;

        const tentativeG = (gScore[cKey] || 0) + cost;
        if (!gScore[nKey] || tentativeG < gScore[nKey]) {
          cameFrom[nKey] = cKey;
          gScore[nKey] = tentativeG;
          const h = Math.abs(nx - actualGoal.x) + Math.abs(ny - actualGoal.y);
          const f = tentativeG + h;

          if (!openSetKeys.has(nKey)) {
            openSet.push([f, nx, ny]);
            openSetKeys.add(nKey);
          }
        }
      }
    }
    return null;
  }

  
  followPath(currentX, currentY, path, speed = 3) {
    if (!path || path.length === 0) {
      return { x: currentX, y: currentY, reachedGoal: true };
    }

    const [targetX, targetY] = path[0];
    const dx = targetX - currentX;
    const dy = targetY - currentY;
    const distance = Math.hypot(dx, dy);

    if (distance < speed) {
     
      path.shift();
      return this.followPath(currentX, currentY, path, speed);
    }

   
    const newX = currentX + (dx / distance) * speed;
    const newY = currentY + (dy / distance) * speed;

    return {
      x: newX,
      y: newY,
      reachedGoal: false,
      remainingPath: path
    };
  }
  
  findNearestFreeCell(playerX, playerY, gameState) {
    const CELL = this.GRID_SIZE;
    const cols = this.GRID_COLS;
    const rows = this.GRID_ROWS;
    const walkable = this.buildWalkableGrid(gameState);

   
    const occupiedByItems = new Set();
    for (const obj of gameState.world.objects || []) {
      if (!obj.taken) {
        const gx = Math.floor(obj.x / CELL);
        const gy = Math.floor(obj.y / CELL);
        occupiedByItems.add(`${gx},${gy}`);
      }
    }
   
   

    const startGx = Math.floor(playerX / CELL);
    const startGy = Math.floor(playerY / CELL);

   
    for (let radius = 1; radius <= 8; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
         
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const gx = startGx + dx;
          const gy = startGy + dy;
          if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
          if (walkable[gy * cols + gx] !== 1) continue;
          if (occupiedByItems.has(`${gx},${gy}`)) continue;
          return {
            gx, gy,
            x: gx * CELL + CELL / 2,
            y: gy * CELL + CELL / 2
          };
        }
      }
    }
    return null;
  }
}

const pathfindingSystem = new PathfindingSystem();
window.pathfindingSystem = pathfindingSystem;
