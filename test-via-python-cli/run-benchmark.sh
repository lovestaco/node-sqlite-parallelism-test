#!/bin/bash
# Run python benchmark and save output

OUTPUT_DIR="results"
mkdir -p "$OUTPUT_DIR"

OUTPUT_FILE="$OUTPUT_DIR/benchmark.txt"

echo "Running Python CLI benchmark..."
echo "Results will be saved to $OUTPUT_FILE"

python3 benchmark.py > "$OUTPUT_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo "✓ Completed: $OUTPUT_FILE"
    cat "$OUTPUT_FILE"
else
    echo "✗ Failed: $OUTPUT_FILE"
fi
