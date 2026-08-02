#!/usr/bin/env node
// generate-backplate-mini.js — TWO-PART back for the Mini word clock.
// No dependencies required. Run: node generate-backplate-mini.js
//
// Part 1  backplate_mini_grid.stl   — the cell walls ONLY (no base). Drops over the
//                                     LEDs after they are mounted, so the whole LED
//                                     snake is soldered flat and in the open.
// Part 2  backplate_mini_cover.stl  — flat back cover that carries the LED strip on
//                                     its front face, and on its back: a keyhole boss
//                                     for a wall hook, an ESP32 bay, and a cable
//                                     channel running out the bottom edge.
//
// Both parts share the same coordinate frame (214×196 outer), matching the front
// panels. The grid screws onto the cover with 4× M3 self-tapping screws through the
// cover's corner holes into pilot channels in the grid's corner posts.
//
// Everything is axis-aligned boxes / rectangular holes — no curved geometry — so the
// STL is built from simple box faces plus a rectangular-hole plate decomposer.

const fs = require('fs');
const path = require('path');

// ============================================================
// PARAMETERS (must match the Mini front: 18mm pitch, 214×196)
// ============================================================
const COLS = 11, ROWS = 10;
const PITCH = 18;
const WALL = 2.5;            // wall thickness
const WALL_H = 12;           // cell depth (LED to diffuser)
const NOTCH_W = 5;           // wire notch width in interior wall bottoms
const NOTCH_H = 4;           // wire notch height (wires lie on the cover)
const COVER_T = 2.5;         // cover plate thickness

const GRID_W = COLS * PITCH + WALL;   // 200.5
const GRID_H = ROWS * PITCH + WALL;   // 182.5
const OUTER_W = 214, OUTER_H = 196;   // matches front panel
const OFF_X = (OUTER_W - GRID_W) / 2; // 6.75 — grid position inside outer frame
const OFF_Y = (OUTER_H - GRID_H) / 2; // 6.75

// Corner posts (on the grid) + matching screw holes (in the cover)
const POST = 10;             // post footprint
const PILOT = 2.7;           // square pilot channel for M3 self-tap
const SCREW_HOLE = 3.4;      // M3 clearance square in cover
const SCREW_INSET = 5;       // screw centre from cover corner

// Back-side features on the cover (z on top of COVER_T)
const STANDOFF_H = 6;        // boss/pad height = distance clock hangs off the wall
const BOSS_W = 20, BOSS_H = 18;             // keyhole boss footprint, top-centre
const KEY_ENTRY = 9, KEY_SLOT_W = 4.5;      // keyhole entry square + slot width
const PAD = 10;                              // corner standoff pads
const ESP_INNER_W = 30, ESP_LEN = 55;        // ESP32 DevKit bay (board ~28.5×52)
const ESP_RAIL = 2.5, ESP_RAIL_H = 5;
const CABLE_GAP = 8, CABLE_RAIL = 2.5, CABLE_RAIL_H = 4;

// Wire pass-through (cover) + feed notch (grid bottom outer wall), bottom-centre.
// LED feed wires go: ESP32 bay (back) -> through this hole -> front face border strip
// -> under the grid's bottom outer wall via the feed notch -> first LED.
const PASS_X0 = 103, PASS_X1 = 111;          // matches feed notch position (col 5)
const PASS_Y0 = OUTER_H - 6, PASS_Y1 = OUTER_H - 2; // in the open border band
const FEED_COL = 5, FEED_W = 8;

