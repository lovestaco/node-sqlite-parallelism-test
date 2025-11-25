#!/usr/bin/env node

const cluster = require('cluster');
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

    // Create covering index for index-only scans on id
    db.exec('CREATE INDEX idx_id_covering ON table1(id, a, b, c, d)');

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
    
    // Analyze table for query optimizer
    db.exec('ANALYZE table1');
    db.pragma('optimize');
    
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

// ------------------------ PROCESS WORKER ------------------------ //

async function processWorker(procIndex, dbPath, nRows, threadsPerProc, queriesPerThread, cpuIndex) {
    if (cpuIndex !== null) {
        setCpuAffinity(cpuIndex);
    }

    const threadStats = [];
    const procStart = performance.now();

    // Create worker threads
    const promises = [];
    for (let i = 0; i < threadsPerProc; i++) {
        const promise = new Promise((resolve, reject) => {
            const worker = new Worker(path.join(__dirname, 'worker.js'), {
                workerData: { dbPath, idRange: nRows, queriesPerThread }
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

    const procEnd = performance.now();
    const procWall = (procEnd - procStart) / 1000; // convert to seconds

    // Aggregate per-process stats
    const totalQueries = threadStats.reduce((sum, s) => sum + s.queries, 0);
    const procQps = totalQueries / procWall;
    const perThreadQps = threadStats.map(s => s.queries / s.elapsed);

    return {
        procIndex,
        threadStats,
        procWall,
        procQps,
        totalQueries,
        perThreadQps
    };
}

// ------------------------ MAIN / ORCHESTRATION ------------------------ //

async function runBenchmark(dbPath, nRows, xRange, processes, threadsPerProc, queriesPerThread, pinCpus) {
    console.log(`Creating DB at ${dbPath} with ${nRows} rows (id in [1,${nRows}])`);
    createDb(dbPath, nRows, xRange);

    const cpuIndices = pinCpus ? Array.from({ length: processes }, (_, i) => i) : Array(processes).fill(null);

    console.log(`Running benchmark with ${processes} processes × ${threadsPerProc} threads`);
    console.log(`Total threads: ${processes * threadsPerProc}`);
    console.log(`Queries per thread: ${queriesPerThread}`);
    console.log(`Total queries: ${processes * threadsPerProc * queriesPerThread}`);
    if (pinCpus) {
        console.log(`Attempting to pin processes to CPUs: [${cpuIndices.join(', ')}]`);
    }

    const globalStart = performance.now();
    const results = [];

    if (processes === 1) {
        // Single process mode - run directly
        const result = await processWorker(0, dbPath, nRows, threadsPerProc, queriesPerThread, cpuIndices[0]);
        results.push(result);
    } else {
        // Multi-process mode using cluster
        await new Promise((resolve) => {
            let completedProcesses = 0;
            const workers = [];

            for (let i = 0; i < processes; i++) {
                const worker = cluster.fork({
                    PROC_INDEX: i,
                    DB_PATH: dbPath,
                    N_ROWS: nRows,
                    THREADS_PER_PROC: threadsPerProc,
                    QUERIES_PER_THREAD: queriesPerThread,
                    CPU_INDEX: cpuIndices[i]
                });
                workers.push(worker);

                worker.on('message', (result) => {
                    results.push(result);
                    completedProcesses++;
                    if (completedProcesses === processes) {
                        // Kill all workers
                        workers.forEach(w => w.kill());
                        resolve();
                    }
                });
            }
        });
    }

    const globalEnd = performance.now();
    const globalWall = (globalEnd - globalStart) / 1000; // convert to seconds

    // ------------------------ REPORTING ------------------------ //

    const allThreadQps = [];
    let allQueries = 0;

    for (const res of results) {
        allThreadQps.push(...res.perThreadQps);
        allQueries += res.totalQueries;
    }

    console.log('\n--- Per-process stats ---');
    for (const res of results) {
        console.log(`Process ${res.procIndex}:`);
        console.log(`  Wall time: ${res.procWall.toFixed(4)} s`);
        console.log(`  Queries:   ${res.totalQueries}`);
        console.log(`  QPS:       ${res.procQps.toFixed(2)}`);
    }

    // Calculate statistics
    allThreadQps.sort((a, b) => a - b);
    const minQps = Math.min(...allThreadQps);
    const maxQps = Math.max(...allThreadQps);
    const meanQps = allThreadQps.reduce((sum, qps) => sum + qps, 0) / allThreadQps.length;
    const medianQps = allThreadQps.length % 2 === 0
        ? (allThreadQps[allThreadQps.length / 2 - 1] + allThreadQps[allThreadQps.length / 2]) / 2
        : allThreadQps[Math.floor(allThreadQps.length / 2)];

    console.log('\n--- Per-thread QPS (over all processes) ---');
    console.log(`Threads total: ${allThreadQps.length}`);
    console.log(`Min QPS:   ${minQps.toFixed(2)}`);
    console.log(`Median QPS:${medianQps.toFixed(2)}`);
    console.log(`Mean QPS:  ${meanQps.toFixed(2)}`);
    console.log(`Max QPS:   ${maxQps.toFixed(2)}`);

    console.log('\n--- Global stats ---');
    console.log(`Total queries:      ${allQueries}`);
    console.log(`Global wall time:   ${globalWall.toFixed(4)} s (includes process startup/teardown)`);
    console.log(`Global effective QPS: ${(allQueries / globalWall).toFixed(2)}`);

    process.exit(0);
}

// ------------------------ CLUSTER WORKER ------------------------ //

if (!cluster.isPrimary && process.env.PROC_INDEX !== undefined) {
    (async () => {
        const procIndex = parseInt(process.env.PROC_INDEX);
        const dbPath = process.env.DB_PATH;
        const nRows = parseInt(process.env.N_ROWS);
        const threadsPerProc = parseInt(process.env.THREADS_PER_PROC);
        const queriesPerThread = parseInt(process.env.QUERIES_PER_THREAD);
        const cpuIndex = process.env.CPU_INDEX !== 'null' ? parseInt(process.env.CPU_INDEX) : null;

        const result = await processWorker(procIndex, dbPath, nRows, threadsPerProc, queriesPerThread, cpuIndex);
        process.send(result);
        process.exit(0);
    })();
}

// ------------------------ CLI PARSING ------------------------ //

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        dbPath: 'test_reads.sqlite3',
        rows: 2000,
        xRange: 1000,
        processes: 2,
        threadsPerProc: 3, // Optimized: 3 threads per process gives best performance
        queriesPerThread: 50000,
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
                break; // Still used for data generation, but queries use id
            case '--processes':
                options.processes = parseInt(args[++i]);
                break;
            case '--threads-per-proc':
                options.threadsPerProc = parseInt(args[++i]);
                break;
            case '--queries-per-thread':
                options.queriesPerThread = parseInt(args[++i]);
                break;
            case '--pin-cpus':
                options.pinCpus = true;
                break;
            case '--help':
                console.log(`
SQLite3 concurrent read performance benchmark (Node.js)

Options:
  --db-path <path>           Path to SQLite file (will be overwritten) [default: test_reads.sqlite3]
  --rows <n>                 Number of rows to insert [default: 2000]
  --x-range <n>              Random x range for data generation [default: 1000] (queries use id)
  --processes <n>            Number of worker processes [default: 2]
  --threads-per-proc <n>     Number of threads per process [default: 3]
  --queries-per-thread <n>   Queries each thread will execute [default: 50000]
  --pin-cpus                 Best-effort: pin each process to a separate CPU
  --help                     Show this help message
        `);
                process.exit(0);
        }
    }

    return options;
}

// ------------------------ ENTRY POINT ------------------------ //

if (cluster.isPrimary && process.env.PROC_INDEX === undefined) {
    const options = parseArgs();
    runBenchmark(
        options.dbPath,
        options.rows,
        options.xRange,
        options.processes,
        options.threadsPerProc,
        options.queriesPerThread,
        options.pinCpus
    );
}
