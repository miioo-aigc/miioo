import { apiListCanvasProjects } from './CanvasProjects';
import { apiListCanvasDocuments } from './canvas';
import { canvasAssetLibrary } from './CanvasAssetLibrary';
import { groupCanvasLibraryProjects } from '../utils/CanvasLibraryProjects';
import { invalidate } from '../utils/cache';
import { K } from '../utils/cacheKeys';

// 完整读取轻量索引后分组，避免跨页画布被误判为单画布。
export async function apiReadCanvasLibraryProjects(isCurrent = () => true, signal) {
  invalidate(K.projectsPrefix()); // 重新进入资产页读取项目最新名称。
  const readCollections = async () => {
    const items = [], cursors = new Set();
    let cursor;
    do {
      if (!isCurrent()) return [];
      const page = await canvasAssetLibrary.canvasCollections({ limit: 200, cursor }, signal);
      if (!Array.isArray(page.items)) throw new Error('画布集合列表格式异常');
      items.push(...page.items);
      cursor = page.next_cursor;
      if (cursor && cursors.has(cursor)) throw new Error('画布集合分页未推进');
      cursors.add(cursor);
    } while (cursor);
    return items;
  };
  const readCanvases = async () => {
    const items = new Map();
    for (let page = 1; ; page++) {
      if (!isCurrent()) return [];
      const result = await apiListCanvasDocuments({ status: 'active', rootsOnly: true, page, pageSize: 100 });
      if (!Array.isArray(result.items)) throw new Error('画布列表格式异常');
      const size = items.size;
      result.items.forEach(item => items.set(item.id, item));
      if (!result.items.length || page * 100 >= result.total) return [...items.values()];
      if (size === items.size) throw new Error('画布列表分页未推进');
    }
  };
  const [projects, canvases, collections] = await Promise.all([apiListCanvasProjects({ isCurrent }), readCanvases(), readCollections()]);
  return groupCanvasLibraryProjects(projects, canvases, collections);
}
