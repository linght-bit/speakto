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

const ITEM_CATALOG = {
  machado:  { id:'machado',  type:'axe',     color:'#c084fc',  edible:false, throwable:false, questItem:false, sprite:'axe',    aliases:['machado'] },
  maca:     { id:'maca',     type:'apple',   color:'#f87171',  edible:true,  throwable:false, questItem:false, sprite:'apple',  aliases:['maca','maça'] },
  cogumelo: { id:'cogumelo', type:'mushroom', color:'#a855f7',  edible:true,  throwable:false, questItem:false, sprite:'mushroom', aliases:['cogumelo'] },
  flor:     { id:'flor',     type:'flower',  color:'#f472b6',  edible:false, throwable:false, questItem:false, sprite:'flower', aliases:['flor'] },
  balde:    { id:'balde',    type:'bucket',  color:'#60a5fa',  edible:false, throwable:false, questItem:true,  sprite:'bucket', aliases:['balde'] },
  feno:     { id:'feno',     type:'hay',     color:'#d97706',  edible:true,  throwable:true,  questItem:false, sprite:'hay', aliases:['feno'] },
  pedra:    { id:'pedra',    type:'rock',    color:'#9ca3af',  edible:false, throwable:true,  questItem:false, sprite:'rock', aliases:['pedra'] },
  graveto:  { id:'graveto',  type:'stick',   color:'#a07820',  edible:false, throwable:true,  questItem:false, sprite:'stick', aliases:['graveto'] },
  repolho:  { id:'repolho',  type:'vegetable', color:'#15803d', edible:true,  throwable:false, questItem:false, sprite:'vegetable', aliases:['repolho'] },
  cenoura:  { id:'cenoura',  type:'vegetable', color:'#f97316', edible:true,  throwable:false, questItem:false, sprite:'vegetable', aliases:['cenoura'] },
  abobora:  { id:'abobora',  type:'vegetable', color:'#f59e0b', edible:true,  throwable:false, questItem:false, sprite:'vegetable', aliases:['abobora','abóbora'] },
  tomate:   { id:'tomate',   type:'vegetable', color:'#ef4444', edible:true,  throwable:false, questItem:false, sprite:'vegetable', aliases:['tomate'] },
  milho:    { id:'milho',    type:'vegetable', color:'#f59e0b', edible:true,  throwable:false, questItem:false, sprite:'corn', aliases:['milho'] },
  cangalha: { id:'cangalha', type:'tool', color:'#a07820', edible:false, throwable:false, questItem:true, sprite:'stick', aliases:['cangalha'] },
};

const QUEST_ITEMS = Object.values(ITEM_CATALOG).filter(it => it.questItem).map(it => it.id);

function getItemMeta(id) {
  if (!id) return null;
  if (ITEM_CATALOG[id]) return ITEM_CATALOG[id];
  const base = id.replace(/\d+$/, '');
  return ITEM_CATALOG[base] || null;
}

function createItem(id, x, y) {
  const meta = getItemMeta(id);
  if (!meta) {
    console.warn('createItem: unknown item', id);
    return null;
  }
  return {
    id,
    x,
    y,
    type: meta.type,
    held: false,
    gone: false,
    label: typeof getItemLabel === 'function' ? getItemLabel(id, CURRENT_UI_LANG) : meta.id,
    color: meta.color,
    filled: false,
    questItem: meta.questItem,
    edible: meta.edible,
    throwable: meta.throwable,
    sprite: meta.sprite,
    aliases: meta.aliases || [],
  };
}

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

  const add = (id, x, y) => {
    const item = createItem(id, x, y);
    if (item) items.push(item);
  };

  const hay1 = freeCellInPen(); add('feno1',  hay1.x,  hay1.y);
  const hay2 = freeCellInPen(); add('feno2',  hay2.x,  hay2.y);
  const hay3 = freeCellInPen(); add('feno3',  hay3.x,  hay3.y);
  const stick1 = freeCellInPen(); add('graveto', stick1.x, stick1.y);
  const rock1  = freeCellInPen(); add('pedra1',  rock1.x,  rock1.y);
  const rock2  = freeCellInPen(); add('pedra2',  rock2.x,  rock2.y);
  const flower1 = freeCellInPen(); add('flor1', flower1.x, flower1.y);
  const flower2 = freeCellInPen(); add('flor2', flower2.x, flower2.y);

  add('cangalha', PX + 9 * CELL + CELL / 2,  PY + 8 * CELL + CELL / 2);
  add('balde',    PX + 17 * CELL + CELL / 2, PY + 8 * CELL + CELL / 2);

  villageNPCs = [
    {
      id: 'dona_maria', name: 'dona_maria', avatar: '👵',
      x: PX + 23 * CELL + CELL / 2, y: PY + 9 * CELL + CELL / 2, r: CELL * .4,
      onOpen:   function() { if (typeof _donaMariaOnOpen   === 'function') _donaMariaOnOpen(this); },
      onClose:  function() {},
      onSpeech: function(s, raw) { if (typeof _donaMariaOnSpeech === 'function') return _donaMariaOnSpeech(s, raw); return false; }
    },
    {
      id: 'don_tiago', name: 'don_tiago', avatar: '🎣',
      x: PX + 8 * CELL + CELL / 2, y: PY + 25 * CELL + CELL / 2, r: CELL * .4,
      onOpen:   function() { if (typeof _donTiagoOnOpen   === 'function') _donTiagoOnOpen(this); },
      onClose:  function() {},
      onSpeech: function(s, raw) { if (typeof _donTiagoOnSpeech === 'function') return _donTiagoOnSpeech(s, raw); return false; }
    }
  ];

  add('machado',    PX + 18 * CELL + CELL / 2,    PY + 11 * CELL + CELL / 2);
  add('tronco',     PX + 17 * CELL + CELL / 2,    PY + 11 * CELL + CELL / 2);
  add('tronco2',    PX + 16 * CELL + CELL / 2,    PY + 11 * CELL + CELL / 2);
  add('lanterna',   PX + 20 * CELL + CELL / 2,    PY + 8  * CELL + CELL / 2);
  add('vara_pesca', PX + 8  * CELL + CELL / 2,    PY + 26 * CELL + CELL / 2);

  // Огород: 3 cols (22,23,24) × 5 rows (13..17) — по одному предмету на грядку
  add('repolho',  PX + 22 * CELL + CELL / 2, PY + 13 * CELL + CELL / 2);
  add('cenoura',  PX + 23 * CELL + CELL / 2, PY + 13 * CELL + CELL / 2);
  add('abobora',  PX + 24 * CELL + CELL / 2, PY + 13 * CELL + CELL / 2);
  add('tomate',   PX + 22 * CELL + CELL / 2, PY + 14 * CELL + CELL / 2);
  add('milho',    PX + 22 * CELL + CELL / 2, PY + 18 * CELL + CELL / 2);
  add('milho2',   PX + 23 * CELL + CELL / 2, PY + 18 * CELL + CELL / 2);
  add('milho3',   PX + 24 * CELL + CELL / 2, PY + 18 * CELL + CELL / 2);
  add('milho4',   PX + 25 * CELL + CELL / 2, PY + 18 * CELL + CELL / 2);

  monster = { x: 0, y: 0, r: CELL * .32, alive: false, fleeing: false };
  pTarget = null; monScriptTarget = null; playerHeld = null;
  particles = []; bonusActive = false;

  cam.x = P.x; cam.y = P.y; cam.zoom = camZoom();
  initAmbient();
}
