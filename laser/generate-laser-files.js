#!/usr/bin/env node
// generate-laser-files.js — Parametric SVG generator for Swedish Word Clock laser cutting
// No dependencies required. Run: node generate-laser-files.js

const fs = require('fs');
const path = require('path');

// ============================================================
// GRID LAYOUT (must match index.html)
// ============================================================
const COLS = 11;
const ROWS = 10;
const GRID_LETTERS = [
  'K','L','O','C','K','A','N','D','A','Ä','R',
  'S','F','E','M','I','S','T','I','O','N','A',
  'T','J','U','G','O','M','I','E','S','N','D',
  'K','V','A','R','T','B','Ö','V','E','R','G',
  'L','I','D','K','H','A','L','V','Ö','T','P',
  'E','T','T','R','T','V','Å','L','S','N','D',
  'T','R','E','N','F','Y','R','A','O','S','T',
  'F','E','M','B','S','E','X','O','S','J','U',
  'Å','T','T','A','M','N','I','O','D','E','K',
  'E','L','V','A','T','O','L','V','T','I','O'
];

// ============================================================
// SIZE CONFIGURATIONS
// ============================================================
const SIZES = {
  S: { label: 'Small (desktop)',  pitch: 25, cutout: 20, cornerDot: 8, mountHole: 4 },
  M: { label: 'Medium (wall)',    pitch: 35, cutout: 28, cornerDot: 8, mountHole: 4 },
  L: { label: 'Large (wall)',     pitch: 45, cutout: 37, cornerDot: 8, mountHole: 4 },
};

// Shared constants
const STROKE_WIDTH = 0.025; // hairline
const CUT_COLOR = '#FF0000';
const ENGRAVE_COLOR = '#0000FF';
const CORNER_RADIUS = 5; // outer frame corner radius in mm
const FRAME_BORDER = 15; // border around grid area in mm
const MOUNT_INSET = 8;   // mounting hole inset from panel edge

// ============================================================
// SVG HELPERS
// ============================================================

function svgHeader(width, height) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${width}mm" height="${height}mm"
     viewBox="0 0 ${width} ${height}">
`;
}

function svgFooter() {
  return '</svg>\n';
}

function roundedRect(x, y, w, h, r, color) {
  return `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" ` +
    `stroke="${color}" stroke-width="${STROKE_WIDTH}" fill="none" />\n`;
}

function rect(x, y, w, h, color) {
  return `  <rect x="${x}" y="${y}" width="${w}" height="${h}" ` +
    `stroke="${color}" stroke-width="${STROKE_WIDTH}" fill="none" />\n`;
}

function circle(cx, cy, r, color) {
  return `  <circle cx="${cx}" cy="${cy}" r="${r}" ` +
    `stroke="${color}" stroke-width="${STROKE_WIDTH}" fill="none" />\n`;
}

function textElement(x, y, text, size, color, anchor = 'middle') {
  return `  <text x="${x}" y="${y}" font-family="sans-serif" font-size="${size}" ` +
    `fill="${color}" text-anchor="${anchor}" dominant-baseline="central">${text}</text>\n`;
}

// ============================================================
// GRID SVG GENERATOR (Variant A)
// ============================================================

function generateGridSVG(sizeKey) {
  const s = SIZES[sizeKey];
  const gridW = COLS * s.pitch;
  const gridH = ROWS * s.pitch;
  const panelW = gridW + 2 * FRAME_BORDER;
  const panelH = gridH + 2 * FRAME_BORDER;

  let svg = svgHeader(panelW, panelH);

  // Layer: Cut lines
  svg += `  <g id="cut-lines" inkscape:label="Cut" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape">\n`;

  // Outer frame
  svg += `  ${roundedRect(0, 0, panelW, panelH, CORNER_RADIUS, CUT_COLOR).trim()}\n`;

  // 110 cell windows (centered in each cell)
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cx = FRAME_BORDER + col * s.pitch + s.pitch / 2;
      const cy = FRAME_BORDER + row * s.pitch + s.pitch / 2;
      const x = cx - s.cutout / 2;
      const y = cy - s.cutout / 2;
      svg += `  ${rect(x, y, s.cutout, s.cutout, CUT_COLOR).trim()}\n`;
    }
  }

  // 4 corner dots (minute indicators) — positioned in frame border area at corners of grid
  const dotR = s.cornerDot / 2;
  const dotInset = FRAME_BORDER / 2; // center in frame border
  const dotPositions = [
    [dotInset, dotInset],
    [panelW - dotInset, dotInset],
    [dotInset, panelH - dotInset],
    [panelW - dotInset, panelH - dotInset],
  ];
  dotPositions.forEach(([cx, cy]) => {
    svg += `  ${circle(cx, cy, dotR, CUT_COLOR).trim()}\n`;
  });

  // 4 mounting holes
  const mountPositions = [
    [MOUNT_INSET, MOUNT_INSET],
    [panelW - MOUNT_INSET, MOUNT_INSET],
    [MOUNT_INSET, panelH - MOUNT_INSET],
    [panelW - MOUNT_INSET, panelH - MOUNT_INSET],
  ];
  mountPositions.forEach(([cx, cy]) => {
    svg += `  ${circle(cx, cy, s.mountHole / 2, CUT_COLOR).trim()}\n`;
  });

  svg += '  </g>\n';

  // Layer: Engrave labels (letters)
  svg += `  <g id="engrave-labels" inkscape:label="Engrave" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape">\n`;

  const fontSize = s.cutout * 0.6;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const idx = row * COLS + col;
      const cx = FRAME_BORDER + col * s.pitch + s.pitch / 2;
      const cy = FRAME_BORDER + row * s.pitch + s.pitch / 2;
      svg += `  ${textElement(cx, cy, GRID_LETTERS[idx], fontSize, ENGRAVE_COLOR).trim()}\n`;
    }
  }

  svg += '  </g>\n';
  svg += svgFooter();

  return { svg, panelW, panelH };
}