// ============================================================
// STL BUILDER (box soup, same conventions as generate-backplate.js)
// ============================================================
class STLBuilder {
  constructor() { this.triangles = []; }
  addTriangle(v1, v2, v3) {
    const u = [v2[0]-v1[0], v2[1]-v1[1], v2[2]-v1[2]];
    const v = [v3[0]-v1[0], v3[1]-v1[1], v3[2]-v1[2]];
    const n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
    const len = Math.hypot(n[0], n[1], n[2]);
    if (len > 0) { n[0]/=len; n[1]/=len; n[2]/=len; }
    this.triangles.push({ n, v1, v2, v3 });
  }
  addQuad(a, b, c, d) { this.addTriangle(a, b, c); this.addTriangle(a, c, d); }
  addBox(x, y, z, w, d, h) {
    const x2 = x+w, y2 = y+d, z2 = z+h;
    this.addQuad([x,y2,z],[x2,y2,z],[x2,y,z],[x,y,z]);
    this.addQuad([x,y,z2],[x2,y,z2],[x2,y2,z2],[x,y2,z2]);
    this.addQuad([x,y,z],[x2,y,z],[x2,y,z2],[x,y,z2]);
    this.addQuad([x2,y2,z],[x,y2,z],[x,y2,z2],[x2,y2,z2]);
    this.addQuad([x,y2,z],[x,y,z],[x,y,z2],[x,y2,z2]);
    this.addQuad([x2,y,z],[x2,y2,z],[x2,y2,z2],[x2,y,z2]);
  }
  bbox() {
    const mn = [Infinity,Infinity,Infinity], mx = [-Infinity,-Infinity,-Infinity];
    for (const t of this.triangles) for (const v of [t.v1,t.v2,t.v3])
      for (let i=0;i<3;i++){ if(v[i]<mn[i])mn[i]=v[i]; if(v[i]>mx[i])mx[i]=v[i]; }
    return [mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]];
  }
  toSTL(name) {
    let s = `solid ${name}\n`;
    for (const t of this.triangles) {
      s += `  facet normal ${t.n[0].toExponential(6)} ${t.n[1].toExponential(6)} ${t.n[2].toExponential(6)}\n    outer loop\n`;
      for (const v of [t.v1, t.v2, t.v3])
        s += `      vertex ${v[0].toExponential(6)} ${v[1].toExponential(6)} ${v[2].toExponential(6)}\n`;
      s += `    endloop\n  endfacet\n`;
    }
    return s + `endsolid ${name}\n`;
  }
}

// Plate with rectangular through-holes: band decomposition for top/bottom faces,
// explicit side faces for the outer edge and each hole. Holes must be interior
// and non-overlapping.
function addPlateWithHoles(stl, x, y, w, h, z, thk, holes) {
  const z2 = z + thk;
  const edges = new Set([y, y + h]);
  for (const hl of holes) { edges.add(hl.y); edges.add(hl.y + hl.h); }
  const ys = [...edges].sort((a, b) => a - b);
  for (let i = 0; i < ys.length - 1; i++) {
    const a = ys[i], b = ys[i+1];
    if (b - a < 1e-9) continue;
    const mid = (a + b) / 2;
    // x-intervals of this band not covered by holes
    const cuts = holes.filter(hl => hl.y < mid && mid < hl.y + hl.h)
                      .map(hl => [hl.x, hl.x + hl.w]).sort((p, q) => p[0] - q[0]);
    let cx = x;
    const spans = [];
    for (const [hx0, hx1] of cuts) { if (hx0 > cx) spans.push([cx, hx0]); cx = Math.max(cx, hx1); }
    if (cx < x + w) spans.push([cx, x + w]);
    for (const [sx0, sx1] of spans) {
      stl.addQuad([sx0,a,z2],[sx1,a,z2],[sx1,b,z2],[sx0,b,z2]);   // top (+Z)
      stl.addQuad([sx0,b,z],[sx1,b,z],[sx1,a,z],[sx0,a,z]);       // bottom (−Z)
    }
  }
  // outer side walls
  stl.addQuad([x,y,z],[x+w,y,z],[x+w,y,z2],[x,y,z2]);
  stl.addQuad([x+w,y+h,z],[x,y+h,z],[x,y+h,z2],[x+w,y+h,z2]);
  stl.addQuad([x,y+h,z],[x,y,z],[x,y,z2],[x,y+h,z2]);
  stl.addQuad([x+w,y,z],[x+w,y+h,z],[x+w,y+h,z2],[x+w,y,z2]);
  // hole side walls (normals point into the hole)
  for (const hl of holes) {
    const hx2 = hl.x + hl.w, hy2 = hl.y + hl.h;
    stl.addQuad([hx2,hl.y,z],[hl.x,hl.y,z],[hl.x,hl.y,z2],[hx2,hl.y,z2]);
    stl.addQuad([hl.x,hy2,z],[hx2,hy2,z],[hx2,hy2,z2],[hl.x,hy2,z2]);
    stl.addQuad([hl.x,hl.y,z],[hl.x,hy2,z],[hl.x,hy2,z2],[hl.x,hl.y,z2]);
    stl.addQuad([hx2,hy2,z],[hx2,hl.y,z],[hx2,hl.y,z2],[hx2,hy2,z2]);
  }
}

