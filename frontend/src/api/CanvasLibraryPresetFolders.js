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
  if (!Array.isArray(page?.items)) return page;
  const items = page.items.filter((item) => !isCanvasLibraryPresetFolder(item));
  return items.length === page.items.length ? page : { ...page, items };
}
