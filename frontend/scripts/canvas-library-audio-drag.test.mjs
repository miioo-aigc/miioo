import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTestViteServer } from './lib/create-test-vite-server.mjs';

const server = await createTestViteServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
});
after(() => server.close());

const { default: CanvasLibraryGrid } = await server.ssrLoadModule('/src/components/assets/CanvasLibraryGrid.jsx');

const noop = () => {};
const props = {
  collectionId: 'collection-a',
  parentId: 'root',
  selected: new Set(),
  batch: false,
  busy: false,
  onSelect: noop,
  onOpen: noop,
  onCreate: noop,
  onRename: noop,
  onDelete: noop,
  onMove: noop,
  onDestination: noop,
  onDownload: noop,
};

test('音频卡本体与图片卡外层各自直接承接拖拽', () => {
  const markup = renderToStaticMarkup(createElement(CanvasLibraryGrid, {
    ...props,
    items: [
      {
        type: 'entry',
        id: 'audio-a',
        revision: 1,
        asset: { media_type: 'audio', url: '/audio.mp3', status: 'approved' },
      },
      {
        type: 'entry',
        id: 'image-a',
        revision: 1,
        asset: { media_type: 'image', url: '/image.png', status: 'approved' },
      },
    ],
  }));

  assert.equal((markup.match(/draggable="true"/g) || []).length, 2);
  assert.equal((markup.match(/data-canvas-audio-drag-handle="true"/g) || []).length, 1);
  assert.match(markup, /data-canvas-audio-drag-handle="true" draggable="true"/);
  assert.doesNotMatch(markup, /data-canvas-card-drag-surface/);
});
