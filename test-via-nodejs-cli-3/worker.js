// Worker thread code - runs queries against SQLite using node-sqlite3
const { parentPort, workerData } = require('worker_threads');
const sqlite3 = require('sqlite3').verbose();

const { dbPath, xRange, queriesPerThread } = workerData;

// Open database with optimized settings - use private cache for better isolation
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY | sqlite3.OPEN_PRIVATECACHE, (err) => {
    if (err) {
        parentPort.postMessage({ error: err.message });
        return;
    }

    // Use parallelize mode - each thread has its own connection so we can parallelize
    db.parallelize();

    // Set PRAGMA optimizations for maximum read performance
    db.run('PRAGMA journal_mode = WAL;');
    db.run('PRAGMA synchronous = NORMAL;');
    db.run('PRAGMA cache_size = -256000;'); // Large cache
    db.run('PRAGMA temp_store = MEMORY;');
    db.run('PRAGMA mmap_size = 1073741824;'); // 1GB memory-mapped I/O
    db.run('PRAGMA busy_timeout = 30000;');
    db.run('PRAGMA query_only = 1;'); // Read-only optimization

    // Prepare statement once - reuse for all queries
    const stmt = db.prepare('SELECT a, b, c, d FROM table1 WHERE x = ?', (err) => {
        if (err) {
            db.close();
            parentPort.postMessage({ error: err.message });
            return;
        }

        // Generate all random values upfront
        const xVals = [];
        for (let i = 0; i < queriesPerThread; i++) {
            xVals.push(Math.floor(Math.random() * xRange));
        }

        // Run all queries in parallel using callbacks for lower overhead
        const t0 = performance.now();
        let completed = 0;
        let hasError = false;

        for (const xVal of xVals) {
            stmt.all(xVal, (err, rows) => {
                if (hasError) return;
                if (err) {
                    hasError = true;
                    stmt.finalize();
                    db.close();
                    parentPort.postMessage({ error: err.message });
                    return;
                }
                completed++;
                if (completed === queriesPerThread) {
                    const t1 = performance.now();
                    const elapsed = (t1 - t0) / 1000; // convert to seconds

                    stmt.finalize((err) => {
                        if (err) {
                            db.close();
                            parentPort.postMessage({ error: err.message });
                            return;
                        }
                        db.close((err) => {
                            if (err) {
                                parentPort.postMessage({ error: err.message });
                                return;
                            }
                            parentPort.postMessage({ queries: queriesPerThread, elapsed });
                        });
                    });
                }
            });
        }
    });
});
