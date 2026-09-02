#pragma once

#include "wled.h"

/*
 * Svensk ordklocka — 11 x 10, 110 LEDs.
 *
 * Bygger på strukturen i usermod_v2_word_clock (tysk 11x10), men med svensk
 * femminuterslogik, egen ordtabell, figurer och en tvåsiffrig sifferdisplay.
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
 * ---------------------------------------------------------------------------
 *
 * LÄGEN. Ett fält, inte flera flaggor — två booleans kan stå i konflikt, ett
 * läge kan inte. Sätts via /json/state:
 *
 *     {"Ordklockan":{"mode":"klocka"}}                tiden i ord
 *     {"Ordklockan":{"mode":"hjarta"}}                figur (se SHAPES)
 *     {"Ordklockan":{"mode":"tal","varde":21}}        tvåsiffrigt tal, -99..99
 *     {"Ordklockan":{"mode":"nedrakning","varde":99}} lokal nedräkning i sekunder
 *     {"Ordklockan":{"mode":"av"}}                    hela matrisen fri åt effekten
 *
 * `{"on":true|false}` finns kvar som alias mot klocka/av.
 *
 * Usermoden SLÄCKER bara de LEDs som inte ingår i bilden. Effekten som körs
 * målar resten, så alla WLED:s 2D-effekter fungerar fortfarande — ett hjärta
 * kan lika gärna vara plasma som solitt rött.
 */

#define WC_W 11
#define WC_H 10

// --- figurer -------------------------------------------------------------
// En rad per matrisrad, '#' = tänd cell. Formen syns i koden; en ny figur är
// tio rader text och en rad i SHAPES nedan. Inga index att räkna.

static const char *const SH_HJARTA[WC_H] = {
  "...........", "..##...##..", ".####.####.", ".#########.", ".#########.",
  "..#######..", "...#####...", "....###....", ".....#.....", "..........." };

static const char *const SH_STJARNA[WC_H] = {
  "...........", ".....#.....", "....###....", "###########", ".#########.",
  "..#######..", "..#######..", ".###...###.", ".##.....##.", "..........." };

// Rad 4 är insnörningen mellan våningarna - utan den blir det en triangel.
static const char *const SH_GRAN[WC_H] = {
  ".....#.....", "....###....", "...#####...", "..#######..", "...#####...",
  "..#######..", ".#########.", "###########", ".....#.....", "....###...." };

static const char *const SH_SNOFLINGA[WC_H] = {
  ".....#.....", "..#..#..#..", "...#.#.#...", "....###....", ".#########.",
  "....###....", "...#.#.#...", "..#..#..#..", ".....#.....", "..........." };

// Ögon och morrhår är MÖRKA celler i en tänd yta - det är det som gör att en
// katt läses på elva kolumner.
static const char *const SH_KATT[WC_H] = {
  "..#.....#..", "..##...##..", "..#######..", ".#########.", ".##.###.##.",
  ".#########.", ".#..###..#.", ".#########.", "..#######..", "..........." };

static const char *const SH_BLIXT[WC_H] = {
  "......###..", ".....###...", "....###....", "...######..", "......###..",
  ".....###...", "....###....", "...###.....", "...........", "..........." };

static const char *const SH_UTROP[WC_H] = {
  "....###....", "....###....", "....###....", "....###....", "....###....",
  "....###....", "...........", "....###....", "....###....", "..........." };

struct ShapeDef { const char *key; const char *label; const char *const *rows; };

static const ShapeDef SHAPES[] = {
  {"hjarta",    "HJÄRTA",       SH_HJARTA},
  {"stjarna",   "STJÄRNA",      SH_STJARNA},
  {"gran",      "GRAN",         SH_GRAN},
  {"snoflinga", "SNÖFLINGA",    SH_SNOFLINGA},
  {"katt",      "KATT",         SH_KATT},
  {"blixt",     "BLIXT",        SH_BLIXT},
  {"utrop",     "UTROPSTECKEN", SH_UTROP},
};
static const uint8_t SHAPE_COUNT = sizeof(SHAPES) / sizeof(SHAPES[0]);

// --- siffror -------------------------------------------------------------
// 4 breda, 7 höga. Två får plats bredvid varandra på elva kolumner med en
// kolumns mellanrum, vilket är hela anledningen till att timer, temperatur
// och nedräkning kan vara samma sak: en tvåsiffrig display.

