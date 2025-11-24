#!/bin/bash

# Test script for sqlite_read_bench.js

echo "=== Test 1: Small benchmark (2 processes × 16 threads) ==="
node sqlite_read_bench.js \
  --db-path test_reads.sqlite3 \
  --rows 2000 \
  --processes 2 \
  --threads-per-proc 16 \
  --queries-per-thread 175 \
  --pin-cpus

echo ""
echo "=== Test 2: Larger thread count (2 processes × 26 threads) ==="
node sqlite_read_bench.js \
  --db-path test_reads.sqlite3 \
  --rows 2000 \
  --processes 2 \
  --threads-per-proc 26 \
  --queries-per-thread 175 \
  --pin-cpus

echo ""
echo "Tests completed!"
