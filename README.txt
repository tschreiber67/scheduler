Resource Scheduler baseline

The scheduler currently:
- Schedules jobs from a priority list onto N identical machines.
- Non-preemptive: a running job is never interrupted.
- Priority 0 (most urgent) to 4 (least urgent). Ties: earlier arrival, then input order, then lower machine index.
- Machines idle until the next job arrives when the queue is empty. No job starts before its arrival (monotonic dispatch clock).
- Output: Gantt timeline (web SVG and text), per-job wait, makespan, per-priority average wait, per-machine utilization.
- Data is synthetic and seeded (same seed = same jobs = same schedule on every OS). No network calls, no accounts, no personal data.

REQUIREMENTS
- Node.js 22 or newer. No npm dependencies, nothing to install.

RUN (Windows PowerShell or macOS terminal, from the repo root)
  npm start                                web UI at http://127.0.0.1:8103
  npm run demo                             text Gantt + metrics (24 jobs, 3 machines, seed 1)
  npm run demo -- --jobs 12 --machines 2 --seed 5
  npm run demo -- --json                   schedule as JSON

TESTS
  npm test
  Uses node:test and node:assert (built in). Expected: 54 tests, 54 pass, 0 fail, no warnings.

API -no auth, local use ok.
  GET  /                                     Gantt page
  GET  /api/jobs?n=24&seed=1                 synthetic jobs
  GET  /api/schedule?n=24&machines=3&seed=1  schedule for synthetic jobs
  POST /api/schedule                         body {"machines": 2, "jobs": [{"id":"a","duration":3,"priority":1,"arrival":0}]}
  GET  /api/health
  Limits: 500 jobs, 32 machines, 1 MB body. Bad input returns 400 {"error": ...}.

LAYOUT
  src/models.js      job and machine objects, validation, Schedule (+ metrics)
  src/heap.js        binary min-heap
  src/scheduler.js   heap-based list scheduler (event loop over machine free times)
  src/data.js        seeded synthetic workload (mulberry32 PRNG)
  src/gantt.js       text Gantt renderer
  src/api.js         request handlers and node:http server factory
  src/server.js      npm start entry
  src/cli.js         npm run demo entry
  public/index.html  web Gantt (SVG drawn in the browser from /api/schedule)
  tests/             node:test suite (*.test.js)

LIMITATIONS (current)
- Machines are identical; every job can run on any machine.
- No deadlines, no resource constraints (memory, licenses, shared tools), no fairness or starvation control: low-priority jobs can wait indefinitely while urgent work keeps arriving.
- No preemption, no failure handling, no persistence.
- Integer time units only.
- The web page is read-only: it shows seeded jobs, it does not edit them.