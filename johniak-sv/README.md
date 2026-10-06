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
| `out/backplate_sv.stl` | Bakplatta: 12,5 mm ram, ESP32-bay, tratt-krok | SVART |
| `out/backplate_sv_markers.stl` | Strip-markeringsband, 10 st i plattans stripyta | **VIT/kontrast** |
| `out/preview.svg` | Visuell kontroll av layouten | — |
| `out/topshell_walls.svg` | Skalets väggar bakifrån: kabelslitsar + stripurtag | — |
| `firmware/words_sv.h` | Genererad LED-tabell till firmware-patchen | — |

Ingen extern elektronikbox behövs. Bakplattans baksida har en **ram runt hela
kanten, 2 mm bred och 12,5 mm hög** — klockan hänger på den, och lådan den
bildar är elektronikutrymmet. Ramen är 2 mm bred med flit: M3-hålen sitter
4,3–7,7 mm in från kanten, så ett ~6 mm skruvhuvud når 3 mm in — en bredare ram
och huvudet hade inte gått ner bredvid.

I lådan finns **ESP32-bay** (skenor + ändstopp runt en 1,8 mm hög limplatta),
**tratt-krok** som fångar väggskruven själv, **genomföringshål** för LED-kablarna
vid LED 0, och **piggslitsar**: tre piggar på skalets gallerväggar går ner i
slitsarna så plattan självcentrerar — de fyra M3-skruvarna klämmer. Nertill i
ramen är en **13 mm öppning** för USB-C-kontakten (10,5 mm + marginal), full
ramhöjd så kabeln läggs rakt i. Layout: `out/backplate_layout.svg`.

Höjdbudgeten i lådan är knapp och värd att räkna på innan du printar:

| Från plattan | Vad |
|---|---|
| 1,8 mm | limplattans topp |
| 5,0 mm | kortets ovansida (vilar på metallburken/USB-kontakten) |
| 3,4 mm | USB-C-uttagets mitt — därför klarar kontaktens gjutning plattan |
| 6,6 mm | kortets undersida, dit skenorna (7,5 mm) håller det på plats |
| ~12,6 mm | stiftlistens spetsar, om kortet har lödda listar |

Ramen är 12,5 mm. Har ditt kort lödda stiftlistor som sticker ut 6 mm nålar de
alltså precis i väggen — klipp dem korta, eller höj `RIM_H`.

Skalet är i sin tur urfräst för kablaget — allt uppifrån, öppet mot plattan, så
den färdiglödda plattan kan läggas rakt ner utan att något behöver träs igenom:

| Urtag | Var | Mått | Till vad |
|---|---|---|---|
| Stripurtag | topp av **varje** kolumnvägg, en per rad | 11 × 2,2 mm | stripens PCB korsar väggen (LEDsen sitter i cellcentrum, PCB:n pluggar igen urtaget) |
| Kabelslits | de **två yttre** kolumnväggarna, en per rad, båda sidor | 8 × 6 mm | serpentinens 3 ledare (5V/GND/DATA) ut i sidokanalen |
| Matningsslits | vid **LED 0** | 10 × 8 mm | 5 ledare + krympslangsknölen, rakt mot genomföringshålet |

Sidokanalen mellan cellgallret och ytterväggen är 16,2 mm bred och 9,5 mm djup
hela vägen — där ligger looparna. Se `out/topshell_walls.svg`.

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
3. Löd 5V/GND/DIN mellan radsluten. Looparna hamnar utanför gridfältet: de går
   ut genom **kabelslitsen** i den yttre kolumnväggen (8 × 6 mm, en per rad på
   båda sidor) och ligger i sidokanalen mellan cellgallret och ytterväggen.
4. Löd matningen på LED 0 och dra den genom **matningsslitsen** (10 × 8 mm, den
   breda) och vidare ut genom **genomföringshålet** (12 × 10 mm) i plattan strax
   bredvid → till **ESP32-fickan** på baksidan. Där ryms 5 ledare plus knölen
   från krympslangen. 5V + GND till
   strömmen, DIN till GPIO enligt originalets wiring-guide (`docs/device_build.md`).
   ESP32:n läggs i bayen med **metallburken nedåt mot limplattan** och USB-C
   nedåt; superlim på burken. Skenorna tar sidorna, ändstoppet toppen.
5. **Stäng klockan:** lägg plattan på skalet — de tre **piggarna** (sitter
   fast på skalets gallerväggar, printas ihop med skalet) går ner i slitsarna
   (passar bara åt rätt håll) — och skruva **4× M3 självgängande** genom
   plattans hörnhål in i skalets **hörnpelare** (bossarna).
   > Skruvkanalerna i pelarna är **fyrkantiga med flit** (2,7 mm): M3-skruven
   > pressas/gängas rakt i och biter i de fyra plansidorna — fyrkantigt
   > spricker mindre än runt i print. Alternativ: superlimma plattan mot
   > väggtopparna — men först när ALLT är testat (LEDs + firmware); en limmad
   > klocka går inte att öppna för service.
   Strömsladden går från bayen mellan kabelstöden och ut genom ramens
   **USB-öppning** under klockans underkant — kortast möjliga, syns inte framifrån.
6. Häng upp: skruv/spik i väggen med huvudet ~3–4 mm ut. Håll klockan mot väggen ungefär rätt och dra nedåt — **tratt-kroken** fångar skruven, centrerar den själv och låser huvudet bakom läppen. Eller ställ den på bord.
7. Firmware: se [`firmware/PATCH.md`](firmware/PATCH.md).

## Köplista

| Del | Spec |
|---|---|
| WS2812B-strip | **74 LEDs/m**, 2 m (110 LEDs + marginal), 5V, max 10 mm bred |
| ESP32 | DevKit v1 (52 × 28,7 mm — bayen är måttad exakt för den) |
| Superlim | fäster ESP32:ns metallburk mot limplattan |
| Transparent PLA | till bokstäverna (AMS filament 2) |
| Svart PLA | skal + bakplatta |
| Ström | 5V 3A |
| M3 självgängande | 4 st 8–10 mm (bakplatta → skalets bossar) |
| Väggskruv/spik | 1 st, huvud ≤ 9 mm, ~3–4 mm från väggen (tratt-kroken) |

## Äldre byggvarianter

Tidigare byggspår är borttagna ur trädet men finns kvar i git-historiken
(commiten före städningen).
