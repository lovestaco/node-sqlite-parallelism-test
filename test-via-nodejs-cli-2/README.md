# SQLite Read Benchmark - Node.js Version

This is a Node.js port of the Python SQLite read benchmark (`sqlite_read_bench.py`). It tests concurrent read performance using multiple processes and threads.

## Features

- **Multi-process support**: Uses Node.js `cluster` module to spawn multiple processes
- **Multi-threading support**: Uses `worker_threads` to create threads within each process
- **CPU pinning**: Optional CPU affinity setting (Linux only, using `taskset`)
- **WAL mode**: Uses SQLite's Write-Ahead Logging for better concurrent read performance
- **Comprehensive statistics**: Reports per-process, per-thread, and global QPS metrics

## Installation

```bash
npm install
```

## Usage

Basic usage:
```bash
node sqlite_read_bench.js
```

With custom parameters (matching the Python examples):
```bash
# Example 1: 2 processes × 26 threads
node sqlite_read_bench.js \
  --db-path test_reads.sqlite3 \
  --rows 2000 \
  --processes 2 \
  --threads-per-proc 26 \
  --queries-per-thread 175 \
  --pin-cpus

# Example 2: 2 processes × 16 threads
node sqlite_read_bench.js \
  --db-path test_reads.sqlite3 \
  --rows 2000 \
  --processes 2 \
  --threads-per-proc 16 \
  --queries-per-thread 175 \
  --pin-cpus
```

## Command-line Options

- `--db-path <path>`: Path to SQLite file (will be overwritten) [default: test_reads.sqlite3]
- `--rows <n>`: Number of rows to insert [default: 2000]
- `--x-range <n>`: Random x range: [0, x_range) [default: 1000]
- `--processes <n>`: Number of worker processes [default: 2]
- `--threads-per-proc <n>`: Number of threads per process [default: 16]
- `--queries-per-thread <n>`: Queries each thread will execute [default: 50000]
- `--pin-cpus`: Best-effort: pin each process to a separate CPU
- `--help`: Show help message

## Output

The benchmark reports:
1. **Per-process stats**: Wall time, total queries, and QPS for each process
2. **Per-thread QPS statistics**: Min, median, mean, and max QPS across all threads
3. **Global stats**: Total queries, wall time, and effective global QPS

## Differences from Python Version

- Uses `better-sqlite3` instead of Python's `sqlite3` module
- Uses `cluster` module for multi-processing instead of `multiprocessing.Pool`
- Uses `worker_threads` instead of Python's `threading`
- CPU pinning uses `taskset` command (Linux only) instead of `sched_setaffinity`
- Performance characteristics may differ due to different SQLite bindings and runtime

## Requirements

- Node.js 14+ (for worker_threads support)
- Linux (for CPU pinning feature, optional)
