# SQLite Parallelism Benchmark

Performance comparison of SQLite read operations across different Node.js implementations and Python.

## Quick Start

```bash
# Install all dependencies
make install

# Run Python benchmark (reference)
python test-via-python-cli/sqlite_read_bench.py --db-path test_reads.sqlite3 --rows 2000 --processes 2 --threads-per-proc 2 --queries-per-thread 1400 --pin-cpus

# Run Node.js benchmarks
node test-via-nodejs-cli-2/sqlite_read_bench.js --db-path test_reads.sqlite3 --rows 2000 --processes 2 --threads-per-proc 2 --queries-per-thread 1400 --pin-cpus
```

## Implementations

### Python (Reference)
- **Location:** `test-via-python-cli/`
- **Library:** Python's built-in `sqlite3`
- **Architecture:** Multi-process with threads (2 processes × 2 threads)
- **Performance:** 13,851 QPS (baseline)
- **Command:**
  ```bash
  python test-via-python-cli/sqlite_read_bench.py --db-path test_reads.sqlite3 --rows 2000 --processes 2 --threads-per-proc 2 --queries-per-thread 1400 --pin-cpus
  ```

### Node.js Implementations

#### cli: better-sqlite3 (Original)
- **Location:** `test-via-nodejs-cli/`
- **Library:** `better-sqlite3` (synchronous)
- **Architecture:** Cluster processes + Worker threads
- **Note:** Original implementation, baseline for comparison

#### cli-2: better-sqlite3 with Worker Threads
- **Location:** `test-via-nodejs-cli-2/`
- **Library:** `better-sqlite3` (synchronous)
- **Architecture:** Cluster processes + Worker threads (2 processes × 2 threads)
- **Performance:** 9,687 QPS (69.9% of Python) 🏆 Best Node.js
- **Command:**
  ```bash
  node test-via-nodejs-cli-2/sqlite_read_bench.js --db-path test_reads.sqlite3 --rows 2000 --processes 2 --threads-per-proc 2 --queries-per-thread 1400 --pin-cpus
  ```

#### cli-3: node-sqlite3 with Worker Threads
- **Location:** `test-via-nodejs-cli-3/`
- **Library:** `sqlite3` (TryGhost, async)
- **Architecture:** Cluster processes + Worker threads
- **Performance:** 7,804 QPS (56.3% of Python)
- **Command:**
  ```bash
  node test-via-nodejs-cli-3/sqlite_read_bench.js --db-path test_reads.sqlite3 --rows 2000 --processes 2 --threads-per-proc 1 --queries-per-thread 2800 --pin-cpus
  ```

#### cli-4: node-sqlite3 without Worker Threads
- **Location:** `test-via-nodejs-cli-4/`
- **Library:** `sqlite3` (TryGhost, async)
- **Architecture:** Cluster processes only (no worker threads)
- **Performance:** 8,683 QPS (62.7% of Python)
- **Command:**
  ```bash
  node test-via-nodejs-cli-4/sqlite_read_bench.js --db-path test_reads.sqlite3 --rows 2000 --processes 2 --queries-per-process 2800 --pin-cpus
  ```

#### cli-5: better-sqlite3 without Worker Threads
- **Location:** `test-via-nodejs-cli-5/`
- **Library:** `better-sqlite3` (synchronous)
- **Architecture:** Cluster processes only (no worker threads)
- **Performance:** 9,252 QPS (66.8% of Python)
- **Command:**
  ```bash
  node test-via-nodejs-cli-5/sqlite_read_bench.js --db-path test_reads.sqlite3 --rows 2000 --processes 2 --queries-per-process 2800 --pin-cpus
  ```

#### cli-6: better-sqlite3 with Worker Threads (Single Process)
- **Location:** `test-via-nodejs-cli-6/`
- **Library:** `better-sqlite3` (synchronous)
- **Architecture:** Single process with worker threads (no cluster)
- **Performance:** 9,111 QPS (65.5% of Python)
- **Command:**
  ```bash
  node test-via-nodejs-cli-6/sqlite_read_bench.js --db-path test_reads.sqlite3 --rows 2000 --threads 2 --queries-per-thread 2800 --pin-cpus
  ```

## Benchmark Results

**Latest comprehensive results:** See [BENCHMARK_RESULTS_2CPU.md](BENCHMARK_RESULTS_2CPU.md)

### Quick Summary (2 CPU Constraint)

| Implementation | QPS | % of Python |
|----------------|-----|-------------|
| **Python** | 13,851 | 100% (baseline) |
| **cli-2** (better-sqlite3, workers) | 9,687 | 69.9% 🥇 |
| **cli-5** (better-sqlite3, no workers) | 9,252 | 66.8% 🥈 |
| **cli-6** (better-sqlite3, single proc) | 9,111 | 65.5% 🥉 |
| **cli-4** (node-sqlite3, no workers) | 8,683 | 62.7% |
| **cli-3** (node-sqlite3, workers) | 7,804 | 56.3% |

## Key Findings

1. **better-sqlite3** consistently outperforms **node-sqlite3** (~10-15% faster)
2. **2 processes × 2 threads** is optimal for most implementations
3. **Worker threads add overhead** - simpler process-only approach is competitive
4. **Python's multi-process architecture** provides better isolation and performance

## Installation

```bash
make install
```

This will install dependencies for all Node.js implementations.

## Testing

### Run All Benchmarks

```bash
# Python (reference)
python test-via-python-cli/sqlite_read_bench.py --db-path test_reads.sqlite3 --rows 2000 --processes 2 --threads-per-proc 2 --queries-per-thread 1400 --pin-cpus

# Best Node.js implementation
node test-via-nodejs-cli-2/sqlite_read_bench.js --db-path test_reads.sqlite3 --rows 2000 --processes 2 --threads-per-proc 2 --queries-per-thread 1400 --pin-cpus
```

### Common Options

- `--db-path <path>` - Path to SQLite database file
- `--rows <n>` - Number of rows in test database (default: 2000)
- `--processes <n>` - Number of processes (default: 2)
- `--threads-per-proc <n>` - Number of threads per process (for implementations with workers)
- `--queries-per-thread <n>` - Queries each thread executes
- `--pin-cpus` - Pin each process to a separate CPU core

## Architecture Comparison

### Python
- Uses `multiprocessing.Pool` for process management
- Each process spawns `threading.Thread` instances
- OS-level process isolation

### Node.js (cli-2, cli-3)
- Uses `cluster` module for process management
- Each process spawns `Worker` threads
- Similar architecture to Python

### Node.js (cli-4, cli-5)
- Uses `cluster` module for process management
- No worker threads - queries run directly in process
- Simpler architecture, still competitive

### Node.js (cli-6)
- Single process with `Worker` threads only
- No cluster processes
- More contention, but simpler setup

## Requirements

- Node.js >= 14
- Python 3.x
- Linux (for CPU pinning with `taskset`)

## License

MIT
