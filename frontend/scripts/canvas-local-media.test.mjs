import test from 'node:test';
import assert from 'node:assert/strict';
import { getCanvasMediaAccept, getCanvasMediaFileType, isCanvasMediaFile } from '../src/components/canvas/CanvasLocalMedia.js';

test('视频入口允许三类媒体但保留真实类型，其他入口不放宽', () => {
  for (const [name, type, expected] of [['a.png', 'image/png', 'image'], ['a.mp4', 'video/mp4', 'video'], ['a.mp3', 'audio/mpeg', 'audio']]) {
    const file = { name, type, size: 10 };
    assert.equal(getCanvasMediaFileType(file, 'video'), expected);
    assert.equal(getCanvasMediaFileType(file, 'image'), expected === 'image' ? 'image' : null);
    assert.equal(getCanvasMediaFileType(file, 'audio'), expected === 'audio' ? 'audio' : null);
  }
  assert.equal(getCanvasMediaFileType({ name: 'a.txt', type: 'text/plain', size: 10 }, 'video'), null);
  assert.match(getCanvasMediaAccept('all'), /image\/\*,video\/\*,\.mp3/);
});

test('按节点类型校验本地文件，不仅依赖文件窗口筛选', () => {
  for (const type of ['image', 'video']) {
    assert.equal(isCanvasMediaFile({ type: `${type}/example`, size: 10 }, type), true);
  }
  assert.equal(isCanvasMediaFile({ type: 'video/mp4', size: 10 }, 'image'), false);
  assert.equal(isCanvasMediaFile({ type: 'image/png', size: 0 }, 'image'), false);
  assert.equal(isCanvasMediaFile({ type: '', name: 'test.MP3', size: 10 }, 'audio'), true);
  assert.equal(isCanvasMediaFile({ type: '', name: 'test.txt', size: 10 }, 'audio'), false);
  assert.equal(isCanvasMediaFile(null, 'image'), false);
});

test('音频同时检查扩展名和 MIME，拒绝伪装成音频的 MP4', () => {
  assert.equal(getCanvasMediaAccept('audio'), '.mp3,.wav,.m4a,.aac,.ogg,.flac,.opus,.aiff');
  assert.equal(getCanvasMediaAccept('video'), 'video/*');
  for (const name of ['movie.mp4', 'movie.MP4', 'sound.txt', 'sound']) {
    assert.equal(isCanvasMediaFile({ name, type: 'audio/mp4', size: 10 }, 'audio'), false);
  }
  for (const ext of ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'opus', 'aiff']) {
    assert.equal(isCanvasMediaFile({ name: `sound.${ext}`, type: '', size: 10 }, 'audio'), true);
  }
  assert.equal(isCanvasMediaFile({ name: 'sound.m4a', type: 'audio/mp4', size: 10 }, 'audio'), true);
  assert.equal(isCanvasMediaFile({ name: 'sound.mp3', type: 'video/mp4', size: 10 }, 'audio'), false);
  assert.equal(isCanvasMediaFile({ name: 'sound.ogg', type: 'application/ogg', size: 10 }, 'audio'), true);
});
