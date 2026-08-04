#!/usr/bin/env node
// generate.js — Swedish 12×11 remix of johniak's word clock (Makerworld/GitHub).
//
// Matches the original's physical interface so the assembly method and
// firmware keep working:
//   - outer 187.12 × 178.61 mm (same as the original Top Shell / back plate)
//   - 13.5135 mm cell pitch (= 74 LEDs/m strip → FULL uncut strip rows)
//   - 11 × 10 cells — the SIMULATOR's exact grid (110 LEDs), cross-checked
//     against ../index.html on every run. Firmware constants become 11/10.
//   - serpentine LED indexing identical to ClockDisplayHAL::cartesianToWordClockLEDStripIndex
//
// Outputs:
//   ../laser/… nothing — everything lands in ./out/
//   out/topshell_sv_body.stl     black: front slab with letter holes + cell walls + bosses
//   out/topshell_sv_letters.stl  TRANSPARENT: letters filling the slab (AMS, in place)
//   out/backplate_sv.stl         black: flat back plate, M3 corner holes + keyhole hanger
//   out/preview.svg              visual check of the Swedish layout
//   firmware/words_sv.h          generated LED table for the ESP32 firmware patch
//
// The letter layout is validated here on every run: word positions vs the letter
// matrix, full 24h time coverage, reading order, and LED-range collisions.
// Run:  npm install && node generate.js [fontPath]

const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');
const earcut = require('earcut');

// ============================================================
// SWEDISH 12×11 LAYOUT
// ============================================================
// EXACTLY the simulator's grid (index.html GRID_LETTERS) — character for
// character, 11×10 = 110 letters, nothing added. Nothing forces johniak's
// 12×11: the strip pitch only fixes the CELL SIZE (13.51mm); column/row count
// is free. Fewer cells in the same outer shell just means a wider frame.
const COLS = 11, ROWS = 10;
const LAYOUT = [
  'KLOCKANVHÄR',
  'SFEMISTIONA',
  'TJUGOMIESND',
  'KVARTBÖVERG',
  'LIAHHALVÖTP',
  'ETTRTVÅLSND',
  'TRENFYRAOST',
  'FEMBSEXOSJU',
  'ÅTTAMNIODEK',
  'ELVATOLVTIO',
];

// word → {row, c0, c1, text} — the simulator's WORDS converted to row/col.
// Names follow the firmware convention (ASCII).
const WORDS = {
  KLOCKAN: { row: 0, c0: 0, c1: 6,  text: 'KLOCKAN' },
  AR:      { row: 0, c0: 9, c1: 10, text: 'ÄR' },
  FEM_MIN: { row: 1, c0: 1, c1: 3,  text: 'FEM' },
  TIO_MIN: { row: 1, c0: 6, c1: 8,  text: 'TIO' },
  TJUGO:   { row: 2, c0: 0, c1: 4,  text: 'TJUGO' },
  KVART:   { row: 3, c0: 0, c1: 4,  text: 'KVART' },
  OVER:    { row: 3, c0: 6, c1: 9,  text: 'ÖVER' },
  I:       { row: 4, c0: 1, c1: 1,  text: 'I' },
  HALV:    { row: 4, c0: 4, c1: 7,  text: 'HALV' },
  HOUR_1:  { row: 5, c0: 0, c1: 2,  text: 'ETT' },
  HOUR_2:  { row: 5, c0: 4, c1: 6,  text: 'TVÅ' },
  HOUR_3:  { row: 6, c0: 0, c1: 2,  text: 'TRE' },
  HOUR_4:  { row: 6, c0: 4, c1: 7,  text: 'FYRA' },
  HOUR_5:  { row: 7, c0: 0, c1: 2,  text: 'FEM' },
  HOUR_6:  { row: 7, c0: 4, c1: 6,  text: 'SEX' },
  HOUR_7:  { row: 7, c0: 8, c1: 10, text: 'SJU' },
  HOUR_8:  { row: 8, c0: 0, c1: 3,  text: 'ÅTTA' },
  HOUR_9:  { row: 8, c0: 5, c1: 7,  text: 'NIO' },
  HOUR_10: { row: 9, c0: 8, c1: 10, text: 'TIO' },
  HOUR_11: { row: 9, c0: 0, c1: 3,  text: 'ELVA' },
  HOUR_12: { row: 9, c0: 4, c1: 7,  text: 'TOLV' },
};

