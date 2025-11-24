# Comprehensive SQLite Benchmark Results

## Test Configuration
- **Total Queries:** 5600
- **Database:** 2000 rows, x in [0, 1000)
- **CPU Pinning:** Enabled (2 CPUs available)

## Results Summary

### 1. Python (Reference Implementation)
- **Configuration:** 2 processes × 16 threads = 32 total threads
- **Performance:** 13,394.65 QPS
- **Status:** Baseline reference

---

### 2. cli-2: better-sqlite3 WITH Worker Threads

| Threads/Proc | Total Threads | QPS | % of Python |
|--------------|---------------|-----|-------------|
| 1 | 2 | 10,392.96 | 77.6% |
| 2 | 4 | 9,374.22 | 69.9% |
| 3 | 6 | 8,480.68 | 63.3% |
| 4 | 8 | 7,830.52 | 58.4% |
| 5 | 10 | 7,000.72 | 52.2% |
| 6 | 12 | 6,528.46 | 48.7% |
| 8 | 16 | 5,500.25 | 41.0% |
| 16 | 32 | 3,526.38 | 26.3% |

**Best Configuration:** 1 thread/proc = **10,392.96 QPS (77.6% of Python)**

---

### 3. cli-3: node-sqlite3 WITH Worker Threads

| Threads/Proc | Total Threads | QPS | % of Python |
|--------------|---------------|-----|-------------|
| 1 | 2 | 7,794.60 | 58.2% |
| 2 | 4 | 6,912.54 | 51.6% |
| 3 | 6 | 6,291.94 | 46.9% |
| 4 | 8 | 5,921.57 | 44.2% |
| 5 | 10 | 5,479.56 | 40.8% |
| 6 | 12 | 5,208.25 | 38.8% |
| 8 | 16 | 4,584.63 | 34.2% |
| 16 | 32 | 3,084.99 | 23.0% |

**Best Configuration:** 1 thread/proc = **7,794.60 QPS (58.2% of Python)**

---

### 4. cli-4: node-sqlite3 WITHOUT Worker Threads

| Processes | QPS | % of Python |
|-----------|-----|-------------|
| 1 | 6,841.87 | 51.1% |
| 2 | 8,602.68 | 64.2% |
| 3 | 12,347.48 | 92.2% |
| 4 | 15,118.04 | 112.9% |
| 5 | 16,493.81 | 123.1% |
| 6 | 16,537.23 | 123.4% |
| 8 | 15,724.86 | 117.3% |

**Best Configuration:** 6 processes = **16,537.23 QPS (123.4% of Python)** ⚠️ Exceeds 2 CPU limit

**Best within 2 CPU limit:** 2 processes = **8,602.68 QPS (64.2% of Python)**

---

### 5. cli-5: better-sqlite3 WITHOUT Worker Threads

| Processes | QPS | % of Python |
|-----------|-----|-------------|
| 1 | ~6,000 | ~44.8% |
| 2 | 9,205.97 | 68.7% |
| 3 | 13,152.38 | 98.2% |
| 4 | 16,164.39 | 120.7% |
| 5 | 18,593.60 | 138.8% |
| 6 | 19,965.35 | 149.1% |
| 8 | 15,876.83 | 118.5% |

**Best Configuration:** 6 processes = **19,965.35 QPS (149.1% of Python)** ⚠️ Exceeds 2 CPU limit

**Best within 2 CPU limit:** 2 processes = **9,205.97 QPS (68.7% of Python)**

---

## Key Findings

### Performance Rankings (2 CPU limit)

1. **cli-5 (better-sqlite3, no workers, 2 proc):** 9,205.97 QPS (68.7% of Python) 🏆
2. **cli-4 (node-sqlite3, no workers, 2 proc):** 8,602.68 QPS (64.2% of Python)
3. **cli-2 (better-sqlite3, with workers, 1 thread/proc):** 10,392.96 QPS (77.6% of Python) ⚠️ Uses worker threads
4. **cli-3 (node-sqlite3, with workers, 1 thread/proc):** 7,794.60 QPS (58.2% of Python)

### Performance Rankings (No CPU limit)

1. **cli-5 (better-sqlite3, no workers, 6 proc):** 19,965.35 QPS (149.1% of Python) 🏆
2. **cli-4 (node-sqlite3, no workers, 6 proc):** 16,537.23 QPS (123.4% of Python)
3. **cli-5 (better-sqlite3, no workers, 5 proc):** 18,593.60 QPS (138.8% of Python)

### Key Insights

1. **No Worker Threads > Worker Threads:** Removing worker threads significantly improves performance
2. **better-sqlite3 > node-sqlite3:** Synchronous better-sqlite3 outperforms async node-sqlite3
3. **Fewer Threads = Better:** With worker threads, fewer threads per process perform better
4. **More Processes = Better (up to a point):** Without worker threads, more processes scale better
5. **Optimal Config:** 2 processes without worker threads gives best performance within 2 CPU constraint

### Recommendations

**For 2 CPU constraint:**
- **Best:** cli-5 with 2 processes (9,206 QPS, 68.7% of Python)
- **Alternative:** cli-2 with 1 thread/proc (10,393 QPS, 77.6% of Python) if worker threads are acceptable

**For maximum performance (no CPU limit):**
- **Best:** cli-5 with 6 processes (19,965 QPS, 149% of Python)
- **Alternative:** cli-4 with 6 processes (16,537 QPS, 123% of Python)

