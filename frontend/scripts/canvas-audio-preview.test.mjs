import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('从头播放在播放和暂停状态归零并播放，阻止卡片冒泡，未就绪时不操作', () => {
  const source = readFileSync(new URL('../src/components/canvas/CanvasAudioPlayer.jsx', import.meta.url), 'utf8');
  const handler = source.slice(source.indexOf('  function restartPlayback('), source.indexOf('  return <div'));
  for (const paused of [true, false]) {
    const calls = [];
    const audio = { currentTime: 180, paused };
    const context = vm.createContext({
      audioRef: { current: audio }, url: '/long.mp3', failed: false, loading: false,
      setCurrentTime: value => calls.push(['time', value]),
      media: { pause: () => { audio.paused = true; calls.push('pause'); }, play: () => { calls.push(['play', audio.currentTime]); audio.paused = false; } },
    });
    vm.runInContext(handler, context);
    context.restartPlayback({ stopPropagation: () => calls.push('stop') });
    assert.equal(audio.currentTime, 0);
    assert.equal(audio.paused, false);
    assert.deepEqual(calls, ['stop', 'pause', ['time', 0], ['play', 0]]);
    for (const state of [{ loading: true }, { failed: true }, { url: '' }]) {
      Object.assign(context, { loading: false, failed: false, url: '/long.mp3' }, state);
      audio.currentTime = 120;
      calls.length = 0;
      context.restartPlayback({ stopPropagation: () => calls.push('stop') });
      assert.equal(audio.currentTime, 120);
      assert.deepEqual(calls, ['stop']);
    }
  }
});

test('音频台词复用创作页高级标记预览，保留字号和滚动容器', () => {
  const source = readFileSync(new URL('../src/components/canvas/CanvasAudioPlayer.jsx', import.meta.url), 'utf8');
  assert.match(source, /import CreationDubbingPromptPreview from '\.\.\/creation\/CreationDubbingPromptPreview'/);
  assert.match(source, /className="canvas-node__transcript"/);
  assert.doesNotMatch(source, /nowheel|onWheel/);
  assert.match(source, /<CreationDubbingPromptPreview\s+prompt=\{transcript\}/);
  assert.match(source, /fontSize: 'inherit', lineHeight: 'inherit'/);
});

test('音频只显示总时长模式复用同一播放器，不显示当前进度', () => {
  const source = readFileSync(new URL('../src/components/canvas/CanvasAudioPlayer.jsx', import.meta.url), 'utf8');
  assert.match(source, /function formatDuration\(seconds\)/);
  assert.match(source, /timeMode === 'duration' \? formatDuration\(duration\)/);
  assert.match(source, /timeMode = 'progress'/);
});
