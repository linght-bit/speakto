// ════════════════════════════════════════════════════
// WORLD.JS — World generation, physics, pathfinding, rendering
// ════════════════════════════════════════════════════

// ════════════════════════════════════════════════════
// LAYOUT
// ════════════════════════════════════════════════════
const CV = document.getElementById('c'), gw = document.getElementById('gw');
let cx = CV.getContext('2d'); // let so we can swap to offscreen ctx temporarily
const COLS = 30, ROWS = 30;
const CELL = 48;
// Forest border: 5 cells on each edge
const FOREST_BORDER = 5;
// Pen: 8×8 cells starting at (6,6)
const PEN_COL_START = 6, PEN_COL_END = 13;
const PEN_ROW_START = 6, PEN_ROW_END = 13;
const PEN_COLS = 8, PEN_ROWS = 8;
// Lake: irregular shape in bottom-left, roughly col 1-7, row 20-28
const LAKE_COL_START = 1, LAKE_COL_END = 7;
const LAKE_ROW_START = 20, LAKE_ROW_END = 28;

let W, H, PX, PY, PW, PH;

function layout() {
  W = CV.width = gw.clientWidth; H = CV.height = gw.clientHeight;
  PW = CELL * COLS; PH = CELL * ROWS;
  PX = 0; PY = 0; // Origin at top-left; border expands equally on all sides
  invalidateBg();
}
function gc(col, row) { return { x: PX + col * CELL + CELL / 2, y: PY + row * CELL + CELL / 2 }; }

// ════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════
let started = false, bonusActive = false;
let particles = [], flashTm = null, logTm = null;
let pTarget = null, monScriptTarget = null;
let playerHeld = null;

let P = {};
let trees = [];
let items = [];
let horse = {};
let well = {};
let trough = {};
let monster = {};
let gate = {};
// Village (right half of world)
let villageNPCs = [];

const QUEST_ITEMS = ['maca'];

// ════════════════════════════════════════════════════
// WORLD INIT — Layout per TZ
// ════════════════════════════════════════════════════
function initWorld() {
  layout();

  // Player: inside pen, right-bottom corner, 2 cells from fence (col 11-12, row 11-12)
  const PR = CELL * .36;
  P = { x: PX + 11 * CELL + CELL / 2, y: PY + 11 * CELL + CELL / 2, r: PR };

  // Gate: eastern wall of pen (col 13), middle (row 9) when pen is at y=6..13
  // Gate middle row: 6 + (13-6)/2 = 6 + 3.5 = 9.5 ≈ 9
  gate = { x: PX + 13 * CELL, y: PY + 9 * CELL, h: CELL, open: false };

  // Horse: center of pen (col 9-10, row 9)
  horse = { 
    col: 9, row: 9,
    x: PX + 9.5 * CELL, y: PY + 9 * CELL,
    w: CELL * 2, h: CELL,
    fed: false, watered: false, decorated: false
  };

  // Trough: in front of horse (col 11, row 10)
  trough = { x: PX + 11 * CELL + CELL / 2, y: PY + 10 * CELL + CELL / 2, full: false };

  // Well: between pen and house, 3 cells from east pen wall, 1.5 cells above road (row = gate_row - 1.5 = 9 - 1.5 = 7.5)
  well = { 
    x: PX + (13 + 3) * CELL + CELL / 2, y: PY + 7.5 * CELL + CELL / 2,
    r: CELL * .45
  };

  // Trees in pen: 3 trees (2 normal, 1 monster)
  trees = [
    { col: 7, row: 7, isMonster: false, x: PX + 7 * CELL + CELL / 2, y: PY + 7 * CELL + CELL / 2, alive: true, stump: false },
    { col: 12, row: 7, isMonster: false, x: PX + 12 * CELL + CELL / 2, y: PY + 7 * CELL + CELL / 2, alive: true, stump: false },
    { col: 10, row: 12, isMonster: true, x: PX + 10 * CELL + CELL / 2, y: PY + 12 * CELL + CELL / 2, alive: true, stump: false },
  ];

  // Items inside pen (no adjacent items)
  items = [];
  const occ = new Set();
  
  // Mark pen as occupied (freeCell will use this)
  for (let c = PEN_COL_START; c <= PEN_COL_END; c++) {
    for (let r = PEN_ROW_START; r <= PEN_ROW_END; r++) {
      occ.add(`${c},${r}`);
    }
  }
  // Mark special occupied cells
  trees.forEach(t => occ.add(`${t.col},${t.row}`));
  occ.add(`${horse.col},${horse.row}`); occ.add(`${horse.col + 1},${horse.row}`);
  occ.add(`${trough.x / CELL - 0.5},${trough.y / CELL - 0.5}`);

  function freeCellInPen() {
    for (let r = PEN_ROW_START + 1; r <= PEN_ROW_END - 1; r++) {
      for (let c = PEN_COL_START + 1; c <= PEN_COL_END - 1; c++) {
        const k = `${c},${r}`;
        if (!occ.has(k)) {
          occ.add(k);
          return { x: PX + c * CELL + CELL / 2, y: PY + r * CELL + CELL / 2, col: c, row: r };
        }
      }
    }
    return { x: PX + 8 * CELL + CELL / 2, y: PY + 8 * CELL + CELL / 2, col: 8, row: 8 };
  }

  const add = (id, x, y, type, label, color, noThrow = false) => {
    items.push({ id, x, y, type, held: false, gone: false, label, color, noThrow, filled: false });
  };

  // Inside pen: hay×3, stick×1, rocks×2, flowers×2
  const hay1 = freeCellInPen(); add('feno1', hay1.x, hay1.y, 'hay', 'feno', '#d97706');
  const hay2 = freeCellInPen(); add('feno2', hay2.x, hay2.y, 'hay', 'feno', '#d97706');
  const hay3 = freeCellInPen(); add('feno3', hay3.x, hay3.y, 'hay', 'feno', '#d97706');

  const stick1 = freeCellInPen(); add('graveto', stick1.x, stick1.y, 'stick', 'graveto', '#a07820');
  const rock1 = freeCellInPen(); add('pedra1', rock1.x, rock1.y, 'rock', 'pedra', '#9ca3af');
  const rock2 = freeCellInPen(); add('pedra2', rock2.x, rock2.y, 'rock', 'pedra', '#9ca3af');

  const flower1 = freeCellInPen(); add('flor1', flower1.x, flower1.y, 'flower', 'flor', '#f472b6');
  const flower2 = freeCellInPen(); add('flor2', flower2.x, flower2.y, 'flower', 'flor', '#f472b6');

  // Yoke (coromyslo): in front of horse
  add('cangalha', PX + 9 * CELL + CELL / 2, PY + 8 * CELL + CELL / 2, 'stick', 'cangalha', '#a07820', true);

  // Bucket near well
  add('balde', well.x + CELL * 0.8, well.y + CELL * 0.6, 'bucket', 'balde', '#60a5fa');

  // Dona Maria's house: top-right corner (offset 6 cells from edge)
  // x = 29 - 6 - 4 = 19 (assuming house is ~4 cells wide)
  villageNPCs = [{
    id: 'dona_maria',
    name: 'Dona Maria',
    avatar: '👵',
    x: PX + 21 * CELL + CELL / 2,
    y: PY + 6 * CELL + CELL / 2,
    r: CELL * .4,
    onOpen: function() { if (typeof _donaMariaOnOpen === 'function') _donaMariaOnOpen(this); },
    onClose: function() {},
    onSpeech: function(s, raw) { if (typeof _donaMariaOnSpeech === 'function') return _donaMariaOnSpeech(s, raw); return false; }
  },
  {
    id: 'don_tiago',
    name: 'Don Tiago',
    avatar: '🎣',
    x: PX + 4 * CELL + CELL / 2,
    y: PY + 25 * CELL + CELL / 2,
    r: CELL * .4,
    onOpen: function() { if (typeof _donTiagoOnOpen === 'function') _donTiagoOnOpen(this); },
    onClose: function() {},
    onSpeech: function(s, raw) { if (typeof _donTiagoOnSpeech === 'function') return _donTiagoOnSpeech(s, raw); return false; }
  }];

  // Axe: below road, 2 cells down, between house and pen
  add('machado', PX + 17 * CELL + CELL / 2, PY + 12 * CELL + CELL / 2, 'axe', 'machado', '#c084fc', true);

  // Log: near axe
  add('tronco', PX + 15 * CELL + CELL / 2, PY + 13 * CELL + CELL / 2, 'stick', 'tronco', '#8b5a2b');

  // Lantern: 3 cells west of house, 1 cell above road
  add('lanterna', PX + 18 * CELL + CELL / 2, PY + 7.5 * CELL + CELL / 2, 'stick', 'lanterna', '#fbbf24', true);

  // Fishing rod on pier
  add('vara_pesca', PX + 4 * CELL + CELL / 2, PY + 26 * CELL + CELL / 2, 'stick', 'vara de pesca', '#a07820');

  // Garden items (cabbage, carrot, pumpkin, tomato) - simple placement
  add('repolho', PX + 16 * CELL + CELL / 2, PY + 16 * CELL + CELL / 2, 'mushroom', 'repolho', '#15803d');
  add('cenoura', PX + 17 * CELL + CELL / 2, PY + 16 * CELL + CELL / 2, 'mushroom', 'cenoura', '#f97316');
  add('abobora', PX + 18 * CELL + CELL / 2, PY + 16 * CELL + CELL / 2, 'mushroom', 'abóbora', '#eab308');
  add('tomate', PX + 16 * CELL + CELL / 2, PY + 17 * CELL + CELL / 2, 'mushroom', 'tomate', '#ef4444');

  // Corn field item
  add('milho', PX + 22 * CELL + CELL / 2, PY + 20 * CELL + CELL / 2, 'mushroom', 'milho', '#f59e0b');

  monster = { x: 0, y: 0, r: CELL * .32, alive: false, fleeing: false };
  pTarget = null; monScriptTarget = null; playerHeld = null;
  particles = []; bonusActive = false;

  cam.x = P.x; cam.y = P.y; cam.zoom = camZoom();
  initAmbient();
}

// ════════════════════════════════════════════════════
// SPEEDS
// ════════════════════════════════════════════════════
const P_SPD = () => CELL * 0.08;
const M_SPD = () => CELL * 0.02;
const M_FLEE = () => CELL * 0.05;

// ════════════════════════════════════════════════════
// CAMERA — zoom + smooth follow
// ════════════════════════════════════════════════════
const CAM_ZOOM_DESKTOP = 1.4;
const CAM_ZOOM_MOBILE  = 1.0;
const CAM_EDGE_RATIO   = 0.25;  // recenter when player within 25% of edge
const CAM_LERP         = 0.08;  // smoothing factor

let cam = { x: 0, y: 0, zoom: 1 };

function camZoom() {
  return W < 600 ? CAM_ZOOM_MOBILE : CAM_ZOOM_DESKTOP;
}

function updateCamera() {
  const z = camZoom();
  const vw = W / z, vh = H / z;

  // Clamp camera so world fills viewport — allow scrolling over full world
  const halfVW = vw / 2, halfVH = vh / 2;
  let tx = Math.max(PX + halfVW, Math.min(PX + PW - halfVW, P.x));
  let ty = Math.max(PY + halfVH, Math.min(PY + PH - halfVH, P.y));
  // If world smaller than viewport in a dimension, just center it
  if (PW < vw) tx = PX + PW / 2;
  if (PH < vh) ty = PY + PH / 2;

  // Faster lerp when player near edge of current viewport
  const screenPx = (P.x - cam.x) * z + W / 2;
  const screenPy = (P.y - cam.y) * z + H / 2;
  const ex = W * CAM_EDGE_RATIO, ey = H * CAM_EDGE_RATIO;
  const nearEdge = screenPx < ex || screenPx > W - ex || screenPy < ey || screenPy > H - ey;
  const spd = nearEdge ? CAM_LERP * 3 : CAM_LERP;

  cam.x += (tx - cam.x) * spd;
  cam.y += (ty - cam.y) * spd;
  cam.zoom = z;
}

function applyCameraTransform() {
  const z = cam.zoom;
  mainCx.translate(W / 2, H / 2);
  mainCx.scale(z, z);
  mainCx.translate(-cam.x, -cam.y);
}

// ════════════════════════════════════════════════════
// COLLISION HELPERS
// ════════════════════════════════════════════════════
function gatePass(y, r) { return gate.open && (y - r) < (gate.y + gate.h) && (y + r) > gate.y; }
function inPen(obj) { 
  return obj.x > PX + PEN_COL_START * CELL && obj.x < PX + (PEN_COL_END + 1) * CELL && 
         obj.y > PY + PEN_ROW_START * CELL && obj.y < PY + (PEN_ROW_END + 1) * CELL; 
}

function overlapsHorse(x, y, r) {
  const nx = Math.max(horse.x, Math.min(horse.x + horse.w, x));
  const ny = Math.max(horse.y, Math.min(horse.y + horse.h, y));
  return (x - nx) ** 2 + (y - ny) ** 2 < r * r;
}
function overlapsTree(x, y, r, skip = -1) {
  for (let i = 0; i < trees.length; i++) {
    if (i === skip || !trees[i].alive) continue;
    if ((x - trees[i].x) ** 2 + (y - trees[i].y) ** 2 < (r + CELL * .18) ** 2) return true;
  }
  return false;
}
function overlapsMonster(x, y, r) {
  return monster.alive && (x - monster.x) ** 2 + (y - monster.y) ** 2 < (r + monster.r + 2) ** 2;
}
function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }

// ════════════════════════════════════════════════════
// GRID-BASED PATHFINDING (A*)
// ════════════════════════════════════════════════════
const GCOLS = 14, GROWS = 10;

function gridOffset() { return { gx: PX - CELL, gy: PY - CELL }; }

function pxToCell(px, py) {
  const { gx, gy } = gridOffset();
  return { col: Math.floor((px - gx) / CELL), row: Math.floor((py - gy) / CELL) };
}
function cellToPx(col, row) {
  const { gx, gy } = gridOffset();
  return { x: gx + col * CELL + CELL / 2, y: gy + row * CELL + CELL / 2 };
}

function cellWalkable(col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;

  const cx2 = PX + col * CELL + CELL / 2, cy2 = PY + row * CELL + CELL / 2;
  const r = CELL * 0.35;

  // Forest perimeter (5 cells on each edge): impassable barrier
  if (col < FOREST_BORDER || col >= COLS - FOREST_BORDER || 
      row < FOREST_BORDER || row >= ROWS - FOREST_BORDER) return false;

  // Lake region (irregular, roughly col 1-7, row 20-28): impassable water
  if (col >= LAKE_COL_START && col <= LAKE_COL_END && 
      row >= LAKE_ROW_START && row <= LAKE_ROW_END) {
    // In actual game, could add more complex lake shape, but for collision this suffices
    return false;
  }

  // Pen fence walls (col 6-13, row 6-13)
  const inPen = (col >= PEN_COL_START && col <= PEN_COL_END && 
                 row >= PEN_ROW_START && row <= PEN_ROW_END);

  // Outside pen: eastern wall blocks passage except through open gate
  if (!inPen && col === PEN_COL_END && row >= PEN_ROW_START && row <= PEN_ROW_END) {
    // Gate is at col 13, row 9 (middle of east wall)
    const gateRow = 9;
    const isNearGate = Math.abs(row - gateRow) <= 1;
    if (!gate.open || !isNearGate) return false;
  }

  // Horse obstacle
  if (overlapsHorse(cx2, cy2, r)) return false;

  // Tree trunks
  for (const t of trees) {
    if (!t.alive) continue;
    if ((cx2 - t.x) ** 2 + (cy2 - t.y) ** 2 < (r + CELL * 0.25) ** 2) return false;
  }

  return true;
}

// Path cache — key: "sc,sr→ec,er|gateOpen|aliveTreesBitmask"
const _pathCache = new Map();
const PATH_CACHE_MAX = 40;

function _pathCacheKey(sc, sr, ec, er) {
  // Include gate state and alive trees as cache discriminator
  const treeKey = trees.map(t => t.alive ? 1 : 0).join('');
  return `${sc},${sr}→${ec},${er}|${gate.open?1:0}|${treeKey}`;
}

function findPath(fromPx, fromPy, toPx, toPy) {
  const start = pxToCell(fromPx, fromPy);
  const end = pxToCell(toPx, toPy);
  if (start.col === end.col && start.row === end.row) return [];

  const cacheKey = _pathCacheKey(start.col, start.row, end.col, end.row);
  if (_pathCache.has(cacheKey)) return _pathCache.get(cacheKey);

  const key = (c, r) => c + ',' + r;
  const h = (c, r) => Math.abs(c - end.col) + Math.abs(r - end.row);
  const open = [{ col: start.col, row: start.row, g: 0, f: h(start.col, start.row), parent: null }];
  const closed = new Set();
  const best = {};
  best[key(start.col, start.row)] = 0;
  const dirs = [{ dc: 1, dr: 0 }, { dc: -1, dr: 0 }, { dc: 0, dr: 1 }, { dc: 0, dr: -1 },
    { dc: 1, dr: 1 }, { dc: 1, dr: -1 }, { dc: -1, dr: 1 }, { dc: -1, dr: -1 }];
  let found = null;
  for (let iter = 0; iter < 400; iter++) {
    if (!open.length) break;
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift();
    const ck = key(cur.col, cur.row);
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (cur.col === end.col && cur.row === end.row) { found = cur; break; }
    for (const { dc, dr } of dirs) {
      const nc = cur.col + dc, nr = cur.row + dr;
      const nk = key(nc, nr);
      if (closed.has(nk)) continue;
      if (!cellWalkable(nc, nr)) continue;
      if (dc !== 0 && dr !== 0) {
        if (!cellWalkable(cur.col + dc, cur.row) || !cellWalkable(cur.col, cur.row + dr)) continue;
      }
      const ng = cur.g + (dc !== 0 && dr !== 0 ? 1.414 : 1);
      if (best[nk] !== undefined && best[nk] <= ng) continue;
      best[nk] = ng;
      open.push({ col: nc, row: nr, g: ng, f: ng + h(nc, nr), parent: cur });
    }
  }

  let result = null;
  if (found) {
    const path = [];
    let cur = found;
    while (cur.parent) { path.unshift({ col: cur.col, row: cur.row }); cur = cur.parent; }
    result = path;
  }

  // Store in cache, evict oldest if full
  if (_pathCache.size >= PATH_CACHE_MAX) {
    _pathCache.delete(_pathCache.keys().next().value);
  }
  _pathCache.set(cacheKey, result);
  return result;
}

