/**
 * /systems/pathfindingSystem.js
 * СИСТЕМА ПОИСКА ПУТИ НА СЕТКЕ (A*)
 * 
 * Простая реализация для Heroes III-подобной сетки
 * 20px = 1 клетка
 */

class PathfindingSystem {
  constructor() {
    this.GRID_SIZE = 20; // размер клетки в пикселях
    this.GRID_COLS = 80;   // ширина мира в клетках (обновляется из data/objects.json -> map)
    this.GRID_ROWS = 130;  // высота мира в клетках
    this._shipCfg = null;  // геометрия корпуса (из data/objects.json -> map)
  }

  /**
   * Загрузить данные карты (вызывается из bootstrap после fetch)
   */
  loadMapData(mapData) {
    if (!mapData) return;
    if (mapData.worldGrid) {
      this.GRID_COLS = mapData.worldGrid.cols || 80;
      this.GRID_ROWS = mapData.worldGrid.rows || 130;
    }
    this._shipCfg = mapData.ship || null;
  }

  /**
   * Классифицировать клетку по положению относительно корпуса корабля.
   * @returns {'floor'|'wall'|'space'}
   */
  _classifyHullCell(cx, cy) {
    const cfg = this._shipCfg;
    if (!cfg) return 'floor'; // если карта не загружена — всё проходимо
    const { hullLeft: L, hullRight: R, noseBaseRow: NB,
            hullBottom: BOT, noseCX: NCX, noseCY: NCY, noseRadius: NR } = cfg;

    if (cx < 0 || cx >= this.GRID_COLS || cy < 0 || cy > BOT) return 'space';

    if (cy <= NB) {
      // Зона носа: полукруглая верхушка
      const d = Math.sqrt((cx - NCX) * (cx - NCX) + (cy - NCY) * (cy - NCY));
      if (d > NR) return 'space';
      if (d >= NR - 1) return 'wall';
      return 'floor';
    }

    // Прямоугольная часть корпуса
    if (cx < L || cx > R) return 'space';
    if (cx === L || cx === R || cy === BOT) return 'wall';
    return 'floor';
  }

  /**
   * Получить индекс клетки по координатам
   */
  posToGrid(x, y) {
    return {
      x: Math.floor(x / this.GRID_SIZE),
      y: Math.floor(y / this.GRID_SIZE)
    };
  }

  /**
   * Получить координаты центра клетки по индексу
   */
  gridToPos(gx, gy) {
    return {
      x: gx * this.GRID_SIZE + this.GRID_SIZE / 2,
      y: gy * this.GRID_SIZE + this.GRID_SIZE / 2
    };
  }

  /**
   * Проверить занята ли клетка препятствием
   */
  isWalkable(gx, gy, gameState) {
    if (gx < 0 || gx >= this.GRID_COLS || gy < 0 || gy >= this.GRID_ROWS) {
      return false; // За пределами карты
    }

    // Проверяем объекты на карте (препятствия как дом, таблица, дверь)
    for (const obj of gameState.world.mapObjects || []) {
      const objGrid = this.posToGrid(obj.x, obj.y);
      const objWidthGrid = Math.ceil((obj.width || 60) / this.GRID_SIZE);
      const objHeightGrid = Math.ceil((obj.height || 40) / this.GRID_SIZE);
      
      // Границы объекта в сетке (объект центрирован)
      const minX = objGrid.x - Math.floor(objWidthGrid / 2);
      const maxX = objGrid.x + Math.ceil(objWidthGrid / 2);
      const minY = objGrid.y - Math.floor(objHeightGrid / 2);
      const maxY = objGrid.y + Math.ceil(objHeightGrid / 2);
      
      // Проверяем попадает ли клетка в область объекта
      if (gx >= minX && gx < maxX && gy >= minY && gy < maxY) {
        return false; // Препятствие здесь
      }
    }

    // Проверяем предметы в мире (items) - каждый занимает 1 клетку сетки
    for (const obj of gameState.world.objects || []) {
      if (obj.taken) continue; // Пропускаем уже взятые предметы
      
      const objGrid = this.posToGrid(obj.x, obj.y);
      
      // Предмет занимает одну клетку сетки
      if (gx === objGrid.x && gy === objGrid.y) {
        return false; // Здесь предмет
      }
    }

    return true; // Проходимо
  }

