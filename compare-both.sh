#!/bin/bash


OUTPUT_FILE="final_results.txt"
exec > >(tee "$OUTPUT_FILE") 2>&1

echo "=== Comparison of Results (Single vs Multiple Connections) ==="
echo ""

for size in 2 3 8; do
    echo "--- Thread Pool Size: $size ---"
    
    single_file="test-via-script_single_connection/results/threadpool-${size}.txt"
    if [ -f "$single_file" ]; then
        echo "Single Connection:"
        grep "CONCURRENCY=" "$single_file" || echo "  No results found"
    else
        echo "Single Connection: File not found"
    fi

    multi_file="test-via-script_n_connection/results/threadpool-${size}.txt"
    if [ -f "$multi_file" ]; then
        echo "Multiple Connections:"
        grep "CONCURRENCY=" "$multi_file" || echo "  No results found"
    else
        echo "Multiple Connections: File not found"
    fi
    echo ""
done
