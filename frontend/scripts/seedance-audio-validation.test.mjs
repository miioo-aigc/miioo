import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SEEDANCE_AUDIO_MESSAGES,
  validateSeedance20AudioReferences,
} from '../src/utils/SeedanceAudioValidation.js';
import { resolveVideoGenerationMode } from '../src/utils/videoModelCapabilities.js';

const SEEDANCE_20 = { modelId: 'doubao-seedance-2.0' };
const SEEDANCE_25 = { modelId: 'doubao-seedance-2.5' };
const audio = (overrides = {}) => ({ name: 'voice.mp3', size: 1024, duration: 5, ...overrides });

test('MP3、WAV 均通过格式校验', async () => {
  const mp3 = await validateSeedance20AudioReferences([audio({ name: 'a.mp3' })], SEEDANCE_20);
  const wav = await validateSeedance20AudioReferences([audio({ name: 'a.wav', type: 'audio/x-wav' })], SEEDANCE_20);
  assert.equal(mp3.ok, true);
  assert.equal(wav.ok, true);
});

test('AAC、MP4 等格式被拒绝', async () => {
  for (const name of ['a.aac', 'a.mp4', 'a.m4a']) {
    const result = await validateSeedance20AudioReferences([audio({ name })], SEEDANCE_20);
    assert.equal(result.ok, false, `${name} 应被拒绝`);
    assert.equal(result.message, SEEDANCE_AUDIO_MESSAGES.format);
  }
});

test('单段时长边界 2 秒、15 秒通过，越界被拒绝', async () => {
  assert.equal((await validateSeedance20AudioReferences([audio({ duration: 2 })], SEEDANCE_20)).ok, true);
  assert.equal((await validateSeedance20AudioReferences([audio({ duration: 15 })], SEEDANCE_20)).ok, true);
  assert.equal((await validateSeedance20AudioReferences([audio({ duration: 1.9 })], SEEDANCE_20)).message, SEEDANCE_AUDIO_MESSAGES.duration);
  assert.equal((await validateSeedance20AudioReferences([audio({ duration: 15.1 })], SEEDANCE_20)).message, SEEDANCE_AUDIO_MESSAGES.duration);
});

test('最多 3 段，第 4 段被拒绝', async () => {
  const three = await validateSeedance20AudioReferences(
    [audio({ duration: 5 }), audio({ duration: 5 }), audio({ duration: 5 })], SEEDANCE_20,
  );
  assert.equal(three.ok, true);
  const four = await validateSeedance20AudioReferences(
    [audio({ duration: 3 }), audio({ duration: 3 }), audio({ duration: 3 }), audio({ duration: 3 })], SEEDANCE_20,
  );
  assert.equal(four.message, SEEDANCE_AUDIO_MESSAGES.maxSegments);
});

test('多段合计不超过 15 秒，超出被拒绝', async () => {
  const ok = await validateSeedance20AudioReferences([audio({ duration: 7 }), audio({ duration: 8 })], SEEDANCE_20);
  assert.equal(ok.ok, true);
  assert.equal(ok.totalSeconds, 15);
  const over = await validateSeedance20AudioReferences([audio({ duration: 8 }), audio({ duration: 8 })], SEEDANCE_20);
  assert.equal(over.message, SEEDANCE_AUDIO_MESSAGES.totalDuration);
});

test('单个文件 15MB 边界通过，超出被拒绝', async () => {
  const MB = 1024 * 1024;
  assert.equal((await validateSeedance20AudioReferences([audio({ size: 15 * MB })], SEEDANCE_20)).ok, true);
  assert.equal(
    (await validateSeedance20AudioReferences([audio({ size: 15 * MB + 1 })], SEEDANCE_20)).message,
    SEEDANCE_AUDIO_MESSAGES.fileSize,
  );
});

test('缺少时长元数据的远程素材不误拦截，仅记录未校验数量', async () => {
  const result = await validateSeedance20AudioReferences(
    [{ name: 'remote.mp3', url: '/uploads/remote.mp3' }], SEEDANCE_20,
  );
  assert.equal(result.ok, true);
  assert.equal(result.unverified, 1);
});

test('duration_ms 元数据按毫秒换算校验时长', async () => {
  const tooShort = await validateSeedance20AudioReferences([{ name: 'a.mp3', duration_ms: 1500 }], SEEDANCE_20);
  assert.equal(tooShort.message, SEEDANCE_AUDIO_MESSAGES.duration);
  const ok = await validateSeedance20AudioReferences([{ name: 'a.mp3', duration_ms: 5000 }], SEEDANCE_20);
  assert.equal(ok.ok, true);
});

test('seedance 2.5 不做音频时长限制', async () => {
  const result = await validateSeedance20AudioReferences(
    [audio({ duration: 60 }), audio({ duration: 60 }), audio({ duration: 60 }), audio({ duration: 60 })],
    SEEDANCE_25,
  );
  assert.equal(result.ok, true);
});

test('seedance 2.0 音频不能作为唯一参考素材', () => {
  const result = resolveVideoGenerationMode({
    modelId: 'doubao-seedance-2-0-fast',
    capabilities: { supported_generation_modes: ['full'] },
    referenceMode: 'all',
    imageCount: 0,
    videoCount: 0,
    audioCount: 1,
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /不能单独使用音频/);
});
