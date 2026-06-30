/**
 * 浏览器本地缓存层 —— SWR（Stale-While-Revalidate）策略
 *
 * 设计目标：刷新/切换时先用缓存秒开，后台静默校验，数据变了再更新 UI。
 *
 * 三种持久化介质：
 *   - 'memory'  仅当前会话内存（最快，刷新即丢）
 *   - 'local'   localStorage（跨刷新，~5MB，注意只存 URL 不存二进制）
 *   - 'session' sessionStorage（关 tab 即清）
 *
 * 用法：
 *   import { cached, invalidate } from '../utils/cache';
 *   const data = await cached('models:image', () => apiListModels({ category: 'image' }), {
 *     medium: 'local', ttl: 24 * 60 * 60 * 1000,
 *   });
 */

const NS = 'miioo_cache:';

// 会话级内存缓存
const memStore = new Map();

// 进行中的请求去重：同一 key 并发只发一次网络请求
const inflight = new Map();

// 订阅者（用于 SWR 后台刷新后通知 UI 更新）
const subscribers = new Map(); // key -> Set<fn>

function now() {
  return Date.now();
}

function readRaw(medium, key) {
  if (medium === 'memory') {
    return memStore.get(key) ?? null;
  }
  try {
    const store = medium === 'session' ? sessionStorage : localStorage;
    const str = store.getItem(NS + key);
    if (str) return JSON.parse(str);
  } catch { /* 忽略存储访问异常 */ }
  // 降级 fallback：localStorage 写满时数据存在 memStore，读取时也要检查
  return memStore.get(key) ?? null;
}

function writeRaw(medium, key, entry) {
  if (medium === 'memory') {
    memStore.set(key, entry);
    return;
  }
  try {
    const store = medium === 'session' ? sessionStorage : localStorage;
    store.setItem(NS + key, JSON.stringify(entry));
  } catch (err) {
    // localStorage 写满（QuotaExceeded）→ 降级到内存，不阻塞业务
    console.warn('[cache] 持久化失败，降级内存:', key, err?.name);
    memStore.set(key, entry);
  }
}

function removeRaw(medium, key) {
  if (medium === 'memory') {
    memStore.delete(key);
    return;
  }
  try {
    const store = medium === 'session' ? sessionStorage : localStorage;
    store.removeItem(NS + key);
  } catch { /* 忽略存储访问异常 */ }
}

function notify(key, data) {
  const subs = subscribers.get(key);
  if (subs) subs.forEach((fn) => { try { fn(data); } catch { /* 订阅回调异常不影响其他订阅者 */ } });
}

/**
 * 订阅某个 key 的后台更新。返回取消订阅函数。
 */
export function subscribe(key, fn) {
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key).add(fn);
  return () => {
    subscribers.get(key)?.delete(fn);
  };
}

/**
 * 核心：带 SWR 的缓存读取。
 *
 * @param {string} key 缓存键
 * @param {() => Promise<any>} fetcher 真正发请求的函数
 * @param {object} opts
 *   - medium: 'memory' | 'local' | 'session'（默认 'memory'）
 *   - ttl: 毫秒。超过 ttl 视为过期需重新校验。0 = 每次都校验（默认 0）
 *   - swr: 是否启用后台静默刷新（默认 true）
 *   - equals: (a, b) => boolean 自定义数据比较，默认 JSON 字符串比较
 *   - onUpdate: 后台刷新拿到新数据时的回调（也可用 subscribe）
 */
export async function cached(key, fetcher, opts = {}) {
  const {
    medium = 'memory',
    ttl = 0,
    swr = true,
    equals,
    onUpdate,
  } = opts;

  const entry = readRaw(medium, key);
  const isFresh = entry && ttl > 0 && (now() - entry.t < ttl);

  // 1. 命中且新鲜 → 直接返回，不发请求
  if (entry && isFresh) {
    return entry.d;
  }

  // 2. 命中但过期（或 ttl=0）→ SWR：先返回旧值，后台校验
  if (entry && swr) {
    revalidate(key, fetcher, medium, entry, equals, onUpdate);
    return entry.d;
  }

  // 3. 无缓存 → 必须等请求（带并发去重）
  return fetchAndStore(key, fetcher, medium, entry, equals, onUpdate);
}

function fetchAndStore(key, fetcher, medium, prevEntry, equals, onUpdate) {
  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    try {
      const data = await fetcher();
      const changed = !prevEntry || !isEqual(prevEntry.d, data, equals);
      writeRaw(medium, key, { t: now(), d: data });
      if (changed) {
        notify(key, data);
        onUpdate?.(data);
      }
      return data;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

// 后台静默校验：失败不抛错（保留旧缓存）
function revalidate(key, fetcher, medium, prevEntry, equals, onUpdate) {
  if (inflight.has(key)) return;
  fetchAndStore(key, fetcher, medium, prevEntry, equals, onUpdate).catch((err) => {
    console.warn('[cache] 后台校验失败，保留旧缓存:', key, err?.message);
  });
}

function isEqual(a, b, equals) {
  if (equals) return equals(a, b);
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * 让缓存失效。支持精确 key 或前缀通配（key 以 ':' 结尾视为前缀匹配）。
 * 写操作（增删改）后调用，保证后续读取拿到最新数据。
 *
 * 例：
 *   invalidate('storyboards:p1:ep1')     // 精确
 *   invalidate('storyboards:p1:')        // 前缀：清掉该项目所有分镜
 *   invalidate('subjects:p1:', 'local')  // 指定介质
 */
export function invalidate(keyOrPrefix, medium) {
  const isPrefix = keyOrPrefix.endsWith(':');
  const media = medium ? [medium] : ['memory', 'local', 'session'];

  for (const m of media) {
    if (!isPrefix) {
      removeRaw(m, keyOrPrefix);
      continue;
    }
    // 前缀匹配：遍历该介质所有键，删除命中前缀的
    if (m === 'memory') {
      for (const k of memStore.keys()) {
        if (k.startsWith(keyOrPrefix)) memStore.delete(k);
      }
    } else {
      try {
        const store = m === 'session' ? sessionStorage : localStorage;
        const toRemove = [];
        for (let i = 0; i < store.length; i++) {
          const fullKey = store.key(i);
          if (fullKey?.startsWith(NS + keyOrPrefix)) toRemove.push(fullKey);
        }
        toRemove.forEach((k) => store.removeItem(k));
      } catch { /* 忽略存储访问异常 */ }
    }
  }
}

/**
 * 直接写入缓存（用于写操作后把新数据回填，避免下次读还要等请求）。
 */
export function setCache(key, data, opts = {}) {
  const { medium = 'memory' } = opts;
  writeRaw(medium, key, { t: now(), d: data });
  notify(key, data);
}

/**
 * 同步读取缓存（不发请求）。命中返回数据，未命中返回 undefined。
 * 适合「先渲染缓存再异步校验」的场景。
 */
export function peekCache(key, medium = 'memory') {
  const entry = readRaw(medium, key);
  return entry ? entry.d : undefined;
}

/**
 * 清空本应用所有缓存（登出时调用）。
 */
export function clearAllCache() {
  memStore.clear();
  for (const store of [localStorage, sessionStorage]) {
    try {
      const toRemove = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k?.startsWith(NS)) toRemove.push(k);
      }
      toRemove.forEach((k) => store.removeItem(k));
    } catch { /* 忽略存储访问异常 */ }
  }
}
