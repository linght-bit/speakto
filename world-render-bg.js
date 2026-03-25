// ════════════════════════════════════════════════════
// WORLD-RENDER-BG.JS — Offscreen canvas + static background rendering
// Static layers: grass, dirt paths, fence, well, trough, forest, village static
// Call invalidateBg() on state changes: gate, trough, trees
// Depends on: world-config.js, world-state.js
// ════════════════════════════════════════════════════

let bgCanvas = null, bgDirty = true;

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
  cx = bgCanvas.getContext('2d');
  try {
    cx.save();
    cx.translate(-PX, -PY);
    _drawGrass();
    _drawDirt();
    _drawVillageStatic();
    drawFence();
    drawWell();
    drawTrough();
    cx.restore();
  } finally {
    cx = originalCx || mainCx;
  }
}

// ── Village static layer ──────────────────────────────
function _drawVillageStatic() {
  const VX = PX + PEN_COLS * CELL;
  const penH = PEN_ROWS * CELL;
  const gs = Math.max(4, Math.floor(CELL / 4));

  cx.fillStyle = '#182808';
  cx.fillRect(VX, PY, CELL * 20, penH);
  for (let gx2 = VX; gx2 < VX + CELL * 20; gx2 += gs) {
    for (let gy2 = PY; gy2 < PY + penH; gy2 += gs) {
      const n = tn(gx2/gs+50, gy2/gs+50);
      if (n < 0.18) px(gx2, gy2, gs, gs, '#142206');
    }
  }
  _drawVillageForestEdge(VX, PY, CELL * 20);
  _drawVillageHouse(PX + 20 * CELL, PY + 6 * CELL);
}

// ── Grass ─────────────────────────────────────────────
function _drawGrass() {
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

  for (let i = 0; i < 80; i++) {
    const tx = PX + tn(i,0)*PW|0, ty = PY + tn(0,i+1)*PH|0;
    const inPenArea = tx>PX-6 && tx<PX+PEN_COLS*CELL+6 && ty>PY-6 && ty<PY+PH+6;
    if (inPenArea) continue;
    const sz = Math.max(1,(CELL*.07)|0);
    const shade = tn(i,i)>.5 ? PAL.grassTuft : PAL.grass4;
    cx.fillStyle = shade;
    cx.fillRect(tx,ty,sz,sz*2); cx.fillRect(tx+sz,ty+sz,sz,sz);
  }

  for (let i = 0; i < 22; i++) {
    const fx = PX + tn(i+100,3)*PW|0, fy = PY + tn(5,i+100)*PH|0;
    const inPenArea = fx>PX-10 && fx<PX+PEN_COLS*CELL+10 && fy>PY-10 && fy<PY+PH+10;
    if (inPenArea) continue;
    const fr = Math.max(2,CELL*.07);
    const col = tn(i,50)>.5 ? PAL.grassFlower : PAL.grassFlower2;
    cx.strokeStyle=PAL.grass4; cx.lineWidth=1;
    cx.beginPath(); cx.moveTo(fx,fy+fr*2); cx.lineTo(fx,fy); cx.stroke();
    circ(fx,fy,fr,col); circ(fx,fy,fr*.5,'#fdf0a0');
  }

  _drawPath();
  _drawLowerWorld();
  _drawForest();

  cx.fillStyle = vign; cx.fillRect(PX,PY,PW,PH);
}

// ── Winding road from gate rightward ──────────────────
function _drawPath() {
  const roadStartX = PX + 14 * CELL;
  const roadBaseY = PY + 9 * CELL + CELL / 2;
  const pw = Math.max(10, CELL * .55);
  const roadEndX = PX + 24 * CELL;

  const pts = [
    { x: roadStartX, y: roadBaseY },
    { x: roadEndX,   y: roadBaseY },
  ];

  function drawRoadStrip(widthMult, col) {
    cx.strokeStyle = col; cx.lineWidth = pw * 2 * widthMult;
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    cx.beginPath(); cx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i+1].x) / 2, my = (pts[i].y + pts[i+1].y) / 2;
      cx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    cx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y); cx.stroke();
  }

  drawRoadStrip(1.0, '#241608');
  drawRoadStrip(0.55, '#2e1e0a');

  cx.strokeStyle = '#1a0e04'; cx.lineWidth = Math.max(2, CELL * .07);
  cx.setLineDash([CELL * .5, CELL * .25]);
  function drawTrack(offY) {
    cx.beginPath(); cx.moveTo(pts[0].x, pts[0].y + offY);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i+1].x) / 2, my = (pts[i].y + pts[i+1].y) / 2;
      cx.quadraticCurveTo(pts[i].x, pts[i].y + offY, mx, my + offY);
    }
    cx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y + offY); cx.stroke();
  }
  drawTrack(-pw * .45); drawTrack(pw * .45);
  cx.setLineDash([]);

  for (let i = 0; i < 22; i++) {
    const t2 = i / 22;
    const seg = Math.floor(t2 * (pts.length - 1));
    const segT = (t2 * (pts.length - 1)) - seg;
    const p0 = pts[Math.min(seg, pts.length-1)], p1 = pts[Math.min(seg+1, pts.length-1)];
    const px2 = p0.x + (p1.x - p0.x) * segT + tn(i, 200) * pw * 1.2 - pw * .6;
    const py2 = p0.y + (p1.y - p0.y) * segT + (tn(200, i) - .5) * pw * 1.2;
    const pr2 = Math.max(1.5, CELL * .04);
    cx.fillStyle = tn(i, i+1) > .5 ? '#3a2e20' : '#2e2418';
    cx.beginPath(); cx.ellipse(px2, py2, pr2 * 1.4, pr2, tn(i,7)*Math.PI, 0, Math.PI*2); cx.fill();
  }

  const gardenX = PX + 16 * CELL;
  const gardenY = PY + 12 * CELL;
  _drawGardenPatch(gardenX, gardenY, 3, 5);

  const lanternX = PX + 20 * CELL;
  const lanternY = PY + 8 * CELL + CELL / 2;
  _drawLantern(lanternX, lanternY);
}

