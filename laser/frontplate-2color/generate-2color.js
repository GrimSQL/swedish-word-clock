#!/usr/bin/env node
// generate-2color.js — Two-colour (AMS) lettered front for the Swedish Word Clock.
//
// Emits a black BODY (letters as through-holes) and matching translucent LETTERS that
// fill those holes exactly. Printed together on an AMS machine you get a black face where
// only the letters light up. Output:
//   - two interlocking STL meshes (load both, assign 2 filaments, combine, print)
//   - two SVGs (fallback: Bambu Studio "Import SVG" -> extrude 3mm -> assign colours)
//   - a combined preview SVG for eyeballing the layout
//
// opentype.js (glyph outlines) + earcut (triangulation) are kept OUT of the zero-dependency
// core generators on purpose. Run:  npm install && node generate-2color.js Mini
// Optional 2nd arg = font path (default Arial Bold, which has Å Ä Ö).

const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');
const earcut = require('earcut');

// ---- Grid (matches index.html / the other generators) ----
const COLS = 11, ROWS = 10;
const GRID_LETTERS = [
  'K','L','O','C','K','A','N','V','H','Ä','R',
  'S','F','E','M','I','S','T','I','O','N','A',
  'T','J','U','G','O','M','I','E','S','N','D',
  'K','V','A','R','T','B','Ö','V','E','R','G',
  'L','I','A','H','H','A','L','V','Ö','T','P',
  'E','T','T','R','T','V','Å','L','S','N','D',
  'T','R','E','N','F','Y','R','A','O','S','T',
  'F','E','M','B','S','E','X','O','S','J','U',
  'Å','T','T','A','M','N','I','O','D','E','K',
  'E','L','V','A','T','O','L','V','T','I','O',
];

// ---- Size config ----
const SIZES = {
  // 18mm pitch: front 214×196mm — leaves room on a 256 bed for the AMS prime tower.
  // LETTER_THICKNESS < THICKNESS: the letters are a thin translucent cap flush with the
  // front face; the rest of each hole is open to the back so the LED lights through only
  // ~1.2mm (bright), and colour changes happen only in the bottom ~6 layers (tiny tower).
  Mini: { PITCH: 18, FRAME_BORDER: 8, THICKNESS: 3, LETTER_THICKNESS: 1.2, CAP_HEIGHT: 11.5 },
};
const SIZE_KEY = process.argv[2] || 'Mini';
const S = SIZES[SIZE_KEY];
if (!S) { console.error(`Unknown size "${SIZE_KEY}". Options: ${Object.keys(SIZES).join(', ')}`); process.exit(1); }

const FONT_PATH = process.argv[3] || path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'arialbd.ttf');
const PANEL_W = COLS * S.PITCH + 2 * S.FRAME_BORDER;
const PANEL_H = ROWS * S.PITCH + 2 * S.FRAME_BORDER;
const BEZIER_STEPS = 10;

let font; // set in main

// ============================================================
// Geometry helpers
// ============================================================
function qPoint(p, c, e, t) { const u = 1 - t; return [u*u*p[0] + 2*u*t*c[0] + t*t*e[0], u*u*p[1] + 2*u*t*c[1] + t*t*e[1]]; }
function cPoint(p, a, b, e, t) {
  const u = 1 - t;
  return [u*u*u*p[0] + 3*u*u*t*a[0] + 3*u*t*t*b[0] + t*t*t*e[0],
          u*u*u*p[1] + 3*u*u*t*a[1] + 3*u*t*t*b[1] + t*t*t*e[1]];
}
function signedArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) { const p = ring[i], q = ring[(i + 1) % n]; a += p[0]*q[1] - q[0]*p[1]; }
  return a / 2;
}
function pointInRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (((a[1] > pt[1]) !== (b[1] > pt[1])) && (pt[0] < (b[0]-a[0]) * (pt[1]-a[1]) / (b[1]-a[1]) + a[0])) inside = !inside;
  }
  return inside;
}