// ============================================================
// STENCIL SVG GENERATOR (Variant B)
// ============================================================

function generateStencilSVG() {
  const s = SIZES.M;
  const gridW = COLS * s.pitch;
  const gridH = ROWS * s.pitch;
  const panelW = gridW + 2 * FRAME_BORDER;
  const panelH = gridH + 2 * FRAME_BORDER;

  let svg = svgHeader(panelW, panelH);

  svg += `  <!-- INSTRUCTIONS:
       1. Install font "Allerta Stencil" from Google Fonts (free)
       2. Open this file in Inkscape
       3. Select All (Ctrl+A)
       4. Path > Object to Path (Shift+Ctrl+C)
       5. Save as Plain SVG or export as DXF
       The stencil font has built-in bridges for enclosed letters (A, O, B, D, etc.)
  -->\n\n`;

  // Layer: Cut lines
  svg += `  <g id="cut-lines" inkscape:label="Cut" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape">\n`;

  // Outer frame
  svg += `  ${roundedRect(0, 0, panelW, panelH, CORNER_RADIUS, CUT_COLOR).trim()}\n`;

  // Corner dots
  const dotR = s.cornerDot / 2;
  const dotInset = FRAME_BORDER / 2;
  [
    [dotInset, dotInset],
    [panelW - dotInset, dotInset],
    [dotInset, panelH - dotInset],
    [panelW - dotInset, panelH - dotInset],
  ].forEach(([cx, cy]) => {
    svg += `  ${circle(cx, cy, dotR, CUT_COLOR).trim()}\n`;
  });

  // Mounting holes
  [
    [MOUNT_INSET, MOUNT_INSET],
    [panelW - MOUNT_INSET, MOUNT_INSET],
    [MOUNT_INSET, panelH - MOUNT_INSET],
    [panelW - MOUNT_INSET, panelH - MOUNT_INSET],
  ].forEach(([cx, cy]) => {
    svg += `  ${circle(cx, cy, s.mountHole / 2, CUT_COLOR).trim()}\n`;
  });

  svg += '  </g>\n';

  // Layer: Stencil letters (text elements — must be converted to paths in Inkscape)
  svg += `  <g id="stencil-letters" inkscape:label="Stencil Cut" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape">\n`;

  const fontSize = s.cutout * 0.75;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const idx = row * COLS + col;
      const cx = FRAME_BORDER + col * s.pitch + s.pitch / 2;
      const cy = FRAME_BORDER + row * s.pitch + s.pitch / 2;
      svg += `  <text x="${cx}" y="${cy}" font-family="Allerta Stencil, sans-serif" font-weight="400" ` +
        `font-size="${fontSize}" fill="${CUT_COLOR}" stroke="none" ` +
        `text-anchor="middle" dominant-baseline="central">${GRID_LETTERS[idx]}</text>\n`;
    }
  }

  svg += '  </g>\n';
  svg += svgFooter();

  return { svg, panelW, panelH };
}

// ============================================================
// DXF GENERATOR (AutoCAD R12 ASCII format)
// ============================================================

function dxfHeader() {
  return `0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n` +
    `0\nTABLE\n2\nLAYER\n70\n2\n` +
    // Layer CUT (red, color 1)
    `0\nLAYER\n2\nCUT\n70\n0\n62\n1\n6\nCONTINUOUS\n` +
    // Layer ENGRAVE (blue, color 5)
    `0\nLAYER\n2\nENGRAVE\n70\n0\n62\n5\n6\nCONTINUOUS\n` +
    `0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n`;
}