// ── Garden patch ──────────────────────────────────────
function _drawGardenPatch(gx, gy, wCells, hCells) {
  const gw2 = wCells * CELL, gh2 = hCells * CELL;
  const fw = Math.max(2, CELL * .07);

  cx.fillStyle = '#2b1d0e'; cx.fillRect(gx, gy, gw2, gh2);

  const vegs = [
    { col:0,row:0,emoji:'🌿',label:'cenoura' }, { col:1,row:0,emoji:'🥬',label:'repolho' },
    { col:2,row:0,emoji:'🌱',label:'nabo'    }, { col:3,row:0,emoji:'🍓',label:'morango' },
    { col:4,row:0,emoji:'🥕',label:'cenoura' }, { col:0,row:1,emoji:'🌿',label:'alho'    },
    { col:2,row:1,emoji:'🥬',label:'couve'   }, { col:4,row:1,emoji:'🌱',label:'pepino'  },
  ];
  const bedW = CELL * .85, bedH = CELL * .85;
  for (const v of vegs) {
    const bx = gx + v.col * CELL + CELL * .075, by = gy + v.row * CELL + CELL * .075;
    cx.fillStyle = '#3a2410'; cx.fillRect(bx, by, bedW, bedH);
    cx.strokeStyle = '#241608'; cx.lineWidth = 1;
    for (let r = 0; r < 3; r++) { cx.beginPath(); cx.moveTo(bx, by+bedH/3*r); cx.lineTo(bx+bedW, by+bedH/3*r); cx.stroke(); }
    const sz = Math.max(10, CELL * .32);
    cx.font = sz + 'px sans-serif'; cx.textAlign = 'center';
    cx.fillText(v.emoji, bx + bedW/2, by + bedH/2 + sz/3); cx.textAlign = 'left';
    lbl(bx + bedW/2, by - 4, v.label, '#4a8a30');
  }

  cx.strokeStyle = PAL.fence; cx.lineWidth = fw; cx.lineCap = 'square';
  cx.beginPath(); cx.moveTo(gx, gy+gh2); cx.lineTo(gx+gw2, gy+gh2); cx.stroke();
  cx.beginPath(); cx.moveTo(gx, gy); cx.lineTo(gx, gy+gh2); cx.stroke();
  cx.beginPath(); cx.moveTo(gx+gw2, gy); cx.lineTo(gx+gw2, gy+gh2); cx.stroke();

  const gateW = CELL * .8, gateCX = gx + gw2 / 2;
  cx.beginPath(); cx.moveTo(gx, gy); cx.lineTo(gateCX - gateW/2, gy); cx.stroke();
  cx.beginPath(); cx.moveTo(gateCX + gateW/2, gy); cx.lineTo(gx+gw2, gy); cx.stroke();

  cx.fillStyle = PAL.wood1;
  cx.fillRect(gateCX - gateW/2, gy - CELL*.05, gateW, CELL*.25);
  cx.strokeStyle = PAL.woodDark; cx.lineWidth = Math.max(1, CELL*.04);
  cx.strokeRect(gateCX - gateW/2, gy - CELL*.05, gateW, CELL*.25);
  const lx = gateCX, ly = gy + CELL*.08;
  cx.fillStyle = '#8b6914'; cx.beginPath(); cx.arc(lx, ly, CELL*.06, 0, Math.PI*2); cx.fill();
  cx.strokeStyle = '#c8a030'; cx.lineWidth = 1.5;
  cx.beginPath(); cx.arc(lx, ly - CELL*.06, CELL*.04, Math.PI, 0); cx.stroke();

  lbl(gx + gw2/2, gy - CELL*.35, 'horta', '#4a8a30');
}

// ── Lower world: trail, cornfield, workshop, lake, pier ─
function _drawLowerWorld() {
  const VX = PX + (PEN_COLS + BORDER_MARGIN) * CELL;
  const penBottom = PY + (PEN_ROWS + BORDER_MARGIN) * CELL;
  const pw = Math.max(8, CELL * .45);

  const trailPts = [
    { x: PX + 24 * CELL, y: PY + 9 * CELL + CELL / 2 },  // разветвление
    { x: PX + 20 * CELL, y: PY + 12 * CELL },
    { x: PX + 16 * CELL, y: PY + 15 * CELL },
    { x: PX + 12 * CELL, y: PY + 18 * CELL },
    { x: PX + 10 * CELL, y: PY + 20 * CELL },
    { x: PX + 8 * CELL,  y: PY + 23 * CELL },
  ];

  function drawTrailLine(width, col) {
    cx.strokeStyle = col; cx.lineWidth = width; cx.lineCap = 'round'; cx.lineJoin = 'round';
    cx.beginPath(); cx.moveTo(trailPts[0].x, trailPts[0].y);
    for (let i = 1; i < trailPts.length - 1; i++) {
      const mx = (trailPts[i].x + trailPts[i+1].x) / 2, my = (trailPts[i].y + trailPts[i+1].y) / 2;
      cx.quadraticCurveTo(trailPts[i].x, trailPts[i].y, mx, my);
    }
    cx.lineTo(trailPts[trailPts.length-1].x, trailPts[trailPts.length-1].y); cx.stroke();
  }
  drawTrailLine(pw * 2, '#241608');
  drawTrailLine(pw * 0.9, '#2e1e0a');

  // Тропинка к мастерской
  const workshopTrail = [
    { x: PX + 20 * CELL, y: PY + 12 * CELL },
    { x: PX + 18 * CELL, y: PY + 14 * CELL },
    { x: PX + 18 * CELL, y: PY + 16 * CELL },
  ];
  cx.strokeStyle = '#241608'; cx.lineWidth = pw * 2; cx.lineCap = 'round'; cx.lineJoin = 'round';
  cx.beginPath(); cx.moveTo(workshopTrail[0].x, workshopTrail[0].y);
  for (let i = 1; i < workshopTrail.length; i++) {
    cx.lineTo(workshopTrail[i].x, workshopTrail[i].y);
  }
  cx.stroke();
  cx.strokeStyle = '#2e1e0a'; cx.lineWidth = pw * 0.9;
  cx.beginPath(); cx.moveTo(workshopTrail[0].x, workshopTrail[0].y);
  for (let i = 1; i < workshopTrail.length; i++) {
    cx.lineTo(workshopTrail[i].x, workshopTrail[i].y);
  }
  cx.stroke();

  // Cornfield
  const cfX = PX + 22 * CELL, cfY = PY + 16 * CELL;
  const cfW = CELL * 4, cfH = CELL * 5;
  cx.fillStyle = '#1a3a08'; cx.fillRect(cfX, cfY, cfW, cfH);
  for (let c = 0; c < 5; c++) for (let r = 0; r < 6; r++) {
    const cx3 = cfX + CELL * .4 + c * CELL * .75, cy3 = cfY + CELL * .4 + r * CELL * .75;
    cx.strokeStyle = '#2a6010'; cx.lineWidth = Math.max(2, CELL * .07); cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(cx3, cy3 + CELL * .35); cx.lineTo(cx3, cy3 - CELL * .1); cx.stroke();
    cx.strokeStyle = '#3a7a18'; cx.lineWidth = Math.max(1, CELL * .04);
    cx.beginPath(); cx.moveTo(cx3, cy3 + CELL * .15); cx.quadraticCurveTo(cx3 + CELL * .22, cy3, cx3 + CELL * .3, cy3 - CELL * .1); cx.stroke();
    cx.beginPath(); cx.moveTo(cx3, cy3 + CELL * .15); cx.quadraticCurveTo(cx3 - CELL * .22, cy3, cx3 - CELL * .3, cy3 - CELL * .1); cx.stroke();
    cx.fillStyle = '#d4a017'; cx.beginPath(); cx.ellipse(cx3 + CELL * .08, cy3 + CELL * .05, CELL * .08, CELL * .2, 0.3, 0, Math.PI*2); cx.fill();
    cx.fillStyle = '#f59e0b'; cx.beginPath(); cx.ellipse(cx3 + CELL * .06, cy3 + CELL * .04, CELL * .05, CELL * .14, 0.3, 0, Math.PI*2); cx.fill();
  }
  cx.strokeStyle = PAL.fence; cx.lineWidth = Math.max(2, CELL * .06);
  cx.strokeRect(cfX - CELL*.1, cfY - CELL*.1, cfW + CELL*.2, cfH + CELL*.2);
  lbl(cfX + cfW/2, cfY - CELL*.4, 'milharal', '#6baa30');

  // Workshop
  const wsX = PX + 18 * CELL, wsY = PY + 16 * CELL;
  _drawWorkshop(wsX, wsY);

  // Lake + pier
  _drawLake();
  const pierX = PX + 8 * CELL, pierY = PY + 23 * CELL;
  _drawPier(pierX, pierY);
}

