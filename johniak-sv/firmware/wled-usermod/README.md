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

## Bygga och flasha

WLED-klonen ligger **utanför** det här repot, i
`Documents/Visual Studio Code/wled-ordklocka/WLED`.

```bash
git clone --depth 1 --branch v16.0.1 https://github.com/wled/WLED.git
cd WLED
cp -r <detta repo>/johniak-sv/firmware/wled-usermod usermods/usermod_v2_word_clock_sv
cp usermods/usermod_v2_word_clock_sv/platformio_override.ini .
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

Klockläget växlas i drift med

```bash
curl -X POST -H "Content-Type: application/json" -d '{"Ordklockan":{"on":true}}' http://192.168.30.17/json/state
```

och aktuell fras läses av på `/json/info` under `u.Ordklockan`.

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
