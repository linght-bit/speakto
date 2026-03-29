// ════════════════════════════════════════════════════
// WORLD-CONFIG.JS — Constants, palette, draw primitives
// ════════════════════════════════════════════════════

// ── Layout constants ──────────────────────────────────
const CV = document.getElementById('c'), gw = document.getElementById('gw');
console.log('CV found:', !!CV, 'gw found:', !!gw);
let cx = CV ? CV.getContext('2d') : null; // let — swapped to offscreen ctx when rendering bg
const COLS = 30, ROWS = 30;
const CELL = 48;

const FOREST_BORDER = 5;

const PEN_COL_START = 6, PEN_COL_END = 13;
const PEN_ROW_START = 6, PEN_ROW_END = 13;
const PEN_COLS = 8, PEN_ROWS = 8;
const BORDER_MARGIN = 6;
const GATE_ROW = 9;

const LAKE_COL_START = 1, LAKE_COL_END = 7;
const LAKE_ROW_START = 20, LAKE_ROW_END = 28;

let W, H, PX, PY, PW, PH;

function layout() {
  console.log('layout called, CV:', !!CV, 'gw:', !!gw);
  if (!CV || !gw) {
    console.error('Canvas or game window not found');
    return;
  }
  W = CV.width = gw.clientWidth; H = CV.height = gw.clientHeight;
  PW = CELL * COLS; PH = CELL * ROWS;
  PX = 0; PY = 0;
  invalidateBg();
}
function gc(col, row) { return { x: PX + col * CELL + CELL / 2, y: PY + row * CELL + CELL / 2 }; }

// ── Main canvas context ───────────────────────────────
const mainCx = CV.getContext('2d');

// ── Palette ───────────────────────────────────────────
const PAL = {
  dirt1:'#2b1d0e', dirt2:'#221608', dirt3:'#1a1004', dirt4:'#332210',
  dirtCrack:'#150c02', dirtStain:'#301e0e', dirtPebble:'#3a2e22',
  grass1:'#182808', grass2:'#142206', grass3:'#0e1904', grass4:'#1c3009',
  grassTuft:'#1e3409', grassFlower:'#d4a017', grassFlower2:'#c0392b',
  stone1:'#3d3830', stone2:'#4a4540', stone3:'#2e2a24', stoneMoss:'#2a3a1a',
  wood1:'#5c3d1e', wood2:'#6b4a28', wood3:'#3d2510', woodDark:'#2a1a0a',
  woodGrain:'#4a3018', woodHi:'#7a5030',
  fence:'#7c5c2a', fencePost:'#8b6914', fenceHi:'#a07820', fenceShadow:'#3a2808',
  fenceMoss:'#3a5020',
  water1:'#1a3a6b', water2:'#1e4078', water3:'#162e58', waterHi:'rgba(120,200,255,.4)',
  waterDeep:'#0e1e3a',
  playerBody:'#2563a8', playerBodyHi:'#3b7fd4', playerHead:'#e8c97a',
  playerHair:'#6b3a0e', playerEye:'#111', playerScarf:'#c0392b', playerScarfHi:'#e74c3c',
  playerBelt:'#5c3d1e', playerBoots:'#1a1208',
  monBody:'#0f4a1a', monBodyHi:'#1a6b28', monEye:'#c8a000', monGlow:'rgba(200,160,0,.4)',
  monFang:'#e8e0d0', monAura:'rgba(10,60,20,.5)',
  skyEdge:'rgba(10,5,20,.7)',
};

// ── Noise helpers ─────────────────────────────────────
function tn(x, y)  { return Math.abs((Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1); }
function tn2(x, y) { return Math.abs((Math.sin(x * 91.3 + y * 47.9) * 31415.9)) % 1; }

// ── Draw primitives (operate on current `cx`) ─────────
function px(x, y, w, h, col) { cx.fillStyle = col; cx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function ln(x1, y1, x2, y2) { cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke(); }
function circ(x, y, r, fill) { cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fillStyle = fill; cx.fill(); }
function px_line(x1, y1, x2, y2, col, lw = 1) { cx.strokeStyle = col; cx.lineWidth = lw; cx.lineCap = 'square'; ln(x1, y1, x2, y2); }

/**
 * Draw a label.
 * When cx === bgCanvas ctx → world-space render (used during bg cache build).
 * When cx === mainCx → screen-space render (pixel-perfect, unaffected by camera zoom).
 */
function lbl(x, y, text, col) {
  if (cx !== mainCx) {
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
  const z = cam.zoom;
  const sx = Math.round((x - cam.x) * z + W / 2);
  const sy = Math.round((y - cam.y) * z + H / 2);
  const sz = Math.max(11, Math.round(CELL * .2 * z));
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
