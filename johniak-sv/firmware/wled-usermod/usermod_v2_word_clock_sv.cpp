#pragma once

#include "wled.h"

/*
 * Svensk ordklocka — 11 x 10, 110 LEDs.
 *
 * Bygger på strukturen i usermod_v2_word_clock (tysk 11x10), men med svensk
 * femminuterslogik och egen ordtabell. Tyskan och svenskan råkar ha identisk
 * struktur — "fünf vor halb" = "fem i halv", båda byter till nästa timme från
 * :25 — så bara orden skiljer.
 *
 * ---------------------------------------------------------------------------
 * INDEXRUMMET, som kostade en felsökningsrunda:
 *
 * Orden anges i RAD och KOLUMN, inte i LED-nummer. WLED:s pixelbuffert
 * indexeras i läsordning (rad 0 överst, kolumn 0 till vänster):
 *
 *     FX.h:900   setPixelColor(n, c)      ->  _pixels[n] = c
 *     FX.h:1000  setPixelColorXY(x, y, c) ->  setPixelColor(y * maxWidth + x, c)
 *
 * Serpentinen och "första LED nere till vänster" appliceras först när
 * bufferten skickas ut på bussen, utifrån 2D-panelinställningen i WLED. En
 * tabell med FYSISKA LED-index (som words_sv.h innehåller) är alltså fel rum
 * här och ger ord utspridda över hela plattan.
 *
 * Rad/kolumn är dessutom hur layouten faktiskt definieras i
 * johniak-sv/generate.js (WORDS = {row, c0, c1}) och hur simulatorn i
 * index.html ritar. Ändra layouten där, kör om generate.js, uppdatera nedan.
 * ---------------------------------------------------------------------------
 *
 * Precis som den tyska SLÄCKER den här usermoden bara de LEDs som inte ingår i
 * aktuell tid. Effekten som körs målar bokstäverna, så alla WLED:s 2D-effekter
 * fungerar fortfarande.
 */
class SwedishWordClockUsermod : public Usermod
{
  private:
    static const uint8_t  WC_WIDTH  = 11;
    static const uint8_t  WC_HEIGHT = 10;
    static const uint16_t WC_CELLS  = WC_WIDTH * WC_HEIGHT;   // 110

    // --- inställningar (Usermod Settings) --------------------------------
    bool usermodActive    = false;
    bool displayKlockanAr = true;

    // --- körtid -----------------------------------------------------------
    unsigned long lastPoll = 0;
    int  lastMinute = -1;
    bool firstRun   = true;
    bool cellOn[WC_CELLS];

    // --- ordtabell --------------------------------------------------------
    enum : int8_t {
      W_KLOCKAN = 0, W_AR,
      W_FEM, W_TIO, W_TJUGO, W_KVART, W_OVER, W_I, W_HALV,
      W_H1, W_H2, W_H3, W_H4, W_H5, W_H6, W_H7, W_H8, W_H9, W_H10, W_H11, W_H12,
      W_COUNT
    };

    // {rad, forsta kolumn, sista kolumn} -- bada andar inklusive.
    // Rad 0 ar oversta raden (KLOCKAN AR), kolumn 0 ar langst till vanster.
    struct WordCells { uint8_t row; uint8_t c0; uint8_t c1; };

    const WordCells words[W_COUNT] = {
      {0, 0,  6},   // KLOCKAN
      {0, 9, 10},   // ÄR
      {1, 1,  3},   // FEM   (minut)
      {1, 6,  8},   // TIO   (minut)
      {2, 0,  4},   // TJUGO
      {3, 0,  4},   // KVART
      {3, 6,  9},   // ÖVER
      {4, 1,  1},   // I
      {4, 4,  7},   // HALV
      {5, 0,  2},   // ETT
      {5, 4,  6},   // TVÅ
      {6, 0,  2},   // TRE
      {6, 4,  7},   // FYRA
      {7, 0,  2},   // FEM   (timme)
      {7, 4,  6},   // SEX
      {7, 8, 10},   // SJU
      {8, 0,  3},   // ÅTTA
      {8, 5,  7},   // NIO
      {9, 8, 10},   // TIO   (timme)
      {9, 0,  3},   // ELVA
      {9, 4,  7}    // TOLV
    };

