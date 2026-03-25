// ════════════════════════════════════════════════════
// WORLD-RENDER-DYNAMIC.JS — Dynamic object rendering
// Horses, trees (normal + monster), items, monster, player,
// village NPCs, particles, ambient fireflies, speech bubble
// Depends on: world-config.js, world-state.js
// ════════════════════════════════════════════════════

// ── Ambient fireflies / dust motes ───────────────────
let ambientParts = [];

function initAmbient() {
  ambientParts = [];
  for (let i = 0; i < 18; i++) {
    ambientParts.push({
      x: PX + Math.random() * PW, y: PY + Math.random() * PH,
      vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .2,
      r: .8 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      speed: .02 + Math.random() * .03,
      col: Math.random() > .5 ? '#a0e040' : '#60c0ff',
      inside: false,
    });
  }
}

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

// ── Particles ─────────────────────────────────────────
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

function drawParts() {
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    cx.globalAlpha = Math.min(1, p.life / 10, p.life / p.max * 1.6);
    cx.fillStyle = p.color;
    if (p.star) {
      cx.save(); cx.translate(Math.round(p.x), Math.round(p.y)); cx.rotate(p.rot);
      cx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * .4 - Math.PI / 2, a2 = a + Math.PI * .2;
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

// ── Horse ─────────────────────────────────────────────
function drawHorse() {
  const x = Math.round(horse.x + horse.w / 2);
  const y = Math.round(horse.y + horse.h / 2);
  const s = Math.round(CELL * .14);
  const t = Date.now() / 600;
  const bob = Math.round(Math.sin(t) * 1.2);

  cx.save(); cx.translate(x, y + bob); cx.imageSmoothingEnabled = false;

  function sq(rx, ry, rw, rh, c) { cx.fillStyle = c; cx.fillRect(Math.round(rx), Math.round(ry), Math.round(rw), Math.round(rh)); }

  const bw = s*9, bh = s*6;
  const bodyCol = horse.decorated ? '#c87040' : '#8B6340';
  const darkCol = horse.decorated ? '#9a5030' : '#6B4A28';
  const hiCol   = horse.decorated ? '#e09060' : '#AA7A50';

  cx.fillStyle = 'rgba(0,0,0,.28)';
  cx.beginPath(); cx.ellipse(0, bh*.55, bw*.55, bh*.12, 0, 0, Math.PI*2); cx.fill();

  const legH = s*3.5;
  sq(-bw*.38, bh*.35, s*2, legH, darkCol); sq(-bw*.12, bh*.38, s*2, legH, darkCol);
  sq( bw*.1,  bh*.38, s*2, legH, darkCol); sq( bw*.34, bh*.35, s*2, legH, darkCol);
  sq(-bw*.4,  bh*.35 + legH, s*2.4, s, '#111'); sq(-bw*.14, bh*.38 + legH, s*2.4, s, '#111');
  sq( bw*.08, bh*.38 + legH, s*2.4, s, '#111'); sq( bw*.32, bh*.35 + legH, s*2.4, s, '#111');

  sq(-bw*.5, -bh*.45, bw, bh*.9, bodyCol);
  sq(-bw*.5, -bh*.45, bw, s, hiCol);
  sq(-bw*.5,  bh*.36, bw, s*.8, darkCol);
  sq(-bw*.46, -bh*.7, s*3.5, bh*.38, bodyCol);
  sq(-bw*.58, -bh*1.1, s*5.5, s*5, bodyCol);
  sq(-bw*.58, -bh*1.1, s*5.5, s, hiCol);
  sq(-bw*.52, -bh*.52, s*4, s*2, darkCol);
  sq(-bw*.5,  -bh*.48, s*.8, s*.8, '#111'); sq(-bw*.22, -bh*.48, s*.8, s*.8, '#111');
  sq(-bw*.32, -bh*1.0, s*1.4, s*1.4, '#111'); sq(-bw*.32, -bh*1.0, s*.6, s*.6, '#fff');
  sq(-bw*.4, -bh*1.22, s*1.2, s*1.8, bodyCol); sq(-bw*.38, -bh*1.22, s*.6, s, hiCol);
  for (let i = 0; i < 4; i++) sq(-bw*.44 + i*s*.6, -bh*1.12 - i*s*.4, s*.8, s*1.2 + i*s*.3, '#4a2a10');
  sq(bw*.42, -bh*.28, s*1.4, s*4, '#6b4a28'); sq(bw*.44, bh*.1, s, s*3, '#4a2a10');

  if (horse.decorated) {
    sq(-bw*.25, -bh*1.28, s*2, s, '#f472b6');
    sq(-bw*.16, -bh*1.42, s, s*1.4, '#f472b6');
    sq(-bw*.34, -bh*1.42, s, s*1.4, '#f472b6');
    sq(-bw*.25, -bh*1.38, s*.8, s*.8, '#fbbf24');
  }

  cx.restore();
  const lt = horse.fed && horse.watered ? 'cavalinho ♥' : 'cavalinho';
  const lc = horse.fed && horse.watered ? '#fbbf24' : '#d4a017';
  lbl(x, Math.round(horse.y) - s*2, lt, lc);
}

// ── Trees ─────────────────────────────────────────────
function drawTrees() {
  for (const t of trees) {
    if (t.stump) _drawStump(t.x, t.y);
    else if (t.alive) t.isMonster ? _drawMonsterTree(t.x, t.y) : _drawTree(t.x, t.y);
  }
}

function _drawStump(x, y) {
  const s=CELL*.42, t=Date.now()/3000;
  cx.fillStyle='rgba(0,0,0,.25)'; cx.beginPath(); cx.ellipse(x+2,y+s*.25,s*.58,s*.15,0,0,Math.PI*2); cx.fill();
  cx.strokeStyle=PAL.wood3; cx.lineWidth=Math.max(2,s*.12); cx.lineCap='round';
  for (let i=0;i<3;i++) {
    const ra=Math.PI*.6+i*Math.PI*.35;
    cx.beginPath(); cx.moveTo(x,y+s*.1); cx.quadraticCurveTo(x+Math.cos(ra)*s*.5,y+Math.sin(ra)*s*.4+s*.1,x+Math.cos(ra)*s*.7,y+Math.sin(ra)*s*.5+s*.2); cx.stroke();
  }
  px(x-s*.44,y-s*.2,s*.88,s*.44,PAL.woodDark); px(x-s*.4,y-s*.16,s*.8,s*.38,PAL.wood3);
  px(x-s*.4,y-s*.16,s*.8,s*.07,PAL.woodHi);
  cx.strokeStyle='#2a1a08'; cx.lineWidth=1;
  cx.beginPath(); cx.ellipse(x,y-s*.14,s*.38,s*.13,0,0,Math.PI*2); cx.stroke();
  cx.fillStyle='#4a2e10'; cx.beginPath(); cx.ellipse(x,y-s*.14,s*.3,s*.11,0,0,Math.PI*2); cx.fill();
  cx.strokeStyle='#3a2008'; cx.lineWidth=1; cx.beginPath(); cx.ellipse(x,y-s*.14,s*.18,s*.07,0,0,Math.PI*2); cx.stroke();
  cx.fillStyle='#5a3818'; cx.beginPath(); cx.ellipse(x,y-s*.14,s*.08,s*.04,0,0,Math.PI*2); cx.fill();
  cx.strokeStyle='#2a5010'; cx.lineWidth=Math.max(1,s*.06);
  cx.beginPath(); cx.moveTo(x+s*.1,y-s*.14); cx.quadraticCurveTo(x+s*.2,y-s*.5,x+s*.15,y-s*.7+Math.sin(t)*s*.05); cx.stroke();
  cx.fillStyle='#3a7020'; cx.beginPath(); cx.ellipse(x+s*.15,y-s*.7,s*.12,s*.08,-.5,0,Math.PI*2); cx.fill();
}

function _drawTree(x, y) {
  const s=CELL*.9, t=Date.now()/3500, sway=Math.sin(t)*s*.012;
  cx.fillStyle='rgba(0,0,0,.2)'; cx.beginPath(); cx.ellipse(x+2,y+s*.14,s*.38,s*.11,0,0,Math.PI*2); cx.fill();
  cx.strokeStyle=PAL.wood3; cx.lineWidth=Math.max(1.5,s*.08); cx.lineCap='round';
  for (let i=0;i<3;i++) {
    const ra=Math.PI*.5+i*Math.PI*.4;
    cx.beginPath(); cx.moveTo(x,y+s*.05); cx.quadraticCurveTo(x+Math.cos(ra)*s*.35,y+Math.sin(ra)*s*.3,x+Math.cos(ra)*s*.55,y+Math.sin(ra)*s*.45); cx.stroke();
  }
  const tw=Math.max(4,s*.22);
  px(x-tw/2,y-s*.06,tw,s*.52,PAL.woodDark); px(x-tw/2+1,y-s*.04,tw-2,s*.48,PAL.wood3);
  cx.strokeStyle=PAL.woodGrain; cx.lineWidth=1; cx.globalAlpha=.25;
  ln(x-tw*.1,y-s*.02,x-tw*.1,y+s*.42); ln(x+tw*.15,y,x+tw*.15,y+s*.38);
  cx.globalAlpha=1;

  [{col:'#1a4a0a',hi:'#235e10',sh:'#0e2e05',sz:.56,oy:.46},
   {col:'#153d07',hi:'#1c4d0c',sh:'#0b2503',sz:.47,oy:.3},
   {col:'#102e04',hi:'#183808',sh:'#081c02',sz:.34,oy:.14}]
    .forEach(({col,hi,sh,sz,oy}) => {
      const sw=sway*(1+oy);
      cx.fillStyle=sh; cx.globalAlpha=.5;
      cx.beginPath(); cx.moveTo(x+sw+s*.04,y-s*oy-s*sz*.52+s*.03); cx.lineTo(x-s*sz*.52+sw,y-s*oy+s*.03); cx.lineTo(x+s*sz*.52+sw,y-s*oy+s*.03); cx.closePath(); cx.fill(); cx.globalAlpha=1;
      cx.fillStyle=col; cx.beginPath(); cx.moveTo(x+sw,y-s*oy-s*sz*.55); cx.lineTo(x-s*sz*.52+sw*.5,y-s*oy); cx.lineTo(x+s*sz*.52+sw*.5,y-s*oy); cx.closePath(); cx.fill();
      cx.fillStyle=hi;  cx.beginPath(); cx.moveTo(x+sw,y-s*oy-s*sz*.55); cx.lineTo(x-s*sz*.52+sw*.5,y-s*oy); cx.lineTo(x-s*sz*.28+sw*.3,y-s*oy); cx.lineTo(x+sw,y-s*oy-s*sz*.38); cx.closePath(); cx.fill();
    });

  for (let i=0;i<3;i++) {
    const ax=x+sway+(i-1)*s*.22+Math.sin(i*2.7)*s*.1;
    const ay=y-s*.22-i*s*.08+Math.cos(i*1.8)*s*.06;
    const ar=Math.max(1.5,s*.05);
    circ(ax,ay,ar,'#8b1a1a'); circ(ax,ay,ar*.8,'#c0392b');
    cx.fillStyle='rgba(255,255,255,.3)'; cx.beginPath(); cx.ellipse(ax-ar*.3,ay-ar*.3,ar*.3,ar*.2,-.3,0,Math.PI*2); cx.fill();
  }

  const spec=Math.sin(t*2.3+x)*.5+.5;
  if (spec>.75) {
    cx.fillStyle='rgba(200,255,100,.4)'; cx.globalAlpha=spec-.75;
    cx.beginPath(); cx.arc(x+sway+s*.12,y-s*.35,s*.04,0,Math.PI*2); cx.fill();
    cx.globalAlpha=1;
  }
  lbl(x,y-s*1.0,'árvore','#4a8a50');
}

function _drawMonsterTree(x, y) {
  const s=CELL*.9, t=Date.now()/800, sway=Math.sin(t)*(s*.02);
  cx.fillStyle='rgba(80,0,0,.2)'; cx.beginPath(); cx.ellipse(x+2,y+s*.14,s*.44,s*.13,0,0,Math.PI*2); cx.fill();

  const tw=Math.max(5,s*.26);
  px(x-tw/2,y-s*.06,tw,s*.54,PAL.woodDark); px(x-tw/2+1,y-s*.04,tw-2,s*.5,'#2a1408');
  [[-.5,.44],[.42,.4],[-.28,.52]].forEach(([rx,ry]) => px(x+s*rx*tw*.045,y+s*ry,Math.max(3,tw*.45),Math.max(2,s*.07),'#1a0c04'));
  cx.strokeStyle='#8b0000'; cx.lineWidth=1; cx.globalAlpha=.5;
  cx.beginPath(); cx.moveTo(x,y-s*.02); cx.lineTo(x-s*.04,y+s*.2); cx.lineTo(x+s*.02,y+s*.42); cx.stroke();
  cx.globalAlpha=1;

  [{col:'#0c2204',hi:'#0f2e06',sh:'rgba(60,0,0,.3)',sz:.58,oy:.47},
   {col:'#091a02',hi:'#0c2404',sh:'rgba(60,0,0,.3)',sz:.48,oy:.3},
   {col:'#060e01',hi:'#091602',sh:'rgba(60,0,0,.3)',sz:.35,oy:.13}]
    .forEach(({col,hi,sh,sz,oy}) => {
      const sw=sway*(1+oy*.5);
      cx.fillStyle=sh; cx.beginPath(); cx.moveTo(x+sw+s*.04,y-s*oy-s*sz*.55+s*.03); cx.lineTo(x-s*sz*.56+sw,y-s*oy+s*.03); cx.lineTo(x+s*sz*.56+sw,y-s*oy+s*.03); cx.closePath(); cx.fill();
      cx.fillStyle=col; cx.beginPath(); cx.moveTo(x+sw,y-s*oy-s*sz*.58); cx.lineTo(x-s*sz*.55+sw*.5,y-s*oy); cx.lineTo(x+s*sz*.55+sw*.5,y-s*oy); cx.closePath(); cx.fill();
      cx.fillStyle=hi;  cx.beginPath(); cx.moveTo(x+sw,y-s*oy-s*sz*.58); cx.lineTo(x-s*sz*.55+sw*.5,y-s*oy); cx.lineTo(x-s*sz*.28,y-s*oy); cx.lineTo(x+sw,y-s*oy-s*sz*.4); cx.closePath(); cx.fill();
    });

  const gr=cx.createRadialGradient(x,y-s*.32,0,x,y-s*.32,s*.65);
  gr.addColorStop(0,'rgba(180,20,20,.22)'); gr.addColorStop(1,'rgba(180,20,20,0)');
  cx.fillStyle=gr; cx.beginPath(); cx.arc(x,y-s*.32,s*.65,0,Math.PI*2); cx.fill();

  const eyeGlow=.5+.5*Math.sin(t*1.2);
  cx.fillStyle=`rgba(200,0,0,${eyeGlow*.3})`; cx.beginPath(); cx.arc(x-s*.13,y-s*.42,s*.1,0,Math.PI*2); cx.fill();
  cx.beginPath(); cx.arc(x+s*.13,y-s*.42,s*.1,0,Math.PI*2); cx.fill();
  circ(x-s*.13,y-s*.42,Math.max(2,s*.065),'#8b0000');
  circ(x+s*.13,y-s*.42,Math.max(2,s*.065),'#8b0000');
  if (eyeGlow>.6) {
    circ(x-s*.13,y-s*.42,Math.max(1,s*.04),`rgba(255,40,40,${eyeGlow})`);
    circ(x+s*.13,y-s*.42,Math.max(1,s*.04),`rgba(255,40,40,${eyeGlow})`);
  }
  cx.fillStyle=`rgba(255,180,0,${eyeGlow*.8})`;
  cx.fillRect(Math.round(x-s*.13-1),Math.round(y-s*.42-1),2,2);
  cx.fillRect(Math.round(x+s*.13-1),Math.round(y-s*.42-1),2,2);

  for (let i=0;i<4;i++) {
    const sa=t*.4+i*Math.PI*.5, sr=s*.55+Math.sin(t+i)*s*.1;
    cx.fillStyle='rgba(60,20,20,.5)'; cx.globalAlpha=.4+.3*Math.sin(t*2+i);
    cx.beginPath(); cx.arc(x+Math.cos(sa)*sr,y-s*.3+Math.sin(sa*.7)*s*.2,s*.035,0,Math.PI*2); cx.fill();
  }
  cx.globalAlpha=1;
  lbl(x,y-s*1.02,'⚠ árvore','#c0392b');
}

// ── Items ─────────────────────────────────────────────
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

/**
 * Unified sprite renderer — works for world items (large) and held item (small/mini).
 * Origin = centre of item, scale = s (half-size unit).
 */
function drawItemSprite(type, color, s, filled) {
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
      });
      circ(0,0,Math.max(2,s*.14),'#d4a017'); circ(0,0,Math.max(1,s*.06),'#8b6914');
      break;
    }
    case 'bucket': {
      const bw=s*.56, bh2=s*.6;
      cx.fillStyle='rgba(0,0,0,.18)'; cx.beginPath(); cx.ellipse(0,bh2*.6,bw*.5,bh2*.12,0,0,Math.PI*2); cx.fill();
      cx.fillStyle=filled?'#1a3a7a':'#2a3a5a'; cx.beginPath(); cx.moveTo(-bw*.5,-bh2*.1); cx.lineTo(bw*.5,-bh2*.1); cx.lineTo(bw*.42,bh2*.5); cx.lineTo(-bw*.42,bh2*.5); cx.closePath(); cx.fill();
      cx.fillStyle=filled?'#1e4898':'#334a70'; cx.beginPath(); cx.moveTo(-bw*.5,-bh2*.1); cx.lineTo(bw*.5,-bh2*.1); cx.lineTo(bw*.42,bh2*.1); cx.lineTo(-bw*.42,bh2*.1); cx.closePath(); cx.fill();
      px(-bw*.54,-bh2*.18,bw*1.08,bh2*.12,'#222a3a'); px(-bw*.52,-bh2*.16,bw*1.04,bh2*.08,'#3a4a62');
      cx.strokeStyle='#4a5a72'; cx.lineWidth=Math.max(1.5,s*.06); cx.lineCap='round'; cx.beginPath(); cx.arc(0,-bh2*.28,bw*.38,.2,Math.PI-.2); cx.stroke();
      if(filled){ cx.fillStyle='rgba(40,100,220,.65)'; cx.beginPath(); cx.moveTo(-bw*.44,-bh2*.06); cx.lineTo(bw*.44,-bh2*.06); cx.lineTo(bw*.42,bh2*.1); cx.lineTo(-bw*.42,bh2*.1); cx.closePath(); cx.fill(); }
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

// Held-item mini render (called from drawPlayer)
function drawMini(type, color, s, filled) { drawItemSprite(type, color, s, filled); }

// ── Monster ───────────────────────────────────────────
function drawMonster() {
  const r=monster.r, x=Math.round(monster.x), y=Math.round(monster.y);
  const t=Date.now()/350, bob=Math.round(Math.sin(t*2.2)*2), s=Math.round(r*0.22);

  cx.save(); cx.translate(x, y+bob); cx.imageSmoothingEnabled=false;
  function sq(rx,ry,rw,rh,c){ cx.fillStyle=c; cx.fillRect(Math.round(rx),Math.round(ry),Math.round(rw),Math.round(rh)); }

  cx.fillStyle='rgba(0,0,0,.4)'; cx.beginPath(); cx.ellipse(0,r*.85,r*.6,r*.15,0,0,Math.PI*2); cx.fill();
  cx.fillStyle='rgba(10,80,10,.18)'; cx.beginPath(); cx.arc(0,0,r*1.7,0,Math.PI*2); cx.fill();

  const bd=r*.78;
  sq(-bd,-bd*.9,bd*2,bd*2,'#0f4a1a'); sq(-bd*.6,-bd*.7,bd*.9,bd*.5,'#1a6b28');
  sq(-bd*.3,bd*.1,bd*.5,bd*.3,'#0a3012'); sq(bd*.15,-bd*.3,bd*.4,bd*.3,'#0a3012');

  for (let i=0;i<5;i++) {
    const lx=-bd+i*bd*.4+Math.round(Math.sin(t+i)*s);
    sq(lx,-bd*1.3-(i%2)*s*1.5,bd*.5,bd*.7,'#1a5a20');
    sq(lx+s*.3,-bd*1.3-(i%2)*s*1.5,s*.6,s*.5,'#2a8030');
  }

  const wag=Math.round(Math.sin(t*1.8)*s*2);
  sq(-bd*1.5,-bd*.2+wag,bd*.7,bd*.3,'#0f4a1a'); sq(bd*.8,-bd*.2-wag,bd*.7,bd*.3,'#0f4a1a');
  sq(-bd*1.8,bd*.06+wag,bd*.6,bd*.5,'#0a3012'); sq(bd*1.2,bd*.06-wag,bd*.6,bd*.5,'#0a3012');

  const ew=Math.round(r*.34),eh=Math.round(r*.28);
  sq(-bd*.52,-bd*.32,ew,eh,'#d4c010'); sq(bd*.14,-bd*.32,ew,eh,'#d4c010');
  const pdx=P.x-x, pdy=P.y-y, plen=Math.sqrt(pdx*pdx+pdy*pdy)||1;
  const px2=Math.round((pdx/plen)*s*.5), py2=Math.round((pdy/plen)*s*.3);
  sq(-bd*.52+s*.3+px2,-bd*.32+s*.2+py2,s*.9,s*.9,'#111');
  sq(bd*.14+s*.3+px2,-bd*.32+s*.2+py2,s*.9,s*.9,'#111');
  sq(-bd*.58,-bd*.46,ew*.7,s*.5,'#c0392b'); sq(bd*.12,-bd*.46,ew*.7,s*.5,'#c0392b');

  const mw=Math.round(bd*.9), my=Math.round(bd*.3);
  sq(-mw*.5,my,mw,s*.8,'#060e06');
  sq(-mw*.35,my-s*.3,s*.8,s*1.2,'#e8e0d0'); sq(mw*.35-s*.8,my-s*.3,s*.8,s*1.2,'#e8e0d0');
  const drool=Math.round(Math.sin(t*1.8)*s*1.5+s);
  sq(-s*.4,my+s*.8,s*.7,drool,'rgba(100,200,80,.5)');

  cx.restore();
  lbl(x, y-r*1.6, 'monstro', '#c0392b');
}

// ── Player ────────────────────────────────────────────
function drawPlayer() {
  const r=P.r, x=Math.round(P.x), y=Math.round(P.y), t=Date.now()/400;
  const moving=!!(pTarget||pathWaypoints.length);
  const bob=moving?Math.round(Math.sin(t*5)*2):Math.round(Math.sin(t)*1);
  const s=Math.round(r*0.22);

  cx.save(); cx.translate(x,y); cx.imageSmoothingEnabled=false;
  function sq(rx,ry,rw,rh,c){ cx.fillStyle=c; cx.fillRect(Math.round(rx),Math.round(ry),Math.round(rw),Math.round(rh)); }

  cx.fillStyle='rgba(0,0,0,.3)'; cx.beginPath(); cx.ellipse(0,r*.75,r*.5,r*.12,0,0,Math.PI*2); cx.fill();

  const legY=r*.32+bob;
  if (moving) {
    const lk=Math.round(Math.sin(t*5)*s*1.5);
    sq(-s*1.6,legY,s*1.4,r*.52+lk,'#1a3a6a'); sq(s*.2,legY,s*1.4,r*.52-lk,'#1a3a6a');
    sq(-s*1.8,legY+r*.5+lk-s,s*1.8,s*1.2,'#1a1208'); sq(s*.1,legY+r*.5-lk-s,s*1.8,s*1.2,'#1a1208');
  } else {
    sq(-s*1.6,legY,s*1.4,r*.48,'#1a3a6a'); sq(s*.2,legY,s*1.4,r*.48,'#1a3a6a');
    sq(-s*1.8,legY+r*.44,s*1.8,s*1.2,'#1a1208'); sq(s*.1,legY+r*.44,s*1.8,s*1.2,'#1a1208');
  }

  sq(-s*2.2,-r*.2+bob*.3,s*4.4,r*.56,'#2563a8');
  sq(-s*2.2,-r*.2+bob*.3,s*4.4,s,'#3b7fd4');
  sq(-s*2.4,r*.28+bob*.3,s*4.8,s,'#5c3d1e');
  sq(-s*.4, r*.28+bob*.3,s*.8,s,'#c8a030');

  const armSwing=moving?Math.round(Math.sin(t*5)*s*2):0;
  sq(-s*3.2,-r*.15+armSwing+bob*.3,s*1.2,r*.46,'#2563a8');
  sq( s*2,  -r*.15-armSwing+bob*.3,s*1.2,r*.46,'#2563a8');
  sq(-s*3.4, r*.24+armSwing+bob*.3,s*1.4,s*1.2,'#e8c97a');
  sq( s*2,   r*.24-armSwing+bob*.3,s*1.4,s*1.2,'#e8c97a');

  if (playerHeld) {
    const it=items.find(i=>i.id===playerHeld);
    if (it) {
      cx.save();
      cx.translate(Math.round(s*3.6),Math.round(-r*.1-armSwing+bob*.3));
      drawMini(it.type,it.color,r*.52,it.filled);
      cx.restore();
    }
  }

  sq(-s*2.2,-r*.26+bob*.3,s*4.4,s*1.1,'#c0392b');

  const hx=-s*2, hy=-r*.96+bob*.5;
  sq(hx,hy,s*4,s*4.2,'#e8c97a'); sq(hx,hy,s*4,s,'#6b3a0e');
  sq(hx-s*.5,hy,s*.8,s*3,'#6b3a0e'); sq(hx+s*3.6,hy,s*.8,s*3,'#6b3a0e');
  sq(hx+s*.6, hy+s*1.5,s*.9,s*.9,'#111'); sq(hx+s*2.4,hy+s*1.5,s*.9,s*.9,'#111');
  sq(hx+s*.6, hy+s*1.5,s*.4,s*.4,'#fff'); sq(hx+s*2.4,hy+s*1.5,s*.4,s*.4,'#fff');
  sq(hx+s*.4, hy+s*1.0,s*1.2,s*.4,'#5a3010'); sq(hx+s*2.2,hy+s*1.0,s*1.2,s*.4,'#5a3010');
  sq(hx+s*.8, hy+s*2.8,s*1.2,s*.4,'#8b4020'); sq(hx+s*2.0,hy+s*2.6,s*.8,s*.4,'#8b4020');

  cx.restore();
}

// ── Village NPCs ──────────────────────────────────────
function drawVillage() {
  if (!villageNPCs || !villageNPCs.length) return;
  for (const npc of villageNPCs) _drawVillageNPC(npc);
}

function _drawVillageNPC(npc) {
  const r=npc.r||CELL*.4, x=Math.round(npc.x), y=Math.round(npc.y);
  const s=Math.round(r*0.22), t=Date.now()/800, bob=Math.round(Math.sin(t)*0.8);

  cx.save(); cx.translate(x,y+bob); cx.imageSmoothingEnabled=false;
  function sq(rx,ry,rw,rh,c){ cx.fillStyle=c; cx.fillRect(Math.round(rx),Math.round(ry),Math.round(rw),Math.round(rh)); }

  cx.fillStyle='rgba(0,0,0,.22)'; cx.beginPath(); cx.ellipse(0,r*.8,r*.45,r*.1,0,0,Math.PI*2); cx.fill();

  sq(-s*2.8,-r*.08,s*5.6,r*.96,'#2a3a5a'); sq(-s*3.2,r*.6,s*6.4,r*.36,'#223060');
  sq(-s*1.4,s*.1,s*2.8,r*.72,'rgba(230,220,190,.18)'); sq(-s*2.8,-r*.08,s*5.6,s*.7,'#3a4f7a');
  sq(-s*1.8,r*.88,s*1.6,s*.9,'#3a2820'); sq(s*.2,r*.88,s*1.6,s*.9,'#3a2820');
  sq(-s*3.2,-r*.1,s*1.4,r*.52,'#2a3a5a'); sq(s*1.8,-r*.1,s*1.4,r*.52,'#2a3a5a');
  sq(-s*3.4,r*.36,s*1.5,s*1.1,'#e8c97a'); sq(s*1.9,r*.36,s*1.5,s*1.1,'#e8c97a');

  cx.strokeStyle=PAL.wood2; cx.lineWidth=Math.max(2,s*.7); cx.lineCap='round';
  cx.beginPath(); cx.moveTo(Math.round(s*3.2),-r*.08); cx.lineTo(Math.round(s*3.6),r*.9); cx.stroke();

  const hx=-s*1.8, hy=-r*.88;
  sq(hx,hy,s*3.8,s*4,'#e8c97a'); sq(hx+s*.4,hy+s*1.8,s*2.8,s*.3,'rgba(0,0,0,.15)');
  sq(hx-s*.4,hy-s*.3,s*4.8,s*1.2,'#6b2a8a'); sq(hx-s*.6,hy-s*.3,s*5,s*.6,'#8a3aaa');
  sq(hx+s*.8,hy+s*3.4,s*2,s*.9,'#5a2070');
  sq(hx+s*.5,hy+s*1.5,s*.9,s*.7,'#5a3a10'); sq(hx+s*2.2,hy+s*1.5,s*.9,s*.7,'#5a3a10');
  cx.fillStyle='rgba(220,80,80,.18)';
  cx.beginPath(); cx.arc(Math.round(hx+s*.7),Math.round(hy+s*2.5),s*1.1,0,Math.PI*2); cx.fill();
  cx.beginPath(); cx.arc(Math.round(hx+s*2.9),Math.round(hy+s*2.5),s*1.1,0,Math.PI*2); cx.fill();
  sq(hx+s*.6,hy+s*3.0,s*.7,s*.4,'#8b4020'); sq(hx+s*1.4,hy+s*3.2,s*.8,s*.4,'#8b4020'); sq(hx+s*2.2,hy+s*3.0,s*.7,s*.4,'#8b4020');

  if (dist(P, npc) < CELL * 2.5) {
    cx.fillStyle='rgba(251,191,36,.1)'; cx.beginPath(); cx.arc(0,0,CELL,0,Math.PI*2); cx.fill();
  }

  cx.restore();
  lbl(x, Math.round(y-r*1.2), npc.name, '#c084fc');
}

// ── Speech bubble ─────────────────────────────────────
let charBubble = { text: '', life: 0, maxLife: 0 };

function charSay(txt, ms = 4400) {
  charBubble = { text: txt, life: ms / 16, maxLife: ms / 16 };
}

function drawCharBubble() {
  if (charBubble.life <= 0) return;
  charBubble.life--;
  const alpha = Math.min(1, charBubble.life / 8, (charBubble.maxLife - charBubble.life + 1) / 8);
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
  mainCx.beginPath(); mainCx.moveTo(sx-6, by+bh); mainCx.lineTo(sx+6, by+bh); mainCx.lineTo(sx, by+bh+7); mainCx.closePath(); mainCx.fill();
  mainCx.strokeStyle = '#4ade80'; mainCx.lineWidth = 1.5;
  mainCx.beginPath(); mainCx.moveTo(sx-6, by+bh+1); mainCx.lineTo(sx, by+bh+7); mainCx.lineTo(sx+6, by+bh+1); mainCx.stroke();
  mainCx.fillStyle = '#e2e8f0'; mainCx.textAlign = 'center';
  mainCx.fillText(charBubble.text, bx + bw / 2, by + sz + 4);
  mainCx.textAlign = 'left'; mainCx.globalAlpha = 1;
}

// ── Main draw call ────────────────────────────────────
function draw() {
  console.log('draw called, W:', W, 'H:', H, 'started:', started);
  if (!W || !H) {
    console.error('Canvas not initialized, W or H is undefined');
    return;
  }
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
