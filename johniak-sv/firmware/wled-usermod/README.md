# WLED-usermod: svensk ordklocka

Firmwaren som faktiskt sitter i klockan. WLED 16.0.1 plus en usermod som visar
svensk tid i ord på 11 × 10-matrisen.

## Filerna här

| Fil | Vad |
|---|---|
| `usermod_v2_word_clock_sv.cpp` | Själva usermoden |
| `library.json` | Krävs för att PlatformIO ska hitta den |
| `platformio_override.ini` | Byggmiljön `ordklockan` |

## Hur den fungerar

Usermoden **släcker** bara de LEDs som inte ingår i aktuell tid. Effekten som
körs målar bokstäverna. Därför fungerar alla WLED:s 2D-effekter fortfarande —
`Klockläge` är solid varmvit, men `Regnbågsklocka` låter Hiphotic lysa genom
orden.

Två fällor som kostade felsökningstid, båda dokumenterade i koden:

**Indexrummet.** Orden anges i **rad och kolumn**, inte i LED-nummer. WLED:s
pixelbuffert indexeras i läsordning (`FX.h:900`, `_pixels[n]`), och serpentinen
läggs på först när bufferten går ut på bussen. En tabell med fysiska LED-index —
som `../words_sv.h` innehåller — sprider orden över hela plattan.

**Presets kan inte bära klockläget.** `savePreset` anropar `serializeState` med
`forPreset=true`, och `UsermodManager::addToJsonState` ligger innanför
`if (!forPreset)`. Klockläget sätts därför från Home Assistant i stället, med ett
REST-anrop mot `/json/state`. Se `packages/ordklockan.yaml` i HA-konfigen.

## Patch i WLED-kärnan: Toki är inte trådsäker

**Måste läggas på igen efter varje ny WLED-klon.** Utan den går klockan fel med
jämna mellanrum, och felet är svårt att se: den tappar inte en sekunds takt, den
byter bara utgångspunkt.

`Toki::millisecond()` (`wled00/src/dependencies/toki/Toki.h`) rullar `unix`
framåt till nuvarande sekund. På ESP32 anropas den från **två tasks** — Arduino-
loopen via `handleTime()` och AsyncTCP-tasken via `/json` → `serializeInfo()` →
`getTimeString()` → `updateLocalTime()`. Originalet gör en oskyddad
läs-ändra-skriv i en loop:

```cpp
uint32_t ms = millis() - fullSecondMillis;
while (ms > 999) { ms -= 1000; fullSecondMillis += 1000; unix++; }
```

Krockar taskarna tappas en `+= 1000`. Då hamnar `fullSecondMillis` **före**
`millis()`, nästa subtraktion underflödar till ~2^32 ms, och while-loopen lägger
på **49 dygn 17:02:47** i ett svep. Natten till 3 sep 2026 hände det två gånger:
väggen låg 8 589 934 s = exakt 2 × 2^32 ms fel. Eftersom ordklockan är
12-timmars såg det ut som ett fullt rimligt klockslag — 15:40 lyser som
`TJUGO I FYRA`. Och eftersom enheten NTP-synkar var 11,7:e timme stod felet kvar
hela natten.

Vad som triggar det här är dashboarden: två REST-sensorer pollar `/json/info`
var 15:e sekund och HA:s WLED-integration håller en WebSocket öppen. Varje
sådant anrop går in i Toki från fel task.

Patchen ligger i [`toki-threadsafe.patch`](toki-threadsafe.patch) och läggs på
med `git apply` från WLED-klonens rot. Tre ändringar i `millisecond()`, plus
samma lås i `setTime()`:

| Ändring | Varför |
|---|---|
| `portMUX` kring uppdateringen | uppdateringen kan inte tappas |
| `int32_t delta`, negativ ⇒ ställ om | en `fullSecondMillis` före `millis()` är omöjlig som förfluten tid — ställ om i stället för att wrappa |
| division i stället för loop | ett aritmetiskt snedsteg får aldrig kosta 4,29 miljoner varv igen |

En riktig `millis()`-rollover räknas fortfarande som förfluten tid — det är
modulär aritmetik och `delta` blir positiv.

Verifiera patchen på datorn, utan hårdvara. Testet ligger i
[`../../tools/toki-test/`](../../tools/toki-test/) och **inte** här bredvid —
allt i den här katalogen kopieras in i WLED-bygget, och en `main()` plus en
`Arduino.h`-stubbe där hade sabbat kompileringen:

```bash
cd johniak-sv/tools/toki-test
cp <WLED-klonen>/wled00/src/dependencies/toki/Toki.h .
g++ -std=c++17 -O1 -Wall -I. -o test_toki test_toki.cpp && ./test_toki
```

Testet kör originalkoden bredvid den patchade och visar hoppet den gör:
`unix +4294966 s = 49.7103 days`. Alla fem kontroller ska bli PASS.

Home Assistant har dessutom ett skyddsnät oavsett firmware: automationen
*Ordklockan – rätta tiden om den glidit* jämför `sensor.ordklockan_klocka` med
HA:s tid var femte minut och skickar rätt tid om de skiljer mer än en minut.

## Bygga och flasha

WLED-klonen ligger **utanför** det här repot, i
`Documents/Visual Studio Code/wled-ordklocka/WLED`.

```bash
git clone --depth 1 --branch v16.0.1 https://github.com/wled/WLED.git
cd WLED
cp -r <detta repo>/johniak-sv/firmware/wled-usermod usermods/usermod_v2_word_clock_sv
cp usermods/usermod_v2_word_clock_sv/platformio_override.ini .
git apply usermods/usermod_v2_word_clock_sv/toki-threadsafe.patch
pio run -e ordklockan
```

