#!/bin/bash
# Compare results

OUTPUT_DIR="results"
FILE="$OUTPUT_DIR/benchmark.txt"

if [ ! -f "$FILE" ]; then
    echo "Results file not found: $FILE"
    echo "Run 'npm run benchmark-n-connection' first."
    exit 1
fi

echo "=== Results for Multiple Connections ==="
echo "File: $FILE"
echo ""

grep "CONCURRENCY=" "$FILE" || echo "No results found"
