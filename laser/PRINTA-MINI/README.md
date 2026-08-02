# Mini Word Clock — komplett utskriftspaket

Allt du behöver **skriva ut**: **3 filer, EN färg (svart)**. Ingen AMS.
(Diffuser, LED, ESP32 osv. köps — se köplistan längst ner.)

| # | Fil | Vad | Mått (mm) |
|---|-----|-----|-----------|
| 1 | `1_cellgaller-SVART.stl` | Cellväggarna (utan botten) — läggs ÖVER LED:erna | 214 × 196 × 12 |
| 2 | `2_bakstycke-SVART.stl` | Bakstycke: LED-platta + krokfäste + ESP32-ficka + kabelkanal | 214 × 196 × 8,5 |
| 3 | `3_front-stencil-SVART.stl` | Front: bokstäverna = genomskurna hål med bryggor (QlockTwo-stil) | 214 × 196 × 3 |

**Därför två delar bak:** LED-slingan monteras och löds **helt öppet** på det platta
bakstycket — inga fingrar nere i trånga celler. Cellgallret skruvas på efteråt.

Bakstyckets baksida har:
- **Nyckelhålsfäste** (uppe i mitten) — häng klockan på en skruv/krok i väggen
- **ESP32-ficka** (nedtill, USB-porten nedåt) — kortet glider in mellan två skenor
- **Kabelkanal** rakt nedåt — strömsladden går ut i underkant
- **Genomföringshål** (nedtill) — LED-slingans 3 ledare går härifrån till ESP32:n

> **Munstycke:** 0.4 mm funkar. Fronten: smalaste bryggan (i O) är ~0,6 mm —
> **kolla i slice-förhandsvisningen** att bryggorna i O/A/R finns kvar.

---

## Utskriftsinställningar (alla tre)

```
Filament : SVART PLA (opak)
Lager    : 0.2 mm
Stöd     : NEJ (nyckelhålets tak är en kort bro — det klarar skrivaren)
Brim     : JA
Infill   : galler 15–20 % · bakstycke 15–20 % · front 100 %
```

- **Cellgaller:** printas som orienterad (väggarna uppåt). ~3–6 h
- **Bakstycke:** platta sidan (LED-sidan) NEDÅT, fästena uppåt. ~2–4 h
- **Front:** framsidan NEDÅT (första lagret = synliga ytan). ~2–4 h

---

## Montering steg för steg

1. **Markera:** lägg cellgallret löst på bakstyckets släta sida (skruvhålen i hörnen
   linjerar), rita en blyertsprick i varje cellmitt, lyft bort gallret.
2. **LED:** klipp 60/m WS2812B-strip i **110 enskilda segment**. Klistra ett segment
   på varje prick. Snake-mönster: rad 0 vänster→höger, rad 1 höger→vänster, osv.
   **Pilarna på strippen ska följa slingans riktning!**
3. **Löd** 5V/GND/DIN mellan alla segment — allt ligger öppet och platt. Lämna
   ledarna korta så de ryms under väggarnas kabelspår (4 mm höga).
4. **Mata igenom:** löd 3 längre ledare på **första** LED:n (nedre raden, mitten),
   dra dem genom **genomföringshålet** vid nederkanten → ut på baksidan → in i
   ESP32-fickan. 5V + GND till strömmen, DIN till valfri GPIO (t.ex. GPIO 5).
5. **Testa alla 110 LEDs nu** — innan gallret skruvas fast!
6. **Skruva:** lägg cellgallret på plats (väggarna över LED-raderna, kabelnotcharna
   över lödtrådarna) och skruva **4× M3 självgängande (8–10 mm)** bakifrån genom
   bakstyckets hörnhål in i gallrets hörnstolpar.
7. **Diffuser** (frostad akryl/film ~198×180) vilar på väggarna. **Fronten** överst —
   limma/dubbelhäftande i kanterna (eller borra egna hål).
8. **ESP32** i fickan (USB nedåt), strömsladd i kabelkanalen rakt ned.
9. **Häng upp:** skruv i väggen (huvud ~3 mm ut) → haka på nyckelhålet → skjut ned.

Se `../3d-backplate-mini/cover_layout.svg` för bakstyckets layout.

---

## Köplista (det som INTE printas)

| Del | Spec | Ca pris |
|-----|------|---------|
| WS2812B LED-strip | 110 LEDs, 60/m, 5V (~2 m) | 100–200 kr |
| ESP32 | DevKit v1 (~28×52 mm) | 50–100 kr |
| Ström | 5V 3A, USB-C/DC | 50–100 kr |
| Diffuser | frostad akryl/opalfilm ~198×180 mm | 20–80 kr |
| M3 självgängande | 4 st, 8–10 mm | 20 kr |
| Väggskruv/krok | 1 st (huvud ≤ 8 mm) | — |

Filament: ~1 rulle svart räcker gott (~350–500 g totalt).

---

## Alternativ och regenerering

- Stencil-front: `cd ../frontplate-2color && node generate-stencil-front.js Mini`
- Tvådelad baksida: `node ../generate-backplate-mini.js`
- Alternativa fronter: AMS-tvåfärg (`../3d-frontplate-mini-2color/`) eller
  fönster + vinyl (`../3d-frontplate-mini/`)