// Swedish time semantics, 5-minute blocks. Sequence excludes KLOCKAN/ÄR (always on)
// and the hour word (appended last). nextHour: reference the NEXT hour from :25.
const TIME_BLOCKS = [
  { m: 0,  words: [],                          nextHour: false },
  { m: 5,  words: ['FEM_MIN', 'OVER'],         nextHour: false },
  { m: 10, words: ['TIO_MIN', 'OVER'],         nextHour: false },
  { m: 15, words: ['KVART', 'OVER'],           nextHour: false },
  { m: 20, words: ['TJUGO', 'OVER'],           nextHour: false },
  { m: 25, words: ['FEM_MIN', 'I', 'HALV'],    nextHour: true },
  { m: 30, words: ['HALV'],                    nextHour: true },
  { m: 35, words: ['FEM_MIN', 'OVER', 'HALV'], nextHour: true },
  { m: 40, words: ['TJUGO', 'I'],              nextHour: true },
  { m: 45, words: ['KVART', 'I'],              nextHour: true },
  { m: 50, words: ['TIO_MIN', 'I'],            nextHour: true },
  { m: 55, words: ['FEM_MIN', 'I'],            nextHour: true },
];

// ============================================================
// LAYOUT VALIDATION
// ============================================================
const problems = [];

// Cross-check against the simulator: LAYOUT must be character-for-character
// identical to GRID_LETTERS in ../index.html — the simulator is the reference.
{
  const sim = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');
  const m = sim.match(/const GRID_LETTERS = \[([\s\S]*?)\];/);
  if (!m) problems.push('could not find GRID_LETTERS in ../index.html');
  else {
    const simLetters = [...m[1].matchAll(/'([^'])'/g)].map(x => x[1]);
    const ours = LAYOUT.join('');
    if (simLetters.length !== ours.length) {
      problems.push(`letter count differs from simulator: ${ours.length} vs ${simLetters.length}`);
    } else {
      simLetters.forEach((ch, i) => {
        if (ours[i] !== ch) problems.push(`cell ${i} (row ${Math.floor(i/COLS)}, col ${i%COLS}): STL has "${ours[i]}", simulator has "${ch}"`);
      });
    }
  }
}
if (LAYOUT.length !== ROWS) problems.push(`layout has ${LAYOUT.length} rows, expected ${ROWS}`);
LAYOUT.forEach((row, i) => {
  if ([...row].length !== COLS) problems.push(`row ${i} has ${[...row].length} letters, expected ${COLS}`);
});
for (const [name, w] of Object.entries(WORDS)) {
  const slice = [...LAYOUT[w.row]].slice(w.c0, w.c1 + 1).join('');
  if (slice !== w.text) problems.push(`${name}: layout says "${slice}" at row ${w.row} cols ${w.c0}-${w.c1}, expected "${w.text}"`);
}
// Reading order: every displayable phrase must read top-down, left-to-right —
// a later word must be on a later row, or further right on the same row.
for (const block of TIME_BLOCKS) {
  for (let h = 1; h <= 12; h++) {
    const seq = ['KLOCKAN', 'AR', ...block.words, `HOUR_${h}`];
    let prev = null, prevName = '';
    for (const name of seq) {
      const w = WORDS[name];
      if (prev && !(w.row > prev.row || (w.row === prev.row && w.c0 > prev.c1)))
        problems.push(`phrase order broken at :${block.m} (hour ${h}): ${name} does not follow ${prevName} in reading order`);
      prev = w; prevName = name;
    }
  }
}
// Full 24h coverage: every 5-min time resolves to defined words.
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 5) {
    const block = TIME_BLOCKS[m / 5];
    let hour12 = h % 12; if (block.nextHour) hour12 = (hour12 + 1) % 12;
    const hourName = `HOUR_${hour12 === 0 ? 12 : hour12}`;
    for (const name of [...block.words, hourName]) {
      if (!WORDS[name]) problems.push(`time ${h}:${m}: word ${name} is not defined`);
    }
  }
}

// ============================================================
// LED TABLE (johniak's serpentine: index 0 = bottom-right, y counted from top)
// ============================================================
const NUM_LEDS = COLS * ROWS;
function ledIndex(x, y) {
  if (y % 2 === 0) return NUM_LEDS - y * COLS - (x + 1);
  return NUM_LEDS - (y + 1) * COLS + x;
}
const LED_TABLE = {};
for (const [name, w] of Object.entries(WORDS)) {
  const idx = [];
  for (let x = w.c0; x <= w.c1; x++) idx.push(ledIndex(x, w.row));
  const lo = Math.min(...idx), hi = Math.max(...idx);
  if (hi - lo !== w.c1 - w.c0) problems.push(`${name}: LED range not contiguous`);
  LED_TABLE[name] = [lo, hi];
}
const names = Object.keys(LED_TABLE);
for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
  const [a0, a1] = LED_TABLE[names[i]], [b0, b1] = LED_TABLE[names[j]];
  if (a0 <= b1 && b0 <= a1) problems.push(`LED overlap: ${names[i]} [${a0},${a1}] vs ${names[j]} [${b0},${b1}]`);
}

