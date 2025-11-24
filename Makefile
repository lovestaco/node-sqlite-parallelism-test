.PHONY: install help test-all clean

# Directories with Node.js implementations
NODE_DIRS = test-via-nodejs-cli test-via-nodejs-cli-2 test-via-nodejs-cli-3 test-via-nodejs-cli-4 test-via-nodejs-cli-5 test-via-nodejs-cli-6

help:
	@echo "SQLite Parallelism Benchmark - Makefile"
	@echo ""
	@echo "Available targets:"
	@echo "  make install    - Install dependencies for all Node.js implementations"
	@echo "  make test-all   - Run all benchmarks (quick test)"
	@echo "  make clean      - Remove generated database files"
	@echo "  make help       - Show this help message"

install:
	@echo "Installing dependencies for all Node.js implementations..."
	@for dir in $(NODE_DIRS); do \
		if [ -d "$$dir" ] && [ -f "$$dir/package.json" ]; then \
			echo ""; \
			echo "Installing dependencies in $$dir..."; \
			cd $$dir && npm install && cd ..; \
		fi; \
	done
	@echo ""
	@echo "✅ All dependencies installed!"

test-all:
	@echo "Running quick tests for all implementations..."
	@echo ""
	@echo "=== Python (Reference) ==="
	@python test-via-python-cli/sqlite_read_bench.py --db-path test_reads.sqlite3 --rows 2000 --processes 2 --threads-per-proc 2 --queries-per-thread 100 --pin-cpus 2>&1 | grep "Global effective QPS" || true
	@echo ""
	@echo "=== cli-2 (better-sqlite3, workers) ==="
	@node test-via-nodejs-cli-2/sqlite_read_bench.js --db-path test_reads.sqlite3 --rows 2000 --processes 2 --threads-per-proc 2 --queries-per-thread 100 --pin-cpus 2>&1 | grep "Global effective QPS" || true
	@echo ""
	@echo "=== cli-3 (node-sqlite3, workers) ==="
	@node test-via-nodejs-cli-3/sqlite_read_bench.js --db-path test_reads.sqlite3 --rows 2000 --processes 2 --threads-per-proc 1 --queries-per-thread 200 --pin-cpus 2>&1 | grep "Global effective QPS" || true
	@echo ""
	@echo "=== cli-4 (node-sqlite3, no workers) ==="
	@node test-via-nodejs-cli-4/sqlite_read_bench.js --db-path test_reads.sqlite3 --rows 2000 --processes 2 --queries-per-process 200 --pin-cpus 2>&1 | grep "Global effective QPS" || true
	@echo ""
	@echo "=== cli-5 (better-sqlite3, no workers) ==="
	@node test-via-nodejs-cli-5/sqlite_read_bench.js --db-path test_reads.sqlite3 --rows 2000 --processes 2 --queries-per-process 200 --pin-cpus 2>&1 | grep "Global effective QPS" || true
	@echo ""
	@echo "=== cli-6 (better-sqlite3, single proc) ==="
	@node test-via-nodejs-cli-6/sqlite_read_bench.js --db-path test_reads.sqlite3 --rows 2000 --threads 2 --queries-per-thread 200 --pin-cpus 2>&1 | grep "Global effective QPS" || true
	@echo ""
	@echo "✅ All tests completed!"

clean:
	@echo "Cleaning generated database files..."
	@rm -f test_reads.sqlite3 test_reads.sqlite3-* test.db
	@rm -f test-via-*/test_reads.sqlite3 test-via-*/test_reads.sqlite3-* test-via-*/test.db
	@echo "✅ Cleaned!"

