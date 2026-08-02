# Swedish Word Clock - Komplett 3D Print Byggguide

## Översikt

Hela klockan byggs med 18 printade delar + en köpt diffuserskiva.
Ingen laser behövs. Alla delar ryms på P2S (256x256x256mm).

```
      ┌─────────────────────────┐
      │    FRONTPANEL (svart)   │  ← 3mm, 9 sektioner, svart PLA
      │    med fyrkantiga hål   │
      ├─────────────────────────┤
      │    DIFFUSER (frostad)   │  ← 3mm, KÖP frostad akryl/plexiglas
      ├─────────────────────────┤
      │                         │
      │    BACKPLATE (svart)    │  ← 22mm, 9 sektioner, svart PLA
      │    med väggar + LED     │     väggar isolerar ljus mellan celler
      │    strip på botten      │     LED-strip ligger platt på basen
      │                         │
      └─────────────────────────┘
```

Totalt 3 lager. Separatorn som finns i laser-filerna behövs INTE -
backplatens 20mm väggar ger tillräcklig ljusisolering.


## Vad du ska PRINTA (18 delar)

### Backplate - 9 sektioner

Strukturen som håller LEDs och isolerar ljus. Har kabelnotchar i
väggarna för att dra LED-strippen mellan cellerna.

| Fil | Position | Celler | Storlek (mm) |
|-----|----------|--------|--------------|
| `backplate_section_0_0.stl` | Övre vänster | 4x4 | 183 x 183 x 22 |
| `backplate_section_1_0.stl` | Övre mitten | 4x4 | 183 x 183 x 22 |
| `backplate_section_2_0.stl` | Övre höger | 3x4 | 138 x 183 x 22 |
| `backplate_section_0_1.stl` | Mitten vänster | 4x3 | 183 x 138 x 22 |
| `backplate_section_1_1.stl` | Mitten mitten | 4x3 | 183 x 138 x 22 |
| `backplate_section_2_1.stl` | Mitten höger | 3x3 | 138 x 138 x 22 |
| `backplate_section_0_2.stl` | Nedre vänster | 4x3 | 183 x 138 x 22 |
| `backplate_section_1_2.stl` | Nedre mitten | 4x3 | 183 x 138 x 22 |
| `backplate_section_2_2.stl` | Nedre höger | 3x3 | 138 x 138 x 22 |

### Frontpanel - 9 sektioner

Den synliga framsidan med fyrkantiga fönster (37x37mm) per bokstav.

| Fil | Position | Celler | Storlek (mm) |
|-----|----------|--------|--------------|
| `frontplate_test_0_0.stl` | Övre vänster | 4x4 | ~198 x 198 x 3 |
| `frontplate_test_1_0.stl` | Övre mitten | 4x4 | ~183 x 198 x 3 |
| `frontplate_test_2_0.stl` | Övre höger | 3x4 | ~153 x 198 x 3 |
| `frontplate_test_0_1.stl` | Mitten vänster | 4x3 | ~198 x 138 x 3 |
| `frontplate_test_1_1.stl` | Mitten mitten | 4x3 | ~183 x 138 x 3 |
| `frontplate_test_2_1.stl` | Mitten höger | 3x3 | ~153 x 138 x 3 |
| `frontplate_test_0_2.stl` | Nedre vänster | 4x3 | ~198 x 153 x 3 |
| `frontplate_test_1_2.stl` | Nedre mitten | 4x3 | ~183 x 153 x 3 |
| `frontplate_test_2_2.stl` | Nedre höger | 3x3 | ~153 x 153 x 3 |

Obs: Frontpanel-sektioner med "0" i namnet (vänster/övre kant) har
15mm rambord utanför gittret. Största sektionen ~198mm - ryms på P2S.


## Vad du ska KÖPA

| Del | Specifikation | Var | Ca pris |
|-----|--------------|-----|---------|
| Diffuserskiva | 3mm frostad/opal akryl, ~530x490mm | Biltema, Bauhaus, plastleverantör | 50-150 kr |
| WS2812B LED-strip | 114 LEDs (60/m strip), 5V | Amazon, AliExpress | 100-200 kr |
| ESP32 | DevKit v1 eller liknande | Amazon, Electrokit | 50-100 kr |
| Strömförsörjning | 5V 3A USB-C eller DC | Amazon | 50-100 kr |
| M4 skruvar + muttrar | 4 st, ~30mm längd | Biltema | 20 kr |
| Distanser/spacers | 4 st, ~25mm (backplate-tjocklek) | Biltema, 3D-printa | 20 kr |
| Bokstäver | Vit vinyl, rubbon-letters, eller vit Posca-penna | Biltema, Amazon | 50-100 kr |
| Superlim/epoxy | För att limma ihop sektioner | Biltema | 30 kr |

