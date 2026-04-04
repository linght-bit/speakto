const gameConfig = {
 
  languages: {
    ui: 'ru',       
    player: 'pt-br',
  },

 
  canvas: {
    width: 800,
    height: 600,
    backgroundColor: '#08000e',
  },

 
  voice: {
    enabled: true,
    language: 'pt-BR', 
    continuous: true,
  },

 
  camera: {
    zoomLevel: 1.5,
    smoothing: 0.1,
  },

 
  fx: {
    particlesEnabled: true,
    soundEnabled: true,
  },

 
  debug: {
    enabled: false,
    showHitboxes: false,
    showGrid: false,
    fps: true,
  },

 
  inventory: {
    maxItems: 10,
  },
};

window.gameConfig = gameConfig;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = gameConfig;
}
