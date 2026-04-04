function updatePlayerMovement(playerData) {
  const SPEED = 3;
  const gameState = window.getGameState?.();
  if (!gameState) return;

  const directionFromTo = (fromX, fromY, toX, toY) => {
    const dx = (toX || 0) - (fromX || 0);
    const dy = (toY || 0) - (fromY || 0);
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
    return dy >= 0 ? 'down' : 'up';
  };

  const finalizeDeferred = (actionId, params, success) => {
    if (!window.actionSystem?.finalizeDeferredAction) return;
    window.actionSystem.finalizeDeferredAction(actionId, params, !!success);
  };

  const finalizeDeferredIfSettled = (actionId, params, success) => {
    const latestPlayer = window.getGameState?.()?.player || {};
    const stillDeferred = !!(success && window.actionSystem?._hasDeferredMovement?.(latestPlayer));
    if (!stillDeferred) {
      finalizeDeferred(actionId, params, success);
    }
  };

  let x = playerData.x || 100;
  let y = playerData.y || 100;

 
  if (playerData.isMoving && !playerData.pathWaypoints && playerData.targetX === null && playerData.targetY === null) {
    window.updateGameState?.({ player: {
      isMoving: false,
      pathWaypoints: null,
      targetX: null,
      targetY: null,
      currentWaypoint: 0,
      _pendingMoveAction: null,
      _pendingItemPickup: null,
      _pendingDoorOpen: null,
      _pendingDoorClose: null,
      _pendingPutOnSurface: null,
      _pendingOpenContainer: null,
      _pendingTakeFromContainer: null,
      _pendingApproachTarget: null,
    } });
    return;
  }

 
  if (playerData.isMoving && playerData.pathWaypoints?.length > 0) {
    const wpIndex = playerData.currentWaypoint || 0;
    if (wpIndex >= playerData.pathWaypoints.length) return;

    const wp = playerData.pathWaypoints[wpIndex];
    const dx = wp.x - x;
    const dy = wp.y - y;
    const dist = Math.hypot(dx, dy);

    if (dist > SPEED) {
     
      x += (dx / dist) * SPEED;
      y += (dy / dist) * SPEED;
      window.updateGameState?.({ player: { x, y } });
    } else {
     
      if (wpIndex + 1 < playerData.pathWaypoints.length) {
       
        window.updateGameState?.({
          player: { x: wp.x, y: wp.y, currentWaypoint: wpIndex + 1 }
        });
      } else {
       
        const st = {
          x: wp.x,
          y: wp.y,
          isMoving: false,
          pathWaypoints: null,
          currentWaypoint: 0,
          targetX: null,
          targetY: null
        };

       
        const needMoveAction = playerData._pendingMoveAction;
        const needItemPickup = playerData._pendingItemPickup;
        const needDoorOpen = playerData._pendingDoorOpen;
        const needDoorClose = playerData._pendingDoorClose;
        const needPutOnSurface = playerData._pendingPutOnSurface;
        const needOpenContainer = playerData._pendingOpenContainer;
        const needTakeFromContainer = playerData._pendingTakeFromContainer;
        const needApproachTarget = playerData._pendingApproachTarget;
        st._pendingMoveAction = null;
        st._pendingItemPickup = null;
        st._pendingDoorOpen = null;
        st._pendingDoorClose = null;
        st._pendingPutOnSurface = null;
        st._pendingOpenContainer = null;
        st._pendingTakeFromContainer = null;
        st._pendingApproachTarget = null;
        if (needApproachTarget?.x !== undefined && needApproachTarget?.y !== undefined) {
          st.direction = directionFromTo(st.x, st.y, needApproachTarget.x, needApproachTarget.y);
        }

        window.updateGameState?.({ player: st });

        if (needMoveAction?.actionId) {
          finalizeDeferred(needMoveAction.actionId, {}, true);
        }

        if (needApproachTarget?.targetId) {
          window.eventSystem?.emit('player:approachArrived', { targetId: needApproachTarget.targetId });
          finalizeDeferred('approach_to', { targetId: needApproachTarget.targetId }, true);
        }

       
        if (needItemPickup && window.actionSystem) {
          const itemExists = gameState.world.objects.some(o => o.itemId === needItemPickup && !o.taken);
          const success = itemExists
            ? window.actionSystem.action_takeItem({ itemId: needItemPickup })
            : false;
          finalizeDeferred('take_item', { itemId: needItemPickup }, success);
        }
        if (needDoorOpen && window.actionSystem) {
          const params = typeof needDoorOpen === 'object' ? needDoorOpen : {};
          const success = window.actionSystem.action_openDoor(params);
          finalizeDeferredIfSettled('open_door', params, success);
        }
        if (needDoorClose && window.actionSystem) {
          const params = typeof needDoorClose === 'object' ? needDoorClose : {};
          const success = window.actionSystem.action_closeDoor(params);
          finalizeDeferredIfSettled('close_door', params, success);
        }
        if (needPutOnSurface && window.actionSystem) {
          const success = window.actionSystem._doPlaceOnSurface(needPutOnSurface.itemId, needPutOnSurface.surfaceId);
          finalizeDeferred('put_on_surface', needPutOnSurface, success);
        }
        if (needOpenContainer && window.actionSystem) {
          const success = window.actionSystem._doOpenContainer(needOpenContainer.containerId);
          finalizeDeferred('open_container', needOpenContainer, success);
        }
        if (needTakeFromContainer && window.actionSystem) {
          const success = window.actionSystem._doTakeFromContainer(needTakeFromContainer.itemId, needTakeFromContainer.containerId);
          finalizeDeferred('take_item', { itemId: needTakeFromContainer.itemId }, success);
        }
      }
    }
  }
 
  else if (playerData.isMoving && playerData.targetX !== null && playerData.targetY !== null) {
    const dx = playerData.targetX - x;
    const dy = playerData.targetY - y;
    const dist = Math.hypot(dx, dy);

    if (dist > SPEED) {
      x += (dx / dist) * SPEED;
      y += (dy / dist) * SPEED;
      window.updateGameState?.({ player: { x, y } });
    } else {
     
      const st = {
        x: playerData.targetX,
        y: playerData.targetY,
        isMoving: false,
        targetX: null,
        targetY: null,
        pathWaypoints: null,
        currentWaypoint: 0
      };

      const needMoveAction = playerData._pendingMoveAction;
      const needItemPickup = playerData._pendingItemPickup;
      const needDoorOpen = playerData._pendingDoorOpen;
      const needDoorClose = playerData._pendingDoorClose;
      const needPutOnSurface = playerData._pendingPutOnSurface;
      const needOpenContainer = playerData._pendingOpenContainer;
      const needTakeFromContainer = playerData._pendingTakeFromContainer;
      const needApproachTarget = playerData._pendingApproachTarget;
      st._pendingMoveAction = null;
      st._pendingItemPickup = null;
      st._pendingDoorOpen = null;
      st._pendingDoorClose = null;
      st._pendingPutOnSurface = null;
      st._pendingOpenContainer = null;
      st._pendingTakeFromContainer = null;
      st._pendingApproachTarget = null;
      if (needApproachTarget?.x !== undefined && needApproachTarget?.y !== undefined) {
        st.direction = directionFromTo(st.x, st.y, needApproachTarget.x, needApproachTarget.y);
      }

      window.updateGameState?.({ player: st });

      if (needMoveAction?.actionId) {
        finalizeDeferred(needMoveAction.actionId, {}, true);
      }

      if (needApproachTarget?.targetId) {
        window.eventSystem?.emit('player:approachArrived', { targetId: needApproachTarget.targetId });
        finalizeDeferred('approach_to', { targetId: needApproachTarget.targetId }, true);
      }

      if (needItemPickup && window.actionSystem) {
        const itemExists = gameState.world.objects.some(o => o.itemId === needItemPickup && !o.taken);
        const success = itemExists
          ? window.actionSystem.action_takeItem({ itemId: needItemPickup })
          : false;
        finalizeDeferred('take_item', { itemId: needItemPickup }, success);
      }
      if (needDoorOpen && window.actionSystem) {
        const params = typeof needDoorOpen === 'object' ? needDoorOpen : {};
        const success = window.actionSystem.action_openDoor(params);
        finalizeDeferredIfSettled('open_door', params, success);
      }
      if (needDoorClose && window.actionSystem) {
        const params = typeof needDoorClose === 'object' ? needDoorClose : {};
        const success = window.actionSystem.action_closeDoor(params);
        finalizeDeferredIfSettled('close_door', params, success);
      }
      if (needPutOnSurface && window.actionSystem) {
        const success = window.actionSystem._doPlaceOnSurface(needPutOnSurface.itemId, needPutOnSurface.surfaceId);
        finalizeDeferred('put_on_surface', needPutOnSurface, success);
      }
      if (needOpenContainer && window.actionSystem) {
        const success = window.actionSystem._doOpenContainer(needOpenContainer.containerId);
        finalizeDeferred('open_container', needOpenContainer, success);
      }
      if (needTakeFromContainer && window.actionSystem) {
        const success = window.actionSystem._doTakeFromContainer(needTakeFromContainer.itemId, needTakeFromContainer.containerId);
        finalizeDeferred('take_item', { itemId: needTakeFromContainer.itemId }, success);
      }
    }
  }
}

window.updatePlayerMovement = updatePlayerMovement;
