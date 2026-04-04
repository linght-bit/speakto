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
    containerStates: {}, 
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

function updateGameState(updates) {
  updateGameStateCallCount++;
  
 
  if (updateGameStateCallCount > MAX_UPDATES_PER_FRAME) {
    return;
  }
  
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
    gameState.world.mapObjects = JSON.parse(JSON.stringify(window.mapObjectsData.objects));

   
    for (const obj of gameState.world.mapObjects) {
      if (obj.isContainer) {
        gameState.world.containerStates[obj.id] = obj.alwaysOpen ? 'open' : 'closed';
      }
    }

   
    for (const obj of gameState.world.mapObjects) {
      if (obj.isSurface && obj.initialItems?.length > 0) {
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getGameState,
    updateGameState,
    resetGameState,
    DEFAULT_STATE,
  };
}
