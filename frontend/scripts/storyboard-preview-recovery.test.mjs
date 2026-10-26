import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { transformWithOxc } from 'vite';

// 执行真实组件的渲染函数，检查换源身份与媒体路由；不代替浏览器网络验证。
const source = (await readFile(new URL('../src/components/storyboard/StoryboardMediaPreview.jsx', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '').replace('export default function', 'function');
const { code } = await transformWithOxc(source, 'Preview.jsx', { jsx: { runtime: 'classic', pragma: 'element' } });
const element = (type, props, ...children) => ({ type, props, children });
const preview = new Function('element', 'AsyncImagePreview', 'RecoverableVideoPreview', 'normalizeImageUrl', code + '\nreturn StoryboardMediaPreview;')(element, 'image', 'video', value => value);
const child = media => preview({ media }).children[0];

test('同一业务编号换视频源，首帧会话按源重新挂载', () => {
  const a = child({ id: 'same', media_type: 'video', url: 'a.mp4' });
  const b = child({ id: 'same', media_type: 'video', url: 'b.mp4' });
  assert.equal(a.type, 'video');
  assert.equal(b.props.src, 'b.mp4');
  assert.notEqual(a.props.key, b.props.key);
});
test('图片缩略图可回退原图，视频封面不把视频文件当作图片', () => {
  const image = child({ url: 'original.jpg', thumbnail_url: 'thumb.jpg' });
  assert.equal(image.props.src, 'thumb.jpg');
  assert.equal(image.props.fallbackSrc, 'original.jpg');
  const video = child({ media_type: 'video', url: 'movie.mp4', poster_url: 'poster.jpg' });
  assert.equal(video.props.src, 'poster.jpg');
  assert.equal(video.props.fallbackSrc, undefined);
});
test('切换为无封面视频不沿用先前封面；只有轻量视频也可预览', () => {
  child({ media_type: 'video', url: 'a.mp4', poster_url: 'a.jpg' });
  const next = child({ media_type: 'video', preview_video_url: 'b.mp4' });
  assert.equal(next.type, 'video');
  assert.equal(next.props.src, 'b.mp4');
  assert.equal(next.props.hovered, false);
});