// Path following state
let pathWaypoints = [];
let pathFinalCb = null;
let pathFinalTarget = null;

// Returns true if point is inside the pen rectangle
function ptInPen(x, y) { return inPen({ x, y }); }

// Compute the gate center point (passage midpoint)
function gateMidpoint() {
  return { x: PX + PEN_COLS * CELL, y: gate.y + gate.h / 2 };
}

// Gate waypoints: just outside and just inside the gate
function gateWaypointOut() { return { x: gate.x + P.r * 2.2, y: gate.y + gate.h / 2 }; }
function gateWaypointIn()  { return { x: gate.x - P.r * 2.2, y: gate.y + gate.h / 2 }; }

function setTarget(tx, ty, cb) {
  dbg('setTarget(' + Math.round(tx) + ',' + Math.round(ty) + ')');
  pathFinalTarget = { x: tx, y: ty };
  pathFinalCb = cb;
  pathWaypoints = [];

  const playerInside = ptInPen(P.x, P.y);
  const targetInside = ptInPen(tx, ty);
  const crossingZone = playerInside !== targetInside;

  // If crossing the fence boundary and gate is open, inject gate waypoints
  // so A* doesn't have to find the narrow corridor on its own
  if (crossingZone && gate.open) {
    if (playerInside) {
      // Inside → outside: go to inside gate edge, then outside edge, then target
      const wi = gateWaypointIn();
      const wo = gateWaypointOut();
      const pathToGate = findPath(P.x, P.y, wi.x, wi.y);
      if (pathToGate) {
        pathWaypoints = pathToGate.map(({ col, row }) => cellToPx(col, row));
      }
      pathWaypoints.push(wi, wo, { x: tx, y: ty });
    } else {
      // Outside → inside: go to outside gate edge, then inside edge, then target
      const wo = gateWaypointOut();
      const wi = gateWaypointIn();
      const pathToGate = findPath(P.x, P.y, wo.x, wo.y);
      if (pathToGate) {
        pathWaypoints = pathToGate.map(({ col, row }) => cellToPx(col, row));
      }
      pathWaypoints.push(wo, wi, { x: tx, y: ty });
    }
  } else {
    // Same zone or gate closed — use A* directly
    const path = findPath(P.x, P.y, tx, ty);
    if (path === null || path.length === 0) {
      pathWaypoints = [{ x: tx, y: ty }];
    } else {
      pathWaypoints = path.map(({ col, row }) => cellToPx(col, row));
      pathWaypoints.push({ x: tx, y: ty });
    }
  }

  pTarget = pathWaypoints.length > 0 ? pathWaypoints.shift() : null;
}

function tickPlayer() {
  if (!pTarget && pathWaypoints.length === 0) return;
  const spd = P_SPD();
  if (!pTarget && pathWaypoints.length > 0) { pTarget = pathWaypoints.shift(); }
  if (!pTarget) return;
  const ox_ = P.x, oy_ = P.y;
  const dx = pTarget.x - P.x, dy = pTarget.y - P.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= spd) {
    const sm = tryMoveSimple(P, pTarget.x, pTarget.y);
    P.x = sm.x; P.y = sm.y;
    if (pathWaypoints.length > 0) {
      pTarget = pathWaypoints.shift();
    } else {
      pTarget = null;
      const cb = pathFinalCb; pathFinalCb = null; pathFinalTarget = null;
      if (cb) cb();
    }
    return;
  }
  const nm = tryMoveSimple(P, P.x + (dx / d) * spd, P.y + (dy / d) * spd);
  P.x = nm.x; P.y = nm.y;
  if (Math.abs(P.x - ox_) < 0.5 && Math.abs(P.y - oy_) < 0.5) {
    pTarget = null; pathWaypoints = [];
    const cb = pathFinalCb; pathFinalCb = null; pathFinalTarget = null;
    if (cb) cb();
  }
}

function tryMoveSimple(obj, nx, ny) {
  const r = obj.r || CELL * .3;
  const ox = obj.x, oy = obj.y;
  let x = nx, y = ny;
  const wasIn = inPen(obj);
  const penLeft = PX + PEN_COL_START * CELL;
  const penRight = PX + (PEN_COL_END + 1) * CELL;
  const penTop = PY + PEN_ROW_START * CELL;
  const penBottom = PY + (PEN_ROW_END + 1) * CELL;

  if (wasIn) {
    if (y - r < penTop)      y = penTop + r;
    if (y + r > penBottom)   y = penBottom - r;
    if (x - r < penLeft)     x = penLeft + r;
    if (x + r > penRight) {
      if (!gatePass(y, r)) x = penRight - r;
    }
  } else {
    // Crossing pen boundary from outside
    const crossEast = (x + r) > penRight && (x - r) < penRight && (y + r) > penTop && (y - r) < penBottom;
    if (crossEast && !gatePass(y, r)) x = penRight + r;

    if (x - r < PX)        x = PX + r;
    if (x + r > PX + PW)   x = PX + PW - r;
    if (y - r < PY)        y = PY + r;
    if (y + r > PY + PH)   y = PY + PH - r;
  }

  if (overlapsHorse(x, y, r)) {
    if (!overlapsHorse(x, oy, r)) y = oy;
    else if (!overlapsHorse(ox, y, r)) x = ox;
    else { x = ox; y = oy; }
  }
  if (overlapsTree(x, y, r)) {
    if (!overlapsTree(x, oy, r)) y = oy;
    else if (!overlapsTree(ox, y, r)) x = ox;
    else { x = ox; y = oy; }
  }
  return { x, y };
}

function tickMonster() {
  if (!monster.alive) return;
  if (monScriptTarget) {
    const dx = monScriptTarget.x - monster.x, dy = monScriptTarget.y - monster.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const spd = M_FLEE();
    if (d <= spd) {
      monster.x = monScriptTarget.x; monster.y = monScriptTarget.y;
      const cb = monScriptTarget.cb; monScriptTarget = null; if (cb) cb();
      return;
    }
    const m = tryMoveSimple(monster, monster.x + (dx / d) * spd, monster.y + (dy / d) * spd);
    monster.x = m.x; monster.y = m.y;
    return;
  }
  const dx = P.x - monster.x, dy = P.y - monster.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const spd = M_SPD();
  if (d <= spd) return;
  const m = tryMoveSimple(monster, monster.x + (dx / d) * spd, monster.y + (dy / d) * spd);
  monster.x = m.x; monster.y = m.y;
}

function checkMonsterTouch() {
  if (!monster.alive) return;
  const minD = P.r + monster.r + 2;
  const d = dist(P, monster);
  if (d < minD) {
    pTarget = null; pathWaypoints = []; pathFinalCb = null;
    const dx = P.x - monster.x, dy = P.y - monster.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ov = minD - d;
    const pm = tryMoveSimple(P, P.x + (dx / len) * ov * 0.7, P.y + (dy / len) * ov * 0.7);
    P.x = pm.x; P.y = pm.y;
    const mm = tryMoveSimple(monster, monster.x - (dx / len) * ov * 0.3, monster.y - (dy / len) * ov * 0.3);
    monster.x = mm.x; monster.y = mm.y;
  }
}

function canReach(item) {
  if (item.held) return true;
  const pIn = inPen(P);
  const iIn = inPen(item);
  if (pIn === iIn) return true;
  if (gate.open) return true;
  return false;
}

// ════════════════════════════════════════════════════
// PARTICLES
// ════════════════════════════════════════════════════
function burst(x, y, col, n = 14) {
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 2 * i / n + Math.random() * .5;
    const s = 1.5 + Math.random() * 3.5;
    particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2,
      r: 1.5 + Math.random() * 3,
      color: col, life: 35 + (Math.random() * 20 | 0), max: 55,
      star: Math.random() > .6,
      rot: Math.random() * Math.PI * 2, rotV: (Math.random() - .5) * .3,
    });
  }
}

// ════════════════════════════════════════════════════
// OFFSCREEN CANVAS — static background cached
// Static layers: grass, dirt, fence, well, trough
// Call invalidateBg() on any world state change:
//   gate open/close, trough fill, tree cut
// ════════════════════════════════════════════════════
let bgCanvas = null, bgDirty = true;
const mainCx = CV.getContext('2d');

function invalidateBg() { bgDirty = true; }

function renderBgToCache() {
  if (!bgCanvas || bgCanvas.width !== PW || bgCanvas.height !== PH) {
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = PW; bgCanvas.height = PH;
    bgDirty = true;
  }
  if (!bgDirty) return;
  bgDirty = false;
  const originalCx = cx;
  cx = bgCanvas.getContext('2d'); // swap to offscreen
  try {
    cx.save();
    cx.translate(-PX, -PY); // so world coords (PX,PY) map to canvas (0,0)
    _drawGrass();
    _drawDirt();
    // Village static: grass/trees/house/garden are all in bgCanvas
    _drawVillageStatic();
    drawFence();
    drawWell();
    drawTrough();
    cx.restore();
  } finally {
    cx = originalCx || mainCx;    // always restore main context
  }
}

const PAL = {
  // Ground
  dirt1:'#2b1d0e', dirt2:'#221608', dirt3:'#1a1004', dirt4:'#332210',
  dirtCrack:'#150c02', dirtStain:'#301e0e', dirtPebble:'#3a2e22',
  // Grass
  grass1:'#182808', grass2:'#142206', grass3:'#0e1904', grass4:'#1c3009',
  grassTuft:'#1e3409', grassFlower:'#d4a017', grassFlower2:'#c0392b',
  // Stone
  stone1:'#3d3830', stone2:'#4a4540', stone3:'#2e2a24', stoneMoss:'#2a3a1a',
  // Wood
  wood1:'#5c3d1e', wood2:'#6b4a28', wood3:'#3d2510', woodDark:'#2a1a0a',
  woodGrain:'#4a3018', woodHi:'#7a5030',
  // Fence
  fence:'#7c5c2a', fencePost:'#8b6914', fenceHi:'#a07820', fenceShadow:'#3a2808',
  fenceMoss:'#3a5020',
  // Water
  water1:'#1a3a6b', water2:'#1e4078', water3:'#162e58', waterHi:'rgba(120,200,255,.4)',
  waterDeep:'#0e1e3a',
  // Characters
  playerBody:'#2563a8', playerBodyHi:'#3b7fd4', playerHead:'#e8c97a',
  playerHair:'#6b3a0e', playerEye:'#111', playerScarf:'#c0392b', playerScarfHi:'#e74c3c',
  playerBelt:'#5c3d1e', playerBoots:'#1a1208',
  // Monster
  monBody:'#0f4a1a', monBodyHi:'#1a6b28', monEye:'#c8a000', monGlow:'rgba(200,160,0,.4)',
  monFang:'#e8e0d0', monAura:'rgba(10,60,20,.5)',
  // Sky/ambient
  skyEdge:'rgba(10,5,20,.7)',
};

// Ambient particles (fireflies, dust motes)
let ambientParts = [];
function initAmbient() {
  ambientParts = [];
  for (let i = 0; i < 18; i++) {
    ambientParts.push({
      x: PX + Math.random() * PW,
      y: PY + Math.random() * PH,
      vx: (Math.random() - .5) * .3,
      vy: (Math.random() - .5) * .2,
      r: .8 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      speed: .02 + Math.random() * .03,
      col: Math.random() > .5 ? '#a0e040' : '#60c0ff',
      inside: false,
    });
  }
}

function px(x, y, w, h, col) { cx.fillStyle = col; cx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function ln(x1, y1, x2, y2) { cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke(); }
function circ(x, y, r, fill) { cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fillStyle = fill; cx.fill(); }
function lbl(x, y, text, col) {
  if (cx !== mainCx) {
    // Drawing on bgCanvas: use world-space label render
    const sz = Math.max(11, Math.round(CELL * .20));
    cx.save();
    cx.imageSmoothingEnabled = false;
    cx.font = '900 ' + sz + 'px Nunito';
    const tw = cx.measureText(text).width;
    cx.fillStyle = 'rgba(8,6,14,.88)';
    cx.fillRect(Math.round(x - tw / 2) - 3, Math.round(y - sz/2) - 3, Math.round(tw) + 6, sz + 6);
    cx.fillStyle = col;
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(text, Math.round(x), Math.round(y));
    cx.textAlign = 'left';
    cx.restore();
    return;
  }

  // Always draw labels in screen-space (pixel-perfect, no blur from camera zoom)
  const z = cam.zoom;
  const sx = Math.round((x - cam.x) * z + W / 2);
  const sy = Math.round((y - cam.y) * z + H / 2);
  const sz = Math.max(11, Math.round(CELL * .2 * z));
  // Temporarily reset transform so we draw at true screen pixels
  mainCx.save();
  mainCx.setTransform(1, 0, 0, 1, 0, 0);
  mainCx.imageSmoothingEnabled = false;
  mainCx.font = '900 ' + sz + 'px Nunito';
  mainCx.textBaseline = 'middle';
  const tw = mainCx.measureText(text).width;
  mainCx.fillStyle = 'rgba(8,6,14,.88)';
  mainCx.fillRect(sx - Math.round(tw / 2) - 3, sy - sz/2 - 3, Math.round(tw) + 6, sz + 6);
  mainCx.fillStyle = col;
  mainCx.textAlign = 'center';
  mainCx.fillText(text, sx, sy);
  mainCx.textAlign = 'left';
  mainCx.restore();
}
function px_line(x1, y1, x2, y2, col, lw = 1) { cx.strokeStyle = col; cx.lineWidth = lw; cx.lineCap = 'square'; ln(x1, y1, x2, y2); }
function tn(x, y) { return Math.abs((Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1); }
function tn2(x, y) { return Math.abs((Math.sin(x * 91.3 + y * 47.9) * 31415.9)) % 1; }

function draw() {
  updateCamera();
  renderBgToCache();
  mainCx.clearRect(0, 0, W, H);
  mainCx.save();
  applyCameraTransform();
  mainCx.drawImage(bgCanvas, PX, PY);
  drawAmbient();
  drawHorse();
  drawItems();
  drawTrees();
  if (monster.alive) drawMonster();
  drawVillage();
  drawPlayer();
  drawParts();
  mainCx.restore();
  drawCharBubble();
}

// Static village elements — drawn into bgCanvas
function _drawVillageStatic() {
  const VX = PX + PEN_COLS * CELL;
  const penH = PEN_ROWS * CELL;
  const gs = Math.max(4, Math.floor(CELL / 4));

  // Village grass (right 20 cols, top pen-height area)
  cx.fillStyle = '#182808';
  cx.fillRect(VX, PY, CELL * 20, penH);
  for (let gx2 = VX; gx2 < VX + CELL * 20; gx2 += gs) {
    for (let gy2 = PY; gy2 < PY + penH; gy2 += gs) {
      const n = tn(gx2/gs+50, gy2/gs+50);
      if (n < 0.18) px(gx2, gy2, gs, gs, '#142206');
    }
  }

  // Forest at top/bottom of village strip
  _drawVillageForestEdge(VX, PY, CELL * 20);

  // House of Dona Maria
  _drawVillageHouse(VX + CELL * 14, PY + CELL * .3);
}

// ════════════════════════════════════════════════════
// VILLAGE RENDERER — draws only dynamic objects (house, NPCs) on top of bgCanvas
// ════════════════════════════════════════════════════
function drawVillage() {
  if (!villageNPCs || !villageNPCs.length) return;
  for (const npc of villageNPCs) _drawVillageNPC(npc);
}

function _drawGrass() {
  // Base sky gradient at edges (dark vignette suggesting night)
  const vign = cx.createRadialGradient(PX+PW/2,PY+PH/2,Math.min(PW,PH)*.3,PX+PW/2,PY+PH/2,Math.max(PW,PH)*.75);
  vign.addColorStop(0,'rgba(0,0,0,0)'); vign.addColorStop(1,'rgba(5,2,15,.55)');

  px(PX, PY, PW, PH, PAL.grass1);
  const gs = Math.max(4, Math.floor(CELL / 4));
  for (let gx2 = PX; gx2 < PX+PW; gx2 += gs) for (let gy2 = PY; gy2 < PY+PH; gy2 += gs) {
    const n = tn(gx2/gs, gy2/gs), n2 = tn2(gx2/gs+7, gy2/gs+3);
    if (n < 0.20) px(gx2,gy2,gs,gs,PAL.grass2);
    else if (n < 0.07) px(gx2,gy2,gs,gs,PAL.grass3);
    else if (n2 < 0.04) px(gx2,gy2,gs,gs,PAL.grass4);
  }

  // Grass tufts outside pen
  for (let i = 0; i < 80; i++) {
    const tx = PX + tn(i,0)*PW|0, ty = PY + tn(0,i+1)*PH|0;
    const inPenArea = tx>PX-6 && tx<PX+PEN_COLS*CELL+6 && ty>PY-6 && ty<PY+PH+6;
    if (inPenArea) continue;
    const sz = Math.max(1,(CELL*.07)|0);
    const shade = tn(i,i)>.5 ? PAL.grassTuft : PAL.grass4;
    cx.fillStyle = shade;
    cx.fillRect(tx,ty,sz,sz*2); cx.fillRect(tx+sz,ty+sz,sz,sz);
  }

  // Wildflowers scattered outside pen
  for (let i = 0; i < 22; i++) {
    const fx = PX + tn(i+100,3)*PW|0, fy = PY + tn(5,i+100)*PH|0;
    const inPenArea = fx>PX-10 && fx<PX+PEN_COLS*CELL+10 && fy>PY-10 && fy<PY+PH+10;
    if (inPenArea) continue;
    const fr = Math.max(2,CELL*.07);
    const col = tn(i,50)>.5 ? PAL.grassFlower : PAL.grassFlower2;
    cx.strokeStyle=PAL.grass4; cx.lineWidth=1;
    cx.beginPath(); cx.moveTo(fx,fy+fr*2); cx.lineTo(fx,fy); cx.stroke();
    circ(fx,fy,fr,col);
    circ(fx,fy,fr*.5,'#fdf0a0');
  }

  // ── DIRT PATH + lower world objects ──
  _drawPath();
  _drawLowerWorld();

  // ── FOREST EDGE ──
  _drawForest();

  // Vignette overlay
  cx.fillStyle = vign; cx.fillRect(PX,PY,PW,PH);
}

// ── Winding path from gate rightward 20 cells, with garden below road ──
function _drawPath() {
  const VX = PX + (PEN_COLS + BORDER_MARGIN) * CELL;
  const roadBaseY = PY + (GATE_ROW + BORDER_MARGIN) * CELL + CELL / 2; // road center Y at gate level
  const pw = Math.max(10, CELL * .55); // path half-width
  const roadEndX = VX + CELL * 20;

  // Build winding path control points — gentle S-curve over 20 cells
  // Path wiggles: up at col 5, back to center at col 10, down at col 15, center at col 20
  const pts = [
    { x: VX,              y: roadBaseY },
    { x: VX + CELL * 3,  y: roadBaseY - CELL * 0.3 },
    { x: VX + CELL * 6,  y: roadBaseY - CELL * 0.6 },
    { x: VX + CELL * 9,  y: roadBaseY - CELL * 0.3 },
    { x: VX + CELL * 12, y: roadBaseY + CELL * 0.3 },
    { x: VX + CELL * 15, y: roadBaseY + CELL * 0.5 },
    { x: VX + CELL * 18, y: roadBaseY + CELL * 0.2 },
    { x: roadEndX,        y: roadBaseY },
  ];

  // Draw road as thick poly-line (stroke twice for border + fill)
  function drawRoadStrip(widthMult, col) {
    cx.strokeStyle = col;
    cx.lineWidth = pw * 2 * widthMult;
    cx.lineCap = 'round';
    cx.lineJoin = 'round';
    cx.beginPath();
    cx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i+1].x) / 2;
      const my = (pts[i].y + pts[i+1].y) / 2;
      cx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    cx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
    cx.stroke();
  }

  drawRoadStrip(1.0, '#241608');   // base dirt
  drawRoadStrip(0.55, '#2e1e0a'); // lighter center strip

  // Tyre tracks
  cx.strokeStyle = '#1a0e04'; cx.lineWidth = Math.max(2, CELL * .07);
  cx.setLineDash([CELL * .5, CELL * .25]);
  // Offset tracks slightly above/below center
  function drawTrack(offY) {
    cx.beginPath();
    cx.moveTo(pts[0].x, pts[0].y + offY);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i+1].x) / 2;
      const my = (pts[i].y + pts[i+1].y) / 2;
      cx.quadraticCurveTo(pts[i].x, pts[i].y + offY, mx, my + offY);
    }
    cx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y + offY);
    cx.stroke();
  }
  drawTrack(-pw * .45);
  drawTrack( pw * .45);
  cx.setLineDash([]);

  // Pebbles scattered along path
  for (let i = 0; i < 22; i++) {
    const t2 = i / 22;
    const seg = Math.floor(t2 * (pts.length - 1));
    const segT = (t2 * (pts.length - 1)) - seg;
    const p0 = pts[Math.min(seg, pts.length-1)];
    const p1 = pts[Math.min(seg+1, pts.length-1)];
    const px2 = p0.x + (p1.x - p0.x) * segT + tn(i, 200) * pw * 1.2 - pw * .6;
    const py2 = p0.y + (p1.y - p0.y) * segT + (tn(200, i) - .5) * pw * 1.2;
    const pr2 = Math.max(1.5, CELL * .04);
    cx.fillStyle = tn(i, i+1) > .5 ? '#3a2e20' : '#2e2418';
    cx.beginPath(); cx.ellipse(px2, py2, pr2 * 1.4, pr2, tn(i,7)*Math.PI, 0, Math.PI*2); cx.fill();
  }

  // ── Garden: 10 cells right of pen, 2 cells below road, 5w × 3h ──
  const gardenX = VX + CELL * 10;
  const gardenY = roadBaseY + CELL * 1.5;
  _drawGardenPatch(gardenX, gardenY, 5, 3);

  // ── Lantern: left of Dona Maria's house by 3 cells, 1 cell above road ──
  // Dona Maria house at VX+15*CELL, so lantern at VX+12*CELL, 1 cell above road
  const lanternX = VX + CELL * 12;
  const lanternY = roadBaseY - CELL * 1.0;
  _drawLantern(lanternX, lanternY);
}