// ============================================================
// PART 1 — CELL GRID (walls only, no base)
// ============================================================
function buildGrid() {
  const stl = new STLBuilder();
  const cellInner = PITCH - WALL;
  const gx = OFF_X, gy = OFF_Y; // grid origin in the shared frame

  // Vertical walls (between columns)
  for (let c = 0; c <= COLS; c++) {
    const wx = gx + c * PITCH;
    for (let r = 0; r < ROWS; r++) {
      const wy = gy + r * PITCH + WALL;
      if (c > 0 && c < COLS) {
        // interior: wire notch at the bottom (against the cover)
        stl.addBox(wx, wy, NOTCH_H, WALL, cellInner, WALL_H - NOTCH_H);
        const ns = wy + (cellInner - NOTCH_W) / 2;
        stl.addBox(wx, wy, 0, WALL, (cellInner - NOTCH_W) / 2, NOTCH_H);
        stl.addBox(wx, ns + NOTCH_W, 0, WALL, (cellInner - NOTCH_W) / 2, NOTCH_H);
      } else {
        stl.addBox(wx, wy, 0, WALL, cellInner, WALL_H);
      }
    }
    for (let r = 0; r <= ROWS; r++) {
      stl.addBox(wx, gy + r * PITCH, 0, WALL, WALL, WALL_H);
    }
  }

  // Horizontal walls (between rows)
  for (let r = 0; r <= ROWS; r++) {
    const wy = gy + r * PITCH;
    for (let c = 0; c < COLS; c++) {
      const wx = gx + c * PITCH + WALL;
      const isFeedSegment = (r === ROWS && c === FEED_COL);
      if (r > 0 && r < ROWS) {
        stl.addBox(wx, wy, NOTCH_H, cellInner, WALL, WALL_H - NOTCH_H);
        const ns = wx + (cellInner - NOTCH_W) / 2;
        stl.addBox(wx, wy, 0, (cellInner - NOTCH_W) / 2, WALL, NOTCH_H);
        stl.addBox(ns + NOTCH_W, wy, 0, (cellInner - NOTCH_W) / 2, WALL, NOTCH_H);
      } else if (isFeedSegment) {
        // bottom outer wall, feed cell: notch for the LED feed wires from the cover hole
        stl.addBox(wx, wy, NOTCH_H, cellInner, WALL, WALL_H - NOTCH_H);
        const ns = wx + (cellInner - FEED_W) / 2;
        stl.addBox(wx, wy, 0, (cellInner - FEED_W) / 2, WALL, NOTCH_H);
        stl.addBox(ns + FEED_W, wy, 0, (cellInner - FEED_W) / 2, WALL, NOTCH_H);
      } else {
        stl.addBox(wx, wy, 0, cellInner, WALL, WALL_H);
      }
    }
  }

  // Corner posts with square pilot channels (screwed from the cover side)
  const postSpots = [
    [0, 0], [OUTER_W - POST, 0], [0, OUTER_H - POST], [OUTER_W - POST, OUTER_H - POST],
  ];
  for (const [px, py] of postSpots) {
    const chX = px + POST/2 - PILOT/2, chY = py + POST/2 - PILOT/2;
    // 4 boxes around the vertical pilot channel
    stl.addBox(px, py, 0, chX - px, POST, WALL_H);
    stl.addBox(chX + PILOT, py, 0, (px + POST) - (chX + PILOT), POST, WALL_H);
    stl.addBox(chX, py, 0, PILOT, chY - py, WALL_H);
    stl.addBox(chX, chY + PILOT, 0, PILOT, (py + POST) - (chY + PILOT), WALL_H);
  }

  return stl;
}

