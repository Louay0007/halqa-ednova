# HALQA deployment — coexisting with the Zaino gateway

HALQA (WIE ACT 5.0 / EdNova challenge) runs on the **app VPS**, the Zaino
gateway on the **DB VPS**. They are on separate machines, in separate compose
projects, with separate edges. Neither can restart, starve, or misconfigure the
other.

## Topology

| | Host | Compose project | Edge | Domain |
|---|---|---|---|---|
| Zaino gateway | `197.5.133.66` (`event-toolbox-db`) | `gateway` (9 containers) | Caddy, host net | `zaino.soon.it`, `api.zaino.soon.it` |
| HALQA | `197.5.133.70` (`event-toolbox-app`) | `halqa` (3 containers) | Caddy, container :80/:443 | `halaqa.197.5.133.70.sslip.io` |
| Event Toolbox | `.70` + `.66` | `event-toolbox*` | host nginx | **paused** |

The app VPS was chosen deliberately: 6 vCPU / 11 GB with Docker empty, versus
the DB VPS at 2 vCPU / 3.8 GB where LiteLLM alone holds ~1 GB. Putting HALQA on
the DB VPS would have risked an OOM against a live billing gateway.

## Model provider: aipilot, direct

HALQA calls **aipilot directly** — the same upstream the Zaino gateway proxies —
not through the gateway:

```dotenv
PROVIDER_BASE_URL=https://aipilot-api.ouedernidev.workers.dev   # no /v1 suffix
PROVIDER_API_KEY=ap_liv_...
COMPACT_MODEL=haiku-5.5    # C tier
LARGER_MODEL=sonnet-5.5    # L tier
```

Two details that cost time to get right:

- The base must **omit `/v1`**. The adapter appends `/v1/chat/completions`
  itself; a base ending in `/v1` produces `/v1/v1/...` and a 404.
- Model names are bare (`haiku-5.5`), not the gateway's aliases (`fast`,
  `smart`). Aliases only exist inside LiteLLM.

A stale `ap_` key and the retired `aipilot-weld.vercel.app` host both answer
`401 {"message":"Clé API invalide"}` — that is a credential/URL problem, not a
network one.

## Bring-up from scratch

```bash
ssh event-toolbox-app
cd /opt/halqa
sudo docker compose --env-file .env -f deploy/compose.yaml --project-directory deploy up -d
```

Always pass `--env-file .env` and `--project-directory deploy`: compose would
otherwise look for `.env` inside `deploy/`. Same reason the Mongo keyfile mount
is `../secrets/mongodb-keyfile` — a wrong path silently becomes an empty
directory and mongod reports "permissions too open", which looks like a chmod
bug and is not one.

### Replica-set trap (already fixed, do not regress)

Mongo initialises `rs0` with host `mongo:27017`, **not** `localhost:27017`. A
replica set advertises its members and clients reconnect to the advertised host,
so `localhost` makes the API resolve the database to itself and die with
`MongooseServerSelectionError: Server selection timed out after 5000 ms`. If a
fresh volume is ever initialised by hand, reconfig to the service name.

## Verify

```bash
curl -s https://halaqa.197.5.133.70.sslip.io/api/v1/healthz
curl -s https://halaqa.197.5.133.70.sslip.io/api/v1/readyz   # mongo connected + kbDocs>0
curl -s https://halaqa.197.5.133.70.sslip.io/api/v1/degradation   # {"mode":"green"}
```

A model call is only proven by the ledger, not by a plausible-looking string:
`solo/sessions/:sid/turn` and `/sessions/:sid/capsule` are real C/L calls.

```bash
docker exec halqa-mongo-1 mongosh -u "$MONGO_INITDB_ROOT_USERNAME" \
  -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin halqa \
  --eval 'db.llm_calls.find({},{tier:1,step:1,latencyMs:1,fallback:1,_id:0})'
```

Last verified: `solo_turn` C 3365 ms, `capsule_polish` L 7049 ms, both
`fallback` absent.

## Isolation rules

- Every command is scoped: `-p halqa` or `--project-directory deploy`. Never a
  bare `docker compose down`, `docker stop $(docker ps -q)`, or
  `docker system prune` on either box.
- HALQA publishes only 80/443. Mongo and the API have **no** host port, so the
  database is reachable only from the `halqa-internal` network.
- The gateway was not modified at any point; its 9 containers and both public
  endpoints were re-verified after HALQA went live.

## DNS

The current name is a **placeholder**: `halaqa.197.5.133.70.sslip.io` encodes
the IP in the hostname, so it resolves with no registrar access and still gets a
real Let's Encrypt certificate (valid to 2027-02-18, HTTP-01). It is correct and
testable but not a name to put on a poster.

To move to a real domain (e.g. `halaqa.wie-act.tn`) once DNS access is
available:

1. Create an **A record → `197.5.133.70`**, DNS-only (no proxy). HTTP-01 needs
   the name to point straight at the box.
2. Update `.env`: `HALQA_DOMAIN`, `HALQA_ORIGIN=https://<new>`, and
   `CORS_ORIGINS=https://<new>`.
3. Rebuild the edge, because `VITE_API_BASE` is baked into the bundle at build
   time:
   `sudo docker compose --env-file .env -f deploy/compose.yaml --project-directory deploy build edge`
4. `up -d edge`. Caddy issues the new cert on first request.

Skipping step 3 leaves a bundle pointing at the old origin — the page loads and
every API call fails.

## Capacity

HALQA requests 1.5 GB (mongo) + 1 GB (api); the box has 11 GB and ~9.7 GB free
after boot. `--wiredTigerCacheSizeGB 0.5` stops Mongo reserving 50% of RAM by
default, which on a shared box would be ~5 GB for nothing.
