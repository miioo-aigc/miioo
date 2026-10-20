/** 开发专用内存模型；与真实画布和真实资产隔离，刷新后清空。 */
export function createCanvasAssetLibraryDevelopment() {
  const folders = new Map();
  const entries = new Map();
  const assets = new Map();
  const previews = new Map();
  const collections = new Map();
  const selections = new Map();
  const files = new Map();
  let revision = 0;
  let sequence = 0;
  const id = () => `canvas-library-dev-${++sequence}`;
  const fail = (message, code) => { throw Object.assign(new Error(message), { code }); };
  const folder = (key) => {
    if (key === null) return null;
    return folders.get(key) || fail('文件夹已不存在', 'FOLDER_NOT_FOUND');
  };
  const collectionOf = (key) => {
    let current = folder(key);
    while (current?.parent_id) current = folder(current.parent_id);
    return current?.collection_id;
  };
  const seedCollection = ({ name, kind = 'project', defaults = true }) => {
    const root = { id: id(), type: 'folder', parent_id: null, name, kind: 'root', revision: ++revision };
    const item = { id: id(), name, kind, root_folder_id: root.id, revision, created_at: new Date().toISOString() };
    root.collection_id = item.id;
    folders.set(root.id, root); collections.set(item.id, item);
    if (defaults) for (const name of ['角色', '场景', '道具', '分镜', '音频']) {
      const child = { id: id(), type: 'folder', parent_id: root.id, name, kind: 'normal', revision };
      folders.set(child.id, child);
    }
    return { ...item };
  };
  const descendants = (key) => {
    const result = new Set([key]);
    for (const child of folders.values()) {
      if (child.parent_id === key) for (const nested of descendants(child.id)) result.add(nested);
    }
    return result;
  };
  const items = (parentId) => [
    ...Array.from(folders.values()).filter((item) => item.parent_id === parentId).map((item) => ({
      ...item, type: 'folder', count: Array.from(entries.values()).filter((entry) => entry.folder_id === item.id).length,
    })),
    ...Array.from(entries.values()).filter((item) => item.folder_id === parentId).map((item) => ({ ...item, asset: assets.get(item.asset_id) })),
  ];
  const scope = (selection) => {
    const folderIds = new Set();
    const entryIds = new Set();
    for (const item of selection) {
      if (item.type === 'folder' || item.type === 'collection') {
        const key = item.type === 'collection' ? collections.get(item.id)?.root_folder_id : item.id;
        for (const nested of descendants(folder(key).id)) folderIds.add(nested);
      }
      else {
        if (!entries.has(item.id)) fail('素材已不存在', 'ASSET_UNAVAILABLE');
        entryIds.add(item.id);
      }
    }
    for (const item of entries.values()) if (folderIds.has(item.folder_id)) entryIds.add(item.id);
    const nativeIds = new Set(Array.from(entryIds).map((key) => entries.get(key)).filter((item) => item.relation === 'native').map((item) => item.asset_id));
    return { folderIds, entryIds, nativeIds };
  };
  return {
    seedCollection,
    async collections({ cursor = null, limit = 60 } = {}) {
      const all = [...collections.values()].reverse().map((item) => ({ ...item }));
      const offset = Number(cursor || 0);
      return { items: all.slice(offset, offset + limit), next_cursor: offset + limit < all.length ? String(offset + limit) : null };
    },
    async renameCollection(key, { name, base_revision }) {
      const item = collections.get(key);
      if (!item) fail('集合不存在', 'COLLECTION_NOT_FOUND');
      if (base_revision != null && base_revision !== item.revision) fail('内容已改变', 'REVISION_CONFLICT');
      if (!name.trim()) fail('请输入名称', 'INVALID_NAME');
      Object.assign(item, { name: name.trim(), revision: ++revision });
      Object.assign(folder(item.root_folder_id), { name: item.name, revision });
      return { ...item };
    },
    async copyCollection(key, { base_revision } = {}) {
      const original = collections.get(key);
      if (!original) fail('集合不存在', 'COLLECTION_NOT_FOUND');
      if (base_revision != null && original.revision !== base_revision) fail('内容已改变', 'REVISION_CONFLICT');
      const copy = seedCollection({ name: `${original.name}-副本`, kind: 'copy', defaults: false });
      const clone = (sourceId, targetId) => {
        for (const child of items(sourceId)) {
          if (child.type === 'folder') {
            const next = { ...child, id: id(), parent_id: targetId, revision };
            folders.set(next.id, next); clone(child.id, next.id);
          } else {
            const source = assets.get(child.asset_id);
            const file = files.get(source.id);
            const asset = { ...source, id: id(), url: URL.createObjectURL(file), revision };
            assets.set(asset.id, asset); files.set(asset.id, file);
            const entry = { id: id(), type: 'entry', folder_id: targetId, asset_id: asset.id, relation: 'native', revision };
            entries.set(entry.id, entry);
          }
        }
      };
      clone(original.root_folder_id, copy.root_folder_id);
      return { status: 'completed', collection_id: copy.id };
    },
    async previewDownload() { fail('开发模拟模式不提供服务端打包，请连接真实接口验收下载'); },
    async downloadCollection() { fail('开发模拟模式不提供服务端打包'); },
    async selection({ collection_id, parent_id, scope: selectionScope }) {
      if (selectionScope !== 'directory_children' || collectionOf(parent_id) !== collection_id) fail('目录范围无效', 'SELECTION_SCOPE_CHANGED');
      const token = id(); const selected = items(parent_id).map(({ type, id }) => ({ type, id }));
      const expires = Date.now() + 60000;
      selections.set(token, { selection: selected, revision, expires });
      return { selection_token: token, count: selected.length, version: revision, expires_at: new Date(expires).toISOString() };
    },
    async list({ collection_id, parent_id = null, cursor = null, limit = 60 } = {}) {
      if (!parent_id || !collection_id || collectionOf(parent_id) !== collection_id) fail('请指定所属集合与目录', 'COLLECTION_NOT_FOUND');
      folder(parent_id);
      const all = items(parent_id);
      const offset = Number(cursor || 0);
      return { items: all.slice(offset, offset + limit), next_cursor: offset + limit < all.length ? String(offset + limit) : null };
    },
    async folder(key) {
      const current = folder(key);
      const ancestors = [];
      let parent = current?.parent_id;
      while (parent) { const item = folder(parent); ancestors.unshift(item); parent = item.parent_id; }
      return { ...current, ancestors };
    },
    async create({ parent_id = null, name, kind = 'normal', bound_project_id = null }) {
      if (!parent_id) fail('不能自由创建项目级集合', 'ROOT_FOLDER_CREATION_FORBIDDEN');
      folder(parent_id);
      if (!name.trim()) fail('请输入文件夹名称', 'INVALID_NAME');
      const item = { id: id(), type: 'folder', parent_id, name: name.trim(), kind, bound_project_id, revision: ++revision };
      folders.set(item.id, item);
      return item;
    },
    async rename({ type, id: key, name, base_revision }) {
      if (!name.trim()) fail('请输入名称', 'INVALID_NAME');
      const item = type === 'folder' ? folder(key) : assets.get(entries.get(key)?.asset_id);
      if (!item) fail('素材已不存在', 'ASSET_UNAVAILABLE');
      if (item.kind === 'root') fail('请通过集合菜单重命名', 'PROJECT_FOLDER_LOCKED');
      if (base_revision != null && item.revision !== base_revision) fail('内容已改变，请刷新后重试', 'REVISION_CONFLICT');
      Object.assign(item, { name: name.trim(), revision: ++revision });
      return item;
    },
    async move({ selection, target_folder_id }) {
      if (!target_folder_id) fail('请选择目标文件夹', 'TARGET_NOT_FOUND');
      folder(target_folder_id);
      for (const selected of selection) {
        const current = selected.type === 'folder' ? folder(selected.id) : entries.get(selected.id);
        if (current?.kind === 'root') fail('项目文件夹不能移动', 'PROJECT_FOLDER_LOCKED');
        if (selected.base_revision != null && current?.revision !== selected.base_revision) fail('内容已改变，请刷新后重试', 'REVISION_CONFLICT');
      }
      const { folderIds } = scope(selection);
      if (folderIds.has(target_folder_id)) fail('不能移动到自身或子文件夹', 'FOLDER_CYCLE');
      for (const item of selection) {
        if (item.type === 'folder' && folder(item.id).kind === 'root') fail('项目文件夹不能移动', 'PROJECT_FOLDER_LOCKED');
        const source = item.type === 'folder' ? item.id : entries.get(item.id).folder_id;
        if (collectionOf(source) !== collectionOf(target_folder_id)) fail('跨集合不能移动', 'CROSS_COLLECTION_MOVE_FORBIDDEN');
        if (item.type !== 'folder' && !target_folder_id) fail('素材不能放在首页，请选择文件夹', 'TARGET_NOT_FOUND');
      }
      for (const item of selection) {
        if (item.type === 'folder') {
          const current = folder(item.id);
          // 祖孙同时选择时，仅移动最外层目录。
          if (folderIds.has(current.parent_id)) continue;
          Object.assign(current, { parent_id: target_folder_id, revision: revision + 1 });
        } else if (!folderIds.has(entries.get(item.id).folder_id)) Object.assign(entries.get(item.id), { folder_id: target_folder_id, revision: revision + 1 });
      }
      revision++;
      return { status: 'completed' };
    },
    async references({ folder_id, asset_ids }) {
      if (!folder_id) fail('请选择目标文件夹', 'TARGET_NOT_FOUND');
      folder(folder_id);
      for (const key of asset_ids) if (!assets.has(key)) fail('模拟模式只能添加本次模拟上传的素材', 'ASSET_UNAVAILABLE');
      for (const key of asset_ids) {
        const entry = { id: id(), type: 'entry', folder_id, asset_id: key, relation: 'reference', revision: revision + 1 };
        entries.set(entry.id, entry);
      }
      revision++;
      return { status: 'completed' };
    },
    async upload(file, folderId) {
      folder(folderId);
      if (!folderId) fail('请先进入文件夹', 'TARGET_NOT_FOUND');
      const mediaType = file.type.split('/')[0];
      if (!['image', 'video', 'audio'].includes(mediaType)) fail('只支持图片、视频和音频', 'UNSUPPORTED_MEDIA_TYPE');
      const asset = { id: id(), name: file.name, media_type: mediaType, url: URL.createObjectURL(file), availability: 'ready', revision: ++revision };
      assets.set(asset.id, asset);
      files.set(asset.id, file);
      const entry = { id: id(), type: 'entry', folder_id: folderId, asset_id: asset.id, relation: 'native', revision };
      entries.set(entry.id, entry);
      return { ...entry, asset };
    },
    async preview({ selection, selection_token }) {
      if (selection_token) {
        if (selection) fail('选择范围不能同时提供', 'SELECTION_SCOPE_CHANGED');
        const snapshot = selections.get(selection_token);
        if (!snapshot || Date.now() > snapshot.expires) fail('全选已过期', 'SELECTION_EXPIRED');
        if (snapshot.revision !== revision) fail('全选范围已改变', 'SELECTION_SCOPE_CHANGED');
        selection = snapshot.selection;
      }
      const range = scope(selection);
      const token = id();
      const expires = Date.now() + 60000;
      previews.set(token, { range, revision, expires });
      return {
        preview_token: token, expires_at: new Date(expires).toISOString(),
        impact: { folder_count: range.folderIds.size, native_asset_count: range.nativeIds.size,
          reference_only_count: Array.from(range.entryIds).filter((key) => !range.nativeIds.has(entries.get(key).asset_id)).length,
          affected_project_count: 0, affected_canvas_count: 0, affected_node_count: 0 },
        affected_projects: [],
      };
    },
    async commit({ preview_token }) {
      const preview = previews.get(preview_token);
      if (!preview || Date.now() > preview.expires) fail('删除确认已过期，请重新确认', 'DELETE_PREVIEW_EXPIRED');
      if (preview.revision !== revision) fail('删除范围已改变，请重新确认', 'DELETE_SCOPE_CHANGED');
      const { folderIds, entryIds, nativeIds } = preview.range;
      for (const item of entries.values()) if (entryIds.has(item.id) || nativeIds.has(item.asset_id)) entries.delete(item.id);
      for (const key of nativeIds) { URL.revokeObjectURL(assets.get(key).url); assets.delete(key); files.delete(key); }
      for (const [key, item] of collections) if (folderIds.has(item.root_folder_id)) collections.delete(key);
      for (const key of folderIds) folders.delete(key);
      previews.delete(preview_token);
      revision++;
      return { status: 'completed', invalidated_asset_ids: Array.from(nativeIds) };
    },
    dispose() { for (const item of assets.values()) URL.revokeObjectURL(item.url); },
  };
}