function dxfFooter() {
  return '0\nENDSEC\n0\nEOF\n';
}

function dxfLine(x1, y1, x2, y2, layer = 'CUT') {
  return `0\nLINE\n8\n${layer}\n10\n${x1}\n20\n${y1}\n30\n0\n11\n${x2}\n21\n${y2}\n31\n0\n`;
}

function dxfCircle(cx, cy, r, layer = 'CUT') {
  return `0\nCIRCLE\n8\n${layer}\n10\n${cx}\n20\n${cy}\n30\n0\n40\n${r}\n`;
}

// Draw a rectangle as 4 lines (DXF has no rect primitive)
function dxfRect(x, y, w, h, layer = 'CUT') {
  return dxfLine(x, y, x + w, y, layer) +
    dxfLine(x + w, y, x + w, y + h, layer) +
    dxfLine(x + w, y + h, x, y + h, layer) +
    dxfLine(x, y + h, x, y, layer);
}

// Approximate rounded rectangle as polyline with arc segments
function dxfRoundedRect(x, y, w, h, r, layer = 'CUT') {
  // Simplify: use straight lines for DXF (rounded corners are cosmetic)
  // Most laser services will accept this; exact rounding can be done in their CAD
  return dxfRect(x, y, w, h, layer);
}

function generateGridDXF(sizeKey) {
  const s = SIZES[sizeKey];
  const gridW = COLS * s.pitch;
  const gridH = ROWS * s.pitch;
  const panelW = gridW + 2 * FRAME_BORDER;
  const panelH = gridH + 2 * FRAME_BORDER;

  let dxf = dxfHeader();

  // Outer frame (DXF Y-axis goes up, so we flip Y for conventional orientation)
  dxf += dxfRoundedRect(0, 0, panelW, panelH, CORNER_RADIUS, 'CUT');

  // 110 cell windows
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cx = FRAME_BORDER + col * s.pitch + s.pitch / 2;
      const cy = FRAME_BORDER + row * s.pitch + s.pitch / 2;
      const rx = cx - s.cutout / 2;
      const ry = cy - s.cutout / 2;
      dxf += dxfRect(rx, ry, s.cutout, s.cutout, 'CUT');
    }
  }

  // 4 corner dots
  const dotR = s.cornerDot / 2;
  const dotInset = FRAME_BORDER / 2;
  [
    [dotInset, dotInset],
    [panelW - dotInset, dotInset],
    [dotInset, panelH - dotInset],
    [panelW - dotInset, panelH - dotInset],
  ].forEach(([cx, cy]) => {
    dxf += dxfCircle(cx, cy, dotR, 'CUT');
  });

  // 4 mounting holes
  [
    [MOUNT_INSET, MOUNT_INSET],
    [panelW - MOUNT_INSET, MOUNT_INSET],
    [MOUNT_INSET, panelH - MOUNT_INSET],
    [panelW - MOUNT_INSET, panelH - MOUNT_INSET],
  ].forEach(([cx, cy]) => {
    dxf += dxfCircle(cx, cy, s.mountHole / 2, 'CUT');
  });

  // NOTE: No text entities in DXF — laser cutting services often reject them
  // because fonts are unavailable on their systems. Letter labels are only
  // included in the SVG files (engrave layer) for reference.

  dxf += dxfFooter();
  return { dxf, panelW, panelH };
}

// ============================================================
// SEPARATOR / BAFFLE GRID GENERATOR
// ============================================================

