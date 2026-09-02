#!/usr/bin/env python3
"""Skapar ordklockans WLED-presets. Idempotent - kor om nar du vill andra nagot.

Presets 1-5 kor klocklaget pa (usermoden maskerar, effekten lyser genom orden).
Presets 6-12 slar av klocklaget och later effekten aga hela 11x10-matrisen.

Klocklaget ligger i /json/state som {"Ordklockan":{"on":bool}}, och WLED:s
savePreset -> serializeState -> UsermodManager::addToJsonState fangar det. Darfor
kan en preset byta lage, vilket ar hela poangen med scenknapparna.

  python presets.py            # skapa/uppdatera alla
  python presets.py --list     # visa vad som ligger pa enheten
"""

import argparse
import json
import time
import urllib.request

HOST = "192.168.30.17"

# (slot, namn, lage, fx, palett, ljusstyrka, hastighet, intensitet, primarfarg)
# lage: "klocka" | "hjarta" | "stjarna" | "av"  -- usermodens visningslage.
# OBS: laget sparas INTE i presetet (WLED utesluter usermod-tillstand nar en
# preset sparas). Det satts separat harifran, och i drift av HA-scriptet.
PRESETS = [
    # --- klocklage pa -----------------------------------------------------
    (1,  "Klockläge",      "klocka",   0,  0, 128, 128, 128, (255, 214, 170)),
    (2,  "Lugn kväll",     "klocka",   0,  0,  55, 128, 128, (255, 150,  50)),
    (3,  "Natt",           "klocka",   0,  0,  12, 128, 128, (255,  40,   0)),
    (4,  "Regnbågsklocka", "klocka", 180, 11, 110,  60, 128, (255, 160,   0)),
    (5,  "Norrskensklocka","klocka", 174,  0, 100,  70, 128, (255, 160,   0)),
    # --- figurer ----------------------------------------------------------
    (13, "Hjärta",         "hjarta",   0,  0, 120, 128, 128, (255,   0,  40)),
    (14, "Stjärna",        "stjarna",  0,  0, 120, 128, 128, (255, 200,  60)),
    (15, "Hjärtslag",      "hjarta",   2,  0, 150,  90, 128, (255,   0,  40)),
    # --- hela matrisen ----------------------------------------------------
    (6,  "Eld",            "av",     149,  8, 140, 130, 140, (255, 160,   0)),
    (7,  "Matrix",         "av",     153,  0, 120, 130, 128, (  0, 255,   0)),
    (8,  "Plasma",         "av",     178, 11, 130, 128, 128, (255, 160,   0)),
    (9,  "Fyrverkeri",     "av",      42,  6, 150, 130, 128, (255, 160,   0)),
    (10, "Bläckfisk",      "av",     126, 11, 130, 110, 128, (255, 160,   0)),
    (11, "Svart hål",      "av",     183,  0, 130, 128, 128, (255, 160,   0)),
    (12, "Party",          "av",     167,  6, 200, 160, 180, (255, 160,   0)),
]


def post(path, payload):
    # ensure_ascii=False ar inte kosmetik. WLED avkodar INTE JSON:s \uXXXX-
    # escapes, sa ett a-umlaut skickat i escapad form lagras som de sex
    # tecknen backslash-u-0-0-e-4 i preset-namnet. Da matchar inget namn nar
    # Home Assistant sedan ska valja presetet. Skicka rå UTF-8 i stallet.
    req = urllib.request.Request(
        f"http://{HOST}{path}",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.read().decode()


def get(path):
    with urllib.request.urlopen(f"http://{HOST}{path}", timeout=10) as r:
        return json.loads(r.read().decode())


def build(slot, name, lage, fx, pal, bri, sx, ix, col):
    state = {
        "on": True,
        "bri": bri,
        "transition": 7,
        "Ordklockan": {"mode": lage},
        "seg": [{
            "id": 0, "fx": fx, "pal": pal, "sx": sx, "ix": ix,
            "frz": False, "on": True, "bri": 255,
            "col": [list(col), [0, 0, 0], [0, 0, 0]],
        }],
    }
    post("/json/state", state)
    time.sleep(0.5)                       # lat WLED applicera innan vi laser av
    post("/json/state", {"psave": slot, "n": name, "ib": True, "sb": True})
    time.sleep(0.4)                       # skrivning till filsystemet


def main():
    global HOST
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--host", default=HOST)
    a = ap.parse_args()
    HOST = a.host

    if a.list:
        for k, v in sorted(get("/presets.json").items(), key=lambda x: int(x[0])):
            if isinstance(v, dict) and v.get("n"):
                wc = v.get("Ordklockan", {}).get("mode")
                seg = (v.get("seg") or [{}])[0]
                print(f"{k:>3}  {v['n']:<16} lage={str(wc):<8} fx={seg.get('fx')} bri={v.get('bri')}")
        return

    for p in PRESETS:
        build(*p)
        print(f"  {p[0]:>2}  {p[1]:<16} lage={p[2]:<8} fx={p[3]}")

    print(f"\n{len(PRESETS)} presets skrivna till {HOST}")


if __name__ == "__main__":
    main()
