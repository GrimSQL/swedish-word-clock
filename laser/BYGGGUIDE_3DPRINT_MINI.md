# Swedish Word Clock — Mini (3D-print, EN bit)

Komprimerad variant av det stora bygget (se `BYGGGUIDE_3DPRINT.md`).
Här ryms hela klockan i **3 printade delar** istället för 18 — varje del skrivs
ut i en enda bit på P2S (256×256×256mm), allt i svart, ingen AMS.

```
   ┌───────────────────────┐
   │  FRONT (svart)        │  ← 3mm, stencil: bokstäverna = öppna hål
   ├───────────────────────┤     (bryggor håller fast mitten i O/A/Ö, som QlockTwo)
   │  DIFFUSER (frostad)   │  ← ~198×180mm frostad akryl / opalfilm
   ├───────────────────────┤
   │  CELLGALLER (väggar)  │  ← 12mm, bara väggar — läggs över LED:erna
   ├───────────────────────┤
   │  BAKSTYCKE            │  ← 2,5mm platta: LED-slingan löds öppet här.
   └───────────────────────┘     Baksidan: nyckelhål (väggkrok), ESP32-ficka,
                                 kabelkanal nedåt. Gallret skruvas fast med 4× M3.
```

Skala: **18mm pitch**, bokstäver ~10,8mm (auto-anpassade så Å/Ä/Ö ryms). 110 lysande celler
(nearest-5-min, inga hörnprickar — går att lägga till senare om du vill).


## Vad du PRINTAR

**Baksida** (två delar — LED:erna monteras öppet på bakstycket, gallret skruvas på):

| Fil | Del | Mått (mm) | Stöd | Brim |
|-----|-----|-----------|------|------|
| `3d-backplate-mini/backplate_mini_grid.stl` | Cellgaller (väggar, hörnstolpar med skruvkanaler) | 214 × 196 × 12 | Nej | Ja |
| `3d-backplate-mini/backplate_mini_cover.stl` | Bakstycke (LED-platta + nyckelhål + ESP32-ficka + kabelkanal) | 214 × 196 × 8,5 | Nej | Ja |

Bakstyckets layout: `3d-backplate-mini/cover_layout.svg`.

**Front** — välj en:

| Fil | Del | Mått (mm) | Kräver |
|-----|-----|-----------|--------|
| **`3d-frontplate-mini-stencil/frontplate_mini_stencil.stl` (VALD)** | Stencil: bokstäverna = öppna hål med bryggor (QlockTwo-stil), EN färg | 214 × 196 × 3 | — |
| `3d-frontplate-mini-2color/frontplate_mini_2color_body.stl` + `..._letters.stl` | Tvåfärg, translucenta bokstäver i plasten | 214 × 196 × 3 | AMS (2 filament) |
| `3d-frontplate-mini/frontplate_mini.stl` | Enkel front (fyrkantiga fönster) + separat mask | 216,5 × 198,5 × 3 | — |

Regenerera vid behov:
```
node generate-backplate-mini.js                                              # tvådelad baksida
node generate-frontplate-test.js Mini                                        # enkel fönsterfront
cd frontplate-2color && npm install && node generate-stencil-front.js Mini   # stencil (vald)
cd frontplate-2color && node generate-2color.js Mini                         # tvåfärg AMS
```

### Skrivarinställningar

**Cellgaller:** svart PLA · 0.20mm lager · **inga stöd** · brim · printas som
orienterad (väggarna uppåt).

**Bakstycke:** svart PLA · 0.20mm · 15–20% infill · **inga stöd** (nyckelhålets
tak är en kort bro, det klarar skrivaren) · brim · platta LED-sidan NEDÅT,
fästena uppåt.

**Front:** svart PLA — MÅSTE vara opak! · 0.20mm · 100% infill · inga stöd ·
**brim** · framsidan nedåt (första lagret = synliga ytan).

Grov uppskattning: galler ~3–6h, bakstycke ~2–4h, front ~2–4h, ~350–500g totalt.
Slica i Bambu Studio för exakt siffra.


## Vad du KÖPER

