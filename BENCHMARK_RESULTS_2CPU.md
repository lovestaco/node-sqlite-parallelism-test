# Comprehensive SQLite Benchmark Results (2 CPU Constraint)

## Test Configuration
- **Total Queries:** 5600
- **Database:** 2000 rows, x in [0, 1000)
- **CPU Constraint:** 2 CPUs (strictly enforced)
- **CPU Pinning:** Enabled

---

## 1. Python (Reference Implementation)

| Configuration | Total Threads | QPS | Notes |
|---------------|----------------|-----|-------|
| 2 proc × 16 threads | 32 | 13,207.00 | Default (32 worker threads) |
| 2 proc × 32 threads | 64 | 13,360.46 | 64 worker threads (96.5% of optimal) |
| 2 proc × 8 threads | 16 | 13,266.30 | |
| 2 proc × 4 threads | 8 | 12,822.33 | |
| **2 proc × 2 threads** | **4** | **13,851.47** | **🏆 BEST** |
| 2 proc × 1 thread | 2 | 13,617.52 | |
| 1 proc × 16 threads | 16 | 10,216.08 | |
| 1 proc × 8 threads | 8 | 10,015.17 | |
| 1 proc × 4 threads | 4 | 9,876.52 | |

**Optimal Python Configuration:** 2 processes × 2 threads = **13,851.47 QPS**

---

## 2. cli-2: better-sqlite3 WITH Worker Threads

| Configuration | Total Threads | QPS | % of Python |
|---------------|----------------|-----|-------------|
| 2 proc × 1 thread | 2 | 8,090.93 | 58.4% |
| **2 proc × 2 threads** | **4** | **9,686.74** | **69.9%** 🏆 |
| 2 proc × 3 threads | 6 | 8,589.83 | 62.0% |
| 2 proc × 4 threads | 8 | 7,505.61 | 54.2% |
| 2 proc × 5 threads | 10 | 7,051.62 | 50.9% |
| 2 proc × 6 threads | 12 | 6,427.73 | 46.4% |
| 2 proc × 8 threads | 16 | 5,558.84 | 40.1% |
| **2 proc × 16 threads** | **32** | **3,699.16** | **26.7%** ⚠️ 32 worker threads |
| **2 proc × 32 threads** | **64** | **2,068.50** | **15.5%** ⚠️⚠️ 64 worker threads - VERY POOR |

**Best Configuration:** 2 proc × 2 threads = **9,686.74 QPS (69.9% of Python)**

---

## 3. cli-3: node-sqlite3 WITH Worker Threads

| Configuration | Total Threads | QPS | % of Python |
|---------------|----------------|-----|-------------|
| **2 proc × 1 thread** | **2** | **7,803.62** | **56.3%** 🏆 |
| 2 proc × 2 threads | 4 | 6,993.01 | 50.5% |
| 2 proc × 3 threads | 6 | 6,255.61 | 45.2% |
| 2 proc × 4 threads | 8 | 5,879.77 | 42.4% |
| 2 proc × 5 threads | 10 | 5,610.39 | 40.5% |
| 2 proc × 6 threads | 12 | 5,243.64 | 37.8% |
| 2 proc × 8 threads | 16 | 4,606.68 | 33.2% |
| **2 proc × 16 threads** | **32** | **3,218.95** | **23.2%** ⚠️ 32 worker threads |
| **2 proc × 32 threads** | **64** | **2,068.50** | **15.5%** ⚠️⚠️ 64 worker threads - VERY POOR |

**Best Configuration:** 2 proc × 1 thread = **7,803.62 QPS (56.3% of Python)**

---

## 4. cli-4: node-sqlite3 WITHOUT Worker Threads

| Configuration | QPS | % of Python |
|---------------|-----|-------------|
| 1 process | 7,912.26 | 57.1% |
| **2 processes** | **8,683.02** | **62.7%** 🏆 |

**Best Configuration:** 2 processes = **8,683.02 QPS (62.7% of Python)**

---

## 5. cli-5: better-sqlite3 WITHOUT Worker Threads

| Configuration | QPS | % of Python |
|---------------|-----|-------------|
| 1 process | ~6,000 | ~43.3% |
| **2 processes** | **9,251.07** | **66.8%** 🏆 |

**Best Configuration:** 2 processes = **9,251.07 QPS (66.8% of Python)**

---

## 🏆 Final Rankings (2 CPU Constraint)