static const char *const DIGITS[10][7] = {
  {"####","#..#","#..#","#..#","#..#","#..#","####"},  // 0
  {"..#.",".##.","..#.","..#.","..#.","..#.","####"},  // 1
  {"####","...#","...#","####","#...","#...","####"},  // 2
  {"####","...#","...#","####","...#","...#","####"},  // 3
  {"#..#","#..#","#..#","####","...#","...#","...#"},  // 4
  {"####","#...","#...","####","...#","...#","####"},  // 5
  {"####","#...","#...","####","#..#","#..#","####"},  // 6
  {"####","...#","...#","...#","...#","...#","...#"},  // 7
  {"####","#..#","#..#","####","#..#","#..#","####"},  // 8
  {"####","#..#","#..#","####","...#","...#","####"},  // 9
};

class SwedishWordClockUsermod : public Usermod
{
  private:
    static const uint16_t WC_CELLS = WC_W * WC_H;   // 110

    enum : uint8_t { MODE_OFF = 0, MODE_CLOCK = 1, MODE_SHAPE = 2,
                     MODE_NUMBER = 3, MODE_COUNTDOWN = 4 };

    // --- inställningar (Usermod Settings) --------------------------------
    bool bootActive       = false;   // startläge: klocka om true, annars av
    bool displayKlockanAr = true;

    // --- körtid -----------------------------------------------------------
    uint8_t mode     = MODE_OFF;
    uint8_t shapeIdx = 0;
    int     number   = 0;            // visat tal i MODE_NUMBER
    int32_t remaining = 0;           // sekunder kvar i MODE_COUNTDOWN
    int     lastShown = INT32_MIN;   // senast ritade nedräkningssiffra
    unsigned long lastTick = 0;
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

    const int8_t blockWords[12][3] = {
      {      -1,     -1,     -1},  // :00
      {   W_FEM, W_OVER,     -1},  // :05
      {   W_TIO, W_OVER,     -1},  // :10
      { W_KVART, W_OVER,     -1},  // :15
      { W_TJUGO, W_OVER,     -1},  // :20
      {   W_FEM,    W_I, W_HALV},  // :25
      {  W_HALV,     -1,     -1},  // :30
      {   W_FEM, W_OVER, W_HALV},  // :35
      { W_TJUGO,    W_I,     -1},  // :40
      { W_KVART,    W_I,     -1},  // :45
      {   W_TIO,    W_I,     -1},  // :50
      {   W_FEM,    W_I,     -1}   // :55
    };

    const bool blockNextHour[12] = {
      false, false, false, false, false,
      true,  true,  true,  true,  true,  true,  true
    };

    const char *blockText[12] = {
      "", "FEM ÖVER", "TIO ÖVER", "KVART ÖVER", "TJUGO ÖVER", "FEM I HALV",
      "HALV", "FEM ÖVER HALV", "TJUGO I", "KVART I", "TIO I", "FEM I"
    };
    const char *hourText[13] = {
      "", "ETT", "TVÅ", "TRE", "FYRA", "FEM", "SEX",
      "SJU", "ÅTTA", "NIO", "TIO", "ELVA", "TOLV"
    };
    char phrase[48] = "";
    char grid[WC_CELLS + 1] = "";

    void clearCells() { for (uint16_t i = 0; i < WC_CELLS; i++) cellOn[i] = false; }

    void publishGrid()
    {
      for (uint16_t i = 0; i < WC_CELLS; i++) grid[i] = cellOn[i] ? '1' : '0';
      grid[WC_CELLS] = '\0';
    }

    void lightWord(int8_t w)
    {
      if (w < 0 || w >= W_COUNT) return;
      const WordCells &c = words[w];
      if (c.row >= WC_H) return;
      for (uint8_t x = c.c0; x <= c.c1 && x < WC_W; x++) cellOn[c.row * WC_W + x] = true;
    }

    void drawShape(uint8_t idx)
    {
      if (idx >= SHAPE_COUNT) return;
      clearCells();
      const char *const *rows = SHAPES[idx].rows;
      for (uint8_t y = 0; y < WC_H; y++)
        for (uint8_t x = 0; x < WC_W; x++)
          if (rows[y][x] == '#') cellOn[y * WC_W + x] = true;
      strncpy(phrase, SHAPES[idx].label, sizeof(phrase) - 1);
      phrase[sizeof(phrase) - 1] = '\0';
      publishGrid();
    }

    void drawDigit(uint8_t d, uint8_t col, uint8_t row)
    {
      if (d > 9) return;
      for (uint8_t y = 0; y < 7; y++)
        for (uint8_t x = 0; x < 4; x++)
          if (DIGITS[d][y][x] == '#' && col + x < WC_W && row + y < WC_H)
            cellOn[(row + y) * WC_W + col + x] = true;
    }

