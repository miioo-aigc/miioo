import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cached, clearAllCache, invalidate, peekCache, subscribe } from '../src/utils/cache.js';

function storage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
globalThis.localStorage = storage();
globalThis.sessionStorage = storage();

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

for (const medium of ['memory', 'local', 'session']) {
  test(`clear isolates pending ${medium} cache and notifications`, async () => {
    clearAllCache();
    const old = deferred();
    const fresh = deferred();
    const updates = [];
    const callbacks = [];
    const unsubscribe = subscribe('session', (data) => updates.push(data));
    const options = { medium, onUpdate: (data) => callbacks.push(data) };
    const first = cached('session', () => old.promise, options);
    clearAllCache();
    const second = cached('session', () => fresh.promise, options);
    old.resolve('old');
    await first;
    assert.equal(peekCache('session', medium), undefined);
    assert.deepEqual(updates, []);
    assert.deepEqual(callbacks, []);
    const third = cached('session', () => { throw new Error('dedup lost'); }, options);
    fresh.resolve('new');
    assert.deepEqual(await Promise.all([second, third]), ['new', 'new']);
    assert.equal(peekCache('session', medium), 'new');
    assert.deepEqual(updates, ['new']);
    assert.deepEqual(callbacks, ['new']);
    unsubscribe();
  });
}

test('invalidate keeps a replacement request registered', async () => {
  clearAllCache();
  const old = deferred();
  const fresh = deferred();
  const first = cached('item', () => old.promise);
  invalidate('item');
  const second = cached('item', () => fresh.promise);
  old.resolve('old');
  await first;
  const third = cached('item', () => { throw new Error('dedup lost'); });
  fresh.resolve('new');
  assert.deepEqual(await Promise.all([second, third]), ['new', 'new']);
});

test('synchronously throwing fetcher does not poison retries', async () => {
  clearAllCache();
  await assert.rejects(cached('retry', () => { throw new Error('offline'); }), /offline/);
  assert.equal(await cached('retry', () => 'recovered'), 'recovered');
});
