#include "Arduino.h"
#include <cstdio>
uint32_t FAKE_MILLIS = 0;
Print Serial;
#include "Toki.h"   // kopieras hit av kommandot i README

// The body as it shipped in WLED 16.0.1, kept here so the test shows what the
// same input used to do.
struct OldToki {
  uint32_t fullSecondMillis = 0, unix = 0;
  void setTime(uint32_t sec, uint16_t ms) { fullSecondMillis = millis() - ms; unix = sec; }
  uint16_t millisecond() {
    uint32_t ms = millis() - fullSecondMillis;
    while (ms > 999) { ms -= 1000; fullSecondMillis += 1000; unix++; }
    return ms;
  }
  uint32_t second() { millisecond(); return unix; }
};

int fails = 0;
void check(const char *name, bool ok, const char *detail) {
  printf("%s %-52s %s\n", ok ? "PASS" : "FAIL", name, detail);
  if (!ok) fails++;
}

int main() {
  const uint32_t T0 = 1788411000; // 2026-09-03 ~07:30 CEST

  // 1. Regression: normal forward time still counts normally.
  {
    Toki t;
    FAKE_MILLIS = 10000;
    t.setTime(Toki::Time{T0, 0});
    FAKE_MILLIS = 13500;                       // 3.5 s later
    uint16_t ms = t.millisecond();
    uint32_t s  = t.second();
    char d[128]; snprintf(d, sizeof d, "unix +%u s, ms=%u (expected +3, 500)", s - T0, ms);
    check("normal tick: 3500 ms elapsed -> +3 s", s == T0 + 3 && ms == 500, d);
  }

  // 2. The bug: fullSecondMillis ends up AHEAD of millis(), which is what a lost
  //    "fullSecondMillis += 1000" between the loop task and the AsyncTCP task
  //    leaves behind. Reached here through the public API by moving millis()
  //    back 800 ms after setTime().
  {
    OldToki old;
    FAKE_MILLIS = 100000;
    old.setTime(T0, 0);                        // fullSecondMillis = 100000
    FAKE_MILLIS = 99200;                       // fullSecondMillis now 800 ms ahead
    uint32_t s = old.second();
    double days = (double)(s - T0) / 86400.0;
    char d[128]; snprintf(d, sizeof d, "unix +%u s = %.4f days", s - T0, days);
    check("WLED 16.0.1 body jumps ~49.7 days (the bug)", s - T0 > 4000000, d);
  }
  {
    Toki t;
    FAKE_MILLIS = 100000;
    t.setTime(Toki::Time{T0, 0});
    FAKE_MILLIS = 99200;
    uint32_t s = t.second();
    char d[128]; snprintf(d, sizeof d, "unix %+d s (expected 0)", (int)(s - T0));
    check("patched body holds the clock steady", s == T0, d);
  }

  // 3. After realigning it must keep good time, not stall.
  {
    Toki t;
    FAKE_MILLIS = 100000;
    t.setTime(Toki::Time{T0, 0});
    FAKE_MILLIS = 99200;   t.second();         // realign
    FAKE_MILLIS = 101700;  uint32_t s = t.second();
    char d[128]; snprintf(d, sizeof d, "unix +%d s after 2500 ms (expected +2)", (int)(s - T0));
    check("keeps ticking after realignment", s == T0 + 2, d);
  }

  // 4. A real millis() rollover must still be counted as elapsed time.
  {
    Toki t;
    FAKE_MILLIS = 0xFFFFFC18;                  // 1000 ms before rollover
    t.setTime(Toki::Time{T0, 0});
    FAKE_MILLIS = 0x000007D0;                  // 3000 ms later, wrapped
    uint32_t s = t.second();
    char d[128]; snprintf(d, sizeof d, "unix +%d s across rollover (expected +3)", (int)(s - T0));
    check("millis() rollover still counts as 3 s", s == T0 + 3, d);
  }

  printf("\n%s\n", fails ? "FAILURES" : "all checks passed");
  return fails ? 1 : 0;
}
