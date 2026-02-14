# Swedish Word Clock Simulator

An interactive browser-based simulator for a Swedish word clock (QlockTwo-style), designed as a proof-of-concept before laser cutting and building the physical hardware.

**[Live Demo](https://grimsql.github.io/swedish-word-clock/)**

![Swedish Word Clock](https://img.shields.io/badge/layout-11%C3%9710-ffd78a?style=flat-square&labelColor=1a1512) ![LEDs](https://img.shields.io/badge/LEDs-114-ffd78a?style=flat-square&labelColor=1a1512) ![License](https://img.shields.io/badge/license-MIT-ffd78a?style=flat-square&labelColor=1a1512)

## How It Works

The clock displays the current time in Swedish using illuminated words on an 11x10 letter grid. Time is shown in 5-minute intervals with the prefix **KLOCKAN AR** ("the clock is"), and four corner dots indicate extra minutes within each interval.

### Swedish Time Logic

Swedish uses a "half-hour" system where times from `:25` onward reference the **next** hour:

| Time  | Display                         |
|-------|---------------------------------|
| 16:00 | KLOCKAN AR **FYRA**             |
| 16:05 | **FEM OVER** FYRA               |
| 16:10 | **TIO OVER** FYRA               |
| 16:15 | **KVART OVER** FYRA             |
| 16:20 | **TJUGO OVER** FYRA             |
| 16:25 | **FEM I HALV** FEM              |
| 16:30 | **HALV** FEM                    |
| 16:35 | **FEM OVER HALV** FEM           |
| 16:40 | **TJUGO I** FEM                 |
| 16:45 | **KVART I** FEM                 |
| 16:50 | **TIO I** FEM                   |
| 16:55 | **FEM I** FEM                   |

### Grid Layout

```
K L O C K A N d a A R        KLOCKAN ... AR
s F E M i s T I O n a        FEM(min) TIO(min)
T J U G O m i e s n d        TJUGO
K V A R T b O V E R g        KVART OVER
l I d k H A L V o t p        I HALV
E T T r T V A l s n d        ETT TVA
T R E n F Y R A o s t        TRE FYRA
F E M b S E X o S J U        FEM(hour) SEX SJU
A T T A m N I O d e k        ATTA NIO
E L V A T O L V T I O        ELVA TOLV TIO(hour)
```

> `FEM` and `TIO` appear twice each — once as minute words (row 1) and once as hour words (rows 7/9).

### Corner Dots

Four LEDs in the corners show minutes within each 5-minute block, just like a real QlockTwo:

```
+0 min   ○ ○ ○ ○     (exactly on the 5-min mark)
+1 min   ● ○ ○ ○
+2 min   ● ● ○ ○
+3 min   ● ● ● ○
+4 min   ● ● ● ●
```

## Features

- **6 color themes** — Warm White, Arctic, Matrix, Sunset, Minimal, Rose Gold (saved to localStorage)
- **Time slider** — scrub through the full 24h day to verify every time
- **Direct time input** — type exact times like `16:25` for edge case testing
- **Live mode** — syncs to your system clock in real-time
- **Click to toggle** — click any letter to manually light/dim it (shown in red) for debugging
- **Keyboard shortcuts** — arrow keys (±1 min), `L` (toggle live), `Esc` (close docs)
- **Built-in docs** — click DOCS for full reference on layout, time logic, and hardware specs
- **Single file** — zero dependencies, works offline, just open `index.html`

## Hardware Specs (Physical Build)

| Component       | Details                                      |
|-----------------|----------------------------------------------|
| LEDs            | 110x WS2812B (grid) + 4 corner dots = 114   |
| MCU             | ESP32 (WiFi for NTP time sync)               |
| Front panel     | 11x10 laser-cut faceplate, ~400x360 mm       |
| Cell size       | ~35x35 mm per letter                         |
| Diffuser        | Frosted acrylic or parchment paper           |
| LED pitch       | WS2812B strip at 30 or 60 LEDs/m             |
| Power           | 5V 3A power supply                           |

## Credits

The Swedish time-to-word mapping logic is based on [machosallad/tidsram](https://github.com/machosallad/tidsram), the only dedicated Swedish word clock project on GitHub. The 11x10 grid layout was custom-designed for denser packing compared to tidsram's 12x12.

## License

MIT
