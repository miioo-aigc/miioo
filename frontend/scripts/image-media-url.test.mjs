import test from 'node:test';
import assert from 'node:assert/strict';
import { toImageMediaUrl } from '../src/utils/ImageMediaUrl.js';

test('图片编辑在所有环境使用同源代理，保留编码路径和查询参数', () => {
  assert.equal(toImageMediaUrl('https://www.chengxvblog.top/media/origin/raw/a%20b.png?signature=a%2Bb#image'),
    '/__image-media/media/origin/raw/a%20b.png?signature=a%2Bb#image');
});

test('本地、第三方、非白名单路径和异常地址保持不变', () => {
  for (const url of [
    undefined, null, '', 'invalid-url', 'blob:http://localhost:5173/test',
    'data:image/png;base64,AAAA', '/uploads/a.png', '/media/origin/a.png',
    '/__image-media/media/origin/a.png',
    'https://example.com/media/origin/a.png',
    'https://www.chengxvblog.top.evil.test/media/origin/a.png',
    'http://www.chengxvblog.top/media/origin/a.png',
    'https://www.chengxvblog.top:8443/media/origin/a.png',
    'https://user:pass@www.chengxvblog.top/media/origin/a.png',
    'https://www.chengxvblog.top/uploads/a.png',
    'https://www.chengxvblog.top/media/origin/../../private/a.png',
  ]) assert.equal(toImageMediaUrl(url), url);
});