// ── Garden patch with fence and closed gate on top-center ──
function _drawGardenPatch(gx, gy, wCells, hCells) {
  const gw2 = wCells * CELL, gh2 = hCells * CELL;
  const fw = Math.max(2, CELL * .07);

  // Soil
  cx.fillStyle = '#2b1d0e';
  cx.fillRect(gx, gy, gw2, gh2);

  // Vegetable beds
  const vegs = [
    { col: 0, row: 0, emoji: '🌿', label: 'cenoura' },
    { col: 1, row: 0, emoji: '🥬', label: 'repolho' },
    { col: 2, row: 0, emoji: '🌱', label: 'nabo' },
    { col: 3, row: 0, emoji: '🍓', label: 'morango' },
    { col: 4, row: 0, emoji: '🥕', label: 'cenoura' },
    { col: 0, row: 1, emoji: '🌿', label: 'alho' },
    { col: 2, row: 1, emoji: '🥬', label: 'couve' },
    { col: 4, row: 1, emoji: '🌱', label: 'pepino' },
  ];
  const bedW = CELL * .85, bedH = CELL * .85;
  for (const v of vegs) {
    const bx = gx + v.col * CELL + CELL * .075;
    const by = gy + v.row * CELL + CELL * .075;
    cx.fillStyle = '#3a2410'; cx.fillRect(bx, by, bedW, bedH);
    cx.strokeStyle = '#241608'; cx.lineWidth = 1;
    for (let r = 0; r < 3; r++) {
      cx.beginPath(); cx.moveTo(bx, by + bedH/3*r); cx.lineTo(bx+bedW, by + bedH/3*r); cx.stroke();
    }
    const sz = Math.max(10, CELL * .32);
    cx.font = sz + 'px sans-serif'; cx.textAlign = 'center';
    cx.fillText(v.emoji, bx + bedW/2, by + bedH/2 + sz/3);
    cx.textAlign = 'left';
    lbl(bx + bedW/2, by - 4, v.label, '#4a8a30');
  }

  // Fence — top, left, right, bottom
  cx.strokeStyle = PAL.fence; cx.lineWidth = fw; cx.lineCap = 'square';
  // Bottom fence
  cx.beginPath(); cx.moveTo(gx, gy+gh2); cx.lineTo(gx+gw2, gy+gh2); cx.stroke();
  // Left fence
  cx.beginPath(); cx.moveTo(gx, gy); cx.lineTo(gx, gy+gh2); cx.stroke();
  // Right fence
  cx.beginPath(); cx.moveTo(gx+gw2, gy); cx.lineTo(gx+gw2, gy+gh2); cx.stroke();
  // Top fence — split in middle for gate
  const gateW = CELL * .8;
  const gateCX = gx + gw2 / 2;
  cx.beginPath(); cx.moveTo(gx, gy); cx.lineTo(gateCX - gateW/2, gy); cx.stroke();
  cx.beginPath(); cx.moveTo(gateCX + gateW/2, gy); cx.lineTo(gx+gw2, gy); cx.stroke();

  // Closed gate in top center
  cx.fillStyle = PAL.wood1;
  cx.fillRect(gateCX - gateW/2, gy - CELL*.05, gateW, CELL*.25);
  cx.strokeStyle = PAL.woodDark; cx.lineWidth = Math.max(1, CELL*.04);
  cx.strokeRect(gateCX - gateW/2, gy - CELL*.05, gateW, CELL*.25);
  // Lock
  const lx = gateCX, ly = gy + CELL*.08;
  cx.fillStyle = '#8b6914';
  cx.beginPath(); cx.arc(lx, ly, CELL*.06, 0, Math.PI*2); cx.fill();
  cx.strokeStyle = '#c8a030'; cx.lineWidth = 1.5;
  cx.beginPath(); cx.arc(lx, ly - CELL*.06, CELL*.04, Math.PI, 0); cx.stroke();

  lbl(gx + gw2/2, gy - CELL*.35, 'horta', '#4a8a30');
}

// ── Lower world: forest path, workshop, cornfield, lake, pier ──
function _drawLowerWorld() {
  const VX = PX + (PEN_COLS + BORDER_MARGIN) * CELL;
  const penBottom = PY + (PEN_ROWS + BORDER_MARGIN) * CELL;
  const pw = Math.max(8, CELL * .45); // path half-width

  // ── Winding trail from road near house, going down through forest ──
  // Starts near Dona Maria's house area, curves down-left through lower world
  const trailPts = [
    { x: VX + CELL * 15, y: PY + (GATE_ROW + BORDER_MARGIN + 1) * CELL },  // near house road junction
    { x: VX + CELL * 13, y: penBottom + CELL * 2 },
    { x: VX + CELL * 10, y: penBottom + CELL * 4 },
    { x: PX + CELL * (16 + BORDER_MARGIN), y: penBottom + CELL * 5 },          // turn toward workshop
    { x: PX + CELL * (14 + BORDER_MARGIN), y: penBottom + CELL * 7 },          // workshop area
    { x: PX + CELL * (12 + BORDER_MARGIN), y: penBottom + CELL * 9 },
    { x: PX + CELL * (9 + BORDER_MARGIN),  y: penBottom + CELL * 11 },         // curve toward lake
    { x: PX + CELL * (6 + BORDER_MARGIN),  y: penBottom + CELL * 12 },
    { x: PX + CELL * (4 + BORDER_MARGIN),  y: penBottom + CELL * 13 },         // lake shore
  ];

  // Draw trail
  cx.strokeStyle = '#241608'; cx.lineWidth = pw * 2; cx.lineCap = 'round'; cx.lineJoin = 'round';
  cx.beginPath();
  cx.moveTo(trailPts[0].x, trailPts[0].y);
  for (let i = 1; i < trailPts.length - 1; i++) {
    const mx = (trailPts[i].x + trailPts[i+1].x) / 2;
    const my = (trailPts[i].y + trailPts[i+1].y) / 2;
    cx.quadraticCurveTo(trailPts[i].x, trailPts[i].y, mx, my);
  }
  cx.lineTo(trailPts[trailPts.length-1].x, trailPts[trailPts.length-1].y);
  cx.stroke();
  // Trail center strip
  cx.strokeStyle = '#2e1e0a'; cx.lineWidth = pw * 0.9;
  cx.beginPath();
  cx.moveTo(trailPts[0].x, trailPts[0].y);
  for (let i = 1; i < trailPts.length - 1; i++) {
    const mx = (trailPts[i].x + trailPts[i+1].x) / 2;
    const my = (trailPts[i].y + trailPts[i+1].y) / 2;
    cx.quadraticCurveTo(trailPts[i].x, trailPts[i].y, mx, my);
  }
  cx.lineTo(trailPts[trailPts.length-1].x, trailPts[trailPts.length-1].y);
  cx.stroke();

  // ── Cornfield — col~16-20, row PEN_ROWS+5 to +8 ──
  const cfX = PX + CELL * (16 + BORDER_MARGIN), cfY = penBottom + CELL * 4.5;
  const cfW = CELL * 5, cfH = CELL * 3;
  cx.fillStyle = '#1a3a08'; cx.fillRect(cfX, cfY, cfW, cfH);
  // Corn rows
  for (let c = 0; c < 6; c++) {
    for (let r = 0; r < 4; r++) {
      const cx3 = cfX + CELL * .4 + c * CELL * .85;
      const cy3 = cfY + CELL * .4 + r * CELL * .7;
      // Stalk
      cx.strokeStyle = '#2a6010'; cx.lineWidth = Math.max(2, CELL * .07); cx.lineCap = 'round';
      cx.beginPath(); cx.moveTo(cx3, cy3 + CELL * .35); cx.lineTo(cx3, cy3 - CELL * .1); cx.stroke();
      // Leaves
      cx.strokeStyle = '#3a7a18'; cx.lineWidth = Math.max(1, CELL * .04);
      cx.beginPath(); cx.moveTo(cx3, cy3 + CELL * .15); cx.quadraticCurveTo(cx3 + CELL * .22, cy3, cx3 + CELL * .3, cy3 - CELL * .1); cx.stroke();
      cx.beginPath(); cx.moveTo(cx3, cy3 + CELL * .15); cx.quadraticCurveTo(cx3 - CELL * .22, cy3, cx3 - CELL * .3, cy3 - CELL * .1); cx.stroke();
      // Corn cob
      cx.fillStyle = '#d4a017';
      cx.beginPath(); cx.ellipse(cx3 + CELL * .08, cy3 + CELL * .05, CELL * .08, CELL * .2, 0.3, 0, Math.PI*2); cx.fill();
      cx.fillStyle = '#f59e0b';
      cx.beginPath(); cx.ellipse(cx3 + CELL * .06, cy3 + CELL * .04, CELL * .05, CELL * .14, 0.3, 0, Math.PI*2); cx.fill();
    }
  }
  // Cornfield fence
  cx.strokeStyle = PAL.fence; cx.lineWidth = Math.max(2, CELL * .06);
  cx.strokeRect(cfX - CELL*.1, cfY - CELL*.1, cfW + CELL*.2, cfH + CELL*.2);
  lbl(cfX + cfW/2, cfY - CELL*.4, 'milharal', '#6baa30');

  // ── Workshop — col~13-16, row PEN_ROWS+8 to +11 ──
  const wsX = PX + CELL * (13 + BORDER_MARGIN), wsY = penBottom + CELL * 8;
  _drawWorkshop(wsX, wsY);

  // ── Lake — bottom-left, extends off world edge ──
  _drawLake();

  // ── Pier on lake ──
  const pierX = PX + CELL * (3 + BORDER_MARGIN), pierY = penBottom + CELL * 12.5;
  _drawPier(pierX, pierY);
}

function _drawWorkshop(hx, hy) {
  const hw = CELL * 3, hh = CELL * 2.5;
  // Shadow
  cx.fillStyle = 'rgba(0,0,0,.22)'; cx.fillRect(hx+5, hy+5, hw, hh + CELL*.5);
  // Walls — darker, rougher than Dona Maria's house
  cx.fillStyle = '#5a4a32'; cx.fillRect(hx, hy, hw, hh);
  cx.fillStyle = 'rgba(0,0,0,.15)'; cx.fillRect(hx + hw*.55, hy, hw*.45, hh);
  // Windows — small, workshop style
  cx.fillStyle = '#1a2a1a'; cx.fillRect(hx + CELL*.3, hy + CELL*.5, CELL*.55, CELL*.45);
  cx.fillStyle = 'rgba(180,140,40,.15)'; cx.fillRect(hx + CELL*.32, hy + CELL*.52, CELL*.51, CELL*.41);
  cx.strokeStyle = '#3a2a10'; cx.lineWidth = Math.max(2, CELL*.05); cx.strokeRect(hx + CELL*.3, hy + CELL*.5, CELL*.55, CELL*.45);
  // Big door — workshop style, double door
  cx.fillStyle = '#3a2810'; cx.fillRect(hx + CELL*.8, hy + hh - CELL*1.1, CELL*1.2, CELL*1.1);
  cx.strokeStyle = '#5a3a18'; cx.lineWidth = Math.max(1, CELL*.04);
  cx.beginPath(); cx.moveTo(hx + CELL*1.4, hy + hh - CELL*1.1); cx.lineTo(hx + CELL*1.4, hy + hh); cx.stroke();
  // Metal hinges
  cx.fillStyle = '#4a5060';
  cx.fillRect(hx + CELL*.82, hy + hh - CELL*.95, CELL*.14, CELL*.08);
  cx.fillRect(hx + CELL*.82, hy + hh - CELL*.5, CELL*.14, CELL*.08);
  cx.fillRect(hx + CELL*1.42, hy + hh - CELL*.95, CELL*.14, CELL*.08);
  // Foundation stones
  cx.fillStyle = '#3a3028';
  for (let i = 0; i < 6; i++) {
    cx.fillRect(hx + i * CELL*.5, hy + hh - CELL*.12, CELL*.48, CELL*.12);
  }
  // Roof — shed style, slightly tilted
  cx.fillStyle = '#2a1e14';
  cx.beginPath();
  cx.moveTo(hx - CELL*.2, hy); cx.lineTo(hx - CELL*.1, hy - CELL*.9); cx.lineTo(hx + hw + CELL*.1, hy - CELL*.65); cx.lineTo(hx + hw + CELL*.2, hy);
  cx.closePath(); cx.fill();
  cx.fillStyle = '#3a2a1c';
  cx.beginPath();
  cx.moveTo(hx - CELL*.2, hy); cx.lineTo(hx - CELL*.1, hy - CELL*.9); cx.lineTo(hx + hw*.4, hy - CELL*.78); cx.lineTo(hx + hw*.35, hy);
  cx.closePath(); cx.fill();
  // Chimney with smoke
  const chx = hx + hw * .2;
  cx.fillStyle = '#2a1e14'; cx.fillRect(chx, hy - CELL*.85, CELL*.28, CELL*.6);
  cx.fillStyle = '#3a2e24'; cx.fillRect(chx - CELL*.04, hy - CELL*.88, CELL*.36, CELL*.1);
  // Smoke puffs
  const t2 = Date.now() / 1800;
  for (let i = 0; i < 3; i++) {
    const sy = hy - CELL*.9 - i * CELL * .35 - (t2 % 1) * CELL * .35;
    const sa = .15 + i * .08 + (t2 % 1) * .05;
    cx.fillStyle = `rgba(80,70,60,${sa})`;
    cx.beginPath(); cx.arc(chx + CELL*.14 + Math.sin(t2 + i) * CELL*.1, sy, CELL * (.12 + i * .06), 0, Math.PI*2); cx.fill();
  }
  // Tools leaning outside
  cx.strokeStyle = PAL.wood2; cx.lineWidth = Math.max(2, CELL*.06); cx.lineCap = 'round';
  cx.beginPath(); cx.moveTo(hx - CELL*.05, hy + hh - CELL*.1); cx.lineTo(hx - CELL*.15, hy + CELL*.4); cx.stroke(); // shovel
  cx.beginPath(); cx.moveTo(hx - CELL*.18, hy + CELL*.4); cx.lineTo(hx + CELL*.05, hy + CELL*.35); cx.stroke(); // shovel head
  lbl(hx + hw/2, hy - CELL*1.05, 'oficina', '#c8a070');
}