  /**
   * Предварительно вычислить сетку проходимости.
   * Непроходимы: пространство вне корпуса, стены, объекты карты, предметы на полу.
   * @param {object} gameState
   * @param {string|null} excludeItemId
   */
  buildWalkableGrid(gameState, excludeItemId = null) {
    const total = this.GRID_COLS * this.GRID_ROWS;
    const grid = new Uint8Array(total).fill(0); // 0 = непроходимо по умолчанию

    // 1. Отмечаем проходимые клетки на основе геометрии корпуса
    for (let gy = 0; gy < this.GRID_ROWS; gy++) {
      for (let gx = 0; gx < this.GRID_COLS; gx++) {
        if (this._classifyHullCell(gx, gy) === 'floor') {
          grid[gy * this.GRID_COLS + gx] = 1;
        }
      }
    }

    // 2. Объекты карты блокируют свои клетки (окна, двери и т.д.)
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
      const objGrid = this.posToGrid(obj.x, obj.y);
      const objWidthGrid = Math.ceil((obj.width || 20) / this.GRID_SIZE);
      const objHeightGrid = Math.ceil((obj.height || 20) / this.GRID_SIZE);
      const minX = objGrid.x - Math.floor(objWidthGrid / 2);
      const maxX = objGrid.x + Math.ceil(objWidthGrid / 2);
      const minY = objGrid.y - Math.floor(objHeightGrid / 2);
      const maxY = objGrid.y + Math.ceil(objHeightGrid / 2);
      for (let gx = minX; gx < maxX; gx++) {
        for (let gy = minY; gy < maxY; gy++) {
          if (gx >= 0 && gx < this.GRID_COLS && gy >= 0 && gy < this.GRID_ROWS) {
            grid[gy * this.GRID_COLS + gx] = 0;
          }
        }
      }
    }

    // 3. Предметы на полу блокируют одну клетку
    for (const obj of gameState.world.objects || []) {
      if (obj.taken) continue;
      if (obj.itemId === excludeItemId) continue;
      const g = this.posToGrid(obj.x, obj.y);
      if (g.x >= 0 && g.x < this.GRID_COLS && g.y >= 0 && g.y < this.GRID_ROWS) {
        grid[g.y * this.GRID_COLS + g.x] = 0;
      }
    }

    // 4. Runtime-правки creative-режима: удалённые клетки внешней стены корпуса.
    const removedWalls = gameState.world?.flags?.creative_removed_walls || [];
    for (const key of removedWalls) {
      const [gxRaw, gyRaw] = String(key).split(',');
      const gx = Number(gxRaw);
      const gy = Number(gyRaw);
      if (gx >= 0 && gx < this.GRID_COLS && gy >= 0 && gy < this.GRID_ROWS) {
        grid[gy * this.GRID_COLS + gx] = 1;
      }
    }

