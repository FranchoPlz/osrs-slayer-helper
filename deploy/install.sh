#!/usr/bin/env bash
# One-time install on Mikasa (run as root). Mirrors the osrs_flipper setup.
set -euo pipefail
SRC="${1:-/home/mikasa/osrs_slayer}"     # staged checkout
DEST=/opt/osrs_slayer

id osrs >/dev/null 2>&1 || useradd --system --home "$DEST" --shell /usr/sbin/nologin osrs
mkdir -p "$DEST"
cp -a "$SRC"/. "$DEST"/
chown -R osrs:osrs "$DEST"
git config --system --add safe.directory "$DEST" || true

install -m 644 "$DEST/deploy/osrs-slayer.service" /etc/systemd/system/osrs-slayer.service
systemctl daemon-reload
systemctl enable --now osrs-slayer.service

if ! grep -q 'slayer.home.arpa' /etc/caddy/Caddyfile; then
  cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.before-slayer"
  cat "$DEST/deploy/Caddyfile.snippet" >> /etc/caddy/Caddyfile
fi
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy

sleep 1
curl -fsS -o /dev/null -w "local server: HTTP %{http_code}\n" http://127.0.0.1:8766/
echo "Done: https://slayer.home.arpa"
