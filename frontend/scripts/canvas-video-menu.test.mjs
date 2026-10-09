import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import * as videoModels from '../src/components/canvas/CanvasVideoModels.js';

let server;
let CanvasMediaControls;
let VideoParamsSelector;
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  CanvasMediaControls = (await server.ssrLoadModule('/src/components/canvas/CanvasMediaControls.jsx')).default;
  VideoParamsSelector = (await server.ssrLoadModule('/src/components/creation/CreationVideoParamsSelector.jsx')).VideoParamsSelector;
});
after(async () => { await server?.close(); });

function renderCanvas(mode, duration = '8') {
  return renderToStaticMarkup(createElement(CanvasMediaControls, { nodeType: 'video', controls: {
    model: 'test-video', options: [{ value: 'test-video', label: '测试视频' }],
    refMode: mode, videoRatio: 'adaptive', videoResolution: '720P', videoDuration: duration,
    creationParams: videoModels.getCanvasVideoParams({
      supported_aspect_ratios: ['adaptive'], supported_durations: [duration],
      supported_generation_modes: [mode],
    }),
  } }));
}

test('画布参数摘要显示智能和秒单位，已有单位不重复', () => {
  assert.ok(renderCanvas('first_frame').includes('>智能</span>'));
  assert.ok(renderCanvas('first_frame').includes('>8s</span>'));
  assert.ok(renderCanvas('last_frame', '10s').includes('>10s</span>'));
  assert.doesNotMatch(renderCanvas('last_frame', '10s'), /10ss/);
});

test('Seedance 编辑菜单摘要显示智能和 -1，分辨率保持且模式显示视频编辑', () => {
  const model = 'doubao-seedance-2.0';
  const base = videoModels.getCanvasVideoParams({
    supported_aspect_ratios: ['16:9', '9:16'], supported_durations: ['5', '8'],
    supported_resolutions: ['720P', '1080P'], supported_generation_modes: ['video_ref', 'video_edit'],
  }, model);
  for (const refMode of ['video_ref', 'video_edit']) {
    const controls = videoModels.getCanvasVideoControlValues(base, model, {
      model, options: [{ value: model, label: 'Seedance' }], refMode,
      videoRatio: '9:16', videoDuration: '8', videoResolution: '1080P',
    });
    const markup = renderToStaticMarkup(createElement(CanvasMediaControls, { nodeType: 'video', controls }));
    assert.ok(markup.includes('>智能</span>'));
    assert.ok(markup.includes('>-1</span>'));
    assert.ok(markup.includes('>1080P</span>'));
    assert.ok(markup.includes('视频编辑'));
    assert.doesNotMatch(markup, /-1s/);
  }
});

test('时长展示格式化不污染数值，不给空值和特殊值添加单位', () => {
  assert.equal(typeof videoModels.formatCanvasVideoDuration, 'function');
  const format = videoModels.formatCanvasVideoDuration;
  assert.equal(format('8'), '8s');
  assert.equal(format(4), '4s');
  assert.equal(format('1.5'), '1.5s');
  assert.equal(format('8s'), '8s');
  assert.equal(format(''), '');
  assert.equal(format(undefined), '');
  assert.equal(format('智能'), '智能');
});

test('共享视频参数组件默认展示不受画布影响', () => {
  const markup = renderToStaticMarkup(createElement(VideoParamsSelector, { ratio: 'adaptive', duration: '8', resolution: '720P' }));
  assert.ok(markup.includes('>adaptive</span>'));
  assert.ok(markup.includes('>8</span>'));
});

test('首尾帧图标只弱化非参考一侧，默认透明度和尺寸符合设计', () => {
  for (const [mode, dimSide] of [['first_frame', 'right'], ['last_frame', 'left'], ['start_end', null]]) {
    const markup = renderCanvas(mode);
    const icon = markup.match(/<svg[^>]*data-canvas-video-mode=[^>]*>[\s\S]*?<\/svg>/)?.[0];
    assert.ok(icon, `${mode} 应使用画布模式图标`);
    assert.match(icon, /width="16" height="16"/);
    assert.match(icon, /opacity:0.6/);
    for (const side of ['left', 'right']) {
      const group = icon.match(new RegExp(`<g data-frame-side="${side}"[^>]*>`))?.[0];
      assert.ok(group);
      assert.ok(group.includes(side === dimSide ? '--color-white-40' : '--color-white-100'));
    }
  }
});

test('文生、图片主体、视频参考编辑均使用对应图标，不回退全能参考', () => {
  for (const mode of ['text_to_video', 'reference_images', 'reference_subjects', 'video_ref', 'video_edit']) {
    assert.ok(renderCanvas(mode).includes(`data-canvas-video-mode="${mode}"`), mode);
  }
});
