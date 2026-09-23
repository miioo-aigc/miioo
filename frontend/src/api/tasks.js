import { authFetch, authFetchStream, getToken } from './request.js';
import { createDisplayError, getDisplayErrorMessage, throwResponseError } from './error.js';

const TASK_STORAGE_PREFIX = 'miioo_asset_task_registry:v1:';
const TASK_EVENT_CURSOR_PREFIX = 'miioo_asset_task_event_cursor:v1:';
const TERMINAL_TASK_STATUSES = new Set(['completed', 'partial', 'failed', 'cancelled', 'expired', 'done', 'success', 'error']);
const FAILURE_TASK_STATUSES = new Set(['failed', 'cancelled', 'expired', 'error']);
const taskEventListeners = new Map();
// 一个 task/source 只保留一个实际 SSE + 低频读取循环；每个调用方仍有自己
// 的“停止查看”边界。不能把第一个页面的 AbortSignal 绑定到共享循环，否则
// 一个弹窗关闭会错误地中断同标签页其他恢复视图。
const taskWaiters = new Map();

// 2026-08-29 约束 #15 第 3.4 条：读任务连续失败达到上限时，允许 UI 层注册
// 全局回调弹 toast（默认不弹，保持 API 层与 UI 解耦）。
let readErrorThresholdCallback = null;
export function setTaskReadErrorThresholdCallback(callback) {
  readErrorThresholdCallback = typeof callback === 'function' ? callback : null;
}

let eventStreamPromise = null;
let eventStreamAbortController = null;

function getTaskId(value) {
  const taskId = String(value || '').trim();
  if (!taskId) throw createDisplayError('任务 ID 无效，无法恢复任务状态');
  return taskId;
}

function decodeTokenPayload(token) {
  const encoded = String(token || '').split('.')[1];
  if (!encoded) return null;
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function getTaskOwnerId() {
  const payload = decodeTokenPayload(getToken());
  const userId = payload?.sub || payload?.user_id || payload?.userId || payload?.id;
  return typeof userId === 'string' && userId.trim() ? userId.trim() : null;
}

// 页面级恢复提示如确有本地上下文需求，必须复用同一个用户命名空间，不能
// 用无前缀的 taskId / projectId 跨账号共享浏览器存储。
export function getAssetTaskOwnerId() {
  return getTaskOwnerId();
}

function getStorageKey(prefix) {
  const ownerId = getTaskOwnerId();
  return ownerId ? `${prefix}${encodeURIComponent(ownerId)}` : null;
}

function readStorageJson(key, fallback) {
  if (!key || typeof localStorage === 'undefined') return fallback;
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorageJson(key, value) {
  if (!key || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 任务恢复只是浏览器提示，存储不可用不能影响服务端任务事实源。
  }
}

function normalizeStatus(task) {
  return String(task?.status || '').trim().toLowerCase();
}

function sanitizeTrackingMetadata(value, depth = 0) {
  if (depth > 3 || value === null || value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeTrackingMetadata(item, depth + 1))
      .filter((item) => item !== undefined)
      .slice(0, 32);
  }
  if (typeof value !== 'object') return undefined;

  const sanitized = {};
  Object.entries(value).forEach(([key, item]) => {
    // 任务中心只保存恢复所需的显示上下文，绝不保存 URL、签名令牌、密钥或上游数据。
    if (/(url|token|secret|password|api[_-]?key|provider)/i.test(key)) return;
    const normalized = sanitizeTrackingMetadata(item, depth + 1);
    if (normalized !== undefined) sanitized[key] = normalized;
  });
  return sanitized;
}

export function isTerminalAssetTask(task) {
  return TERMINAL_TASK_STATUSES.has(normalizeStatus(task));
}

export function isFailedAssetTask(task) {
  return FAILURE_TASK_STATUSES.has(normalizeStatus(task));
}

export function listTrackedAssetTasks() {
  const key = getStorageKey(TASK_STORAGE_PREFIX);
  const records = readStorageJson(key, []);
  if (!Array.isArray(records)) return [];
  return records
    .filter((record) => record && typeof record === 'object' && String(record.taskId || '').trim())
    .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));
}

