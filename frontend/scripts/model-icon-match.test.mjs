import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isWanModelIcon,
  matchesModelIconKeywords,
  WAN_MODEL_KEYWORDS,
} from '../src/utils/ModelIconMatch.js';

test('Wan 视频模型标识稳定命中 Wan 图标', () => {
  for (const modelId of ['wan3.0-video', 'wan3.0-video-prime']) {
    assert.equal(isWanModelIcon(modelId), true, modelId);
  }
  assert.equal(isWanModelIcon('WAN3.1-VIDEO-PRIME'), true);
});

test('非 Wan 视频模型不会误命中 Wan 图标', () => {
  for (const modelId of [
    '',
    null,
    'vega-video',
    'wan3.0-image',
    'wan-video',
    'wan3.0-video-extra',
    'wan3.0-video-prime-extra',
  ]) {
    assert.equal(isWanModelIcon(modelId), false, String(modelId));
  }
});

test('Wan 和万相展示名均命中 Wan 图标关键词', () => {
  for (const name of ['Wan3.0 Video', 'Wan 3.0 Video', '万相', '万相 3.0 Prime']) {
    assert.equal(matchesModelIconKeywords(name, WAN_MODEL_KEYWORDS), true, name);
  }
  for (const name of ['Veo 3', 'Kling 2.5', '']) {
    assert.equal(matchesModelIconKeywords(name, WAN_MODEL_KEYWORDS), false, name);
  }
});
