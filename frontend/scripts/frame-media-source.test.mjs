import test from 'node:test';
import assert from 'node:assert/strict';
import { BlobSource, UrlSource } from 'mediabunny';
import { createFrameMediaSource } from '../src/components/video-edit/FrameMediaSource.js';

test('支持分段读取时保留网络源，并取消探测响应', async () => {
  let cancelled = false;
  const source = await createFrameMediaSource('https://example.com/video.mp4', () => {}, async (url, options) => {
    assert.equal(options.headers.Range, 'bytes=0-0');
    return new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status: 206 });
  });
  assert.ok(source instanceof UrlSource);
  assert.ok(cancelled);
});

test('完整响应超过原32兆缓存仍保留全部内容并支持回读', async () => {
  const bytes = new Uint8Array(33 * 1024 * 1024);
  bytes[0] = 17;
  bytes[bytes.length - 1] = 29;
  let requests = 0;
  const source = await createFrameMediaSource('https://example.com/video.mp4', () => {}, async () => {
    requests++;
    return new Response(bytes);
  });
  assert.ok(source instanceof BlobSource);
  assert.equal(source._blob.size, bytes.length);
  assert.equal(new Uint8Array(await source._blob.slice(-1).arrayBuffer())[0], 29);
  assert.equal(new Uint8Array(await source._blob.slice(0, 1).arrayBuffer())[0], 17);
  assert.equal(requests, 1);
});

test('拒绝错误状态、网页响应、空文件和声明超限文件', async () => {
  for (const [response, message] of [
    [new Response('', { status: 403 }), /403/],
    [new Response('<html>', { headers: { 'Content-Type': 'text/html' } }), /网页/],
    [new Response(''), /为空/],
    [new Response('x', { headers: { 'Content-Length': String(129 * 1024 * 1024) } }), /超过128/],
  ]) {
    await assert.rejects(createFrameMediaSource('https://example.com/video.mp4', () => {}, async () => response), message);
  }
});

test('没有长度头时按实际接收量限制大小并取消下载', async () => {
  let cancelled = false;
  const chunk = new Uint8Array(1024 * 1024);
  const response = new Response(new ReadableStream({
    pull(controller) { controller.enqueue(chunk); },
    cancel() { cancelled = true; },
  }));
  await assert.rejects(createFrameMediaSource('https://example.com/video.mp4', () => {}, async () => response), /超过128/);
  assert.ok(cancelled);
});
