const sqlite3 = require('sqlite3');
const { promisify } = require('util');
const { performance } = require('perf_hooks');
const os = require('os');
const fs = require('fs');

const QUERIES = 2000;
const DB_NAME = 'test.db';
const zlib = require('zlib');

// Check libuv thread pool size
const threadPoolSize = process.env.UV_THREADPOOL_SIZE ? parseInt(process.env.UV_THREADPOOL_SIZE) : 4;
console.log(`libuv thread pool size: ${threadPoolSize} (default: 4, can be set via UV_THREADPOOL_SIZE env var)`);
console.log(`CPU cores available: ${os.cpus().length}`);
console.log('Using MULTIPLE database connections (one per concurrent query)');
console.log('Using FILE-BASED database: ' + DB_NAME);
console.log('');

async function setupDatabase() {
  if (fs.existsSync(DB_NAME)) {
    fs.unlinkSync(DB_NAME);
  }

  const db = new sqlite3.Database(DB_NAME);
  const run = promisify(db.run.bind(db));

  await run("CREATE TABLE lorem (info TEXT)");

  // db.prepare returns the statement object immediately
  const stmt = db.prepare("INSERT INTO lorem VALUES (?)");

  // Use transaction for faster inserts
  await run("BEGIN TRANSACTION");
  for (let i = 0; i < 2000; i++) {
    stmt.run("Ipsum " + i);
  }
  await run("COMMIT");

  await promisify(stmt.finalize.bind(stmt))();
  await promisify(db.close.bind(db))();
  console.log(`Database ${DB_NAME} created with 2000 rows.`);
}

async function runBenchmark(CONCURRENCY) {
  // Create CONCURRENCY number of separate database connections
  const databases = [];

  // Setup each database connection
  for (let i = 0; i < CONCURRENCY; i++) {
    const db = new sqlite3.Database(DB_NAME, sqlite3.OPEN_READWRITE);
    const prepare = (sql) => new Promise((resolve, reject) => {
      const stmt = db.prepare(sql, err => {
        if (err === null)
          resolve(stmt);
        else
          reject(err);
      });
    });

    const selectStmt = await prepare("SELECT max(id), max(info) FROM (SELECT rowid AS id, info FROM lorem) GROUP BY id%500;");
    databases.push({
      db,
      selectAll: promisify(selectStmt.all.bind(selectStmt)),
      selectStmt
    });
  }

  const T0 = Date.now(), ELU0 = performance.eventLoopUtilization();

  const deflate = promisify(zlib.deflate);
  const deflateTiming = [];
  let int = setInterval(async () => {
    const T0 = performance.now();
    await deflate(Buffer.from("asdf"));
    const T1 = performance.now();
    deflateTiming.push(T1 - T0);
  }, 10);

  // Execute queries across all connections in parallel
  await Promise.all(Array.from({ length: QUERIES }, (_, i) => {
    const dbIndex = i % CONCURRENCY;
    return databases[dbIndex].selectAll().then(v => JSON.stringify(v));
  }));

  deflateTiming.sort((a, b) => a - b);
  let medianTiming = deflateTiming.length > 0 ? deflateTiming[(deflateTiming.length / 2) | 0].toFixed(3) : "0.000";

  const T1 = Date.now(), ELU1 = performance.eventLoopUtilization(ELU0);
  console.log(`CONCURRENCY=${CONCURRENCY.toString().padStart(2)}: ${QUERIES} queries complete in ${(T1 - T0)} ms,  ${((T1 - T0) / QUERIES).toFixed(3)} ms per SELECT, event loop utilisation=${(ELU1.utilization * 100).toFixed(0)}%, median libuv thread pool queue latency = ${medianTiming} ms`);
  clearInterval(int);

  // Cleanup all connections
  for (const { db, selectStmt } of databases) {
    await promisify(selectStmt.finalize).call(selectStmt);
    await promisify(db.close).call(db);
  }
}

async function main() {
  await setupDatabase();

  const concurrencyLevels = [1, 2, 4, 8, 16];

  for (const concurrency of concurrencyLevels) {
    await runBenchmark(concurrency);
  }
}

main().catch(console.error);