    // minut/5 -> upp till tre ord. -1 = tomt.
    const int8_t blockWords[12][3] = {
      {      -1,     -1,     -1},  // :00  (bara timmen)
      {   W_FEM, W_OVER,     -1},  // :05  fem över
      {   W_TIO, W_OVER,     -1},  // :10  tio över
      { W_KVART, W_OVER,     -1},  // :15  kvart över
      { W_TJUGO, W_OVER,     -1},  // :20  tjugo över
      {   W_FEM,    W_I, W_HALV},  // :25  fem i halv
      {  W_HALV,     -1,     -1},  // :30  halv
      {   W_FEM, W_OVER, W_HALV},  // :35  fem över halv
      { W_TJUGO,    W_I,     -1},  // :40  tjugo i
      { W_KVART,    W_I,     -1},  // :45  kvart i
      {   W_TIO,    W_I,     -1},  // :50  tio i
      {   W_FEM,    W_I,     -1}   // :55  fem i
    };

    // Från :25 refereras NÄSTA timme — "fem i halv fem" är 16:25.
    const bool blockNextHour[12] = {
      false, false, false, false, false,
      true,  true,  true,  true,  true,  true,  true
    };

    // Bara för /json/info — vad väggen säger, i klartext.
    const char *blockText[12] = {
      "", "FEM ÖVER", "TIO ÖVER", "KVART ÖVER", "TJUGO ÖVER", "FEM I HALV",
      "HALV", "FEM ÖVER HALV", "TJUGO I", "KVART I", "TIO I", "FEM I"
    };
    const char *hourText[13] = {
      "", "ETT", "TVÅ", "TRE", "FYRA", "FEM", "SEX",
      "SJU", "ÅTTA", "NIO", "TIO", "ELVA", "TOLV"
    };
    char phrase[48] = "";

    // 110 tecken, '1' = tand cell, i lasordning. Skickas i /json/info sa att
    // Lovelace-kortet kan rita exakt samma bild som vaggen visar, utan att
    // duplicera ordtabellen i JavaScript.
    char grid[WC_CELLS + 1] = "";

    void lightWord(int8_t w)
    {
      if (w < 0 || w >= W_COUNT) return;
      const WordCells &c = words[w];
      if (c.row >= WC_HEIGHT) return;
      for (uint8_t x = c.c0; x <= c.c1 && x < WC_WIDTH; x++) {
        cellOn[c.row * WC_WIDTH + x] = true;
      }
    }

    // hour12: 1..12
    void updateMask(uint8_t hour12, uint8_t minutes)
    {
      for (uint16_t i = 0; i < WC_CELLS; i++) cellOn[i] = false;

      if (displayKlockanAr) {
        lightWord(W_KLOCKAN);
        lightWord(W_AR);
      }

      uint8_t block = (minutes / 5) % 12;
      for (uint8_t i = 0; i < 3; i++) lightWord(blockWords[block][i]);

      uint8_t h = hour12;
      if (h < 1 || h > 12) h = 12;
      if (blockNextHour[block]) h = (h % 12) + 1;

      lightWord((int8_t)(W_H1 + (h - 1)));

      if (blockText[block][0] == '\0') {
        snprintf(phrase, sizeof(phrase), "KLOCKAN ÄR %s", hourText[h]);
      } else {
        snprintf(phrase, sizeof(phrase), "KLOCKAN ÄR %s %s", blockText[block], hourText[h]);
      }

      for (uint16_t i = 0; i < WC_CELLS; i++) grid[i] = cellOn[i] ? '1' : '0';
      grid[WC_CELLS] = '\0';
    }

  public:

    void setup()
    {
      for (uint16_t i = 0; i < WC_CELLS; i++) cellOn[i] = false;
    }

