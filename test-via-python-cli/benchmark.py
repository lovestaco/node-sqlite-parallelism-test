import os
import time
import subprocess
import concurrent.futures
import sqlite3

DB_NAME = "test.db"
QUERIES = 2000
QUERY_SQL = "SELECT max(id), max(info) FROM (SELECT rowid AS id, info FROM lorem) GROUP BY id%500;"

def setup_db():
    if os.path.exists(DB_NAME):
        os.remove(DB_NAME)
    
    # Use python's sqlite3 to populate efficiently
    con = sqlite3.connect(DB_NAME)
    cur = con.cursor()
    
    # Enable WAL mode for better concurrency
    cur.execute("PRAGMA journal_mode=WAL")
    
    cur.execute("CREATE TABLE lorem (info TEXT)")
    
    data = [("Ipsum " + str(i),) for i in range(2000)]
    cur.executemany("INSERT INTO lorem VALUES (?)", data)
    con.commit()
    con.close()
    print(f"Database {DB_NAME} created with 2000 rows.")

def run_query(_):
    # Use immutable mode for read-only queries (better concurrency)
    subprocess.run(["sqlite3", f"file:{DB_NAME}?immutable=1", QUERY_SQL], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def benchmark(concurrency, file_handle):
    msg = f"--- Testing Concurrency: {concurrency} ---"
    print(msg)
    file_handle.write(msg + "\n")
    
    start_time = time.time()
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        # Submit QUERIES tasks
        futures = [executor.submit(run_query, i) for i in range(QUERIES)]
        # Wait for all to complete
        for future in concurrent.futures.as_completed(futures):
            pass
            
    end_time = time.time()
    duration = end_time - start_time
    result_msg = f"Concurrency {concurrency}: {QUERIES} queries in {duration:.3f} seconds ({duration/QUERIES*1000:.3f} ms/query)"
    print(result_msg)
    file_handle.write(result_msg + "\n")

def main():
    setup_db()
    
    # Ensure results directory exists
    os.makedirs("results", exist_ok=True)
    
    # Concurrency levels to test (limited to CPU count as requested)
    levels = [1, 2]
    
    with open("results/benchmark.txt", "w") as f:
        for level in levels:
            benchmark(level, f)

if __name__ == "__main__":
    main()
