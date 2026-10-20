import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/pages/SubjectPage.jsx', import.meta.url), 'utf8');
test('迟到详情只恢复未编辑字段，保存队列清空后仍保护草稿', () => {
  const start = source.indexOf("      if (!editedFieldsRef.current.has('prompt') && subject.prompt");
  const end = source.indexOf('      const responseReferenceImages', start);
  assert.ok(start > 0 && end > start);
  for (const edited of [[], ['prompt'], ['genConfig'], ['prompt', 'genConfig']]) {
    const writes = {};
    const deps = {
      editedFieldsRef: { current: new Set(edited) },
      subject: { prompt: '', model: 'server' }, genCfg: { ratio: '1:1', resolution: '2K', generation_mode: 'single' },
      setPromptText: value => { writes.prompt = value; }, setSelectedModel: value => { writes.model = value; },
      setSelectedRatio: value => { writes.ratio = value; }, setSelectedResolution: value => { writes.resolution = value; },
      setGenMode: value => { writes.mode = value; },
    };
    new Function(...Object.keys(deps), source.slice(start, end))(...Object.values(deps));
    assert.equal('prompt' in writes, !edited.includes('prompt'));
    assert.equal('model' in writes, !edited.includes('genConfig'));
  }
});
for (const dirty of [true, false]) {
  test(`关闭时${dirty ? '未保存保留面板并提示' : '保存成功才关闭'}`, async () => {
    const body = source.match(/const handlePanelClose = useCallback\(async \(\) => \{([\s\S]*?)\n  \},/)[1];
    const calls = [];
    await new Function('flushDraftSave', 'draftDirtyRef', 'showToast', 'onClose', 'isSaveCurrent', `return (async () => {${body}})()`)(
      async () => calls.push('save'), { current: dirty }, () => calls.push('error'), () => calls.push('close'), () => true,
    );
    assert.deepEqual(calls, ['save', dirty ? 'error' : 'close']);
  });
}
test('详情就绪补存提前编辑内容，且编辑标记独立于待保存字段', () => {
  assert.match(source, /if \(detailLoaded && draftDirtyRef.current\) scheduleDraftSave\(\)/);
  assert.match(source, /const updateDraftField = useCallback\(\(field, value\) => \{\s*editedFieldsRef.current.add\(field\)/);
  assert.doesNotMatch(source, /editedFieldsRef.current.clear/);
});
