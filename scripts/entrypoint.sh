#!/bin/bash
set -e

# Set the database path - use DATABASE_URI if set, otherwise default to /app/data
DATABASE_URI=${DATABASE_URI:-"/app/data/db.sqlite"}
DB_DIR=$(dirname "$DATABASE_URI")

# Create the database directory if it doesn't exist
mkdir -p "$DB_DIR"

# Restore the database if it does not already exist and RESTORE_DB is true
if [ -f "$DATABASE_URI" ]; then
	echo "Database already exists at $DATABASE_URI, skipping restore"
else
	if [ "${RESTORE_DB}" = "true" ]; then
		echo "No database found at $DATABASE_URI, restoring from replica if exists"
		litestream restore  -if-replica-exists "$DATABASE_URI"
	else
		echo "No database found at $DATABASE_URI but RESTORE_DB is not set to true, skipping restore"
	fi
fi

if [ "${REPLICATE_DB}" = "true" ]; then
	echo "Running litestream with modmail as subprocess for database replication"
	exec litestream replicate -exec "bun run /app/src/index.ts"
else
	echo "REPLICATE_DB != true, running modmail without database replication"
	exec bun run /app/src/index.ts
fi