// One glyph -> contours (rings of [x,y]) in mm, centred in its cell.
function glyphContours(letter, cellCx, cellCy, scale) {
  const p = font.charToGlyph(letter).getPath(0, 0, 1000); // 1000-unit em
  const contours = [];
  let cur = null, prev = null;
  for (const c of p.commands) {
    if (c.type === 'M') { cur = [[c.x, c.y]]; contours.push(cur); prev = [c.x, c.y]; }
    else if (c.type === 'L') { prev = [c.x, c.y]; cur.push(prev); }
    else if (c.type === 'Q') { for (let s = 1; s <= BEZIER_STEPS; s++) cur.push(qPoint(prev, [c.x1,c.y1], [c.x,c.y], s/BEZIER_STEPS)); prev = [c.x, c.y]; }
    else if (c.type === 'C') { for (let s = 1; s <= BEZIER_STEPS; s++) cur.push(cPoint(prev, [c.x1,c.y1], [c.x2,c.y2], [c.x,c.y], s/BEZIER_STEPS)); prev = [c.x, c.y]; }
    // 'Z' closes implicitly
  }
  const rings = contours.filter(r => r.length >= 3).map(r => r.map(([x, y]) => [x*scale, y*scale]));
  // Horizontal: centre on the ink (min/max X). Vertical: align on the BASELINE, not the
  // bbox — otherwise a glyph with a mark above (Å ring, Ä/Ö dots) gets shoved down and the
  // letter no longer shares a baseline with its neighbours. getPath puts the baseline at
  // y=0 (y-down), so the cap box spans [-CAP_HEIGHT, 0]; centre that box in the cell.
  let minX = Infinity, maxX = -Infinity;
  for (const r of rings) for (const [x] of r) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
  const dx = cellCx - (minX + maxX) / 2;
  const dy = cellCy - (-S.CAP_HEIGHT / 2); // put baseline-to-cap box centre at the cell centre
  for (const r of rings) for (const p2 of r) { p2[0] += dx; p2[1] += dy; }
  return rings;
}

// A point guaranteed strictly INSIDE a contour (centroid of its first triangulated ear).
// Using a raw vertex for the nesting test is unsafe: the apex of the A sits inside the ring
// of Å, so the A vertex tests "inside the ring" and the whole letter flips to a hole.
function interiorPoint(ring) {
  const flat = [];
  for (const [x, y] of ring) flat.push(x, y);
  const t = earcut(flat, [], 2);
  if (t.length < 3) return [(ring[0][0]+ring[1][0]+ring[2][0])/3, (ring[0][1]+ring[1][1]+ring[2][1])/3];
  return [(flat[t[0]*2]+flat[t[1]*2]+flat[t[2]*2])/3, (flat[t[0]*2+1]+flat[t[1]*2+1]+flat[t[2]*2+1])/3];
}

// Split a glyph's rings into filled outers (even nesting depth) and holes (odd), grouping
// each hole under its smallest enclosing outer. Even-odd = correct counters for O, A, Ä...
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
// STL builder + extrusion
// ============================================================
class STL {
  constructor(name) { this.name = name; this.tris = []; }
  tri(a, b, c) {
    const u = [b[0]-a[0], b[1]-a[1], b[2]-a[2]], v = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
    let n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
    const L = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0]/L, n[1]/L, n[2]/L];
    this.tris.push([n, a, b, c]);
  }
  bbox() {
    const mn = [Infinity,Infinity,Infinity], mx = [-Infinity,-Infinity,-Infinity];
    for (const [, a, b, c] of this.tris) for (const v of [a,b,c]) for (let i=0;i<3;i++){ if(v[i]<mn[i])mn[i]=v[i]; if(v[i]>mx[i])mx[i]=v[i]; }
    return { mn, mx, dim: [mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]] };
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

