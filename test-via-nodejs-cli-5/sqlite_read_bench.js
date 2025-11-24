#!/usr/bin/env node

const cluster = require('cluster');
const fs = require('fs');
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

// ------------------------ PROCESS WORKER (NO WORKER THREADS) ------------------------ //

function processWorker(procIndex, dbPath, xRange, queriesPerProcess, cpuIndex) {
    if (cpuIndex !== null) {
        setCpuAffinity(cpuIndex);
    }

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
    for (let i = 0; i < queriesPerProcess; i++) {
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

    return {
        procIndex,
        procWall: elapsed,
        totalQueries: queriesPerProcess,
        procQps: queriesPerProcess / elapsed
    };
}

// ------------------------ MAIN / ORCHESTRATION ------------------------ //

function runBenchmark(dbPath, nRows, xRange, processes, queriesPerProcess, pinCpus) {
    console.log(`Creating DB at ${dbPath} with ${nRows} rows (x in [0,${xRange}))`);
    createDb(dbPath, nRows, xRange);

    const cpuIndices = pinCpus ? Array.from({ length: processes }, (_, i) => i) : Array(processes).fill(null);

    console.log(`Running benchmark with ${processes} processes (no worker threads)`);
    console.log(`Queries per process: ${queriesPerProcess}`);
    console.log(`Total queries: ${processes * queriesPerProcess}`);
    if (pinCpus) {
        console.log(`Attempting to pin processes to CPUs: [${cpuIndices.join(', ')}]`);
    }

    const globalStart = performance.now();
    const results = [];

    if (processes === 1) {
        // Single process mode
        const result = processWorker(0, dbPath, xRange, queriesPerProcess, cpuIndices[0]);
        results.push(result);
    } else {
        // Multi-process mode using cluster
        const workers = [];
        let completedProcesses = 0;

        for (let i = 0; i < processes; i++) {
            const worker = cluster.fork({
                PROC_INDEX: i,
                DB_PATH: dbPath,
                X_RANGE: xRange,
                QUERIES_PER_PROC: queriesPerProcess,
                CPU_INDEX: cpuIndices[i]
            });
            workers.push(worker);

            worker.on('message', (result) => {
                results.push(result);
                completedProcesses++;
                if (completedProcesses === processes) {
                    workers.forEach(w => w.kill());
                    const globalEnd = performance.now();
                    const globalWall = (globalEnd - globalStart) / 1000;

                    // ------------------------ REPORTING ------------------------ //

                    let allQueries = 0;
                    for (const res of results) {
                        allQueries += res.totalQueries;
                    }

                    console.log('\n--- Per-process stats ---');
                    for (const res of results) {
                        console.log(`Process ${res.procIndex}:`);
                        console.log(`  Wall time: ${res.procWall.toFixed(4)} s`);
                        console.log(`  Queries:   ${res.totalQueries}`);
                        console.log(`  QPS:       ${res.procQps.toFixed(2)}`);
                    }

                    console.log('\n--- Global stats ---');
                    console.log(`Total queries:      ${allQueries}`);
                    console.log(`Global wall time:   ${globalWall.toFixed(4)} s (includes process startup/teardown)`);
                    console.log(`Global effective QPS: ${(allQueries / globalWall).toFixed(2)}`);

                    process.exit(0);
                }
            });
        }
    }
}

// ------------------------ CLUSTER WORKER ------------------------ //

if (!cluster.isPrimary && process.env.PROC_INDEX !== undefined) {
    const procIndex = parseInt(process.env.PROC_INDEX);
    const dbPath = process.env.DB_PATH;
    const xRange = parseInt(process.env.X_RANGE);
    const queriesPerProcess = parseInt(process.env.QUERIES_PER_PROC);
    const cpuIndex = process.env.CPU_INDEX !== 'null' ? parseInt(process.env.CPU_INDEX) : null;

    const result = processWorker(procIndex, dbPath, xRange, queriesPerProcess, cpuIndex);
    process.send(result);
    process.exit(0);
}

// ------------------------ CLI PARSING ------------------------ //

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        dbPath: 'test_reads.sqlite3',
        rows: 2000,
        xRange: 1000,
        processes: 2,
        queriesPerProcess: 2800, // Default: split 5600 queries across 2 processes
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
            case '--processes':
                options.processes = parseInt(args[++i]);
                break;
            case '--queries-per-process':
                options.queriesPerProcess = parseInt(args[++i]);
                break;
            case '--pin-cpus':
                options.pinCpus = true;
                break;
            case '--help':
                console.log(`
SQLite3 concurrent read performance benchmark (Node.js - no worker threads)

Options:
  --db-path <path>           Path to SQLite file (will be overwritten) [default: test_reads.sqlite3]
  --rows <n>                 Number of rows to insert [default: 2000]
  --x-range <n>              Random x range: [0, x_range) [default: 1000]
  --processes <n>            Number of worker processes [default: 2]
  --queries-per-process <n>  Queries each process will execute [default: 2800]
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
        options.queriesPerProcess,
        options.pinCpus
    );
}

