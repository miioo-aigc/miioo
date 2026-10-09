/** 可移植画布文件：复用节点复制协议，导入重新分配所有内部编号。 */
import { copyCanvasNodes, pasteCanvasNodes } from './CanvasNodeActions.js';
import { getCanvasAbsolutePosition, orderParentsFirst } from './CanvasGroups.js';

export const CANVAS_FILE_LIMIT = 100 * 1024 * 1024;
const types = new Set(['text', 'image', 'video', 'audio', 'canvasGroup']);
const fail = () => { throw new Error('画布文件格式无效或版本不受支持'); };

export function parseCanvasFile(text) {
  let file;
  try { file = JSON.parse(text); } catch { fail(); }
  if (file?.format !== 'miioo-canvas' || file.version !== 1 || !Array.isArray(file.nodes) || file.nodes.length > 5000) fail();
  const byId = new Map();
  for (const node of file.nodes) {
    if (!node || typeof node.id !== 'string' || !node.id || byId.has(node.id) || !types.has(node.type)
      || !Number.isFinite(node.position?.x) || !Number.isFinite(node.position?.y)
      || !node.data || typeof node.data !== 'object' || Array.isArray(node.data) || typeof node.data.label !== 'string') fail();
    if (node.type === 'canvasGroup' && (!Number.isFinite(node.style?.width) || node.style.width <= 0 || !Number.isFinite(node.style?.height) || node.style.height <= 0)) fail();
    byId.set(node.id, node);
  }
  for (const node of file.nodes) {
    const seen = new Set([node.id]);
    let parentId = node.parentId;
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent || parent.type !== 'canvasGroup' || seen.has(parentId)) fail();
      seen.add(parentId);
      parentId = parent.parentId;
    }
    for (const key of ['textSourceIds', 'imageSourceIds', 'videoSourceIds', 'audioSourceIds']) {
      if (node.data[key] !== undefined && (!Array.isArray(node.data[key]) || node.data[key].some((id) => !byId.has(id)))) fail();
    }
    if (node.data.textSourceId && !byId.has(node.data.textSourceId)) fail();
    if (node.data.referenceInputs !== undefined && (!Array.isArray(node.data.referenceInputs) || node.data.referenceInputs.some((input) => !input || !byId.has(input.sourceId)))) fail();
    if (node.data.textSync && (!Array.isArray(node.data.textSync.parts) || node.data.textSync.parts.some((part) => !part || (part.sourceId && !byId.has(part.sourceId))))) fail();
  }
  // 拒绝原型键和不可移植/可执行地址；不把文件里的运行态、事件或任意节点属性带入画布。
  const check = (value, depth = 0) => {
    if (depth > 80) fail();
    if (typeof value === 'string' && /^(?:blob:|javascript:|data:(?!image\/(?:png|jpeg|webp|gif|avif);base64,|audio\/[\w.+-]+;base64,|video\/[\w.+-]+;base64,))/i.test(value)) fail();
    if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) fail();
      check(item, depth + 1);
    });
  };
  check(file);
  return orderParentsFirst(copyCanvasNodes(file.nodes.map((node) => ({ ...node, selected: true, style: node.style ? { width: node.style.width, height: node.style.height } : undefined }))));
}

export async function serializeCanvasFile(nodes, name) {
  const snapshot = copyCanvasNodes(nodes.map((node) => ({ ...node, selected: true })));
  const cache = new Map();
  const embed = async (value) => {
    if (typeof value === 'string' && value.startsWith('blob:')) {
      if (!cache.has(value)) cache.set(value, (async () => {
        const response = await fetch(value);
        if (!response.ok) throw new Error('本地素材读取失败，未导出画布');
        const blob = await response.blob();
        if (blob.size > CANVAS_FILE_LIMIT) throw new Error('素材过大，画布文件上限为100MB');
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('本地素材读取失败'));
          reader.readAsDataURL(blob);
        });
      })());
      return cache.get(value);
    }
    if (Array.isArray(value)) return Promise.all(value.map(embed));
    if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await embed(item)])));
    return value;
  };
  const text = JSON.stringify({ format: 'miioo-canvas', version: 1, name, nodes: await embed(snapshot) });
  if (new Blob([text]).size > CANVAS_FILE_LIMIT) throw new Error('画布文件超过100MB，无法导出');
  parseCanvasFile(text);
  return text;
}

export function mergeCanvasFile(current, imported, makeId) {
  if (!imported.length) return current;
  const positions = current.map((node) => ({ node, ...getCanvasAbsolutePosition(current, node) }));
  const position = current.length ? {
    x: Math.max(...positions.map(({ node, x }) => x + (node.style?.width || node.measured?.width || 240))) + 120,
    y: Math.min(...positions.map(({ y }) => y)),
  } : { x: 0, y: 0 };
  return pasteCanvasNodes(current, imported, position, makeId, { preserveLabels: true });
}
