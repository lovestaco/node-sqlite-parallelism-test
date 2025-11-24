#!/bin/bash

echo "=== Comprehensive Process/Thread/CPU Verification ==="
echo ""

echo "1. Testing cli-2 (better-sqlite3 with workers)..."
echo ""

# Run benchmark in background and monitor
node test-via-nodejs-cli-2/sqlite_read_bench.js \
  --db-path test_reads.sqlite3 \
  --rows 2000 \
  --processes 2 \
  --threads-per-proc 2 \
  --queries-per-thread 100 \
  --pin-cpus > /tmp/bench_output.txt 2>&1 &

BENCH_PID=$!
sleep 0.5

echo "Benchmark PID: $BENCH_PID"
echo ""

# Find all related processes
PIDS=$(pgrep -P $BENCH_PID 2>/dev/null || pgrep -f "sqlite_read_bench.js" | grep -v $BENCH_PID)

echo "Found processes:"
for pid in $PIDS; do
    if [ ! -z "$pid" ]; then
        echo "  PID $pid:"
        echo "    CPU: $(taskset -cp $pid 2>/dev/null | tail -1)"
        echo "    Threads: $(ps -T -p $pid 2>/dev/null | wc -l | xargs)"
        echo "    CMD: $(ps -p $pid -o cmd --no-headers 2>/dev/null | cut -c1-80)"
    fi
done

wait $BENCH_PID 2>/dev/null
echo ""
echo "Benchmark completed"
