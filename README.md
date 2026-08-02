# Swedish Word Clock Simulator

An interactive browser-based simulator for a Swedish word clock (QlockTwo-style), designed as a proof-of-concept before laser cutting and building the physical hardware.

**[Live Demo](https://grimsql.github.io/swedish-word-clock/)**

![Swedish Word Clock](https://img.shields.io/badge/layout-11%C3%9710-ffd78a?style=flat-square&labelColor=1a1512) ![LEDs](https://img.shields.io/badge/LEDs-114-ffd78a?style=flat-square&labelColor=1a1512) ![License](https://img.shields.io/badge/license-MIT-ffd78a?style=flat-square&labelColor=1a1512)

## How It Works

The clock displays the current time in Swedish using illuminated words on an 11×10 letter grid. Time is shown in 5-minute intervals with the prefix **KLOCKAN ÄR** ("the clock is"), and four corner dots indicate extra minutes within each interval.

### Swedish Time Logic

Swedish uses a "half-hour" system where times from `:25` onward reference the **next** hour:

| Time  | Display                         |
|-------|---------------------------------|
| 16:00 | KLOCKAN ÄR **FYRA**             |
| 16:05 | **FEM ÖVER** FYRA               |
| 16:10 | **TIO ÖVER** FYRA               |
| 16:15 | **KVART ÖVER** FYRA             |
| 16:20 | **TJUGO ÖVER** FYRA             |
| 16:25 | **FEM I HALV** FEM              |
| 16:30 | **HALV** FEM                    |
| 16:35 | **FEM ÖVER HALV** FEM           |
| 16:40 | **TJUGO I** FEM                 |
| 16:45 | **KVART I** FEM                 |
| 16:50 | **TIO I** FEM                   |
| 16:55 | **FEM I** FEM                   |

### Grid Layout

<pre>
<b>K L O C K A N</b> V H <b>Ä R</b>         KLOCKAN ÄR
S <b>F E M</b> I S <b>T I O</b> N A         FEM(min) TIO(min)
<b>T J U G O</b> M I E S N D         TJUGO
<b>K V A R T</b> B <b>Ö V E R</b> G         KVART ÖVER
L <b>I</b> A H <b>H A L V</b> Ö T P         I HALV
<b>E T T</b> R <b>T V Å</b> L S N D         ETT TVÅ
<b>T R E</b> N <b>F Y R A</b> O S T         TRE FYRA
<b>F E M</b> B <b>S E X</b> O <b>S J U</b>         FEM(hour) SEX SJU
<b>Å T T A</b> M <b>N I O</b> D E K         ÅTTA NIO
<b>E L V A T O L V T I O</b>         ELVA TOLV TIO(hour)
</pre>

> `FEM` and `TIO` appear twice each — once as minute words (row 1) and once as hour words (rows 7/9). **Bold** = active letters, normal = filler.

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

## Physical Build — `johniak-sv/`

The physical clock is a Swedish remix of [johniak/word-clock](https://github.com/johniak/word-clock) using **this repo's exact 11×10 letter grid** — cross-checked against the simulator's `GRID_LETTERS` on every generation, so the printed front and the simulator can never diverge.

| Component   | Details                                                        |
|-------------|----------------------------------------------------------------|
| Shell       | 3D-printed, 187×179 mm, letters printed in place (AMS: black + transparent) |
| LEDs        | 110× WS2812B — **74 LEDs/m strip**, 10 uncut rows of 11 (13.51 mm pitch) |
| Back plate  | 3D-printed: ESP32 bay, keyhole wall-hanger, alignment pegs, cable channel |
| MCU         | ESP32 DevKit v1 (WiFi/NTP), firmware = johniak's + Swedish patch |
| Power       | 5V 3A                                                          |

Generator, print files (`PRINTA/`), firmware patch and full build guide: [`johniak-sv/README.md`](johniak-sv/README.md).

Earlier build tracks (laser-cut S/M/L faceplates, 3×3-tiled L print, 18 mm mini variants) are removed from the tree but remain in git history.

## Credits

The Swedish time-to-word mapping logic is based on [machosallad/tidsram](https://github.com/machosallad/tidsram), the only dedicated Swedish word clock project on GitHub. The 11x10 grid layout was custom-designed for denser packing compared to tidsram's 12x12.

## License

MIT
