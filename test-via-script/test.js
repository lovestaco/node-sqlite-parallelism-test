const sqlite3 = require('./lib/sqlite3');
const {promisify} = require('util');
const {performance} = require('perf_hooks');

const CONCURRENCY = 10;
const QUERIES = 2000;
const zlib = require('zlib');

async function main() {
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
  for (let i = 0; i < 2000; i++) {
      await promisify(insert.run).call(insert, "Ipsum " + i);
  }

  const selectStatements = await Promise.all(Array.from({length: CONCURRENCY}, ()=>prepare("SELECT max(id), max(info) FROM (SELECT rowid AS id, info FROM lorem) GROUP BY id%500;")));
  const selectAll = selectStatements.map(s=>promisify(s.all.bind(s)));

  const T0 = Date.now(), ELU0=performance.eventLoopUtilization();

  const deflate = promisify(zlib.deflate);
  const deflateTiming = [];
  let int = setInterval(async ()=>{
    const T0=performance.now();
    await deflate(Buffer.from("asdf"));
    const T1=performance.now();
    deflateTiming.push(T1-T0);
  }, 10);

  await Promise.all(Array.from({length: QUERIES}, (_,i) => selectAll[i%selectAll.length]().then(v=>JSON.stringify(v)) ));

  deflateTiming.sort((a, b) => a-b);
  let medianTiming = deflateTiming[(deflateTiming.length/2)|0].toFixed(3);

  const T1 = Date.now(), ELU1=performance.eventLoopUtilization(ELU0);
  console.log(`${QUERIES} queries complete in ${(T1-T0)} ms,  ${(T1-T0)/QUERIES} ms per SELECT, event loop utilisation=${(ELU1.utilization*100).toFixed(0)}%`+
    `, median libuv thread pool queue latency = ${medianTiming} ms`);
  clearInterval(int);
}

main().catch(console.error);