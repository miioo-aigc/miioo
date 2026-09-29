/** 参考图草稿动作；临时地址由画布历史持有，撤销删除后仍可预览。 */
import { useCallback } from 'react';
import { addCanvasReference, getCanvasReferenceEdges, getCanvasReferences, removeCanvasReference } from './CanvasReferences';
import { connectTextToAudio, disconnectTextAudio, getTextAudioEdges, isTextAudioConnection } from './CanvasTextAudio';
import { getCanvasMediaFileType } from './CanvasLocalMedia';
import { connectCanvasText, disconnectCanvasText, getCanvasTextEdges, isCanvasTextConnection } from './CanvasTextGeneration';

export function useCanvasReferences(nodes, setNodes, openPicker) {
  const addReference = useCallback((nodeId, source, mode, file) => {
    const nodeType = nodes.find((node) => node.id === nodeId)?.type;
    if (!['image', 'video'].includes(nodeType)) return;
    if (source === 'library') { openPicker({ nodeId, nodeType, purpose: 'reference', mode }); return; }
    if (!file) return;
    const type = getCanvasMediaFileType(file, nodeType);
    if (!type) return;
    const url = URL.createObjectURL(file);
    setNodes((current) => addCanvasReference(current, nodeId, { name: file.name, url, asset_type: type, source: 'local-preview' }, mode));
  }, [nodes, openPicker, setNodes]);
  const removeReference = useCallback((nodeId, sourceId) => {
    setNodes((current) => removeCanvasReference(current, nodeId, sourceId));
  }, [setNodes]);
  const connectNodes = useCallback((current, connection) => (
    isCanvasTextConnection(current, connection)
      ? connectCanvasText(current, connection)
      : connectTextToAudio(current, connection)
  ), []);
  return {
    nodes: nodes.map((node) => ({ ...node, data: { ...node.data, references: getCanvasReferences(nodes, node.id), onAddReference: addReference, onRemoveReference: removeReference } })),
    edges: [...getCanvasReferenceEdges(nodes), ...getTextAudioEdges(nodes), ...getCanvasTextEdges(nodes)],
    isValidConnection: (connection) => isTextAudioConnection(nodes, connection) || isCanvasTextConnection(nodes, connection),
    connectNodes,
    onConnect: (connection) => setNodes((current) => connectNodes(current, connection)),
    onEdgesChange: (changes) => {
      const removed = new Set(changes.filter((change) => change.type === 'remove').map((change) => change.id));
      if (!removed.size) return;
      setNodes((current) => getCanvasTextEdges(current).reduce((next, edge) => removed.has(edge.id) ? disconnectCanvasText(next, edge.target, edge.source) : next, current));
      setNodes((current) => getCanvasReferenceEdges(current).reduce((next, edge) => removed.has(edge.id) ? removeCanvasReference(next, edge.target, edge.source) : next, current));
      setNodes((current) => getTextAudioEdges(current).reduce((next, edge) => removed.has(edge.id) ? disconnectTextAudio(next, edge.target) : next, current));
    },
  };
}
