/**
 * УПРОЩЕННАЯ логика движения игрока
 * Каждый фрейм - максимум одно обновление state
 */

function updatePlayerMovement(playerData) {
  const SPEED = 3;
  const gameState = window.getGameState?.();
  if (!gameState) return;

  let x = playerData.x || 100;
  let y = playerData.y || 100;

  // ЗАЩИТА: Если стаг stuck
  if (playerData.isMoving && !playerData.pathWaypoints && playerData.targetX === null && playerData.targetY === null) {
    console.warn(`⚠️ Игрок stuck! Останавливаемпсон.`);
    window.updateGameState?.({ player: { isMoving: false, pathWaypoints: null, targetX: null, targetY: null, currentWaypoint: 0 } });
    return;
  }

  // СЛУЧАЙ 1: Движение по waypoints
  if (playerData.isMoving && playerData.pathWaypoints?.length > 0) {
    const wpIndex = playerData.currentWaypoint || 0;
    if (wpIndex >= playerData.pathWaypoints.length) return;

    const wp = playerData.pathWaypoints[wpIndex];
    const dx = wp.x - x;
    const dy = wp.y - y;
    const dist = Math.hypot(dx, dy);

    if (dist > SPEED) {
      // Еще идем к waypoint
      x += (dx / dist) * SPEED;
      y += (dy / dist) * SPEED;
      window.updateGameState?.({ player: { x, y } });
    } else {
      // Достигли waypoint
      if (wpIndex + 1 < playerData.pathWaypoints.length) {
        // Еще есть waypoints
        window.updateGameState?.({
          player: { x: wp.x, y: wp.y, currentWaypoint: wpIndex + 1 }
        });
      } else {
        // Конец пути - обновляем и выполняем pending actions
        const st = {
          x: wp.x,
          y: wp.y,
          isMoving: false,
          pathWaypoints: null,
          currentWaypoint: 0,
          targetX: null,
          targetY: null
        };

        // Сохраняем pending flags ДО очистки
        const needItemPickup = playerData._pendingItemPickup;
        const needDoorOpen = playerData._pendingDoorOpen;
        const needPutOnSurface = playerData._pendingPutOnSurface;
        st._pendingItemPickup = null;
        st._pendingDoorOpen = false;
        st._pendingPutOnSurface = null;

        window.updateGameState?.({ player: st });

        // Выполняем actions ПОСЛЕ обновления state
        if (needItemPickup) {
          const itemExists = gameState.world.objects.some(o => o.itemId === needItemPickup && !o.taken);
          if (itemExists && window.actionSystem) {
            window.actionSystem.action_takeItem({ itemId: needItemPickup });
          }
        }
        if (needDoorOpen && window.actionSystem) {
          window.actionSystem.action_openDoor({});
        }
        if (needPutOnSurface && window.actionSystem) {
          window.actionSystem._doPlaceOnSurface(needPutOnSurface.itemId, needPutOnSurface.surfaceId);
        }
      }
    }
  }
  // СЛУЧАЙ 2: Движение к targetX/Y
  else if (playerData.isMoving && playerData.targetX !== null && playerData.targetY !== null) {
    const dx = playerData.targetX - x;
    const dy = playerData.targetY - y;
    const dist = Math.hypot(dx, dy);

    if (dist > SPEED) {
      x += (dx / dist) * SPEED;
      y += (dy / dist) * SPEED;
      window.updateGameState?.({ player: { x, y } });
    } else {
      // Достигли цели
      const st = {
        x: playerData.targetX,
        y: playerData.targetY,
        isMoving: false,
        targetX: null,
        targetY: null,
        pathWaypoints: null,
        currentWaypoint: 0
      };

      const needItemPickup = playerData._pendingItemPickup;
      const needDoorOpen = playerData._pendingDoorOpen;
      const needPutOnSurface = playerData._pendingPutOnSurface;
      st._pendingItemPickup = null;
      st._pendingDoorOpen = false;
      st._pendingPutOnSurface = null;

      window.updateGameState?.({ player: st });

      if (needItemPickup) {
        const itemExists = gameState.world.objects.some(o => o.itemId === needItemPickup && !o.taken);
        if (itemExists && window.actionSystem) {
          window.actionSystem.action_takeItem({ itemId: needItemPickup });
        }
      }
      if (needDoorOpen && window.actionSystem) {
        window.actionSystem.action_openDoor({});
      }
      if (needPutOnSurface && window.actionSystem) {
        window.actionSystem._doPlaceOnSurface(needPutOnSurface.itemId, needPutOnSurface.surfaceId);
      }
    }
  }
}

// Экспортируем
window.updatePlayerMovement = updatePlayerMovement;
