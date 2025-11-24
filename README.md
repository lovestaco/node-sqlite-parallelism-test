# node-sqlite3 Parallelism Benchmark

This project reproduces the issue described in [node-sqlite3 issue #1395](https://github.com/TryGhost/node-sqlite3/issues/1395) where parallel queries block the nodejs/libuv worker pool.

## Setup

```bash
npm install
```

## Running the Benchmark

Run a single test with default concurrency (10):
```bash
npm test
```

Run the full benchmark suite with multiple concurrency levels (1, 3, 10, 20):
```bash
npm run benchmark
```

Run benchmarks with different thread pool sizes (2, 3, 8) and save results:
```bash
npm run benchmark:threadpools
```

Compare results from different thread pool sizes:
```bash
npm run compare
```

Results are saved in the `results/` directory:
- `results/threadpool-2.txt` - Results with 2 thread pool threads
- `results/threadpool-3.txt` - Results with 3 thread pool threads
- `results/threadpool-8.txt` - Results with 8 thread pool threads

## Expected Results

When running with concurrency levels above the default libuv thread pool size (4), you should see queue latency spikes:

- CONCURRENCY=1: Low queue latency (~0.9ms)
- CONCURRENCY=3: Low queue latency (~1ms)
- CONCURRENCY=10: Higher queue latency (~11ms)
- CONCURRENCY=20: Much higher queue latency (~33ms)

This demonstrates that node-sqlite3 queries are blocking libuv worker pool threads unnecessarily.