// ── Workshop ──────────────────────────────────────────
function _drawWorkshop(hx, hy) {
  const hw = CELL * 3, hh = CELL * 2.5;
  cx.fillStyle = 'rgba(0,0,0,.22)'; cx.fillRect(hx+5, hy+5, hw, hh + CELL*.5);
  cx.fillStyle = '#5a4a32'; cx.fillRect(hx, hy, hw, hh);
  cx.fillStyle = 'rgba(0,0,0,.15)'; cx.fillRect(hx + hw*.55, hy, hw*.45, hh);
  cx.fillStyle = '#1a2a1a'; cx.fillRect(hx + CELL*.3, hy + CELL*.5, CELL*.55, CELL*.45);
  cx.fillStyle = 'rgba(180,140,40,.15)'; cx.fillRect(hx + CELL*.32, hy + CELL*.52, CELL*.51, CELL*.41);
  cx.strokeStyle = '#3a2a10'; cx.lineWidth = Math.max(2, CELL*.05); cx.strokeRect(hx + CELL*.3, hy + CELL*.5, CELL*.55, CELL*.45);
  cx.fillStyle = '#3a2810'; cx.fillRect(hx + CELL*.8, hy + hh - CELL*1.1, CELL*1.2, CELL*1.1);
  cx.strokeStyle = '#5a3a18'; cx.lineWidth = Math.max(1, CELL*.04);
  cx.beginPath(); cx.moveTo(hx + CELL*1.4, hy + hh - CELL*1.1); cx.lineTo(hx + CELL*1.4, hy + hh); cx.stroke();
  cx.fillStyle = '#4a5060';
  cx.fillRect(hx + CELL*.82, hy + hh - CELL*.95, CELL*.14, CELL*.08);
  cx.fillRect(hx + CELL*.82, hy + hh - CELL*.5,  CELL*.14, CELL*.08);
  cx.fillRect(hx + CELL*1.42, hy + hh - CELL*.95, CELL*.14, CELL*.08);
  cx.fillStyle = '#3a3028';
  for (let i = 0; i < 6; i++) cx.fillRect(hx + i * CELL*.5, hy + hh - CELL*.12, CELL*.48, CELL*.12);
  cx.fillStyle = '#2a1e14';
  cx.beginPath();
  cx.moveTo(hx - CELL*.2, hy); cx.lineTo(hx - CELL*.1, hy - CELL*.9);
  cx.lineTo(hx + hw + CELL*.1, hy - CELL*.65); cx.lineTo(hx + hw + CELL*.2, hy);
  cx.closePath(); cx.fill();
  cx.fillStyle = '#3a2a1c';
  cx.beginPath();
  cx.moveTo(hx - CELL*.2, hy); cx.lineTo(hx - CELL*.1, hy - CELL*.9);
  cx.lineTo(hx + hw*.4, hy - CELL*.78); cx.lineTo(hx + hw*.35, hy);
  cx.closePath(); cx.fill();
  const chx = hx + hw * .2;
  cx.fillStyle = '#2a1e14'; cx.fillRect(chx, hy - CELL*.85, CELL*.28, CELL*.6);
  cx.fillStyle = '#3a2e24'; cx.fillRect(chx - CELL*.04, hy - CELL*.88, CELL*.36, CELL*.1);
  const t2 = Date.now() / 1800;
  for (let i = 0; i < 3; i++) {
    const sy = hy - CELL*.9 - i * CELL * .35 - (t2 % 1) * CELL * .35;
    const sa = .15 + i * .08 + (t2 % 1) * .05;
    cx.fillStyle = `rgba(80,70,60,${sa})`;
    cx.beginPath(); cx.arc(chx + CELL*.14 + Math.sin(t2 + i) * CELL*.1, sy, CELL * (.12 + i * .06), 0, Math.PI*2); cx.fill();
  }
  cx.strokeStyle = PAL.wood2; cx.lineWidth = Math.max(2, CELL*.06); cx.lineCap = 'round';
  cx.beginPath(); cx.moveTo(hx - CELL*.05, hy + hh - CELL*.1); cx.lineTo(hx - CELL*.15, hy + CELL*.4); cx.stroke();
  cx.beginPath(); cx.moveTo(hx - CELL*.18, hy + CELL*.4); cx.lineTo(hx + CELL*.05, hy + CELL*.35); cx.stroke();
  lbl(hx + hw/2, hy - CELL*1.05, 'oficina', '#c8a070');
}

// ── Lake ──────────────────────────────────────────────
function _drawLake() {
  const lakeX = PX;
  const lakeY = PY + 22 * CELL;
  const lakeW = CELL * 9;
  const lakeH = CELL * 8;

  // Неровная форма озера
  cx.fillStyle = PAL.waterDeep;
  cx.beginPath();
  cx.moveTo(lakeX, lakeY + CELL * 2);
  cx.quadraticCurveTo(lakeX + CELL*1.5, lakeY + CELL*1, lakeX + CELL*3, lakeY + CELL*1.5);
  cx.quadraticCurveTo(lakeX + CELL*4.5, lakeY + CELL*0.5, lakeX + CELL*6, lakeY + CELL*1.2);
  cx.quadraticCurveTo(lakeX + CELL*7.5, lakeY + CELL*2, lakeX + CELL*9, lakeY + CELL*1);
  cx.lineTo(lakeX + lakeW, lakeY + lakeH);
  cx.lineTo(lakeX, lakeY + lakeH);
  cx.closePath(); cx.fill();

  cx.fillStyle = PAL.water1; cx.globalAlpha = .75;
  cx.beginPath();
  cx.moveTo(lakeX, lakeY + CELL * 2.2);
  cx.quadraticCurveTo(lakeX + CELL*1.5, lakeY + CELL*1.2, lakeX + CELL*3, lakeY + CELL*1.7);
  cx.quadraticCurveTo(lakeX + CELL*4.5, lakeY + CELL*0.7, lakeX + CELL*6, lakeY + CELL*1.4);
  cx.quadraticCurveTo(lakeX + CELL*7.5, lakeY + CELL*2.2, lakeX + CELL*9, lakeY + CELL*1.2);
  cx.lineTo(lakeX + lakeW, lakeY + lakeH);
  cx.lineTo(lakeX, lakeY + lakeH);
  cx.closePath(); cx.fill();
  cx.globalAlpha = 1;

  // Блики на воде
  const t3 = Date.now() / 2000;
  for (let i = 0; i < 8; i++) {
    const sx = lakeX + CELL * (1 + i * 0.8 + Math.sin(t3 + i * 0.7) * 0.3);
    const sy = lakeY + CELL * (1.5 + Math.cos(t3 * .8 + i) * 0.5 + i * 0.3);
    cx.fillStyle = PAL.waterHi; cx.globalAlpha = .3 + .3 * Math.sin(t3 * 2 + i);
    cx.beginPath(); cx.ellipse(sx, sy, CELL * .2, CELL * .06, t3 * .3 + i, 0, Math.PI*2); cx.fill();
  }
  cx.globalAlpha = 1;

  // Камни в озере
  for (let i = 0; i < 10; i++) {
    const rx = lakeX + CELL * (1 + i * 0.7 + tn(i+50,3) * 0.4);
    const ry = lakeY + CELL * (1 + tn(3,i+50) * 0.6);
    const rs = CELL * (.1 + tn(i+50,i+51) * .1);
    cx.fillStyle = tn(i,i+2) > .5 ? PAL.stone2 : PAL.stone3;
    cx.beginPath(); cx.ellipse(rx, ry, rs * 1.6, rs, tn(i,7)*Math.PI, 0, Math.PI*2); cx.fill();
  }

  // Водоросли
  for (let i = 0; i < 5; i++) {
    const lpx = lakeX + CELL * (1 + i * 1.5 + tn(i+70,2) * 0.5);
    const lpy = lakeY + CELL * (2 + tn(2,i+70) * 1);
    const lpr = CELL * (.15 + tn(i+70,i+71) * .08);
    cx.fillStyle = '#1a5010'; cx.beginPath(); cx.arc(lpx, lpy, lpr, 0, Math.PI*2); cx.fill();
    cx.fillStyle = '#22600e'; cx.beginPath(); cx.moveTo(lpx, lpy); cx.lineTo(lpx + lpr, lpy); cx.arc(lpx, lpy, lpr, 0, Math.PI * .5); cx.fill();
  }
  lbl(lakeX + CELL * 5, lakeY + CELL * 3, 'lago', PAL.water1);
}

