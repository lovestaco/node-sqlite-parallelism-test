#!/bin/bash
# Compare all benchmark results

echo "=== Comprehensive Benchmark Comparison ==="
echo ""

# Python CLI (subprocess approach)
PYTHON_FILE="test-via-python-cli/results/benchmark.txt"
if [ -f "$PYTHON_FILE" ]; then
    echo "--- Python CLI (Subprocess) ---"
    grep "Concurrency" "$PYTHON_FILE" | grep -v "Testing" || echo "No results found"
    echo ""
else
    echo "--- Python CLI (Subprocess) ---"
    echo "File not found: $PYTHON_FILE"
    echo "Run: cd test-via-python-cli && python3 benchmark.py"
    echo ""
fi

# Node.js Single Connection
SINGLE_FILE="test-via-script_single_connection/results/benchmark.txt"
if [ -f "$SINGLE_FILE" ]; then
    echo "--- Node.js Single Connection ---"
    grep "CONCURRENCY=" "$SINGLE_FILE" || echo "No results found"
    echo ""
else
    echo "--- Node.js Single Connection ---"
    echo "File not found: $SINGLE_FILE"
    echo "Run: npm run benchmark-single"
    echo ""
fi

# Node.js Multiple Connections
MULTI_FILE="test-via-script_n_connection/results/benchmark.txt"
if [ -f "$MULTI_FILE" ]; then
    echo "--- Node.js Multiple Connections ---"
    grep "CONCURRENCY=" "$MULTI_FILE" || echo "No results found"
    echo ""
else
    echo "--- Node.js Multiple Connections ---"
    echo "File not found: $MULTI_FILE"
    echo "Run: npm run benchmark-n-connection"
    echo ""
fi
