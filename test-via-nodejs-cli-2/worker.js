// Worker thread code - runs queries against SQLite
const { parentPort, workerData } = require('worker_threads');
const Database = require('better-sqlite3');

const { dbPath, xRange, queriesPerThread } = workerData;

// Open database with optimized settings
const db = new Database(dbPath, { 
    timeout: 30000,
    readonly: true // Read-only mode for better performance
});

// Optimize PRAGMA settings for maximum read performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -256000'); // Large cache
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 1073741824'); // 1GB memory-mapped I/O
db.pragma('query_only = 1'); // Read-only optimization

// Prepare statement once - reuse for all queries
const stmt = db.prepare('SELECT a, b, c, d FROM table1 WHERE x = ?');

// Generate all random values upfront to avoid random() overhead in loop
const xVals = [];
for (let i = 0; i < queriesPerThread; i++) {
    xVals.push(Math.floor(Math.random() * xRange));
}

const t0 = performance.now();
// Execute all queries
for (const xVal of xVals) {
    stmt.all(xVal);
}
const t1 = performance.now();

db.close();
const elapsed = (t1 - t0) / 1000; // convert to seconds

parentPort.postMessage({ queries: queriesPerThread, elapsed });
