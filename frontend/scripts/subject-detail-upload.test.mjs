import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/subject/SubjectImageMappers.js', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('export function mergeSubjectDetailUploads')).replace('export ', '');
const merge = new Function('normalizeImageUrl', 'filterSubjectImagesByReferences', `${body}; return mergeSubjectDetailUploads;`)(
  url => url, (images, refs) => images.filter(image => !refs.includes(image.id)),
);
const old = { id: 'old', rawUrl: '/old' };
const history = { id: 'history', rawUrl: '/history' };
const upload = { id: 'upload-1', uploading: true, panelUpload: true };
const saved = { id: 'saved', rawUrl: '/saved', panelUpload: true };

test('迟到详情保留上传占位、补齐历史，不保留无关旧图', () => {
  assert.deepEqual(merge([old, upload], [history], [], new Set()), [upload, history]);
});
test('上传先成功，迟到详情仍保留结果', () => {
  assert.deepEqual(merge([saved], [history], [], new Set()), [saved, history]);
});
test('详情先返回，上传回调仍能按占位编号替换', () => {
  const images = merge([upload], [history], [], new Set());
  assert.deepEqual(images.map(image => image.id === upload.id ? saved : image), [saved, history]);
});
test('相同编号或地址的详情结果不重复', () => {
  assert.deepEqual(merge([saved], [{ ...saved, panelUpload: false }, { id: 'alias', rawUrl: '/saved' }, history], [], new Set()), [saved, history]);
});
test('删除标记和参考图过滤优先，不能恢复已删除上传', () => {
  assert.deepEqual(merge([saved], [history], ['history'], new Set(['saved'])), []);
});
test('空详情只保留本次上传，失败已移除的占位不复活', () => {
  assert.deepEqual(merge([old, upload], [], [], new Set()), [upload]);
  assert.deepEqual(merge([old], [], [], new Set()), []);
});
test('页面在状态更新执行时再次校验会话和定稿版本', () => {
  const page = readFileSync(new URL('../src/pages/SubjectPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /setGeneratedImages\(prev => \{\s*if \(cancelled \|\| !isSaveCurrent\(\)[\s\S]*?primaryVersion !== primaryOperationRef.current.version[\s\S]*?return mergeSubjectDetailUploads/);
});
