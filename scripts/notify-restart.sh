#!/usr/bin/env bash
#
# Warns the connected players that the server is going away and writes the
# snapshot, over HTTP, from the outside.
#
# Why this exists: the in-process SIGTERM handler is the normal path, but it
# only works when the signal actually reaches node. A supervisor that kills the
# cgroup outright (or a shim that swallows the signal) leaves the players with a
# silent disconnect and the snapshot stale. `ExecStop=` runs *before* systemd
# sends SIGTERM, so this path works even when the signal never lands.
#
# Usage:
#   scripts/notify-restart.sh [restart|shutdown]
#
# Environment (taken from the unit's EnvironmentFile):
#   PORT                 server port, default 3101
#   STATE_SAVE_TOKEN     shared secret for the admin routes, required
#
set -uo pipefail

PORT="${PORT:-3101}"
TOKEN="${STATE_SAVE_TOKEN:-}"
REASON="${1:-restart}"

if [[ -z "$TOKEN" ]]; then
  echo "notify-restart: STATE_SAVE_TOKEN is unset, cannot announce" >&2
  exit 1
fi

# -f: a 404 (wrong token, persistence off) or a 5xx must fail the unit stop,
# so the journal shows it instead of pretending the players were warned.
if ! response="$(curl -fsS -m 10 -X POST \
  -H "x-state-token: $TOKEN" \
  "http://127.0.0.1:$PORT/admin/state/restart?reason=$REASON")"; then
  echo "notify-restart: request failed (port $PORT, reason $REASON)" >&2
  exit 1
fi

echo "notify-restart: $response"
