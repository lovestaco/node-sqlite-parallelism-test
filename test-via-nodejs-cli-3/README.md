# Benchmark -3 with tryghost/node-sqlite

This directory contains a benchmark that mirrors the Python SQLite read benchmark but uses the **async** `node-sqlite` package (forked by tryghost).

## Prerequisites
- Node.js >= 14
- npm (comes with Node)

## Setup
```sh
npm install
```

## Usage
```sh
node ./sqlite_read_bench.mjs \
  --db-path test_reads.sqlite3 \
  --rows 2000 \
  --processes 2 \
  --threads-per-proc 16 \
  --queries-per-thread 175 \
  --pin-cpus
```
All command‑line arguments match the Python version:
- `--db-path` – path to the SQLite file (will be recreated)
- `--rows` – number of rows to insert
- `--x-range` – range for the random `x` column (default 1000)
- `--processes` – number of forked processes (via `cluster`)
- `--threads-per-proc` – number of worker threads per process
- `--queries-per-thread` – how many SELECTs each thread runs
- `--pin-cpus` – attempt to bind each process to a distinct CPU core (best‑effort)

## Output
The script prints three sections, identical to the Python benchmark:
```
--- Per-process stats ---
Process 0:
  Wall time: X.XXXX s
  Queries:   NNNN
  QPS:       XXX.XX
...
--- Per-thread QPS (over all processes) ---
Threads total: NNN
Min QPS:   XXX.XX
Median QPS:XXX.XX
Mean QPS:  XXX.XX
Max QPS:   XXX.XX
--- Global stats ---
Total queries:      NNNN
Global wall time:   X.XXXX s (includes process startup/teardown)
Global effective QPS: XXX.XX
```
