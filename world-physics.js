// ════════════════════════════════════════════════════
// WORLD-PHYSICS.JS — Camera, collision, movement, A* pathfinding
// Depends on: world-config.js, world-state.js
// ════════════════════════════════════════════════════
// ── Speeds ────────────────────────────────────────────
const P_SPD  = () => CELL * 0.08;
const M_SPD  = () => CELL * 0.02;
const M_FLEE = () => CELL * 0.05;

// ── Camera ────────────────────────────────────────────
function updateCamera() {
  const z = camZoom();
  const vw = W / z, vh = H / z;
  const halfVW = vw / 2, halfVH = vh / 2;
  let tx = Math.max(PX + halfVW, Math.min(PX + PW - halfVW, P.x));
  let ty = Math.max(PY + halfVH, Math.min(PY + PH - halfVH, P.y));
  if (PW < vw) tx = PX + PW / 2;
  if (PH < vh) ty = PY + PH / 2;

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

// ── Collision helpers ─────────────────────────────────
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

function canReach(item) {
  if (item.held) return true;
  const pIn = inPen(P), iIn = inPen(item);
  if (pIn === iIn) return true;
  if (gate.open) return true;
  return false;
}

// ── Simple movement with wall/obstacle resolution ─────
function tryMoveSimple(obj, nx, ny) {
  const r = obj.r || CELL * .3;
  const ox = obj.x, oy = obj.y;
  let x = nx, y = ny;
  const wasIn = inPen(obj);
  const penLeft   = PX + PEN_COL_START * CELL;
  const penRight  = PX + (PEN_COL_END + 1) * CELL;
  const penTop    = PY + PEN_ROW_START * CELL;
  const penBottom = PY + (PEN_ROW_END + 1) * CELL;

  if (wasIn) {
    if (y - r < penTop)    y = penTop + r;
    if (y + r > penBottom) y = penBottom - r;
    if (x - r < penLeft)   x = penLeft + r;
    if (x + r > penRight) { if (!gatePass(y, r)) x = penRight - r; }
  } else {
    const crossEast = (x + r) > penRight && (x - r) < penRight && (y + r) > penTop && (y - r) < penBottom;
    if (crossEast && !gatePass(y, r)) x = penRight + r;
    if (x - r < PX)      x = PX + r;
    if (x + r > PX + PW) x = PX + PW - r;
    if (y - r < PY)      y = PY + r;
    if (y + r > PY + PH) y = PY + PH - r;
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

// ── A* Pathfinding ────────────────────────────────────
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

  if (col < FOREST_BORDER || col >= COLS - FOREST_BORDER ||
      row < FOREST_BORDER || row >= ROWS - FOREST_BORDER) return false;

  if (col >= LAKE_COL_START && col <= LAKE_COL_END &&
      row >= LAKE_ROW_START && row <= LAKE_ROW_END) return false;

  const inPenArea = (col >= PEN_COL_START && col <= PEN_COL_END &&
                     row >= PEN_ROW_START && row <= PEN_ROW_END);

  if (!inPenArea && col === PEN_COL_END && row >= PEN_ROW_START && row <= PEN_ROW_END) {
    const gateRow = 9;
    const isNearGate = Math.abs(row - gateRow) <= 1;
    if (!gate.open || !isNearGate) return false;
  }

  if (overlapsHorse(cx2, cy2, r)) return false;

  for (const t of trees) {
    if (!t.alive) continue;
    if ((cx2 - t.x) ** 2 + (cy2 - t.y) ** 2 < (r + CELL * 0.25) ** 2) return false;
  }
  return true;
}

// Path cache
const _pathCache = new Map();
const PATH_CACHE_MAX = 40;

function _pathCacheKey(sc, sr, ec, er) {
  const treeKey = trees.map(t => t.alive ? 1 : 0).join('');
  return `${sc},${sr}→${ec},${er}|${gate.open?1:0}|${treeKey}`;
}

function findPath(fromPx, fromPy, toPx, toPy) {
  const start = pxToCell(fromPx, fromPy);
  const end   = pxToCell(toPx,   toPy);
  if (start.col === end.col && start.row === end.row) return [];

  const cacheKey = _pathCacheKey(start.col, start.row, end.col, end.row);
  if (_pathCache.has(cacheKey)) return _pathCache.get(cacheKey);

  const key = (c, r) => c + ',' + r;
  const h   = (c, r) => Math.abs(c - end.col) + Math.abs(r - end.row);
  const open = [{ col: start.col, row: start.row, g: 0, f: h(start.col, start.row), parent: null }];
  const closed = new Set();
  const best = {};
  best[key(start.col, start.row)] = 0;
  const dirs = [
    { dc: 1, dr: 0 }, { dc: -1, dr: 0 }, { dc: 0, dr: 1 }, { dc: 0, dr: -1 },
    { dc: 1, dr: 1 }, { dc: 1, dr: -1 }, { dc: -1, dr: 1 }, { dc: -1, dr: -1 }
  ];
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

  if (_pathCache.size >= PATH_CACHE_MAX) _pathCache.delete(_pathCache.keys().next().value);
  _pathCache.set(cacheKey, result);
  return result;
}

// ── Path following state ──────────────────────────────
let pathWaypoints  = [];
let pathFinalCb    = null;
let pathFinalTarget = null;

function ptInPen(x, y) { return inPen({ x, y }); }
function gateMidpoint()    { return { x: PX + PEN_COLS * CELL, y: gate.y + gate.h / 2 }; }
function gateWaypointOut() { return { x: gate.x + P.r * 2.2,  y: gate.y + gate.h / 2 }; }
function gateWaypointIn()  { return { x: gate.x - P.r * 2.2,  y: gate.y + gate.h / 2 }; }

function setTarget(tx, ty, cb) {
  pathFinalTarget = { x: tx, y: ty };
  pathFinalCb     = cb;
  pathWaypoints   = [];

  const playerInside = ptInPen(P.x, P.y);
  const targetInside = ptInPen(tx, ty);
  const crossingZone = playerInside !== targetInside;

  if (crossingZone && gate.open) {
    if (playerInside) {
      const wi = gateWaypointIn(), wo = gateWaypointOut();
      const pathToGate = findPath(P.x, P.y, wi.x, wi.y);
      if (pathToGate) pathWaypoints = pathToGate.map(({ col, row }) => cellToPx(col, row));
      pathWaypoints.push(wi, wo, { x: tx, y: ty });
    } else {
      const wo = gateWaypointOut(), wi = gateWaypointIn();
      const pathToGate = findPath(P.x, P.y, wo.x, wo.y);
      if (pathToGate) pathWaypoints = pathToGate.map(({ col, row }) => cellToPx(col, row));
      pathWaypoints.push(wo, wi, { x: tx, y: ty });
    }
  } else {
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

// ── Entity ticks ──────────────────────────────────────
function tickPlayer() {
  if (!pTarget && pathWaypoints.length === 0) return;
  const spd = P_SPD();
  if (!pTarget && pathWaypoints.length > 0) pTarget = pathWaypoints.shift();
  if (!pTarget) return;
  const ox_ = P.x, oy_ = P.y;
  const dx = pTarget.x - P.x, dy = pTarget.y - P.y;
  const d  = Math.sqrt(dx * dx + dy * dy);
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

function tickMonster() {
  if (!monster.alive) return;
  if (monScriptTarget) {
    const dx = monScriptTarget.x - monster.x, dy = monScriptTarget.y - monster.y;
    const d  = Math.sqrt(dx * dx + dy * dy);
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
  const d  = Math.sqrt(dx * dx + dy * dy);
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