// Extrude polygon (outer + holes) from z=0..THICKNESS. Y is flipped so the part reads
// correctly in a y-up 3D viewer. Outer forced CCW, holes CW -> consistent outward normals.
function addPrism(stl, outer, holes, z1 = S.THICKNESS) {
  const z0 = 0, FY = y => PANEL_H - y;
  const orient = (r, wantPos) => (signedArea(r.map(([x, y]) => [x, FY(y)])) > 0) === wantPos ? r : r.slice().reverse();
  const flat = [], holeIdx = [], fRings = [];
  const push = r => { const fr = r.map(([x, y]) => [x, FY(y)]); fRings.push(fr); for (const [x, y] of fr) flat.push(x, y); };
  push(orient(outer, true));
  for (const h of holes) { holeIdx.push(flat.length / 2); push(orient(h, false)); }
  const tris = earcut(flat, holeIdx, 2);
  const V = i => [flat[i*2], flat[i*2+1]];
  for (let i = 0; i < tris.length; i += 3) {
    const a = V(tris[i]), b = V(tris[i+1]), c = V(tris[i+2]);
    stl.tri([a[0],a[1],z1], [b[0],b[1],z1], [c[0],c[1],z1]);   // top  -> +Z
    stl.tri([a[0],a[1],z0], [c[0],c[1],z0], [b[0],b[1],z0]);   // bottom -> -Z
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
// Main
// ============================================================
font = opentype.loadSync(FONT_PATH);
const capBox = font.charToGlyph('H').getPath(0, 0, 1000).getBoundingBox();
const scale = S.CAP_HEIGHT / (capBox.y2 - capBox.y1);

const body = new STL('wordclock_front_body');
const letters = new STL('wordclock_front_letters');
const letterSvg = [];

// Frame border = 4 solid strips around the grid
for (const [x, y, w, h] of [
  [0, 0, PANEL_W, S.FRAME_BORDER],
  [0, PANEL_H - S.FRAME_BORDER, PANEL_W, S.FRAME_BORDER],
  [0, S.FRAME_BORDER, S.FRAME_BORDER, PANEL_H - 2*S.FRAME_BORDER],
  [PANEL_W - S.FRAME_BORDER, S.FRAME_BORDER, S.FRAME_BORDER, PANEL_H - 2*S.FRAME_BORDER],
]) addPrism(body, rectRing(x, y, w, h), []);

for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const cx = S.FRAME_BORDER + col*S.PITCH + S.PITCH/2;
    const cy = S.FRAME_BORDER + row*S.PITCH + S.PITCH/2;
    const rings = glyphContours(GRID_LETTERS[row*COLS + col], cx, cy, scale);
    const { groups, outers, holes } = classify(rings);

    for (const g of groups) addPrism(letters, g.outer, g.holes, S.LETTER_THICKNESS); // thin translucent letters

    const cell = rectRing(S.FRAME_BORDER + col*S.PITCH, S.FRAME_BORDER + row*S.PITCH, S.PITCH, S.PITCH);
    addPrism(body, cell, outers);                                     // black cell tile with letter holes
    for (const h of holes) addPrism(body, h, []);                     // black counter islands (O, A, ...)

    for (const r of rings) letterSvg.push(ringToSvg(r));
  }
}

// ---- write files ----
const outDir = path.join(__dirname, '..', '3d-frontplate-mini-2color');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const panelPath = ringToSvg(rectRing(0, 0, PANEL_W, PANEL_H));
const svgDoc = (inner) => `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${PANEL_W}mm" height="${PANEL_H}mm" viewBox="0 0 ${PANEL_W} ${PANEL_H}">\n${inner}\n</svg>\n`;
const write = (name, data) => fs.writeFileSync(path.join(outDir, name), data, 'utf-8');

write('frontplate_mini_2color_body.stl', body.toString());
write('frontplate_mini_2color_letters.stl', letters.toString());
write('frontplate_mini_2color_body.svg', svgDoc(`  <path d="${panelPath} ${letterSvg.join(' ')}" fill="#111" fill-rule="evenodd"/>`));
write('frontplate_mini_2color_letters.svg', svgDoc(`  <path d="${letterSvg.join(' ')}" fill="#111" fill-rule="evenodd"/>`));
write('preview.svg', svgDoc(`  <path d="${panelPath} ${letterSvg.join(' ')}" fill="#161310" fill-rule="evenodd"/>\n  <path d="${letterSvg.join(' ')}" fill="#ffd78a" fill-rule="evenodd"/>`));

const bb = body.bbox(), lb = letters.bbox();
console.log('Swedish Word Clock — 2-colour (AMS) lettered front');
console.log('==================================================\n');
console.log(`Size ${SIZE_KEY}  ${COLS}×${ROWS}  pitch ${S.PITCH}mm  cap ${S.CAP_HEIGHT}mm  body ${S.THICKNESS}mm  letters ${S.LETTER_THICKNESS}mm`);
console.log(`Font: ${path.basename(FONT_PATH)}\n`);
console.log(`Letters are only ${S.LETTER_THICKNESS}mm (flush with the front); the hole is open behind them`);
console.log(`so the LED lights through ~${S.LETTER_THICKNESS}mm. PRINT LETTER/FLAT FACE DOWN (z=0). Use natural/`);
console.log(`translucent filament for the letters, NOT opaque white.\n`);
console.log(`body    : ${body.tris.length} tris  ${bb.dim.map(x=>x.toFixed(1)).join(' × ')} mm`);
console.log(`letters : ${letters.tris.length} tris  ${lb.dim.map(x=>x.toFixed(1)).join(' × ')} mm`);
console.log(`fits 256³: ${bb.dim.every(d => d <= 256) ? 'YES' : 'NO'}`);
console.log(`\nOutput -> ${path.relative(process.cwd(), outDir)}`);
console.log('  *_body.stl + *_letters.stl   load both, assign 2 filaments, combine, print');
console.log('  *_body.svg + *_letters.svg   fallback: Bambu Studio Import SVG -> extrude 3mm');
console.log('  preview.svg                  visual check of the layout');
