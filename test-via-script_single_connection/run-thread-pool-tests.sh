#!/bin/bash
# Run benchmark with different thread pool sizes and save outputs

OUTPUT_DIR="results"
mkdir -p "$OUTPUT_DIR"

THREAD_POOL_SIZES=(2 3 8)

echo "Running benchmarks with different thread pool sizes..."
echo "Results will be saved to $OUTPUT_DIR/"
echo ""

for size in "${THREAD_POOL_SIZES[@]}"; do
    echo "Running benchmark with UV_THREADPOOL_SIZE=$size..."
    OUTPUT_FILE="$OUTPUT_DIR/threadpool-${size}.txt"
    
    UV_THREADPOOL_SIZE=$size node test-via-script/benchmark.js > "$OUTPUT_FILE" 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✓ Completed: $OUTPUT_FILE"
    else
        echo "✗ Failed: $OUTPUT_FILE"
    fi
    echo ""
done

echo "All benchmarks complete!"
echo "Results saved in $OUTPUT_DIR/"

