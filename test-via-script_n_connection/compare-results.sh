#!/bin/bash
# Compare results from different thread pool sizes

OUTPUT_DIR="results"

if [ ! -d "$OUTPUT_DIR" ]; then
    echo "Results directory not found. Run run-thread-pool-tests.sh first."
    exit 1
fi

echo "=== Comparison of Results by Thread Pool Size ==="
echo "Using MULTIPLE database connections"
echo ""

for size in 2 3 8; do
    file="$OUTPUT_DIR/threadpool-${size}.txt"
    if [ -f "$file" ]; then
        echo "--- Thread Pool Size: $size ---"
        grep "CONCURRENCY=" "$file" || echo "No results found"
        echo ""
    fi
done