// ── Pier ──────────────────────────────────────────────
function _drawPier(px2, py2) {
  const pw2 = CELL * 0.9, ph2 = CELL * 3, planks = 6;
  cx.fillStyle = 'rgba(0,0,0,.3)'; cx.fillRect(px2 + 3, py2 + 3, pw2, ph2);
  cx.fillStyle = PAL.wood3; cx.fillRect(px2, py2, pw2, ph2);
  cx.strokeStyle = PAL.woodDark; cx.lineWidth = 1;
  for (let i = 0; i <= planks; i++) {
    const py3 = py2 + i * (ph2 / planks);
    cx.beginPath(); cx.moveTo(px2, py3); cx.lineTo(px2 + pw2, py3); cx.stroke();
  }
  cx.strokeStyle = PAL.woodGrain; cx.lineWidth = 1; cx.globalAlpha = .3;
  cx.beginPath(); cx.moveTo(px2 + pw2*.3, py2); cx.lineTo(px2 + pw2*.3, py2 + ph2); cx.stroke();
  cx.beginPath(); cx.moveTo(px2 + pw2*.7, py2); cx.lineTo(px2 + pw2*.7, py2 + ph2); cx.stroke();
  cx.globalAlpha = 1;

  const postH = CELL * .5;
  [0, 1, 2.8].forEach(frac => {
    const py3 = py2 + frac * CELL;
    cx.fillStyle = PAL.woodDark; cx.fillRect(px2 - CELL*.12, py3, CELL*.12, postH);
    cx.fillStyle = PAL.wood2;    cx.fillRect(px2 - CELL*.1,  py3, CELL*.08, postH - 2);
    cx.fillStyle = PAL.woodDark; cx.fillRect(px2 + pw2,       py3, CELL*.12, postH);
    cx.fillStyle = PAL.wood2;    cx.fillRect(px2 + pw2 + CELL*.02, py3, CELL*.08, postH - 2);
  });

  const t4 = Date.now() / 1500;
  cx.strokeStyle = '#c8c0a0'; cx.lineWidth = 1; cx.lineCap = 'round';
  const lx2 = px2 + pw2 * .5, ly2 = py2 + ph2;
  cx.beginPath(); cx.moveTo(lx2, ly2);
  cx.quadraticCurveTo(lx2 + Math.sin(t4) * CELL * .3, ly2 + CELL * .5, lx2 + Math.sin(t4) * CELL * .2, ly2 + CELL * .9);
  cx.stroke();
  const floatY = ly2 + CELL * .9 + Math.sin(t4 * 2) * CELL * .04;
  cx.fillStyle = '#e05030'; cx.beginPath(); cx.ellipse(lx2 + Math.sin(t4)*CELL*.2, floatY, CELL*.07, CELL*.04, 0, 0, Math.PI*2); cx.fill();
  lbl(px2 + pw2/2, py2 - CELL*.35, 'píer', '#7ab8e0');
}

// ── Lantern ───────────────────────────────────────────
function _drawLantern(x, y) {
  const lh = Math.max(28, CELL * .9), lw = Math.max(3, CELL * .08);
  const hw = Math.max(8, CELL * .26),  hh = Math.max(9, CELL * .3);

  const glowR = CELL * 3.5;
  const glow = cx.createRadialGradient(x, y, 0, x, y + lh * .2, glowR);
  glow.addColorStop(0,   'rgba(255,200,80,.22)');
  glow.addColorStop(0.4, 'rgba(255,160,40,.10)');
  glow.addColorStop(1,   'rgba(255,120,0,0)');
  cx.fillStyle = glow; cx.beginPath(); cx.arc(x, y + lh * .2, glowR, 0, Math.PI*2); cx.fill();

  px(x - lw/2 + 2, y, lw, lh, 'rgba(0,0,0,.25)');
  px(x - lw/2, y, lw, lh, '#2a2218');
  px(x - lw/2 + 1, y, lw - 2, lh, '#3a3028');
  px(x - lw/2 + 1, y, 1, lh, 'rgba(255,255,200,.12)');

  const bx = x, by = y + lh * .12;
  cx.strokeStyle = '#3a3028'; cx.lineWidth = Math.max(2, lw * .7); cx.lineCap = 'round';
  cx.beginPath(); cx.moveTo(bx, by); cx.lineTo(bx + hw * .6, by - hh * .5); cx.stroke();

  const hx = x + hw * .6, hy = by - hh * .5;
  cx.fillStyle = '#2a2218';
  cx.beginPath();
  cx.moveTo(hx, hy - hh * .6); cx.lineTo(hx + hw * .5, hy - hh * .1);
  cx.lineTo(hx + hw * .45, hy + hh * .55); cx.lineTo(hx - hw * .45, hy + hh * .55);
  cx.lineTo(hx - hw * .5, hy - hh * .1); cx.closePath(); cx.fill();

  cx.fillStyle = `rgba(255,180,40,.85)`;
  cx.beginPath();
  cx.moveTo(hx, hy - hh * .45); cx.lineTo(hx + hw * .35, hy - hh * .05);
  cx.lineTo(hx + hw * .3, hy + hh * .42); cx.lineTo(hx - hw * .3, hy + hh * .42);
  cx.lineTo(hx - hw * .35, hy - hh * .05); cx.closePath(); cx.fill();

  const inner = cx.createRadialGradient(hx, hy + hh*.1, 0, hx, hy + hh*.1, hw*.5);
  inner.addColorStop(0, 'rgba(255,240,180,.95)');
  inner.addColorStop(0.5,'rgba(255,200,80,.6)');
  inner.addColorStop(1, 'rgba(255,140,20,0)');
  cx.fillStyle = inner;
  cx.beginPath();
  cx.moveTo(hx, hy - hh * .45); cx.lineTo(hx + hw * .35, hy - hh * .05);
  cx.lineTo(hx + hw * .3, hy + hh * .42); cx.lineTo(hx - hw * .3, hy + hh * .42);
  cx.lineTo(hx - hw * .35, hy - hh * .05); cx.closePath(); cx.fill();

  cx.strokeStyle = '#2a2218'; cx.lineWidth = Math.max(1, lw * .5); cx.lineCap = 'square';
  ln(hx, hy - hh * .45, hx, hy + hh * .42);
  ln(hx - hw * .38, hy + hh * .14, hx + hw * .38, hy + hh * .14);

  cx.fillStyle = '#1e1810';
  cx.beginPath();
  cx.moveTo(hx - hw * .4, hy - hh * .42); cx.lineTo(hx, hy - hh * .75); cx.lineTo(hx + hw * .4, hy - hh * .42);
  cx.closePath(); cx.fill();
  cx.fillStyle = 'rgba(255,255,200,.08)';
  cx.beginPath();
  cx.moveTo(hx - hw * .15, hy - hh * .42); cx.lineTo(hx, hy - hh * .72); cx.lineTo(hx + hw * .15, hy - hh * .42);
  cx.closePath(); cx.fill();

  px(hx - lw*.3, hy + hh * .55, lw * .6, Math.max(2, lw), '#2a2218');
}