function _drawLake() {
  // Lake in bottom-left corner, extends off world edge
  const lakeX = PX - CELL * 2; // extends off left edge
  const lakeY = PY + (PEN_ROWS + BORDER_MARGIN + 10) * CELL;
  const lakeW = CELL * 14;
  const lakeH = PY + PH - lakeY + CELL * 3; // extends to and past bottom edge

  // Deep water base
  cx.fillStyle = PAL.waterDeep;
  cx.beginPath();
  // Winding shoreline — top edge is irregular
  cx.moveTo(lakeX, lakeY + CELL * 2);
  cx.quadraticCurveTo(lakeX + CELL*1.5, lakeY + CELL*.5, lakeX + CELL*3, lakeY + CELL*1.2);
  cx.quadraticCurveTo(lakeX + CELL*4.5, lakeY - CELL*.2, lakeX + CELL*6, lakeY + CELL*.8);
  cx.quadraticCurveTo(lakeX + CELL*7.5, lakeY + CELL*1.5, lakeX + CELL*9, lakeY + CELL*.5);
  cx.quadraticCurveTo(lakeX + CELL*10.5, lakeY - CELL*.3, lakeX + CELL*12, lakeY + CELL*.6);
  cx.lineTo(lakeX + lakeW, lakeY + CELL*1.5);
  cx.lineTo(lakeX + lakeW, lakeY + lakeH);
  cx.lineTo(lakeX, lakeY + lakeH);
  cx.closePath();
  cx.fill();

  // Water shimmer layer
  cx.fillStyle = PAL.water1; cx.globalAlpha = .75;
  cx.beginPath();
  cx.moveTo(lakeX, lakeY + CELL * 2.2);
  cx.quadraticCurveTo(lakeX + CELL*1.5, lakeY + CELL*.8, lakeX + CELL*3, lakeY + CELL*1.4);
  cx.quadraticCurveTo(lakeX + CELL*4.5, lakeY + CELL*.1, lakeX + CELL*6, lakeY + CELL*1.0);
  cx.quadraticCurveTo(lakeX + CELL*7.5, lakeY + CELL*1.7, lakeX + CELL*9, lakeY + CELL*.7);
  cx.quadraticCurveTo(lakeX + CELL*10.5, lakeY - CELL*.1, lakeX + CELL*12, lakeY + CELL*.8);
  cx.lineTo(lakeX + lakeW, lakeY + CELL*1.7);
  cx.lineTo(lakeX + lakeW, lakeY + lakeH);
  cx.lineTo(lakeX, lakeY + lakeH);
  cx.closePath();
  cx.fill();
  cx.globalAlpha = 1;

  // Animated shimmer highlights
  const t3 = Date.now() / 2000;
  for (let i = 0; i < 8; i++) {
    const sx = lakeX + CELL * (1.5 + i * 1.4 + Math.sin(t3 + i * 0.7) * 0.5);
    const sy = lakeY + CELL * (1.5 + Math.cos(t3 * .8 + i) * 0.8 + i * 0.4);
    cx.fillStyle = PAL.waterHi; cx.globalAlpha = .3 + .3 * Math.sin(t3 * 2 + i);
    cx.beginPath(); cx.ellipse(sx, sy, CELL * .25, CELL * .07, t3 * .3 + i, 0, Math.PI*2); cx.fill();
  }
  cx.globalAlpha = 1;

  // Shore rocks along waterline
  for (let i = 0; i < 10; i++) {
    const rx = lakeX + CELL * (1 + i * 1.2 + tn(i+50,3) * 0.6);
    const ry = lakeY + CELL * (.8 + tn(3,i+50) * 0.8);
    const rs = CELL * (.1 + tn(i+50,i+51) * .15);
    cx.fillStyle = tn(i,i+2) > .5 ? PAL.stone2 : PAL.stone3;
    cx.beginPath(); cx.ellipse(rx, ry, rs * 1.6, rs, tn(i,7)*Math.PI, 0, Math.PI*2); cx.fill();
  }

  // Lily pads
  for (let i = 0; i < 5; i++) {
    const lpx = lakeX + CELL * (2 + i * 2.1 + tn(i+70,2) * 0.8);
    const lpy = lakeY + CELL * (2 + tn(2,i+70) * 1.5);
    const lpr = CELL * (.2 + tn(i+70,i+71) * .12);
    cx.fillStyle = '#1a5010'; cx.beginPath(); cx.arc(lpx, lpy, lpr, 0, Math.PI*2); cx.fill();
    cx.fillStyle = '#22600e'; cx.beginPath(); cx.moveTo(lpx, lpy); cx.lineTo(lpx + lpr, lpy); cx.arc(lpx, lpy, lpr, 0, Math.PI * .5); cx.fill();
    // Flower on some lily pads
    if (tn(i+70, i+72) > .6) {
      cx.fillStyle = '#e8c0e0'; cx.beginPath(); cx.arc(lpx, lpy - lpr*.3, lpr*.35, 0, Math.PI*2); cx.fill();
      cx.fillStyle = '#f0d0a0'; cx.beginPath(); cx.arc(lpx, lpy - lpr*.3, lpr*.15, 0, Math.PI*2); cx.fill();
    }
  }

  lbl(lakeX + CELL * 5, lakeY + CELL * 3, 'lago', PAL.water1);
}

function _drawPier(px2, py2) {
  // Wooden pier: 1 cell wide, 3 cells long, extending into lake
  const pw2 = CELL * 0.9, ph2 = CELL * 3;
  const planks = 6;

  // Pier shadow
  cx.fillStyle = 'rgba(0,0,0,.3)'; cx.fillRect(px2 + 3, py2 + 3, pw2, ph2);

  // Pier base
  cx.fillStyle = PAL.wood3; cx.fillRect(px2, py2, pw2, ph2);
  // Plank lines
  cx.strokeStyle = PAL.woodDark; cx.lineWidth = 1;
  for (let i = 0; i <= planks; i++) {
    const py3 = py2 + i * (ph2 / planks);
    cx.beginPath(); cx.moveTo(px2, py3); cx.lineTo(px2 + pw2, py3); cx.stroke();
  }
  // Vertical grain
  cx.strokeStyle = PAL.woodGrain; cx.lineWidth = 1; cx.globalAlpha = .3;
  cx.beginPath(); cx.moveTo(px2 + pw2*.3, py2); cx.lineTo(px2 + pw2*.3, py2 + ph2); cx.stroke();
  cx.beginPath(); cx.moveTo(px2 + pw2*.7, py2); cx.lineTo(px2 + pw2*.7, py2 + ph2); cx.stroke();
  cx.globalAlpha = 1;

  // Pier posts (4 posts, 2 sides)
  const postH = CELL * .5;
  [0, 1, 2.8].forEach(frac => {
    const py3 = py2 + frac * CELL;
    cx.fillStyle = PAL.woodDark; cx.fillRect(px2 - CELL*.12, py3, CELL*.12, postH);
    cx.fillStyle = PAL.wood2; cx.fillRect(px2 - CELL*.1, py3, CELL*.08, postH - 2);
    cx.fillStyle = PAL.woodDark; cx.fillRect(px2 + pw2, py3, CELL*.12, postH);
    cx.fillStyle = PAL.wood2; cx.fillRect(px2 + pw2 + CELL*.02, py3, CELL*.08, postH - 2);
  });

  // Fishing line hanging off end
  const t4 = Date.now() / 1500;
  cx.strokeStyle = '#c8c0a0'; cx.lineWidth = 1; cx.lineCap = 'round';
  const lx2 = px2 + pw2 * .5, ly2 = py2 + ph2;
  cx.beginPath(); cx.moveTo(lx2, ly2);
  cx.quadraticCurveTo(lx2 + Math.sin(t4) * CELL * .3, ly2 + CELL * .5, lx2 + Math.sin(t4) * CELL * .2, ly2 + CELL * .9);
  cx.stroke();
  // Float bob
  const floatY = ly2 + CELL * .9 + Math.sin(t4 * 2) * CELL * .04;
  cx.fillStyle = '#e05030'; cx.beginPath(); cx.ellipse(lx2 + Math.sin(t4)*CELL*.2, floatY, CELL*.07, CELL*.04, 0, 0, Math.PI*2); cx.fill();

  lbl(px2 + pw2/2, py2 - CELL*.35, 'píer', '#7ab8e0');
}

function _drawLantern(x, y) {
  const lh = Math.max(28, CELL * .9);   // pole height
  const lw = Math.max(3,  CELL * .08);  // pole width
  const hw = Math.max(8,  CELL * .26);  // head width
  const hh = Math.max(9,  CELL * .3);   // head height

  // ── Warm glow on ground (radial gradient, large) ──
  const glowR = CELL * 3.5;
  const glow = cx.createRadialGradient(x, y, 0, x, y + lh * .2, glowR);
  glow.addColorStop(0,   'rgba(255,200,80,.22)');
  glow.addColorStop(0.4, 'rgba(255,160,40,.10)');
  glow.addColorStop(1,   'rgba(255,120,0,0)');
  cx.fillStyle = glow;
  cx.beginPath(); cx.arc(x, y + lh * .2, glowR, 0, Math.PI*2); cx.fill();

  // ── Pole ──
  // shadow
  cx.fillStyle = 'rgba(0,0,0,.3)';
  px(x - lw/2 + 2, y, lw, lh, 'rgba(0,0,0,.25)');
  // pole body
  px(x - lw/2, y, lw, lh, '#2a2218');
  px(x - lw/2 + 1, y, lw - 2, lh, '#3a3028');
  // pole highlight
  px(x - lw/2 + 1, y, 1, lh, 'rgba(255,255,200,.12)');

  // ── Bracket arm ──
  const bx = x, by = y + lh * .12;
  cx.strokeStyle = '#3a3028'; cx.lineWidth = Math.max(2, lw * .7); cx.lineCap = 'round';
  cx.beginPath(); cx.moveTo(bx, by); cx.lineTo(bx + hw * .6, by - hh * .5); cx.stroke();

  // ── Lantern head ──
  const hx = x + hw * .6, hy = by - hh * .5;
  // outer frame
  cx.fillStyle = '#2a2218';
  cx.beginPath();
  cx.moveTo(hx, hy - hh * .6);
  cx.lineTo(hx + hw * .5, hy - hh * .1);
  cx.lineTo(hx + hw * .45, hy + hh * .55);
  cx.lineTo(hx - hw * .45, hy + hh * .55);
  cx.lineTo(hx - hw * .5, hy - hh * .1);
  cx.closePath(); cx.fill();

  // glass panels — warm amber
  const panelAlpha = .85;
  cx.fillStyle = `rgba(255,180,40,${panelAlpha})`;
  cx.beginPath();
  cx.moveTo(hx, hy - hh * .45);
  cx.lineTo(hx + hw * .35, hy - hh * .05);
  cx.lineTo(hx + hw * .3, hy + hh * .42);
  cx.lineTo(hx - hw * .3, hy + hh * .42);
  cx.lineTo(hx - hw * .35, hy - hh * .05);
  cx.closePath(); cx.fill();

  // inner bright core
  const inner = cx.createRadialGradient(hx, hy + hh*.1, 0, hx, hy + hh*.1, hw*.5);
  inner.addColorStop(0, 'rgba(255,240,180,.95)');
  inner.addColorStop(0.5,'rgba(255,200,80,.6)');
  inner.addColorStop(1, 'rgba(255,140,20,0)');
  cx.fillStyle = inner;
  cx.beginPath();
  cx.moveTo(hx, hy - hh * .45);
  cx.lineTo(hx + hw * .35, hy - hh * .05);
  cx.lineTo(hx + hw * .3, hy + hh * .42);
  cx.lineTo(hx - hw * .3, hy + hh * .42);
  cx.lineTo(hx - hw * .35, hy - hh * .05);
  cx.closePath(); cx.fill();

  // frame bars — cross dividers on glass
  cx.strokeStyle = '#2a2218'; cx.lineWidth = Math.max(1, lw * .5); cx.lineCap = 'square';
  ln(hx, hy - hh * .45, hx, hy + hh * .42);        // vertical
  ln(hx - hw * .38, hy + hh * .14, hx + hw * .38, hy + hh * .14); // horizontal

  // cap on top
  cx.fillStyle = '#1e1810';
  cx.beginPath();
  cx.moveTo(hx - hw * .4, hy - hh * .42);
  cx.lineTo(hx, hy - hh * .75);
  cx.lineTo(hx + hw * .4, hy - hh * .42);
  cx.closePath(); cx.fill();
  // cap highlight
  cx.fillStyle = 'rgba(255,255,200,.08)';
  cx.beginPath();
  cx.moveTo(hx - hw * .15, hy - hh * .42);
  cx.lineTo(hx, hy - hh * .72);
  cx.lineTo(hx + hw * .15, hy - hh * .42);
  cx.closePath(); cx.fill();

  // small hook at bottom
  px(hx - lw*.3, hy + hh * .55, lw * .6, Math.max(2, lw), '#2a2218');
}

// ── Forest edge trees — drawn around world perimeter, irregular depth ──
function _drawForest() {
  const margin = CELL * .15;
  const trees2 = [];
  const worldRight = PX + PW;
  const worldBottom = PY + PH;

  function tryAdd(x, y, seed) {
    const s = CELL * (.7 + tn(seed, seed+1) * .5);
    // Skip if inside pen area
    if (x > PX - s && x < PX + PEN_COLS * CELL + s * 2 && y > PY - s && y < PY + PH + s) return;
    // Skip if too close to well
    const dx = x - well.x, dy = y - well.y;
    if (Math.sqrt(dx*dx+dy*dy) < CELL * 2.5) return;
    // Skip if on path corridor
    const pathY = gate.y + gate.h / 2;
    const pathPW = CELL * .9;
    if (x > PX + PEN_COLS * CELL && Math.abs(y - pathY) < pathPW + s * .5) return;
    trees2.push({ x, y, seed, s });
  }

  // TOP edge
  const topCount = Math.floor(PW / (CELL * .9));
  for (let i = 0; i < topCount; i++) {
    const baseX = PX + i * (CELL * .9) + tn(i, 300) * CELL * .5;
    const baseY = PY + margin + tn(300, i) * CELL * 1.2;
    tryAdd(baseX, baseY, i + 300);
    if (tn(i, 301) > .35) tryAdd(baseX + CELL * .45, baseY + CELL * (.4 + tn(i+1,301)*.5), i + 400);
  }

  // BOTTOM edge
  const botCount = Math.floor(PW / (CELL * .9));
  for (let i = 0; i < botCount; i++) {
    const baseX = PX + i * (CELL * .9) + tn(i, 500) * CELL * .5;
    const baseY = worldBottom - margin - tn(500, i) * CELL * 1.2;
    tryAdd(baseX, baseY, i + 500);
    if (tn(i, 501) > .35) tryAdd(baseX + CELL * .45, baseY - CELL * (.4 + tn(i+1,501)*.5), i + 600);
  }

  // LEFT edge
  const leftCount = Math.floor(PH / (CELL * .9));
  for (let i = 0; i < leftCount; i++) {
    const baseX = PX + margin + tn(i, 700) * CELL * 1.2;
    const baseY = PY + i * (CELL * .9) + tn(700, i) * CELL * .5;
    tryAdd(baseX, baseY, i + 700);
    if (tn(i, 701) > .4) tryAdd(baseX + CELL * (.4 + tn(i+1,701)*.4), baseY + CELL * .45, i + 800);
  }

  // RIGHT edge
  const rightCount = Math.floor(PH / (CELL * .9));
  for (let i = 0; i < rightCount; i++) {
    const baseX = worldRight - margin - tn(i, 900) * CELL * 1.2;
    const baseY = PY + i * (CELL * .9) + tn(900, i) * CELL * .5;
    tryAdd(baseX, baseY, i + 900);
    if (tn(i, 901) > .4) tryAdd(baseX - CELL * (.4 + tn(i+1,901)*.4), baseY + CELL * .45, i + 1000);
  }

  trees2.sort((a, b) => a.y - b.y);
  for (const t of trees2) {
    const type = Math.floor(tn(t.seed, t.seed+2) * 4);
    _drawForestTree(t.x, t.y, t.s, t.seed, type);
  }
}

