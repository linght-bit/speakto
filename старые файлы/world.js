// ════════════════════════════════════════════════════
// WORLD.JS — Entry point & game loop
//
// Load order (each file depends on the ones before it):
//   1. world-config.js          constants, palette, draw primitives
//   2. world-state.js           global state, initWorld()
//   3. world-physics.js         camera, collision, movement, A*
//   4. world-render-bg.js       offscreen BG cache + static rendering
//   5. world-render-dynamic.js  dynamic entities + draw()
//   6. world.js                 game loop  ← this file
// ════════════════════════════════════════════════════

let last = 0;

// Track state that affects the static background cache
let _prevGateOpen = false, _prevTroughFull = false, _prevTreeCount = 0;

function loop(t) {
  if (started && t - last > 14) {
    console.log('loop running, started:', started);
    last = t;

    // Logic ticks
    tickPlayer();
    tickMonster();
    checkMonsterTouch();
    tickAmbient();

    // Invalidate BG cache on relevant state changes
    const treeCount = trees.filter(tr => tr.alive).length;
    if (gate.open !== _prevGateOpen ||
        trough.full !== _prevTroughFull ||
        treeCount !== _prevTreeCount) {
      _prevGateOpen   = gate.open;
      _prevTroughFull = trough.full;
      _prevTreeCount  = treeCount;
      invalidateBg();
    }

    draw();
  }
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