Binären hamnar i `build_output/release/WLED_16.0.1_ESP32.bin` (~1,26 MB, 80 % av
flashen).

OTA-flash kräver att subnätsspärren öppnas tillfälligt — klockan sitter på
IoT-VLAN `192.168.30.x` och din dator på `192.168.10.x`, och WLED avvisar
uppladdning från annat subnät med `401 Client is not on local subnet`:

```bash
curl -X POST -H "Content-Type: application/json" -d '{"ota":{"same-subnet":false}}' http://192.168.30.17/json/cfg
curl -F "update=@build_output/release/WLED_16.0.1_ESP32.bin" http://192.168.30.17/update
curl -X POST -H "Content-Type: application/json" -d '{"ota":{"same-subnet":true}}' http://192.168.30.17/json/cfg
```

Sista raden är inte valfri. Sätt tillbaka spärren.

## Inställningar

Under *Config → Usermods → Ordklockan*:

| Fält | Betyder |
|---|---|
| `active` | Startvärde vid boot. Löpande styrning sker via `/json/state` |
| `visa KLOCKAN AR` | Håll `KLOCKAN ÄR` alltid tänt |

## Visningslägen

Ett fält, inte flera flaggor. Två booleans (klocka + hjärta) hade kunnat vara
påslagna samtidigt och slåss om masken; ett läge kan inte stå i konflikt med sig
självt.

| Läge | Visar |
|---|---|
| `klocka` | tiden i ord |
| `hjarta` | ett hjärta |
| `stjarna` | en stjärna |
| `gran` | en gran |
| `snoflinga` | en snöflinga |
| `katt` | ett kattansikte |
| `blixt` | en blixt |
| `utrop` | ett utropstecken |
| `tal` | tvåsiffrig display, −99…99 (kräver `varde`) |
| `nedrakning` | nedräkning i sekunder (kräver `varde`) |
| `av` | ingenting maskas — hela matrisen är fri åt effekten |

```bash
curl -X POST -H "Content-Type: application/json" -d '{"Ordklockan":{"mode":"hjarta"}}' http://192.168.30.17/json/state
```

`{"on":true|false}` finns kvar som alias mot `klocka`/`av`.

Figurerna definieras som ASCII i källkoden, en rad per matrisrad:

```cpp
const char *heart[WC_HEIGHT] = {
  "...........",
  "..##...##..",
  ".####.####.",
  ...
```

Så en ny figur är tio rader text plus en rad i `SHAPES`. Inga index att räkna,
och formen syns i koden.

## Siffror

Timer, temperatur och nedräkning är samma sak i firmwaren: **en tvåsiffrig
display**. Siffrorna är 4 breda och 7 höga, så två får plats bredvid varandra på
elva kolumner med en kolumns mellanrum.

```bash
curl ... -d '{"Ordklockan":{"mode":"tal","varde":-15}}'
```

Negativa tal skjuter siffrorna ett steg åt höger och lägger minustecknet på
kolumn 0–1. Det går jämnt ut på elva kolumner, vilket är varför minusgrader
fungerar utan att något klipps. Värden utanför −99…99 klampas.

**Nedräkningen tickar i firmwaren**, inte över nätet. `{"mode":"nedrakning",
"varde":300}` startar fem minuter; ESP32:n räknar ner en gång per sekund och
Home Assistant behöver inte skicka nittionio anrop. Den fortsätter dessutom om
HA startas om. Sekunder kvar syns i `/json/state` under `Ordklockan.varde`.

Två siffror räcker inte till MM:SS, så displayen visar det mest exakta som får
plats: **sekunder så länge de ryms i två siffror**, annars minuter uppåt
avrundat.

Gränsen går vid **99, inte vid 60**. Med 60 skulle en nedräkning från 99 s visa
`2` — riktigt enligt regeln, fel enligt förväntan. En femminuterstimer visar
alltså `5, 4, 3, 2` och växlar sedan till sekunder vid 99 och räknar ner till
noll.

Eftersom usermoden bara *släcker* tar figuren färg av effekten som körs — ett
hjärta kan vara solitt rött lika gärna som plasma eller eld. Presetet `Julgran`
utnyttjar det: `Glitter` (fx 87) över grönt ger vita gnistor i granen, alltså
julgransbelysning. Samma effekt var fel för hjärtat och rätt här.

Aktuell text läses av på `/json/info` under `u.Ordklockan`, och aktuellt läge på
`/json/state` under `Ordklockan.mode`.

## Rutnätet till simulatorkortet

`/json/info` innehåller också `u.OrdklockanRutnat` — **110 tecken, `1` = tänd
cell, i läsordning** (rad 0 överst, kolumn 0 till vänster):

```
KLOCKAN ÄR SEX  ->  11111110011 00000000000 ... 00001110000 ...
```

Det är firmwarens egen mask, inte en härledning. Lovelace-kortet ritar den rakt
av, vilket är hela poängen: kortet duplicerar ingen ordtabell i JavaScript och
kan därför aldrig visa något annat än väggen. Är klockläget av rapporteras
masken som helt tänd — då släcker `handleOverlayDraw` ingenting och hela
matrisen lyser, vilket är den sanna bilden.

## Ändra layouten

Ordtabellen i usermoden är rad/kolumn ur `LAYOUT` och `WORDS` i
[`../../generate.js`](../../generate.js). Ändrar du bokstavsrutnätet: kör om
`generate.js`, uppdatera `words[]` i usermoden, bygg om, flasha.

Verifiera **innan** du flashar med
[`../../tools/ordtest.py`](../../tools/ordtest.py) — den tänder orden via
JSON-API:t med samma tabell, så fel syns på väggen utan en enda kompilering.