    /*
     * Tvåsiffrig display, -99..99. Siffrorna är 4 breda: två får plats på
     * kolumn 1-4 och 6-9. Är talet negativt skjuts allt ett steg åt höger och
     * minustecknet tar kolumn 0-1 — då går det jämnt ut på elva kolumner,
     * vilket är varför minusgrader fungerar utan att något klipps.
     */
    void drawNumber(int v)
    {
      clearCells();
      bool neg = v < 0;
      int a = neg ? -v : v;
      if (a > 99) a = 99;

      if (neg) {
        cellOn[5 * WC_W + 0] = true;
        cellOn[5 * WC_W + 1] = true;
        if (a >= 10) { drawDigit(a / 10, 2, 2); drawDigit(a % 10, 7, 2); }
        else         { drawDigit(a, 4, 2); }
      } else if (a >= 10) {
        drawDigit(a / 10, 1, 2);
        drawDigit(a % 10, 6, 2);
      } else {
        drawDigit(a, 3, 2);
      }

      snprintf(phrase, sizeof(phrase), "%d", neg ? -a : a);
      publishGrid();
    }

    /*
     * Två siffror räcker inte till MM:SS, så displayen visar det mest exakta
     * som får plats: SEKUNDER så länge de ryms i två siffror, annars minuter
     * uppåt avrundat.
     *
     * Gränsen går vid 99, inte vid 60. Med 60 skulle en nedräkning från 99 s
     * visa "2" (ceil(99/60)) i stället för att räkna 99, 98, 97 - vilket är
     * riktigt enligt regeln men fel enligt förväntan.
     *
     * En femminuterstimer visar alltså 5, 4, 3, 2 och växlar sedan till
     * sekunder vid 99 och räknar ner till noll.
     */
    int countdownDigits() const
    {
      if (remaining > 99) { int m = (remaining + 59) / 60; return m > 99 ? 99 : m; }
      return remaining < 0 ? 0 : remaining;
    }

    void drawTime(uint8_t hour12, uint8_t minutes)
    {
      clearCells();

      if (displayKlockanAr) { lightWord(W_KLOCKAN); lightWord(W_AR); }

      uint8_t block = (minutes / 5) % 12;
      for (uint8_t i = 0; i < 3; i++) lightWord(blockWords[block][i]);

      uint8_t h = hour12;
      if (h < 1 || h > 12) h = 12;
      if (blockNextHour[block]) h = (h % 12) + 1;
      lightWord((int8_t)(W_H1 + (h - 1)));

      if (blockText[block][0] == '\0')
        snprintf(phrase, sizeof(phrase), "KLOCKAN ÄR %s", hourText[h]);
      else
        snprintf(phrase, sizeof(phrase), "KLOCKAN ÄR %s %s", blockText[block], hourText[h]);

      publishGrid();
    }

    void applyMode()
    {
      firstRun = true;
      if      (mode == MODE_SHAPE)     drawShape(shapeIdx);
      else if (mode == MODE_NUMBER)    drawNumber(number);
      else if (mode == MODE_COUNTDOWN) { lastShown = countdownDigits(); drawNumber(lastShown); lastTick = millis(); }
      else if (mode == MODE_OFF)       { clearCells(); phrase[0] = '\0'; publishGrid(); }
    }

  public:

    void setup()
    {
      clearCells();
      publishGrid();
      mode = bootActive ? MODE_CLOCK : MODE_OFF;
      firstRun = true;
    }

    void loop()
    {
      if (mode == MODE_COUNTDOWN) {
        if (millis() - lastTick >= 1000) {
          lastTick += 1000;
          if (remaining > 0) remaining--;
          int d = countdownDigits();
          if (d != lastShown) { lastShown = d; drawNumber(d); }
        }
        return;
      }

      // Figurer och tal beror inte på tiden och ritades när läget sattes.
      if (mode != MODE_CLOCK) return;

      if (!firstRun && millis() - lastPoll < 5000) return;
      lastPoll = millis();

      // Vänta tills NTP satt en rimlig tid, annars visar klockan 1970.
      if (localTime < 1600000000UL) return;

      int m = minute(localTime);
      if (!firstRun && m == lastMinute) return;

      lastMinute = m;
      firstRun   = false;
      drawTime(hourFormat12(localTime), (uint8_t)m);
    }