if (problems.length) {
  console.error('LAYOUT VALIDATION FAILED:\n  ' + problems.join('\n  '));
  process.exit(1);
}

// ============================================================
// GEOMETRY PARAMETERS (matching the original Top Shell)
// ============================================================
const OUTER_W = 187.12, OUTER_H = 178.61;
const PITCH = 1000 / 74;                  // 13.5135 — one 74/m strip LED per cell
const GRID_W = COLS * PITCH, GRID_H = ROWS * PITCH;
const GX = (OUTER_W - GRID_W) / 2;        // 12.48
const GY = (OUTER_H - GRID_H) / 2;        // 14.98
const SLAB = 2.5;                          // front face thickness (letters filled through this)
const TOTAL_H = 12;                        // shell depth incl. slab (same as original)
const WALL = 2.0;                          // cell + shell wall thickness
const BOSS = 8, PILOT = 2.7;               // M3 self-tap bosses in shell corners
const SCREW_HOLE = 3.4, SCREW_INSET = 6;   // back plate clearance holes
const BACK_T = 3;                          // back plate thickness
const CABLE_W = 10, CABLE_D = 5;           // cable notch in bottom shell wall (at plate side)
const V_MARGIN = 0.8, H_MARGIN = 1.0;      // keep letters inside the 11.51mm cell opening

const FONT_PATH = process.argv[2] || path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'arial.ttf');

// ============================================================
// Font machinery (same proven approach as laser/frontplate-2color)
// ============================================================
const font = opentype.loadSync(FONT_PATH);
const BEZIER_STEPS = 10;
const qP = (p, c, e, t) => { const u = 1 - t; return [u*u*p[0]+2*u*t*c[0]+t*t*e[0], u*u*p[1]+2*u*t*c[1]+t*t*e[1]]; };
const cP = (p, a, b, e, t) => { const u = 1 - t; return [
  u*u*u*p[0]+3*u*u*t*a[0]+3*u*t*t*b[0]+t*t*t*e[0], u*u*u*p[1]+3*u*u*t*a[1]+3*u*t*t*b[1]+t*t*t*e[1]]; };
const signedArea = r => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i+1)%r.length]; a += p[0]*q[1]-q[0]*p[1]; } return a/2; };
const pointInRing = (pt, ring) => {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (((a[1] > pt[1]) !== (b[1] > pt[1])) && (pt[0] < (b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])) ins = !ins;
  }
  return ins;
};

let ascU = 0, descU = 0, wideU = 0;
const uniqueLetters = new Set(LAYOUT.join(''));
for (const ch of uniqueLetters) {
  const bb = font.charToGlyph(ch).getPath(0, 0, 1000).getBoundingBox();
  if (font.charToGlyph(ch).index === 0) { console.error(`Font saknar tecknet "${ch}"`); process.exit(1); }
  ascU = Math.max(ascU, -bb.y1); descU = Math.max(descU, bb.y2); wideU = Math.max(wideU, bb.x2 - bb.x1);
}
const capBox = font.charToGlyph('H').getPath(0, 0, 1000).getBoundingBox();
const capU = capBox.y2 - capBox.y1;
const cellOpen = PITCH - WALL;
const scale = Math.min((cellOpen - 2*V_MARGIN) / (ascU + descU), (cellOpen - 2*H_MARGIN) / wideU);
const CAP_MM = capU * scale;
const BASELINE_DY = (ascU - descU) / 2 * scale;