// 4 forest tree types: spruce, wide spruce, birch, bush
function _drawForestTree(x, y, s, seed, type) {
  const t2 = Date.now() / 4000; // very slow sway
  const sway = Math.sin(t2 + seed * 1.7) * s * .008;

  if (type === 0) {
    // ── Spruce (ель) — tall narrow dark green ──
    const tw = Math.max(3, s * .18);
    const trunkH = s * .55;
    // shadow
    cx.fillStyle='rgba(0,0,0,.2)'; cx.beginPath(); cx.ellipse(x+2,y+s*.08,s*.28,s*.08,0,0,Math.PI*2); cx.fill();
    // trunk goes UP from y
    px(x-tw/2, y-trunkH, tw, trunkH, PAL.woodDark);
    px(x-tw/2+1, y-trunkH+1, tw-2, trunkH-1, '#2a1408');
    // 4 canopy layers — wider and covering trunk
    [
      {col:'#0d2904',hi:'#102e06',sz:.72,oy:.52},
      {col:'#0a2003',hi:'#0d2805',sz:.60,oy:.36},
      {col:'#081a02',hi:'#0b2204',sz:.46,oy:.20},
      {col:'#060e01',hi:'#091602',sz:.30,oy:.07},
    ].forEach(({col,hi,sz,oy}) => {
      const sw = sway*(1+oy);
      cx.fillStyle=col; cx.beginPath(); cx.moveTo(x+sw,y-s*oy-s*sz*.72); cx.lineTo(x-s*sz*.58+sw*.5,y-s*oy); cx.lineTo(x+s*sz*.58+sw*.5,y-s*oy); cx.closePath(); cx.fill();
      cx.fillStyle=hi; cx.beginPath(); cx.moveTo(x+sw,y-s*oy-s*sz*.72); cx.lineTo(x-s*sz*.58+sw*.5,y-s*oy); cx.lineTo(x-s*sz*.28,y-s*oy); cx.lineTo(x+sw,y-s*oy-s*sz*.48); cx.closePath(); cx.fill();
    });

  } else if (type === 1) {
    // ── Wide spruce (широкая ель) — fatter, slightly lighter ──
    const tw = Math.max(4, s * .22);
    const trunkH = s * .48;
    cx.fillStyle='rgba(0,0,0,.18)'; cx.beginPath(); cx.ellipse(x+2,y+s*.08,s*.38,s*.1,0,0,Math.PI*2); cx.fill();
    px(x-tw/2, y-trunkH, tw, trunkH, PAL.woodDark);
    px(x-tw/2+1, y-trunkH+1, tw-2, trunkH-1, '#2e1a0a');
    [
      {col:'#132e06',hi:'#183808',sz:.78,oy:.42},
      {col:'#0f2504',hi:'#132e06',sz:.64,oy:.26},
      {col:'#0b1c03',hi:'#0f2504',sz:.48,oy:.12},
    ].forEach(({col,hi,sz,oy}) => {
      const sw = sway*(1+oy*.8);
      cx.fillStyle=col; cx.beginPath(); cx.moveTo(x+sw,y-s*oy-s*sz*.62); cx.lineTo(x-s*sz*.68+sw*.5,y-s*oy); cx.lineTo(x+s*sz*.68+sw*.5,y-s*oy); cx.closePath(); cx.fill();
      cx.fillStyle=hi; cx.beginPath(); cx.moveTo(x+sw,y-s*oy-s*sz*.62); cx.lineTo(x-s*sz*.68+sw*.5,y-s*oy); cx.lineTo(x-s*sz*.32,y-s*oy); cx.lineTo(x+sw,y-s*oy-s*sz*.40); cx.closePath(); cx.fill();
    });

  } else if (type === 2) {
    // ── Birch (берёза) — white trunk, light round canopy ──
    const tw = Math.max(3, s * .14);
    const trunkH = s * .55;
    const trunkTop = y - trunkH; // top of trunk = where canopy attaches

    // shadow
    cx.fillStyle='rgba(0,0,0,.15)'; cx.beginPath(); cx.ellipse(x+2,y+s*.08,s*.2,s*.06,0,0,Math.PI*2); cx.fill();

    // trunk — grows downward from y, so base is at y, top is at y-trunkH
    px(x-tw/2, trunkTop, tw, trunkH, '#d8d0c0');
    // birch dark marks
    for (let i=0;i<4;i++) {
      const my = trunkTop + (i+.5) * trunkH/5 + tn(seed+i,seed)*s*.05;
      px(x-tw/2-1, my, tw+2, Math.max(2,s*.03), '#4a4030');
    }
    // trunk highlight strip
    px(x-tw/2+1, trunkTop+1, Math.max(1,tw-3), trunkH-2, '#e8e0d0');

    // round canopy — anchored at trunkTop, balls cluster around it
    const cr = s * .36;
    // offsets relative to trunkTop
    [
      { ox: -s*.1,  oy: -cr*.5  },
      { ox:  s*.12, oy: -cr*.35 },
      { ox:  0,     oy: -cr*.85 },
    ].forEach(({ox, oy}, i) => {
      const cy = trunkTop + oy;
      cx.fillStyle = i===2 ? '#1a3a0a' : '#1e4a0c';
      cx.beginPath(); cx.arc(x+ox+sway, cy, cr*(i===2?.68:.82), 0, Math.PI*2); cx.fill();
      // highlight
      cx.fillStyle='rgba(60,100,20,.25)';
      cx.beginPath(); cx.ellipse(x+ox+sway-cr*.2, cy-cr*.22, cr*.28, cr*.18, -.3, 0, Math.PI*2); cx.fill();
    });

  } else {
    // ── Bush (кустарник) — low round shrub ──
    const br = Math.max(6, s * .42);
    cx.fillStyle='rgba(0,0,0,.18)'; cx.beginPath(); cx.ellipse(x+2,y+br*.2,br*.8,br*.2,0,0,Math.PI*2); cx.fill();
    // multi-ball bush
    const cols=['#152808','#1a3209','#122006','#183008'];
    [[-br*.35,0],[br*.35,0],[0,-br*.28],[br*.12,br*.1],[-br*.18,br*.08]].forEach(([ox2,oy2],i) => {
      cx.fillStyle=cols[i%4];
      cx.beginPath(); cx.arc(x+ox2+sway*.5, y+oy2, br*(.5+tn(seed+i,seed+i+1)*.3), 0, Math.PI*2); cx.fill();
    });
    // highlight
    cx.fillStyle='rgba(40,80,10,.25)';
    cx.beginPath(); cx.ellipse(x-br*.15+sway,y-br*.3,br*.28,br*.18,-.3,0,Math.PI*2); cx.fill();
  }
}

// ── Ambient particles — tick (logic) + draw (visual) separate ──
function tickAmbient() {
  if (!ambientParts.length) initAmbient();
  for (const p of ambientParts) {
    p.x += p.vx; p.y += p.vy;
    if (p.x < PX) p.x = PX + PW; if (p.x > PX + PW) p.x = PX;
    if (p.y < PY) p.y = PY + PH; if (p.y > PY + PH) p.y = PY;
  }
}

function drawAmbient() {
  if (!ambientParts.length) return;
  const now = Date.now() / 1000;
  for (const p of ambientParts) {
    const inPenArea = p.x>PX+4 && p.x<PX+PW-4 && p.y>PY+4 && p.y<PY+PH-4;
    if (inPenArea) continue;
    const glow = .3 + .7 * Math.sin(now * p.speed * 60 + p.phase);
    cx.globalAlpha = glow * .7;
    cx.fillStyle = p.col;
    cx.beginPath(); cx.arc(p.x, p.y, p.r * (0.7 + glow * .5), 0, Math.PI*2); cx.fill();
    cx.globalAlpha = glow * .2;
    cx.beginPath(); cx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI*2); cx.fill();
  }
  cx.globalAlpha = 1;
}

function _drawDirt() {
  const penH = PEN_ROWS * CELL;
  // Base — only pen area
  px(PX, PY, PEN_COLS * CELL, penH, PAL.dirt1);

  // Tile variation — only pen cols/rows
  for (let c = 0; c < PEN_COLS; c++) for (let r = 0; r < PEN_ROWS; r++) {
    const tx=PX+c*CELL, ty=PY+r*CELL, n=tn(c+1,r+1), n2=tn2(c,r);
    if (n < 0.18) px(tx+1,ty+1,CELL-2,CELL-2,PAL.dirt2);
    else if (n < 0.05) px(tx+1,ty+1,CELL-2,CELL-2,PAL.dirt3);
    else if (n2 > .92) px(tx+1,ty+1,CELL-2,CELL-2,PAL.dirt4);
  }

  // Pebbles — only in pen
  for (let i = 0; i < 28; i++) {
    const px2=PX+tn(i,77)*PEN_COLS*CELL, py2=PY+tn(77,i)*penH;
    const pr2=Math.max(1,CELL*.04);
    cx.fillStyle=PAL.dirtPebble; cx.beginPath(); cx.ellipse(px2,py2,pr2*1.5,pr2,tn(i,0)*Math.PI,0,Math.PI*2); cx.fill();
    cx.fillStyle='rgba(255,255,255,.06)'; cx.beginPath(); cx.ellipse(px2-pr2*.3,py2-pr2*.3,pr2*.6,pr2*.4,0,0,Math.PI*2); cx.fill();
  }

  // Hoofprint tracks near horse
  const hcx=horse.x+horse.w*.5, hcy=horse.y+horse.h*.8;
  for (let i=0;i<6;i++) {
    const hpx=hcx+(i-3)*CELL*.35+tn(i,99)*CELL*.15;
    const hpy=hcy+tn(99,i)*CELL*.4;
    const hps=Math.max(2,CELL*.08);
    cx.fillStyle='rgba(0,0,0,.35)';
    cx.beginPath(); cx.ellipse(hpx,hpy,hps,hps*.6,.3,0,Math.PI*2); cx.fill();
    cx.beginPath(); cx.ellipse(hpx+hps,hpy,hps*.7,hps*.45,.3,0,Math.PI*2); cx.fill();
  }

  // Cracks — only pen area
  for (let c=0;c<PEN_COLS;c++) for (let r=0;r<PEN_ROWS;r++) {
    const tx=PX+c*CELL, ty=PY+r*CELL, n2=tn2(c,r);
    if (n2 < 0.12) {
      cx.strokeStyle=PAL.dirtCrack; cx.lineWidth=1;
      ln(tx+n2*CELL, ty+tn(c+5,r)*CELL, tx+n2*CELL+CELL*.28, ty+tn(c+5,r)*CELL+CELL*.12);
      if (n2<.06) ln(tx+n2*CELL+CELL*.14, ty+tn(c+5,r)*CELL+CELL*.06, tx+n2*CELL+CELL*.22, ty+tn(c+5,r)*CELL+CELL*.18);
    }
    if (n2 > 0.88) {
      cx.fillStyle=PAL.dirtStain; cx.globalAlpha=0.3;
      cx.beginPath(); cx.ellipse(tx+CELL*.25,ty+CELL*.3,CELL*.16,CELL*.1,n2,0,Math.PI*2); cx.fill();
      cx.globalAlpha=1;
    }
  }

  // Puddle near gate (inside)
  const pudX=PX+PEN_COLS*CELL-CELL*1.2, pudY=gate.y+gate.h+CELL*.4;
  cx.fillStyle=PAL.water3; cx.globalAlpha=.45;
  cx.beginPath(); cx.ellipse(pudX,pudY,CELL*.35,CELL*.15,-.2,0,Math.PI*2); cx.fill();
  cx.fillStyle=PAL.waterHi; cx.globalAlpha=.3;
  cx.beginPath(); cx.ellipse(pudX-CELL*.08,pudY-CELL*.04,CELL*.12,CELL*.05,0,0,Math.PI*2); cx.fill();
  cx.globalAlpha=1;

  // Subtle grid lines — pen only
  cx.strokeStyle='rgba(0,0,0,.15)'; cx.lineWidth=1;
  for (let c=0;c<=PEN_COLS;c++) ln(PX+c*CELL,PY,PX+c*CELL,PY+penH);
  for (let r=0;r<=PEN_ROWS;r++) ln(PX,PY+r*CELL,PX+PEN_COLS*CELL,PY+r*CELL);

  // Inner vignette — pen only
  const penW = PEN_COLS * CELL;
  const ig = cx.createRadialGradient(PX+penW/2,PY+penH/2,Math.min(penW,penH)*.25,PX+penW/2,PY+penH/2,Math.max(penW,penH)*.7);
  ig.addColorStop(0,'rgba(0,0,0,0)'); ig.addColorStop(1,'rgba(0,0,0,.22)');
  cx.fillStyle=ig; cx.fillRect(PX,PY,penW,penH);
}

function drawFence() {
  const lw=Math.max(3,CELL*.12), pr=Math.max(3,CELL*.09);

  // Drop shadow under fence
  cx.strokeStyle='rgba(0,0,0,.28)'; cx.lineWidth=lw+2; cx.lineCap='square';
  const pL = PX + PEN_COL_START * CELL;
  const pR = PX + (PEN_COL_END + 1) * CELL;
  const pT = PY + PEN_ROW_START * CELL;
  const pB = PY + (PEN_ROW_END + 1) * CELL;
  
  // Top-left corner
  cx.beginPath(); cx.moveTo(pL+1,pT+2); cx.lineTo(pR+1,pT+2); cx.stroke();
  // Left wall
  cx.beginPath(); cx.moveTo(pL+1,pT+2); cx.lineTo(pL+1,pB+2); cx.stroke();
  // Bottom wall
  cx.beginPath(); cx.moveTo(pL+1,pB+2); cx.lineTo(pR+1,pB+2); cx.stroke();
  // Right wall with gate
  cx.beginPath(); cx.moveTo(pR+1,pT+2); cx.lineTo(pR+1,gate.y+2); cx.stroke();
  cx.beginPath(); cx.moveTo(pR+1,gate.y+gate.h+2); cx.lineTo(pR+1,pB+2); cx.stroke();

  function seg(x1,y1,x2,y2) {
    // base
    cx.strokeStyle=PAL.fenceShadow; cx.lineWidth=lw+1; cx.lineCap='square'; ln(x1+1,y1+1,x2+1,y2+1);
    cx.strokeStyle=PAL.fence; cx.lineWidth=lw; ln(x1,y1,x2,y2);
    // grain lines
    const d=Math.sqrt((x2-x1)**2+(y2-y1)**2)||1;
    const ox=-(y2-y1)/d, oy=(x2-x1)/d;
    cx.strokeStyle=PAL.woodGrain; cx.lineWidth=1; cx.globalAlpha=.4;
    ln(x1+ox*.5,y1+oy*.5,x2+ox*.5,y2+oy*.5);
    cx.globalAlpha=1;
    // highlight
    cx.strokeStyle=PAL.fenceHi; cx.lineWidth=1; ln(x1+ox,y1+oy,x2+ox,y2+oy);
    // moss patches
    cx.fillStyle=PAL.fenceMoss; cx.globalAlpha=.35;
    for (let i=0;i<3;i++) {
      const t=.2+i*.3, mx=x1+(x2-x1)*t, my=y1+(y2-y1)*t;
      cx.beginPath(); cx.ellipse(mx+ox*.5,my+oy*.5,CELL*.1,CELL*.05,Math.atan2(y2-y1,x2-x1),0,Math.PI*2); cx.fill();
    }
    cx.globalAlpha=1;
  }
  function post(px2,py2,big) {
    const sz=(big?pr*2.4:pr*1.9);
    // shadow
    px(px2-sz/2+2,py2-sz/2+2,sz,sz,'rgba(0,0,0,.35)');
    px(px2-sz/2,py2-sz/2,sz,sz,PAL.woodDark);
    px(px2-sz/2+1,py2-sz/2+1,sz-2,sz-2,PAL.fencePost);
    // grain
    cx.fillStyle=PAL.woodGrain; cx.globalAlpha=.3;
    px(px2-sz/2+2,py2-sz/2+1,1,sz-2,'rgba(160,120,40,.4)');
    cx.globalAlpha=1;
    // highlight top
    px(px2-sz/2+1,py2-sz/2+1,sz-2,1,PAL.fenceHi);
    // moss on corner posts
    if(big){ cx.fillStyle=PAL.fenceMoss; cx.globalAlpha=.4; px(px2-sz/2,py2+sz/4,sz*.6,sz*.3,'#3a5020'); cx.globalAlpha=1; }
  }
  function gpost(px2,py2) {
    const sz=pr*2.6;
    px(px2-sz/2+2,py2-sz/2+2,sz,sz,'rgba(0,0,0,.35)');
    px(px2-sz/2,py2-sz/2,sz,sz,PAL.woodDark);
    px(px2-sz/2+1,py2-sz/2+1,sz-2,sz-2,'#b8860b');
    px(px2-sz/2+1,py2-sz/2+1,sz-2,1,'#ffd700');
    // golden glow
    cx.fillStyle='rgba(255,200,0,.15)'; cx.beginPath(); cx.arc(px2,py2,sz*.9,0,Math.PI*2); cx.fill();
  }

  // Pen fence — full 8×8 perimeter
  seg(pL,pT,pR,pT); seg(pL,pB,pR,pB); seg(pL,pT,pL,pB);
  seg(pR,pT,pR,gate.y); seg(pR,gate.y+gate.h,pR,pB);
  
  // Corner posts
  [[0,0],[PEN_COLS*CELL,0],[0,PEN_ROWS*CELL],[PEN_COLS*CELL,PEN_ROWS*CELL]].forEach(([dx,dy])=>
    post(pL+dx,pT+dy,true)
  );
  
  // Regular posts along walls
  for (let i=2;i<PEN_COLS;i+=2){post(pL+i*CELL,pT);post(pL+i*CELL,pB);}
  for (let i=2;i<PEN_ROWS;i+=2) post(pL,pT+i*CELL);
  
  // Posts on east wall (around gate)
  const gateRow = 9;
  for (let i=2;i<gateRow;i+=2) post(pR,pT+i*CELL);
  for (let i=gateRow+2;i<PEN_ROWS;i+=2) post(pR,pT+i*CELL);
  
  gpost(pR,gate.y); gpost(pR,gate.y+gate.h);

  if (gate.open) {
    cx.save();
    cx.strokeStyle='rgba(180,140,20,.4)'; cx.lineWidth=lw*.7;
    cx.setLineDash([CELL*.1,CELL*.07]); ln(pR,gate.y,pR-CELL*.9,gate.y+gate.h*.3);
    cx.setLineDash([]); cx.restore();
    const sz2=Math.max(7,CELL*.15); cx.font=`bold ${sz2}px monospace`;
    cx.fillStyle='#27ae60'; cx.textAlign='center'; cx.fillText('ABERTO',pR,gate.y-5); cx.textAlign='left';
  } else {
    cx.lineWidth=lw*1.5; cx.strokeStyle='#6b4a00'; cx.lineCap='square';
    ln(pR,gate.y+2,pR,gate.y+gate.h-2);
    cx.lineWidth=1; cx.strokeStyle='#d4a017'; ln(pR-1,gate.y+2,pR-1,gate.y+gate.h-2);
    const lx=pR, ly=gate.y+gate.h*.45;
    px(lx-4,ly-2,8,6,'#3a2800');
    px(lx-3,ly-2,6,5,'#8b6914');
    px(lx-2,ly-1,4,3,'#6b4a00');
    cx.strokeStyle='#c8a030'; cx.lineWidth=1.5; cx.lineCap='round';
    cx.beginPath(); cx.arc(lx,ly-3,2.5,Math.PI,0); cx.stroke();
    cx.fillStyle='rgba(180,120,0,.2)'; cx.beginPath(); cx.arc(lx,ly,5,0,Math.PI*2); cx.fill();
  }
  lbl(pR+CELL*.4, gate.y+gate.h*.5, 'portão', '#d4a017');
}

