import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAudioLevels, getAudioBars } from '../src/components/canvas/CanvasAudioWaveform.js';

function buffer(channels, sampleRate = 1000) {
  return { sampleRate, length: channels[0].length, numberOfChannels: channels.length, getChannelData: (index) => channels[index] };
}

test('静音保持基线，真实声音越强柱条越高，不混合抵消左右声道', () => {
  const quiet = buildAudioLevels(buffer([new Float32Array(1000)]));
  const low = buildAudioLevels(buffer([new Float32Array(1000).fill(0.05)]));
  const loud = buildAudioLevels(buffer([new Float32Array(1000).fill(0.5), new Float32Array(1000).fill(-0.5)]));
  assert.ok(getAudioBars(quiet, 0.5).every((height) => height === 3));
  assert.ok(getAudioBars(loud, 0.5)[0] > getAudioBars(low, 0.5)[0]);
  assert.ok(getAudioBars(loud, 0.5).every((height) => height <= 20));
});

test('柱条读取当前播放片段，不是固定图案；跳转后同步，结束恢复基线', () => {
  const samples = new Float32Array(2000);
  samples.fill(0.5, 1000);
  const levels = buildAudioLevels(buffer([samples]));
  assert.equal(getAudioBars(levels, 0.2).length, 51);
  assert.ok(getAudioBars(levels, 0.2).every((height) => height === 3));
  assert.ok(getAudioBars(levels, 1.5).some((height) => height > 3));
  assert.ok(getAudioBars(levels, 2).every((height) => height === 3));
});
