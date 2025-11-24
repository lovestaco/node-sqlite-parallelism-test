#!/bin/bash
# Quick test script to verify the benchmark works

echo "Testing Node.js SQLite benchmark..."
echo ""

# Run with minimal parameters to test quickly
timeout 30 node sqlite_read_bench.js \
  --db-path test_quick.sqlite3 \
  --rows 100 \
  --processes 2 \
  --threads-per-proc 4 \
  --queries-per-thread 50 \
  --pin-cpus

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✓ Test completed successfully!"
    rm -f test_quick.sqlite3*
elif [ $EXIT_CODE -eq 124 ]; then
    echo ""
    echo "✗ Test timed out (script is hanging)"
    exit 1
else
    echo ""
    echo "✗ Test failed with exit code: $EXIT_CODE"
    exit $EXIT_CODE
fi
