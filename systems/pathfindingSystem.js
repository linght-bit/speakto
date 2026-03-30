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
    this.CANVAS_WIDTH = 800;
    this.CANVAS_HEIGHT = 600;
    this.GRID_COLS = Math.ceil(this.CANVAS_WIDTH / this.GRID_SIZE);
    this.GRID_ROWS = Math.ceil(this.CANVAS_HEIGHT / this.GRID_SIZE);
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
   * Предварительно вычислить сетку проходимости (кэш).
   * @param {object} gameState
   * @param {string|null} excludeItemId - itemId предмета, который временно НЕ считается
   *   препятствием (нужно при движении к этому предмету)
   */
  buildWalkableGrid(gameState, excludeItemId = null) {
    const grid = new Uint8Array(this.GRID_COLS * this.GRID_ROWS).fill(1); // 1 = проходимо

    // Препятствия: крупные объекты карты (дом, стол, забор и т.д.)
    // Открытая дверь — проходима, закрытая — нет
    for (const obj of gameState.world.mapObjects || []) {
      if (obj.objectId === 'door' && gameState.world.flags?.door_open) continue;
      if (obj.objectId === 'door_locked' && gameState.world.flags?.door_locked_open) continue;
      const objGrid = this.posToGrid(obj.x, obj.y);
      const objWidthGrid = Math.ceil((obj.width || 60) / this.GRID_SIZE);
      const objHeightGrid = Math.ceil((obj.height || 40) / this.GRID_SIZE);

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

    // Препятствия: предметы на земле (каждый занимает 1 клетку)
    // excludeItemId — целевой предмет НЕ блокирует, чтобы можно было к нему подойти
    for (const obj of gameState.world.objects || []) {
      if (obj.taken) continue;
      if (obj.itemId === excludeItemId) continue; // целевой предмет не блокирует
      const g = this.posToGrid(obj.x, obj.y);
      if (g.x >= 0 && g.x < this.GRID_COLS && g.y >= 0 && g.y < this.GRID_ROWS) {
        grid[g.y * this.GRID_COLS + g.x] = 0;
      }
    }

    return grid;
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

    // Если цель недостижима — найти ближайшую проходимую клетку рядом
    let actualGoal = goal;
    if (!isWalkableCell(goal.x, goal.y)) {
      const neighbors8 = [
        [goal.x - 1, goal.y], [goal.x + 1, goal.y],
        [goal.x, goal.y - 1], [goal.x, goal.y + 1],
        [goal.x - 1, goal.y - 1], [goal.x - 1, goal.y + 1],
        [goal.x + 1, goal.y - 1], [goal.x + 1, goal.y + 1]
      ];

      for (const [nx, ny] of neighbors8) {
        if (isWalkableCell(nx, ny)) {
          actualGoal = {x: nx, y: ny};
          break;
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
