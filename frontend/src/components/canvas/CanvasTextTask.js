/** 一个持久文本任务的串行驱动；依赖注入便于网络竞态测试。 */
import { recoverTextSubmission, validateTextResponse } from './CanvasDurableText.js';

export function createCanvasTextTask({ canvasId, nodeId, id, api, getSubmission, prepare, active, finish, report,
  isCurrent, hidden = () => document.hidden, schedule = setTimeout, unschedule = clearTimeout }) {
  let timer, work = Promise.resolve(), stopped = false, cancelling = false, failures = 0;
  const controller = new AbortController();
  const signal = controller.signal;
  const current = () => !stopped && isCurrent() && !signal.aborted;
  const get = () => api.get(canvasId, nodeId, id, signal);
  const post = (body) => api.post(canvasId, nodeId, body, signal);
  const query = async () => {
    if (!current() || cancelling) return;
    if (hidden()) { timer = schedule(tick, 2000); return; }
    try {
      let sub = getSubmission();
      if (!sub) return;
      let response = await recoverTextSubmission({ get, post, body: sub.request, preparing: sub.status === 'preparing' });
      if (!current() || cancelling) return;
      if (!response) {
        await prepare(signal);
        if (!current() || cancelling) return;
        sub = getSubmission();
        response = await recoverTextSubmission({ get, post, body: sub.request, preparing: true });
      }
      if (!current() || cancelling) return;
      validateTextResponse(response, sub, nodeId, canvasId);
      if (['queued', 'running'].includes(response.status)) await active(response);
      else { await finish(response, signal); stopped = true; return; }
      failures = 0;
    } catch (error) {
      if (!current() || cancelling) return;
      failures++;
      const definitive = Boolean(error.status && error.status < 500 || error.status === 503);
      try { await report(error, definitive, failures); } catch { /* 保留恢复身份，不产生未处理的异步拒绝。 */ }
      if (definitive) return;
    }
    if (current() && !cancelling) timer = schedule(tick, Math.min(60000, 2000 * 2 ** failures));
  };
  function tick() { work = query(); return work; }
  return {
    start: tick,
    dispose() { stopped = true; unschedule(timer); controller.abort(); },
    async cancel() {
      cancelling = true; unschedule(timer);
      try {
        const response = await api.cancel(canvasId, nodeId, id, signal);
        validateTextResponse(response, getSubmission(), nodeId, canvasId);
        if (!['cancelled', 'completed', 'failed', 'outcome_unknown'].includes(response.status)) throw new Error('取消尚未确认，请重试');
        await work;
        if (!current()) throw new Error('画布会话已结束，取消结果未同步');
        await finish(response, signal);
        stopped = true;
      } catch (error) { cancelling = false; timer = schedule(tick, 2000); throw error; }
    },
  };
}
