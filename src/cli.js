import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { generateJobs, makeMachines } from './data.js';
import { renderAscii } from './gantt.js';
import { schedule } from './scheduler.js';

/** Returns {code, out, err}. Pure so tests can call it. */
export function main(argv) {
  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        seed: { type: 'string', default: '1' },
        jobs: { type: 'string', default: '24' },
        machines: { type: 'string', default: '3' },
        json: { type: 'boolean', default: false },
      },
    }));
  } catch (e) {
    return { code: 2, out: '', err: `error: ${e.message}\n` };
  }
  if (positionals[0] !== 'demo') {
    return { code: 2, out: '', err: 'usage: node src/cli.js demo [--jobs N] [--machines N] [--seed N] [--json]\n' };
  }
  try {
    const sched = schedule(
      generateJobs(Number(values.jobs), Number(values.seed)),
      makeMachines(Number(values.machines)),
    );
    if (values.json) return { code: 0, out: JSON.stringify(sched.toJSON(), null, 2) + '\n', err: '' };
    const m = sched.metrics();
    const out =
      renderAscii(sched) +
      `\n\nmakespan=${m.makespan} avg_wait=${m.avg_wait} max_wait=${m.max_wait}\n` +
      `avg wait by priority: ${JSON.stringify(m.avg_wait_by_priority)}\n` +
      `utilization: ${JSON.stringify(m.utilization)}\n`;
    return { code: 0, out, err: '' };
  } catch (e) {
    return { code: 2, out: '', err: `error: ${e.message}\n` };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = main(process.argv.slice(2));
  process.stdout.write(r.out);
  process.stderr.write(r.err);
  process.exitCode = r.code;
}