function drawWell() {
  const x=well.x, y=well.y, r=well.r, ri=Math.round, t=Date.now()/2000;

  // Shadow
  cx.fillStyle='rgba(0,0,0,.3)'; cx.beginPath(); cx.ellipse(x+3,y+r+3,r*.9,r*.25,0,0,Math.PI*2); cx.fill();

  // Stone ring — individual bricks
  const brickCols=['#3d3830','#4a4540','#353028','#42393a','#383230','#4e4844'];
  for (let a=0; a<Math.PI*2; a+=0.22) {
    const bx=x+Math.cos(a)*r*.85, by=y+Math.sin(a)*r*.85;
    const bsz=Math.max(3,r*.24);
    cx.fillStyle=brickCols[Math.floor(a*5)%6];
    cx.beginPath(); cx.ellipse(bx,by,bsz,bsz*.65,a,0,Math.PI*2); cx.fill();
    // mortar line
    cx.strokeStyle='rgba(0,0,0,.4)'; cx.lineWidth=1;
    cx.beginPath(); cx.ellipse(bx,by,bsz*.9,bsz*.55,a,0,Math.PI*2); cx.stroke();
    // moss on top bricks
    if (Math.sin(a*3)>.6) { cx.fillStyle=PAL.stoneMoss; cx.globalAlpha=.4; cx.beginPath(); cx.ellipse(bx,by-bsz*.2,bsz*.5,bsz*.2,0,0,Math.PI*2); cx.fill(); cx.globalAlpha=1; }
  }

  // Dark water
  cx.fillStyle=PAL.waterDeep; cx.beginPath(); cx.arc(x,y,r*.68,0,Math.PI*2); cx.fill();
  // Water shimmer animation
  cx.fillStyle=PAL.water1; cx.globalAlpha=.7; cx.beginPath(); cx.arc(x,y,r*.65,0,Math.PI*2); cx.fill(); cx.globalAlpha=1;
  // Shimmer highlight waves
  cx.fillStyle=PAL.waterHi;
  cx.beginPath(); cx.ellipse(x-r*.2+Math.sin(t)*r*.1, y-r*.18+Math.cos(t*.7)*r*.05, r*.32, r*.1, -.4+t*.1, 0, Math.PI*2); cx.fill();
  cx.globalAlpha=.5;
  cx.beginPath(); cx.ellipse(x+r*.15+Math.cos(t*.9)*r*.08, y+r*.1, r*.18, r*.06, .3, 0, Math.PI*2); cx.fill();
  cx.globalAlpha=1;

  // Stone rim
  cx.strokeStyle='#4a4540'; cx.lineWidth=Math.max(3,CELL*.1); cx.lineCap='square';
  cx.beginPath(); cx.arc(x,y,r*.85,0,Math.PI*2); cx.stroke();
  cx.strokeStyle='rgba(255,255,255,.06)'; cx.lineWidth=1;
  cx.beginPath(); cx.arc(x,y,r*.87,Math.PI*1.1,Math.PI*1.9); cx.stroke();

  // Wooden supports — posts go from water level UP to crossbeam
  const pw = Math.max(3, r*.15);
  const postTop = y - r*1.36;  // top of posts = bottom of crossbeam
  const postBot = y - r*.05;   // bottom of posts = just above water ring
  const postH = postBot - postTop;
  // Left post
  px(x-r*.72-pw/2, postTop, pw, postH, PAL.woodDark);
  px(x-r*.72-pw/2+1, postTop+1, pw-2, postH-1, PAL.wood2);
  px(x-r*.72-pw/2+1, postTop+1, pw-2, 1, PAL.woodHi);
  // Right post
  px(x+r*.72-pw/2, postTop, pw, postH, PAL.woodDark);
  px(x+r*.72-pw/2+1, postTop+1, pw-2, postH-1, PAL.wood2);
  px(x+r*.72-pw/2+1, postTop+1, pw-2, 1, PAL.woodHi);

  // Cross beam — sits on top of posts
  const cbh=Math.max(2,r*.13);
  px(x-r*.88, postTop, r*1.76, cbh, PAL.woodDark);
  px(x-r*.86, postTop+1, r*1.72, cbh-1, PAL.wood2);
  px(x-r*.86, postTop+1, r*1.72, 1, PAL.woodHi);
  // Grain on beam
  cx.strokeStyle=PAL.woodGrain; cx.lineWidth=1; cx.globalAlpha=.3;
  for (let i=0;i<3;i++) ln(x-r*.6+i*r*.4, postTop+1, x-r*.5+i*r*.4, postTop+cbh);
  cx.globalAlpha=1;

  // Rope with kinks — hangs from crossbeam
  cx.strokeStyle='#c8a070'; cx.lineWidth=Math.max(1.5,CELL*.05); cx.lineCap='round';
  const ropeSway=Math.sin(t*.5)*r*.04;
  const ropeTop = postTop + cbh;
  cx.beginPath(); cx.moveTo(x+ropeSway, ropeTop); cx.quadraticCurveTo(x+r*.08+ropeSway,y-r*.5,x,y-r*.72); cx.stroke();
  cx.strokeStyle='#a07848'; cx.lineWidth=1; cx.globalAlpha=.5;
  cx.beginPath(); cx.moveTo(x+ropeSway+1, ropeTop); cx.quadraticCurveTo(x+r*.1+ropeSway,y-r*.5,x+1,y-r*.72); cx.stroke();
  cx.globalAlpha=1;

  // Bucket on rope
  const bw=r*.48, bh2=r*.4, by2=y-r*.72;
  px(x-bw/2,by2,bw,bh2,PAL.woodDark);
  px(x-bw/2+1,by2+1,bw-2,bh2-2,PAL.water2);
  // bucket rim
  px(x-bw/2-1,by2-r*.08,bw+2,r*.09,'#2a2a2a');
  px(x-bw/2,by2-r*.06,bw,r*.07,'#3a4a62');
  // water in bucket
  cx.fillStyle=PAL.waterHi; cx.globalAlpha=.6;
  cx.beginPath(); cx.ellipse(x,by2+bh2*.2,bw*.35,bh2*.1,0,0,Math.PI*2); cx.fill();
  cx.globalAlpha=1;

  lbl(x, y-r*1.66, 'poço', '#7ab8e0');
}

function drawTrough() {
  const x = trough.x, y = trough.y, s = CELL * .55;
  px(x - s * .62, y - s * .28, s * 1.24, s * .56, PAL.stone3);
  px(x - s * .58, y - s * .24, s * 1.16, s * .48, PAL.stone2);
  px(x - s * .5, y - s * .18, s, s * .32, PAL.stone1);
  if (trough.full) {
    px(x - s * .46, y - s * .14, s * .92, s * .22, PAL.water1);
    cx.fillStyle = PAL.waterHi; cx.beginPath();
    cx.ellipse(x - s * .12, y - s * .08, s * .22, s * .06, -.2, 0, Math.PI * 2); cx.fill();
  }
  cx.strokeStyle = '#5a5048'; cx.lineWidth = 1; ln(x - s * .58, y - s * .24, x + s * .58, y - s * .24);
  lbl(x, y - s * .5, 'cocho', trough.full ? '#7ab8e0' : '#7a6040');
}

function drawHorse() {
  // Pixel-art chunky horse — goofy & lovable
  const x = Math.round(horse.x + horse.w / 2);
  const y = Math.round(horse.y + horse.h / 2);
  const s = Math.round(CELL * .14); // pixel unit
  const t = Date.now() / 600;
  const bob = Math.round(Math.sin(t) * 1.2);

  cx.save();
  cx.translate(x, y + bob);
  cx.imageSmoothingEnabled = false;

  function sq(rx, ry, rw, rh, c) {
    cx.fillStyle = c;
    cx.fillRect(Math.round(rx), Math.round(ry), Math.round(rw), Math.round(rh));
  }

  const bw = s*9, bh = s*6; // body size
  const bodyCol = horse.decorated ? '#c87040' : '#8B6340';
  const darkCol = horse.decorated ? '#9a5030' : '#6B4A28';
  const hiCol   = horse.decorated ? '#e09060' : '#AA7A50';

  // Shadow
  cx.fillStyle = 'rgba(0,0,0,.28)';
  cx.beginPath(); cx.ellipse(0, bh*.55, bw*.55, bh*.12, 0, 0, Math.PI*2); cx.fill();

  // Legs (4 stubby pixel legs)
  const legH = s*3.5;
  sq(-bw*.38, bh*.35, s*2, legH, darkCol);
  sq(-bw*.12, bh*.38, s*2, legH, darkCol);
  sq( bw*.1,  bh*.38, s*2, legH, darkCol);
  sq( bw*.34, bh*.35, s*2, legH, darkCol);
  // Hooves
  sq(-bw*.4,  bh*.35 + legH, s*2.4, s, '#111');
  sq(-bw*.14, bh*.38 + legH, s*2.4, s, '#111');
  sq( bw*.08, bh*.38 + legH, s*2.4, s, '#111');
  sq( bw*.32, bh*.35 + legH, s*2.4, s, '#111');

  // Body
  sq(-bw*.5, -bh*.45, bw, bh*.9, bodyCol);
  sq(-bw*.5, -bh*.45, bw, s, hiCol); // top highlight
  sq(-bw*.5,  bh*.36, bw, s*.8, darkCol); // belly

  // Neck + head
  sq(-bw*.46, -bh*.7, s*3.5, bh*.38, bodyCol); // neck
  // Head (bigcomicc nose)
  sq(-bw*.58, -bh*1.1, s*5.5, s*5, bodyCol);
  sq(-bw*.58, -bh*1.1, s*5.5, s, hiCol); // head top
  // Big goofy nose
  sq(-bw*.52, -bh*.52, s*4, s*2, darkCol);
  sq(-bw*.5,  -bh*.48, s*.8, s*.8, '#111'); // nostril L
  sq(-bw*.22, -bh*.48, s*.8, s*.8, '#111'); // nostril R

  // Eye
  sq(-bw*.32, -bh*1.0, s*1.4, s*1.4, '#111');
  sq(-bw*.32, -bh*1.0, s*.6, s*.6, '#fff'); // gleam

  // Ear
  sq(-bw*.4, -bh*1.22, s*1.2, s*1.8, bodyCol);
  sq(-bw*.38, -bh*1.22, s*.6, s, hiCol);

  // Mane (pixel strips)
  for (let i = 0; i < 4; i++) {
    sq(-bw*.44 + i*s*.6, -bh*1.12 - i*s*.4, s*.8, s*1.2 + i*s*.3, '#4a2a10');
  }

  // Tail
  sq(bw*.42, -bh*.28, s*1.4, s*4, '#6b4a28');
  sq(bw*.44, bh*.1, s, s*3, '#4a2a10');

  // Decoration flower if decorated
  if (horse.decorated) {
    sq(-bw*.25, -bh*1.28, s*2, s, '#f472b6');
    sq(-bw*.16, -bh*1.42, s, s*1.4, '#f472b6');
    sq(-bw*.34, -bh*1.42, s, s*1.4, '#f472b6');
    sq(-bw*.25, -bh*1.38, s*.8, s*.8, '#fbbf24'); // center
  }

  cx.restore();

  // Label
  const lt = horse.fed && horse.watered ? 'cavalinho ♥' : 'cavalinho';
  const lc = horse.fed && horse.watered ? '#fbbf24' : '#d4a017';
  lbl(x, Math.round(horse.y) - s*2, lt, lc);
}

function drawTrees() {
  for (const t of trees) {
    if (t.stump) _drawStump(t.x, t.y);
    else if (t.alive) t.isMonster ? _drawMonsterTree(t.x, t.y) : _drawTree(t.x, t.y);
  }
}

function _drawStump(x,y) {
  const s=CELL*.42, t=Date.now()/3000;
  cx.fillStyle='rgba(0,0,0,.25)'; cx.beginPath(); cx.ellipse(x+2,y+s*.25,s*.58,s*.15,0,0,Math.PI*2); cx.fill();
  // Roots
  cx.strokeStyle=PAL.wood3; cx.lineWidth=Math.max(2,s*.12); cx.lineCap='round';
  for (let i=0;i<3;i++) {
    const ra=Math.PI*.6+i*Math.PI*.35;
    cx.beginPath(); cx.moveTo(x,y+s*.1); cx.quadraticCurveTo(x+Math.cos(ra)*s*.5,y+Math.sin(ra)*s*.4+s*.1,x+Math.cos(ra)*s*.7,y+Math.sin(ra)*s*.5+s*.2); cx.stroke();
  }
  // Stump body
  px(x-s*.44,y-s*.2,s*.88,s*.44,PAL.woodDark);
  px(x-s*.4,y-s*.16,s*.8,s*.38,PAL.wood3);
  px(x-s*.4,y-s*.16,s*.8,s*.07,PAL.woodHi);
  // Growth rings
  cx.strokeStyle='#2a1a08'; cx.lineWidth=1;
  cx.beginPath(); cx.ellipse(x,y-s*.14,s*.38,s*.13,0,0,Math.PI*2); cx.stroke();
  cx.fillStyle='#4a2e10'; cx.beginPath(); cx.ellipse(x,y-s*.14,s*.3,s*.11,0,0,Math.PI*2); cx.fill();
  cx.strokeStyle='#3a2008'; cx.lineWidth=1; cx.beginPath(); cx.ellipse(x,y-s*.14,s*.18,s*.07,0,0,Math.PI*2); cx.stroke();
  cx.fillStyle='#5a3818'; cx.beginPath(); cx.ellipse(x,y-s*.14,s*.08,s*.04,0,0,Math.PI*2); cx.fill();
  // Tiny sprout growing back
  cx.strokeStyle='#2a5010'; cx.lineWidth=Math.max(1,s*.06);
  cx.beginPath(); cx.moveTo(x+s*.1,y-s*.14); cx.quadraticCurveTo(x+s*.2,y-s*.5,x+s*.15,y-s*.7+Math.sin(t)*s*.05); cx.stroke();
  cx.fillStyle='#3a7020'; cx.beginPath(); cx.ellipse(x+s*.15,y-s*.7,s*.12,s*.08,-.5,0,Math.PI*2); cx.fill();
}

function _drawTree(x,y) {
  const s=CELL*.9, t=Date.now()/3500, sway=Math.sin(t)*s*.012;
  cx.fillStyle='rgba(0,0,0,.2)'; cx.beginPath(); cx.ellipse(x+2,y+s*.14,s*.38,s*.11,0,0,Math.PI*2); cx.fill();
  // Roots
  cx.strokeStyle=PAL.wood3; cx.lineWidth=Math.max(1.5,s*.08); cx.lineCap='round';
  for (let i=0;i<3;i++) {
    const ra=Math.PI*.5+i*Math.PI*.4;
    cx.beginPath(); cx.moveTo(x,y+s*.05); cx.quadraticCurveTo(x+Math.cos(ra)*s*.35,y+Math.sin(ra)*s*.3,x+Math.cos(ra)*s*.55,y+Math.sin(ra)*s*.45); cx.stroke();
  }
  // Trunk
  const tw=Math.max(4,s*.22);
  px(x-tw/2,y-s*.06,tw,s*.52,PAL.woodDark);
  px(x-tw/2+1,y-s*.04,tw-2,s*.48,PAL.wood3);
  // Trunk grain
  cx.strokeStyle=PAL.woodGrain; cx.lineWidth=1; cx.globalAlpha=.25;
  ln(x-tw*.1,y-s*.02,x-tw*.1,y+s*.42); ln(x+tw*.15,y,x+tw*.15,y+s*.38);
  cx.globalAlpha=1;

  // Canopy layers — 3 triangles with sway
  const layers=[
    {col:'#1a4a0a',hi:'#235e10',sh:'#0e2e05',sz:.56,oy:.46},
    {col:'#153d07',hi:'#1c4d0c',sh:'#0b2503',sz:.47,oy:.3},
    {col:'#102e04',hi:'#183808',sh:'#081c02',sz:.34,oy:.14},
  ];
  layers.forEach(({col,hi,sh,sz,oy})=>{
    const sw=sway*(1+oy);
    // Shadow layer
    cx.fillStyle=sh; cx.globalAlpha=.5;
    cx.beginPath(); cx.moveTo(x+sw+s*.04,y-s*oy-s*sz*.52+s*.03); cx.lineTo(x-s*sz*.52+sw,y-s*oy+s*.03); cx.lineTo(x+s*sz*.52+sw,y-s*oy+s*.03); cx.closePath(); cx.fill(); cx.globalAlpha=1;
    // Main
    cx.fillStyle=col;
    cx.beginPath(); cx.moveTo(x+sw,y-s*oy-s*sz*.55); cx.lineTo(x-s*sz*.52+sw*.5,y-s*oy); cx.lineTo(x+s*sz*.52+sw*.5,y-s*oy); cx.closePath(); cx.fill();
    // Highlight
    cx.fillStyle=hi;
    cx.beginPath(); cx.moveTo(x+sw,y-s*oy-s*sz*.55); cx.lineTo(x-s*sz*.52+sw*.5,y-s*oy); cx.lineTo(x-s*sz*.28+sw*.3,y-s*oy); cx.lineTo(x+sw,y-s*oy-s*sz*.38); cx.closePath(); cx.fill();
  });

  // Apple fruits
  for (let i=0;i<3;i++) {
    const ax=x+sway+(i-1)*s*.22+Math.sin(i*2.7)*s*.1;
    const ay=y-s*.22-i*s*.08+Math.cos(i*1.8)*s*.06;
    const ar=Math.max(1.5,s*.05);
    circ(ax,ay,ar,'#8b1a1a'); circ(ax,ay,ar*.8,'#c0392b');
    cx.fillStyle='rgba(255,255,255,.3)'; cx.beginPath(); cx.ellipse(ax-ar*.3,ay-ar*.3,ar*.3,ar*.2,-.3,0,Math.PI*2); cx.fill();
  }

  // Firefly / light spec in canopy at night
  const spec=Math.sin(t*2.3+x)*.5+.5;
  if (spec>.75) {
    cx.fillStyle='rgba(200,255,100,.4)'; cx.globalAlpha=spec-.75;
    cx.beginPath(); cx.arc(x+sway+s*.12,y-s*.35,s*.04,0,Math.PI*2); cx.fill();
    cx.globalAlpha=1;
  }

  lbl(x,y-s*1.0,'árvore','#4a8a50');
}