export function trackAssetTask({ taskId, taskType, source, metadata } = {}) {
  const normalizedTaskId = getTaskId(taskId);
  const key = getStorageKey(TASK_STORAGE_PREFIX);
  if (!key) return null;

  const now = Date.now();
  const records = listTrackedAssetTasks();
  const existing = records.find((record) => record.taskId === normalizedTaskId);
  const nextRecord = {
    taskId: normalizedTaskId,
    taskType: String(taskType || existing?.taskType || '').trim() || undefined,
    source: String(source || existing?.source || '').trim() || undefined,
    metadata: {
      ...(existing?.metadata || {}),
      ...(sanitizeTrackingMetadata(metadata) || {}),
    },
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  const nextRecords = [nextRecord, ...records.filter((record) => record.taskId !== normalizedTaskId)].slice(0, 100);
  writeStorageJson(key, nextRecords);
  return nextRecord;
}

export function untrackAssetTask(taskId) {
  const normalizedTaskId = getTaskId(taskId);
  const key = getStorageKey(TASK_STORAGE_PREFIX);
  if (!key) return;
  writeStorageJson(key, listTrackedAssetTasks().filter((record) => record.taskId !== normalizedTaskId));
}

function getEventCursor() {
  const key = getStorageKey(TASK_EVENT_CURSOR_PREFIX);
  const value = Number(readStorageJson(key, 0));
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function setEventCursor(value) {
  const cursor = Number(value);
  if (!Number.isSafeInteger(cursor) || cursor < 0) return;
  writeStorageJson(getStorageKey(TASK_EVENT_CURSOR_PREFIX), cursor);
}

async function getTaskApiUrl(path = '') {
  const base = import.meta.env.VITE_API_BASE_URL || ''; 
  return `${base}/api/tasks${path}`;
}

async function readJsonResponse(res, fallback) {
  if (!res.ok) {
    await throwResponseError(res, fallback || `任务请求失败（${res.status}）`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function apiGetAssetTask(taskId) {
  const normalizedTaskId = getTaskId(taskId);
  const res = await authFetch(await getTaskApiUrl(`/${encodeURIComponent(normalizedTaskId)}`), {
    headers: { 'Content-Type': 'application/json' },
  });
  return readJsonResponse(res, `读取任务失败（${res.status}）`);
}

export async function apiCancelAssetTask(taskId) {
  const normalizedTaskId = getTaskId(taskId);
  const res = await authFetch(await getTaskApiUrl(`/${encodeURIComponent(normalizedTaskId)}/cancel`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return readJsonResponse(res, `取消任务失败（${res.status}）`);
}

function parseSseFrame(rawFrame) {
  const frame = String(rawFrame || '').replace(/\r/g, '');
  const event = { id: null, type: 'message', data: '' };
  const dataLines = [];
  frame.split('\n').forEach((line) => {
    if (!line || line.startsWith(':')) return;
    const separator = line.indexOf(':');
    const field = separator >= 0 ? line.slice(0, separator) : line;
    const value = separator >= 0 ? line.slice(separator + 1).replace(/^\s/, '') : '';
    if (field === 'id') event.id = value;
    if (field === 'event') event.type = value || 'message';
    if (field === 'data') dataLines.push(value);
  });
  if (dataLines.length === 0) return null;
  event.data = dataLines.join('\n');
  try {
    event.payload = JSON.parse(event.data);
  } catch {
    event.payload = null;
  }
  return event;
}

function dispatchTaskEvent(event) {
  const payload = event?.payload;
  const taskId = String(payload?.taskId || payload?.task_id || '').trim();
  const eventId = Number(payload?.eventId || event?.id);
  if (Number.isSafeInteger(eventId) && eventId >= 0) setEventCursor(eventId);
  if (!taskId) return;
  const listeners = taskEventListeners.get(taskId);
  if (!listeners) return;
  listeners.forEach((listener) => {
    try {
      listener(payload, event);
    } catch {
      // 单个页面订阅失败不应中断其他任务的事件恢复。
    }
  });
}

async function consumeTaskEventStream(signal) {
  const cursor = getEventCursor();
  const params = new URLSearchParams();
  if (cursor > 0) params.set('lastEventId', String(cursor));
  const query = params.toString();
  const res = await authFetchStream(
    `${await getTaskApiUrl('/events')}${query ? `?${query}` : ''}`,
    {
      signal,
      headers: { Accept: 'text/event-stream' },
    },
  );
  if (!res.ok) {
    await throwResponseError(res, `任务事件订阅失败（${res.status}）`);
  }
  if (!res.body) throw createDisplayError('任务事件流不可用，已切换为低频状态读取');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() || '';
      frames.forEach((frame) => {
        const event = parseSseFrame(frame);
        if (event) dispatchTaskEvent(event);
      });
    }
  } finally {
    reader.releaseLock();
  }
}

function abortableDelay(delayMs, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const error = new DOMException('任务观察已停止', 'AbortError');
      reject(error);
      return;
    }
    const timer = setTimeout(resolve, delayMs);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('任务观察已停止', 'AbortError'));
    }, { once: true });
  });
}

