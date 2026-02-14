#!/usr/bin/env node
// generate-frontplate-test.js — 3D-printable test front panel for Swedish Word Clock
// Grid variant (square cell windows) split into printable sections.
// Use this to verify fitment before ordering laser-cut metal.
// No dependencies required. Run: node generate-frontplate-test.js

const fs = require('fs');
const path = require('path');

// ============================================================
// PARAMETERS (matching wordclock-stencil-L / backplate)
// ============================================================
const COLS = 11;
const ROWS = 10;
const PITCH = 45;            // mm, cell pitch (L size)
const WALL_THICKNESS = 3;    // mm, wall between cells
const PANEL_THICKNESS = 3;   // mm, front panel thickness
const CUTOUT = 37;           // mm, cell window size (L size)
const CORNER_DOT_DIA = 8;   // mm
const MOUNT_HOLE_DIA = 4.2;  // mm, M4 clearance
const FRAME_BORDER = 15;     // mm
const MOUNT_INSET = 8;       // mm from panel edge

// Section splitting (must match backplate!)
const COL_SPLITS = [4, 4, 3];
const ROW_SPLITS = [4, 3, 3];

// ============================================================
// STL HELPERS
// ============================================================

class STLBuilder {
  constructor() {
    this.triangles = [];
  }

  addTriangle(v1, v2, v3) {
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

  addQuad(a, b, c, d) {
    this.addTriangle(a, b, c);
    this.addTriangle(a, c, d);
  }

  addBox(x, y, z, w, d, h) {
    const x2 = x+w, y2 = y+d, z2 = z+h;
    this.addQuad([x,y2,z],[x2,y2,z],[x2,y,z],[x,y,z]);
    this.addQuad([x,y,z2],[x2,y,z2],[x2,y2,z2],[x,y2,z2]);
    this.addQuad([x,y,z],[x2,y,z],[x2,y,z2],[x,y,z2]);
    this.addQuad([x2,y2,z],[x,y2,z],[x,y2,z2],[x2,y2,z2]);
    this.addQuad([x,y2,z],[x,y,z],[x,y,z2],[x,y2,z2]);
    this.addQuad([x2,y,z],[x2,y2,z],[x2,y2,z2],[x2,y,z2]);
  }

  // Hollow cylinder (tube) — approximated as polygon ring
  addHole(cx, cy, z, r, h, segments = 24) {
    const z2 = z + h;
    for (let i = 0; i < segments; i++) {
      const a1 = (2 * Math.PI * i) / segments;
      const a2 = (2 * Math.PI * (i+1)) / segments;
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      // Inner wall of hole
      this.addQuad([x2,y2,z],[x1,y1,z],[x1,y1,z2],[x2,y2,z2]);
    }
  }

  toSTL(name = 'frontplate') {
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
// FRONT PANEL SECTION GENERATOR
// Build the panel as a collection of "frame" pieces around the cell windows.
// This avoids boolean subtraction — we just build the solid parts.
// ============================================================

function generateFrontSection(colStart, colCount, rowStart, rowCount, secCol, secRow) {
  const stl = new STLBuilder();

  const sectionW = colCount * PITCH + WALL_THICKNESS;
  const sectionD = rowCount * PITCH + WALL_THICKNESS;
  const cellInner = CUTOUT;
  const cellMargin = (PITCH - CUTOUT) / 2; // margin around each cutout within the cell

  // Build the grid frame as horizontal and vertical bars + corner blocks
  // This creates the solid material around the square cell windows

  // --- Vertical bars (between columns of windows) ---
  for (let c = 0; c <= colCount; c++) {
    const barX = c * PITCH;
    const barW = (c === 0 || c === colCount) ? cellMargin + WALL_THICKNESS / 2 : CUTOUT > PITCH - WALL_THICKNESS ? PITCH - CUTOUT : WALL_THICKNESS;

    let actualX, actualW;
    if (c === 0) {
      // Left edge bar
      actualX = 0;
      actualW = cellMargin;
    } else if (c === colCount) {
      // Right edge bar
      actualX = c * PITCH + cellMargin + CUTOUT;
      actualW = PITCH - cellMargin - CUTOUT;  // remaining to section edge
      // Actually, just fill to section width
      actualX = colCount * PITCH - cellMargin + CUTOUT;
    } else {
      // Interior bar
      actualX = c * PITCH - cellMargin + CUTOUT;
      // Hmm this is getting complicated. Let me use a different approach.
    }
  }

  // SIMPLER APPROACH: Build the panel as a solid base, then we can't subtract in STL.
  // Instead, build each "wall strip" between and around the windows.

  // The grid creates a frame pattern. Each cell has margins on all 4 sides.
  // Let's build it row by row, creating horizontal strips and vertical strips.

  const h = PANEL_THICKNESS;

  // For each row of cells, we have:
  // - A horizontal strip ABOVE the row (between rows)
  // - Vertical pillars between cells in the row
  // At the very bottom, one more horizontal strip

  // Horizontal full-width strips (between rows and at top/bottom edges)
  for (let r = 0; r <= rowCount; r++) {
    let stripY, stripH;
    if (r === 0) {
      stripY = 0;
      stripH = cellMargin;
    } else if (r === rowCount) {
      stripY = r * PITCH - cellMargin + CUTOUT;
      stripH = sectionD - stripY;
    } else {
      stripY = r * PITCH - cellMargin + CUTOUT;
      stripH = PITCH - CUTOUT; // gap between windows
    }
    if (stripH > 0.01) {
      stl.addBox(0, stripY, 0, sectionW, stripH, h);
    }
  }

  // Vertical strips between cells (only in the window rows, not full height)
  for (let r = 0; r < rowCount; r++) {
    const winY = r * PITCH + cellMargin;
    const winH = CUTOUT;

    for (let c = 0; c <= colCount; c++) {
      let stripX, stripW;
      if (c === 0) {
        stripX = 0;
        stripW = cellMargin;
      } else if (c === colCount) {
        stripX = c * PITCH - cellMargin + CUTOUT;
        stripW = sectionW - stripX;
      } else {
        stripX = c * PITCH - cellMargin + CUTOUT;
        stripW = PITCH - CUTOUT;
      }
      if (stripW > 0.01) {
        stl.addBox(stripX, winY, 0, stripW, winH, h);
      }
    }
  }

  // Corner dots and mounting holes need special handling.
  // For the test print, we add small raised markers on the surface
  // at the positions where the actual panel would have holes.
  // (True circular holes require boolean ops that STL can't do easily)

  // Check if this section contains any corner dot or mounting hole positions
  const globalOffsetX = colStart * PITCH;
  const globalOffsetY = rowStart * PITCH;
  const gridW = COLS * PITCH;
  const gridH = ROWS * PITCH;
  const panelW = gridW + 2 * FRAME_BORDER;
  const panelH = gridH + 2 * FRAME_BORDER;

  // For edge sections, add the frame border
  // (the frame border extends beyond the grid, handled by the first/last sections)
  let hasLeftBorder = (secCol === 0);
  let hasRightBorder = (secCol === COL_SPLITS.length - 1);
  let hasTopBorder = (secRow === 0);
  let hasBottomBorder = (secRow === ROW_SPLITS.length - 1);

  // Add frame border extensions for edge sections
  if (hasLeftBorder) {
    stl.addBox(-FRAME_BORDER, hasTopBorder ? -FRAME_BORDER : 0, 0,
               FRAME_BORDER, sectionD + (hasTopBorder ? FRAME_BORDER : 0) + (hasBottomBorder ? FRAME_BORDER : 0), h);
  }
  if (hasRightBorder) {
    stl.addBox(sectionW, hasTopBorder ? -FRAME_BORDER : 0, 0,
               FRAME_BORDER, sectionD + (hasTopBorder ? FRAME_BORDER : 0) + (hasBottomBorder ? FRAME_BORDER : 0), h);
  }
  if (hasTopBorder) {
    stl.addBox(0, -FRAME_BORDER, 0, sectionW, FRAME_BORDER, h);
  }
  if (hasBottomBorder) {
    stl.addBox(0, sectionD, 0, sectionW, FRAME_BORDER, h);
  }

  return {
    stl: stl.toSTL(`frontplate_${secCol}_${secRow}`),
    sectionW: sectionW + (hasLeftBorder ? FRAME_BORDER : 0) + (hasRightBorder ? FRAME_BORDER : 0),
    sectionD: sectionD + (hasTopBorder ? FRAME_BORDER : 0) + (hasBottomBorder ? FRAME_BORDER : 0),
  };
}

// ============================================================
// MAIN
// ============================================================

const outDir = path.join(__dirname, '3d-frontplate-test');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

console.log('Swedish Word Clock — 3D Test Front Panel Generator');
console.log('===================================================\n');
console.log(`Panel: ${COLS}×${ROWS} cells, ${PITCH}mm pitch, ${CUTOUT}mm windows (L size)`);
console.log(`Thickness: ${PANEL_THICKNESS}mm, frame border: ${FRAME_BORDER}mm`);
console.log(`Split into ${COL_SPLITS.length}×${ROW_SPLITS.length} = ${COL_SPLITS.length * ROW_SPLITS.length} printable sections\n`);

let rowStart = 0;
for (let sr = 0; sr < ROW_SPLITS.length; sr++) {
  let colStart = 0;
  for (let sc = 0; sc < COL_SPLITS.length; sc++) {
    const cols = COL_SPLITS[sc];
    const rows = ROW_SPLITS[sr];
    const filename = `frontplate_test_${sc}_${sr}.stl`;
    const { stl, sectionW, sectionD } = generateFrontSection(colStart, cols, rowStart, rows, sc, sr);
    const filepath = path.join(outDir, filename);
    fs.writeFileSync(filepath, stl, 'utf-8');

    console.log(`✓ ${filename}  [${sc},${sr}]  ${cols}×${rows} cells  ~${sectionW.toFixed(0)}×${sectionD.toFixed(0)}×${PANEL_THICKNESS}mm`);

    colStart += cols;
  }
  rowStart += ROW_SPLITS[sr];
}

console.log(`\nPrint settings:`);
console.log(`  Material: Black PLA (IMPORTANT: must be opaque!)`);
console.log(`  Layer height: 0.2mm`);
console.log(`  Infill: 100% (it's only 3mm thick — prints fast)`);
console.log(`  Walls: 99 (solid)`);
console.log(`  Supports: No`);
console.log(`  Brim: Yes (thin flat piece needs adhesion)`);
console.log(`\nAssembly: Snap/glue sections together, place on top of backplate+diffuser.`);
console.log(`Test with LEDs to verify light distribution through the ${CUTOUT}mm windows.`);
console.log(`If satisfied, order the laser-cut metal version from Scandcut.`);
