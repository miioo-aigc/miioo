import assert from 'node:assert/strict';
import test from 'node:test';
import * as filenames from '../src/utils/creationFilename.js';
import { getProjectAssetDownloadFilename } from '../src/utils/projectAssetFilename.js';
import { getCreativeAssetDownloadInfo } from '../src/utils/creativeAssetDownload.js';

test('配音命名先移除情绪、停顿和语气标记，再截取正文', () => {
  assert.equal(filenames.audioFilenameFromPrompt('{happy}你好<#0.5#>(laughs)，世界！{/happy}', 'mp3'), '你好，世界！.mp3');
  assert.equal(filenames.audioFilenameFromPrompt('{sad}一二三四五六七八九十十一{/sad}', 'wav'), '一二三四五六七八九十.wav');
});

test('配音命名保留普通括号、未知标记和正常标点', () => {
  assert.equal(filenames.audioFilenameFromPrompt('你好（朋友）！', 'mp3'), '你好（朋友）！.mp3');
  assert.equal(filenames.audioFilenameFromPrompt('(aside)好', 'mp3'), '(aside)好.mp3');
  assert.equal(filenames.audioFilenameFromPrompt('{未知}你好', 'mp3'), '{未知}你好.mp3');
});

test('配音没有正文时使用中文备用名称', () => {
  for (const prompt of ['', null, undefined, '{happy}<#1#>(sighs){/happy}', ' /:*? ']) {
    assert.equal(filenames.audioFilenameFromPrompt(prompt, 'mp3'), '配音.mp3');
  }
});

test('项目音频保留项目前缀，只清理音频名称', () => {
  assert.equal(getProjectAssetDownloadFilename({ projectName: '测试项目', categoryLabel: '音频', assetName: '{sad}你好<#1#>(sighs){/sad}', extension: 'wav' }), '测试项目-音频-你好.wav');
  assert.equal(getProjectAssetDownloadFilename({ projectName: '测试项目', categoryLabel: '音频', assetName: '(laughs)' }), '测试项目-音频-配音');
});

test('非音频文件的命名规则不变', () => {
  assert.equal(filenames.filenameFromPrompt('{happy}你好', 'png'), '{happy}你好.png');
  assert.equal(getProjectAssetDownloadFilename({ projectName: '项目', categoryLabel: '角色', assetName: '(laughs)', extension: 'png' }), '项目-角色-(laughs).png');
});

test('创作资产单项与批量下载共用配音正文命名', () => {
  const asset = { type: 'audio', prompt: '{angry}你好<#1#>(coughs){/angry}', audioUrl: '/audio' };
  assert.deepEqual(getCreativeAssetDownloadInfo(asset), { url: '/audio', filename: '你好.mp3' });
  assert.deepEqual(getCreativeAssetDownloadInfo(asset, { batch: true }), { url: '/audio', filename: '你好.wav' });
});