function _drawMonsterTree(x,y) {
  const s=CELL*.9, t=Date.now()/800, sway=Math.sin(t)*(s*.02);
  cx.fillStyle='rgba(80,0,0,.2)'; cx.beginPath(); cx.ellipse(x+2,y+s*.14,s*.44,s*.13,0,0,Math.PI*2); cx.fill();

  // Dark twisted trunk
  const tw=Math.max(5,s*.26);
  px(x-tw/2,y-s*.06,tw,s*.54,PAL.woodDark);
  px(x-tw/2+1,y-s*.04,tw-2,s*.5,'#2a1408');
  // Gnarled roots
  [[-.5,.44],[.42,.4],[-.28,.52]].forEach(([rx,ry])=>{
    px(x+s*rx*tw*.045,y+s*ry,Math.max(3,tw*.45),Math.max(2,s*.07),'#1a0c04');
  });
  // Crack in trunk
  cx.strokeStyle='#8b0000'; cx.lineWidth=1; cx.globalAlpha=.5;
  cx.beginPath(); cx.moveTo(x,y-s*.02); cx.lineTo(x-s*.04,y+s*.2); cx.lineTo(x+s*.02,y+s*.42); cx.stroke();
  cx.globalAlpha=1;

  // Dark canopy — twisted triangles
  const layers=[
    {col:'#0c2204',hi:'#0f2e06',sh:'rgba(60,0,0,.3)',sz:.58,oy:.47},
    {col:'#091a02',hi:'#0c2404',sh:'rgba(60,0,0,.3)',sz:.48,oy:.3},
    {col:'#060e01',hi:'#091602',sh:'rgba(60,0,0,.3)',sz:.35,oy:.13},
  ];
  layers.forEach(({col,hi,sh,sz,oy})=>{
    const sw=sway*(1+oy*.5);
    cx.fillStyle=sh; cx.beginPath(); cx.moveTo(x+sw+s*.04,y-s*oy-s*sz*.55+s*.03); cx.lineTo(x-s*sz*.56+sw,y-s*oy+s*.03); cx.lineTo(x+s*sz*.56+sw,y-s*oy+s*.03); cx.closePath(); cx.fill();
    cx.fillStyle=col; cx.beginPath(); cx.moveTo(x+sw,y-s*oy-s*sz*.58); cx.lineTo(x-s*sz*.55+sw*.5,y-s*oy); cx.lineTo(x+s*sz*.55+sw*.5,y-s*oy); cx.closePath(); cx.fill();
    cx.fillStyle=hi; cx.beginPath(); cx.moveTo(x+sw,y-s*oy-s*sz*.58); cx.lineTo(x-s*sz*.55+sw*.5,y-s*oy); cx.lineTo(x-s*sz*.28,y-s*oy); cx.lineTo(x+sw,y-s*oy-s*sz*.4); cx.closePath(); cx.fill();
  });

  // Red aura glow
  const gr=cx.createRadialGradient(x,y-s*.32,0,x,y-s*.32,s*.65);
  gr.addColorStop(0,'rgba(180,20,20,.22)'); gr.addColorStop(1,'rgba(180,20,20,0)');
  cx.fillStyle=gr; cx.beginPath(); cx.arc(x,y-s*.32,s*.65,0,Math.PI*2); cx.fill();

  // Animated glowing eyes
  const eyeGlow=.5+.5*Math.sin(t*1.2);
  // Eye glow halo
  cx.fillStyle=`rgba(200,0,0,${eyeGlow*.3})`; cx.beginPath(); cx.arc(x-s*.13,y-s*.42,s*.1,0,Math.PI*2); cx.fill();
  cx.beginPath(); cx.arc(x+s*.13,y-s*.42,s*.1,0,Math.PI*2); cx.fill();
  // Eyes
  circ(x-s*.13,y-s*.42,Math.max(2,s*.065),'#8b0000');
  circ(x+s*.13,y-s*.42,Math.max(2,s*.065),'#8b0000');
  if (eyeGlow>.6) {
    circ(x-s*.13,y-s*.42,Math.max(1,s*.04),`rgba(255,40,40,${eyeGlow})`);
    circ(x+s*.13,y-s*.42,Math.max(1,s*.04),`rgba(255,40,40,${eyeGlow})`);
  }
  // Pupil gleam
  cx.fillStyle=`rgba(255,180,0,${eyeGlow*.8})`;
  cx.fillRect(Math.round(x-s*.13-1),Math.round(y-s*.42-1),2,2);
  cx.fillRect(Math.round(x+s*.13-1),Math.round(y-s*.42-1),2,2);

  // Floating dark spores
  for (let i=0;i<4;i++) {
    const sa=t*.4+i*Math.PI*.5, sr=s*.55+Math.sin(t+i)*s*.1;
    const sx=x+Math.cos(sa)*sr, sy=y-s*.3+Math.sin(sa*.7)*s*.2;
    cx.fillStyle='rgba(60,20,20,.5)'; cx.globalAlpha=.4+.3*Math.sin(t*2+i);
    cx.beginPath(); cx.arc(sx,sy,s*.035,0,Math.PI*2); cx.fill();
  }
  cx.globalAlpha=1;

  lbl(x,y-s*1.02,'⚠ árvore','#c0392b');
}

function drawItems() {
  for (const it of items) {
    if (it.held || it.gone) continue;
    const s = CELL * .46;
    cx.save(); cx.translate(Math.round(it.x), Math.round(it.y));
    drawItemSprite(it.type, it.color, s, it.filled);
    cx.restore();
    lbl(it.x, it.y - s * .95, it.label, _itemLabelCol(it.type));
  }
}

function _itemLabelCol(type) {
  const m = { axe:'#9b7fcf', apple:'#e74c3c', mushroom:'#c87030', rock:'#8a8a9a',
               stick:'#8a6030', flower:'#c05090', bucket:'#6090c8', hay:'#a07020' };
  return m[type] || '#aaa';
}

// Unified sprite renderer — works both for world items (large) and held item (small/mini)
// Origin = centre of item, scale = s (half-size unit)
function drawItemSprite(type, color, s, filled) {
  const ri = Math.round;
  switch (type) {
    case 'axe': {
      cx.rotate(-.42);
      px(-s*.07, 0, s*.14, s*.88, PAL.woodDark); px(-s*.05, 0, s*.1, s*.84, PAL.wood2);
      cx.fillStyle='#3a3a40'; cx.beginPath(); cx.moveTo(-s*.34,-s*.22); cx.lineTo(s*.26,-s*.38); cx.lineTo(s*.3,s*.08); cx.lineTo(-s*.28,s*.04); cx.closePath(); cx.fill();
      cx.fillStyle='#5a5a62'; cx.beginPath(); cx.moveTo(-s*.34,-s*.22); cx.lineTo(s*.26,-s*.38); cx.lineTo(s*.2,-s*.28); cx.lineTo(-s*.26,-s*.14); cx.closePath(); cx.fill();
      break;
    }
    case 'apple': {
      const r = s * .56;
      cx.fillStyle='rgba(0,0,0,.18)'; cx.beginPath(); cx.ellipse(0,r*.7,r*.6,r*.17,0,0,Math.PI*2); cx.fill();
      cx.fillStyle='#8b1a1a'; cx.beginPath(); cx.arc(0,0,r,0,Math.PI*2); cx.fill();
      cx.fillStyle='#c0392b'; cx.beginPath(); cx.arc(0,0,r*.82,0,Math.PI*2); cx.fill();
      cx.fillStyle='rgba(255,255,255,.33)'; cx.beginPath(); cx.ellipse(-r*.25,-r*.25,r*.28,r*.2,-.4,0,Math.PI*2); cx.fill();
      px(-1,-r,2,r*.38,PAL.woodDark);
      cx.fillStyle='#1a6b14'; cx.beginPath(); cx.moveTo(1,-r); cx.lineTo(s*.22,-r-s*.18); cx.lineTo(1,-r); cx.closePath(); cx.fill();
      break;
    }
    case 'mushroom': {
      px(-s*.12,s*.02,s*.24,s*.46,PAL.stone2); px(-s*.1,s*.04,s*.2,s*.42,'#c8c0a8');
      cx.fillStyle='#6b0a0a'; cx.beginPath(); cx.ellipse(0,s*.02,s*.46,s*.36,0,Math.PI,0); cx.fill();
      cx.fillStyle='#8b1a1a'; cx.beginPath(); cx.ellipse(0,s*.02,s*.4,s*.3,0,Math.PI,0); cx.fill();
      [[-.14,-.16],[.1,-.22],[-.02,-.28]].forEach(([dx,dy])=>circ(s*dx,s*dy,Math.max(2,s*.08),'#e8d0c0'));
      break;
    }
    case 'rock': {
      cx.fillStyle='rgba(0,0,0,.2)'; cx.beginPath(); cx.ellipse(0,s*.32,s*.5,s*.13,0,0,Math.PI*2); cx.fill();
      cx.fillStyle=PAL.stone3; cx.beginPath(); cx.moveTo(-s*.5,s*.1); cx.lineTo(-s*.42,-s*.28); cx.lineTo(-s*.1,-s*.42); cx.lineTo(s*.3,-s*.36); cx.lineTo(s*.5,0); cx.lineTo(s*.42,s*.3); cx.lineTo(-s*.1,s*.38); cx.closePath(); cx.fill();
      cx.fillStyle=PAL.stone2; cx.beginPath(); cx.moveTo(-s*.44,0); cx.lineTo(-s*.36,-s*.24); cx.lineTo(s*.2,-s*.3); cx.lineTo(s*.4,0); cx.lineTo(s*.36,s*.2); cx.lineTo(-s*.08,s*.28); cx.closePath(); cx.fill();
      cx.strokeStyle='#5a5650'; cx.lineWidth=1; cx.beginPath(); cx.moveTo(-s*.42,-s*.28); cx.lineTo(s*.3,-s*.36); cx.stroke();
      break;
    }
    case 'stick': {
      cx.rotate(.38);
      px(-s*.42,-s*.06,s*.84,s*.12,PAL.woodDark); px(-s*.4,-s*.04,s*.8,s*.08,PAL.wood3);
      cx.save(); cx.translate(-s*.12,0); cx.rotate(-.5); px(0,-s*.03,s*.32,s*.06,PAL.woodDark); px(1,-s*.02,s*.28,s*.04,'#5a3a1a'); cx.restore();
      break;
    }
    case 'flower': {
      ['#8b1060','#c0392b','#6b0ab8','#1a5bbf','#d4a017'].forEach((c,i)=>{
        const a=Math.PI*2*i/5; circ(Math.cos(a)*s*.34,Math.sin(a)*s*.34,Math.max(2,s*.17),c);
      }); circ(0,0,Math.max(2,s*.14),'#d4a017'); circ(0,0,Math.max(1,s*.06),'#8b6914');
      break;
    }
    case 'bucket': {
      const bw=s*.56, bh2=s*.6;
      cx.fillStyle='rgba(0,0,0,.18)'; cx.beginPath(); cx.ellipse(0,bh2*.6,bw*.5,bh2*.12,0,0,Math.PI*2); cx.fill();
      cx.fillStyle=filled?'#1a3a7a':'#2a3a5a'; cx.beginPath(); cx.moveTo(-bw*.5,-bh2*.1); cx.lineTo(bw*.5,-bh2*.1); cx.lineTo(bw*.42,bh2*.5); cx.lineTo(-bw*.42,bh2*.5); cx.closePath(); cx.fill();
      cx.fillStyle=filled?'#1e4898':'#334a70'; cx.beginPath(); cx.moveTo(-bw*.5,-bh2*.1); cx.lineTo(bw*.5,-bh2*.1); cx.lineTo(bw*.42,bh2*.1); cx.lineTo(-bw*.42,bh2*.1); cx.closePath(); cx.fill();
      px(-bw*.54,-bh2*.18,bw*1.08,bh2*.12,'#222a3a'); px(-bw*.52,-bh2*.16,bw*1.04,bh2*.08,'#3a4a62');
      cx.strokeStyle='#4a5a72'; cx.lineWidth=Math.max(1.5,s*.06); cx.lineCap='round'; cx.beginPath(); cx.arc(0,-bh2*.28,bw*.38,.2,Math.PI-.2); cx.stroke();
      if(filled){cx.fillStyle='rgba(40,100,220,.65)'; cx.beginPath(); cx.moveTo(-bw*.44,-bh2*.06); cx.lineTo(bw*.44,-bh2*.06); cx.lineTo(bw*.42,bh2*.1); cx.lineTo(-bw*.42,bh2*.1); cx.closePath(); cx.fill();}
      // label suffix shows water state — handled in drawItems lbl call
      break;
    }
    case 'hay': {
      px(-s*.38,-s*.22,s*.76,s*.44,PAL.woodDark); px(-s*.36,-s*.2,s*.72,s*.4,'#8b6200'); px(-s*.36,-s*.2,s*.72,s*.08,'#a07010');
      cx.strokeStyle='#c8a030'; cx.lineWidth=1; for(let i=0;i<5;i++) ln(-s*.28+i*s*.14,-s*.2,-s*.24+i*s*.14,s*.2);
      cx.strokeStyle='#6b4010'; cx.lineWidth=1; ln(-s*.36,0,s*.36,0);
      break;
    }
    default: circ(0,0,s*.34,color); break;
  }
}

// Held-item mini render (called from drawPlayer, already inside cx.save/translate)
function drawMini(type, color, s, filled) {
  drawItemSprite(type, color, s, filled);
}

function drawMonster() {
  // Pixel-art spooky shrub monster — humorously grumpy
  const r = monster.r, x = Math.round(monster.x), y = Math.round(monster.y);
  const t = Date.now() / 350;
  const bob = Math.round(Math.sin(t * 2.2) * 2);
  const s = Math.round(r * 0.22);

  cx.save();
  cx.translate(x, y + bob);
  cx.imageSmoothingEnabled = false;

  function sq(rx, ry, rw, rh, c) {
    cx.fillStyle = c;
    cx.fillRect(Math.round(rx), Math.round(ry), Math.round(rw), Math.round(rh));
  }

  // Shadow
  cx.fillStyle = 'rgba(0,0,0,.4)';
  cx.beginPath(); cx.ellipse(0, r*.85, r*.6, r*.15, 0, 0, Math.PI*2); cx.fill();

  // Aura glow
  cx.fillStyle = 'rgba(10,80,10,.18)';
  cx.beginPath(); cx.arc(0, 0, r*1.7, 0, Math.PI*2); cx.fill();

  // Body — chunky blob
  const bd = r * .78;
  sq(-bd, -bd*.9, bd*2, bd*2, '#0f4a1a');
  // Body highlight
  sq(-bd*.6, -bd*.7, bd*.9, bd*.5, '#1a6b28');
  // Body spots
  sq(-bd*.3,  bd*.1, bd*.5, bd*.3, '#0a3012');
  sq( bd*.15, -bd*.3, bd*.4, bd*.3, '#0a3012');

  // Leafy top (jagged)
  const leafCol = '#1a5a20';
  const leafHi  = '#2a8030';
  for (let i = 0; i < 5; i++) {
    const lx = -bd + i * bd*.4 + Math.round(Math.sin(t + i) * s);
    sq(lx, -bd*1.3 - (i%2)*s*1.5, bd*.5, bd*.7, leafCol);
    sq(lx + s*.3, -bd*1.3 - (i%2)*s*1.5, s*.6, s*.5, leafHi);
  }

  // Arms / tendrils
  const wag = Math.round(Math.sin(t * 1.8) * s * 2);
  sq(-bd*1.5, -bd*.2 + wag, bd*.7, bd*.3, '#0f4a1a'); // L
  sq( bd*.8,  -bd*.2 - wag, bd*.7, bd*.3, '#0f4a1a'); // R
  sq(-bd*1.8,  bd*.06 + wag, bd*.6, bd*.5, '#0a3012'); // claw L
  sq( bd*1.2,  bd*.06 - wag, bd*.6, bd*.5, '#0a3012'); // claw R

  // Eyes — big and angry
  const ew = Math.round(r * .34), eh = Math.round(r * .28);
  sq(-bd*.52, -bd*.32, ew, eh, '#d4c010'); // L
  sq( bd*.14,  -bd*.32, ew, eh, '#d4c010'); // R
  // Pupils track player
  const pdx = P.x - x, pdy = P.y - y, plen = Math.sqrt(pdx*pdx+pdy*pdy)||1;
  const px2 = Math.round((pdx/plen)*s*.5), py2 = Math.round((pdy/plen)*s*.3);
  sq(-bd*.52 + s*.3 + px2, -bd*.32 + s*.2 + py2, s*.9, s*.9, '#111'); // L pupil
  sq( bd*.14 + s*.3 + px2, -bd*.32 + s*.2 + py2, s*.9, s*.9, '#111'); // R pupil
  // Angry eyebrows
  sq(-bd*.58, -bd*.46, ew*.7, s*.5, '#c0392b');
  sq( bd*.12,  -bd*.46, ew*.7, s*.5, '#c0392b');

  // Mouth — grumpy frown with fangs
  const mw = Math.round(bd*.9), my = Math.round(bd*.3);
  sq(-mw*.5, my, mw, s*.8, '#060e06');
  sq(-mw*.35, my - s*.3, s*.8, s*1.2, '#e8e0d0'); // fang L
  sq( mw*.35 - s*.8, my - s*.3, s*.8, s*1.2, '#e8e0d0'); // fang R
  // Drool
  const drool = Math.round(Math.sin(t * 1.8) * s * 1.5 + s);
  sq(-s*.4, my + s*.8, s*.7, drool, 'rgba(100,200,80,.5)');

  cx.restore();
  lbl(x, y - r * 1.6, 'monstro', '#c0392b');
}

