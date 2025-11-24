# Performance Analysis & Recommendations: Node.js SQLite Parallelism

## Executive Summary
To support **100 parallel users** on a system with **2 CPUs**, you **must utilize multiple database connections** (Connection Pooling). 

Our benchmarks conclusively show that `node-sqlite3` serializes all queries executed on a single connection, regardless of the underlying thread pool size. Using multiple connections is the only way to achieve true parallelism and fully utilize your available CPU cores.

## Data Analysis
The following data from `final_results.txt` highlights the critical performance gap at higher concurrency levels (20 concurrent queries):

| Metric | Single Connection | Multiple Connections | Improvement |
| :--- | :--- | :--- | :--- |
| **Total Time** | 5578 ms | 2678 ms | **~2.1x Faster** |
| **Throughput** | ~358 queries/sec | ~746 queries/sec | **~2.1x Higher** |
| **Latency per SELECT** | 2.79 ms | 1.34 ms | **~50% Lower** |

*Data based on Thread Pool Size: 2 (matching your CPU count).*

## Technical Explanation
### The Single Connection Bottleneck
The `node-sqlite3` library uses a mutex around the database handle. When you share a single `new sqlite3.Database()` object across all requests:
1.  Requests are queued in JavaScript.
2.  They are sent to the thread pool **one by one**.
3.  Even if you have 100 threads available, only **one** thread can execute a query for that specific connection at a time.
4.  This results in **0% parallelism** for database operations.

### The Multiple Connection Solution
By using separate connection objects (e.g., a pool of connections):
1.  Each connection has its own mutex.
2.  Multiple queries can be dispatched to the libuv thread pool simultaneously.
3.  The OS can schedule these threads across your 2 CPU cores, maximizing hardware utilization.

## Recommendations for 2 CPUs & 100 Users

### 1. Implement Connection Pooling
**Do not** open a new connection for every single request, and **do not** use a single global connection.
*   **Strategy**: Use a library like `generic-pool` or manage a simple array of `sqlite3.Database` clients.
*   **Pool Size**: For 2 CPUs, a pool size of **4 to 8** is optimal.
    *   *Why?* You only have 2 cores. Having 100 active connections won't make the CPU work faster; it just adds memory overhead and context-switching costs. A small pool ensures your CPUs are always busy without overloading the scheduler.

### 2. Thread Pool Configuration
*   **Recommendation**: Keep `UV_THREADPOOL_SIZE` at the default (**4**) or set it to **2**.
*   **Evidence**: Your benchmarks showed that increasing the thread pool to 8 actually *decreased* performance (3050ms vs 2678ms) due to overhead.
*   **Action**: No special configuration is needed; the default Node.js behavior is already near-optimal for your hardware.

### 3. Application Architecture
*   **Request Handling**: When a user request comes in, acquire a connection from the pool, execute the query, and immediately release the connection back to the pool.
*   **Concurrency**: Your Node.js main thread can easily handle 100 concurrent *requests* (waiting for I/O), while your 2-8 database connections work through the *queries* in the background as fast as the CPUs allow.
