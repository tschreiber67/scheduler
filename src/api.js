// Request handling: pure functions plus an http.Server factory. No outbound network calls.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateJobs, makeMachines } from './data.js';
import { makeJob } from './models.js';
import { schedule } from './scheduler.js';

export const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
export const MAX_JOBS = 500;
export const MAX_MACHINES = 32;
export const MAX_BODY = 1_000_000;

export class BadRequest extends Error {}

function intParam(params, key, def, lo, hi) {
  const raw = params.get(key);
  if (raw === null) return def;
  if (!/^-?\d+$/.test(raw)) throw new BadRequest(`${key} must be an integer`);
  const v = Number(raw);
  if (v < lo || v > hi) throw new BadRequest(`${key} must be ${lo}..${hi}`);
  return v;
}

export function jobsToDicts(jobs) {
  return jobs.map((j) => ({ id: j.id, name: j.name, duration: j.duration, priority: j.priority, arrival: j.arrival }));
}

export function runFromPayload(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload) || !Array.isArray(payload.jobs)) {
    throw new BadRequest("body must be an object with a 'jobs' list");
  }
  if (payload.jobs.length > MAX_JOBS) throw new BadRequest(`at most ${MAX_JOBS} jobs`);
  const jobs = payload.jobs.map((raw) => {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequest('each job must be an object');
    for (const f of ['id', 'duration']) {
      if (!(f in raw)) throw new BadRequest(`job missing field '${f}'`);
    }
    return makeJob({
      id: String(raw.id),
      duration: raw.duration,
      priority: raw.priority ?? 2,
      arrival: raw.arrival ?? 0,
      name: String(raw.name ?? ''),
    });
  });
  const n = payload.machines ?? 3;
  if (!Number.isInteger(n) || n < 1 || n > MAX_MACHINES) {
    throw new BadRequest(`machines must be an integer 1..${MAX_MACHINES}`);
  }
  return { jobs: jobsToDicts(jobs), ...schedule(jobs, makeMachines(n)).toJSON() };
}

const json = (status, obj) => ({ status, type: 'application/json', body: Buffer.from(JSON.stringify(obj)) });

/** Returns {status, type, body}. */
export async function handleGet(url) {
  const u = new URL(url, 'http://localhost');
  const q = u.searchParams;
  try {
    if (u.pathname === '/' || u.pathname === '/index.html') {
      const body = await readFile(path.join(PUBLIC_DIR, 'index.html'));
      return { status: 200, type: 'text/html; charset=utf-8', body };
    }
    if (u.pathname === '/api/jobs') {
      const jobs = generateJobs(intParam(q, 'n', 24, 0, MAX_JOBS), intParam(q, 'seed', 1, 0, 1e9));
      return json(200, { jobs: jobsToDicts(jobs) });
    }
    if (u.pathname === '/api/schedule') {
      const jobs = generateJobs(intParam(q, 'n', 24, 0, MAX_JOBS), intParam(q, 'seed', 1, 0, 1e9));
      const m = intParam(q, 'machines', 3, 1, MAX_MACHINES);
      return json(200, { jobs: jobsToDicts(jobs), ...schedule(jobs, makeMachines(m)).toJSON() });
    }
    if (u.pathname === '/api/health') return json(200, { ok: true });
  } catch (e) {
    return json(400, { error: e.message });
  }
  return json(404, { error: 'not found' });
}

export function handlePost(url, text) {
  const u = new URL(url, 'http://localhost');
  if (u.pathname !== '/api/schedule') return json(404, { error: 'not found' });
  try {
    if (Buffer.byteLength(text) > MAX_BODY) throw new BadRequest('body too large');
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new BadRequest('body is not valid JSON');
    }
    return json(200, runFromPayload(payload));
  } catch (e) {
    return json(400, { error: e.message });
  }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const send = ({ status, type, body }) => {
      res.writeHead(status, { 'Content-Type': type, 'Content-Length': body.length });
      res.end(body);
    };
    try {
      if (req.method === 'GET') return send(await handleGet(req.url));
      if (req.method === 'POST') {
        const chunks = [];
        let size = 0;
        for await (const c of req) {
          size += c.length;
          if (size > MAX_BODY) return send(json(400, { error: 'body too large' }));
          chunks.push(c);
        }
        return send(handlePost(req.url, Buffer.concat(chunks).toString('utf8')));
      }
      return send(json(405, { error: 'method not allowed' }));
    } catch {
      return send(json(500, { error: 'internal error' }));
    }
  });
}
