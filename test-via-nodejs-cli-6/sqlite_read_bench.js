#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const Database = require('better-sqlite3');

// ------------------------ DB SETUP ------------------------ //

function createDb(dbPath, nRows = 2000, xRange = 1000) {
    if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
    }

    const db = new Database(dbPath);
    
    // Optimize PRAGMA settings for performance
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -256000'); // Large cache
    db.pragma('temp_store = MEMORY');
    db.pragma('mmap_size = 1073741824'); // 1GB memory-mapped I/O

    db.exec(`
    CREATE TABLE table1 (
      id INTEGER PRIMARY KEY,
      x  INTEGER NOT NULL,
      a  TEXT,
      b  TEXT,
      c  TEXT,
      d  TEXT
    )
  `);

    const insert = db.prepare('INSERT INTO table1 (x, a, b, c, d) VALUES (?, ?, ?, ?, ?)');

    const insertMany = db.transaction((rows) => {
        for (const row of rows) {
            insert.run(...row);
        }
    });

    const rows = [];
    for (let i = 0; i < nRows; i++) {
        const xVal = Math.floor(Math.random() * xRange);
        const s = `v${i}`;
        rows.push([xVal, s, s, s, s]);
    }

    insertMany(rows);
    db.close();
}

// ------------------------ CPU AFFINITY ------------------------ //

function setCpuAffinity(cpuIndex) {
    try {
        if (process.platform === 'linux') {
            const { execSync } = require('child_process');
            execSync(`taskset -cp ${cpuIndex} ${process.pid}`, { stdio: 'ignore' });
        }
    } catch (err) {
        // Ignore failures; pinning is nice-to-have, not required
    }
}

// ------------------------ MAIN / ORCHESTRATION ------------------------ //

async function runBenchmark(dbPath, nRows, xRange, threads, queriesPerThread, pinCpus) {
    console.log(`Creating DB at ${dbPath} with ${nRows} rows (x in [0,${xRange}))`);
    createDb(dbPath, nRows, xRange);

    if (pinCpus) {
        // Pin main process to CPU 0
        setCpuAffinity(0);
    }

    console.log(`Running benchmark with ${threads} worker threads`);
    console.log(`Queries per thread: ${queriesPerThread}`);
    console.log(`Total queries: ${threads * queriesPerThread}`);
    if (pinCpus) {
        console.log(`CPU pinning: Main process on CPU 0, workers distributed`);
    }

    const globalStart = performance.now();
    const threadStats = [];

    // Create worker threads - each will open its own connection to the same DB
    const promises = [];
    for (let i = 0; i < threads; i++) {
        const promise = new Promise((resolve, reject) => {
            const worker = new Worker(path.join(__dirname, 'worker.js'), {
                workerData: { 
                    dbPath, 
                    xRange, 
                    queriesPerThread,
                    threadIndex: i
                }
            });

            worker.on('message', (result) => {
                threadStats.push(result);
                resolve();
            });

            worker.on('error', reject);
        });
        promises.push(promise);
    }

    await Promise.all(promises);

    const globalEnd = performance.now();
    const globalWall = (globalEnd - globalStart) / 1000;

    // ------------------------ REPORTING ------------------------ //

    const allThreadQps = threadStats.map(s => s.queries / s.elapsed);
    const totalQueries = threadStats.reduce((sum, s) => sum + s.queries, 0);

    // Calculate statistics
    allThreadQps.sort((a, b) => a - b);
    const minQps = Math.min(...allThreadQps);
    const maxQps = Math.max(...allThreadQps);
    const meanQps = allThreadQps.reduce((sum, qps) => sum + qps, 0) / allThreadQps.length;
    const medianQps = allThreadQps.length % 2 === 0
        ? (allThreadQps[allThreadQps.length / 2 - 1] + allThreadQps[allThreadQps.length / 2]) / 2
        : allThreadQps[Math.floor(allThreadQps.length / 2)];

    // Calculate per-thread stats
    const perThreadStats = threadStats.map((s, i) => ({
        threadIndex: i,
        queries: s.queries,
        elapsed: s.elapsed,
        qps: s.queries / s.elapsed
    }));

    console.log('\n--- Per-thread stats ---');
    for (const stat of perThreadStats) {
        console.log(`Thread ${stat.threadIndex}:`);
        console.log(`  Wall time: ${stat.elapsed.toFixed(4)} s`);
        console.log(`  Queries:   ${stat.queries}`);
        console.log(`  QPS:       ${stat.qps.toFixed(2)}`);
    }

    console.log('\n--- Per-thread QPS statistics ---');
    console.log(`Threads total: ${allThreadQps.length}`);
    console.log(`Min QPS:   ${minQps.toFixed(2)}`);
    console.log(`Median QPS:${medianQps.toFixed(2)}`);
    console.log(`Mean QPS:  ${meanQps.toFixed(2)}`);
    console.log(`Max QPS:   ${maxQps.toFixed(2)}`);

    console.log('\n--- Global stats ---');
    console.log(`Total queries:      ${totalQueries}`);
    console.log(`Global wall time:   ${globalWall.toFixed(4)} s (includes thread startup/teardown)`);
    console.log(`Global effective QPS: ${(totalQueries / globalWall).toFixed(2)}`);

    process.exit(0);
}

// ------------------------ CLI PARSING ------------------------ //

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        dbPath: 'test_reads.sqlite3',
        rows: 2000,
        xRange: 1000,
        threads: 32, // Default: match Python's 2 proc × 16 threads
        queriesPerThread: 175,
        pinCpus: false
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--db-path':
                options.dbPath = args[++i];
                break;
            case '--rows':
                options.rows = parseInt(args[++i]);
                break;
            case '--x-range':
                options.xRange = parseInt(args[++i]);
                break;
            case '--threads':
                options.threads = parseInt(args[++i]);
                break;
            case '--queries-per-thread':
                options.queriesPerThread = parseInt(args[++i]);
                break;
            case '--pin-cpus':
                options.pinCpus = true;
                break;
            case '--help':
                console.log(`
SQLite3 concurrent read performance benchmark (Node.js - worker threads)

Options:
  --db-path <path>           Path to SQLite file (will be overwritten) [default: test_reads.sqlite3]
  --rows <n>                 Number of rows to insert [default: 2000]
  --x-range <n>              Random x range: [0, x_range) [default: 1000]
  --threads <n>              Number of worker threads [default: 32]
  --queries-per-thread <n>   Queries each thread will execute [default: 175]
  --pin-cpus                 Best-effort: pin main process to CPU 0
  --help                     Show this help message
        `);
                process.exit(0);
        }
    }

    return options;
}

// ------------------------ ENTRY POINT ------------------------ //

const options = parseArgs();
runBenchmark(
    options.dbPath,
    options.rows,
    options.xRange,
    options.threads,
    options.queriesPerThread,
    options.pinCpus
);

