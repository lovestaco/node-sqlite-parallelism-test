# Multiple Database Connections Benchmark

This folder contains benchmarks that use **multiple database connections** (one per concurrent query), as opposed to the single connection benchmark.

## Key Difference

- **Single connection**: All queries go through one database connection (serialized by SQLite mutex)
- **Multiple connections**: Each concurrent query uses its own database connection (true parallelism)

## Running Tests

Run benchmark with different thread pool sizes (2, 3, 8):
```bash
npm run benchmark-n-threadpools
```

Or from this directory:
```bash
bash run-thread-pool-tests.sh
```

Compare results:
```bash
npm run compare-n
```

Or from this directory:
```bash
bash compare-results.sh
```

Results are saved in `results/` directory.