// ============================================================
// PART 2 — BACK COVER (plate + wall-hang boss + ESP32 bay + cable channel)
// ============================================================
function buildCover() {
  const stl = new STLBuilder();
  const T = COVER_T;

  // Plate with through-holes: 4 corner screw holes + LED wire pass-through
  const s = SCREW_HOLE, si = SCREW_INSET;
  const holes = [
    { x: si - s/2, y: si - s/2, w: s, h: s },
    { x: OUTER_W - si - s/2, y: si - s/2, w: s, h: s },
    { x: si - s/2, y: OUTER_H - si - s/2, w: s, h: s },
    { x: OUTER_W - si - s/2, y: OUTER_H - si - s/2, w: s, h: s },
    { x: PASS_X0, y: PASS_Y0, w: PASS_X1 - PASS_X0, h: PASS_Y1 - PASS_Y0 },
  ];
  addPlateWithHoles(stl, 0, 0, OUTER_W, OUTER_H, 0, T, holes);

  // --- Keyhole boss, top-centre (hangs the clock on a screw/hook head) ---
  // Stack: solid base 1.4 / head cavity 3.2 (framed) / roof 1.4 with keyhole cut.
  const bx = OUTER_W/2 - BOSS_W/2, by = 5;
  const L1 = 1.4, L2 = 3.2, L3 = STANDOFF_H - L1 - L2;
  stl.addBox(bx, by, T, BOSS_W, BOSS_H, L1);
  // cavity frame (void 10 wide × 14 tall for the screw head to slide in)
  const vx = OUTER_W/2 - 5, vy = by + 2, vw = 10, vh = 14;
  stl.addBox(bx, by, T + L1, vx - bx, BOSS_H, L2);
  stl.addBox(vx + vw, by, T + L1, (bx + BOSS_W) - (vx + vw), BOSS_H, L2);
  stl.addBox(vx, by, T + L1, vw, vy - by, L2);
  stl.addBox(vx, vy + vh, T + L1, vw, (by + BOSS_H) - (vy + vh), L2);
  // roof with keyhole: entry square (screw head passes) + slot upward (toward top edge)
  const ex = OUTER_W/2 - KEY_ENTRY/2, ey = vy + vh - KEY_ENTRY;      // entry at cavity bottom
  const sx = OUTER_W/2 - KEY_SLOT_W/2;
  addPlateWithHoles(stl, bx, by, BOSS_W, BOSS_H, T + L1 + L2, L3, [
    { x: ex, y: ey, w: KEY_ENTRY, h: KEY_ENTRY },
    { x: sx, y: vy, w: KEY_SLOT_W, h: ey - vy },
  ]);

  // --- Corner standoff pads (same height as the boss → hangs flat) ---
  for (const [px, py] of [[8, 8], [OUTER_W-8-PAD, 8], [8, OUTER_H-8-PAD], [OUTER_W-8-PAD, OUTER_H-8-PAD]])
    stl.addBox(px, py, T, PAD, PAD, STANDOFF_H);

  // --- ESP32 bay, bottom-centre (board vertical, USB downward) ---
  const railIn = OUTER_W/2 - ESP_INNER_W/2;
  const bayY = 115, bayEnd = bayY + ESP_LEN;
  stl.addBox(railIn - ESP_RAIL, bayY, T, ESP_RAIL, ESP_LEN, ESP_RAIL_H);
  stl.addBox(railIn + ESP_INNER_W, bayY, T, ESP_RAIL, ESP_LEN, ESP_RAIL_H);
  stl.addBox(railIn - ESP_RAIL, bayY - ESP_RAIL, T, ESP_INNER_W + 2*ESP_RAIL, ESP_RAIL, ESP_RAIL_H); // top end-stop
  // (bottom is open — the USB/power cable exits downward)

  // --- Cable channel: two rails guiding the cable from the bay to the bottom edge ---
  const cr = OUTER_W/2 - CABLE_GAP/2 - CABLE_RAIL;
  stl.addBox(cr, bayEnd + 2, T, CABLE_RAIL, OUTER_H - 8 - (bayEnd + 2), CABLE_RAIL_H);
  stl.addBox(OUTER_W/2 + CABLE_GAP/2, bayEnd + 2, T, CABLE_RAIL, OUTER_H - 8 - (bayEnd + 2), CABLE_RAIL_H);

  return stl;
}