function glyphContours(letter, cellCx, cellCy) {
  const p = font.charToGlyph(letter).getPath(0, 0, 1000);
  const contours = []; let cur = null, prev = null;
  for (const c of p.commands) {
    if (c.type === 'M') { cur = [[c.x, c.y]]; contours.push(cur); prev = [c.x, c.y]; }
    else if (c.type === 'L') { prev = [c.x, c.y]; cur.push(prev); }
    else if (c.type === 'Q') { for (let s = 1; s <= BEZIER_STEPS; s++) cur.push(qP(prev, [c.x1,c.y1], [c.x,c.y], s/BEZIER_STEPS)); prev = [c.x, c.y]; }
    else if (c.type === 'C') { for (let s = 1; s <= BEZIER_STEPS; s++) cur.push(cP(prev, [c.x1,c.y1], [c.x2,c.y2], [c.x,c.y], s/BEZIER_STEPS)); prev = [c.x, c.y]; }
  }
  const rings = contours.filter(r => r.length >= 3).map(r => r.map(([x, y]) => [x*scale, y*scale]));
  let minX = Infinity, maxX = -Infinity;
  for (const r of rings) for (const [x] of r) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
  const dx = cellCx - (minX + maxX) / 2, dy = cellCy + BASELINE_DY;
  for (const r of rings) for (const p2 of r) { p2[0] += dx; p2[1] += dy; }
  return rings;
}
function interiorPoint(ring) {
  const flat = []; for (const [x, y] of ring) flat.push(x, y);
  const t = earcut(flat, [], 2);
  if (t.length < 3) return [(ring[0][0]+ring[1][0]+ring[2][0])/3, (ring[0][1]+ring[1][1]+ring[2][1])/3];
  return [(flat[t[0]*2]+flat[t[1]*2]+flat[t[2]*2])/3, (flat[t[0]*2+1]+flat[t[1]*2+1]+flat[t[2]*2+1])/3];
}
function classify(rings) {
  const ip = rings.map(interiorPoint);
  const depth = rings.map((r, i) => {
    let d = 0;
    for (let j = 0; j < rings.length; j++) if (j !== i && pointInRing(ip[i], rings[j])) d++;
    return d;
  });
  const outers = [], holes = [];
  rings.forEach((r, i) => (depth[i] % 2 === 0 ? outers : holes).push({ r, ip: ip[i] }));
  const groups = outers.map(o => ({ outer: o.r, holes: [] }));
  for (const h of holes) {
    let best = -1, bestArea = Infinity;
    outers.forEach((o, gi) => { if (pointInRing(h.ip, o.r)) { const a = Math.abs(signedArea(o.r)); if (a < bestArea) { bestArea = a; best = gi; } } });
    if (best >= 0) groups[best].holes.push(h.r);
  }
  return { groups, outers: outers.map(o => o.r), holes: holes.map(h => h.r) };
}

// ============================================================
// STL builder
// ============================================================
class STL {
  constructor(name) { this.name = name; this.tris = []; }
  tri(a, b, c) {
    const u = [b[0]-a[0], b[1]-a[1], b[2]-a[2]], v = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
    let n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
    const L = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0]/L, n[1]/L, n[2]/L];
    this.tris.push([n, a, b, c]);
  }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
  box(x, y, z, w, d, h) {
    const x2 = x+w, y2 = y+d, z2 = z+h;
    this.quad([x,y2,z],[x2,y2,z],[x2,y,z],[x,y,z]);
    this.quad([x,y,z2],[x2,y,z2],[x2,y2,z2],[x,y2,z2]);
    this.quad([x,y,z],[x2,y,z],[x2,y,z2],[x,y,z2]);
    this.quad([x2,y2,z],[x,y2,z],[x,y2,z2],[x2,y2,z2]);
    this.quad([x,y2,z],[x,y,z],[x,y,z2],[x,y2,z2]);
    this.quad([x2,y,z],[x2,y2,z],[x2,y2,z2],[x2,y,z2]);
  }
  bbox() {
    const mn = [Infinity,Infinity,Infinity], mx = [-Infinity,-Infinity,-Infinity];
    for (const [, a, b, c] of this.tris) for (const v of [a,b,c]) for (let i=0;i<3;i++){ if(v[i]<mn[i])mn[i]=v[i]; if(v[i]>mx[i])mx[i]=v[i]; }
    return [mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]];
  }
  toString() {
    let s = `solid ${this.name}\n`;
    for (const [n, a, b, c] of this.tris) {
      s += `  facet normal ${n[0].toExponential(6)} ${n[1].toExponential(6)} ${n[2].toExponential(6)}\n    outer loop\n`;
      for (const v of [a, b, c]) s += `      vertex ${v[0].toExponential(6)} ${v[1].toExponential(6)} ${v[2].toExponential(6)}\n`;
      s += `    endloop\n  endfacet\n`;
    }
    return s + `endsolid ${this.name}\n`;
  }
}

