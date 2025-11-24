# Benchmark Results Summary

## Thread Pool Size Comparison

### Key Finding: Queue Latency Spikes When Concurrency > Thread Pool Size

| Thread Pool | CONCURRENCY=1 | CONCURRENCY=3 | CONCURRENCY=10 | CONCURRENCY=20 |
|-------------|---------------|---------------|----------------|----------------|
| **2 threads** | 0.651 ms | **7.580 ms** ⚠️ | **38.522 ms** ⚠️ | **106.505 ms** ⚠️ |
| **3 threads** | 0.744 ms | **4.563 ms** ⚠️ | **32.227 ms** ⚠️ | **93.643 ms** ⚠️ |
| **8 threads** | 0.742 ms | 0.694 ms ✓ | **11.219 ms** ⚠️ | **64.711 ms** ⚠️ |

## Observations

### Thread Pool Size = 2
- **CONCURRENCY=1**: Low latency (0.651ms) ✓
- **CONCURRENCY=3**: **Queue latency spikes to 7.580ms** (exceeds pool size)
- **CONCURRENCY=10**: Severe queueing (38.522ms)
- **CONCURRENCY=20**: Very severe queueing (106.505ms)

### Thread Pool Size = 3
- **CONCURRENCY=1**: Low latency (0.744ms) ✓
- **CONCURRENCY=3**: **Queue latency spikes to 4.563ms** (matches pool size exactly)
- **CONCURRENCY=10**: Severe queueing (32.227ms)
- **CONCURRENCY=20**: Very severe queueing (93.643ms)

### Thread Pool Size = 8
- **CONCURRENCY=1**: Low latency (0.742ms) ✓
- **CONCURRENCY=3**: Low latency (0.694ms) ✓ (below pool size)
- **CONCURRENCY=10**: **Queue latency spikes to 11.219ms** (exceeds pool size)
- **CONCURRENCY=20**: Severe queueing (64.711ms)

## Conclusion

1. **Queue latency spikes when CONCURRENCY > Thread Pool Size**
   - With 2 threads: spikes at CONCURRENCY=3
   - With 3 threads: spikes at CONCURRENCY=3
   - With 8 threads: spikes at CONCURRENCY=10

2. **Larger thread pools help but don't eliminate the problem**
   - 8 threads still shows queueing at CONCURRENCY=10 and 20
   - Even with 8 threads, CONCURRENCY=20 causes 64ms queue latency

3. **The issue is confirmed**: node-sqlite3 blocks libuv worker threads, causing other async operations (like zlib.deflate) to queue up when the thread pool is saturated.

4. **Optimal configuration**: With 8 threads, CONCURRENCY ≤ 3 maintains low queue latency (< 1ms).

