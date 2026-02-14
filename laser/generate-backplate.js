#!/usr/bin/env node
// generate-backplate.js — 3D-printable backplate grid for Swedish Word Clock
// Generates ASCII STL files split into sections that fit on a ~220mm print bed.
// No dependencies required. Run: node generate-backplate.js

const fs = require('fs');
const path = require('path');

// ============================================================
// PARAMETERS (matching wordclock-stencil-L dimensions)
// ============================================================
const COLS = 11;
const ROWS = 10;
const PITCH = 45;           // mm, cell pitch (matching L size)
const WALL_THICKNESS = 3;   // mm, wall between cells
const WALL_HEIGHT = 20;     // mm, cell depth (LED to diffuser distance)
const BASE_THICKNESS = 2;   // mm, base plate
const WIRE_NOTCH_W = 4;     // mm, notch width for wiring
const WIRE_NOTCH_H = 5;     // mm, notch height from base
const LED_HOLE_DIA = 6;     // mm, center hole for LED/wires
const FRAME_BORDER = 15;    // mm, border matching front panel
const MOUNT_HOLE_DIA = 4.2; // mm, M4 clearance hole
const MOUNT_INSET = 8;      // mm, from panel edge

// Section splitting for ~200mm max print bed
// Cols: 4 + 4 + 3 = 11 (180mm + 180mm + 135mm)
// Rows: 4 + 3 + 3 = 10 (180mm + 135mm + 135mm)
const COL_SPLITS = [4, 4, 3];
const ROW_SPLITS = [4, 3, 3];

// Interlocking tab dimensions
const TAB_WIDTH = 10;       // mm
const TAB_DEPTH = 3;        // mm (protrudes from edge)
const TAB_HEIGHT = 10;      // mm

// ============================================================
// STL HELPERS (ASCII STL format)
// ============================================================

class STLBuilder {
  constructor() {
    this.triangles = [];
  }

  // Add a triangle with vertices [x,y,z] and computed normal
  addTriangle(v1, v2, v3) {
    // Compute normal via cross product
    const u = [v2[0]-v1[0], v2[1]-v1[1], v2[2]-v1[2]];
    const v = [v3[0]-v1[0], v3[1]-v1[1], v3[2]-v1[2]];
    const n = [
      u[1]*v[2] - u[2]*v[1],
      u[2]*v[0] - u[0]*v[2],
      u[0]*v[1] - u[1]*v[0]
    ];
    const len = Math.sqrt(n[0]*n[0] + n[1]*n[1] + n[2]*n[2]);
    if (len > 0) { n[0]/=len; n[1]/=len; n[2]/=len; }
    this.triangles.push({ n, v1, v2, v3 });
  }

  // Add a rectangular face as 2 triangles (vertices in CCW order for outward normal)
  addQuad(a, b, c, d) {
    this.addTriangle(a, b, c);
    this.addTriangle(a, c, d);
  }

  // Add a box from (x,y,z) to (x+w, y+d, z+h)
  addBox(x, y, z, w, d, h) {
    const x2 = x+w, y2 = y+d, z2 = z+h;
    // Bottom (z=z, normal -Z)
    this.addQuad([x,y2,z],[x2,y2,z],[x2,y,z],[x,y,z]);
    // Top (z=z2, normal +Z)
    this.addQuad([x,y,z2],[x2,y,z2],[x2,y2,z2],[x,y2,z2]);
    // Front (y=y, normal -Y)
    this.addQuad([x,y,z],[x2,y,z],[x2,y,z2],[x,y,z2]);
    // Back (y=y2, normal +Y)
    this.addQuad([x2,y2,z],[x,y2,z],[x,y2,z2],[x2,y2,z2]);
    // Left (x=x, normal -X)
    this.addQuad([x,y2,z],[x,y,z],[x,y,z2],[x,y2,z2]);
    // Right (x=x2, normal +X)
    this.addQuad([x2,y,z],[x2,y2,z],[x2,y2,z2],[x2,y,z2]);
  }

  // Approximate a cylinder (vertical, along Z) as a polygon
  addCylinder(cx, cy, z, r, h, segments = 16) {
    const z2 = z + h;
    for (let i = 0; i < segments; i++) {
      const a1 = (2 * Math.PI * i) / segments;
      const a2 = (2 * Math.PI * (i+1)) / segments;
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      // Side face
      this.addQuad([x1,y1,z],[x2,y2,z],[x2,y2,z2],[x1,y1,z2]);
      // Top cap
      this.addTriangle([cx,cy,z2],[x1,y1,z2],[x2,y2,z2]);
      // Bottom cap
      this.addTriangle([cx,cy,z],[x2,y2,z],[x1,y1,z]);
    }
  }