// ── Forest border ─────────────────────────────────────
function _drawForest() {
  const margin = CELL * .15;
  const forest2 = [];
  const worldRight = PX + PW, worldBottom = PY + PH;

  function tryAdd(x, y, seed) {
    const s = CELL * (.7 + tn(seed, seed+1) * .5);
    if (x > PX - s && x < PX + PEN_COLS * CELL + s * 2 && y > PY - s && y < PY + PH + s) return;
    const dx = x - well.x, dy = y - well.y;
    if (Math.sqrt(dx*dx+dy*dy) < CELL * 2.5) return;
    const pathY = gate.y + gate.h / 2, pathPW = CELL * .9;
    if (x > PX + PEN_COLS * CELL && Math.abs(y - pathY) < pathPW + s * .5) return;
    forest2.push({ x, y, seed, s });
  }

  const topCount = Math.floor(PW / (CELL * .9));
  for (let i = 0; i < topCount; i++) {
    tryAdd(PX + i * (CELL * .9) + tn(i, 300) * CELL * .5, PY + margin + tn(300, i) * CELL * 1.2, i + 300);
    if (tn(i, 301) > .35) tryAdd(PX + i * (CELL * .9) + CELL * .45, PY + margin + tn(300, i) * CELL * 1.2 + CELL * (.4 + tn(i+1,301)*.5), i + 400);
  }
  const botCount = Math.floor(PW / (CELL * .9));
  for (let i = 0; i < botCount; i++) {
    tryAdd(PX + i * (CELL * .9) + tn(i, 500) * CELL * .5, worldBottom - margin - tn(500, i) * CELL * 1.2, i + 500);
    if (tn(i, 501) > .35) tryAdd(PX + i * (CELL * .9) + CELL * .45, worldBottom - margin - tn(500, i) * CELL * 1.2 - CELL * (.4 + tn(i+1,501)*.5), i + 600);
  }
  const leftCount = Math.floor(PH / (CELL * .9));
  for (let i = 0; i < leftCount; i++) {
    tryAdd(PX + margin + tn(i, 700) * CELL * 1.2, PY + i * (CELL * .9) + tn(700, i) * CELL * .5, i + 700);
    if (tn(i, 701) > .4) tryAdd(PX + margin + tn(i, 700) * CELL * 1.2 + CELL * (.4 + tn(i+1,701)*.4), PY + i * (CELL * .9) + CELL * .45, i + 800);
  }
  const rightCount = Math.floor(PH / (CELL * .9));
  for (let i = 0; i < rightCount; i++) {
    tryAdd(worldRight - margin - tn(i, 900) * CELL * 1.2, PY + i * (CELL * .9) + tn(900, i) * CELL * .5, i + 900);
    if (tn(i, 901) > .4) tryAdd(worldRight - margin - tn(i, 900) * CELL * 1.2 - CELL * (.4 + tn(i+1,901)*.4), PY + i * (CELL * .9) + CELL * .45, i + 1000);
  }

  forest2.sort((a, b) => a.y - b.y);
  for (const t of forest2) _drawForestTree(t.x, t.y, t.s, t.seed, Math.floor(tn(t.seed, t.seed+2) * 4));
}

