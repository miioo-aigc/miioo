import test from 'node:test';
import assert from 'node:assert/strict';
import { getCanvasPortClassName } from '../src/components/canvas/CanvasNodePortState.js';

test('端口默认隐藏且不进入放大或激活态', () => {
  assert.equal(getCanvasPortClassName({}), 'canvas-node__port');
});

test('卡片悬停时端口显示但保持普通尺寸', () => {
  assert.equal(getCanvasPortClassName({ cardHovered: true }), 'canvas-node__port canvas-node__port--visible');
});

test('端口悬停时显示并放大', () => {
  assert.equal(getCanvasPortClassName({ cardHovered: true, portHovered: true }), 'canvas-node__port canvas-node__port--visible canvas-node__port--enlarged');
});

test('拖拽连线期间端口持续显示并保持激活态', () => {
  assert.equal(getCanvasPortClassName({ connecting: true }), 'canvas-node__port canvas-node__port--visible canvas-node__port--enlarged canvas-node__port--active');
});

test('选中、编辑或生成只显示普通端口，不进入大号激活态', () => {
  assert.equal(getCanvasPortClassName({ nodeActive: true }), 'canvas-node__port canvas-node__port--visible');
});

test('目标节点不会因为正在被连接而进入激活态', () => {
  assert.equal(getCanvasPortClassName({ connectionTarget: true }), 'canvas-node__port');
});
