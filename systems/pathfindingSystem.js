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
    
    console.log(`✓ PathfindingSystem инициализирована (${this.GRID_COLS}x${this.GRID_ROWS})`);
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

    // Проверяем объекты на карте
    for (const obj of gameState.world.mapObjects || []) {
      const objGrid = this.posToGrid(obj.x, obj.y);
      const objWidth = Math.ceil((obj.width || 40) / this.GRID_SIZE);
      const objHeight = Math.ceil((obj.height || 40) / this.GRID_SIZE);
      
      if (gx >= objGrid.x && gx < objGrid.x + objWidth &&
          gy >= objGrid.y && gy < objGrid.y + objHeight) {
        return false; // Препятствие здесь
      }
    }

    return true; // Проходимо
  }

  /**
   * Простой A* алгоритм поиска пути
   */
  findPath(startX, startY, goalX, goalY, gameState) {
    const start = this.posToGrid(startX, startY);
    const goal = this.posToGrid(goalX, goalY);

    console.log(`🗺️  Ищу путь: (${start.x},${start.y}) → (${goal.x},${goal.y})`);

    // Если цель недостижима - простой путь напрямую
    if (!this.isWalkable(goal.x, goal.y, gameState)) {
      console.log(`  ⚠️ Цель находится на препятствии, идём напрямую`);
      return [[goalX, goalY]];
    }

    // Если уже на цели
    if (start.x === goal.x && start.y === goal.y) {
      return [];
    }

    // BFS поиск (упрощённый A*)
    const openSet = [[start.x, start.y]];
    const cameFrom = {};
    const gScore = {};
    const key = (x, y) => `${x},${y}`;

    gScore[key(start.x, start.y)] = 0;

    while (openSet.length > 0) {
      // Находим клетку с минимальным f-score
      let current = null;
      let minFScore = Infinity;
      let currentIdx = 0;

      for (let i = 0; i < openSet.length; i++) {
        const [x, y] = openSet[i];
        const g = gScore[key(x, y)] || 0;
        const h = Math.abs(x - goal.x) + Math.abs(y - goal.y); // Manhattan
        const f = g + h;

        if (f < minFScore) {
          minFScore = f;
          current = [x, y];
          currentIdx = i;
        }
      }

      if (!current) break;

      const [cx, cy] = current;

      // Достигли цели
      if (cx === goal.x && cy === goal.y) {
        // Восстанавливаем путь
        const path = [];
        let c = key(cx, cy);
        
        while (cameFrom[c]) {
          const [x, y] = cameFrom[c].split(',').map(Number);
          path.unshift([x, y]);
          c = key(x, y);
        }
        
        path.push([goal.x, goal.y]);
        
        console.log(`  ✅ Путь найден (${path.length} клеток)`);
        
        // Конвертируем в координаты пикселей
        return path.map(([gx, gy]) => {
          const pos = this.gridToPos(gx, gy);
          return [pos.x, pos.y];
        });
      }

      openSet.splice(currentIdx, 1);

      // Проверяем соседей (8 направлений)
      const neighbors = [
        [cx - 1, cy], [cx + 1, cy],
        [cx, cy - 1], [cx, cy + 1],
        [cx - 1, cy - 1], [cx - 1, cy + 1],
        [cx + 1, cy - 1], [cx + 1, cy + 1]
      ];

      for (const [nx, ny] of neighbors) {
        if (!this.isWalkable(nx, ny, gameState)) continue;

        const tentativeGScore = (gScore[key(cx, cy)] || 0) + 
          (cx !== nx && cy !== ny ? 1.4 : 1); // Диагональ дороже

        const nKey = key(nx, ny);

        if (!gScore[nKey] || tentativeGScore < gScore[nKey]) {
          cameFrom[nKey] = key(cx, cy);
          gScore[nKey] = tentativeGScore;

          if (!openSet.some(([x, y]) => x === nx && y === ny)) {
            openSet.push([nx, ny]);
          }
        }
      }
    }

    // Если путь не найден - идём напрямую
    console.log(`  ⚠️ Путь не найден, идём напрямую`);
    return [[goalX, goalY]];
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
}

// Глобальный экземпляр
const pathfindingSystem = new PathfindingSystem();
window.pathfindingSystem = pathfindingSystem;