async function runTaskEventStream() {
  const controller = eventStreamAbortController;
  let retryDelayMs = 3000;
  try {
    while (!controller?.signal.aborted && taskEventListeners.size > 0) {
      try {
        await consumeTaskEventStream(controller.signal);
        retryDelayMs = 3000;
      } catch {
        if (controller.signal.aborted) return;
        // feature flag 未开启、网络中断和代理切断都会走到这里；任务 watcher 会
        // 同时保持低频读取，因此 SSE 不可用不影响任务最终可恢复性。
        await abortableDelay(retryDelayMs, controller.signal);
        retryDelayMs = Math.min(retryDelayMs * 2, 30000);
      }
    }
  } finally {
    if (eventStreamAbortController === controller) eventStreamAbortController = null;
    eventStreamPromise = null;
  }
}

function ensureTaskEventStream() {
  if (eventStreamPromise || taskEventListeners.size === 0) return;
  eventStreamAbortController = new AbortController();
  eventStreamPromise = runTaskEventStream();
}

export function subscribeAssetTaskEvents(taskId, listener) {
  const normalizedTaskId = getTaskId(taskId);
  if (typeof listener !== 'function') return () => {};
  const listeners = taskEventListeners.get(normalizedTaskId) || new Set();
  listeners.add(listener);
  taskEventListeners.set(normalizedTaskId, listeners);
  ensureTaskEventStream();

  return () => {
    const current = taskEventListeners.get(normalizedTaskId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) taskEventListeners.delete(normalizedTaskId);
    if (taskEventListeners.size === 0) eventStreamAbortController?.abort();
  };
}

function getTaskFailureMessage(task) {
  const results = Array.isArray(task?.results) ? task.results : [];
  const resultError = results.find((result) => result && result.success === false)?.error;
  return String(
    task?.error_msg
      || task?.errorMsg
      || task?.error
      || task?.params?.error_message
      || resultError
      || '任务未能完成',
  ).trim() || '任务未能完成';
}

function createTaskFailureError(task) {
  const error = createDisplayError(getTaskFailureMessage(task), {
    status: task?.status,
    detail: getDisplayErrorMessage(task?.error || ''),
  });
  error.task = task;
  return error;
}

/**
 * 以“事件优先、低频读取兜底”的方式等待一个用户自己的任务。
 *
 * `readTask` 可传入类型专用兼容接口；无论页面订阅何时停止，服务端任务都不会
 * 被取消。调用方若显式 Abort，只停止本地观察，并保留 taskId 供下次恢复。
 */
function notifyTaskWaiterObservers(waiter, callbackName, ...args) {
  waiter.observers.forEach((observer) => {
    try {
      observer[callbackName]?.(...args);
    } catch {
      // 单个页面的回调异常不应影响其他正在观察同一服务端任务的页面。
    }
  });
}

function observeTaskWaiter(waiter, watchKey, observer, signal) {
  waiter.observers.add(observer);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    waiter.observers.delete(observer);
    if (!waiter.settled && waiter.observers.size === 0) {
      // 当前标签已无人查看时才停止本地网络观察；服务端任务和浏览器恢复索引
      // 保持不变，之后重新进入页面会建立新的观察器。
      if (taskWaiters.get(watchKey) === waiter) taskWaiters.delete(watchKey);
      waiter.controller.abort();
    }
  };

  if (!signal) {
    return waiter.promise.then(
      (task) => {
        release();
        return task;
      },
      (error) => {
        release();
        throw error;
      },
    );
  }

  return new Promise((resolve, reject) => {
    const abort = () => {
      release();
      reject(new DOMException('任务观察已停止', 'AbortError'));
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    waiter.promise.then(
      (task) => {
        signal.removeEventListener('abort', abort);
        release();
        resolve(task);
      },
      (error) => {
        signal.removeEventListener('abort', abort);
        release();
        reject(error);
      },
    );
  });
}