// Extrude polygon-with-holes between z0..z1.
// X is MIRRORED on emission (like the original Top Shell): the front face (z=0)
// prints face-down, so in the slicer's top view the letters read BACKWARDS and
// come out correct when you look at the printed front from outside.
function addPrism(stl, outer, holes, z0, z1) {
  const FX = x => OUTER_W - x, FY = y => OUTER_H - y;
  const orient = (r, wantPos) => (signedArea(r.map(([x, y]) => [FX(x), FY(y)])) > 0) === wantPos ? r : r.slice().reverse();
  const flat = [], holeIdx = [], fRings = [];
  const push = r => { const fr = r.map(([x, y]) => [FX(x), FY(y)]); fRings.push(fr); for (const [x, y] of fr) flat.push(x, y); };
  push(orient(outer, true));
  for (const h of holes) { holeIdx.push(flat.length / 2); push(orient(h, false)); }
  const tris = earcut(flat, holeIdx, 2);
  const V = i => [flat[i*2], flat[i*2+1]];
  for (let i = 0; i < tris.length; i += 3) {
    const a = V(tris[i]), b = V(tris[i+1]), c = V(tris[i+2]);
    stl.tri([a[0],a[1],z1], [b[0],b[1],z1], [c[0],c[1],z1]);
    stl.tri([a[0],a[1],z0], [c[0],c[1],z0], [b[0],b[1],z0]);
  }
  for (const R of fRings) for (let i = 0; i < R.length; i++) {
    const p = R[i], q = R[(i + 1) % R.length];
    stl.tri([p[0],p[1],z0], [q[0],q[1],z0], [q[0],q[1],z1]);
    stl.tri([p[0],p[1],z0], [q[0],q[1],z1], [p[0],p[1],z1]);
  }
}
const rectRing = (x, y, w, h) => [[x, y], [x+w, y], [x+w, y+h], [x, y+h]];
const ringToSvg = r => 'M' + r.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join(' L') + ' Z';

// ============================================================
// TOP SHELL (body + letters)
// ============================================================
const body = new STL('topshell_sv_body');
const letters = new STL('topshell_sv_letters');
const letterSvg = [];
const allRings = [];

// Front slab: border strips + per-cell tiles with letter holes
for (const [x, y, w, h] of [
  [0, 0, OUTER_W, GY],
  [0, GY + GRID_H, OUTER_W, OUTER_H - GY - GRID_H],
  [0, GY, GX, GRID_H],
  [GX + GRID_W, GY, OUTER_W - GX - GRID_W, GRID_H],
]) addPrism(body, rectRing(x, y, w, h), [], 0, SLAB);

for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const ch = [...LAYOUT[row]][col];
    const cx = GX + col * PITCH + PITCH / 2;
    const cy = GY + row * PITCH + PITCH / 2;
    const rings = glyphContours(ch, cx, cy);
    const { groups, outers, holes } = classify(rings);
    for (const g of groups) addPrism(letters, g.outer, g.holes, 0, SLAB);         // transparent letter fill
    const cell = rectRing(GX + col * PITCH, GY + row * PITCH, PITCH, PITCH);
    addPrism(body, cell, outers, 0, SLAB);                                        // black tile with letter holes
    for (const h of holes) addPrism(body, h, [], 0, SLAB);                        // black counter islands (O, A, Ä...)
    for (const r of rings) { letterSvg.push(ringToSvg(r)); allRings.push(r); }
    // in-cell check
    const x0 = GX + col * PITCH, y0 = GY + row * PITCH;
    for (const r of outers) for (const [px, py] of r)
      if (px < x0 + 0.2 || px > x0 + PITCH - 0.2 || py < y0 + 0.2 || py > y0 + PITCH - 0.2) {
        console.error(`Glyph '${ch}' exceeds its cell at row ${row}, col ${col}`); process.exit(1);
      }
  }
}

// Shell walls (z SLAB..TOTAL_H): outer perimeter + cell grid + corner bosses.
// mbox = box emitted with the same X mirror as addPrism, so walls stay aligned
// with the mirrored slab. Design coords below are FRONT-view (like LAYOUT).
const WZ = SLAB, WH = TOTAL_H - SLAB;
const mbox = (x, y, z, w, d, h) => body.box(OUTER_W - x - w, y, z, w, d, h);
mbox(0, 0, WZ, OUTER_W, WALL, WH);                             // top edge
mbox(0, OUTER_H - WALL, WZ, 148, WALL, WH);                    // bottom edge, left of cable notch
mbox(158, OUTER_H - WALL, WZ, OUTER_W - 158, WALL, WH);        // bottom edge, right of notch
mbox(148, OUTER_H - WALL, WZ, 10, WALL, WH - CABLE_D);         // notch lintel (gap at plate side)
mbox(0, WALL, WZ, WALL, OUTER_H - 2*WALL, WH);                 // left edge
mbox(OUTER_W - WALL, WALL, WZ, WALL, OUTER_H - 2*WALL, WH);    // right edge
for (let c = 0; c <= COLS; c++) mbox(GX + c*PITCH - WALL/2, GY - WALL/2, WZ, WALL, GRID_H + WALL, WH);
for (let r = 0; r <= ROWS; r++) mbox(GX - WALL/2, GY + r*PITCH - WALL/2, WZ, GRID_W + WALL, WALL, WH);
// bosses with pilot channels, pilot centres at (6,6) etc — matches back plate holes
for (const [bx, by] of [[WALL, WALL], [OUTER_W-WALL-BOSS, WALL], [WALL, OUTER_H-WALL-BOSS], [OUTER_W-WALL-BOSS, OUTER_H-WALL-BOSS]]) {
  const chX = bx + BOSS/2 - PILOT/2, chY = by + BOSS/2 - PILOT/2;
  mbox(bx, by, WZ, chX - bx, BOSS, WH);
  mbox(chX + PILOT, by, WZ, (bx + BOSS) - (chX + PILOT), BOSS, WH);
  mbox(chX, by, WZ, PILOT, chY - by, WH);
  mbox(chX, chY + PILOT, WZ, PILOT, (by + BOSS) - (chY + PILOT), WH);
}

