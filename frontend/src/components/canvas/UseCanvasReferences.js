/** 参考图草稿动作与本地临时地址管理；关闭输入框不回收源节点图片。 */
import { useCallback, useEffect, useRef } from 'react';
import { addCanvasReference, getCanvasReferenceEdges, getCanvasReferences, removeCanvasReference } from './CanvasReferences';
import { connectTextToAudio, disconnectTextAudio, getTextAudioEdges, isTextAudioConnection } from './CanvasTextAudio';
import { getCanvasMediaFileType } from './CanvasLocalMedia';

export function useCanvasReferences(nodes, setNodes, openPicker) {
  const urlsRef = useRef(new Set());
  useEffect(() => {
    const used = new Set(nodes.map((node) => node.data.asset?.url));
    for (const url of urlsRef.current) {
      if (!used.has(url)) { URL.revokeObjectURL(url); urlsRef.current.delete(url); }
    }
  }, [nodes]);
  useEffect(() => () => {
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current.clear();
  }, []);
  const addReference = useCallback((nodeId, source, mode, file) => {
    const nodeType = nodes.find((node) => node.id === nodeId)?.type;
    if (!['image', 'video'].includes(nodeType)) return;
    if (source === 'library') { openPicker({ nodeId, nodeType, purpose: 'reference', mode }); return; }
    if (!file) return;
    const type = getCanvasMediaFileType(file, nodeType);
    if (!type) return;
    const url = URL.createObjectURL(file);
    urlsRef.current.add(url);
    setNodes((current) => addCanvasReference(current, nodeId, { name: file.name, url, asset_type: type, source: 'local-preview' }, mode));
  }, [nodes, openPicker, setNodes]);
  const removeReference = useCallback((nodeId, sourceId) => {
    setNodes((current) => removeCanvasReference(current, nodeId, sourceId));
  }, [setNodes]);
  return {
    nodes: nodes.map((node) => ({ ...node, data: { ...node.data, references: getCanvasReferences(nodes, node.id), onAddReference: addReference, onRemoveReference: removeReference } })),
    edges: [...getCanvasReferenceEdges(nodes), ...getTextAudioEdges(nodes)],
    isValidConnection: (connection) => isTextAudioConnection(nodes, connection),
    onConnect: (connection) => setNodes((current) => connectTextToAudio(current, connection)),
    onEdgesChange: (changes) => {
      const removed = new Set(changes.filter((change) => change.type === 'remove').map((change) => change.id));
      if (!removed.size) return;
      setNodes((current) => getCanvasReferenceEdges(current).reduce((next, edge) => removed.has(edge.id) ? removeCanvasReference(next, edge.target, edge.source) : next, current));
      setNodes((current) => getTextAudioEdges(current).reduce((next, edge) => removed.has(edge.id) ? disconnectTextAudio(next, edge.target) : next, current));
    },
  };
}
