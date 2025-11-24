#!/usr/bin/env python3
import argparse
import os
import random
import sqlite3
import statistics
import sys
import threading
import time
from multiprocessing import Pool

# ------------------------ DB SETUP ------------------------ #

def create_db(db_path: str, n_rows: int = 2000, x_range: int = 1000):
    if os.path.exists(db_path):
        os.remove(db_path)

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL;")  # better concurrent reads
    cur.execute("""
        CREATE TABLE table1 (
            id INTEGER PRIMARY KEY,
            x  INTEGER NOT NULL,
            a  TEXT,
            b  TEXT,
            c  TEXT,
            d  TEXT
        )
    """)

    rows = []
    for i in range(n_rows):
        x_val = random.randrange(x_range)
        # short random strings; content doesn't matter for perf
        s = f"v{i}"
        rows.append((x_val, s, s, s, s))

    cur.executemany(
        "INSERT INTO table1 (x, a, b, c, d) VALUES (?,?,?,?,?)",
        rows
    )
    conn.commit()
    conn.close()


# ------------------------ CPU AFFINITY ------------------------ #

def set_cpu_affinity(cpu_index: int):
    """
    Best-effort CPU pinning. If it fails, we just ignore it.
    """
    try:
        if hasattr(os, "sched_setaffinity"):
            os.sched_setaffinity(0, {cpu_index})
        elif sys.platform == "win32":
            import ctypes
            mask = 1 << cpu_index
            handle = ctypes.windll.kernel32.GetCurrentProcess()
            ctypes.windll.kernel32.SetProcessAffinityMask(handle, mask)
    except Exception:
        # Ignore failures; pinning is nice-to-have, not required
        pass


# ------------------------ WORKER LOGIC ------------------------ #

def thread_worker(db_path: str,
                  x_range: int,
                  queries_per_thread: int,
                  out_list,
                  index: int):
    """
    Single thread: open its own connection and hammer SELECTs.
    """
    conn = sqlite3.connect(db_path, timeout=30)
    cur = conn.cursor()

    # We time just the loop; random + sqlite call overhead is part of what you see.
    t0 = time.perf_counter()
    for _ in range(queries_per_thread):
        x_val = random.randrange(x_range)
        cur.execute("SELECT a, b, c, d FROM table1 WHERE x = ?", (x_val,))
        cur.fetchall()
    t1 = time.perf_counter()

    conn.close()
    elapsed = t1 - t0
    out_list[index] = {"queries": queries_per_thread, "elapsed": elapsed}


def process_worker(args):
    """
    One process: optionally pin to a CPU, spawn N threads,
    run queries, aggregate stats, return them to parent.
    """
    (proc_index,
     db_path,
     x_range,
     threads_per_proc,
     queries_per_thread,
     cpu_index) = args

    # Distinct seed per process to avoid correlated randoms
    random.seed(time.time() + os.getpid())

    if cpu_index is not None:
        set_cpu_affinity(cpu_index)

    thread_stats = [None] * threads_per_proc
    threads = []

    proc_start = time.perf_counter()
    for i in range(threads_per_proc):
        t = threading.Thread(
            target=thread_worker,
            args=(db_path, x_range, queries_per_thread, thread_stats, i),
            daemon=False,
        )
        t.start()
        threads.append(t)

    for t in threads:
        t.join()
    proc_end = time.perf_counter()

    # Aggregate per-process stats
    total_queries = sum(s["queries"] for s in thread_stats)
    # Using wall-clock for QPS across threads, not sum of per-thread elapsed
    proc_wall = proc_end - proc_start
    proc_qps = total_queries / proc_wall if proc_wall > 0 else float("inf")

    per_thread_qps = [
        s["queries"] / s["elapsed"] if s["elapsed"] > 0 else float("inf")
        for s in thread_stats
    ]

    return {
        "proc_index": proc_index,
        "thread_stats": thread_stats,
        "proc_wall": proc_wall,
        "proc_qps": proc_qps,
        "total_queries": total_queries,
        "per_thread_qps": per_thread_qps,
    }


# ------------------------ MAIN / ORCHESTRATION ------------------------ #

def run_benchmark(db_path: str,
                  n_rows: int,
                  x_range: int,
                  processes: int,
                  threads_per_proc: int,
                  queries_per_thread: int,
                  pin_cpus: bool):
    print(f"Creating DB at {db_path} with {n_rows} rows (x in [0,{x_range}))")
    create_db(db_path, n_rows=n_rows, x_range=x_range)

    cpu_indices = list(range(processes)) if pin_cpus else [None] * processes

    args_list = []
    for i in range(processes):
        cpu_index = cpu_indices[i] if pin_cpus else None
        args_list.append(
            (i, db_path, x_range, threads_per_proc, queries_per_thread, cpu_index)
        )

    print(f"Running benchmark with {processes} processes × {threads_per_proc} threads")
    print(f"Total threads: {processes * threads_per_proc}")
    print(f"Queries per thread: {queries_per_thread}")
    print(f"Total queries: {processes * threads_per_proc * queries_per_thread}")
    if pin_cpus:
        print(f"Attempting to pin processes to CPUs: {cpu_indices}")

    global_start = time.perf_counter()
    with Pool(processes=processes) as pool:
        results = pool.map(process_worker, args_list)
    global_end = time.perf_counter()
    global_wall = global_end - global_start

    # ------------------------ REPORTING ------------------------ #

    all_thread_qps = []
    all_queries = 0
    for res in results:
        all_thread_qps.extend(res["per_thread_qps"])
        all_queries += res["total_queries"]

    print("\n--- Per-process stats ---")
    for res in results:
        print(f"Process {res['proc_index']}:")
        print(f"  Wall time: {res['proc_wall']:.4f} s")
        print(f"  Queries:   {res['total_queries']}")
        print(f"  QPS:       {res['proc_qps']:.2f}")

    print("\n--- Per-thread QPS (over all processes) ---")
    print(f"Threads total: {len(all_thread_qps)}")
    print(f"Min QPS:   {min(all_thread_qps):.2f}")
    print(f"Median QPS:{statistics.median(all_thread_qps):.2f}")
    print(f"Mean QPS:  {statistics.mean(all_thread_qps):.2f}")
    print(f"Max QPS:   {max(all_thread_qps):.2f}")

    print("\n--- Global stats ---")
    print(f"Total queries:      {all_queries}")
    print(f"Global wall time:   {global_wall:.4f} s "
          f"(includes process startup/teardown)")
    print(f"Global effective QPS: {all_queries / global_wall:.2f}")


def parse_args():
    p = argparse.ArgumentParser(
        description="SQLite3 concurrent read performance benchmark"
    )
    p.add_argument("--db-path", default="test_reads.sqlite3",
                   help="Path to SQLite file (will be overwritten)")
    p.add_argument("--rows", type=int, default=2000,
                   help="Number of rows to insert")
    p.add_argument("--x-range", type=int, default=1000,
                   help="Random x range: [0, x_range)")
    p.add_argument("--processes", type=int, default=2,
                   help="Number of worker processes")
    p.add_argument("--threads-per-proc", type=int, default=16,
                   help="Number of threads per process")
    p.add_argument("--queries-per-thread", type=int, default=50000,
                   help="Queries each thread will execute")
    p.add_argument("--pin-cpus", action="store_true",
                   help="Best-effort: pin each process to a separate CPU")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_benchmark(
        db_path=args.db_path,
        n_rows=args.rows,
        x_range=args.x_range,
        processes=args.processes,
        threads_per_proc=args.threads_per_proc,
        queries_per_thread=args.queries_per_thread,
        pin_cpus=args.pin_cpus,
    )