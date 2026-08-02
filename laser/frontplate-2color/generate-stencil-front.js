#!/usr/bin/env node
// generate-stencil-front.js — Single-colour stencil front for the Swedish Word Clock.
//
// QlockTwo-style: the letters are open through-holes in an opaque plate. A stencil font
// (default: Allerta Stencil) keeps enclosed counters (O, A, Ä, R, D, Ö, P, Å, B...)
// attached via built-in bridges, so nothing falls out and no floating islands exist.
// One filament, no AMS, no prime tower. Light shines straight through onto the
// diffuser sitting behind the plate.
//
// Shares node_modules with generate-2color.js. Run:
//   node generate-stencil-front.js Mini
// Optional 2nd arg = font path (must be a STENCIL font — bridged counters).

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
  // 18mm pitch: 214×196mm panel, matches the mini backplate's outer size.
  Mini: { PITCH: 18, FRAME_BORDER: 8, THICKNESS: 3, CAP_HEIGHT: 11.5 },
};
const SIZE_KEY = process.argv[2] || 'Mini';
const S = SIZES[SIZE_KEY];
if (!S) { console.error(`Unknown size "${SIZE_KEY}". Options: ${Object.keys(SIZES).join(', ')}`); process.exit(1); }

const DEFAULT_FONT = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Windows', 'Fonts', 'AllertaStencil-Regular.ttf');
const FONT_PATH = process.argv[3] || DEFAULT_FONT;
const PANEL_W = COLS * S.PITCH + 2 * S.FRAME_BORDER;
const PANEL_H = ROWS * S.PITCH + 2 * S.FRAME_BORDER;
const BEZIER_STEPS = 10;
// Counters smaller than this are filled in (cut becomes solid) instead of erroring —
// covers un-bridged micro-counters like a tiny Å-ring hole in a non-stencil fallback font.
const MAX_DROPPED_COUNTER_AREA = 4; // mm²

let font;

// ============================================================
// Geometry helpers (same approach as generate-2color.js)
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

function glyphContours(letter, cellCx, cellCy, scale) {
  const p = font.charToGlyph(letter).getPath(0, 0, 1000);
  const contours = [];
  let cur = null, prev = null;
  for (const c of p.commands) {
    if (c.type === 'M') { cur = [[c.x, c.y]]; contours.push(cur); prev = [c.x, c.y]; }
    else if (c.type === 'L') { prev = [c.x, c.y]; cur.push(prev); }
    else if (c.type === 'Q') { for (let s = 1; s <= BEZIER_STEPS; s++) cur.push(qPoint(prev, [c.x1,c.y1], [c.x,c.y], s/BEZIER_STEPS)); prev = [c.x, c.y]; }
    else if (c.type === 'C') { for (let s = 1; s <= BEZIER_STEPS; s++) cur.push(cPoint(prev, [c.x1,c.y1], [c.x2,c.y2], [c.x,c.y], s/BEZIER_STEPS)); prev = [c.x, c.y]; }
  }
  const rings = contours.filter(r => r.length >= 3).map(r => r.map(([x, y]) => [x*scale, y*scale]));
  // Horizontal: centre on ink. Vertical: shared BASELINE, placed so the grid's full
  // letter band (max ascent incl. Å-ring + max descent) is centred in the cell.
  let minX = Infinity, maxX = -Infinity;
  for (const r of rings) for (const [x] of r) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
  const dx = cellCx - (minX + maxX) / 2;
  const dy = cellCy + BASELINE_DY;
  for (const r of rings) for (const p2 of r) { p2[0] += dx; p2[1] += dy; }
  return rings;
}

function interiorPoint(ring) {
  const flat = [];
  for (const [x, y] of ring) flat.push(x, y);
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
  rings.forEach((r, i) => (depth[i] % 2 === 0 ? outers : holes).push(r));
  return { outers, holes };
}

// ============================================================
// STL builder (same as the sibling generators)
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

