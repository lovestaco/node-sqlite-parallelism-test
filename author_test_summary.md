# Understanding the node-sqlite3 Thread Pool Blocking Test


## Single database connection.
Looking at the code:
- Line 10: const db = new sqlite3.Database(':memory:'); — creates one database connection
- Line 26: Prepares CONCURRENCY statements on that same db connection
- Line 40: Executes all 2000 queries through that same connection
So it's parallel queries on one connection.
This is why the issue matters: even with multiple threads, SQLite serializes queries on the same connection (internal mutex), so those threads just wait. The test shows that using multiple threads for one connection is wasteful — they block the thread pool while waiting on the same mutex.
If it were multiple connections, each could use its own thread more effectively, but that's not what this test is doing.

## What the Test Does (test.js)

The test demonstrates how `node-sqlite3` blocks libuv worker pool threads, preventing other async operations from using them efficiently.

### Step-by-Step Breakdown

1. **Database Setup** (lines 10-24):
   - Creates an in-memory SQLite database (`:memory:`)
   - Creates a table with a single TEXT column
   - Inserts 2000 rows of data sequentially

2. **Prepared Statements** (line 26):
   - Prepares `CONCURRENCY` number of identical SELECT statements
   - Each statement runs: `SELECT max(id), max(info) FROM (SELECT rowid AS id, info FROM lorem) GROUP BY id%500;`
   - This is a moderately complex query that takes some time to execute

3. **Parallel Query Execution** (line 40):
   - Executes 2000 queries total, distributed across the `CONCURRENCY` prepared statements
   - Uses `Promise.all()` to run them in parallel
   - Each query cycles through the prepared statements using modulo: `i % CONCURRENCY`

4. **Thread Pool Latency Measurement** (lines 31-38):
   - **This is the key part**: Simultaneously runs `zlib.deflate()` operations every 10ms
   - `zlib.deflate()` also uses libuv worker threads (same pool as sqlite3)
   - Measures how long each `deflate()` operation takes
   - If `deflate()` is delayed, it means the thread pool is busy with sqlite3 operations

5. **Results** (lines 42-47):
   - Calculates median latency of `zlib.deflate()` operations
   - This median latency represents **how long other operations wait in the thread pool queue**
   - Also measures total query time and event loop utilization

## What the Author is Demonstrating

### The Problem

The author's results show:

```
CONCURRENCY= 1: queue latency = 0.924 ms  ✓ Low
CONCURRENCY= 3: queue latency = 0.975 ms  ✓ Low  
CONCURRENCY=10: queue latency = 10.995 ms ⚠️ SPIKES!
CONCURRENCY=20: queue latency = 32.638 ms ⚠️ SPIKES!
```

### Key Observations

1. **When CONCURRENCY > 4 (default thread pool size), queue latency spikes dramatically**
   - With 4 worker threads, only 4 sqlite3 queries can run simultaneously
   - When CONCURRENCY=10, 6 queries are waiting in the queue
   - When CONCURRENCY=20, 16 queries are waiting in the queue
   - This causes `zlib.deflate()` operations to wait, increasing their latency

2. **Even with CONCURRENCY ≤ 4, threads are still "blocked"**
   - The author notes: "with 2-3 concurrent queries some thread pool threads are still uselessly blocked by node-sqlite3"
   - Even though queue latency is low (~1ms), those 2-3 threads are dedicated to sqlite3
   - This means other operations (DNS, crypto, file I/O) have fewer threads available
   - The threads aren't "useless" per se, but they're monopolized by sqlite3

### Why This Matters

The libuv thread pool is **shared** across all async I/O operations in Node.js:
- SQLite queries (node-sqlite3)
- File system operations
- DNS lookups
- Crypto operations (like zlib.deflate)
- Other native addons

When sqlite3 operations occupy multiple threads:
- Other operations queue up waiting for available threads
- This creates latency spikes for unrelated operations
- The problem gets worse as concurrency increases

### The Root Cause

According to the GitHub issue, `node-sqlite3`:
- Runs each prepared statement query in a separate worker pool task
- All queries to the same database connection are serialized internally by SQLite's mutex
- So multiple threads are waiting on the same mutex, blocking the thread pool unnecessarily

### The Solution (Proposed)

The author suggests that all queries to the same `Database` should be scheduled in a **single queue** rather than using multiple worker threads. This would:
- Use only 1 thread pool thread per database connection
- Free up threads for other operations
- Still maintain query parallelism through proper queuing

## Summary

The test proves that `node-sqlite3` unnecessarily blocks multiple libuv worker threads, causing:
1. **Queue latency spikes** when CONCURRENCY exceeds thread pool size
2. **Thread pool starvation** for other async operations
3. **Inefficient resource usage** even when CONCURRENCY is below the pool size

The "median libuv thread pool queue latency" metric shows how long other operations (like zlib) wait when sqlite3 monopolizes the thread pool.