**Totalt ca 400-800 kr** (utan filament)


## Skrivarinställningar

### Backplate (alla 9 sektioner)

```
Material:       Svart PLA
Lager-höjd:     0.20 mm
Väggar:         3 (väggarna är 3mm, blir helt solida)
Infill:         15-20% (bara basen, väggarna är redan solida)
Stöd:           JA - behövs för flikar (tabs) som sticker ut
Brim:           Ja (stor bottenyta, förhindrar warping)
Hastighet:      Normal (rekommenderad P2S-profil)
```

### Frontpanel (alla 9 sektioner)

```
Material:       Svart PLA (MÅSTE vara ogenomskinligt/opaque!)
Lager-höjd:     0.20 mm
Väggar:         99 (helt solid - bara 3mm tjock)
Infill:         100%
Stöd:           NEJ (platt del)
Brim:           JA (tunn platta behöver bra vidhäftning)
Hastighet:      Normal
```


## Material- och tidsuppskattning

| Komponent | Vikt (ungefär) | Printtid per sektion | Total printtid |
|-----------|---------------|---------------------|----------------|
| Backplate (9 st) | ~1.0-1.4 kg | 4-8 timmar | 36-72 timmar |
| Frontpanel (9 st) | ~0.3-0.4 kg | 1-2 timmar | 9-18 timmar |
| **Totalt** | **~1.3-1.8 kg** | - | **45-90 timmar** |

Tips: Slice den STÖRSTA sektionen (`backplate_section_0_0.stl`) först
i Bambu Studio for att få exakt material- och tidsuppskattning.
Multiplicera med 9 for en god approximation.

Du behöver ungefär **2 rullar svart PLA** (1 kg/rulle) for att vara säker.


## PRINTORDNING (följ denna exakt)

### Steg 1: Testa passform (1 sektion)
```
PRINTA: backplate_section_1_1.stl  (mitten-sektionen)
```
Varför: Mitten-sektionen har inga rambord, bara gitter. Snabbast
att printa. Testa att en WS2812B LED ryms i cellen, att vägghöjden
känns bra, och att kabelnotcharna fungerar. Om något behöver justeras
har du bara slösat en liten sektion.

### Steg 2: Alla backplate-sektioner (8 kvar)
```
PRINTA i denna ordning:
1. backplate_section_0_0.stl  (övre vänster - störst, printas först)
2. backplate_section_1_0.stl  (övre mitten)
3. backplate_section_2_0.stl  (övre höger)
4. backplate_section_0_1.stl  (mitten vänster)
5. backplate_section_2_1.stl  (mitten höger)
6. backplate_section_0_2.stl  (nedre vänster)
7. backplate_section_1_2.stl  (nedre mitten)
8. backplate_section_2_2.stl  (nedre höger)
```
Varför denna ordning: Ytterkants-sektioner först (de har rambord),
sedan inre. Så fort 2-3 sektioner är klara kan du börja testa att
snäppa ihop dem med flikarna.

### Steg 3: Limma ihop backplaten
```
Snäpp ihop alla 9 sektioner med flikarna (tabs).
Limma skarvarna med superlim eller epoxy.
Låt torka minst 2 timmar.
```

### Steg 4: Montera LED-strip i backplaten
```
Lägg LED-strippen i snake-mönster:
  Rad 0: vänster → höger
  Rad 1: höger → vänster
  Rad 2: vänster → höger
  ... osv

Strippen ligger PLATT på basen i varje cell.
Dra tråden genom kabelnotcharna (4x5mm) i väggarna.
Limma fast strippen med medföljande tejp eller lim.
```

### Steg 5: Testa LEDs
```
Koppla in ESP32 + ström.
Kör ett testprogram som tänder alla 114 LEDs.
Kontrollera att varje cell lyser.
```
Gör detta INNAN du printar frontpanelen!

### Steg 6: Alla frontpanel-sektioner (9 st)
```
PRINTA i denna ordning:
1. frontplate_test_0_0.stl  (övre vänster - störst, med rambord)
2. frontplate_test_1_0.stl  (övre mitten)
3. frontplate_test_2_0.stl  (övre höger)
4. frontplate_test_0_1.stl  (mitten vänster)
5. frontplate_test_1_1.stl  (mitten mitten)
6. frontplate_test_2_1.stl  (mitten höger)
7. frontplate_test_0_2.stl  (nedre vänster)
8. frontplate_test_1_2.stl  (nedre mitten)
9. frontplate_test_2_2.stl  (nedre höger)
```

