#!/bin/bash
# Sagman — Daily PostgreSQL backup script
# Schedule with cron: 0 2 * * * /path/to/backup.sh
# Retains last 7 daily backups.

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/var/backups/sagman}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-sagman_postgres}"
POSTGRES_DB="${POSTGRES_DB:-sagman_prod}"
POSTGRES_USER="${POSTGRES_USER:-sagman}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/sagman_${DATE}.sql.gz"

# ─── Ensure backup directory exists ──────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup of $POSTGRES_DB..."

# ─── Run pg_dump inside container ────────────────────────────────────────────
docker exec "$POSTGRES_CONTAINER" \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_FILE"

echo "[$(date)] Backup saved: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# ─── Remove backups older than RETENTION_DAYS ────────────────────────────────
find "$BACKUP_DIR" -name "sagman_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "[$(date)] Cleaned up backups older than ${RETENTION_DAYS} days."

# ─── Optional: sync to S3-compatible storage ─────────────────────────────────
# Uncomment and configure if you have rclone set up:
# rclone copy "$BACKUP_DIR" remote:sagman-backups --include "*.sql.gz"
# echo "[$(date)] Synced to remote storage."

echo "[$(date)] Backup complete."
