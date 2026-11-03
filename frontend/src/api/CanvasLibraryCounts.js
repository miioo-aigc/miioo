/** 列表未提供直属素材计数时分页统计；不递归子目录，最多三个目录同时读取。 */
export async function withCanvasFolderCounts(page, read, signal) {
  const items = [...page.items];
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      const folder = items[index];
      if (folder.type !== 'folder' || (Number.isInteger(folder.count) && folder.count >= 0)) continue;
      try {
        const ids = new Set();
        const cursors = new Set();
        let cursor;
        do {
          if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
          const children = await read(folder.id, cursor);
          for (const item of children.items || []) {
            const type = String(item.asset?.media_type || item.asset?.asset_type || '').split('/')[0];
            if (item.type === 'entry' && ['image', 'video', 'audio'].includes(type)) ids.add(item.id);
          }
          cursor = children.next_cursor;
          if (cursor && cursors.has(cursor)) throw new Error('分页游标重复');
          if (cursor) cursors.add(cursor);
        } while (cursor);
        items[index] = { ...folder, count: ids.size };
      } catch (error) {
        if (signal?.aborted || error.name === 'AbortError') throw error;
        items[index] = { ...folder, count: '统计失败' };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, items.length) }, worker));
  return { ...page, items };
}
