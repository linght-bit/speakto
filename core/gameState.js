const DEFAULT_STATE = {
  player: {
    language: 'pt-br',   
    inventory: [],       
    engineerSuit: false, 
    x: 230,              
    y: 1150,             
    targetX: null,       
    targetY: null,       
    isMoving: false,     
    pathWaypoints: null, 
    currentWaypoint: 0,  
    _pendingItemPickup: null,
    _pendingDoorOpen: null,  
    _pendingPutOnSurface: null,
    _pendingOpenContainer: null,
    _pendingCloseContainer: null,
    _pendingTakeFromContainer: null,
    _pendingApproachTarget: null,
    position: null,      
    state: 'idle',       
    direction: 'right',  
  },
  
  ui: {
    language: 'ru',      
    currentScreen: 'game',
  },
  
  quests: {
    active: [],          
    completed: [],       
    current: null,       
    progress: {},        
    taskStates: {},      
  },
  
  world: {
    flags: {},
    objects: [],
    mapObjects: [],
    surfaceItems: {},
  },
  
  dialogue: {
    active: false,       
    npc: null,           
    step: 0,             
  },
  
  voice: {
    isListening: false,  
    lastCommand: null,   
    lastCommandTime: 0,  
    lastAction: null,    
  },
};

let gameState = JSON.parse(JSON.stringify(DEFAULT_STATE));

function getGameState(path = null) {
  if (!path) return gameState;
  
  const parts = path.split('.');
  let value = gameState;
  for (const part of parts) {
    value = value?.[part];
  }
  return value;
}

let updateGameStateCallCount = 0;
const MAX_UPDATES_PER_FRAME = 10;
let lastFrameUpdateCount = 0;

let frameCounter = 0;

function getMapObjectGridBounds(obj, cellSize = 20) {
  const widthCells = Math.max(1, Math.round((obj?.width || cellSize) / cellSize));
  const heightCells = Math.max(1, Math.round((obj?.height || cellSize) / cellSize));
  const left = Math.round(((obj?.x || 0) - (widthCells * cellSize) / 2) / cellSize);
  const top = Math.round(((obj?.y || 0) - (heightCells * cellSize) / 2) / cellSize);
  return {
    left,
    top,
    right: left + widthCells - 1,
    bottom: top + heightCells - 1,
    width: widthCells,
    height: heightCells,
  };
}

function isStructuralMapObject(obj) {
  const id = String(obj?.objectId || '');
  return id === 'wall' ||
    id === 'window' ||
    id === 'window_v_small' ||
    id === 'window_h_small' ||
    id === 'viewport_wide' ||
    id === 'door' ||
    id === 'door_locked' ||
    id === 'door_inner_v' ||
    id === 'door_inner_h' ||
    id === 'airlock_door_v' ||
    id === 'airlock_door_h' ||
    id.startsWith('door_color_') ||
    id === 'grate_floor' ||
    id === 'warning_stripe' ||
    id === 'cable_tray' ||
    id === 'pipe_v' ||
    id === 'pipe_h' ||
    id === 'pipe_corner' ||
    id === 'light_panel_white' ||
    id === 'light_panel_red' ||
    id === 'signage';
}

function mapObjectsOverlap(a, b, cellSize = 20) {
  const aa = getMapObjectGridBounds(a, cellSize);
  const bb = getMapObjectGridBounds(b, cellSize);
  return aa.left <= bb.right && aa.right >= bb.left && aa.top <= bb.bottom && aa.bottom >= bb.top;
}

function normalizeMapObjects(objects = []) {
  const result = [];
  for (const obj of objects) {
    if (!obj || !obj.objectId) continue;
    if (isStructuralMapObject(obj)) {
      result.push(obj);
      continue;
    }
    const overlapsExisting = result.some(existing =>
      !isStructuralMapObject(existing) && mapObjectsOverlap(existing, obj)
    );
    if (!overlapsExisting) {
      result.push(obj);
    }
  }
  return result;
}

function isContainerObject(obj) {
  return !!(obj && (
    obj.isContainer ||
    obj.objectId === 'crate_small' ||
    String(obj.objectId || '').startsWith('chest_')
  ));
}

function updateGameState(updates) {
  updateGameStateCallCount++;

  gameState = deepMerge(gameState, updates);

  if (window.eventSystem) {
    window.eventSystem.emit('game:state-changed', { updates, newState: gameState });
  }
}

function resetUpdateCounter() {
  frameCounter++;
  lastFrameUpdateCount = updateGameStateCallCount;
  updateGameStateCallCount = 0;
}

function resetGameState() {
  gameState = JSON.parse(JSON.stringify(DEFAULT_STATE));
  
 
  if (window.worldObjectsData?.objects) {
    gameState.world.objects = JSON.parse(JSON.stringify(window.worldObjectsData.objects));
  }
  
 
  if (window.mapObjectsData?.objects) {
    const rawMapObjects = JSON.parse(JSON.stringify(window.mapObjectsData.objects));
    gameState.world.mapObjects = normalizeMapObjects(rawMapObjects);

    // Initialize container flags
    for (const obj of gameState.world.mapObjects) {
      if (isContainerObject(obj)) {
        gameState.world.flags[`container_open_${obj.id}`] = obj.alwaysOpen || false;
      }
    }

    // Initialize container items
    for (const obj of gameState.world.mapObjects) {
      if ((obj.isSurface || isContainerObject(obj)) && obj.initialItems?.length > 0) {
        gameState.world.surfaceItems[obj.id] = [...obj.initialItems];
      }
    }
  }
  
  if (window.eventSystem) {
    window.eventSystem.emit('game:state-reset', gameState);
  }
}

function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

window.getGameState = getGameState;
window.updateGameState = updateGameState;
window.resetGameState = resetGameState;
window.resetUpdateCounter = resetUpdateCounter;
window.getMapObjectGridBounds = getMapObjectGridBounds;
window.normalizeMapObjects = normalizeMapObjects;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getGameState,
    updateGameState,
    resetGameState,
    getMapObjectGridBounds,
    normalizeMapObjects,
    DEFAULT_STATE,
  };
}
