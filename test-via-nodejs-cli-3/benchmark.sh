#!/usr/bin/env bash
set -e
npm run benchmark -- \
  --db-path test_reads.sqlite3 \
  --rows 2000 \
  --processes 2 \
  --threads-per-proc 16 \
  --queries-per-thread 175 \
  --pin-cpus
