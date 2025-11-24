// Worker thread code - runs queries against SQLite using better-sqlite3
// Each worker opens its own connection to the shared DB file
const { parentPort, workerData } = require('worker_threads');
const Database = require('better-sqlite3');

const { dbPath, xRange, queriesPerThread, threadIndex } = workerData;

// Open database with optimized settings - each worker has its own connection
// Since we're read-only, multiple connections to the same DB file is safe
// Use file: URI with immutable flag for better read-only performance
const db = new Database(dbPath, { 
    timeout: 30000,
    readonly: true // Read-only mode for better performance and safety
});

// Optimize PRAGMA settings for maximum read performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -256000'); // Large cache per connection
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 1073741824'); // 1GB memory-mapped I/O
db.pragma('query_only = 1'); // Read-only optimization
db.pragma('threads = 1'); // Single thread per connection

// Prepare statement once - reuse for all queries
const stmt = db.prepare('SELECT a, b, c, d FROM table1 WHERE x = ?');

// Generate all random values upfront to avoid random() overhead in loop
const xVals = [];
for (let i = 0; i < queriesPerThread; i++) {
    xVals.push(Math.floor(Math.random() * xRange));
}

// Execute all queries sequentially (better-sqlite3 is synchronous)
const t0 = performance.now();
for (const xVal of xVals) {
    stmt.all(xVal);
}
const t1 = performance.now();

db.close();
const elapsed = (t1 - t0) / 1000; // convert to seconds

parentPort.postMessage({ 
    queries: queriesPerThread, 
    elapsed,
    threadIndex 
});

