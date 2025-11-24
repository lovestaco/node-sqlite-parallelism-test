#!/usr/bin/env node

const cluster = require('cluster');
const { Worker } = require('worker_threads');
const { execSync } = require('child_process');
const path = require('path');

function getCpuAffinity(pid) {
    try {
        return execSync(`taskset -cp ${pid}`, { encoding: 'utf8' }).trim();
    } catch (e) {
        return 'unknown';
    }
}

function getThreadCount(pid) {
    try {
        const count = execSync(`ps -T -p ${pid} | wc -l`, { encoding: 'utf8' }).trim();
        return parseInt(count) - 1; // Subtract header line
    } catch (e) {
        return 'unknown';
    }
}

if (cluster.isPrimary) {
    console.log('=== Runtime Verification During Benchmark ===\n');
    console.log('Primary Process:');
    console.log('  PID:', process.pid);
    console.log('  CPU:', getCpuAffinity(process.pid));
    console.log('');

    const processes = 2;
    const threadsPerProc = 2;
    const workers = [];
    let completed = 0;

    for (let i = 0; i < processes; i++) {
        const worker = cluster.fork({
            PROC_INDEX: i,
            CPU_INDEX: i,
            THREADS_PER_PROC: threadsPerProc
        });

        worker.on('message', (msg) => {
            console.log(`\nProcess ${msg.procIndex} (PID: ${msg.pid}):`);
            console.log('  CPU Affinity:', getCpuAffinity(msg.pid));
            console.log('  Total Threads in Process:', getThreadCount(msg.pid));
            console.log('  Worker Threads Created:', msg.threadCount);
            console.log('  All threads in same process?', msg.allSameProcess ? 'YES ✅' : 'NO ❌');
            console.log('  CPU pinned correctly?', msg.cpuCorrect ? 'YES ✅' : 'NO ❌');

            completed++;
            if (completed === processes) {
                workers.forEach(w => w.kill());
                setTimeout(() => process.exit(0), 100);
            }
        });

        workers.push(worker);
    }
} else {
    // Cluster worker process
    const procIndex = parseInt(process.env.PROC_INDEX);
    const cpuIndex = parseInt(process.env.CPU_INDEX);
    const threadsPerProc = parseInt(process.env.THREADS_PER_PROC);

    // Pin to CPU
    try {
        execSync(`taskset -cp ${cpuIndex} ${process.pid}`, { stdio: 'ignore' });
    } catch (e) {
        // Ignore
    }

    // Verify CPU pinning
    const currentCpu = getCpuAffinity(process.pid);
    const cpuCorrect = currentCpu.includes(` ${cpuIndex}`) || currentCpu.includes(`: ${cpuIndex}`);

    // Create worker threads
    const threadPids = [];
    const promises = [];

    for (let i = 0; i < threadsPerProc; i++) {
        const promise = new Promise((resolve) => {
            const worker = new Worker(`
                const { parentPort } = require('worker_threads');
                // Worker threads share the same PID as parent process
                parentPort.postMessage({
                    threadPid: process.pid,
                    parentPid: require('worker_threads').workerData?.parentPid || 'unknown'
                });
            `, { 
                eval: true,
                workerData: { parentPid: process.pid }
            });

            worker.on('message', (msg) => {
                threadPids.push(msg.threadPid);
                resolve();
            });
        });
        promises.push(promise);
    }

    Promise.all(promises).then(() => {
        // Check if all threads are in same process (they should be)
        const allSameProcess = threadPids.every(pid => pid === process.pid);

        process.send({
            procIndex,
            pid: process.pid,
            threadCount: threadPids.length,
            allSameProcess,
            cpuCorrect
        });
        setTimeout(() => process.exit(0), 100);
    });
}