function addPrism(stl, outer, holes) {
  const z0 = 0, z1 = S.THICKNESS, FY = y => PANEL_H - y;
  const orient = (r, wantPos) => (signedArea(r.map(([x, y]) => [x, FY(y)])) > 0) === wantPos ? r : r.slice().reverse();
  const flat = [], holeIdx = [], fRings = [];
  const push = r => { const fr = r.map(([x, y]) => [x, FY(y)]); fRings.push(fr); for (const [x, y] of fr) flat.push(x, y); };
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

// Min distance between two rings' sampled vertices — used to report bridge width.
function ringDistance(a, b) {
  let best = Infinity;
  for (const p of a) for (const q of b) {
    const d = Math.hypot(p[0]-q[0], p[1]-q[1]);
    if (d < best) best = d;
  }
  return best;
}

// ============================================================
// Main
// ============================================================
if (!fs.existsSync(FONT_PATH)) {
  console.error(`Font not found: ${FONT_PATH}`);
  console.error('Install Allerta Stencil (Google Fonts) or pass a stencil font path as 2nd arg.');
  process.exit(1);
}
font = opentype.loadSync(FONT_PATH);
const capBox = font.charToGlyph('H').getPath(0, 0, 1000).getBoundingBox();

// ---- Auto-fit: make sure EVERY glyph (incl. Å/Ä/Ö rings above the cap and any
// descender) fits inside its cell. A fixed cap height clipped the Å ring against
// the row above. Measure the tallest ascent/descent/width across the actual grid
// letters and cap the scale so the whole letter band + margins stays in the cell.
// Margins keep the letter band inside the GRID's cell opening (15.5mm), not just the
// front tile: 1.3mm vertical → band ≤15.4 clears the wall faces on both sides.
const V_MARGIN = 1.3, H_MARGIN = 1.5; // mm kept clear inside each 18mm cell
let ascU = 0, descU = 0, wideU = 0;   // font units (y-down: ascent = -minY)
for (const ch of new Set(GRID_LETTERS)) {
  const bb = font.charToGlyph(ch).getPath(0, 0, 1000).getBoundingBox();
  ascU = Math.max(ascU, -bb.y1);
  descU = Math.max(descU, bb.y2);
  wideU = Math.max(wideU, bb.x2 - bb.x1);
}
const capU = capBox.y2 - capBox.y1;
const scale = Math.min(
  S.CAP_HEIGHT / capU,                       // requested letter size...
  (S.PITCH - 2*V_MARGIN) / (ascU + descU),   // ...unless the tallest letter band busts the cell
  (S.PITCH - 2*H_MARGIN) / wideU             // ...or the widest letter does
);
const CAP_MM = capU * scale;
// Shared baseline placed so the full band (ascent+descent) is centred in the cell.
const BASELINE_DY = (ascU - descU) / 2 * scale; // baseline offset from cell centre (y-down)

const body = new STL('wordclock_front_stencil');
const holeSvg = [];
const problems = [];
let droppedCounters = 0;

// Frame border strips
for (const [x, y, w, h] of [
  [0, 0, PANEL_W, S.FRAME_BORDER],
  [0, PANEL_H - S.FRAME_BORDER, PANEL_W, S.FRAME_BORDER],
  [0, S.FRAME_BORDER, S.FRAME_BORDER, PANEL_H - 2*S.FRAME_BORDER],
  [PANEL_W - S.FRAME_BORDER, S.FRAME_BORDER, S.FRAME_BORDER, PANEL_H - 2*S.FRAME_BORDER],
]) addPrism(body, rectRing(x, y, w, h), []);

for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const ch = GRID_LETTERS[row*COLS + col];
    const cx = S.FRAME_BORDER + col*S.PITCH + S.PITCH/2;
    const cy = S.FRAME_BORDER + row*S.PITCH + S.PITCH/2;
    const rings = glyphContours(ch, cx, cy, scale);
    const { outers, holes } = classify(rings);

    // Enclosed counters would become floating islands in a through-cut plate.
    // A stencil font should have none; tiny leftovers get filled (dropped), big ones error.
    for (const h of holes) {
      const a = Math.abs(signedArea(h));
      if (a <= MAX_DROPPED_COUNTER_AREA) droppedCounters++;
      else problems.push(`'${ch}' at row ${row+1}, col ${col+1}: enclosed counter ${a.toFixed(1)}mm² — font is not stencil-bridged for this glyph`);
    }

    // Every cut must stay inside its own cell tile — a ring poking into the
    // neighbouring tile gets covered by that tile's solid material (this is what
    // clipped the Å ring before auto-fit).
    const x0 = S.FRAME_BORDER + col*S.PITCH, y0 = S.FRAME_BORDER + row*S.PITCH;
    for (const r of outers) for (const [px, py] of r) {
      if (px < x0 + 0.25 || px > x0 + S.PITCH - 0.25 || py < y0 + 0.25 || py > y0 + S.PITCH - 0.25) {
        problems.push(`'${ch}' at row ${row+1}, col ${col+1}: glyph exceeds its cell (x=${px.toFixed(1)}, y=${py.toFixed(1)})`);
        break;
      }
    }

    // Cell tile with the letter pieces as through-holes (counters dropped = filled).
    const cell = rectRing(S.FRAME_BORDER + col*S.PITCH, S.FRAME_BORDER + row*S.PITCH, S.PITCH, S.PITCH);
    addPrism(body, cell, outers);
    for (const r of outers) holeSvg.push(ringToSvg(r));
  }
}

