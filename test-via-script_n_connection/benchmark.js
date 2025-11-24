const sqlite3 = require('sqlite3');
const {promisify} = require('util');
const {performance} = require('perf_hooks');
const os = require('os');

const QUERIES = 2000;
const zlib = require('zlib');

// Check libuv thread pool size
const threadPoolSize = process.env.UV_THREADPOOL_SIZE ? parseInt(process.env.UV_THREADPOOL_SIZE) : 4;
console.log(`libuv thread pool size: ${threadPoolSize} (default: 4, can be set via UV_THREADPOOL_SIZE env var)`);
console.log(`CPU cores available: ${os.cpus().length}`);
console.log('Using MULTIPLE database connections (one per concurrent query)');
console.log('');

async function runBenchmark(CONCURRENCY) {
  // Create CONCURRENCY number of separate database connections
  const databases = [];
  
  // Setup each database connection with its own data
  for (let i = 0; i < CONCURRENCY; i++) {
    const db = new sqlite3.Database(':memory:');
    const prepare = (sql) => new Promise((resolve, reject) => {
      const stmt = db.prepare(sql, err => {
        if (err===null)
          resolve(stmt);
        else
          reject(err);
      });
    });

    await promisify(db.run).call(db, "CREATE TABLE lorem (info TEXT)");
    const insert = await prepare("INSERT INTO lorem VALUES (?)");
    for (let j = 0; j < 2000; j++) {
        await promisify(insert.run).call(insert, "Ipsum " + j);
    }
    await promisify(insert.finalize).call(insert);
    
    const selectStmt = await prepare("SELECT max(id), max(info) FROM (SELECT rowid AS id, info FROM lorem) GROUP BY id%500;");
    databases.push({
      db,
      selectAll: promisify(selectStmt.all.bind(selectStmt)),
      selectStmt
    });
  }

  const T0 = Date.now(), ELU0=performance.eventLoopUtilization();

  const deflate = promisify(zlib.deflate);
  const deflateTiming = [];
  let int = setInterval(async ()=>{
    const T0=performance.now();
    await deflate(Buffer.from("asdf"));
    const T1=performance.now();
    deflateTiming.push(T1-T0);
  }, 10);

  // Execute queries across all connections in parallel
  await Promise.all(Array.from({length: QUERIES}, (_,i) => {
    const dbIndex = i % CONCURRENCY;
    return databases[dbIndex].selectAll().then(v=>JSON.stringify(v));
  }));

  deflateTiming.sort((a, b) => a-b);
  let medianTiming = deflateTiming[(deflateTiming.length/2)|0].toFixed(3);

  const T1 = Date.now(), ELU1=performance.eventLoopUtilization(ELU0);
  console.log(`CONCURRENCY=${CONCURRENCY.toString().padStart(2)}: ${QUERIES} queries complete in ${(T1-T0)} ms,  ${((T1-T0)/QUERIES).toFixed(3)} ms per SELECT, event loop utilisation=${(ELU1.utilization*100).toFixed(0)}%, median libuv thread pool queue latency = ${medianTiming} ms`);
  clearInterval(int);
  
  // Cleanup all connections
  for (const {db, selectStmt} of databases) {
    await promisify(selectStmt.finalize).call(selectStmt);
    await promisify(db.close).call(db);
  }
}

async function main() {
  const concurrencyLevels = [1, 3, 10, 20];
  
  for (const concurrency of concurrencyLevels) {
    await runBenchmark(concurrency);
  }
}

main().catch(console.error);