| Del | Spec (mini) | Ca pris |
|-----|-------------|---------|
| Diffuser | 3mm frostad akryl ~198×180mm (eller bakplåtspapper för test) | 20–80 kr |
| WS2812B | 110 LEDs, 60/m strip (~2m) | 100–200 kr |
| ESP32 | DevKit v1 e.d. | 50–100 kr |
| Ström | 5V 2–3A USB-C/DC | 50–100 kr |
| Bokstäver | Vit vinyl / vit Posca (PC-5M) / utskriven OH-film | 50–100 kr |
| M3 självgängande | 4st 8–10mm (galler ↔ bakstycke) | 20 kr |
| Väggskruv/krok | 1st, huvud ≤8mm (nyckelhålsfästet) | — |


## Bokstäver

**Stencil-front (VALD):** bokstäverna är **öppna hål rakt genom** den svarta plattan,
precis som QlockTwo. Fonten (Allerta Stencil) har inbyggda **bryggor** i O, A, Ä, R,
D, Ö, P, Å, B så att mittbitarna sitter fast i plattan — inget lossnar, inga lösa öar.
Ljuset lyser genom hålen mot diffusern direkt bakom (diffusern är det man ser i
bokstäverna, så den är viktig). EN färg, ingen AMS, inget prime tower.
Genereras av `frontplate-2color/generate-stencil-front.js`:

1. Importera `frontplate_mini_stencil.stl`, framsidan **nedåt** mot plåten.
2. Svart **opak** PLA, 0.2 mm lager, 100% infill, brim, inga stöd.
3. Slajsa → zooma in på O/A/R i förhandsvisningen och kolla att de små bryggorna
   (~0,6 mm) printas. Printa.

Byt font: `node generate-stencil-front.js Mini "sökväg\till\annan-stencilfont.ttf"`
(måste vara en stencil-font med bryggade konturer — skriptet vägrar annars, med
en lista över vilka bokstäver som skulle tappa sina mittbitar).

**Tvåfärgsfront (alternativ, AMS):** translucenta bokstäver (1,2 mm) inbakade i
svart kropp — inga öppna hål. `generate-2color.js`, kräver AMS + prime tower.
Detaljer i `PRINTA-MINI/README.md`-historiken eller skriptets utskrift.

**Enkel fönsterfront (alternativ):** fyrkantiga fönster + bokstäver som vit vinyl /
OH-film (`wordclock-grid-Mini.svg`) eller vinyl-stencil (`wordclock-stencil-Mini.svg`).


## LED-montering (öppet på bakstycket — det är hela poängen med två delar)

1. **Markera:** lägg cellgallret löst på bakstyckets släta sida som mall,
   blyertspricka varje cellmitt, lyft bort gallret.
2. Kapa 60/m-strippen i **110 enskilda segment**. Klistra ett segment per prick.
   Snake-mönster: rad 0 vänster→höger, rad 1 höger→vänster, osv — pilarna på
   strippen ska följa slingans riktning.
3. **Löd 5V/GND/DIN** mellan segmenten — allt ligger platt och åtkomligt.
   Korta ledare, de ska rymmas i väggarnas kabelnotchar (5×4mm).
4. Löd 3 längre ledare på första LED:n (nedre raden, kolumn 6) och dra dem genom
   **genomföringshålet** vid nederkanten → baksidan → ESP32-fickan.
5. **Testa alla 110 LEDs INNAN gallret skruvas på.**


## Slutmontering

1. **Cellgaller på bakstycket:** väggarna landar mellan LED-raderna, notcharna
   över lödtrådarna. Skruva **4× M3 självgängande (8–10mm)** bakifrån genom
   bakstyckets hörnhål in i gallrets hörnstolpar.
2. **Diffuser** (frostad, ~198×180) vilar på väggtopparna → **front** överst,
   limma/dubbelhäftande i kanterna. Tunn foam-tape på väggtopparna minskar
   ljusläckage mellan celler.
3. **ESP32** in i fickan på baksidan (USB nedåt), strömsladden i kabelkanalen
   rakt ned förbi underkanten.
4. **Häng upp:** skruv i väggen med huvudet ~3mm ut → haka på **nyckelhålet**
   (uppe i mitten på baksidan) → skjut ned. Hörnkuddarna gör att den hänger plant.

Firmware och tidslogik är oförändrade — samma ESP32/NTP-setup som stora bygget.
