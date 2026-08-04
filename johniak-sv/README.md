# johniak-sv — svensk version av johniaks Word Clock

Svensk remix av [johniak/word-clock](https://github.com/johniak/word-clock)
(Makerworld: "Word Clock"). Behåller originalets fysiska gränssnitt exakt —
yttermått 187×179 mm, 13,51 mm cellpitch (= 74 LEDs/m-strip), samma serpentin-
LED-ordning — så att originalets monteringsmetod, elektronikbox och firmware-bas
fungerar rakt av. Bara bokstäverna, layouten och tidslogiken är svenska.

**Varför den här basen:** cellavstånd = LED-avstånd → **hela obrutna stripremsor
per rad** (lödning bara vid radslut, ~30 punkter). Bokstäverna fylls med
**transparent filament** (AMS, printed in place) — inga bryggor, riktiga
bokstavsformer, och prime tower ryms gott på en 256-bädd (plattan är 187 bred).

## Layout (11×10 = 110 celler — simulatorns exakta matris)

**Tecken för tecken identisk med simulatorn** (`index.html`), inga tillagda
utfyllnadsbokstäver. Generatorn läser simulatorns `GRID_LETTERS` vid varje
körning och vägrar bygga om en enda cell avviker.

```
K L O C K A N V H Ä R      KLOCKAN ÄR
S F E M I S T I O N A      FEM TIO (minuter)
T J U G O M I E S N D      TJUGO
K V A R T B Ö V E R G      KVART ÖVER
L I A H H A L V Ö T P      I HALV
E T T R T V Å L S N D      ETT TVÅ
T R E N F Y R A O S T      TRE FYRA
F E M B S E X O S J U      FEM SEX SJU
Å T T A M N I O D E K      ÅTTA NIO
E L V A T O L V T I O      ELVA TOLV TIO
```

Valideras dessutom vid varje generering: ordpositioner, alla 288
femminuterstider, läsordning (rad OCH kolumn inom rad), LED-kollisioner.

## Generera

```bash
npm install
node generate.js            # Arial (störst bokstäver). Byt: node generate.js C:\Windows\Fonts\<font>.ttf
```

Utdata:
| Fil | Vad | Filament |
|---|---|---|
| `out/topshell_sv_body.stl` | Front + cellgaller i ett (187×179×12) | SVART (opak) |
| `out/topshell_sv_letters.stl` | Bokstäverna, fyller fronten (2,5 mm djup) | **TRANSPARENT** |
| `out/backplate_sv.stl` | Bakplatta med M3-hål + tratt-krok för vägg | SVART |
| `out/backplate_sv_markers.stl` | Strip-markeringsband, 10 st i plattans stripyta | **VIT/kontrast** |
| `out/preview.svg` | Visuell kontroll av layouten | — |
| `firmware/words_sv.h` | Genererad LED-tabell till firmware-patchen | — |

Ingen extern elektronikbox behövs — **ESP32:n sitter i en ficka på bakplattans
baksida** (skenor + ändstopp, USB nedåt mot kabelkanalen). Bakplattan har även
**tratt-krok** (fångar väggskruven själv), **stödkuddar** (hänger plant), **genomföringshål** för
LED-kablarna vid LED 0, och **piggslitsar**: tre piggar på skalets gallerväggar
går ner i slitsarna så plattan självcentrerar — de fyra M3-skruvarna klämmer.
Layout: `out/backplate_layout.svg`.

## Printa (Bambu Studio)

1. **Top Shell:** importera `topshell_sv_body.stl` + `topshell_sv_letters.stl`
   TILLSAMMANS (svara **Ja** på "single object with multiple parts"). Body →
   filament 1 (svart, opak). Letters → filament 2 (**transparent** PLA — inte vit!).
   Framsidan nedåt. 0.2 mm, inga stöd, brim. Prime tower får plats bredvid.
   > **Obs:** i slicern (uppifrån) läses bokstäverna **baklänges** — det är
   > meningen (samma som originalet). Fronten printas mot plåten, så underifrån/
   > framifrån blir de rättvända. Färgbytena sker bara i de nedersta 2,5 mm.
2. **Bakplatta:** importera `backplate_sv.stl` + `backplate_sv_markers.stl`
   TILLSAMMANS (single object with parts). Plattan → svart, markerings-delen →
   **vit/valfri kontrastfärg** — det blir tio band i första lagret som visar
   exakt var varje LED-rad ska klistras. **Strip-sidan (märkta) nedåt**,
   fickan/kuddarna uppåt. 0.2 mm, brim, inga stöd.
   Utan AMS: skippa marker-filen — banden blir då 0,2 mm försänkta spår istället.

## Montera

1. Klipp 74/m-strippen i **10 hela rader à 11 LEDs** (klipp INTE mellan LEDs i
   raden). Max 10 mm bred strip — piggslitsarna går 0,4 mm från stripkanterna.
2. Klistra raderna **exakt i de tio markerade banden** på plattans stripyta —
   ett band = en rads fotavtryck, inget mätande behövs. **LED 0 (data in) =
   raden närmast genomföringshålet, börja vid hålet**; den raden går bort från
   hålet, serpentin vidare rad för rad.
3. Löd 5V/GND/DIN mellan radsluten (looparna hamnar utanför gridfältet — de ryms
   i kanalen mellan cellgallret och ytterväggen).
4. Löd tre längre ledare på LED 0 och dra dem genom **genomföringshålet** strax
   ovanför (i högerkanalen) → till **ESP32-fickan** på baksidan. 5V + GND till
   strömmen, DIN till GPIO enligt originalets wiring-guide (`docs/device_build.md`).
   ESP32:n glider in i fickan med USB nedåt; en klick limpistol om den sitter löst.
5. **Stäng klockan:** lägg plattan på skalet — de tre **piggarna** (sitter
   fast på skalets gallerväggar, printas ihop med skalet) går ner i slitsarna
   (passar bara åt rätt håll) — och skruva **4× M3 självgängande** genom
   plattans hörnhål in i skalets **hörnpelare** (bossarna).
   > Skruvkanalerna i pelarna är **fyrkantiga med flit** (2,7 mm): M3-skruven
   > pressas/gängas rakt i och biter i de fyra plansidorna — fyrkantigt
   > spricker mindre än runt i print. Alternativ: superlimma plattan mot
   > väggtopparna — men först när ALLT är testat (LEDs + firmware); en limmad
   > klocka går inte att öppna för service.
   Strömsladden går från fickan (nere på baksidan) mellan kabelstöden och
   rakt ut under klockans underkant — kortast möjliga, syns inte framifrån.
6. Häng upp: skruv/spik i väggen med huvudet ~3–4 mm ut. Håll klockan mot väggen ungefär rätt och dra nedåt — **tratt-kroken** fångar skruven, centrerar den själv och låser huvudet bakom läppen. Eller ställ den på bord.
7. Firmware: se [`firmware/PATCH.md`](firmware/PATCH.md).

## Köplista

| Del | Spec |
|---|---|
| WS2812B-strip | **74 LEDs/m**, 2 m (110 LEDs + marginal), 5V, max 10 mm bred |
| ESP32 | DevKit v1 (~28×52 mm — fickan är måttad för den) |
| Transparent PLA | till bokstäverna (AMS filament 2) |
| Svart PLA | skal + bakplatta |
| Ström | 5V 3A |
| M3 självgängande | 4 st 8–10 mm (bakplatta → skalets bossar) |
| Väggskruv/spik | 1 st, huvud ≤ 9 mm, ~3–4 mm från väggen (tratt-kroken) |

## Äldre byggvarianter

Tidigare byggspår är borttagna ur trädet men finns kvar i git-historiken
(commiten före städningen).
