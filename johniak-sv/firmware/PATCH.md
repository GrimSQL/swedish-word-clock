# Svensk firmware-patch för johniak/word-clock (ESP32)

Originalkoden (https://github.com/johniak/word-clock) saknar licensfil, så vi
distribuerar inte modifierade kopior av deras filer — bara våra egna tillägg
(tabellen i `words_sv.h` + kodblocken nedan). Patcha lokalt:

```bash
git clone https://github.com/johniak/word-clock
cd word-clock/esp/wordclock
```

Följ deras `docs/installation_esp32.md` för PlatformIO-setup och `config.h`
(WiFi-uppgifter). Gör sedan två ändringar:

## 1. Ändra grid-storleken — `src/ClockDisplayHAL.h`

Svenska layouten är 11×10 (simulatorns exakta matris, 110 LEDs). Ändra:

```cpp
static const uint16_t WIDTH = 11;    // var 12
static const uint16_t HEIGHT = 10;   // var 11
```

`NUM_LEDS` räknas ut automatiskt (= 110). GIF-spelaren ritar mot samma
konstanter och följer med.

## 2. Byt ordtabellen — `src/ClockDisplayHAL.cpp`

Ersätt hela `WORDS_TO_LEDS[]`-arrayen (rad 3–27) med innehållet i
[`words_sv.h`](words_sv.h) (genererad från layouten — redigera aldrig för hand).

## 3. Byt tidslogiken — `src/WordClock.cpp`

Ta bort hela `getMinutesWord(...)` och ersätt `displayTime()` med:

```cpp
void WordClock::displayTime()
{
    struct tm currentTime = networkManager->getLocalTimeStruct();
    int hour = currentTime.tm_hour % 12;
    int minute = currentTime.tm_min;
    int block = minute / 5;

    clockDisplayHAL->clearPixels(false);

    if (hour != lastHour && minute == 0)
    {
        lastHour = hour;
        if (gifDownloaded)
        {
            gifPlayer->playGIF(4000);
        }
        clockDisplayHAL->clearPixels(false);
    }

    // KLOCKAN ÄR lyser alltid
    highlightWord("KLOCKAN", getRandomColor());
    highlightWord("AR", getRandomColor());
    String all = "KLOCKANAR";

    // Svensk 5-minuterslogik. Från :25 refereras NÄSTA timme ("fem i halv fem").
    static const char *BLOCK_WORDS[12][3] = {
        {nullptr, nullptr, nullptr},          // :00  KLOCKAN ÄR <timme>
        {"FEM_MIN", "OVER", nullptr},         // :05  fem över
        {"TIO_MIN", "OVER", nullptr},         // :10  tio över
        {"KVART", "OVER", nullptr},           // :15  kvart över
        {"TJUGO", "OVER", nullptr},           // :20  tjugo över
        {"FEM_MIN", "I", "HALV"},             // :25  fem i halv
        {"HALV", nullptr, nullptr},           // :30  halv
        {"FEM_MIN", "OVER", "HALV"},          // :35  fem över halv
        {"TJUGO", "I", nullptr},              // :40  tjugo i
        {"KVART", "I", nullptr},              // :45  kvart i
        {"TIO_MIN", "I", nullptr},            // :50  tio i
        {"FEM_MIN", "I", nullptr}};           // :55  fem i
    static const bool NEXT_HOUR[12] = {
        false, false, false, false, false,
        true, true, true, true, true, true, true};

    for (int i = 0; i < 3 && BLOCK_WORDS[block][i] != nullptr; ++i)
    {
        highlightWord(BLOCK_WORDS[block][i], getRandomColor());
        all += BLOCK_WORDS[block][i];
    }

    if (NEXT_HOUR[block])
        hour = (hour + 1) % 12;
    if (hour == 0)
        hour = 12;

    String hourWord = "HOUR_" + String(hour);
    highlightWord(hourWord, getRandomColor());
    all += hourWord;

    if (allLastHighlightedWords != all)
    {
        clockDisplayHAL->show();
        allLastHighlightedWords = all;
    }
}
```

Klart — bygg och flasha enligt deras guide. Exempel på vad som ska lysa:
16:00 `KLOCKAN ÄR FYRA` · 16:20 `KLOCKAN ÄR TJUGO ÖVER FYRA` ·
16:25 `KLOCKAN ÄR FEM I HALV FEM` · 16:35 `KLOCKAN ÄR FEM ÖVER HALV FEM` ·
16:45 `KLOCKAN ÄR KVART I FEM`.

## Verifiering efter flash

Sätt en testtid (eller vänta över en 5-minutersgräns) och jämför mot
simulatorn i repo-roten (`index.html`) — samma logik, samma ord.