// ── Forest tree (4 types) ─────────────────────────────
function _drawForestTree(x, y, s, seed, type) {
  const t2 = Date.now() / 4000;
  const sway = Math.sin(t2 + seed * 1.7) * s * .008;

  if (type === 0) {
    // Spruce
    const tw = Math.max(3, s * .18), trunkH = s * .55;
    cx.fillStyle='rgba(0,0,0,.2)'; cx.beginPath(); cx.ellipse(x+2,y+s*.08,s*.28,s*.08,0,0,Math.PI*2); cx.fill();
    px(x-tw/2, y-trunkH, tw, trunkH, PAL.woodDark);
    px(x-tw/2+1, y-trunkH+1, tw-2, trunkH-1, '#2a1408');
    [{col:'#0d2904',hi:'#102e06',sz:.72,oy:.52},{col:'#0a2003',hi:'#0d2805',sz:.60,oy:.36},{col:'#081a02',hi:'#0b2204',sz:.46,oy:.20},{col:'#060e01',hi:'#091602',sz:.30,oy:.07}]
      .forEach(({col,hi,sz,oy}) => {
        const sw=sway*(1+oy);
        cx.fillStyle=col; cx.beginPath(); cx.moveTo(x+sw,y-s*oy-s*sz*.72); cx.lineTo(x-s*sz*.58+sw*.5,y-s*oy); cx.lineTo(x+s*sz*.58+sw*.5,y-s*oy); cx.closePath(); cx.fill();
        cx.fillStyle=hi;  cx.beginPath(); cx.moveTo(x+sw,y-s*oy-s*sz*.72); cx.lineTo(x-s*sz*.58+sw*.5,y-s*oy); cx.lineTo(x-s*sz*.28,y-s*oy); cx.lineTo(x+sw,y-s*oy-s*sz*.48); cx.closePath(); cx.fill();
      });
  } else if (type === 1) {
    // Wide spruce
    const tw = Math.max(4, s * .22), trunkH = s * .48;
    cx.fillStyle='rgba(0,0,0,.18)'; cx.beginPath(); cx.ellipse(x+2,y+s*.08,s*.38,s*.1,0,0,Math.PI*2); cx.fill();
    px(x-tw/2, y-trunkH, tw, trunkH, PAL.woodDark);
    px(x-tw/2+1, y-trunkH+1, tw-2, trunkH-1, '#2e1a0a');
    [{col:'#132e06',hi:'#183808',sz:.78,oy:.42},{col:'#0f2504',hi:'#132e06',sz:.64,oy:.26},{col:'#0b1c03',hi:'#0f2504',sz:.48,oy:.12}]
      .forEach(({col,hi,sz,oy}) => {
        const sw=sway*(1+oy*.8);
        cx.fillStyle=col; cx.beginPath(); cx.moveTo(x+sw,y-s*oy-s*sz*.62); cx.lineTo(x-s*sz*.68+sw*.5,y-s*oy); cx.lineTo(x+s*sz*.68+sw*.5,y-s*oy); cx.closePath(); cx.fill();
        cx.fillStyle=hi;  cx.beginPath(); cx.moveTo(x+sw,y-s*oy-s*sz*.62); cx.lineTo(x-s*sz*.68+sw*.5,y-s*oy); cx.lineTo(x-s*sz*.32,y-s*oy); cx.lineTo(x+sw,y-s*oy-s*sz*.40); cx.closePath(); cx.fill();
      });
  } else if (type === 2) {
    // Birch
    const tw = Math.max(3, s * .14), trunkH = s * .55, trunkTop = y - trunkH;
    cx.fillStyle='rgba(0,0,0,.15)'; cx.beginPath(); cx.ellipse(x+2,y+s*.08,s*.2,s*.06,0,0,Math.PI*2); cx.fill();
    px(x-tw/2, trunkTop, tw, trunkH, '#d8d0c0');
    for (let i=0;i<4;i++) { const my=trunkTop+(i+.5)*trunkH/5+tn(seed+i,seed)*s*.05; px(x-tw/2-1,my,tw+2,Math.max(2,s*.03),'#4a4030'); }
    px(x-tw/2+1, trunkTop+1, Math.max(1,tw-3), trunkH-2, '#e8e0d0');
    const cr = s * .36;
    [{ox:-s*.1,oy:-cr*.5},{ox:s*.12,oy:-cr*.35},{ox:0,oy:-cr*.85}].forEach(({ox,oy},i) => {
      const cy=trunkTop+oy;
      cx.fillStyle = i===2 ? '#1a3a0a' : '#1e4a0c';
      cx.beginPath(); cx.arc(x+ox+sway, cy, cr*(i===2?.68:.82), 0, Math.PI*2); cx.fill();
      cx.fillStyle='rgba(60,100,20,.25)';
      cx.beginPath(); cx.ellipse(x+ox+sway-cr*.2, cy-cr*.22, cr*.28, cr*.18, -.3, 0, Math.PI*2); cx.fill();
    });
  } else {
    // Bush
    const br = Math.max(6, s * .42);
    cx.fillStyle='rgba(0,0,0,.18)'; cx.beginPath(); cx.ellipse(x+2,y+br*.2,br*.8,br*.2,0,0,Math.PI*2); cx.fill();
    [[-br*.35,0],[br*.35,0],[0,-br*.28],[br*.12,br*.1],[-br*.18,br*.08]].forEach(([ox2,oy2],i) => {
      cx.fillStyle=['#152808','#1a3209','#122006','#183008'][i%4];
      cx.beginPath(); cx.arc(x+ox2+sway*.5, y+oy2, br*(.5+tn(seed+i,seed+i+1)*.3), 0, Math.PI*2); cx.fill();
    });
    cx.fillStyle='rgba(40,80,10,.25)';
    cx.beginPath(); cx.ellipse(x-br*.15+sway,y-br*.3,br*.28,br*.18,-.3,0,Math.PI*2); cx.fill();
  }
}

// ── Dirt (pen floor) ──────────────────────────────────
function _drawDirt() {
  const penH = PEN_ROWS * CELL;
  px(PX, PY, PEN_COLS * CELL, penH, PAL.dirt1);
  for (let c = 0; c < PEN_COLS; c++) for (let r = 0; r < PEN_ROWS; r++) {
    const tx=PX+c*CELL, ty=PY+r*CELL, n=tn(c+1,r+1), n2=tn2(c,r);
    if (n < 0.18) px(tx+1,ty+1,CELL-2,CELL-2,PAL.dirt2);
    else if (n < 0.05) px(tx+1,ty+1,CELL-2,CELL-2,PAL.dirt3);
    else if (n2 > .92) px(tx+1,ty+1,CELL-2,CELL-2,PAL.dirt4);
  }

  for (let i = 0; i < 28; i++) {
    const px2=PX+tn(i,77)*PEN_COLS*CELL, py2=PY+tn(77,i)*penH;
    const pr2=Math.max(1,CELL*.04);
    cx.fillStyle=PAL.dirtPebble; cx.beginPath(); cx.ellipse(px2,py2,pr2*1.5,pr2,tn(i,0)*Math.PI,0,Math.PI*2); cx.fill();
    cx.fillStyle='rgba(255,255,255,.06)'; cx.beginPath(); cx.ellipse(px2-pr2*.3,py2-pr2*.3,pr2*.6,pr2*.4,0,0,Math.PI*2); cx.fill();
  }

  const hcx=horse.x+horse.w*.5, hcy=horse.y+horse.h*.8;
  for (let i=0;i<6;i++) {
    const hpx=hcx+(i-3)*CELL*.35+tn(i,99)*CELL*.15, hpy=hcy+tn(99,i)*CELL*.4;
    const hps=Math.max(2,CELL*.08);
    cx.fillStyle='rgba(0,0,0,.35)';
    cx.beginPath(); cx.ellipse(hpx,hpy,hps,hps*.6,.3,0,Math.PI*2); cx.fill();
    cx.beginPath(); cx.ellipse(hpx+hps,hpy,hps*.7,hps*.45,.3,0,Math.PI*2); cx.fill();
  }

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

  const pudX=PX+PEN_COLS*CELL-CELL*1.2, pudY=gate.y+gate.h+CELL*.4;
  cx.fillStyle=PAL.water3; cx.globalAlpha=.45;
  cx.beginPath(); cx.ellipse(pudX,pudY,CELL*.35,CELL*.15,-.2,0,Math.PI*2); cx.fill();
  cx.fillStyle=PAL.waterHi; cx.globalAlpha=.3;
  cx.beginPath(); cx.ellipse(pudX-CELL*.08,pudY-CELL*.04,CELL*.12,CELL*.05,0,0,Math.PI*2); cx.fill();
  cx.globalAlpha=1;

  cx.strokeStyle='rgba(0,0,0,.15)'; cx.lineWidth=1;
  for (let c=0;c<=PEN_COLS;c++) ln(PX+c*CELL,PY,PX+c*CELL,PY+penH);
  for (let r=0;r<=PEN_ROWS;r++) ln(PX,PY+r*CELL,PX+PEN_COLS*CELL,PY+r*CELL);

  const penW = PEN_COLS * CELL;
  const ig = cx.createRadialGradient(PX+penW/2,PY+penH/2,Math.min(penW,penH)*.25,PX+penW/2,PY+penH/2,Math.max(penW,penH)*.7);
  ig.addColorStop(0,'rgba(0,0,0,0)'); ig.addColorStop(1,'rgba(0,0,0,.22)');
  cx.fillStyle=ig; cx.fillRect(PX,PY,penW,penH);
}

