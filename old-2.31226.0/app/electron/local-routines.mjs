import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import cron from './schedule-service.cjs';

const running = run => ['starting', 'running'].includes(run.status);
const copy = value => structuredClone(value);
const text = (value, label, max) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Enter ${label} (1–${max} characters).`);
  return value.trim();
};

// Desktop routines are durable definitions, unlike the session-only CronCreate tool.
// Missed occurrences are skipped on restart. A wake from sleep dispatches at most one
// occurrence per routine; a still-running routine skips that occurrence altogether.
export function createLocalRoutines({ getState, commit, launch, dataDir, approveFolder,
  captureOptions, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer, disposed = false, started = false;
  const rows = () => Array.isArray(getState()) ? getState() : [];
  const find = id => { const task = rows().find(task => task.id === id); if (!task) throw new Error('Scheduled task not found.'); return task; };
  const write = next => { commit(next); arm(); };
  const replace = (id, update) => write(rows().map(task => task.id === id ? update(task) : task));
  const following = (task, at) => task.cron ? cron.nextFire(cron.parseCron(task.cron), at) : null;
  function arm() {
    clearTimer(timer);
    if (!started || disposed) return;
    const next = Math.min(...rows().filter(task => task.enabled && Number.isFinite(task.nextRunAt)).map(task => task.nextRunAt));
    if (!Number.isFinite(next)) return;
    timer = setTimer(() => { void tick(); }, Math.min(2 ** 31 - 1, Math.max(0, next - now())));
    timer?.unref?.();
  }
  function start() {
    if (started || disposed) return;
    started = true;
    const at = now();
    write(rows().map(task => {
      const runs = (task.runs ?? []).map(run => running(run) ? { ...run, status: 'interrupted', finishedAt: at, error: 'The app restarted before this run was confirmed complete.' } : run);
      let nextRunAt = task.enabled ? task.nextRunAt : null, enabled = task.enabled;
      if (enabled && (!Number.isFinite(nextRunAt) || nextRunAt <= at)) {
        nextRunAt = following(task, at);
        if (task.fireAt) enabled = false;
      }
      return { ...task, runs, enabled, nextRunAt };
    }));
  }
  async function tick() {
    if (disposed) return;
    const due = rows().filter(task => task.enabled && Number.isFinite(task.nextRunAt) && task.nextRunAt <= now()).map(task => task.id);
    // reserve() commits the next deadline before any asynchronous launch work.
    await Promise.allSettled(due.map(id => run(id, 'scheduled')));
    arm();
  }
  async function run(id, trigger = 'manual') {
    if (disposed) throw new Error('The scheduler is shutting down.');
    const task = find(id), at = now();
    if (trigger === 'scheduled' && (!task.enabled || task.nextRunAt > at)) return null;
    const active = task.runs?.find(running);
    if (active) {
      if (trigger === 'manual') throw new Error('This task is already running.');
      replace(id, value => ({ ...value, nextRunAt: following(value, at), enabled: value.fireAt ? false : value.enabled, skippedAt: at }));
      return null;
    }
    const record = { id: randomUUID(), status: 'starting', trigger, startedAt: at };
    const snapshot = copy(task);
    replace(id, value => ({ ...value, lastRunAt: at,
      ...(trigger === 'scheduled' ? { nextRunAt: following(value, at), enabled: value.fireAt ? false : value.enabled } : {}),
      runs: [record, ...(value.runs ?? [])].slice(0, 100) }));
    function update(patch) {
      if (!rows().some(task => task.id === id)) return;
      replace(id, task => ({ ...task, runs: task.runs.map(run => run.id === record.id && running(run) ? { ...run, ...patch } : run) }));
    }
    try {
      const assertActive = () => {
        if (disposed || !rows().find(task => task.id === id)?.runs.some(run => run.id === record.id && running(run)))
          throw new Error('Scheduled run was stopped before launch.');
      };
      const result = await launch(snapshot, {
        assertActive,
        // Register before turn/start: a quick completion may precede its RPC response.
        attach: threadId => {
          assertActive();
          record.threadId = threadId;
          update({ threadId, status: 'running' });
        },
      });
      if (result?.turnId) update({ turnId: result.turnId });
    } catch (error) {
      update({ status: 'failed', finishedAt: now(), error: error?.message || String(error) });
    }
    return copy(rows().find(task => task.id === id)?.runs.find(run => run.id === record.id) ?? record);
  }
  function observe(event) {
    if (event.kind === 'connection' && event.connected === false) {
      if (rows().some(task => task.runs?.some(running))) write(rows().map(task => ({ ...task,
        runs: task.runs.map(run => running(run) ? { ...run, status: 'interrupted', finishedAt: now(), error: 'The core disconnected before this run was confirmed complete.' } : run) })));
      return;
    }
    if (event.method !== 'turn/completed' || !event.params?.threadId) return;
    const { threadId, turn } = event.params;
    if (!rows().some(task => task.runs?.some(run => running(run) && run.threadId === threadId))) return;
    write(rows().map(task => ({ ...task, runs: task.runs.map(run => running(run) && run.threadId === threadId && (!run.turnId || run.turnId === turn?.id)
      ? { ...run, turnId: turn?.id ?? run.turnId, status: turn?.status === 'completed' ? 'completed' : turn?.status === 'interrupted' ? 'interrupted' : 'failed',
        finishedAt: now(), ...(turn?.error ? { error: turn.error.message ?? String(turn.error) } : {}) } : run) })));
  }
  async function request(p) {
    if (p.action === 'list') return copy(rows());
    if (disposed) throw new Error('The scheduler is shutting down.');
    if (p.action === 'run') return run(p.id);
    if (p.action === 'delete') { find(p.id); write(rows().filter(task => task.id !== p.id)); return { deleted: true }; }
    if (p.action === 'toggle') {
      const task = find(p.id);
      if (typeof p.enabled !== 'boolean') throw new Error('Choose whether the task is enabled.');
      if (p.enabled && task.fireAt && task.fireAt <= now()) throw new Error('Choose a future time before enabling this task.');
      replace(task.id, value => ({ ...value, enabled: p.enabled, nextRunAt: p.enabled ? (value.fireAt ?? following(value, now())) : null, updatedAt: now() }));
      return copy(find(task.id));
    }
    if (!['create', 'update'].includes(p.action)) throw new Error('Unknown scheduled task operation.');
    const previous = p.action === 'update' ? find(p.id) : null;
    if (!previous && rows().length >= 100) throw new Error('You can save up to 100 scheduled tasks.');
    const name = text(p.name, 'a task name', 200), prompt = text(p.prompt, 'instructions', 32000);
    const description = p.description === undefined ? previous?.description ?? '' : p.description;
    if (typeof description !== 'string' || description.length > 2000) throw new Error('Description must be no longer than 2000 characters.');
    const expression = typeof p.cron === 'string' ? p.cron.trim() : '';
    if (expression && !cron.parseCron(expression)) throw new Error('Enter a valid five-field cron schedule (minute, hour, day, month, weekday).');
    const fireAt = p.fireAt == null || p.fireAt === '' ? null : Number(p.fireAt);
    if (expression && fireAt !== null) throw new Error('Choose one schedule.');
    const next = expression ? cron.nextFire(cron.parseCron(expression), now()) : fireAt;
    if (expression && next === null) throw new Error('The schedule has no occurrence in the next year.');
    if (fireAt !== null && (!Number.isFinite(fireAt) || (fireAt <= now() && (fireAt !== previous?.fireAt || (p.enabled ?? previous?.enabled) !== false)))) throw new Error('Choose a future time.');
    if (p.enabled !== undefined && typeof p.enabled !== 'boolean') throw new Error('Choose whether the task is enabled.');
    const options = p.execution === undefined && previous ? previous.options : await captureOptions(p.execution, previous?.options);
    const id = previous?.id ?? randomUUID();
    let cwd = previous?.cwd;
    if (p.folder) {
      if (typeof p.folder !== 'string' || !path.isAbsolute(p.folder)) throw new Error('Choose a directory.');
      cwd = p.folder === previous?.cwd ? previous.cwd : approveFolder(p.folder);
      if (!(await fs.stat(cwd)).isDirectory()) throw new Error('Choose a directory.');
    } else if (!cwd) { cwd = path.join(dataDir, 'scheduled-tasks', id); await fs.mkdir(cwd, { recursive: true }); }
    // Re-read after I/O: a concurrent run, pause or deletion must not be overwritten.
    const current = previous ? find(id) : null;
    if (!current && rows().length >= 100) throw new Error('You can save up to 100 scheduled tasks.');
    const enabled = p.enabled ?? current?.enabled ?? true;
    const value = { ...current, id, name, prompt, description: description.trim(), cwd, cron: expression || null, fireAt, options,
      enabled, nextRunAt: enabled ? next : null, createdAt: current?.createdAt ?? now(), updatedAt: now(), runs: current?.runs ?? [] };
    write(current ? rows().map(task => task.id === id ? value : task) : [...rows(), value]);
    return copy(value);
  }
  return { start, request, observe, tick, list: () => copy(rows()), dispose() { disposed = true; clearTimer(timer); } };
}
