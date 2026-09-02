#!/usr/bin/env python3
"""Tanda svenska ordklockans ord via WLED:s JSON-API, utan att flasha firmware.

Samma ordtabell och samma femminuterslogik som usermoden. Poangen ar att kunna
verifiera att ratt bokstaver tands INNAN en firmware byggs och flashas -- om
tabellen ar fel syns det har, med bokstavsplattan pa.

Ordtabellen ar FYSISKA LED-index (words_sv.h, genererad av generate.js).
WLED:s JSON-API adresserar daremot i 2D-lasordning, dar index 0 ar ovre vanstra
hornet. Skriptet konverterar.

  python ordtest.py 16:25          -> KLOCKAN AR FEM I HALV FEM
  python ordtest.py --word KVART   -> tandar bara ett ord
  python ordtest.py --all          -> gar igenom alla 12 femminutersblock
  python ordtest.py --off
"""

import argparse
import json
import sys
import time
import urllib.request

HOST = "192.168.30.17"
WIDTH, HEIGHT = 11, 10
NUM_LEDS = WIDTH * HEIGHT

# Fysiska LED-index, inklusive bada andar. Kalla: johniak-sv/firmware/words_sv.h
WORDS = {
    "KLOCKAN": (103, 109),
    "AR":      (99, 100),
    "FEM_MIN": (89, 91),
    "TIO_MIN": (94, 96),
    "TJUGO":   (83, 87),
    "KVART":   (66, 70),
    "OVER":    (72, 75),
    "I":       (64, 64),
    "HALV":    (58, 61),
    "HOUR_1":  (44, 46),   # ETT
    "HOUR_2":  (48, 50),   # TVA
    "HOUR_3":  (41, 43),   # TRE
    "HOUR_4":  (36, 39),   # FYRA
    "HOUR_5":  (22, 24),   # FEM
    "HOUR_6":  (26, 28),   # SEX
    "HOUR_7":  (30, 32),   # SJU
    "HOUR_8":  (18, 21),   # ATTA
    "HOUR_9":  (14, 16),   # NIO
    "HOUR_10": (8, 10),    # TIO
    "HOUR_11": (0, 3),     # ELVA
    "HOUR_12": (4, 7),     # TOLV
}

HOUR_TEXT = ["", "ETT", "TVA", "TRE", "FYRA", "FEM", "SEX",
             "SJU", "ATTA", "NIO", "TIO", "ELVA", "TOLV"]

# minut//5 -> (ord, text, refererar nasta timme)
BLOCKS = [
    ([],                            "",                 False),  # :00
    (["FEM_MIN", "OVER"],           "FEM OVER",         False),  # :05
    (["TIO_MIN", "OVER"],           "TIO OVER",         False),  # :10
    (["KVART", "OVER"],             "KVART OVER",       False),  # :15
    (["TJUGO", "OVER"],             "TJUGO OVER",       False),  # :20
    (["FEM_MIN", "I", "HALV"],      "FEM I HALV",       True),   # :25
    (["HALV"],                      "HALV",             True),   # :30
    (["FEM_MIN", "OVER", "HALV"],   "FEM OVER HALV",    True),   # :35
    (["TJUGO", "I"],                "TJUGO I",          True),   # :40
    (["KVART", "I"],                "KVART I",          True),   # :45
    (["TIO_MIN", "I"],              "TIO I",            True),   # :50
    (["FEM_MIN", "I"],              "FEM I",            True),   # :55
]


def physical_to_2d(p):
    """Fysiskt LED-index -> WLED:s 2D-lasordningsindex.

    Kopplingen: LED 0 nere till vanster, serpentin, 11 per rad. Rad 0 raknat
    nerifran gar vanster->hoger, nasta hoger->vanster, och sa vidare.
    """
    r = p // WIDTH            # 0 = nedersta raden
    k = p % WIDTH
    x = k if r % 2 == 0 else (WIDTH - 1 - k)
    y = (HEIGHT - 1) - r      # 2D raknar uppifran
    return y * WIDTH + x


def leds_for_words(names):
    out = set()
    for n in names:
        if n not in WORDS:
            sys.exit(f"okant ord: {n}\nfinns: {', '.join(sorted(WORDS))}")
        a, b = WORDS[n]
        out.update(range(a, b + 1))
    return out


def words_for_time(hh, mm):
    block = (mm // 5) % 12
    parts, text, next_hour = BLOCKS[block]
    names = ["KLOCKAN", "AR"] + list(parts)

    h = hh % 12
    if h == 0:
        h = 12
    if next_hour:
        h = (h % 12) + 1

    names.append(f"HOUR_{h}")
    label = " ".join(x for x in ["KLOCKAN AR", text, HOUR_TEXT[h]] if x)
    return names, label


def post(payload):
    req = urllib.request.Request(
        f"http://{HOST}/json/state",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=8) as r:
        return r.read().decode()


def blank(bri=60):
    post({"on": True, "bri": bri,
          "seg": [{"id": 0, "fx": 0, "frz": False, "col": [[0, 0, 0]]}]})


def show(names, colour="FFFFFF", bri=60):
    blank(bri)
    idx = sorted(physical_to_2d(p) for p in leds_for_words(names))
    # ett anrop per LED-lopa; i maste skickas ensamt
    payload = []
    for i in idx:
        payload += [i, colour]
    post({"seg": [{"i": payload}]})
    return idx


def main():
    global HOST
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("tid", nargs="?", help="HH:MM att visa")
    ap.add_argument("--word", action="append", help="tand ett enskilt ord")
    ap.add_argument("--all", action="store_true", help="ga igenom alla 12 block")
    ap.add_argument("--off", action="store_true", help="slack allt")
    ap.add_argument("--colour", default="FFFFFF")
    ap.add_argument("--bri", type=int, default=60)
    ap.add_argument("--host", default=HOST)
    a = ap.parse_args()

    HOST = a.host

    if a.off:
        post({"on": False})
        print("slackt")
        return

    if a.word:
        idx = show(a.word, a.colour, a.bri)
        print(f"{' '.join(a.word)}  ->  {len(idx)} LEDs, 2D-index {idx}")
        return

    if a.all:
        for mm in range(0, 60, 5):
            names, label = words_for_time(16, mm)
            show(names, a.colour, a.bri)
            print(f"16:{mm:02d}  {label}")
            time.sleep(3)
        return

    if not a.tid:
        ap.error("ange en tid (HH:MM), --word, --all eller --off")

    hh, mm = (int(x) for x in a.tid.split(":"))
    names, label = words_for_time(hh, mm)
    idx = show(names, a.colour, a.bri)
    print(f"{a.tid}  ->  {label}   ({len(idx)} LEDs)")


if __name__ == "__main__":
    main()