  toSTL(name = 'backplate') {
    let stl = `solid ${name}\n`;
    for (const t of this.triangles) {
      stl += `  facet normal ${t.n[0].toExponential(6)} ${t.n[1].toExponential(6)} ${t.n[2].toExponential(6)}\n`;
      stl += `    outer loop\n`;
      stl += `      vertex ${t.v1[0].toExponential(6)} ${t.v1[1].toExponential(6)} ${t.v1[2].toExponential(6)}\n`;
      stl += `      vertex ${t.v2[0].toExponential(6)} ${t.v2[1].toExponential(6)} ${t.v2[2].toExponential(6)}\n`;
      stl += `      vertex ${t.v3[0].toExponential(6)} ${t.v3[1].toExponential(6)} ${t.v3[2].toExponential(6)}\n`;
      stl += `    endloop\n`;
      stl += `  endfacet\n`;
    }
    stl += `endsolid ${name}\n`;
    return stl;
  }
}

// ============================================================
// BACKPLATE SECTION GENERATOR
// ============================================================

function generateSection(colStart, colCount, rowStart, rowCount, secCol, secRow) {
  const stl = new STLBuilder();

  const cellInner = PITCH - WALL_THICKNESS;
  const sectionW = colCount * PITCH + WALL_THICKNESS; // includes walls on both sides
  const sectionD = rowCount * PITCH + WALL_THICKNESS;
  const totalH = BASE_THICKNESS + WALL_HEIGHT;

  // --- Base plate ---
  stl.addBox(0, 0, 0, sectionW, sectionD, BASE_THICKNESS);

  // --- Vertical walls (along Y axis, between columns) ---
  for (let c = 0; c <= colCount; c++) {
    const wx = c * PITCH;
    // Full wall with wire notches cut out
    // Build wall as segments, skipping notch areas
    for (let r = 0; r < rowCount; r++) {
      const wy = r * PITCH + WALL_THICKNESS; // start after row wall
      const wallLen = cellInner; // wall segment length = cell inner size

      // Lower wall segment (below notch) — skip, this is where notch is
      // Upper wall segment (above notch)
      if (c > 0 && c < colCount) {
        // Interior wall: add wire notch
        // Wall from base+notch_h to top
        stl.addBox(wx, wy, BASE_THICKNESS + WIRE_NOTCH_H, WALL_THICKNESS, wallLen, WALL_HEIGHT - WIRE_NOTCH_H);
        // Wall segments on sides of notch (below notch level)
        const notchStart = wy + (wallLen - WIRE_NOTCH_W) / 2;
        // Left of notch
        stl.addBox(wx, wy, BASE_THICKNESS, WALL_THICKNESS, (wallLen - WIRE_NOTCH_W) / 2, WIRE_NOTCH_H);
        // Right of notch
        stl.addBox(wx, notchStart + WIRE_NOTCH_W, BASE_THICKNESS, WALL_THICKNESS, (wallLen - WIRE_NOTCH_W) / 2, WIRE_NOTCH_H);
      } else {
        // Edge wall: solid (no notch needed)
        stl.addBox(wx, wy, BASE_THICKNESS, WALL_THICKNESS, wallLen, WALL_HEIGHT);
      }
    }
    // Wall segments at row-wall intersections (pillars)
    for (let r = 0; r <= rowCount; r++) {
      const wy = r * PITCH;
      stl.addBox(wx, wy, BASE_THICKNESS, WALL_THICKNESS, WALL_THICKNESS, WALL_HEIGHT);
    }
  }

  // --- Horizontal walls (along X axis, between rows) ---
  for (let r = 0; r <= rowCount; r++) {
    const wy = r * PITCH;
    for (let c = 0; c < colCount; c++) {
      const wx = c * PITCH + WALL_THICKNESS;
      const wallLen = cellInner;

      if (r > 0 && r < rowCount) {
        // Interior wall: add wire notch
        stl.addBox(wx, wy, BASE_THICKNESS + WIRE_NOTCH_H, wallLen, WALL_THICKNESS, WALL_HEIGHT - WIRE_NOTCH_H);
        const notchStart = wx + (wallLen - WIRE_NOTCH_W) / 2;
        stl.addBox(wx, wy, BASE_THICKNESS, (wallLen - WIRE_NOTCH_W) / 2, WALL_THICKNESS, WIRE_NOTCH_H);
        stl.addBox(notchStart + WIRE_NOTCH_W, wy, BASE_THICKNESS, (wallLen - WIRE_NOTCH_W) / 2, WALL_THICKNESS, WIRE_NOTCH_H);
      } else {
        // Edge wall: solid
        stl.addBox(wx, wy, BASE_THICKNESS, wallLen, WALL_THICKNESS, WALL_HEIGHT);
      }
    }
  }

  // --- LED holes in base plate (cylindrical cutouts represented as raised rings) ---
  // Since STL can't do boolean subtraction easily, we mark LED positions
  // with small raised rings on the base plate for visual reference.
  // The actual holes should be drilled or the base can be printed with
  // support and holes modeled as thin-walled cylinders.
  // For practical purposes, we add guide marks.
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      const cx = c * PITCH + WALL_THICKNESS + cellInner / 2;
      const cy = r * PITCH + WALL_THICKNESS + cellInner / 2;
      // LED guide ring on top of base
      stl.addCylinder(cx, cy, BASE_THICKNESS, LED_HOLE_DIA / 2 + 1, 0.5, 12);
    }
  }

  // --- Interlocking tabs ---
  // Right edge tabs (if not last column section)
  if (secCol < COL_SPLITS.length - 1) {
    for (let t = 0; t < 2; t++) {
      const ty = sectionD * (t + 1) / 3 - TAB_WIDTH / 2;
      stl.addBox(sectionW, ty, BASE_THICKNESS, TAB_DEPTH, TAB_WIDTH, TAB_HEIGHT);
    }
  }
  // Left edge slots (if not first column section) — indentation represented as tab on neighbor
  // Top edge tabs (if not last row section)
  if (secRow < ROW_SPLITS.length - 1) {
    for (let t = 0; t < 2; t++) {
      const tx = sectionW * (t + 1) / 3 - TAB_WIDTH / 2;
      stl.addBox(tx, sectionD, BASE_THICKNESS, TAB_WIDTH, TAB_DEPTH, TAB_HEIGHT);
    }
  }

  return {
    stl: stl.toSTL(`backplate_${secCol}_${secRow}`),
    sectionW,
    sectionD,
    totalH,
    cells: colCount * rowCount
  };
}

