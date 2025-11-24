# Single Database Connection - Results Summary

## Definitions

### CONCURRENCY
The number of parallel query streams/workers running simultaneously. In this test, CONCURRENCY determines how many prepared statements are created on a **single database connection**. For example:
- **CONCURRENCY=1**: 1 prepared statement, queries run sequentially
- **CONCURRENCY=3**: 3 prepared statements, attempting 3 parallel queries on one connection
- **CONCURRENCY=10**: 10 prepared statements, attempting 10 parallel queries on one connection

The 2000 total queries are distributed across these CONCURRENCY prepared statements. However, since all queries use the same database connection, SQLite's internal mutex serializes them, so they don't truly run in parallel.

### Event Loop Utilization
The percentage of time the Node.js event loop is actively processing work (not idle). Higher values indicate the event loop is busy:
- **50%**: Event loop is underutilized, spending half its time idle
- **70-75%**: Moderate utilization, event loop is busy
- **100%**: Fully saturated, event loop has no idle time (all threads are working)

In single connection tests, utilization is typically lower because threads spend time waiting on SQLite's mutex rather than actively working.

### Queue Latency (libuv thread pool queue latency)
The time other async operations (like `zlib.deflate()`) wait in the libuv thread pool queue before getting a worker thread. This is measured by running `zlib.deflate()` every 10ms during the benchmark:
- **< 1ms**: Low latency, threads are available quickly
- **5-10ms**: Moderate latency, some queuing occurring
- **20-50ms**: High latency, significant queuing (thread pool saturated)
- **> 50ms**: Very high latency, severe thread pool saturation

When queue latency spikes, it means sqlite3 operations are monopolizing the thread pool, causing other operations to wait. With a single connection, multiple threads wait on SQLite's mutex unnecessarily.

## Test Configuration

This benchmark uses a **single database connection** with multiple prepared statements. All queries go through the same connection, so SQLite's internal mutex serializes them even though multiple threads are used.

## Results by Thread Pool Size

### Thread Pool Size = 2

| CONCURRENCY | Time | ms/query | Event Loop | Queue Latency |
|-------------|------|----------|------------|---------------|
| **1** | 6816 ms | 3.408 ms | 50% | 0.651 ms ✓ |
| **3** | 4121 ms | 2.061 ms | 72% | **7.580 ms** ⚠️ |
| **10** | 4502 ms | 2.251 ms | 70% | **38.522 ms** ⚠️ |
| **20** | 5578 ms | 2.789 ms | 60% | **106.505 ms** ⚠️ |

### Thread Pool Size = 3

| CONCURRENCY | Time | ms/query | Event Loop | Queue Latency |
|-------------|------|----------|------------|---------------|
| **1** | 7171 ms | 3.586 ms | 50% | 0.744 ms ✓ |
| **3** | 4622 ms | 2.311 ms | 70% | **4.563 ms** ⚠️ |
| **10** | 4430 ms | 2.215 ms | 75% | **32.227 ms** ⚠️ |
| **20** | 5328 ms | 2.664 ms | 57% | **93.643 ms** ⚠️ |

### Thread Pool Size = 8

| CONCURRENCY | Time | ms/query | Event Loop | Queue Latency |
|-------------|------|----------|------------|---------------|
| **1** | 7281 ms | 3.640 ms | 49% | 0.742 ms ✓ |
| **3** | 4448 ms | 2.224 ms | 69% | 0.694 ms ✓ |
| **10** | 4149 ms | 2.075 ms | 75% | **11.219 ms** ⚠️ |
| **20** | 5307 ms | 2.654 ms | 64% | **64.711 ms** ⚠️ |

## Key Observations

### 1. Queue Latency Spikes When CONCURRENCY > Thread Pool Size

- **2 threads**: CONCURRENCY=3 causes spike (7.6ms), CONCURRENCY=10 → 38.5ms, CONCURRENCY=20 → 106.5ms
- **3 threads**: CONCURRENCY=3 causes spike (4.6ms), CONCURRENCY=10 → 32.2ms, CONCURRENCY=20 → 93.6ms
- **8 threads**: CONCURRENCY=3 is fine (0.7ms), but CONCURRENCY=10 → 11.2ms, CONCURRENCY=20 → 64.7ms

**Pattern**: Queue latency spikes dramatically when CONCURRENCY exceeds the thread pool size.

### 2. Query Performance is Limited by Mutex Serialization

- **CONCURRENCY=1**: ~3.4-3.6ms per query (sequential execution)
- **CONCURRENCY=3**: ~2.0-2.3ms per query (slight improvement, but still serialized)
- **CONCURRENCY=10**: ~2.0-2.3ms per query (similar to CONCURRENCY=3, no real benefit)
- **CONCURRENCY=20**: ~2.7-2.8ms per query (actually slower due to overhead)

**Key insight**: With a single connection, higher CONCURRENCY doesn't improve performance much because SQLite's mutex serializes all queries anyway.

### 3. Event Loop Utilization is Lower

- **CONCURRENCY=1**: ~50% (underutilized)
- **CONCURRENCY=3**: 70-72% (moderate)
- **CONCURRENCY=10**: 70-75% (moderate)
- **CONCURRENCY=20**: 57-64% (decreases due to overhead)

Lower utilization indicates threads are waiting on SQLite's mutex rather than actively working.

### 4. Thread Pool Size Impact

Increasing thread pool size helps reduce queue latency:
- **2 threads**: CONCURRENCY=10 → 38.5ms queue latency
- **3 threads**: CONCURRENCY=10 → 32.2ms queue latency (16% better)
- **8 threads**: CONCURRENCY=10 → 11.2ms queue latency (71% better)

However, even with 8 threads, CONCURRENCY=20 still causes 64.7ms queue latency.

## Conclusion

1. **Single connection causes mutex serialization**: All queries are serialized by SQLite's internal mutex, so multiple threads wait uselessly
2. **Queue latency spikes** when CONCURRENCY > thread pool size, even though queries are serialized anyway
3. **Inefficient resource usage**: Multiple threads block the thread pool while waiting on a mutex, preventing other operations from using threads
4. **Optimal configuration**: With 8 threads, CONCURRENCY ≤ 3 maintains low queue latency (< 1ms)
5. **The fundamental problem**: node-sqlite3 uses multiple threads per connection even though SQLite serializes queries, wasting thread pool resources

**Recommendation**: Use multiple database connections instead of a single connection with high CONCURRENCY, or keep CONCURRENCY ≤ thread pool size to minimize queue latency.
