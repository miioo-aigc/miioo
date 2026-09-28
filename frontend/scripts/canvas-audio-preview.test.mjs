import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('音频台词复用创作页高级标记预览，保留字号和滚动容器', () => {
  const source = readFileSync(new URL('../src/components/canvas/CanvasAudioPlayer.jsx', import.meta.url), 'utf8');
  assert.match(source, /import CreationDubbingPromptPreview from '\.\.\/creation\/CreationDubbingPromptPreview'/);
  assert.match(source, /canvas-node__transcript nodrag nopan nowheel/);
  assert.match(source, /<CreationDubbingPromptPreview\s+prompt=\{transcript\}/);
  assert.match(source, /fontSize: 'inherit', lineHeight: 'inherit'/);
});