### Steg 7: Limma ihop frontpanelen
```
Frontpanelen har INGA flikar (till skillnad från backplaten).
Limma sektionerna på en plan yta (bord/glasskiva) så de blir jämna.
Slipa skarvarna försiktigt med fint sandpapper (220-grit).
Valfritt: spraymåla frontpanelen svart för en slätare finish.
```

### Steg 8: Slutmontering
```
Lägg delarna i denna ordning (botten till topp):

1. BACKPLATE (ihoplimmad, med LEDs monterade)
2. DIFFUSER (frostad akrylskiva, ligger på backplatens väggar)
3. FRONTPANEL (ihoplimmad, ligger på diffusern)

Skruva ihop med M4-skruvar genom monteringshålen i hörnen.
Använd distanser/spacers mellan backplate och frontpanel.
```


## Sektionslayout (sett framifrån)

```
          Kolumn 0       Kolumn 1       Kolumn 2
          (4 celler)     (4 celler)     (3 celler)

Rad 0    ┌──────────┬──────────┬────────┐
(4 c.)   │  [0,0]   │  [1,0]   │ [2,0]  │
         │  4x4     │  4x4     │  3x4   │
         │  K L O C │ K A N V  │ H Ä R  │
         │  S F E M │ I S T I  │ O N A  │
         │  T J U G │ O M I E  │ S N D  │
         │  K V A R │ T B Ö V  │ E R G  │
         ├──────────┼──────────┼────────┤
Rad 1    │  [0,1]   │  [1,1]   │ [2,1]  │
(3 c.)   │  4x3     │  4x3     │  3x3   │
         │  L I A H │ H A L V  │ Ö T P  │
         │  E T T R │ T V Å L  │ S N D  │
         │  T R E N │ F Y R A  │ O S T  │
         ├──────────┼──────────┼────────┤
Rad 2    │  [0,2]   │  [1,2]   │ [2,2]  │
(3 c.)   │  4x3     │  4x3     │  3x3   │
         │  F E M B │ S E X O  │ S J U  │
         │  Å T T A │ M N I O  │ D E K  │
         │  E L V A │ T O L V  │ T I O  │
         └──────────┴──────────┴────────┘
```


## Bokstäver

Frontpanelen har bara fyrkantiga fönster - inga bokstäver.
Du behöver lägga till dem själv. Tre alternativ:

### Alt 1: Vita vinyl-bokstäver (REKOMMENDERAT)
- Köp vita vinyl rub-on bokstäver (Amazon: "white vinyl letter stickers")
- Eller beställ vinyl-skurna bokstäver online (t.ex. Pixiprint)
- Placera en bokstav centrerat ovanför varje fönster på frontpanelen
- Ren, proffsig look

### Alt 2: Vit Posca-penna
- Köp en vit Posca paint marker (PC-5M, medium)
- Skriv/måla bokstäverna direkt på den svarta frontpanelen
- Använd en mall/stencil for jämna bokstäver
- Snabbt och enkelt, men svårare att få perfekt

### Alt 3: 3D-printa bokstäver i vitt PLA
- Printa tunna (1mm) bokstavsplattor i vitt PLA
- Limma fast dem på frontpanelen ovanför varje fönster
- Mest jobb, men ger upphöjd effekt

Bokstavslayout (en bokstav per fönster, 11x10 grid):
```
K L O C K A N  Ä R
  F E M I S T I O N A
T J U G O M I E S N D
K V A R T   Ö V E R
  I   H H A L V Ö T
E T T R T V Å L S N D
T R E N F Y R A O S T
F E M   S E X O S J U
Å T T A M N I O D E K
E L V A T O L V T I O
```


## Tips för bästa resultat

1. **Slipa skarvarna** - Använd 220-grit sandpapper på alla skarvar
   mellan sektioner. Fokusera på frontpanelen - den syns!

2. **Spraymåla frontpanelen** - 2-3 lager matt svart sprayfärg döljer
   lager-linjer och skarvar. Maskera fönstren med tejp först.

3. **Foam-tape på väggtoppar** - Lägg tunn foam-tape (1mm) på
   backplatens väggtoppar innan du lägger diffusern. Förhindrar
   ljusläckage vid skarvar.

4. **Testa diffuser-avstånd** - Diffusern ska ligga direkt på
   backplatens väggar (20mm från LED). Om ljuset är för fokuserat,
   lägg till ytterligare en tunn diffuserfilm.

5. **Kalibrera P2S:en** - Kör en kalibreringskub (20x20mm) innan du
   startar. Sektionerna måste passa ihop exakt.

6. **Print backplate upprätt?** - Nej! Printa med basen nedåt (som det
   är orienterat i STL-filen). Väggarna printas uppåt.