// Alignment pegs ("piggarna") on the grid's outer wall tops — they drop into
// matching slots in the back plate so it self-centres; the corner screws clamp.
// On the top/bottom grid walls only: the vertical walls are crossed by strip
// rows on the plate, so slots there would sit under the LED strips.
const PEG_L = 8, PEG_T = 3;
const PEGS = [
  [OUTER_W/2 - 40 - PEG_L/2, GY - WALL/2, PEG_L, WALL],            // top wall, left of centre
  [OUTER_W/2 + 40 - PEG_L/2, GY - WALL/2, PEG_L, WALL],            // top wall, right of centre
  [OUTER_W/2 - 35 - PEG_L/2, GY + GRID_H - WALL/2, PEG_L, WALL],   // bottom wall (offset — cable channel at centre)
];
for (const [px, py, w, d] of PEGS) mbox(px, py, TOTAL_H, w, d, PEG_T);

// ============================================================
// BACK PLATE — LED carrier + ESP32 bay + cable channel + peg slots + keyhole
// Print: strip side (z=0) DOWN on the bed, back features up. Assembled in print
// orientation: the plate drops straight onto the shell (also printed face-down),
// pegs into slots, 4× M3 into the bosses. All positions in FRONT-view design
// coords; addPrism/pbox apply the same X mirror as the shell.
// ============================================================
const back = new STL('backplate_sv');
const backMarkers = new STL('backplate_sv_markers');
{
  const s = SCREW_HOLE, si = SCREW_INSET;
  const keyEntry = 9, keySlotW = 4.5;
  const kx = OUTER_W / 2;

  // LED wire pass-through: LEFT side channel (outside the grid field), next to
  // LED 0 — with 10 rows the serpentine's data-in sits bottom-LEFT in front
  // view (row 9 is odd: index = x, so index 0 is at column 0).
  const passHole = rectRing(8, 149, 6, 6);

  // Peg slots — matched to the shell AS PRINTED. The shell's walls and pegs
  // are emitted through mbox (X mirror only), while plate holes go through
  // addPrism (X AND Y mirror). A peg at design-y `py` therefore sits at
  // STL-y `py`, and the slot must be pre-flipped in Y here to land on it.
  // Viktor's shell is already printed against this frame — do NOT "clean up"
  // the mbox/addPrism asymmetry without reprinting the shell.
  const pegSlots = PEGS.map(([px, py, w, d]) =>
    rectRing(px - 0.3, (OUTER_H - py - d) - 0.3, w + 0.6, d + 0.6));

  const holes = [
    rectRing(si - s/2, si - s/2, s, s),
    rectRing(OUTER_W - si - s/2, si - s/2, s, s),
    rectRing(si - s/2, OUTER_H - si - s/2, s, s),
    rectRing(OUTER_W - si - s/2, OUTER_H - si - s/2, s, s),
    rectRing(kx - keyEntry/2, 6.5, keyEntry, keyEntry),   // keyhole entry (screw head)
    rectRing(kx - keySlotW/2, 2, keySlotW, 4.5),          // keyhole slot, upward
    passHole,
    ...pegSlots,
  ];

  // Strip-placement markers: ten 10mm bands (the exact strip footprint per row)
  // in the FIRST 0.2mm of the strip face, as a separate mesh for a contrast
  // filament. Without AMS the bands become 0.2mm recessed grooves instead.
  const MARK_T = 0.2;
  const bands = [];
  for (let r = 0; r < ROWS; r++) {
    const yc = GY + (r + 0.5) * PITCH;
    bands.push(rectRing(GX, yc - 5, GRID_W, 10));
  }
  addPrism(back, rectRing(0, 0, OUTER_W, OUTER_H), [...holes, ...bands], 0, MARK_T);
  addPrism(back, rectRing(0, 0, OUTER_W, OUTER_H), holes, MARK_T, BACK_T);
  for (const b of bands) addPrism(backMarkers, b, [], 0, MARK_T);

  // --- Back-side features (z above BACK_T), mirrored like everything else ---
  const pbox = (x, y, z, w, d, h) => back.box(OUTER_W - x - w, y, z, w, d, h);
  const STANDOFF = 6;                    // wall standoff height (pads = tallest features)

  // ESP32 bay at the HUNG-BOTTOM of the back: pbox y is unflipped, so low
  // design-y = low STL-y = the hanging bottom (keyhole lands at high STL-y).
  // Board vertical, USB toward the bottom edge — the power cable drops
  // straight out under the clock. End-stop at the top end, open downward.
  const bayInnerW = 30, bayLen = 55, rail = 2.5, railH = 5;
  const bx0 = kx - bayInnerW/2, bayY = 12;                                 // bay y 12..67
  pbox(bx0 - rail, bayY, BACK_T, rail, bayLen, railH);
  pbox(bx0 + bayInnerW, bayY, BACK_T, rail, bayLen, railH);
  pbox(bx0 - rail, bayY + bayLen, BACK_T, bayInnerW + 2*rail, rail, railH); // end-stop (top end)

  // Short cable guide stubs from the bay opening to the bottom edge.
  const chGap = 8, chRail = 2.5;
  pbox(kx - chGap/2 - chRail, 2, BACK_T, chRail, bayY - 4, 4);
  pbox(kx + chGap/2, 2, BACK_T, chRail, bayY - 4, 4);

  // Corner standoff pads — the clock hangs flat on these + the keyhole area.
  for (const [px, py] of [[11, 11], [OUTER_W-21, 11], [11, OUTER_H-21], [OUTER_W-21, OUTER_H-21]])
    pbox(px, py, BACK_T, 10, 10, STANDOFF);
}