if (problems.length) {
  console.error('FLOATING-ISLAND CHECK FAILED:\n  ' + problems.join('\n  '));
  process.exit(1);
}

// Diagnostics: bridge width on a reference O (its two arc pieces' closest approach).
const oRings = glyphContours('O', 0, 0, scale);
const oParts = classify(oRings).outers;
const bridge = oParts.length >= 2 ? ringDistance(oParts[0], oParts[1]) : NaN;

// ---- write files ----
const outDir = path.join(__dirname, '..', '3d-frontplate-mini-stencil');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const write = (name, data) => fs.writeFileSync(path.join(outDir, name), data, 'utf-8');

const panelPath = ringToSvg(rectRing(0, 0, PANEL_W, PANEL_H));
const svgDoc = (inner) => `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${PANEL_W}mm" height="${PANEL_H}mm" viewBox="0 0 ${PANEL_W} ${PANEL_H}">\n${inner}\n</svg>\n`;

write('frontplate_mini_stencil.stl', body.toString());
write('frontplate_mini_stencil_cut.svg', svgDoc(`  <path d="${panelPath} ${holeSvg.join(' ')}" fill="#111" fill-rule="evenodd"/>`));
write('preview.svg', svgDoc(`  <rect x="0" y="0" width="${PANEL_W}" height="${PANEL_H}" fill="#161310"/>\n  <path d="${holeSvg.join(' ')}" fill="#ffd78a" fill-rule="evenodd"/>`));

const bb = body.bbox();
console.log('Swedish Word Clock — stencil front (single colour, open letter holes)');
console.log('=====================================================================\n');
console.log(`Size ${SIZE_KEY}  ${COLS}×${ROWS}  pitch ${S.PITCH}mm  cap ${CAP_MM.toFixed(1)}mm (auto-fit, requested ${S.CAP_HEIGHT}) thickness ${S.THICKNESS}mm`);
console.log(`Font: ${path.basename(FONT_PATH)}\n`);
console.log(`panel   : ${body.tris.length} tris  ${bb.dim.map(x=>x.toFixed(1)).join(' × ')} mm  fits 256³: ${bb.dim.every(d => d <= 256) ? 'YES' : 'NO'}`);
console.log(`islands : none (all counters bridged${droppedCounters ? `; ${droppedCounters} micro-counters filled` : ''})`);
console.log(`bridge  : ~${bridge.toFixed(2)}mm material between the O arc cuts — Bambu's Arachne prints thin`);
console.log(`          walls down to ~0.4mm as a single bead; verify the bridges survive in slice preview`);
console.log(`\nOutput -> ${path.relative(process.cwd(), outDir)}`);
console.log('  frontplate_mini_stencil.stl      the whole front, ONE colour, no AMS');
console.log('  frontplate_mini_stencil_cut.svg  same geometry as SVG (laser/vinyl use)');
console.log('  preview.svg                      visual check');
