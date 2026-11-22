# OSRS Slayer Helper

A self-hosted PWA for Old School RuneScape slayer. Type a monster and get:

- **Do / Skip / Block** for your slayer master, with the reason (how far above or below your average rate it is, how often it comes up, and its cost in hours or points).
- **Best way to kill it** for your settings: every method compared on XP/h, GP/h, kills/h and task time, plus extend and bracelet tips.
- **Where and how to get there**: Wiki location table (multi-combat / cannon / safespot, notes), a link to the interactive map, and transport from each location's Wiki page.
- **How to fight it**: requirements, attack style and the prayer to use, max hit, lowest defence, elemental weakness, attribute hints (demon, dragon, undead…) and items to bring.
- **Gear tiered by budget** from the Wiki's recommended-equipment tables, with the tier for your budget highlighted. Also example setups, inventory and full strategy notes.
- **Masters** tab: full block and skip list, expected XP/h, GP/h and points balance for each master.
- **Settings**: goal (XP / profit / balanced), Slayer and combat levels, Ancients, cannon, Wilderness, boss variants, slayer helm, gear budget and block slots. Overrides for single tasks are saved on the device.

## Data

| Source | What | Refresh |
| --- | --- | --- |
| [Slayer efficiency sheet](https://docs.google.com/spreadsheets/d/1WM2rbCBiNTyOXTwOwXO6WltO4dfPO7cler4-ruCet7o) | master weights, task lengths, author's do/skip/block, per-method kills/xp/gp per hour | `npm run sync:sheet` |
| OSRS Wiki (`Slayer task/*`, monster pages, `*/Strategies`, location pages) | requirements, locations, transport, tiered gear, strategy | `npm run sync:wiki` |

Both are snapshotted into `public/data/*.json` and precached by the service worker, so the app works offline. Each monster page also has **Refresh from the Wiki** for live data, and any name not in the snapshot can be looked up live from the search box.

## Develop

```sh
npm install
npm run sync      # optional: refresh sheet + wiki snapshot
npm run dev       # http://localhost:5173
npm run build     # -> dist/
```

`dist/` is committed on purpose: the server only needs Python 3 (no Node), like osrs_flipper.

## Deploy (Mikasa, same pattern as osrs_flipper)

- Code in `/opt/osrs_slayer`, owned by the `osrs` user
- systemd `osrs-slayer.service` runs `python3 server.py --host 127.0.0.1 --port 8766`
- Caddy serves `slayer.home.arpa` with `tls internal` and a reverse proxy to it
- Pi-hole has a local DNS record `slayer.home.arpa -> 192.168.1.122`

First install (as root on Mikasa): `bash deploy/install.sh`

Update later:

```sh
sudo -u osrs git -C /opt/osrs_slayer pull && sudo systemctl restart osrs-slayer
```
