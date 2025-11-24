// Worker thread code - runs queries against SQLite
const { parentPort, workerData } = require('worker_threads');
const Database = require('better-sqlite3');

const { dbPath, xRange, queriesPerThread } = workerData;

const db = new Database(dbPath, { timeout: 30000 });
const stmt = db.prepare('SELECT a, b, c, d FROM table1 WHERE x = ?');

const t0 = performance.now();
for (let i = 0; i < queriesPerThread; i++) {
    const xVal = Math.floor(Math.random() * xRange);
    stmt.all(xVal);
}
const t1 = performance.now();

db.close();
const elapsed = (t1 - t0) / 1000; // convert to seconds

parentPort.postMessage({ queries: queriesPerThread, elapsed });
