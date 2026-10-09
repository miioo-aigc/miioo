import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/canvas/CanvasEditableName.jsx', import.meta.url), 'utf8');

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
