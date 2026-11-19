# Operations runbook — HALQA

One page for the things that go wrong. Everything here has been exercised at least
once in staging; nothing is aspirational.

## Restore a database

The API runs as a least-privilege user that cannot drop collections, so a restore
needs the migration user. Load the roles once per environment:

```bash
# The URI is assembled from env vars rather than written with a password in it,
# so this page never contains a credential and the secrets scan stays clean.
export ADMIN_URI="mongodb://admin:${MONGO_ADMIN_PWD}@${MONGO_HOST}/admin"
HALQA_API_PWD=... HALQA_BACKUP_PWD=... HALQA_MIGRATE_PWD=... \
  npm run mongo:roles
```

Nightly dump (read-only credential, 14-day retention):

```bash
# halqa_backup is read-only, so a leaked backup credential cannot corrupt data.
export MONGODB_URI="mongodb://halqa_backup:${HALQA_BACKUP_PWD}@${MONGO_HOST}/halqa?replicaSet=rs0"
BACKUP_DIR=/var/backups/halqa npm run backup
```

Restore:

```bash
mongorestore --gzip --archive=/var/backups/halqa/halqa-<stamp>.archive.gz --drop \
  --uri="mongodb://halqa_migrate:${HALQA_MIGRATE_PWD}@${MONGO_HOST}/halqa?replicaSet=rs0"
npm run migrate:indexes   # dumps do not carry indexes built since the dump
npm run reconcile:xp      # verify the ledger still matches the read model
```

A restore is not done until `reconcile:xp` exits 0. A database that answers
requests but has drifted XP totals is worse than one that refuses to start.

## Rotate the token secret

No learner is signed out if you follow the two-release order:

1. Set `TOKEN_SECRET_PREVIOUS` to the **current** `TOKEN_SECRET`.
2. Set `TOKEN_SECRET` to the new value. Deploy. Both are accepted, so live tokens
   keep working while new ones are signed with the new secret.
3. Wait at least `ACCESS_TTL_S` (2 h) — one release is plenty.
4. Remove `TOKEN_SECRET_PREVIOUS`. Deploy.

Rotating in one step logs every learner out mid-lesson. `verifyToken` accepts both
secrets precisely so that is avoidable.

Emergency rotation (secret leaked): skip the overlap, accept the mass logout, and
bump every epoch with `db.learners.updateMany({}, { $inc: { tokenEpoch: 1 } })`.
Also rotate `PROVIDER_API_KEY`.

## Force degradation

```bash
curl -X POST https://api.example/api/v1/chaos \
  -H "Authorization: Bearer <admin token>" \
  -H 'content-type: application/json' -d '{"mode":"black"}'
curl https://api.example/api/v1/degradation   # public: what the banner reads
```

Modes: `green` → `orange` (L unavailable) → `red` (C unreliable) → `black` (offline
pack only). `/chaos` is mounted only when `NODE_ENV !== 'production'` **and**
`CHAOS_ENABLED=true`, and is admin-only regardless. In production, degradation is
driven by the provider probe, not by this endpoint.

## Alerts worth having

| Signal | Query | Threshold |
|---|---|---|
| Settle backlog | `halqa_settle_lag_seconds` | > 30 s for 5 min |
| Server errors | `rate(halqa_http_requests_total{status=~"5.."}[5m])` | > 1% for 5 min |
| L-tier spend | `halqa_llm_calls_total{tier="L"}` share | > 0.25 for 15 min |
| Quota headroom | `halqa_quota_remaining` | < 10% |
| Degradation | `halqa_degradation_mode` | > 0 for 5 min |

`/metrics` (Prometheus format) is admin-only at `/api/v1/prom/metrics`; the scrape
config carries the credential. `/api/v1/metrics` is the JSON view for the
dashboard.

## Data retention

| Collection | Kept | Mechanism |
|---|---|---|
| `learners` | until deletion + 30 d grace, then tombstoned | `npm run purge:learners -- --apply` |
| `learner_progress`, `xp_ledger` | 2 years | audit trail; purged with the learner |
| `sessions` | 2 years | manual |
| `telemetry_events` | 90 days | TTL index on `ts` |
| `llm_calls` | 180 days | TTL index on `ts` |
| `cache_entries` | until `expiresAt` | TTL index |

TTL indexes are pruned by mongod within ~60 s of expiry, so "90 days" means
"90 days give or take a minute". Schedule the purge job nightly; a day of drift on
a 30-day deadline is not a meaningful delay.

Export and erasure are self-service: `GET /api/v1/me/export` returns everything
stored about the caller, `DELETE /api/v1/me` starts the grace window and revokes
access immediately, `POST /api/v1/me/restore` cancels it.

## Performance targets (§9)

| Measure | Target | How to check |
|---|---|---|
| `GET /questions/:qid/state` p95 | < 50 ms | `halqa_http_request_duration_seconds{route="/questions/:qid/state"}` |
| Poller 304 rate | > 90% | `halqa_http_requests_total{status="304"}` / total for the route |
| Polled payload | < 1 KB | asserted in `cfas-slice.spec.ts` and `requests.spec.ts` |
| Circle daily model calls | < `CIRCLE_DAILY_CALLS` (400) | `halqa_circle_daily_calls` |

The poller is the load that matters: 200 learners on 1.5 s/4 s/5 s intervals is
the steady state, and the design depends on ETags so almost every request is a
304 with no body. If the 304 rate falls, the ETag input has become
viewer-dependent — check that nothing viewer-specific crept into the state
payload, because that silently turns a cache into a per-learner query.

## Model calls

C (compact) and L (larger) routing is documented in the plan. Every call records
step, tier, token counts, latency, cache hit and fallback — **no prompt and no
learner text**. Learner text passes the scrubber before it is sent, and the
scrubber's replacement map is not persisted. If you need to debug a bad response,
reproduce it from the step name and the KB chunks, not by logging prompts.

## Rollback

The previous image is always deployable: migrations are additive for one release,
so `NODE_ENV=production` with the prior tag works against the current schema. Roll
back by redeploying the prior image, then confirm `readyz` and run
`npm run smoke:live` against the revision. Never roll back by reverting a
migration — the data has already moved.
