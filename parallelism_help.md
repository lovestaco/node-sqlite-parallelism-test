# Node-sqlite3 API

https://github.com/TryGhost/node-sqlite3/wiki/API

ℹ️ Please use the GitHub table-of-contents to browse the API docs.

Install `sqlite3` by following the [Installation instructions](https://github.com/TryGhost/node-sqlite3#installing). The docs below show the public interface of the library.

Note: excluding a `callback` does not turn the API synchronous.

## `new sqlite3.Database(filename [, mode] [, callback])`

Returns a new Database object and automatically opens the database. There is no separate method to open the database.

* `filename`: Valid values are filenames, `":memory:"` for an anonymous in-memory database and an empty string for an anonymous disk-based database. Anonymous databases are not persisted and when closing the database handle, their contents are lost.

* `mode` *(optional)*: One or more of `sqlite3.OPEN_READONLY`, `sqlite3.OPEN_READWRITE`, `sqlite3.OPEN_CREATE`, `sqlite3.OPEN_FULLMUTEX`, `sqlite3.OPEN_URI`, `sqlite3.OPEN_SHAREDCACHE`, `sqlite3.OPEN_PRIVATECACHE`. The default value is `OPEN_READWRITE | OPEN_CREATE | OPEN_FULLMUTEX`.

* `callback` *(optional)*: If provided, this function will be called when the database was opened successfully or when an error occurred. The first argument is an error object. When it is `null`, opening succeeded. If no callback is provided and an error occurred, an `error` event with the error object as the only parameter will be emitted on the database object. If opening succeeded, an `open` event with no parameters is emitted, regardless of whether a callback was provided or not.

## `sqlite3.verbose()`

Sets the execution mode to verbose to produce long stack traces. There is no way to reset this. See the wiki page on [debugging](https://github.com/developmentseed/node-sqlite3/wiki/Debugging) for more information.

***

# **Database**

## `close([callback])`

Closes the database.

* `callback` *(optional)*: If provided, this function will be called when the database was closed successfully or when an error occurred. The first argument is an error object. When it is `null`, closing succeeded. If no callback is provided and an error occurred, an `error` event with the error object as the only parameter will be emitted on the database object. If closing succeeded, a `close` event with no parameters is emitted, regardless of whether a callback was provided or not.

## `configure(option, value)`

Set a configuration option for the database. Valid options are:

* [Tracing & profiling](https://www.sqlite.org/c3ref/profile.html)
  * trace: provide a function callback as a value. Invoked when an SQL statement executes, with a rendering of the statement text.
  * profile: provide a function callback. Invoked every time an SQL statement executes.
* busyTimeout: provide an integer as a value. Sets the [busy timeout](https://www.sqlite.org/c3ref/busy_timeout.html).

## `run(sql [, param, ...] [, callback])`

Runs the SQL query with the specified parameters and calls the callback afterwards. It does not retrieve any result data. The function returns the Database object for which it was called to allow for function chaining.

* `sql`: The SQL query to run. If the SQL query is invalid and a callback was passed to the function, it is called with an error object containing the error message from SQLite. If no callback was passed and preparing fails, an `error` event will be emitted on the underlying Statement object.

* `param, ...` *(optional)*: When the SQL statement contains placeholders, you can pass them in here. They will be bound to the statement before it is executed. There are three ways of passing bind parameters: directly in the function's arguments, as an array, and as an object for named parameters. This automatically sanitizes inputs RE: [issue #57](https://github.com/mapbox/node-sqlite3/issues/57). Parameters may not be used for column or table names.

In case you want to keep the callback as the 3rd parameter, you should set param to "\[]" ( Empty Array ) as per [issue #116](https://github.com/mapbox/node-sqlite3/issues/116)

```javascript
// Directly in the function arguments.
db.run("UPDATE tbl SET name = ? WHERE id = ?", "bar", 2);

// As an array.
db.run("UPDATE tbl SET name = ? WHERE id = ?", [ "bar", 2 ]);

// As an object with named parameters.
db.run("UPDATE tbl SET name = $name WHERE id = $id", {
    $id: 2,
    $name: "bar"
});
```

Named parameters can be prefixed with `:name`, `@name` and `$name`. We recommend using `$name` since JavaScript allows using the dollar sign as a variable name without having to escape it. You can also specify a numeric index after a `?` placeholder. These correspond to the position in the array. Note that placeholder indexes start at 1 in SQLite. `node-sqlite3` maps arrays to start with one so that you don't have to specify an empty value as the first array element (with index 0). You can also use numeric object keys to bind values. Note that in this case, the first index is 1:

```javascript
      db.run("UPDATE tbl SET name = ?5 WHERE id = ?", {
          1: 2,
          5: "bar"
      });
```

This binds the first placeholder (`$id`) to `2` and the placeholder with index `5` to `"bar"`. While this is valid in SQLite and `node-sqlite3`, it is not recommended to mix different placeholder types.

If you use an array or an object to bind parameters, it must be the first value in the bind arguments list. If any other object is before it, an error will be thrown. Additional bind parameters after an array or object will be ignored.

* `callback` *(optional)*: If given, it will be called when an error occurs during any step of the statement preparation or execution, *or* after the query was run. If an error occurred, the first (and only) parameter will be an error object containing the error message. If execution was successful, the first parameter is `null`. The context of the function (the `this` object inside the function) is the statement object. Note that it is not possible to run the statement again because it is automatically finalized after running for the first time. Any subsequent attempts to run the statement again will fail.

If execution was successful, the `this` object will contain two properties named `lastID` and `changes` which contain the value of the last inserted row ID and the number of rows affected by this query respectively. Note that:

* you **must** use an old-school `function () { ... }` style callback rather than a lambda function, otherwise `this.lastID` and `this.changes` will be `undefined`.
* `lastID` **only** contains valid information when the query was a successfully completed `INSERT` statement and `changes` **only** contains valid information when the query was a successfully completed `UPDATE` or `DELETE` statement. In all other cases, the content of these properties is inaccurate and should not be used. The `.run()` function is the only query method that sets these two values; all other query methods such as `.all()` or `.get()` don't retrieve these values.

## `get(sql [, param, ...] [, callback])`

Runs the SQL query with the specified parameters and calls the callback with the a subsequent result row. The function returns the Database object to allow for function chaining. The parameters are the same as the `Database#run` function, with the following differences:

The signature of the callback is `function(err, row) {}`. If the result set is empty, the second parameter is `undefined`, otherwise it is an object containing the values for the first row. The property names correspond to the column names of the result set. It is impossible to access them by column index; the only supported way is by column name.

## `all(sql [, param, ...] [, callback])`

Runs the SQL query with the specified parameters and calls the callback with all result rows afterwards. The function returns the Database object to allow for function chaining. The parameters are the same as the `Database#run` function, with the following differences:

The signature of the callback is `function(err, rows) {}`. `rows` is an array. If the result set is empty, it will be an empty array, otherwise it will have an object for each result row which in turn contains the values of that row, like the `Database#get` function.

Note that it first retrieves all result rows and stores them in memory. For queries that have potentially large result sets, use the `Database#each` function to retrieve all rows or `Database#prepare` followed by multiple `Statement#get` calls to retrieve a previously unknown amount of rows.

## `each(sql [, param, ...] [, callback] [, complete])`

Runs the SQL query with the specified parameters and calls the callback once for each result row. The function returns the Database object to allow for function chaining. The parameters are the same as the `Database#run` function, with the following differences:

The signature of the callback is `function(err, row) {}`. If the result set succeeds but is empty, the callback is never called. In all other cases, the callback is called once for every retrieved row. The order of calls correspond exactly to the order of rows in the result set.

After all row callbacks were called, the completion callback will be called if present. The first argument is an error object, and the second argument is the number of retrieved rows. If you specify only one function, it will be treated as row callback, if you specify two, the first (== second to last) function will be the row callback, the last function will be the completion callback.

If you know that a query only returns a very limited number of rows, it might be more convenient to use `Database#all` to retrieve all rows at once.

There is currently no way to abort execution.

## `exec(sql [, callback])`

Runs all SQL queries in the supplied string. No result rows are retrieved. The function returns the Database object to allow for function chaining. If a query fails, no subsequent statements will be executed (wrap it in a transaction if you want all or none to be executed). When all statements have been executed successfully, or when an error occurs, the callback function is called, with the first parameter being either `null` or an error object. When no callback is provided and an error occurs, an `error` event will be emitted on the database object.

Note: This function will only execute statements up to the first NULL byte.

## `prepare(sql [, param, ...] [, callback])`

Prepares the SQL statement and optionally binds the specified parameters and calls the callback when done. The function returns a Statement object.

When preparing was successful, the first and only argument to the callback is `null`, otherwise it is the error object. When bind parameters are supplied, they are bound to the prepared statement before calling the callback.

## `map(sql [, callback])`

Shortcut to `Statement#map`.

## `loadExtension(path [, callback])`

Loads a compiled SQLite extension into the database connection object.

* `path`: Filename of the extension to load.

* `callback` *(optional)*: If provided, this function will be called when the extension was loaded successfully or when an error occurred. The first argument is an error object. When it is `null`, loading succeeded. If no callback is provided and an error occurred, an `error` event with the error object as the only parameter will be emitted on the database object.

**Note: Make sure that the extensions you load are compiled or linked against the same version as `node-sqlite3` was compiled.** Version mismatches can lead to unpredictable behavior.

#### Building an Extension

**half**: The SQLite documentation gives an example of a user-defined function "half" which takes a number and returns a result (the number divided by two): http://www.sqlite.org/cvstrac/wiki?p=LoadableExtensions

**rank**: A ready-to `make` example from the full-text search docs https://github.com/coolaj86/sqlite3-fts4-rank . See also: http://www.mail-archive.com/sqlite-users@sqlite.org/msg71740.html

## `interrupt()`

Allows the user to interrupt long-running queries. Wrapper around `sqlite3_interrupt` and causes other data-fetching functions to be passed an `err` with code = `sqlite3.INTERRUPT`. The database must be open to use this function.

***

# **Statement**

## `bind([param, ...] [, callback])`

Binds parameters to the prepared statement and calls the callback when done or when an error occurs. The function returns the Statement object to allow for function chaining. The first and only argument to the callback is `null` when binding was successful, otherwise it is the error object.

Binding parameters with this function completely resets the statement object and row cursor and removes all previously bound parameters, if any.

## `reset([callback])`

Resets the row cursor of the statement and preserves the parameter bindings. Use this function to re-execute the same query with the same bindings. The function returns the Statement object to allow for function chaining. The callback will be called after the reset is complete. This action will never fail and will always return `null` as the first and only callback parameter.

## `finalize([callback])`

Finalizes the statement.

This is typically optional, but if you experience long delays before the next query is executed, explicitly finalizing your statement might be necessary. This might be the case when you run an exclusive query (see section *Control Flow*). After the statement is finalized, all further function calls on that statement object will throw errors.

## `run([param, ...] [, callback])`

Binds parameters and executes the statement. The function returns the Statement object to allow for function chaining.

If you specify bind parameters, they will be bound to the statement before it is executed. Note that the bindings and the row cursor are reset when you specify even a single bind parameter.

The callback behavior is identical to the `Database#run` method with the difference that the statement will not be finalized after it is run. This means you can run it multiple times.

## `get([param, ...] [, callback])`

Binds parameters, executes the statement and retrieves the first result row. The function returns the Statement object to allow for function chaining. The parameters are the same as the Statement#run function, with the following differences:

The signature of the callback is `function(err, row) {}`. If the result set is empty, the second parameter is undefined, otherwise it is an object containing the values for the first row. Like with `Statement#run`, the statement will not be finalized after executing this function.

Using this method can leave the database locked, as the database awaits further calls to `Statement#get` to retrieve subsequent rows. To inform the database that you are finished retrieving rows, you should either finalize (with `Statement#finalize`) or reset (with `Statement#reset`) the statement.

## `all([param, ...] [, callback])`

Binds parameters, executes the statement and calls the callback with all result rows. The function returns the Statement object to allow for function chaining. The parameters are the same as the Statement#run function, with the following differences:

The signature of the callback is `function(err, rows) {}`. If the result set is empty, the second parameter is an empty array, otherwise it contains an object for each result row which in turn contains the values of that row. Like with `Statement#run`, the statement will not be finalized after executing this function.

## `each([param, ...] [, callback] [, complete])`

Binds parameters, executes the statement and calls the callback for each result row. The function returns the Statement object to allow for function chaining. The parameters are the same as the Statement#run function, with the following differences:

The signature of the callback is `function(err, row) {}`. If the result set succeeds but is empty, the callback is never called. In all other cases, the callback is called once for every retrieved row. The order of calls correspond exactly to the order of rows in the result set.

After all row callbacks were called, the completion callback will be called if present. The first argument is an error object, and the second argument is the number of retrieved rows. If you specify only one function, it will be treated as row callback, if you specify two, the first (== second to last) function will be the row callback, the last function will be the completion callback.

Like with `Statement#run`, the statement will not be finalized after executing this function.

If you know that a query only returns a very limited number of rows, it might be more convenient to use `Statement#all` to retrieve all rows at once.

There is currently no way to abort execution!

## `map(sql [, callback])`

Returns results as an object instead of an array.

***

***

***

# Control Flow

https://github.com/tryghost/node-sqlite3/wiki/Control-Flow#databaseparallelizecallback

`node-sqlite3` provides two functions to help control the execution flow of statements. The default mode is to execute statements in parallel. However, the `Database#close` method will always run in exclusive mode, meaning it waits until all previous queries have completed and `node-sqlite3` will not run any other queries while a close is pending.

## Database#serialize(\[callback])

Puts the execution mode into serialized. This means that at most one statement object can execute a query at a time. Other statements wait in a queue until the previous statements are executed.

If a callback is provided, it will be called immediately. All database queries scheduled in that callback will be serialized. After the function returns, the database is set back to its original mode again. Calling `Database#serialize()` within nested functions is safe:

```js
// Queries scheduled here will run in parallel.

db.serialize(function() {
  // Queries scheduled here will be serialized.
  db.serialize(function() {
    // Queries scheduled here will still be serialized.
  });
  // Queries scheduled here will still be serialized.
});

// Queries scheduled here will run in parallel again.
```

Note that queries scheduled not *directly* in the callback function are not necessarily serialized:

```js
db.serialize(function() {
  // These two queries will run sequentially.
  db.run("CREATE TABLE foo (num)");
  db.run("INSERT INTO foo VALUES (?)", 1, function() {
    // These queries will run in parallel and the second query will probably
    // fail because the table might not exist yet.
    db.run("CREATE TABLE bar (num)");
    db.run("INSERT INTO bar VALUES (?)", 1);
  });
});
```

If you call it without a function parameter, the execution mode setting is sticky and won't change until the next call to `Database#parallelize`.

## Database#parallelize(\[callback])

Puts the execution mode into parallelized. This means that queries scheduled will be run in parallel.

If a callback is provided, it will be called immediately. All database queries scheduled in that callback will run parallelized. After the function returns, the database is set back to its original mode again. Calling `Database#parallelize()` within nested functions is safe:

```js
db.serialize(function() {
   // Queries scheduled here will be serialized.
   db.parallelize(function() {
     // Queries scheduled here will run in parallel.
   });
   // Queries scheduled here will be serialized again.
});
```

If you call it without a function parameter, the execution mode setting is sticky and won't change until the next call to `Database#serialize`.

***

***

***

# Allow parallel execution of node event loop and sqlite3 in Statement:Work\_AfterAll #1514

https://github.com/TryGhost/node-sqlite3/pull/1514

This PR allows the eager start of the next queued query execution in Statement::All - before the JS callback execution.
In some cases, it could double performance by allowing parallel execution of node event loop and sqlite3 query processing in the thread pool.

Here is a microbenchmark with 1.7 performance improvement:

$ node perf.js # before PR
elapsed 1488 ms,  1.488 ms per SELECT, event loop utilization=0.5520233139076274

$ node perf.js # after PR
elapsed  856 ms,  0.856 ms per SELECT, event loop utilization=0.9129801163162077
const sqlite3 = require('./lib/sqlite3');
const {promisify} = require('util');
const {performance} = require('perf\_hooks');

async function main() {
let db = new sqlite3.Database(':memory:');
const prepare = (sql) => new Promise((resolve, reject) => {
const stmt = db.prepare(sql, err => {
if (err===null)
resolve(stmt);
else
reject(err);
});
});

await promisify(db.run).call(db, "CREATE TABLE lorem (info TEXT)");
let insert = await prepare("INSERT INTO lorem VALUES (?)");
for (var i = 0; i < 2000; i++) {
await promisify(insert.run).call(insert, "Ipsum " + i);
}

let select = await prepare("SELECT max(id), max(info) FROM (SELECT rowid AS id, info FROM lorem) GROUP BY id%500;");
let all = promisify(select.all.bind(select));
const QUERIES = 1000;
const T0 = Date.now(), ELU0=performance.eventLoopUtilization();

await Promise.all(new Array(QUERIES).fill(0).map(() => all().then(v=>JSON.stringify(v)) ));

const T1 = Date.now(), ELU1=performance.eventLoopUtilization(ELU0);
console.log(`elapsed ${T1-T0} ms,  ${(T1-T0)/QUERIES} ms per SELECT, event loop utilization=${ELU1.utilization}`);
}

main().catch(console.error);

***

***

***

# https://github.com/TryGhost/node-sqlite3/issues/1299

I brought up some information here, #703

but wanted to make a direct issue on this topic.

real world use of this library will be in a highly asynchronous context.

However, db.serialize is a synchronous operation:
https://github.com/mapbox/node-sqlite3/blob/master/src/database.cc#L294

As soon as the callback returns, it is reset back to previous value
issue example (pretend db.run returns a promise)

db.serialize(() => {
await db.run("..."); // serialize = true, call back returned here setting back to false
await db.run("..."); // serialize = false
});
Ok, so one might think I can work around this by simply not awaiting

await db.run(`CREATE TABLE IF NOT EXISTS test (id int primary key, test text)`);
db.serialize(() => {
for (let i = 0; i < 100000; i++) {
db.run("INSERT INTO test (id, test) VALUES (?, 'x')", \[i]);
db.run("UPDATE test SET test = 'y' WHERE id = ?", \[i]);
}
const result await db.get("SELECT count(test) FROM test WHERE test = 'y'");
});
Expectation: 100k returned. We set all values to y after insert.
Got: 60-70k or random values

The reason is, each of these queries are submitted to the uv\_default\_loop():
https://github.com/mapbox/node-sqlite3/blob/master/src/statement.cc#L432
https://github.com/mapbox/node-sqlite3/blob/master/src/statement.cc#L438
https://github.com/mapbox/node-sqlite3/blob/master/src/macros.h#L128

There are multiple threads in the uv work queue. Each of your queries are running over multiple threads out of order!

What's worse, is an update needs to lock the database for the write, so that each of these threads are now also fighting over the mutex, slowing down the uv queues too!

Solution
I'm not sure how to perfectly solve this. Primary idea is to run its own single thread for writes.
maybe each query needs to be done in some kind of Promise supported callback, where it defines which thread pool to use, a single thread write, multiple thread read.

Additionally maybe best to not use the default uv work queue at all, ensuring that file locks don't block the uv queues.

I ultimately went down investigating this when I noticed my http server started timing out during heavy insert periods.

I'm not sure it's fully possible to fix this issue at application level outside of my solution supplied on that linked issue, where every write operation needs to be behind an rwlock.writeLock and every query must be awaited on to ensure only a single query at a time.

This has a huge time cost overhead though.

Thoughts?

I am talking about semver major here, redesigning this library to solve these problems.

I guess the .serialize() and .parallel() idea is the goal idea, just the implementation is wrong.

maybe remove all methods from the Database class for .run etc and only expose dbManager.writeLock/dbManager.readLock (better names) and it must be a promise

so then make it

dbManager.writeLock(async (db) => { // db variable "promoted" to new type.
//Entire writeLock holds exclusive db lock and mutex, no write contention.
// writeLock method should use rwlock to queue up writes and not
// open mutex until its turn comes.
await db.query("BEGIN");
const stmt = await db.prepare("INSERT ..."); // return WritableStatement
for (let i = 0; i < 100000; i++) {
stmt.update(\[i]); // We don't need result of this, don't wait
// for result before enqueuing next, enqueue them all so that
// the thread can work as fast as possible.
}
// Inserts guaranteed in order even without awaiting.
// Commit will not execute and return until every previous
// statement is finished. Single threaded queue.
await db.query("COMMIT");
});
where db parameter for writeLock is WritableDatabase and db.readLock is ReadableDatabase

Readable should not export any methods that can be used to mutate the DB, and error if it detects INSERT/UPDATE/DELETE/CREATE/ALTER etc.

Writable should have .update (instead of run/exec) for update operations.

Java has a good break up of the 2 operations, and suggest following its style and .query returns results, .update does updates and returns affected rows.

Then Writable has .update, Readable does not.

aikar
aikar commented on Mar 13, 2020
aikar
on Mar 13, 2020
Author
Regarding #1292. I am personally not able to take on such a large task like this, but hoping I can help in designing the solution to this critical issue for someone else to run with if they think they are up for the challenge.

Ultimately do need maintainers thoughts on if they are ok with this approach before someone should consider running with it.

aikar
aikar commented on Mar 13, 2020
aikar
on Mar 13, 2020 · edited by aikar
Author
I just noticed db.serialize() used without a callback can be used to leave it in the state.

doing that in the example code does bring it to return 100k results as expected.

So I guess there is a workaround in userland for now, and documentation can be helped here.

might also be able to make .serialize and .parallel use rwlock under the hood?

But still argue that the library can use a fundamentally better approach in the C++ land for this to ensure end users don't have to jump through hoops to send queries correctly.

While the documentation does mention it can be used without a callback, this was extremely unintuitive since all the examples show otherwise.

Additionally, this solution ONLY works when using external concurrency protection with rwlock to ensure that serialize boolean doesn't change from another operation mid process.

I would update wiki with valid workarounds for now, but its not open to public for edit.

Hi @aikar

Is it possible to implement this functionality whilst keeping the existing implementation until we are sure it can be deprecated?
If that's the case, then I'm definitely willing to give you the "go sign" on this and blindly merge the pull request if it has been reviewed & accepted by you.

Thank you for your time,
it is appreciated.

Based on my latest findings, I believe we can add NEW api for accessing the DB in a safe and performant manner, then update all documentation to encourage use of it, without breaking API.

Might also be able to silently add promise support to the .serialize and .parallelize methods so they don't flip it back until the async function returns.

these methods can then be updated to use the .readLock and .writeLock concepts too.

Doing this would then make anyone using callbacks on those methods start becoming safer, without any behavior change risk.

bonus points if in follow up work, can identify query type, and automatically switch runtime mode to serialize for all write operations if it's not already in serialize mode.

Unless someone can show me otherwise, I do not believe it's possible to perform concurrent writes, so all write operations should always be in serialize mode?

And read operations can be in parallel, but should be in serialize if within a transaction.

Also, what is the projects minimum nodejs version?

kewde
kewde commented on Apr 2, 2020
kewde
on Apr 2, 2020
Collaborator
Hi @aikar
That sounds like a great plan!
We plan to remove support for a majority of the existing node version (along with a major semver bump).

I suggest:
Node v10 will be the lowest version it should be able to work with as it still receives maintenance.
Electron v6 (which is basically Node v12 so don't worry), maintenance.

Thank you for the analysis and interest!

# Parallel queries blocks nodejs/libuv worker pool

https://github.com/TryGhost/node-sqlite3/issues/1395

alex3d
opened on Nov 10, 2020
node-sqlite3 runs queries for the distinct prepared statements in independent worker pool tasks but all sqlite3 queries to the same sqlite3 connection internally serialized on the mutex. So other libuv worker pool tasks (dns resolution, crypto, etc) could be delayed while the pool spends a large amount of time waiting on sqlite3 mutex.

Wall clock profiling flamegraph (thread pool spends ~34% of wall clock time waiting on sqlite3 mutex):
image

Probably all queries (including prepared statement queries) to the same Database should be scheduled in the single queue.

Activity
indutny-signal
indutny-signal commented on Mar 11, 2021
indutny-signal
on Mar 11, 2021
This is a valid issue. For anyone wondering this is solved by calling db.serialize() (yes, without callback) right after opening the database.

daniellockyer
daniellockyer commented on Apr 15, 2022
daniellockyer
on Apr 15, 2022
Contributor
@alex3d Looks like we should fix that 🙂 Do you have a short reproduction we can test with?

alex3d
on Jun 25, 2022
Author
You could try this for (not too) short reproduction:

const sqlite3 = require('./lib/sqlite3');
const {promisify} = require('util');
const {performance} = require('perf\_hooks');

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
const deflateTiming = \[];
let int = setInterval(async ()=>{
const T0=performance.now();
await deflate(Buffer.from("asdf"));
const T1=performance.now();
deflateTiming.push(T1-T0);
}, 10);

await Promise.all(Array.from({length: QUERIES}, (\_,i) => selectAll[i%selectAll.length]().then(v=>JSON.stringify(v)) ));

deflateTiming.sort((a, b) => a-b);
let medianTiming = deflateTiming\[(deflateTiming.length/2)|0].toFixed(3);

const T1 = Date.now(), ELU1=performance.eventLoopUtilization(ELU0);
console.log(`${QUERIES} queries complete in ${(T1-T0)} ms,  ${(T1-T0)/QUERIES} ms per SELECT, event loop utilisation=${(ELU1.utilization*100).toFixed(0)}%`+
`, median libuv thread pool queue latency = ${medianTiming} ms`);
clearInterval(int);
}

main().catch(console.error);
CONCURRENCY= 1: 2000 queries complete in 1840 ms,  0.92 ms per SELECT, event loop utilisation=84%, median libuv thread pool queue latency = 0.924 ms
CONCURRENCY= 3: 2000 queries complete in 1748 ms,  0.874 ms per SELECT, event loop utilisation=88%, median libuv thread pool queue latency = 0.975 ms

CONCURRENCY=10: 2000 queries complete in 1688 ms,  0.844 ms per SELECT, event loop utilisation=91%, median libuv thread pool queue latency = 10.995 ms
CONCURRENCY=20: 2000 queries complete in 1936 ms,  0.968 ms per SELECT, event loop utilisation=81%, median libuv thread pool queue latency = 32.638 ms
As you could see when there are more than 4 concurrent queries (default libuv thread pool size) queue latency spikes up.
It is now shown by this repro but with 2-3 concurrent queries some thread pool threads are still uselessly blocked by node-sqlite3.
