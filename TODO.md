# TODO — Svensk ordklocka

Ordningen är medveten: bygg grunden först, sen mjukvarulyxen. Från steg 2 och
framåt rörs aldrig hårdvaran igen — allt är firmware/HA (OTA efter första flashen).

**Status 2026-09-02: klockan hänger på väggen och visar svensk tid.** Steg 1, 3
och det mesta av 4–5 är klara. Kvar är automationerna och simulatorkortet.

## 1. Färdigställ bygget ✅
- [x] Top Shell printad (svart + transparenta bokstäver, AMS)
- [x] Bakplatta v2: piggslitsar fixade, stripband, ficka nere, tratt-krok
- [x] Printa om Top Shell (`johniak-sv/PRINTA/1_` + `2_`) — kabelslitsar per rad,
      bred matningsslits vid LED 0, stripurtag i kolumnväggarna
- [x] Printa om bakplattan (`johniak-sv/PRINTA/3_` + `4_`) — 12,5 mm ram,
      13 mm USB-C-öppning, ESP32-bay med limplatta och krok
- [x] Vänta in leverans: WS2812B 74/m 2 m + ESP32 DevKit v1
- [x] Klipp 10 rader à 11 LEDs, klistra i banden, löd serpentin
- [x] Testa alla 110 LEDs INNAN plattan skruvas fast
- [x] ESP32 i fickan, skruva M3 i hörnpelarna
- [x] Häng på tratt-kroken

> Nio skarvar, alla mätta och verifierade rad för rad. Rutinen och fällorna
> ligger i [`johniak-sv/KOPPLING.md`](johniak-sv/KOPPLING.md) — särskilt att ett
> kontinuitetspip inte räcker på strömledare (en fog på 80 Ω piper glatt och
> stryper ändå raden) och att pilarna ska växla varannan rad.

## 2. Firmware steg 1 — johniak + svensk patch ⏭️ ÖVERHOPPAT
Medvetet hoppat över. Kortet kom med WLED, och steg 3 hade ändå ersatt den här
firmwaren. [`PATCH.md`](johniak-sv/firmware/PATCH.md) sparas som referens —
tidslogiken där är samma som usermoden använder.

## 3. Firmware steg 2 — WLED med svensk word clock-usermod ✅
- [x] Custom-bygg av WLED 16.0.1 med egen usermod
- [x] Porta svenska ordtabellen till usermodens layout (rad/kolumn, inte LED-index)
- [x] Konfigurera 2D-matris 11×10, serpentin, första LED nere till vänster
- [x] Kuratera 12 presets — 5 klocklägen + 7 helmatriseffekter
- [x] OTA-flasha
- [x] NTP + tidszon CET/CEST med automatisk sommartid

Källkod och byggguide: [`johniak-sv/firmware/wled-usermod/`](johniak-sv/firmware/wled-usermod/README.md).
Presets skapas om med [`johniak-sv/tools/presets.py`](johniak-sv/tools/presets.py).

## 4. Home Assistant-integration
- [x] WLED-integrationen → `light.ordklockan` + 17 entiteter till
- [x] `packages/ordklockan.yaml`: rest_command för klockläget, `sensor.ordklockan_text`
      (aktuell fras), `binary_sensor.ordklockan_klocklage`
- [x] `script.ordklockan_scen` — sätter preset OCH klockläge i ett anrop
- [ ] Automationer: nattdimning, larmblink (röd puls), hemkomst-puls, tvätt-klar-skimmer
      (följ HA-regeln: kategori + labels + mdi-ikon på alla nya automationer)

## 5. Lovelace-dashboard
- [x] Effektväljare som knappgrid, scenknappar (Klockläge / Party / Lugn kväll / Natt),
      ljusstyrka, palett, hastighet — i `lampor`-vyn, Viktors button-card-stil
- [ ] Simulatorn som live-kort — visar exakt vad väggen visar (samma layoutkälla,
      korskollad mot plasten). Snabbversion: iframe-kort med `index.html`
- [ ] Automations-togglar + ev. plats på floorplanen
- [ ] WLED:s webb-UI som iframe-flik för finlir

## Lösa trådar
- **330 Ω på datalinjen** är medvetet överhoppad. Klockan har gått felfritt utan
  den; är den första åtgärden om flimmer dyker upp.
- **`ordtest.py` mot `--all`** har aldrig körts hela varvet med plattan på.
  Värt att göra en gång för att se alla tolv femminutersblock.
