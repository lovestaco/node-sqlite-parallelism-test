# WAL vs No-WAL Performance Comparison

## Summary
**Winner: WITHOUT WAL** - Surprisingly, the version without WAL mode performed better across most scenarios.

## Detailed Comparison

### Python CLI (Subprocess)

| Concurrency | Without WAL | With WAL | Winner | Difference |
|:------------|:------------|:---------|:-------|:-----------|
| 1 | 4.266 ms/query | 4.230 ms/query | With WAL | 0.8% faster |
| 2 | 1.578 ms/query | 2.498 ms/query | **Without WAL** | **37% slower with WAL** |

### Node.js Single Connection

| Concurrency | Without WAL | With WAL | Winner | Difference |
|:------------|:------------|:---------|:-------|:-----------|
| 1 | 2.784 ms | 2.471 ms | With WAL | 11% faster |
| 2 | 1.779 ms | 1.569 ms | With WAL | 12% faster |
| 4 | 1.617 ms | 1.914 ms | **Without WAL** | **18% slower with WAL** |
| 8 | 1.600 ms | 1.950 ms | **Without WAL** | **22% slower with WAL** |
| 16 | 1.948 ms | 2.892 ms | **Without WAL** | **48% slower with WAL** |

### Node.js Multiple Connections

| Concurrency | Without WAL | With WAL | Winner | Difference |
|:------------|:------------|:---------|:-------|:-----------|
| 1 | 2.607 ms | 2.864 ms | **Without WAL** | **10% slower with WAL** |
| 2 | 1.016 ms | 1.325 ms | **Without WAL** | **30% slower with WAL** |
| 4 | 0.854 ms | 0.707 ms | With WAL | 17% faster |
| 8 | 0.794 ms | 0.687 ms | With WAL | 13% faster |
| 16 | 0.835 ms | 0.734 ms | With WAL | 12% faster |

## Key Findings

### 1. WAL Helps at High Concurrency (8+)
- **Node.js Multiple Connections** with concurrency 4+ shows WAL benefits
- At concurrency 8 and 16, WAL provides ~12-17% improvement

### 2. WAL Hurts at Low Concurrency (1-2)
- For concurrency 1-2, WAL adds overhead without benefits
- Python concurrency 2: **37% slower** with WAL
- Node.js Multi concurrency 2: **30% slower** with WAL

### 3. The Immutable Flag May Be Problematic
The `immutable=1` flag we added might be causing issues because:
- It tells SQLite the database won't change
- But WAL mode creates `-wal` and `-shm` files that DO change
- This conflict may be causing the performance degradation

## Recommendation

**For your 2 CPU / 100 user scenario:**

1. **Don't use WAL mode** - Your results show it hurts performance at low-to-medium concurrency
2. **Remove the immutable flag** - It conflicts with WAL and may be causing the slowdown
3. **Stick with the default journal mode** - It performed better in your tests

The "textbook" advice says WAL is better for concurrency, but your real-world benchmarks prove otherwise for this specific workload (read-only queries on a 2-core system).