// ── Fence ─────────────────────────────────────────────
function drawFence() {
  const lw=Math.max(3,CELL*.12), pr=Math.max(3,CELL*.09);
  const pL=PX+PEN_COL_START*CELL, pR=PX+(PEN_COL_END+1)*CELL;
  const pT=PY+PEN_ROW_START*CELL, pB=PY+(PEN_ROW_END+1)*CELL;

  cx.strokeStyle='rgba(0,0,0,.28)'; cx.lineWidth=lw+2; cx.lineCap='square';
  cx.beginPath(); cx.moveTo(pL+1,pT+2); cx.lineTo(pR+1,pT+2); cx.stroke();
  cx.beginPath(); cx.moveTo(pL+1,pT+2); cx.lineTo(pL+1,pB+2); cx.stroke();
  cx.beginPath(); cx.moveTo(pL+1,pB+2); cx.lineTo(pR+1,pB+2); cx.stroke();
  cx.beginPath(); cx.moveTo(pR+1,pT+2); cx.lineTo(pR+1,gate.y+2); cx.stroke();
  cx.beginPath(); cx.moveTo(pR+1,gate.y+gate.h+2); cx.lineTo(pR+1,pB+2); cx.stroke();

  function seg(x1,y1,x2,y2) {
    cx.strokeStyle=PAL.fenceShadow; cx.lineWidth=lw+1; cx.lineCap='square'; ln(x1+1,y1+1,x2+1,y2+1);
    cx.strokeStyle=PAL.fence; cx.lineWidth=lw; ln(x1,y1,x2,y2);
    const d=Math.sqrt((x2-x1)**2+(y2-y1)**2)||1;
    const ox=-(y2-y1)/d, oy=(x2-x1)/d;
    cx.strokeStyle=PAL.woodGrain; cx.lineWidth=1; cx.globalAlpha=.4;
    ln(x1+ox*.5,y1+oy*.5,x2+ox*.5,y2+oy*.5);
    cx.globalAlpha=1;
    cx.strokeStyle=PAL.fenceHi; cx.lineWidth=1; ln(x1+ox,y1+oy,x2+ox,y2+oy);
    cx.fillStyle=PAL.fenceMoss; cx.globalAlpha=.35;
    for (let i=0;i<3;i++) {
      const t=.2+i*.3, mx=x1+(x2-x1)*t, my=y1+(y2-y1)*t;
      cx.beginPath(); cx.ellipse(mx+ox*.5,my+oy*.5,CELL*.1,CELL*.05,Math.atan2(y2-y1,x2-x1),0,Math.PI*2); cx.fill();
    }
    cx.globalAlpha=1;
  }
  function post(px2,py2,big) {
    const sz=(big?pr*2.4:pr*1.9);
    px(px2-sz/2+2,py2-sz/2+2,sz,sz,'rgba(0,0,0,.35)');
    px(px2-sz/2,py2-sz/2,sz,sz,PAL.woodDark);
    px(px2-sz/2+1,py2-sz/2+1,sz-2,sz-2,PAL.fencePost);
    cx.fillStyle=PAL.woodGrain; cx.globalAlpha=.3;
    px(px2-sz/2+2,py2-sz/2+1,1,sz-2,'rgba(160,120,40,.4)');
    cx.globalAlpha=1;
    px(px2-sz/2+1,py2-sz/2+1,sz-2,1,PAL.fenceHi);
    if(big){ cx.fillStyle=PAL.fenceMoss; cx.globalAlpha=.4; px(px2-sz/2,py2+sz/4,sz*.6,sz*.3,'#3a5020'); cx.globalAlpha=1; }
  }
  function gpost(px2,py2) {
    const sz=pr*2.6;
    px(px2-sz/2+2,py2-sz/2+2,sz,sz,'rgba(0,0,0,.35)');
    px(px2-sz/2,py2-sz/2,sz,sz,PAL.woodDark);
    px(px2-sz/2+1,py2-sz/2+1,sz-2,sz-2,'#b8860b');
    px(px2-sz/2+1,py2-sz/2+1,sz-2,1,'#ffd700');
    cx.fillStyle='rgba(255,200,0,.15)'; cx.beginPath(); cx.arc(px2,py2,sz*.9,0,Math.PI*2); cx.fill();
  }

  seg(pL,pT,pR,pT); seg(pL,pB,pR,pB); seg(pL,pT,pL,pB);
  seg(pR,pT,pR,gate.y); seg(pR,gate.y+gate.h,pR,pB);

  [[0,0],[PEN_COLS*CELL,0],[0,PEN_ROWS*CELL],[PEN_COLS*CELL,PEN_ROWS*CELL]].forEach(([dx,dy])=>
    post(pL+dx,pT+dy,true)
  );
  for (let i=2;i<PEN_COLS;i+=2){post(pL+i*CELL,pT);post(pL+i*CELL,pB);}
  for (let i=2;i<PEN_ROWS;i+=2) post(pL,pT+i*CELL);

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
    px(lx-4,ly-2,8,6,'#3a2800'); px(lx-3,ly-2,6,5,'#8b6914'); px(lx-2,ly-1,4,3,'#6b4a00');
    cx.strokeStyle='#c8a030'; cx.lineWidth=1.5; cx.lineCap='round';
    cx.beginPath(); cx.arc(lx,ly-3,2.5,Math.PI,0); cx.stroke();
    cx.fillStyle='rgba(180,120,0,.2)'; cx.beginPath(); cx.arc(lx,ly,5,0,Math.PI*2); cx.fill();
  }
  lbl(pR+CELL*.4, gate.y+gate.h*.5, 'portão', '#d4a017');
}