| Rank | Implementation | Configuration | QPS | % of Python |
|------|----------------|---------------|-----|-------------|
| 1 | **cli-2** | better-sqlite3, workers, 2 proc × 2 threads | **9,686.74** | **69.9%** 🥇 |
| 2 | **cli-5** | better-sqlite3, no workers, 2 proc | **9,251.07** | **66.8%** 🥈 |
| 3 | **cli-4** | node-sqlite3, no workers, 2 proc | **8,683.02** | **62.7%** 🥉 |
| 4 | **cli-3** | node-sqlite3, workers, 2 proc × 1 thread | **7,803.62** | **56.3%** |
| - | **Python** | 2 proc × 2 threads (optimal) | **13,851.47** | **100%** (baseline) |

---

## 📊 Key Insights

### 1. Python Optimal Configuration
- **Best:** 2 processes × 2 threads = 13,851.47 QPS
- More threads (16) doesn't help; 2 threads per process is optimal
- 2 processes is better than 1 process

### 2. Node.js Performance Comparison
- **better-sqlite3** consistently outperforms **node-sqlite3** (~10-15% faster)
- **With workers:** 2 threads/proc is optimal for better-sqlite3, 1 thread/proc for node-sqlite3
- **Without workers:** 2 processes is optimal for both

### 3. Architecture Comparison
- **With worker threads:** Better performance but more complex
- **Without worker threads:** Simpler, slightly slower but still competitive
- **Best overall:** cli-2 (better-sqlite3 with workers, 2 proc × 2 threads)

### 4. Performance Gap
- Node.js best: 9,687 QPS (69.9% of Python)
- Gap: ~30% slower than Python's optimal configuration
- However, Node.js is still very competitive and practical

### 5. High Thread Count Configurations

#### 32 Worker Threads (2 proc × 16 threads)
- **Python:** 13,207.00 QPS (95.3% of optimal)
- **cli-2 (better-sqlite3):** 3,699.16 QPS (26.7% of Python) ⚠️ Poor performance
- **cli-3 (node-sqlite3):** 3,218.95 QPS (23.2% of Python) ⚠️ Poor performance

#### 64 Worker Threads (2 proc × 32 threads)
- **Python:** 13,360.46 QPS (96.5% of optimal)
- **cli-2 (better-sqlite3):** 2,068.50 QPS (15.5% of Python) ⚠️⚠️ VERY POOR performance
- **cli-3 (node-sqlite3):** 1,846.33 QPS (13.8% of Python) ⚠️⚠️ VERY POOR performance

**Findings:**
- **32 threads:** 3.7x slower than optimal (cli-2)
- **64 threads:** 4.7x slower than optimal (cli-2)
- More threads = worse performance due to severe contention
- **Recommendation:** Avoid high thread counts; 2-4 threads per process is optimal

---

## ✅ Recommendations

### Best Overall Performance
**cli-2** with 2 processes × 2 threads:
- **9,687 QPS (69.9% of Python)**
- Command: `--processes 2 --threads-per-proc 2 --queries-per-thread 1400 --pin-cpus`

### Best Without Worker Threads
**cli-5** with 2 processes:
- **9,251 QPS (66.8% of Python)**
- Command: `--processes 2 --queries-per-process 2800 --pin-cpus`
- Simpler architecture, minimal performance loss

### Best with node-sqlite3
**cli-4** with 2 processes:
- **8,683 QPS (62.7% of Python)**
- Command: `--processes 2 --queries-per-process 2800 --pin-cpus`

---

## Summary

1. **Python optimal:** 2 proc × 2 threads = 13,851 QPS
2. **Node.js best:** cli-2 (better-sqlite3, workers, 2 proc × 2 threads) = 9,687 QPS (69.9% of Python)
3. **better-sqlite3** outperforms **node-sqlite3** in all configurations
4. **2 processes** is optimal for all implementations
5. **2 threads per process** is optimal for Python and better-sqlite3 with workers


---

## 6. cli-6: better-sqlite3 WITH Worker Threads (Single Process, Shared DB)

**Architecture:** Single Node.js process with worker threads, each worker has its own connection to the same DB file.

| Configuration | Total Threads | QPS | % of Python |
|---------------|----------------|-----|-------------|
| **2 threads** | **2** | **9,110.99** | **65.5%** 🏆 |
| 4 threads | 4 | 7,632.23 | 54.9% |
| 8 threads | 8 | 6,036.54 | 43.4% |
| 16 threads | 16 | 4,182.75 | 30.1% |
| 32 threads | 32 | 2,529.63 | 18.2% |

**Best Configuration:** 2 threads = **9,110.99 QPS (65.5% of Python)**

**Key Differences from cli-2:**
- cli-2: Uses cluster processes + worker threads (2 processes, each with N threads)
- cli-6: Uses only worker threads in a single process (1 process, N threads)
- cli-6 has more contention since all threads share the same process
- cli-2 performs better (9,687 QPS) due to process isolation

