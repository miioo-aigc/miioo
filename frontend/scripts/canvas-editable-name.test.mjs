import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/canvas/CanvasEditableName.jsx', import.meta.url), 'utf8');
const readComponent = (name) => readFileSync(new URL(`../src/components/canvas/${name}`, import.meta.url), 'utf8');

test('名称保存只提交一次，空白、未改名和取消不写入', () => {
  const body = source.match(/const finish = \(save\) => \{([\s\S]*?)\n  \};/)[1];
  for (const [value, save, expected] of [[' 新名称 ', true, ['新名称']], ['', true, []], ['   ', true, []], ['原名', true, []], ['新名称', false, []]]) {
    const changes = [];
    const finished = { current: false };
    const finish = new Function('save', 'finishedRef', 'inputRef', 'name', 'onRename', 'setEditing', body);
    for (let i = 0; i < 2; i++) finish(save, finished, { current: { value } }, '原名', (name) => changes.push(name), () => {});
    assert.deepEqual(changes, expected);
  }
});

test('输入法选字保护、事件隔离和聚焦全选保留', () => {
  assert.match(source, /composingRef.current \|\| event.nativeEvent.isComposing \|\| event.keyCode === 229/);
  assert.match(source, /inputRef.current\?\.select\(\)/);
  assert.match(source, /onBlur=\{\(\) => finish\(true\)\}/);
  assert.match(source, /finish\(event.key === 'Enter'\)/);
  assert.match(source, /nodrag nopan nowheel/);
  assert.match(source, /onDoubleClick=\{\(event\) => \{\s*event.stopPropagation\(\)/);
});

test('默认拦截单击，selectOnClick 仅在非编辑态放行冒泡', () => {
  assert.match(source, /selectOnClick = false/);
  const body = source.match(/onClick=\{\(event\) => \{([^}]*)\}\}/)[1];
  const handleClick = new Function('editing', 'selectOnClick', 'event', body);
  const clicks = [];
  const event = { stopPropagation: () => clicks.push('stop') };
  for (const [editing, selectOnClick, expected] of [
    [false, false, ['stop']],
    [true, false, ['stop']],
    [true, true, ['stop']],
    [false, true, []],
  ]) {
    clicks.length = 0;
    handleClick(editing, selectOnClick, event);
    assert.deepEqual(clicks, expected);
  }
});

test('可编辑画布的卡片标题与组标题一致放行单击，分享页只读标题保持隔离', () => {
  const header = readComponent('CanvasNodeHeader.jsx');
  assert.match(header, /selectOnClick = false/);
  assert.match(header, /<CanvasEditableName name=\{title\} onRename=\{onRename\} onStart=\{onStart\} selectOnClick=\{selectOnClick\} \/>/);
  assert.match(readComponent('CanvasNodeShell.jsx'), /<CanvasNodeHeader[^>]*selectOnClick[^>]*upstreamUpdated=\{Boolean\(data\?\.upstreamUpdated\)\} \/>/);
  assert.doesNotMatch(readComponent('SharedCanvasNode.jsx'), /selectOnClick/);
});
