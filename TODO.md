# TODO — Svensk ordklocka

Ordningen är medveten: bygg grunden först, sen mjukvarulyxen. Från steg 2 och
framåt rörs aldrig hårdvaran igen — allt är firmware/HA (OTA efter första flashen).

## 1. Färdigställ bygget (pågår)
- [x] Top Shell printad (svart + transparenta bokstäver, AMS)
- [x] Bakplatta v2: piggslitsar fixade, stripband, ficka nere, tratt-krok
- [ ] Printa senaste bakplattan (`johniak-sv/PRINTA/3_` + `4_`)
- [ ] Vänta in leverans: WS2812B 74/m 2 m + ESP32 DevKit v1 (beställt 2026-07-23)
- [ ] Klipp 10 rader à 11 LEDs, klistra i banden, löd serpentin (LED 0 vid genomföringshålet)
- [ ] Testa alla 110 LEDs INNAN plattan skruvas fast
- [ ] ESP32 i fickan (limpistol-klickar i hörnen), skruva M3 i hörnpelarna
- [ ] Häng på tratt-kroken (skruvhuvud ~3–4 mm från väggen)

## 2. Firmware steg 1 — johniak + svensk patch
- [ ] Klona johniak/word-clock lokalt (committa ALDRIG deras kod — saknar licens)
- [ ] Applicera `johniak-sv/firmware/PATCH.md`: WIDTH 11 / HEIGHT 10, `words_sv.h`, svensk `displayTime()`
- [ ] `config.h` med WiFi-uppgifter (lokal fil, aldrig i git)
- [ ] Lägg till OTA (ArduinoOTA) redan i första flashen
- [ ] PlatformIO: bygg + flasha via USB, verifiera mot simulatorn (`index.html`)

## 3. Firmware steg 2 — WLED med svensk word clock-usermod
- [ ] Custom-bygg av WLED med word clock-usermoden
- [ ] Porta svenska ordtabellen (genereras av `johniak-sv/generate.js`) till usermodens layout
- [ ] Konfigurera 2D-matris 11×10, serpentin, samma LED-ordning som steg 1
- [ ] Kuratera 8–10 snyggaste 2D-effekterna som presets (eld, regnbåge, plasma, matrix rain...)
- [ ] OTA-flasha — klockan sitter kvar på väggen

## 4. Home Assistant-integration
- [ ] WLED-integrationen (auto-upptäcks) → `light.ordklockan` med effektlista
- [ ] Automationer: nattdimning, larmblink (röd puls), hemkomst-puls, tvätt-klar-skimmer
  (följ HA-regeln: kategori + labels på alla nya automationer)

## 5. Lovelace-dashboard
- [ ] Simulatorn som live-kort — visar exakt vad väggen visar (samma layoutkälla,
      korskollad mot plasten). Snabbversion: iframe-kort med `index.html`
- [ ] Effektväljare som knappgrid (Mushroom/button-card), scenknappar
      (Klockläge / Party / Lugn kväll / Natt), färghjul + ljusstyrka
- [ ] Automations-togglar + ev. plats på floorplanen
- [ ] WLED:s webb-UI som iframe-flik för finlir
