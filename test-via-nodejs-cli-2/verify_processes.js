#!/usr/bin/env node

const cluster = require('cluster');
const { Worker } = require('worker_threads');
const { execSync } = require('child_process');
const path = require('path');

function getCpuAffinity(pid) {
    try {
        const result = execSync(`taskset -cp ${pid}`, { encoding: 'utf8' }).trim();
        return result;
    } catch (e) {
        return 'unknown';
    }
}

function getProcessInfo(pid) {
    try {
        const ps = execSync(`ps -p ${pid} -o pid,ppid,cmd --no-headers`, { encoding: 'utf8' }).trim();
        return ps;
    } catch (e) {
        return 'unknown';
    }
}

if (cluster.isPrimary) {
    console.log('=== Process and CPU Verification ===\n');
    console.log('Primary Process:');
    console.log('  PID:', process.pid);
    console.log('  CPU:', getCpuAffinity(process.pid));
    console.log('  Info:', getProcessInfo(process.pid));
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
            console.log(`\nProcess ${msg.procIndex}:`);
            console.log('  PID:', msg.pid);
            console.log('  CPU:', getCpuAffinity(msg.pid));
            console.log('  Info:', getProcessInfo(msg.pid));
            console.log('  Threads created:', msg.threadCount);
            console.log('  Thread PIDs:', msg.threadPids);
            console.log('  Thread CPUs:', msg.threadCpus);

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

    // Create worker threads
    const threadPids = [];
    const threadCpus = [];
    const promises = [];

    for (let i = 0; i < threadsPerProc; i++) {
        const promise = new Promise((resolve) => {
            const worker = new Worker(`
                const { parentPort, workerData } = require('worker_threads');
                const { execSync } = require('child_process');
                
                function getCpu(pid) {
                    try {
                        return execSync('taskset -cp ' + pid, {encoding: 'utf8'}).trim();
                    } catch(e) {
                        return 'unknown';
                    }
                }
                
                parentPort.postMessage({
                    threadPid: process.pid,
                    threadCpu: getCpu(process.pid)
                });
            `, { eval: true });

            worker.on('message', (msg) => {
                threadPids.push(msg.threadPid);
                threadCpus.push(msg.threadCpu);
                resolve();
            });
        });
        promises.push(promise);
    }

    Promise.all(promises).then(() => {
        process.send({
            procIndex,
            pid: process.pid,
            threadCount: threadPids.length,
            threadPids,
            threadCpus
        });
        setTimeout(() => process.exit(0), 100);
    });
}

