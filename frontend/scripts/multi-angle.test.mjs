import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ANGLE_PRESETS, normalizeAngles, buildMultiAnglePrompt } from '../src/utils/MultiAngle.js';

test('水平环绕，垂直截断，拒绝非数字', () => {
  assert.deepEqual(normalizeAngles(-5, 65), { horizontal: 355, vertical: 60 });
  assert.deepEqual(normalizeAngles(365, -35), { horizontal: 5, vertical: -30 });
  assert.deepEqual(normalizeAngles(360, 0), { horizontal: 0, vertical: 0 });
  assert.throws(() => normalizeAngles(NaN, 0));
});
test('九宫格参数与模板一致', () => {
  assert.equal(ANGLE_PRESETS.length, 9);
  for (const [, h, v] of ANGLE_PRESETS) {
    const prompt = buildMultiAnglePrompt(h, v);
    assert.ok(prompt.includes(`水平${h}度，垂直${v}度`));
    assert.ok(prompt.includes('主要主体'));
    assert.ok(!prompt.includes('不得追随移动后的相机'));
    if (v < 0) { assert.ok(prompt.includes('从下方仰视')); assert.ok(!prompt.includes('更多上表面')); }
    if (v > 0) assert.ok(prompt.includes('从上方俯视'));
  }
});
test('保持场景关系并移除投影位置放宽描述', () => {
  for (const [, h, v] of ANGLE_PRESETS) {
    const prompt = buildMultiAnglePrompt(h, v);
    assert.ok(prompt.includes('保持场景中各元素的空间位置关系'));
    assert.ok(!prompt.includes('允许各元素在画面中的投影位置发生变化'));
  }
});
test('左右、背面、零角度与小数的明确解释', () => {
  assert.ok(buildMultiAnglePrompt(315, 45).includes('向左水平绕拍45度'));
  assert.ok(buildMultiAnglePrompt(45, -30).includes('向右水平绕拍45度'));
  assert.ok(buildMultiAnglePrompt(180, 0).includes('背面'));
  assert.ok(buildMultiAnglePrompt(0, 0).includes('保持原始机位'));
  assert.ok(buildMultiAnglePrompt(15.25, 3.14).includes('水平15.3度，垂直3.1度'));
});