    void loop()
    {
      if (!usermodActive) return;

      if (!firstRun && millis() - lastPoll < 5000) return;
      lastPoll = millis();

      // Vänta tills NTP satt en rimlig tid, annars visar klockan 1970.
      if (localTime < 1600000000UL) return;

      int m = minute(localTime);
      if (!firstRun && m == lastMinute) return;

      lastMinute = m;
      firstRun   = false;
      updateMask(hourFormat12(localTime), (uint8_t)m);
    }

    /*
     * Anropas efter att effekten målat, precis före show(). Vi släcker allt som
     * inte ingår i tiden och låter effekten lysa genom orden.
     */
    void handleOverlayDraw()
    {
      if (!usermodActive) return;

      for (uint8_t y = 0; y < WC_HEIGHT; y++) {
        for (uint8_t x = 0; x < WC_WIDTH; x++) {
          if (!cellOn[y * WC_WIDTH + x]) strip.setPixelColorXY(x, y, RGBW32(0, 0, 0, 0));
        }
      }
    }

    /*
     * Klockläget i /json/state gör det styrbart utifrån — från Home Assistant,
     * från REST, och det följer med när man sparar en preset. Inställningen i
     * konfigen nedan är bara startvärdet vid boot.
     *
     *   {"Ordklockan":{"on":true}}   -> ord, effekten lyser genom bokstäverna
     *   {"Ordklockan":{"on":false}}  -> hela matrisen fri åt effekten
     */
    void addToJsonState(JsonObject& root)
    {
      JsonObject um = root[F("Ordklockan")];
      if (um.isNull()) um = root.createNestedObject(F("Ordklockan"));
      um[F("on")] = usermodActive;
    }

    void readFromJsonState(JsonObject& root)
    {
      JsonObject um = root[F("Ordklockan")];
      if (um.isNull()) return;

      bool v;
      if (getJsonValue(um[F("on")], v)) {
        if (v != usermodActive) {
          usermodActive = v;
          firstRun = true;   // tvinga omritning direkt, vänta inte på minutbyte
        }
      }
    }

    /*
     * Visar aktuell fras i /json/info -> "u" -> Ordklockan. Home Assistant kan
     * plocka upp den som en sensor, så dashboarden kan visa vad väggen säger.
     */
    void addToJsonInfo(JsonObject& root)
    {
      JsonObject user = root[F("u")];
      if (user.isNull()) user = root.createNestedObject(F("u"));

      JsonArray arr = user.createNestedArray(F("Ordklockan"));
      arr.add(usermodActive ? (phrase[0] ? phrase : "vantar pa tid") : "av");

      // Ar klocklaget av slacker handleOverlayDraw ingenting, alltsa lyser hela
      // matrisen. Da ar en helt tand mask den sanna bilden.
      char out[WC_CELLS + 1];
      for (uint16_t i = 0; i < WC_CELLS; i++) {
        out[i] = usermodActive ? (grid[i] ? grid[i] : '0') : '1';
      }
      out[WC_CELLS] = '\0';

      JsonArray g = user.createNestedArray(F("OrdklockanRutnat"));
      g.add(out);
    }

    void addToConfig(JsonObject& root)
    {
      JsonObject top = root.createNestedObject(F("Ordklockan"));
      top[F("active")]          = usermodActive;
      top[F("visa KLOCKAN AR")] = displayKlockanAr;
    }

    void appendConfigData()
    {
      oappend(F("addInfo('Ordklockan:visa KLOCKAN AR', 1, 'Har KLOCKAN AR alltid tant');"));
    }

    bool readFromConfig(JsonObject& root)
    {
      JsonObject top = root[F("Ordklockan")];
      bool configComplete = !top.isNull();

      configComplete &= getJsonValue(top[F("active")], usermodActive);
      configComplete &= getJsonValue(top[F("visa KLOCKAN AR")], displayKlockanAr);

      return configComplete;
    }

    uint16_t getId()
    {
      return USERMOD_ID_WORDCLOCK;
    }
};

static SwedishWordClockUsermod usermod_v2_word_clock_sv;
REGISTER_USERMOD(usermod_v2_word_clock_sv);