export function waitForAssetTask(taskId, options = {}) {
  const normalizedTaskId = getTaskId(taskId);
  const watchKey = `${normalizedTaskId}:${String(options.watchKey || options.source || 'default')}`;
  let waiter = taskWaiters.get(watchKey);

  if (!waiter || waiter.controller.signal.aborted) {
    const controller = new AbortController();
    waiter = {
      controller,
      observers: new Set(),
      settled: false,
      promise: null,
    };

    const promise = (async () => {
      const readTask = options.readTask || (() => apiGetAssetTask(normalizedTaskId));
      // 2026-08-25: Seedance 2.5 支持 30s 长视频，任务耗时变长，默认等待上限 30min → 60min（与 nginx proxy_read_timeout 3600s 对齐）
      const timeoutMs = Math.max(Number(options.timeoutMs) || 3600000, 1000);
      const initialIntervalMs = Math.max(Number(options.initialIntervalMs) || 8000, 1000);
      const maxIntervalMs = Math.max(Number(options.maxIntervalMs) || 60000, initialIntervalMs);
      const signal = controller.signal;
      const throwOnFailure = options.throwOnFailure !== false;
      const isTerminal = options.isTerminal || isTerminalAssetTask;
      const isFailed = options.isFailed || isFailedAssetTask;
      const maxReadErrors = Math.max(Number(options.maxReadErrors) || 5, 1);
      const startedAt = Date.now();
      let nextIntervalMs = initialIntervalMs;
      let consecutiveReadErrors = 0;
      let shouldReadImmediately = false;
      let wake = null;

      trackAssetTask({
        taskId: normalizedTaskId,
        taskType: options.taskType,
        source: options.source,
        metadata: options.metadata,
      });
      const unsubscribe = subscribeAssetTaskEvents(normalizedTaskId, () => {
        shouldReadImmediately = true;
        wake?.();
        wake = null;
      });

      try {
        while (Date.now() - startedAt < timeoutMs) {
          if (signal.aborted) throw new DOMException('任务观察已停止', 'AbortError');
          let task;
          try {
            task = await readTask(normalizedTaskId);
            consecutiveReadErrors = 0;
          } catch (error) {
            if (signal.aborted) throw new DOMException('任务观察已停止', 'AbortError');
            // 任务不存在（历史遗留脏 taskId / 服务端已清理）：终止观察并移除注册，
            // 避免对不存在的任务无限退避重试（读错误 404 不是瞬时故障）。
            if (error?.status === 404) {
              untrackAssetTask(normalizedTaskId);
              throw error;
            }
            consecutiveReadErrors += 1;
            notifyTaskWaiterObservers(waiter, 'onReadError', error, consecutiveReadErrors);
            if (consecutiveReadErrors >= maxReadErrors) {
              // 约束 #15 第 3.4 条：连续读错误达到上限时通知 UI，避免静默重试
              // 造成"循环报错/转圈"假象。
              readErrorThresholdCallback?.({
                taskId: normalizedTaskId,
                consecutiveReadErrors,
                error,
              });
              throw error;
            }
            await abortableDelay(nextIntervalMs, signal);
            nextIntervalMs = Math.min(Math.round(nextIntervalMs * 1.6), maxIntervalMs);
            continue;
          }
          notifyTaskWaiterObservers(waiter, 'onUpdate', task);
          if (isTerminal(task)) {
            untrackAssetTask(normalizedTaskId);
            if (throwOnFailure && isFailed(task)) throw createTaskFailureError(task);
            return task;
          }

          if (!shouldReadImmediately) {
            await Promise.race([
              abortableDelay(nextIntervalMs, signal),
              new Promise((resolve) => {
                wake = resolve;
              }),
            ]);
          }
          wake = null;
          shouldReadImmediately = false;
          nextIntervalMs = Math.min(Math.round(nextIntervalMs * 1.6), maxIntervalMs);
        }
        throw createDisplayError('任务等待超时；任务仍在服务端运行，可稍后返回继续查看');
      } finally {
        unsubscribe();
      }
    })();

    waiter.promise = promise;
    taskWaiters.set(watchKey, waiter);
    promise.finally(() => {
      waiter.settled = true;
      if (taskWaiters.get(watchKey) === waiter) taskWaiters.delete(watchKey);
    }).catch(() => {});
  }

  return observeTaskWaiter(
    waiter,
    watchKey,
    { onUpdate: options.onUpdate, onReadError: options.onReadError },
    options.signal,
  );
}