    return grid;
  }

  /**
   * Найти ближайшую клетку-стену корпуса корабля к позиции игрока.
   * Используется для команды "vai para a parede".
   * @returns {{x, y}|null} центр клетки в пикселях
   */
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

  /**
   * A* алгоритм поиска пути
   * @param {string|null} excludeItemId - предмет, который не считается препятствием
   */
  findPath(startX, startY, goalX, goalY, gameState, excludeItemId = null) {
    const start = this.posToGrid(startX, startY);
    const goal = this.posToGrid(goalX, goalY);

    // Строим кэш проходимости один раз (целевой предмет исключён из препятствий)
    const walkable = this.buildWalkableGrid(gameState, excludeItemId);
    const isWalkableCell = (gx, gy) =>
      gx >= 0 && gx < this.GRID_COLS && gy >= 0 && gy < this.GRID_ROWS &&
      walkable[gy * this.GRID_COLS + gx] === 1;

    // Если цель недостижима — расширяем поиск по радиусу до первой проходимой клетки.
    // Обычный поиск 8 соседей не работает для крупных объектов (дом 4×4 клетки:
    // все 8 соседей центра тоже внутри объекта). Расширяем до радиуса 15.
    let actualGoal = goal;
    if (!isWalkableCell(goal.x, goal.y)) {
      let found = false;
      outer: for (let r = 1; r <= 15 && !found; r++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // только граница радиуса
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

    // Уже на цели
    if (start.x === actualGoal.x && start.y === actualGoal.y) {
      return [{x: startX, y: startY}];
    }

    // A* — openSet хранит [f, x, y] для быстрой сортировки
    const key = (x, y) => `${x},${y}`;
    const openSet = [[0, start.x, start.y]];
    const openSetKeys = new Set([key(start.x, start.y)]); // O(1) проверка наличия
    const closedSet = new Set();
    const cameFrom = {};
    const gScore = { [key(start.x, start.y)]: 0 };
    let iterations = 0;
    const MAX_ITERATIONS = 2000;

    while (openSet.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++;

      // Находим клетку с минимальным f-score
      let minIdx = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i][0] < openSet[minIdx][0]) minIdx = i;
      }

      const [, cx, cy] = openSet[minIdx];
      // СНАЧАЛА удаляем из openSet, ПОТОМ проверяем closedSet
      openSet.splice(minIdx, 1);
      const cKey = key(cx, cy);
      openSetKeys.delete(cKey);

      if (closedSet.has(cKey)) continue;
      closedSet.add(cKey);

      // Достигли цели
      if (cx === actualGoal.x && cy === actualGoal.y) {
        const path = [];
        let c = cKey;
        while (cameFrom[c]) {
          c = cameFrom[c]; // переходим к родительскому ключу
          const [x, y] = c.split(',').map(Number);
          path.unshift(this.gridToPos(x, y));
        }
        path.push(this.gridToPos(actualGoal.x, actualGoal.y));
        return path;
      }

      // Соседи (8 направлений)
      const dirs = [
        [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
        [-1, -1, 1.4], [-1, 1, 1.4], [1, -1, 1.4], [1, 1, 1.4]
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
    return null; // Путь не найден — НЕ идём напрямую сквозь стены
  }

  /**
   * Следовать по пути
   */
  followPath(currentX, currentY, path, speed = 3) {
    if (!path || path.length === 0) {
      return { x: currentX, y: currentY, reachedGoal: true };
    }

    const [targetX, targetY] = path[0];
    const dx = targetX - currentX;
    const dy = targetY - currentY;
    const distance = Math.hypot(dx, dy);

    if (distance < speed) {
      // Прошли эту клетку, переходим к следующей
      path.shift();
      return this.followPath(currentX, currentY, path, speed);
    }

    // Движемся к текущей цели
    const newX = currentX + (dx / distance) * speed;
    const newY = currentY + (dy / distance) * speed;

    return {
      x: newX,
      y: newY,
      reachedGoal: false,
      remainingPath: path
    };
  }
  /**
   * Найти ближайшую свободную клетку относительно игрока.
   * Используется при выбрасывании предмета.
   * @param {number} playerX
   * @param {number} playerY
   * @param {object} gameState
   * @returns {{gx, gy, x, y}|null}
   */
  findNearestFreeCell(playerX, playerY, gameState) {
    const CELL = this.GRID_SIZE;
    const cols = this.GRID_COLS;
    const rows = this.GRID_ROWS;
    const walkable = this.buildWalkableGrid(gameState);

    // Занятые предметами клетки
    const occupiedByItems = new Set();
    for (const obj of gameState.world.objects || []) {
      if (!obj.taken) {
        const gx = Math.floor(obj.x / CELL);
        const gy = Math.floor(obj.y / CELL);
        occupiedByItems.add(`${gx},${gy}`);
      }
    }
    // Клетки с предметами на поверхностях не учитываем отдельно —
    // они лежат на непроходимых клетках, на землю не выпадают

    const startGx = Math.floor(playerX / CELL);
    const startGy = Math.floor(playerY / CELL);

    // Перебираем клетки по радиусу, начиная от 1
    for (let radius = 1; radius <= 8; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          // Только внешний периметр квадрата
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

// Глобальный экземпляр
const pathfindingSystem = new PathfindingSystem();
window.pathfindingSystem = pathfindingSystem;
