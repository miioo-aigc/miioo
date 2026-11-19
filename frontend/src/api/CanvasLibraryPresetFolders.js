const CANVAS_LIBRARY_PRESET_CATEGORY_KEYS = new Set([
  'role',
  'scene',
  'prop',
  'storyboard',
  'audio',
]);

export function isCanvasLibraryPresetFolder(item) {
  return item?.type === 'folder'
    && typeof item.category_key === 'string'
    && CANVAS_LIBRARY_PRESET_CATEGORY_KEYS.has(item.category_key);
}

export function canvasLibraryVisiblePage(page) {
  // 历史分类目录可能含媒体或子目录，始终保留服务端返回的入口。
  return page;
}
