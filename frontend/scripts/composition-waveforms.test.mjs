import test from 'node:test';
import assert from 'node:assert/strict';
import { createWaveformSession } from '../src/components/compositionEditor/CompositionWaveforms.js';
import { waveformPoints } from '../src/utils/CompositionWaveform.js';
const wait = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

test('增益、静音及同一峰值的蓝黄红高度分层', () => {
  const waveform = { status: 'ready', duration: 1, peaks: [0.25] };
  const flat = '0,100 0,100 100,100 100,100 100,100';
  assert.ok(waveformPoints({ duration: 1, volume: 2 }, waveform).includes('0,50'));
  assert.equal(waveform.peaks[0], 0.25);
  assert.equal(waveformPoints({ duration: 1, volume: 0 }, waveform), flat);
  assert.equal(waveformPoints({ duration: 1 }, waveform, { volume: 0 }), flat);
  assert.equal(waveformPoints({ duration: 1 }, waveform, { hidden: true }), flat);
  const threshold = 10 ** (-6 / 20);
  const height = (peak, level, volume = 1) => {
    const points = waveformPoints({ duration: 1, volume }, { ...waveform, peaks: [peak] }, {}, level);
    return 100 - Number(points.split(' ')[1].split(',')[1]);
  };
  for (const peak of [0, threshold - 0.000001, threshold, 0.999, 1]) {
    if (peak <= threshold) assert.equal(height(peak, 'normal'), height(peak, 'warning'));
    else assert.equal(height(peak, 'normal'), height(threshold, 'normal'));
    assert.equal(height(peak, 'danger'), height(peak, 'warning'));
  }
  // 超过0分贝时仅顶部露红，黄色止于满刻度，蓝色主体仍保留。
  assert.ok(height(0.75, 'danger', 2) > height(0.75, 'warning', 2));
  assert.equal(height(0.75, 'warning', 2), height(1, 'warning'));
  assert.equal(height(0.75, 'normal', 2), height(threshold, 'normal'));
  assert.equal(height(1, 'danger', 2), 100);
  for (const level of ['normal', 'warning', 'danger']) assert.equal(height(1, level, 0), 0);
  // 常见中低峰值获得足够高度，同时保留底噪、轻声、强声之间的差异。
  assert.ok(height(0.1, 'normal') > 55 && height(0.1, 'normal') < 65);
  assert.ok(height(0.001, 'normal') < 10);
  const peaks = [0, 0.001, 0.01, 0.05, 0.1, 0.25, 0.5];
  for (let i = 1; i < peaks.length; i++) assert.ok(height(peaks[i], 'normal') > height(peaks[i - 1], 'normal'));
  assert.ok(height(0.1, 'normal', 2) > height(0.1, 'normal'));
  assert.ok(height(0.1, 'normal', 0.5) < height(0.1, 'normal'));
});

test('裁剪与倍速映射源区间，静音为零，高低精度均可绘制', () => {
  const waveform = { status: 'ready', duration: 4, peaks: [0, 0.25, 0.5, 1] };
  assert.equal(waveformPoints({ offset: 1, duration: 1, speed: 2 }, waveform), '0,100 0,75 50,75 50,50 100,50 100,100 100,100');
  assert.equal(waveformPoints({ duration: 1 }, waveform), '0,100 0,100 100,100 100,100 100,100');
  assert.equal(waveformPoints({ offset: 5, duration: 1 }, waveform), '');
  assert.equal(waveformPoints({ duration: 1 }, { status: 'pending' }), '');
  for (const count of [96, 2048]) assert.ok(waveformPoints({ duration: 4 }, { ...waveform, peaks: Array(count).fill(0.5) }).includes('100,50'));
});

test('同素材请求去重，pending轮询到ready后停止', async () => {
  let reads = 0; const values = [];
  const session = createWaveformSession({ interval: 1, read: async () => ({ status: ++reads === 1 ? 'pending' : 'ready' }), publish: (id, v) => values.push(v.status) });
  try {
    session.sync(['a', 'a']); session.sync(['a']);
    await wait(25);
    assert.equal(reads, 2); assert.deepEqual(values, ['pending', 'pending', 'ready']);
    session.sync(['a']); await wait(); assert.equal(reads, 2);
  } finally { session.stop(); }
});

test('失败重试先ensure，连续重试只发送一次', async () => {
  const calls = []; let ready = false;
  const session = createWaveformSession({ read: async () => { calls.push('read'); return { status: ready ? 'ready' : 'failed' }; },
    ensure: async () => { calls.push('ensure'); ready = true; }, publish() {} });
  try {
    session.sync(['a']); await wait(); session.retry('a'); session.retry('a'); await wait();
    assert.deepEqual(calls, ['read', 'ensure', 'read']);
  } finally { session.stop(); }
});

test('离开取消进行中请求，迟到响应不得回写', async () => {
  let finish; let signal; const values = [];
  const session = createWaveformSession({ read: (id, s) => { signal = s; return new Promise((r) => { finish = r; }); }, publish: (id,v) => values.push(v.status) });
  session.sync(['a']); session.stop(); assert.equal(signal.aborted, true);
  finish({ status: 'ready' }); await wait(); assert.deepEqual(values, ['pending']);
});

test('并发上限及删除素材取消请求', async () => {
  const signals = [];
  const session = createWaveformSession({ concurrency: 2, read: (id, signal) => new Promise((resolve) => {
    signals.push(signal); signal.addEventListener('abort', () => resolve({ status: 'failed' }), { once:true });
  }), publish() {} });
  try {
    session.sync(['a','b','c']); assert.equal(signals.length,2);
    session.sync(['c']); await wait(); assert.equal(signals.length,3); assert.ok(signals[0].aborted);
  } finally { session.stop(); }
});

test('超时后停止轮询，可手动重试；会话变化丢弃响应', async () => {
  const values=[]; let current=true;
  const session=createWaveformSession({ interval:2, deadline:5, isCurrent:()=>current, read:async()=>({status:'pending'}), ensure:async()=>{}, publish:(id,v)=>values.push(v.status) });
  try {
    session.sync(['a']); await wait(30); assert.equal(values.at(-1),'timeout');
    const count=values.length; await wait(); assert.equal(values.length,count);
    current=false; session.retry('a'); assert.equal(values.length,count);
  } finally { session.stop(); }
});
