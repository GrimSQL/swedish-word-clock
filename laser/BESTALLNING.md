# Beställningsguide — Laserskurna delar till Svensk Ordklocka

## Översikt

Denna guide beskriver hur du beställer laserskurna delar till ordklockan.
Du behöver minst **två delar** för en komplett klocka:

| Del | Fil | Material | Funktion |
|-----|-----|----------|----------|
| **Frontpanel** | `wordclock-grid-{S,M,L}.svg` | 3mm svart akryl | Döljer LEDs, visar bokstäver genom utskurna fönster |
| **Diffusor** | (skär samma yttre ram) | 3mm frostad/opal akryl | Jämnar ut LED-ljuset bakom frontpanelen |
| **Separator** | `separator-M.svg` | 3mm MDF eller svart akryl | Förhindrar ljusläckage mellan bokstäver |

### Varianter

- **Variant A: Rutnät** (`wordclock-grid-*.svg`) — Fyrkantiga hål, bokstäver appliceras separat med vinyl eller gravering. Enklast och mest pålitlig.
- **Variant B: Stencil** (`wordclock-stencil-M.svg`) — Bokstavsformade utskarningar. Kräver efterbehandling i Inkscape (se nedan).

## Storlekar

| Storlek | Panel (mm) | Cellpitch | Utskärning | Användning |
|---------|-----------|-----------|------------|------------|
| **S** | 305 × 280 | 25mm | 20mm | Skrivbordsklocka |
| **M** | 415 × 380 | 35mm | 28mm | Väggklocka (standard) |
| **L** | 525 × 480 | 45mm | 37mm | Stor väggklocka |

## Materialrekommendationer

### Frontpanel
- **3mm svart gjuten akryl (cast acrylic)** — bästa valet
- Alternativ: 3mm MDF (billigare, behöver målas)
- Gjuten akryl ger renare snittkanter än extruderad

### Diffusor
- **3mm frostad/opal akryl** — jämnar ut LED-ljus
- Alternativ: vitt bakgrundsljuspapper (LED diffusion film)
- Alternativ: 3mm vit akryl

### Separator/baffel
- **3mm svart MDF** — billigast, fungerar bra
- Alternativ: 3mm svart akryl (dyrare men snyggare)

## Filformat

De genererade filerna är i **SVG-format**. De flesta laserskärningstjänster accepterar SVG direkt. Om PDF eller DXF krävs:

1. Öppna SVG i **Inkscape** (gratis, https://inkscape.org)
2. `File` → `Save As` → välj önskat format (PDF, DXF, etc.)

### Färgkoder i filerna

| Färg | Betydelse | Linje |
|------|-----------|-------|
| **Röd** (`#FF0000`) | Genomskärning (cut) | 0.025mm hairline |
| **Blå** (`#0000FF`) | Gravering/etsning (engrave) | 0.025mm hairline |

Meddela lasertjänsten att röda linjer ska skäras genom materialet och blå linjer ska graveras/etsas.

## Företag för laserskärning

### EU-baserade (rekommenderas)

| Företag | Land | Pris (ca.) | Format | Webb |
|---------|------|-----------|--------|------|
| **Formulor** | DE | 25–50 € | SVG direkt | https://formulor.de |
| **Snijlab** | NL | 30–60 € | PDF (konvertera SVG) | https://snijlab.nl |
| **Sculpteo** | FR | 30–60 € | SVG (rekommenderat) | https://sculpteo.com |
| **Cotter** | DK | 30–60 € | PDF (konvertera SVG) | https://cotter.dk |

### Sverige

| Företag | Land | Pris | Format | Webb |
|---------|------|------|--------|------|
| **Scandcut** | SE | Offertbaserat | Kontakta | https://scandcut.se |

> **Tips:** Sök även efter lokala makerspaces/FabLabs i din stad. Många har laserskärare tillgängliga för medlemmar till självkostnadspris.

### Budget (längre leveranstid)

| Företag | Land | Pris | Format | Webb |
|---------|------|------|--------|------|
| **Elecrow** | CN | $10–25 | DXF (konvertera SVG) | https://elecrow.com |

> Leveranstid från Kina: 2–3 veckor. Materialkvaliteten kan variera.

## Beställningsinstruktioner

### Steg 1: Generera filer

```bash
cd laser/
node generate-laser-files.js
```

### Steg 2: Välj storlek och variant

- Nybörjare: Välj **Variant A (rutnät)** i storlek **M**
- Fil: `wordclock-grid-M.svg`

### Steg 3: Förbered filen (om stencilvariant)

Stencilvarianten (`wordclock-stencil-M.svg`) kräver extra steg:

1. Installera fonten **Allerta Stencil** från [Google Fonts](https://fonts.google.com/specimen/Allerta+Stencil)
2. Öppna filen i **Inkscape**
3. Markera all text: `Edit` → `Select All` (Ctrl+A)
4. Konvertera till banor: `Path` → `Object to Path` (Shift+Ctrl+C)
5. Spara som Plain SVG

### Steg 4: Beställ

1. Gå till vald laserskärningstjänst
2. Ladda upp SVG-filen (eller konverterad PDF/DXF)
3. Välj material:
   - **Frontpanel:** 3mm svart akryl (cast/gjuten)
   - **Diffusor:** 3mm frostad/opal akryl
   - **Separator:** 3mm svart MDF
4. Ange att **röda linjer = genomskärning**, **blå linjer = gravering**
5. Beställ och betala

### Steg 5: Montering

1. LED-matris (WS2812B) monterad på bakplatta
2. Separator-grid placeras ovanpå LED-matrisen
3. Diffusor-skiva läggs ovanpå separatorn
4. Frontpanel monteras överst med skruvar genom monteringshålen
5. Bokstäver appliceras med vinyl-klistermärken (Variant A) eller lyser genom utskarningarna (Variant B)

## Tips

- **Beställ en testbit först** — Många tjänster erbjuder billiga provskärningar. Bra för att verifiera mått och passform.
- **Kerf (skärbredd):** ~0.2mm. Ingen kompensation behövs för ordklockan; hålen blir marginellt större vilket är fördelaktigt för ljusgenomsläpp.
- **Vinyl-bokstäver (Variant A):** Beställ vita vinyl-bokstäver separat (t.ex. från en skyltfirma) eller använd en Cricut/Silhouette-maskin.
- **Skruvar:** M4-skruvar passar monteringshålen. Använd distanser (spacers) mellan lagren.