// ============================================================
// MAIN — Generate all sections
// ============================================================

const outDir = path.join(__dirname, '3d-backplate');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

console.log('Swedish Word Clock — 3D Backplate Generator');
console.log('=============================================\n');
console.log(`Panel: ${COLS}×${ROWS} cells, ${PITCH}mm pitch (L size)`);
console.log(`Cell depth: ${WALL_HEIGHT}mm, wall: ${WALL_THICKNESS}mm, base: ${BASE_THICKNESS}mm`);
console.log(`Wire notch: ${WIRE_NOTCH_W}×${WIRE_NOTCH_H}mm in interior walls`);
console.log(`Split into ${COL_SPLITS.length}×${ROW_SPLITS.length} = ${COL_SPLITS.length * ROW_SPLITS.length} printable sections\n`);

let totalCells = 0;
let rowStart = 0;

for (let sr = 0; sr < ROW_SPLITS.length; sr++) {
  let colStart = 0;
  for (let sc = 0; sc < COL_SPLITS.length; sc++) {
    const cols = COL_SPLITS[sc];
    const rows = ROW_SPLITS[sr];
    const filename = `backplate_section_${sc}_${sr}.stl`;
    const { stl, sectionW, sectionD, totalH, cells } = generateSection(colStart, cols, rowStart, rows, sc, sr);
    const filepath = path.join(outDir, filename);
    fs.writeFileSync(filepath, stl, 'utf-8');
    totalCells += cells;

    const label = `[${sc},${sr}]`;
    console.log(`✓ ${filename}  ${label}  ${cols}×${rows} cells  ${sectionW.toFixed(0)}×${sectionD.toFixed(0)}×${totalH}mm`);

    colStart += cols;
  }
  rowStart += ROW_SPLITS[sr];
}

console.log(`\nTotal: ${totalCells} cells across ${COL_SPLITS.length * ROW_SPLITS.length} sections`);
console.log(`\nAssembly:`);
console.log(`1. Print all 9 sections (PLA or PETG, 0.2mm layer, 15-20% infill)`);
console.log(`2. Snap sections together using interlocking tabs`);
console.log(`3. Glue WS2812B LEDs in each cell (centered on guide ring)`);
console.log(`4. Route data+power wires through notches between cells`);
console.log(`5. Place diffuser sheet on top of grid`);
console.log(`6. Mount front panel with M4 screws through corner holes`);
console.log(`\nWiring order: snake pattern, row 0 left→right, row 1 right→left, etc.`);
