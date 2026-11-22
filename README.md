# OSRS Slayer Helper

A self-hosted PWA for Old School RuneScape slayer. Type a monster and the task page shows (side by side on wide screens, gear in its own column):

- **Do / Skip / Block** for your slayer master, with a one-line reason. Tap "change" to override it for this device.
- **Best method**: XP/h, GP/h and task time for your settings, plus extend and bracelet tips.
- **Where**: the location that fits the best method. Tap "change" to pick another one.
- **Bring**: protection prayer and required slayer items, as icons.
- **Gear**: the item for your budget in every slot, laid out like the worn-equipment screen. It opens on the combat style of the best method.
- **Getting to ...**: a Wiki map of the chosen location with a pin and a world-overview inset. For underground spots, a second map shows the surface entrance. Next to it, the teleports and transport the Wiki names (item and spell icons, fairy ring codes), fastest first; tap one for the Wiki sentence. The full Wiki text is under "Directions".

Everything else sits under **More**: all methods compared, monster stats and weaknesses, all gear tiers, example setups, inventory, strategy notes and monster variants.

Other tabs:

- **Masters**: block and skip list, expected XP/h, GP/h and points for each master.
- **Mortimer**: his own task list from the Wiki, 2 block slots and a 100 point skip. He offers 2 or 3 tasks, each with a modifier. Enter them in "Pick Mortimer's task" and it ranks them for your goal. The XP modifier scales the task's XP/h. The other modifiers break ties.
- **Settings**: goal (XP / profit / balanced), Slayer and combat levels, Ancients, cannon, Wilderness, boss variants, slayer helm, gear budget and block slots.

## Data

| Source | What | Refresh |
| --- | --- | --- |
| [Slayer efficiency sheet](https://docs.google.com/spreadsheets/d/1WM2rbCBiNTyOXTwOwXO6WltO4dfPO7cler4-ruCet7o) | master weights, task lengths, author's do/skip/block, per-method kills/xp/gp per hour | `npm run sync:sheet` |
| OSRS Wiki (`Slayer task/*`, monster pages, `*/Strategies`, location pages, `Mortimer`) | requirements, locations, transport, tiered gear, strategy, Mortimer's task list, image sizes | `npm run sync:wiki` |

Both are snapshotted into `public/data/*.json` and precached by the service worker, so the app works offline. Each monster page also has **Refresh from the Wiki** for live data, and any name not in the snapshot can be looked up live from the search box.

Monster renders, chatheads and item icons load straight from the Wiki. The service worker keeps them in a cache for 90 days, so they also work offline once seen. The pixel fonts are the [RuneStar fonts](https://github.com/RuneStar/fonts) (CC0), bundled in `public/fonts/`.

## Develop

```sh
npm install
npm run sync      # optional: refresh sheet + wiki snapshot
npm run dev       # http://localhost:5173
npm run build     # -> dist/
npm test          # bun test: parsing, Mortimer rules, offer ranking
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
