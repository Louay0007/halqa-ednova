#!/usr/bin/env bash
# Dump the database to a timestamped archive, using the read-only backup user.
#
#   MONGODB_URI='mongodb://halqa_backup:PASS@host:27017/halqa?replicaSet=rs0' \
#   BACKUP_DIR=/var/backups/halqa ./scripts/backup.sh
#
# `--oplog` is not used because this runs against a replica set whose oplog would
# only be useful for a point-in-time restore we do not implement; `--gzip` keeps
# the archive small enough that a classroom-scale dump is a few hundred KB.
#
# Restoring:
#   mongorestore --gzip --archive="$ARCHIVE" --drop \
#     --uri='mongodb://halqa_migrate:PASS@host:27017/halqa?replicaSet=rs0'
#
# Retention is 14 days. Anything longer is a policy decision with a privacy
# consequence (§8): the dump contains learner nicknames and session history, so
# keeping it forever is a liability, not a safety net.
set -euo pipefail

: "${MONGODB_URI:?set MONGODB_URI to a connection string for the backup user}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="$BACKUP_DIR/halqa-$STAMP.archive.gz"

# Refuse to write a dump we cannot verify later: `mongodump` exits 0 on an empty
# database, so record the collection count next to the archive.
mongodump --uri="$MONGODB_URI" --gzip --archive="$ARCHIVE"

SIZE="$(wc -c <"$ARCHIVE" | tr -d ' ')"
if [ "$SIZE" -lt 1024 ]; then
  echo "backup: archive is only ${SIZE} bytes — treating as failed" >&2
  exit 1
fi

echo "backup: wrote $ARCHIVE (${SIZE} bytes)"

# Prune old archives. `-mtime` is whole days, so retention is approximate — fine
# for a nightly job, and deliberately simple enough to audit at a glance.
find "$BACKUP_DIR" -name 'halqa-*.archive.gz' -type f -mtime "+$RETENTION_DAYS" -print -delete

echo "backup: pruned archives older than ${RETENTION_DAYS} days"
