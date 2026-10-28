/** 页面会话内的波形调度：不写工程Store，不影响保存与撤销。 */
export function createWaveformSession({ read, ensure, publish, isCurrent = () => true, interval = 2000, deadline = 300000, concurrency = 4 }) {
  const jobs = new Map();
  let stopped = false;
  let running = 0;
  const alive = (job) => !stopped && isCurrent() && jobs.get(job.id) === job && !job.controller.signal.aborted;
  const emit = (job, value) => { if (alive(job)) publish(job.id, value); };
  function pump() {
    if (stopped || !isCurrent()) return;
    for (const job of jobs.values()) {
      if (running >= concurrency) break;
      if (job.state !== 'queued') continue;
      job.state = 'running';
      running++;
      void run(job).finally(() => { running--; pump(); });
    }
  }
  async function run(job) {
    const timeout = setTimeout(() => {
      emit(job, { status: 'timeout' });
      job.state = 'done';
      job.controller.abort();
    }, Math.max(1, job.expires - Date.now()));
    try {
      if (job.retry) { await ensure(job.id, job.controller.signal); job.retry = false; }
      if (!alive(job)) return;
      const result = await read(job.id, job.controller.signal);
      if (!alive(job)) return;
      emit(job, result);
      if (result.status !== 'pending') { job.state = 'done'; return; }
      job.state = 'waiting';
      job.timer = setTimeout(() => {
        if (!alive(job)) return;
        if (Date.now() >= job.expires) { emit(job, { status: 'timeout' }); job.state = 'done'; return; }
        job.state = 'queued'; pump();
      }, interval);
    } catch {
      if (alive(job)) emit(job, { status: 'failed' });
      job.state = 'done';
    } finally { clearTimeout(timeout); }
  }
  function add(id, retry = false) {
    if (stopped || !isCurrent()) return;
    const previous = jobs.get(id);
    if (previous && (!retry || ['queued', 'running', 'waiting'].includes(previous.state))) return;
    const job = { id, retry, controller: new AbortController(), state: 'queued', expires: Date.now() + deadline };
    jobs.set(id, job);
    emit(job, { status: 'pending' });
    pump();
  }
  return {
    sync(ids) {
      const wanted = new Set(ids);
      for (const [id, job] of jobs) if (!wanted.has(id)) {
        clearTimeout(job.timer); job.controller.abort(); jobs.delete(id);
      }
      for (const id of wanted) add(id);
    },
    retry: (id) => add(id, true),
    stop() {
      stopped = true;
      for (const job of jobs.values()) { clearTimeout(job.timer); job.controller.abort(); }
      jobs.clear();
    },
  };
}