// ============================================================
// Layout SVG (back view of the cover, for a quick visual check)
// ============================================================
function coverLayoutSVG() {
  const r = (x, y, w, h, fill, extra = '') =>
    `  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>\n`;
  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${OUTER_W}mm" height="${OUTER_H}mm" viewBox="-2 -2 ${OUTER_W+4} ${OUTER_H+4}">\n`;
  svg += r(0, 0, OUTER_W, OUTER_H, '#2a2a2a', 'stroke="#666" stroke-width="0.5"');
  const label = (x, y, t, size = 5) => `  <text x="${x}" y="${y}" font-family="sans-serif" font-size="${size}" fill="#ddd" text-anchor="middle">${t}</text>\n`;
  // boss + keyhole
  svg += r(OUTER_W/2 - BOSS_W/2, 5, BOSS_W, BOSS_H, '#555');
  svg += r(OUTER_W/2 - KEY_ENTRY/2, 21 - KEY_ENTRY + 2, KEY_ENTRY, KEY_ENTRY, '#111');
  svg += r(OUTER_W/2 - KEY_SLOT_W/2, 7, KEY_SLOT_W, 7, '#111');
  svg += label(OUTER_W/2, 30, 'NYCKELHÅL (krok/skruv)');
  // pads
  for (const [px, py] of [[8, 8], [OUTER_W-18, 8], [8, OUTER_H-18], [OUTER_W-18, OUTER_H-18]])
    svg += r(px, py, PAD, PAD, '#444');
  // screws
  for (const [cx, cy] of [[5,5],[OUTER_W-5,5],[5,OUTER_H-5],[OUTER_W-5,OUTER_H-5]])
    svg += r(cx-1.7, cy-1.7, 3.4, 3.4, '#111');
  // bay
  const railIn = OUTER_W/2 - ESP_INNER_W/2;
  svg += r(railIn - ESP_RAIL, 115 - ESP_RAIL, ESP_INNER_W + 2*ESP_RAIL, ESP_LEN + ESP_RAIL, '#555');
  svg += r(railIn, 115, ESP_INNER_W, ESP_LEN, '#333');
  svg += label(OUTER_W/2, 145, 'ESP32');
  svg += label(OUTER_W/2, 152, '(USB nedåt)', 3.5);
  // cable channel + pass-through
  svg += r(OUTER_W/2 - CABLE_GAP/2 - CABLE_RAIL, 172, CABLE_RAIL, OUTER_H - 8 - 172, '#555');
  svg += r(OUTER_W/2 + CABLE_GAP/2, 172, CABLE_RAIL, OUTER_H - 8 - 172, '#555');
  svg += label(OUTER_W/2 - 28, 185, 'sladd ⭣', 4);
  svg += r(PASS_X0, PASS_Y0, PASS_X1 - PASS_X0, PASS_Y1 - PASS_Y0, '#111');
  svg += label(PASS_X0 + 22, PASS_Y1 - 1, 'LED-kablar →', 3.5);
  svg += '</svg>\n';
  return svg;
}

// ============================================================
// MAIN
// ============================================================
const outDir = path.join(__dirname, '3d-backplate-mini');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

console.log('Swedish Word Clock — Mini two-part back');
console.log('=========================================\n');

const grid = buildGrid();
const cover = buildCover();
fs.writeFileSync(path.join(outDir, 'backplate_mini_grid.stl'), grid.toSTL('backplate_mini_grid'), 'utf-8');
fs.writeFileSync(path.join(outDir, 'backplate_mini_cover.stl'), cover.toSTL('backplate_mini_cover'), 'utf-8');
fs.writeFileSync(path.join(outDir, 'cover_layout.svg'), coverLayoutSVG(), 'utf-8');

const gb = grid.bbox(), cb = cover.bbox();
console.log(`✓ backplate_mini_grid.stl   ${gb.map(x=>x.toFixed(1)).join(' × ')} mm  (cellgaller, ${COLS}×${ROWS})`);
console.log(`✓ backplate_mini_cover.stl  ${cb.map(x=>x.toFixed(1)).join(' × ')} mm  (bakstycke)`);
console.log(`✓ cover_layout.svg          baksidans layout (nyckelhål/ESP32/kabel)`);
console.log(`\nAssembly:`);
console.log(`1. Print both parts (black PLA, 0.2mm, no supports, brim)`);
console.log(`2. Place the grid on the cover as a jig — pencil-mark each cell centre — lift off`);
console.log(`3. Stick 110 WS2812B segments at the marks (snake: row 0 L→R, row 1 R→L, ...)`);
console.log(`4. Solder 5V/GND/DIN cell to cell — everything flat and accessible`);
console.log(`5. Feed 3 wires from the first LED through the pass-through hole to the ESP32 bay (back)`);
console.log(`6. Screw the grid onto the cover: 4× M3 self-tapping through the cover corners`);
console.log(`7. Diffuser on the walls, stencil front on top; power cable down the channel`);
console.log(`8. Hang on a screw/hook via the keyhole boss (top-centre)`);
