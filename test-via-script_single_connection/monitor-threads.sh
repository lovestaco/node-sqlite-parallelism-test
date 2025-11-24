#!/bin/bash
# Monitor thread count while benchmark runs
# Usage: ./monitor-threads.sh <pid>

if [ -z "$1" ]; then
    echo "Usage: $0 <node_pid>"
    echo "Run 'ps aux | grep node' to find the PID"
    exit 1
fi

PID=$1
echo "Monitoring thread count for PID $PID"
echo "Press Ctrl+C to stop"
echo ""

while true; do
    THREAD_COUNT=$(ps -T -p $PID 2>/dev/null | wc -l)
    if [ $? -eq 0 ]; then
        # Subtract 1 for header line
        ACTUAL_THREADS=$((THREAD_COUNT - 1))
        echo "$(date +%H:%M:%S) - Threads: $ACTUAL_THREADS"
    else
        echo "Process $PID not found"
        break
    fi
    sleep 0.5
done

