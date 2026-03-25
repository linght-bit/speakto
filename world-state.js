// ════════════════════════════════════════════════════
// WORLD-STATE.JS — Global state & world initialisation
// Depends on: world-config.js
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
let villageNPCs = [];

const QUEST_ITEMS = ['maca'];

// ── Camera ────────────────────────────────────────────
const CAM_ZOOM_DESKTOP = 1.4;
const CAM_ZOOM_MOBILE  = 1.0;
const CAM_EDGE_RATIO   = 0.25;
const CAM_LERP         = 0.08;

let cam = { x: 0, y: 0, zoom: 1 };

function camZoom() {
  return W < 600 ? CAM_ZOOM_MOBILE : CAM_ZOOM_DESKTOP;
}

// ── World initialisation ──────────────────────────────
function initWorld() {
  console.log('initWorld called');
  layout();

  const PR = CELL * .36;
  P = { x: PX + 11 * CELL + CELL / 2, y: PY + 11 * CELL + CELL / 2, r: PR };

  gate = { x: PX + 13 * CELL, y: PY + 9 * CELL, h: CELL, open: false };

  horse = {
    col: 9, row: 9,
    x: PX + 9.5 * CELL, y: PY + 9 * CELL,
    w: CELL * 2, h: CELL,
    fed: false, watered: false, decorated: false
  };

  trough = { x: PX + 11 * CELL + CELL / 2, y: PY + 10 * CELL + CELL / 2, full: false };

  well = {
    x: PX + 16 * CELL + CELL / 2, y: PY + 8 * CELL + CELL / 2,
    r: CELL * .45
  };

  trees = [
    { col: 7,  row: 7,  isMonster: false, x: PX + 7  * CELL + CELL / 2, y: PY + 7  * CELL + CELL / 2, alive: true, stump: false },
    { col: 12, row: 7,  isMonster: false, x: PX + 12 * CELL + CELL / 2, y: PY + 7  * CELL + CELL / 2, alive: true, stump: false },
    { col: 10, row: 12, isMonster: true,  x: PX + 10 * CELL + CELL / 2, y: PY + 12 * CELL + CELL / 2, alive: true, stump: false },
  ];

  items = [];
  const occ = new Set();

  for (let c = PEN_COL_START; c <= PEN_COL_END; c++)
    for (let r = PEN_ROW_START; r <= PEN_ROW_END; r++)
      occ.add(`${c},${r}`);

  trees.forEach(t => occ.add(`${t.col},${t.row}`));
  occ.add(`${horse.col},${horse.row}`);
  occ.add(`${horse.col + 1},${horse.row}`);
  occ.add(`${trough.x / CELL - 0.5},${trough.y / CELL - 0.5}`);

  function freeCellInPen() {
    for (let r = PEN_ROW_START + 1; r <= PEN_ROW_END - 1; r++) {
      for (let c = PEN_COL_START + 1; c <= PEN_COL_END - 1; c++) {
        const k = `${c},${r}`;
        if (!occ.has(k)) { occ.add(k); return { x: PX + c * CELL + CELL / 2, y: PY + r * CELL + CELL / 2, col: c, row: r }; }
      }
    }
    return { x: PX + 8 * CELL + CELL / 2, y: PY + 8 * CELL + CELL / 2, col: 8, row: 8 };
  }

  const add = (id, x, y, type, label, color, noThrow = false) => {
    items.push({ id, x, y, type, held: false, gone: false, label, color, noThrow, filled: false });
  };

  const hay1 = freeCellInPen(); add('feno1',  hay1.x,  hay1.y,  'hay',    'feno',           '#d97706');
  const hay2 = freeCellInPen(); add('feno2',  hay2.x,  hay2.y,  'hay',    'feno',           '#d97706');
  const hay3 = freeCellInPen(); add('feno3',  hay3.x,  hay3.y,  'hay',    'feno',           '#d97706');
  const stick1 = freeCellInPen(); add('graveto', stick1.x, stick1.y, 'stick', 'graveto',    '#a07820');
  const rock1  = freeCellInPen(); add('pedra1',  rock1.x,  rock1.y,  'rock',  'pedra',      '#9ca3af');
  const rock2  = freeCellInPen(); add('pedra2',  rock2.x,  rock2.y,  'rock',  'pedra',      '#9ca3af');
  const flower1 = freeCellInPen(); add('flor1', flower1.x, flower1.y, 'flower', 'flor',     '#f472b6');
  const flower2 = freeCellInPen(); add('flor2', flower2.x, flower2.y, 'flower', 'flor',     '#f472b6');

  add('cangalha',   PX + 9 * CELL + CELL / 2,    PY + 8 * CELL + CELL / 2,  'stick', 'cangalha',       '#a07820', true);
  add('balde',      PX + 17 * CELL + CELL / 2,    PY + 8 * CELL + CELL / 2,  'bucket','balde',          '#60a5fa');

  villageNPCs = [
    {
      id: 'dona_maria', name: 'Dona Maria', avatar: '👵',
      x: PX + 23 * CELL + CELL / 2, y: PY + 6 * CELL + CELL / 2, r: CELL * .4,
      onOpen:   function() { if (typeof _donaMariaOnOpen   === 'function') _donaMariaOnOpen(this); },
      onClose:  function() {},
      onSpeech: function(s, raw) { if (typeof _donaMariaOnSpeech === 'function') return _donaMariaOnSpeech(s, raw); return false; }
    },
    {
      id: 'don_tiago', name: 'Don Tiago', avatar: '🎣',
      x: PX + 8 * CELL + CELL / 2, y: PY + 25 * CELL + CELL / 2, r: CELL * .4,
      onOpen:   function() { if (typeof _donTiagoOnOpen   === 'function') _donTiagoOnOpen(this); },
      onClose:  function() {},
      onSpeech: function(s, raw) { if (typeof _donTiagoOnSpeech === 'function') return _donTiagoOnSpeech(s, raw); return false; }
    }
  ];

  add('machado',    PX + 18 * CELL + CELL / 2,    PY + 11 * CELL + CELL / 2, 'axe',   'machado',        '#c084fc', true);
  add('tronco',     PX + 17 * CELL + CELL / 2,    PY + 11 * CELL + CELL / 2, 'stick', 'tronco',         '#8b5a2b');
  add('tronco2',    PX + 16 * CELL + CELL / 2,    PY + 11 * CELL + CELL / 2, 'stick', 'tronco',         '#8b5a2b');
  add('lanterna',   PX + 20 * CELL + CELL / 2,    PY + 8  * CELL + CELL / 2, 'stick', 'lanterna',       '#fbbf24', true);
  add('vara_pesca', PX + 8  * CELL + CELL / 2,    PY + 26 * CELL + CELL / 2, 'stick', 'vara de pesca',  '#a07820');

  add('repolho',  PX + 16 * CELL + CELL / 2, PY + 13 * CELL + CELL / 2, 'mushroom', 'repolho',  '#15803d');
  add('cenoura',  PX + 17 * CELL + CELL / 2, PY + 13 * CELL + CELL / 2, 'mushroom', 'cenoura',  '#f97316');
  add('abobora',  PX + 18 * CELL + CELL / 2, PY + 13 * CELL + CELL / 2, 'mushroom', 'abóbora',  '#eab308');
  add('tomate',   PX + 16 * CELL + CELL / 2, PY + 14 * CELL + CELL / 2, 'mushroom', 'tomate',   '#ef4444');
  add('milho',    PX + 22 * CELL + CELL / 2, PY + 18 * CELL + CELL / 2, 'mushroom', 'milho',    '#f59e0b');
  add('milho2',   PX + 23 * CELL + CELL / 2, PY + 18 * CELL + CELL / 2, 'mushroom', 'milho',    '#f59e0b');
  add('milho3',   PX + 24 * CELL + CELL / 2, PY + 18 * CELL + CELL / 2, 'mushroom', 'milho',    '#f59e0b');
  add('milho4',   PX + 25 * CELL + CELL / 2, PY + 18 * CELL + CELL / 2, 'mushroom', 'milho',    '#f59e0b');

  monster = { x: 0, y: 0, r: CELL * .32, alive: false, fleeing: false };
  pTarget = null; monScriptTarget = null; playerHeld = null;
  particles = []; bonusActive = false;

  cam.x = P.x; cam.y = P.y; cam.zoom = camZoom();
  initAmbient();
}