function drawPlayer() {
  // Pixel-art hero: chunky & expressive
  const r = P.r, x = Math.round(P.x), y = Math.round(P.y), t = Date.now() / 400;
  const moving = !!(pTarget || pathWaypoints.length);
  const bob = moving ? Math.round(Math.sin(t * 5) * 2) : Math.round(Math.sin(t) * 1);
  const s = Math.round(r * 0.22); // pixel grid unit

  cx.save();
  cx.translate(x, y);
  cx.imageSmoothingEnabled = false;

  function sq(rx, ry, rw, rh, c) {
    cx.fillStyle = c;
    cx.fillRect(Math.round(rx), Math.round(ry), Math.round(rw), Math.round(rh));
  }

  // Shadow
  cx.fillStyle = 'rgba(0,0,0,.3)';
  cx.beginPath(); cx.ellipse(0, r*.75, r*.5, r*.12, 0, 0, Math.PI*2); cx.fill();

  // Legs
  const legY = r * .32 + bob;
  if (moving) {
    const lk = Math.round(Math.sin(t * 5) * s * 1.5);
    sq(-s*1.6, legY, s*1.4, r*.52 + lk, '#1a3a6a');
    sq(s*.2,   legY, s*1.4, r*.52 - lk, '#1a3a6a');
    sq(-s*1.8, legY + r*.5 + lk - s, s*1.8, s*1.2, '#1a1208'); // boot L
    sq(s*.1,   legY + r*.5 - lk - s, s*1.8, s*1.2, '#1a1208'); // boot R
  } else {
    sq(-s*1.6, legY, s*1.4, r*.48, '#1a3a6a');
    sq(s*.2,   legY, s*1.4, r*.48, '#1a3a6a');
    sq(-s*1.8, legY + r*.44, s*1.8, s*1.2, '#1a1208');
    sq(s*.1,   legY + r*.44, s*1.8, s*1.2, '#1a1208');
  }

  // Body (tunic)
  sq(-s*2.2, -r*.2 + bob*.3, s*4.4, r*.56, '#2563a8');
  sq(-s*2.2, -r*.2 + bob*.3, s*4.4, s, '#3b7fd4'); // shoulder highlight
  // Belt
  sq(-s*2.4, r*.28 + bob*.3, s*4.8, s, '#5c3d1e');
  sq(-s*.4,  r*.28 + bob*.3, s*.8, s, '#c8a030'); // buckle

  // Arms
  const armSwing = moving ? Math.round(Math.sin(t * 5) * s * 2) : 0;
  sq(-s*3.2,  -r*.15 + armSwing + bob*.3, s*1.2, r*.46, '#2563a8'); // L
  sq( s*2,   -r*.15 - armSwing + bob*.3, s*1.2, r*.46, '#2563a8'); // R
  sq(-s*3.4,  r*.24 + armSwing + bob*.3, s*1.4, s*1.2, '#e8c97a'); // hand L
  sq( s*2,    r*.24 - armSwing + bob*.3, s*1.4, s*1.2, '#e8c97a'); // hand R

  // Held item (above right hand)
  if (playerHeld) {
    const it = items.find(i => i.id === playerHeld);
    if (it) {
      cx.save();
      cx.translate(Math.round(s*3.6), Math.round(-r*.1 - armSwing + bob*.3));
      drawMini(it.type, it.color, r * .52, it.filled);
      cx.restore();
    }
  }

  // Scarf
  sq(-s*2.2, -r*.26 + bob*.3, s*4.4, s*1.1, '#c0392b');

  // Head
  const hx = -s*2, hy = -r*.96 + bob*.5;
  sq(hx, hy, s*4, s*4.2, '#e8c97a'); // face
  sq(hx, hy, s*4, s, '#6b3a0e'); // hair top
  sq(hx - s*.5, hy, s*.8, s*3, '#6b3a0e'); // sideburn L
  sq(hx + s*3.6, hy, s*.8, s*3, '#6b3a0e'); // sideburn R

  // Eyes (pixel dots)
  sq(hx + s*.6, hy + s*1.5, s*.9, s*.9, '#111');
  sq(hx + s*2.4, hy + s*1.5, s*.9, s*.9, '#111');
  // Eye gleam
  sq(hx + s*.6, hy + s*1.5, s*.4, s*.4, '#fff');
  sq(hx + s*2.4, hy + s*1.5, s*.4, s*.4, '#fff');
  // Eyebrow
  sq(hx + s*.4, hy + s*1.0, s*1.2, s*.4, '#5a3010');
  sq(hx + s*2.2, hy + s*1.0, s*1.2, s*.4, '#5a3010');
  // Mouth (smirk)
  sq(hx + s*.8, hy + s*2.8, s*1.2, s*.4, '#8b4020');
  sq(hx + s*2.0, hy + s*2.6, s*.8, s*.4, '#8b4020');

  cx.restore();
}

function drawParts() {
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    cx.globalAlpha = Math.min(1, p.life / 10, p.life / p.max * 1.6);
    cx.fillStyle = p.color;
    if (p.star) {
      cx.save(); cx.translate(Math.round(p.x), Math.round(p.y)); cx.rotate(p.rot);
      cx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * .4 - Math.PI / 2;
        const a2 = a + Math.PI * .2;
        if (i === 0) cx.moveTo(Math.cos(a)*p.r, Math.sin(a)*p.r);
        else cx.lineTo(Math.cos(a)*p.r, Math.sin(a)*p.r);
        cx.lineTo(Math.cos(a2)*p.r*.42, Math.sin(a2)*p.r*.42);
      }
      cx.closePath(); cx.fill(); cx.restore();
    } else {
      cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI*2); cx.fill();
    }
    p.x += p.vx; p.y += p.vy; p.vy += .13; p.life--;
    p.rot += p.rotV; p.vx *= .97;
  }
  cx.globalAlpha = 1;
}

// ════════════════════════════════════════════════════
// CHARACTER SPEECH BUBBLE
// ════════════════════════════════════════════════════
let charBubble = { text: '', life: 0, maxLife: 0 };
function charSay(txt, ms = 4400) { charBubble = { text: txt, life: ms / 16, maxLife: ms / 16 }; }

function drawCharBubble() {
  if (charBubble.life <= 0) return;
  charBubble.life--;
  const alpha = Math.min(1, charBubble.life / 8, (charBubble.maxLife - charBubble.life + 1) / 8);
  // Convert player world coords to screen coords
  const z = cam.zoom;
  const sx = (P.x - cam.x) * z + W / 2;
  const sy = (P.y - cam.y) * z + H / 2;
  const sr = P.r * z;
  const sz = Math.max(10, CELL * .22);
  mainCx.font = `bold ${sz}px Nunito`;
  const tw = mainCx.measureText(charBubble.text).width;
  const bw = tw + 16, bh = sz + 14;
  let bx = sx - bw / 2;
  if (bx < 4) bx = 4; if (bx + bw > W - 4) bx = W - bw - 4;
  const by = sy - sr * 1.1 - bh - 8;
  mainCx.globalAlpha = alpha;
  mainCx.fillStyle = 'rgba(0,0,0,.4)'; mainCx.beginPath(); mainCx.roundRect(bx + 2, by + 2, bw, bh, 8); mainCx.fill();
  mainCx.fillStyle = '#1e293b'; mainCx.strokeStyle = '#4ade80'; mainCx.lineWidth = 1.5;
  mainCx.beginPath(); mainCx.roundRect(bx, by, bw, bh, 8); mainCx.fill(); mainCx.stroke();
  mainCx.fillStyle = '#1e293b';
  mainCx.beginPath(); mainCx.moveTo(sx - 6, by + bh); mainCx.lineTo(sx + 6, by + bh); mainCx.lineTo(sx, by + bh + 7); mainCx.closePath(); mainCx.fill();
  mainCx.strokeStyle = '#4ade80'; mainCx.lineWidth = 1.5;
  mainCx.beginPath(); mainCx.moveTo(sx - 6, by + bh + 1); mainCx.lineTo(sx, by + bh + 7); mainCx.lineTo(sx + 6, by + bh + 1); mainCx.stroke();
  mainCx.fillStyle = '#e2e8f0'; mainCx.textAlign = 'center';
  mainCx.fillText(charBubble.text, bx + bw / 2, by + sz + 4);
  mainCx.textAlign = 'left'; mainCx.globalAlpha = 1;
}

// ════════════════════════════════════════════════════
// GAME LOOP
// ════════════════════════════════════════════════════
let last = 0;
// Track state that affects static background
let _prevGateOpen = false, _prevTroughFull = false, _prevTreeCount = 0;
function loop(t) {
  if (started && t - last > 14) {
    last = t;
    tickPlayer(); tickMonster(); checkMonsterTouch(); tickAmbient();
    // Detect bg-relevant state changes
    const treeCount = trees.filter(tr => tr.alive).length;
    if (gate.open !== _prevGateOpen || trough.full !== _prevTroughFull || treeCount !== _prevTreeCount) {
      _prevGateOpen = gate.open; _prevTroughFull = trough.full; _prevTreeCount = treeCount;
      invalidateBg();
    }
    draw();
  }
  requestAnimationFrame(loop);
}


// ════════════════════════════════════════════════════
// VILLAGE DRAW FUNCTIONS
// ════════════════════════════════════════════════════

function _drawVillageForestEdge(vx, vy, vw) {
  const penH = PEN_ROWS * CELL;
  for (let i = 0; i < Math.floor(vw / (CELL * .8)) + 1; i++) {
    const tx = vx + i * CELL * .8 + tn(i, 200) * CELL * .4;
    const topOff = tn(200, i) * CELL * .6;
    const botOff = tn(i, 201) * CELL * .6;
    const s = CELL * (.5 + tn(i,202) * .4);
    const type = Math.floor(tn(i, 203) * 4);
    _drawForestTree(tx, vy + topOff + s * .1, s, i + 200, type);
    _drawForestTree(tx, vy + penH - botOff - s * .1, s, i + 300, type);
  }
}

function _drawVillageHouse(hx, hy) {
  const hw = CELL * 3.5, hh = CELL * 2.2;
  cx.fillStyle = 'rgba(0,0,0,.25)';
  cx.fillRect(hx + 6, hy + 6, hw, hh + CELL * .6);
  cx.fillStyle = '#3a2e20';
  cx.fillRect(hx - CELL * .1, hy + hh - CELL * .1, hw + CELL * .2, CELL * .3);
  cx.fillStyle = '#c8a878';
  cx.fillRect(hx, hy, hw, hh);
  cx.fillStyle = 'rgba(0,0,0,.12)';
  cx.fillRect(hx + hw * .6, hy, hw * .4, hh);
  // Windows
  _drawVillageWindow(hx + CELL * .5, hy + CELL * .5, CELL * .7, CELL * .7);
  _drawVillageWindow(hx + CELL * 2.2, hy + CELL * .5, CELL * .7, CELL * .7);
  // Door
  cx.fillStyle = '#5c3d1e';
  cx.fillRect(hx + hw/2 - CELL*.3, hy + hh - CELL*.9, CELL*.6, CELL*.9);
  cx.fillStyle = '#8b6914';
  cx.beginPath(); cx.arc(hx + hw/2 + CELL*.15, hy + hh - CELL*.45, CELL*.06, 0, Math.PI*2); cx.fill();
  // Roof
  cx.fillStyle = '#5c3020';
  cx.beginPath();
  cx.moveTo(hx - CELL*.3, hy); cx.lineTo(hx + hw/2, hy - CELL*1.1); cx.lineTo(hx + hw + CELL*.3, hy);
  cx.closePath(); cx.fill();
  cx.fillStyle = '#7a4030';
  cx.beginPath();
  cx.moveTo(hx - CELL*.3, hy); cx.lineTo(hx + hw/2, hy - CELL*1.1);
  cx.lineTo(hx + hw/2 + CELL*.2, hy - CELL*1.05); cx.lineTo(hx + CELL*.2, hy);
  cx.closePath(); cx.fill();
  // Chimney
  const chx = hx + hw * .7;
  cx.fillStyle = '#3a2820'; cx.fillRect(chx, hy - CELL*1.2, CELL*.3, CELL*.8);
  cx.fillStyle = '#4a3828'; cx.fillRect(chx - CELL*.05, hy - CELL*1.25, CELL*.4, CELL*.12);
  lbl(hx + hw/2, hy - CELL*1.4, 'casa', '#c8a878');
}

function _drawVillageWindow(x, y, w, h) {
  cx.fillStyle = '#1a2a3a'; cx.fillRect(x, y, w, h);
  cx.fillStyle = 'rgba(255,200,80,.2)'; cx.fillRect(x+2, y+2, w-4, h-4);
  cx.strokeStyle = '#5c3d1e'; cx.lineWidth = Math.max(2, CELL*.06); cx.strokeRect(x, y, w, h);
  cx.beginPath(); cx.moveTo(x+w/2, y); cx.lineTo(x+w/2, y+h); cx.stroke();
  cx.beginPath(); cx.moveTo(x, y+h/2); cx.lineTo(x+w, y+h/2); cx.stroke();
}

function _drawVillageGarden(gx, gy) {
  const gw = CELL * 4.5;
  const gh = Math.min(PY + PH - gy - CELL*.3, CELL * 3.2);
  if (gh <= 0) return;
  cx.fillStyle = '#2b1d0e'; cx.fillRect(gx, gy, gw, gh);
  const bedW = CELL*1.2, bedH = CELL*.8;
  const vegs = [
    { x: gx+CELL*.3, y: gy+CELL*.3, emoji: '🌿', label: 'cenoura' },
    { x: gx+CELL*1.8, y: gy+CELL*.3, emoji: '🥬', label: 'repolho' },
    { x: gx+CELL*3.3, y: gy+CELL*.3, emoji: '🌱', label: 'nabo' },
    { x: gx+CELL*.3, y: gy+CELL*1.5, emoji: '🍓', label: 'morango' },
    { x: gx+CELL*1.8, y: gy+CELL*1.5, emoji: '🥕', label: 'cenoura' },
  ];
  for (const v of vegs) {
    cx.fillStyle = '#3a2410'; cx.fillRect(v.x, v.y, bedW, bedH);
    cx.strokeStyle = '#241608'; cx.lineWidth = 1;
    for (let r = 0; r < 3; r++) {
      cx.beginPath(); cx.moveTo(v.x, v.y+bedH/3*r); cx.lineTo(v.x+bedW, v.y+bedH/3*r); cx.stroke();
    }
    const sz = Math.max(10, CELL*.32);
    cx.font = sz+'px sans-serif'; cx.textAlign='center';
    cx.fillText(v.emoji, v.x+bedW/2, v.y+bedH/2+sz/3); cx.textAlign='left';
    lbl(v.x+bedW/2, v.y-4, v.label, '#4a8a30');
  }
  // Garden fence with door
  const fgx = gx-CELL*.15, fgy = gy-CELL*.2;
  const fgw = gw*.8+CELL*.3, fgh = Math.min(gh*.72, CELL*3.5);
  const doorX = fgx+fgw-CELL*.05, doorW = CELL*.7;
  const doorY = fgy+fgh*.3, doorH = fgh*.55;
  const fw = Math.max(2, CELL*.07);
  cx.strokeStyle=PAL.fence; cx.lineWidth=fw;
  cx.beginPath(); cx.moveTo(fgx,fgy); cx.lineTo(fgx+fgw,fgy); cx.stroke();
  cx.beginPath(); cx.moveTo(fgx,fgy); cx.lineTo(fgx,fgy+fgh); cx.stroke();
  cx.beginPath(); cx.moveTo(doorX,fgy); cx.lineTo(doorX,doorY); cx.stroke();
  cx.beginPath(); cx.moveTo(doorX,doorY+doorH); cx.lineTo(doorX,fgy+fgh); cx.stroke();
  cx.beginPath(); cx.moveTo(fgx,fgy+fgh); cx.lineTo(fgx+fgw,fgy+fgh); cx.stroke();
  cx.fillStyle=PAL.wood1; cx.fillRect(doorX+doorW*.1,doorY,doorW*.85,doorH);
  cx.strokeStyle=PAL.woodDark; cx.lineWidth=Math.max(1,CELL*.04);
  cx.strokeRect(doorX+doorW*.1,doorY,doorW*.85,doorH);
  lbl(doorX+doorW*.5, doorY-CELL*.25, 'entrada', '#a07820');
}

function _drawVillageNPC(npc) {
  // Pixel-art old woman — hunched, warm, slightly comic
  const r = npc.r || CELL * .4;
  const x = Math.round(npc.x), y = Math.round(npc.y);
  const s = Math.round(r * 0.22);
  const t = Date.now() / 800;
  const bob = Math.round(Math.sin(t) * 0.8);

  cx.save();
  cx.translate(x, y + bob);
  cx.imageSmoothingEnabled = false;

  function sq(rx, ry, rw, rh, c) {
    cx.fillStyle = c;
    cx.fillRect(Math.round(rx), Math.round(ry), Math.round(rw), Math.round(rh));
  }

  // Shadow
  cx.fillStyle = 'rgba(0,0,0,.22)';
  cx.beginPath(); cx.ellipse(0, r*.8, r*.45, r*.1, 0, 0, Math.PI*2); cx.fill();

  // Dress — wide A-line
  sq(-s*2.8, -r*.08, s*5.6, r*.96, '#2a3a5a'); // dress body
  sq(-s*3.2,  r*.6,  s*6.4, r*.36, '#223060'); // dress hem (wider at bottom)
  // Apron
  sq(-s*1.4, s*.1, s*2.8, r*.72, 'rgba(230,220,190,.18)');
  // Dress highlight
  sq(-s*2.8, -r*.08, s*5.6, s*.7, '#3a4f7a');

  // Feet
  sq(-s*1.8, r*.88, s*1.6, s*.9, '#3a2820');
  sq( s*.2,  r*.88, s*1.6, s*.9, '#3a2820');

  // Arms
  sq(-s*3.2, -r*.1, s*1.4, r*.52, '#2a3a5a'); // L
  sq( s*1.8, -r*.1, s*1.4, r*.52, '#2a3a5a'); // R
  sq(-s*3.4,  r*.36, s*1.5, s*1.1, '#e8c97a'); // hand L
  sq( s*1.9,  r*.36, s*1.5, s*1.1, '#e8c97a'); // hand R

  // Walking stick
  cx.strokeStyle = PAL.wood2; cx.lineWidth = Math.max(2, s*.7); cx.lineCap = 'round';
  cx.beginPath(); cx.moveTo(Math.round(s*3.2), -r*.08); cx.lineTo(Math.round(s*3.6), r*.9); cx.stroke();

  // Head (slightly hunched — offset left-down)
  const hx = -s*1.8, hy = -r*.88;
  sq(hx, hy, s*3.8, s*4, '#e8c97a'); // face
  // Wrinkles
  sq(hx + s*.4, hy + s*1.8, s*2.8, s*.3, 'rgba(0,0,0,.15)');

  // Headscarf
  sq(hx - s*.4, hy - s*.3, s*4.8, s*1.2, '#6b2a8a'); // scarf band
  sq(hx - s*.6, hy - s*.3, s*5, s*.6, '#8a3aaa');     // scarf highlight
  // Scarf knot chin
  sq(hx + s*.8, hy + s*3.4, s*2, s*.9, '#5a2070');

  // Eyes
  sq(hx + s*.5, hy + s*1.5, s*.9, s*.7, '#5a3a10'); // L (friendly squint)
  sq(hx + s*2.2, hy + s*1.5, s*.9, s*.7, '#5a3a10'); // R
  // Rosy cheeks
  cx.fillStyle = 'rgba(220,80,80,.18)';
  cx.beginPath(); cx.arc(Math.round(hx + s*.7),  Math.round(hy + s*2.5), s*1.1, 0, Math.PI*2); cx.fill();
  cx.beginPath(); cx.arc(Math.round(hx + s*2.9), Math.round(hy + s*2.5), s*1.1, 0, Math.PI*2); cx.fill();
  // Smile
  sq(hx + s*.6, hy + s*3.0, s*.7, s*.4, '#8b4020');
  sq(hx + s*1.4, hy + s*3.2, s*.8, s*.4, '#8b4020');
  sq(hx + s*2.2, hy + s*3.0, s*.7, s*.4, '#8b4020');

  // Glow if near — drawn inside the existing save/translate context
  if (dist(P, npc) < CELL * 2.5) {
    cx.fillStyle = 'rgba(251,191,36,.1)';
    cx.beginPath(); cx.arc(0, 0, CELL, 0, Math.PI*2); cx.fill();
  }

  cx.restore();
  lbl(x, Math.round(y - r * 1.2), npc.name, '#c084fc');
}

requestAnimationFrame(loop);