function generateSeparatorSVG() {
  const s = SIZES.M;
  const materialThickness = 3; // mm
  const cellInner = s.pitch; // inner cell matches pitch
  const slotDepth = (ROWS * s.pitch) / 2; // half-height slots for egg-crate
  const gridW = COLS * s.pitch;
  const gridH = ROWS * s.pitch;
  const margin = 10; // drawing margin

  // We generate two sets of strips:
  // - Horizontal strips (ROWS+1 count = 11): full width, with slots cut downward
  // - Vertical strips (COLS+1 count = 12): full height, with slots cut upward

  const hStripCount = ROWS + 1; // 11 horizontal dividers
  const vStripCount = COLS + 1; // 12 vertical dividers
  const stripHeight = 20; // strip height (depth into the clock body) in mm
  const slotWidth = materialThickness + 0.1; // slight clearance for press fit

  // Layout: horizontal strips stacked vertically, then vertical strips below
  const hStripW = gridW;
  const vStripW = gridH;
  const spacing = 5; // between strips

  const totalW = Math.max(hStripW, vStripW) + 2 * margin;
  const hBlockH = hStripCount * (stripHeight + spacing);
  const vBlockH = vStripCount * (stripHeight + spacing);
  const totalH = hBlockH + vBlockH + 3 * margin;

  let svg = svgHeader(totalW, totalH);

  svg += `  <!-- SEPARATOR GRID (Egg-crate / baffle)
       Material: 3mm MDF or acrylic
       Assembly: Slide horizontal and vertical strips together at the slots
       Horizontal strips: slots cut from TOP edge
       Vertical strips: slots cut from BOTTOM edge
  -->\n\n`;

  svg += `  <g id="separator-cuts" inkscape:label="Cut" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape">\n`;

  // --- Horizontal strips ---
  // Each horizontal strip spans the full grid width and has slots at each vertical divider position
  for (let i = 0; i < hStripCount; i++) {
    const x0 = margin;
    const y0 = margin + i * (stripHeight + spacing);

    // Outer rectangle of the strip
    svg += `  ${rect(x0, y0, hStripW, stripHeight, CUT_COLOR).trim()}\n`;

    // Slots from top edge at each vertical crossing (except edges)
    for (let v = 1; v < vStripCount - 1; v++) {
      const slotX = x0 + v * s.pitch - slotWidth / 2;
      const slotY = y0;
      const slotH = stripHeight / 2;
      svg += `  ${rect(slotX, slotY, slotWidth, slotH, CUT_COLOR).trim()}\n`;
    }
  }

  // --- Vertical strips ---
  const vBlockY0 = margin + hBlockH + margin;
  for (let j = 0; j < vStripCount; j++) {
    const x0 = margin;
    const y0 = vBlockY0 + j * (stripHeight + spacing);

    // Outer rectangle
    svg += `  ${rect(x0, y0, vStripW, stripHeight, CUT_COLOR).trim()}\n`;

    // Slots from bottom edge at each horizontal crossing (except edges)
    for (let h = 1; h < hStripCount - 1; h++) {
      const slotX = x0 + h * s.pitch - slotWidth / 2;
      const slotY = y0 + stripHeight / 2;
      const slotH = stripHeight / 2;
      svg += `  ${rect(slotX, slotY, slotWidth, slotH, CUT_COLOR).trim()}\n`;
    }
  }

  svg += '  </g>\n';
  svg += svgFooter();

  return { svg, totalW, totalH };
}

// ============================================================
// MAIN — Generate all files
// ============================================================

const outDir = __dirname;

console.log('Swedish Word Clock — Laser File Generator');
console.log('==========================================\n');

// Variant A: Grid SVGs in three sizes
for (const sizeKey of ['S', 'M', 'L']) {
  const filename = `wordclock-grid-${sizeKey}.svg`;
  const { svg, panelW, panelH } = generateGridSVG(sizeKey);
  const filepath = path.join(outDir, filename);
  fs.writeFileSync(filepath, svg, 'utf-8');
  console.log(`✓ ${filename}  (${panelW} × ${panelH} mm) — ${SIZES[sizeKey].label}`);
}

// Variant B: Stencil SVG (M only)
{
  const filename = 'wordclock-stencil-M.svg';
  const { svg, panelW, panelH } = generateStencilSVG();
  const filepath = path.join(outDir, filename);
  fs.writeFileSync(filepath, svg, 'utf-8');
  console.log(`✓ ${filename}  (${panelW} × ${panelH} mm) — Stencil variant`);
}

// Separator grid (M only)
{
  const filename = 'separator-M.svg';
  const { svg, totalW, totalH } = generateSeparatorSVG();
  const filepath = path.join(outDir, filename);
  fs.writeFileSync(filepath, svg, 'utf-8');
  console.log(`✓ ${filename}  — Egg-crate baffle grid`);
}

// DXF for Scandcut (L size only — their preferred format)
{
  const filename = 'wordclock-grid-L.dxf';
  const { dxf, panelW, panelH } = generateGridDXF('L');
  const filepath = path.join(outDir, filename);
  fs.writeFileSync(filepath, dxf, 'utf-8');
  console.log(`✓ ${filename}  (${panelW} × ${panelH} mm) — DXF for Scandcut/CAD`);
}

console.log('\nDone! Open SVG files in a browser or Inkscape to verify.');
console.log('DXF files can be opened in any CAD program (FreeCAD, AutoCAD, LibreCAD).');
console.log('For stencil variant: install "Allerta Stencil" font, open in Inkscape,');
console.log('select all text → Path > Object to Path before sending to laser cutter.');
