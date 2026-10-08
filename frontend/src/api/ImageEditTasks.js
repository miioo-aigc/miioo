import { authFetch, authFetchStream } from './request';

const BASE = import.meta.env.VITE_API_BASE_URL;

// 事件只负责唤醒查询，结果始终以任务详情为准；断流时保留低频查询。
export async function waitForImageEditTask(taskId, { signal, timeout = 1800000, mediaLabel = '图片' } = {}) {
  const controller = new AbortController();
  let wake;
  let timer;
  let reader;
  const abort = () => { controller.abort(); wake?.(); };
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const stream = (async () => {
    try {
      const response = await authFetchStream(`${BASE}/api/tasks/events`, {
        signal: controller.signal, headers: { Accept: 'text/event-stream' },
      });
      if (!response.ok || !response.body) return;
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!controller.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const event = JSON.parse(line.slice(5));
            if ([event.task_id, event.taskId, event.id].includes(taskId)) wake?.();
          } catch { /* 忽略心跳和无法解析的事件，定时查询仍有效。 */ }
        }
      }
    } catch { /* 事件流不可用时退回低频查询。 */ }
  })();
  const started = Date.now();
  let failures = 0;
  try {
    while (Date.now() - started < timeout) {
      if (controller.signal.aborted) throw new DOMException('已停止等待任务', 'AbortError');
      let task;
      try {
        const response = await authFetch(`${BASE}/api/tasks/${encodeURIComponent(taskId)}`, { signal: controller.signal });
        if (!response.ok) throw Object.assign(new Error(`读取编辑任务失败（${response.status}）`), { status: response.status });
        task = await response.json();
        failures = 0;
      } catch (error) {
        if (error.name === 'AbortError' || [401, 403, 404].includes(error.status) || ++failures >= 5) throw error;
      }
      if (['failed', 'cancelled', 'canceled'].includes(task?.status)) {
        throw Object.assign(new Error(task.error_message || task.params?.error_message || `${mediaLabel}编辑任务失败或已取消`), { terminal: true });
      }
      if (['completed', 'done', 'success', 'partial'].includes(task?.status)) return task;
      await new Promise((resolve) => {
        wake = () => { clearTimeout(timer); resolve(); };
        timer = setTimeout(wake, 10000);
        if (controller.signal.aborted) wake();
      });
      wake = undefined;
    }
    throw new Error(`等待${mediaLabel}超时，请继续读取原任务，不要重复提交`);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    controller.abort();
    await reader?.cancel().catch(() => {});
    await stream;
  }
}