// ============================================================
// Firmware table
// ============================================================
let hdr = `// words_sv.h — generated by johniak-sv/generate.js. Do not edit by hand.\n`;
hdr += `// Swedish ${COLS}×${ROWS} layout (the simulator's exact grid, ${NUM_LEDS} LEDs).\n`;
hdr += `// REQUIRES in ClockDisplayHAL.h:  WIDTH = ${COLS}, HEIGHT = ${ROWS}\n`;
hdr += `// Drop-in replacement for the WORDS_TO_LEDS table in ClockDisplayHAL.cpp.\n\n`;
hdr += `ClockDisplayHAL::WordMapping const ClockDisplayHAL::WORDS_TO_LEDS[] = {\n`;
for (const [name, [lo, hi]] of Object.entries(LED_TABLE)) hdr += `    {"${name}", ${lo}, ${hi}},\n`;
hdr = hdr.replace(/,\n$/, '\n') + `};\n`;

// ============================================================
// Write everything
// ============================================================
const outDir = path.join(__dirname, 'out');
const fwDir = path.join(__dirname, 'firmware');
for (const d of [outDir, fwDir]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });

fs.writeFileSync(path.join(outDir, 'topshell_sv_body.stl'), body.toString(), 'utf-8');
fs.writeFileSync(path.join(outDir, 'topshell_sv_letters.stl'), letters.toString(), 'utf-8');
fs.writeFileSync(path.join(outDir, 'backplate_sv.stl'), back.toString(), 'utf-8');
fs.writeFileSync(path.join(outDir, 'backplate_sv_markers.stl'), backMarkers.toString(), 'utf-8');
fs.writeFileSync(path.join(fwDir, 'words_sv.h'), hdr, 'utf-8');

const svgDoc = inner => `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${OUTER_W}mm" height="${OUTER_H}mm" viewBox="0 0 ${OUTER_W} ${OUTER_H}">\n${inner}\n</svg>\n`;
// preview.svg = FRONT view (what you see on the assembled clock) — readable.
fs.writeFileSync(path.join(outDir, 'preview.svg'),
  svgDoc(`  <rect x="0" y="0" width="${OUTER_W}" height="${OUTER_H}" fill="#161310"/>\n  <path d="${letterSvg.join(' ')}" fill="#ffd78a" fill-rule="evenodd"/>`), 'utf-8');
// preview_slicer_view.svg = what Bambu Studio shows from above (front face down):
// letters MUST read backwards here — that's how the front comes out correct.
const mirrorPath = r => 'M' + r.map(([x, y]) => `${(OUTER_W - x).toFixed(3)} ${y.toFixed(3)}`).join(' L') + ' Z';
fs.writeFileSync(path.join(outDir, 'preview_slicer_view.svg'),
  svgDoc(`  <rect x="0" y="0" width="${OUTER_W}" height="${OUTER_H}" fill="#2a2a2a"/>\n  <path d="${allRings.map(mirrorPath).join(' ')}" fill="#9ad" fill-rule="evenodd"/>`), 'utf-8');

