import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/pages/SubjectPage.jsx', import.meta.url), 'utf8');
test('同主体绑定解绑互斥，旧操作不能解锁新操作，会话切换使操作失效', () => {
  let session = 1;
  const owner = { projectId: 3, session };
  const deps = {
    voiceOwnerRef: { current: owner }, voiceOperationsRef: { current: new Map() }, projectId: 3,
    getToken: () => 'test', getAuthSessionGeneration: () => session, showBatchToast: () => {},
  };
  const body = source.match(/const beginVoiceOperation = \(subjectId\) => \{([\s\S]*?)\n  \};/)[1];
  const begin = new Function(...Object.keys(deps), `return (subjectId) => {${body}}`)(...Object.values(deps));
  const first = begin(7);
  assert.equal(begin(7), null);
  assert.ok(begin(8));
  first.finish();
  const second = begin(7);
  first.finish();
  assert.equal(begin(7), null);
  session++;
  assert.equal(second.isCurrent(), false);
  assert.equal(begin(9), null);
});
for (const mode of ['success', 'failure', 'stale', 'unknown']) {
  test(`解绑${mode}只在明确成功且归属有效时清空状态`, async () => {
    const writes = [];
    let current = true;
    let finished = false;
    const deps = {
      charVoices: { 1: 'old' }, projectId: 3,
      beginVoiceOperation: () => ({ isCurrent: () => current, finish: () => { finished = true; } }),
      apiUpdateSubject: async () => {
        assert.equal(writes.length, 0);
        if (mode === 'failure') throw Error('test');
        if (mode === 'stale') current = false;
        return mode === 'unknown' ? {} : { voice_id: null };
      },
      apiGetSubjectDetail: async () => ({}), apiGetSubjects: async () => [],
      setTimeout: fn => fn(), setCharVoices: fn => writes.push(fn({ 1: 'old' })),
      setCharVoiceNames: fn => writes.push(fn({})), setChars: fn => writes.push(fn([{ id: 1, voice_id: 'old' }])),
      showBatchToast: () => {}, console: { error() {} },
    };
    const body = source.match(/const handleRemoveSubjectVoice = async \(subject\) => \{([\s\S]*?)\n  \};/)[1];
    await new Function(...Object.keys(deps), `return async (subject) => {${body}}`)(...Object.values(deps))({ id: 1 });
    assert.equal(finished, true);
    assert.equal(writes.length, mode === 'success' ? 3 : 0);
    if (mode === 'success') assert.equal(writes[2][0].voice_id, null);
  });
}
