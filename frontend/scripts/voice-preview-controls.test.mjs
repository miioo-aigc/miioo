import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { transformWithOxc } from 'vite';
const source = (await readFile(new URL('../src/components/creation/DubbingVoiceCard.jsx', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '').replace('export default function', 'function');
const { code } = await transformWithOxc(source, 'Card.jsx', { jsx: { runtime: 'classic', pragma: 'element' } });
const element = (type, props, ...children) => ({ type, props, children });
function setup(status) {
  const playback = { key: 'v:/v.mp3', status };
  let toggles = 0, retries = 0, selections = 0;
  const env = { element, useState: value => [typeof value === 'function' ? value() : value, () => {}], useEffect: () => {}, getVoicePreviewState: () => playback, stopVoicePreview: () => {}, subscribeVoicePreviewState: () => {}, toggleVoicePreview: () => { toggles++; }, retryVoicePreview: () => { retries++; }, FavoriteIcon: 'favorite', LoaderCircle: 'loader', RefreshCw: 'refresh' };
  const Card = new Function(...Object.keys(env), code + '\nreturn DubbingVoiceCard;')(...Object.values(env));
  const tree = Card({ voice: { id: 'v', audioUrl: '/v.mp3', tags: [] }, onSelect: () => { selections++; } });
  return { tree, playback, counts: () => ({ toggles, retries, selections }) };
}
test('加载中展示旋转指示，重复点击不会暂停等待', async () => {
  const h = setup('loading'), button = h.tree.children[0];
  assert.equal(button.children[0].type, 'loader');
  assert.equal(button.props['aria-busy'], true);
  await button.props.onClick({ stopPropagation() {} });
  assert.equal(h.counts().toggles, 0);
});
test('失败点击仅刷新，恢复就绪后主动点击才播放', async () => {
  const h = setup('error'), button = h.tree.children[0];
  assert.equal(button.children[0].type, 'refresh');
  await button.props.onClick({ stopPropagation() {} });
  assert.deepEqual(h.counts(), { retries: 1, toggles: 0, selections: 0 });
  const ready = setup('ready');
  await ready.tree.children[0].props.onClick({ stopPropagation() {} });
  assert.equal(ready.counts().toggles, 1);
});
test('键盘事件来自子按钮时不选择，卡片自身可用回车选择', () => {
  const h = setup('idle'); const parent = {}, child = {};
  for (const key of ['Enter', ' ']) h.tree.props.onKeyDown({ key, target: child, currentTarget: parent, preventDefault() { assert.fail('不得阻断子按钮'); } });
  assert.equal(h.counts().selections, 0);
  h.tree.props.onKeyDown({ key: 'Enter', target: parent, currentTarget: parent, preventDefault() {} });
  assert.equal(h.counts().selections, 1);
});
test('渲染后已开始加载的快速重复点击也不调用暂停', async () => {
  const h = setup('idle'); h.playback.status = 'loading';
  await h.tree.children[0].props.onClick({ stopPropagation() {} });
  assert.equal(h.counts().toggles, 0);
});