// backplate_layout.svg — the plate's BACK in HANGING orientation (keyhole up),
// as seen standing behind the clock. Through-holes (addPrism, X+Y mirrored)
// keep their design y; pbox features (X-only mirror) get y -> OUTER_H - y - h.
// X for both: OUTER_W - x - w (back view shows STL x directly).
{
  const hx = (x, w) => OUTER_W - x - w;
  const R  = (x, y, w, h, fill) => `  <rect x="${hx(x, w).toFixed(2)}" y="${y.toFixed(2)}" width="${w}" height="${h}" fill="${fill}"/>\n`;
  const Rp = (x, y, w, h, fill) => R(x, OUTER_H - y - h, w, h, fill);
  const T  = (x, y, t, s = 5) => `  <text x="${x.toFixed(2)}" y="${y}" font-family="sans-serif" font-size="${s}" fill="#ddd" text-anchor="middle">${t}</text>\n`;
  const kx = OUTER_W / 2;
  let sv = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${OUTER_W}mm" height="${OUTER_H}mm" viewBox="-2 -2 ${OUTER_W+4} ${OUTER_H+4}">\n`;
  sv += `  <rect x="0" y="0" width="${OUTER_W}" height="${OUTER_H}" fill="#2a2a2a" stroke="#666" stroke-width="0.5"/>\n`;
  // through-holes
  sv += R(kx - 4.5, 6.5, 9, 9, '#111') + R(kx - 2.25, 2, 4.5, 4.5, '#111') + T(kx, 26, 'NYCKELHÅL');
  for (const [x, y] of [[6, 6], [OUTER_W-6, 6], [6, OUTER_H-6], [OUTER_W-6, OUTER_H-6]])
    sv += R(x - 1.7, y - 1.7, 3.4, 3.4, '#111');
  for (const [px, py, w, d] of PEGS)
    sv += R(px - 0.3, (OUTER_H - py - d) - 0.3, w + 0.6, d + 0.6, '#c96');
  sv += T(58.6, 16, 'piggslits (ensam)', 4);
  sv += T(152, 152, '← piggslitsar (par)', 3.5);
  sv += R(8, 149, 6, 6, '#111') + T(146, 154.5, 'LED-kablar (LED 0) →', 3.5);
  // back-side features
  for (const [px, py] of [[11, 11], [OUTER_W-21, 11], [11, OUTER_H-21], [OUTER_W-21, OUTER_H-21]])
    sv += Rp(px, py, 10, 10, '#444');
  sv += Rp(kx - 17.5, 12, 35, 57.5, '#555') + Rp(kx - 15, 12, 30, 55, '#333');
  sv += T(kx, 136, 'ESP32') + T(kx, 144, '(USB nedåt)', 3.5);
  sv += Rp(kx - 6.5, 2, 2.5, 8, '#555') + Rp(kx + 4, 2, 2.5, 8, '#555') + T(kx + 26, 175, 'sladd ⭣', 4);
  sv += '</svg>\n';
  fs.writeFileSync(path.join(outDir, 'backplate_layout.svg'), sv, 'utf-8');
}

const bb = body.bbox(), lb = letters.bbox(), kb = back.bbox();
console.log(`Swedish Word Clock — johniak-sv (${COLS}×${ROWS} @ 74 LEDs/m)`);
console.log('====================================================\n');
console.log(`Layout validated: identical to simulator (index.html), ${Object.keys(WORDS).length} words, all 288 times covered, reading order OK, no LED overlaps`);
console.log(`Font: ${path.basename(FONT_PATH)}  cap ${CAP_MM.toFixed(1)}mm (auto-fit, cell opening ${cellOpen.toFixed(2)}mm)\n`);
console.log(`topshell body    : ${body.tris.length} tris  ${bb.map(x=>x.toFixed(1)).join(' × ')} mm`);
console.log(`topshell letters : ${letters.tris.length} tris  ${lb.map(x=>x.toFixed(1)).join(' × ')} mm  (TRANSPARENT filament)`);
console.log(`backplate        : ${back.tris.length} tris  ${kb.map(x=>x.toFixed(1)).join(' × ')} mm`);
console.log(`strip markers    : ${backMarkers.tris.length} tris  (första 0,2mm av strip-sidan — kontrastfilament)`);
console.log(`\nLED table (serpentine, matches original firmware convention):`);
for (const [name, [lo, hi]] of Object.entries(LED_TABLE)) console.log(`  ${name.padEnd(8)} ${lo}-${hi}`);
console.log(`\nOutput -> out/  +  firmware/words_sv.h`);