    void handleOverlayDraw()
    {
      if (mode == MODE_OFF) return;
      for (uint8_t y = 0; y < WC_H; y++)
        for (uint8_t x = 0; x < WC_W; x++)
          if (!cellOn[y * WC_W + x]) strip.setPixelColorXY(x, y, RGBW32(0, 0, 0, 0));
    }

    void addToJsonState(JsonObject& root)
    {
      JsonObject um = root[F("Ordklockan")];
      if (um.isNull()) um = root.createNestedObject(F("Ordklockan"));
      um[F("on")] = (mode != MODE_OFF);
      um[F("mode")] = (mode == MODE_SHAPE)     ? SHAPES[shapeIdx].key
                    : (mode == MODE_NUMBER)    ? "tal"
                    : (mode == MODE_COUNTDOWN) ? "nedrakning"
                    : (mode == MODE_CLOCK)     ? "klocka" : "av";
      if (mode == MODE_NUMBER)    um[F("varde")] = number;
      if (mode == MODE_COUNTDOWN) um[F("varde")] = remaining;
    }

    void readFromJsonState(JsonObject& root)
    {
      JsonObject um = root[F("Ordklockan")];
      if (um.isNull()) return;

      const char *m = um[F("mode")];
      int v;
      bool haveV = getJsonValue(um[F("varde")], v);

      if (m) {
        if (!strcmp(m, "klocka"))          { mode = MODE_CLOCK; applyMode(); return; }
        if (!strcmp(m, "av"))              { mode = MODE_OFF;   applyMode(); return; }
        if (!strcmp(m, "tal"))             { mode = MODE_NUMBER; if (haveV) number = v; applyMode(); return; }
        if (!strcmp(m, "nedrakning"))      { mode = MODE_COUNTDOWN; if (haveV) remaining = v < 0 ? 0 : v; applyMode(); return; }
        for (uint8_t i = 0; i < SHAPE_COUNT; i++)
          if (!strcmp(m, SHAPES[i].key))   { mode = MODE_SHAPE; shapeIdx = i; applyMode(); return; }
        return;                            // okänt läge: rör ingenting
      }

      // Bara ett nytt värde till ett läge som redan är igång.
      if (haveV && mode == MODE_NUMBER)    { number = v; applyMode(); return; }
      if (haveV && mode == MODE_COUNTDOWN) { remaining = v < 0 ? 0 : v; applyMode(); return; }

      bool b;
      if (getJsonValue(um[F("on")], b)) { mode = b ? MODE_CLOCK : MODE_OFF; applyMode(); }
    }

    void addToJsonInfo(JsonObject& root)
    {
      JsonObject user = root[F("u")];
      if (user.isNull()) user = root.createNestedObject(F("u"));

      JsonArray arr = user.createNestedArray(F("Ordklockan"));
      arr.add(mode == MODE_OFF ? "av" : (phrase[0] ? phrase : "vantar pa tid"));

      // Är läget av släcker handleOverlayDraw ingenting, alltså lyser hela
      // matrisen. Då är en helt tänd mask den sanna bilden.
      char out[WC_CELLS + 1];
      for (uint16_t i = 0; i < WC_CELLS; i++)
        out[i] = (mode == MODE_OFF) ? '1' : (grid[i] ? grid[i] : '0');
      out[WC_CELLS] = '\0';

      JsonArray g = user.createNestedArray(F("OrdklockanRutnat"));
      g.add(out);
    }

    void addToConfig(JsonObject& root)
    {
      JsonObject top = root.createNestedObject(F("Ordklockan"));
      top[F("active")]          = bootActive;
      top[F("visa KLOCKAN AR")] = displayKlockanAr;
    }

    void appendConfigData()
    {
      oappend(F("addInfo('Ordklockan:active', 1, 'Startlage vid boot: klocka om pa, annars av');"));
      oappend(F("addInfo('Ordklockan:visa KLOCKAN AR', 1, 'Har KLOCKAN AR alltid tant');"));
    }

    bool readFromConfig(JsonObject& root)
    {
      JsonObject top = root[F("Ordklockan")];
      bool configComplete = !top.isNull();
      configComplete &= getJsonValue(top[F("active")], bootActive);
      configComplete &= getJsonValue(top[F("visa KLOCKAN AR")], displayKlockanAr);
      return configComplete;
    }

    uint16_t getId() { return USERMOD_ID_WORDCLOCK; }
};

static SwedishWordClockUsermod usermod_v2_word_clock_sv;
REGISTER_USERMOD(usermod_v2_word_clock_sv);
