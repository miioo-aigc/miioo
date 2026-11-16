import { downloadBlob } from '../../utils/downloadBlob';

/** 工具栏与节点菜单共用文本下载，保留原文和节点名称。 */
export function downloadCanvasText(data) {
  if (!data?.content?.trim()) return;
  downloadBlob(new Blob([data.content], { type: 'text/plain;charset=utf-8' }), `${data.label || '文本节点'}.txt`);
}