// ── Well ──────────────────────────────────────────────
function drawWell() {
  const x=well.x, y=well.y, r=well.r, t=Date.now()/2000;
  cx.fillStyle='rgba(0,0,0,.3)'; cx.beginPath(); cx.ellipse(x+3,y+r+3,r*.9,r*.25,0,0,Math.PI*2); cx.fill();

  const brickCols=['#3d3830','#4a4540','#353028','#42393a','#383230','#4e4844'];
  for (let a=0; a<Math.PI*2; a+=0.22) {
    const bx=x+Math.cos(a)*r*.85, by=y+Math.sin(a)*r*.85;
    const bsz=Math.max(3,r*.24);
    cx.fillStyle=brickCols[Math.floor(a*5)%6];
    cx.beginPath(); cx.ellipse(bx,by,bsz,bsz*.65,a,0,Math.PI*2); cx.fill();
    cx.strokeStyle='rgba(0,0,0,.4)'; cx.lineWidth=1;
    cx.beginPath(); cx.ellipse(bx,by,bsz*.9,bsz*.55,a,0,Math.PI*2); cx.stroke();
    if (Math.sin(a*3)>.6) { cx.fillStyle=PAL.stoneMoss; cx.globalAlpha=.4; cx.beginPath(); cx.ellipse(bx,by-bsz*.2,bsz*.5,bsz*.2,0,0,Math.PI*2); cx.fill(); cx.globalAlpha=1; }
  }

  cx.fillStyle=PAL.waterDeep; cx.beginPath(); cx.arc(x,y,r*.68,0,Math.PI*2); cx.fill();
  cx.fillStyle=PAL.water1; cx.globalAlpha=.7; cx.beginPath(); cx.arc(x,y,r*.65,0,Math.PI*2); cx.fill(); cx.globalAlpha=1;
  cx.fillStyle=PAL.waterHi;
  cx.beginPath(); cx.ellipse(x-r*.2+Math.sin(t)*r*.1,y-r*.18+Math.cos(t*.7)*r*.05,r*.32,r*.1,-.4+t*.1,0,Math.PI*2); cx.fill();
  cx.globalAlpha=.5;
  cx.beginPath(); cx.ellipse(x+r*.15+Math.cos(t*.9)*r*.08,y+r*.1,r*.18,r*.06,.3,0,Math.PI*2); cx.fill();
  cx.globalAlpha=1;

  cx.strokeStyle='#4a4540'; cx.lineWidth=Math.max(3,CELL*.1); cx.lineCap='square';
  cx.beginPath(); cx.arc(x,y,r*.85,0,Math.PI*2); cx.stroke();
  cx.strokeStyle='rgba(255,255,255,.06)'; cx.lineWidth=1;
  cx.beginPath(); cx.arc(x,y,r*.87,Math.PI*1.1,Math.PI*1.9); cx.stroke();

  const pw = Math.max(3, r*.15);
  const postTop=y-r*1.36, postBot=y-r*.05, postH=postBot-postTop;
  px(x-r*.72-pw/2, postTop, pw, postH, PAL.woodDark);
  px(x-r*.72-pw/2+1, postTop+1, pw-2, postH-1, PAL.wood2);
  px(x-r*.72-pw/2+1, postTop+1, pw-2, 1, PAL.woodHi);
  px(x+r*.72-pw/2, postTop, pw, postH, PAL.woodDark);
  px(x+r*.72-pw/2+1, postTop+1, pw-2, postH-1, PAL.wood2);
  px(x+r*.72-pw/2+1, postTop+1, pw-2, 1, PAL.woodHi);

  const cbh=Math.max(2,r*.13);
  px(x-r*.88, postTop, r*1.76, cbh, PAL.woodDark);
  px(x-r*.86, postTop+1, r*1.72, cbh-1, PAL.wood2);
  px(x-r*.86, postTop+1, r*1.72, 1, PAL.woodHi);
  cx.strokeStyle=PAL.woodGrain; cx.lineWidth=1; cx.globalAlpha=.3;
  for (let i=0;i<3;i++) ln(x-r*.6+i*r*.4, postTop+1, x-r*.5+i*r*.4, postTop+cbh);
  cx.globalAlpha=1;

  cx.strokeStyle='#c8a070'; cx.lineWidth=Math.max(1.5,CELL*.05); cx.lineCap='round';
  const ropeSway=Math.sin(t*.5)*r*.04, ropeTop=postTop+cbh;
  cx.beginPath(); cx.moveTo(x+ropeSway, ropeTop); cx.quadraticCurveTo(x+r*.08+ropeSway,y-r*.5,x,y-r*.72); cx.stroke();
  cx.strokeStyle='#a07848'; cx.lineWidth=1; cx.globalAlpha=.5;
  cx.beginPath(); cx.moveTo(x+ropeSway+1, ropeTop); cx.quadraticCurveTo(x+r*.1+ropeSway,y-r*.5,x+1,y-r*.72); cx.stroke();
  cx.globalAlpha=1;

  const bw=r*.48, bh2=r*.4, by2=y-r*.72;
  px(x-bw/2,by2,bw,bh2,PAL.woodDark);
  px(x-bw/2+1,by2+1,bw-2,bh2-2,PAL.water2);
  px(x-bw/2-1,by2-r*.08,bw+2,r*.09,'#2a2a2a');
  px(x-bw/2,by2-r*.06,bw,r*.07,'#3a4a62');
  cx.fillStyle=PAL.waterHi; cx.globalAlpha=.6;
  cx.beginPath(); cx.ellipse(x,by2+bh2*.2,bw*.35,bh2*.1,0,0,Math.PI*2); cx.fill();
  cx.globalAlpha=1;
  lbl(x, y-r*1.66, 'poço', '#7ab8e0');
}

// ── Trough ────────────────────────────────────────────
function drawTrough() {
  const x=trough.x, y=trough.y, s=CELL*.55;
  px(x-s*.62,y-s*.28,s*1.24,s*.56,PAL.stone3);
  px(x-s*.58,y-s*.24,s*1.16,s*.48,PAL.stone2);
  px(x-s*.5,y-s*.18,s,s*.32,PAL.stone1);
  if (trough.full) {
    px(x-s*.46,y-s*.14,s*.92,s*.22,PAL.water1);
    cx.fillStyle=PAL.waterHi; cx.beginPath();
    cx.ellipse(x-s*.12,y-s*.08,s*.22,s*.06,-.2,0,Math.PI*2); cx.fill();
  }
  cx.strokeStyle='#5a5048'; cx.lineWidth=1; ln(x-s*.58,y-s*.24,x+s*.58,y-s*.24);
  lbl(x, y-s*.5, 'cocho', trough.full ? '#7ab8e0' : '#7a6040');
}

// ── Village helper draws (used by _drawVillageStatic) ─
function _drawVillageForestEdge(vx, vy, vw) {
  const penH = PEN_ROWS * CELL;
  for (let i = 0; i < Math.floor(vw / (CELL * .8)) + 1; i++) {
    const tx = vx + i * CELL * .8 + tn(i, 200) * CELL * .4;
    const topOff = tn(200, i) * CELL * .6, botOff = tn(i, 201) * CELL * .6;
    const s = CELL * (.5 + tn(i,202) * .4), type = Math.floor(tn(i, 203) * 4);
    _drawForestTree(tx, vy + topOff + s * .1, s, i + 200, type);
    _drawForestTree(tx, vy + penH - botOff - s * .1, s, i + 300, type);
  }
}

function _drawVillageHouse(hx, hy) {
  const hw = CELL * 3.5, hh = CELL * 2.2;
  cx.fillStyle = 'rgba(0,0,0,.25)'; cx.fillRect(hx + 6, hy + 6, hw, hh + CELL * .6);
  cx.fillStyle = '#3a2e20'; cx.fillRect(hx - CELL * .1, hy + hh - CELL * .1, hw + CELL * .2, CELL * .3);
  cx.fillStyle = '#c8a878'; cx.fillRect(hx, hy, hw, hh);
  cx.fillStyle = 'rgba(0,0,0,.12)'; cx.fillRect(hx + hw * .6, hy, hw * .4, hh);
  _drawVillageWindow(hx + CELL * .5,  hy + CELL * .5, CELL * .7, CELL * .7);
  _drawVillageWindow(hx + CELL * 2.2, hy + CELL * .5, CELL * .7, CELL * .7);
  cx.fillStyle = '#5c3d1e'; cx.fillRect(hx + hw/2 - CELL*.3, hy + hh - CELL*.9, CELL*.6, CELL*.9);
  cx.fillStyle = '#8b6914'; cx.beginPath(); cx.arc(hx + hw/2 + CELL*.15, hy + hh - CELL*.45, CELL*.06, 0, Math.PI*2); cx.fill();
  cx.fillStyle = '#5c3020';
  cx.beginPath(); cx.moveTo(hx - CELL*.3, hy); cx.lineTo(hx + hw/2, hy - CELL*1.1); cx.lineTo(hx + hw + CELL*.3, hy); cx.closePath(); cx.fill();
  cx.fillStyle = '#7a4030';
  cx.beginPath(); cx.moveTo(hx - CELL*.3, hy); cx.lineTo(hx + hw/2, hy - CELL*1.1); cx.lineTo(hx + hw/2 + CELL*.2, hy - CELL*1.05); cx.lineTo(hx + CELL*.2, hy); cx.closePath(); cx.fill();
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
