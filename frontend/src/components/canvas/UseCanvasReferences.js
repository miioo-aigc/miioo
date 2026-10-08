/** 参考图草稿动作；临时地址由画布历史持有，撤销删除后仍可预览。 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { appendCanvasNode } from './canvasNodeUtils';
import { CANVAS_CARD_PULSE_DURATION, getCanvasPulseTiming } from './CanvasPulseMotion';
import { showGlobalToast } from '../../stores/toastStore';
import { addCanvasReference, getCanvasReferenceEdges, removeCanvasReference } from './CanvasReferences';
import { getCanvasPromptReferences } from './CanvasPromptReferences';
import { connectTextToAudio, disconnectTextAudio, getTextAudioEdges, isTextAudioConnection } from './CanvasTextAudio';
import { getCanvasMediaFileType } from './CanvasLocalMedia';
import { connectCanvasText, disconnectCanvasText, getCanvasTextEdges, isCanvasTextConnection } from './CanvasTextGeneration';
import { canConnectCanvasImage, connectCanvasImage, disconnectCanvasImage, getCanvasImageEdges, isCanvasImageConnection } from './CanvasImageGeneration';
import { canConnectCanvasVideo, connectCanvasVideo, disconnectCanvasVideo, getCanvasVideoEdges, isCanvasVideoConnection, validateCanvasVideoReferenceAddition } from './CanvasVideoGeneration';

export function useCanvasReferences(nodes, setNodes, openPicker) {
  const [pulses, setPulses] = useState([]);
  useEffect(() => {
    const timers = pulses.map((pulse) => {
      const expiresAt = pulse.startedAt === null ? pulse.createdAt + 5000 : pulse.startedAt + pulse.edgeDuration + CANVAS_CARD_PULSE_DURATION + 350;
      return setTimeout(() => setPulses((current) => current.filter((item) => item.id !== pulse.id)), Math.max(0, expiresAt - performance.now()));
    });
    return () => timers.forEach(clearTimeout);
  }, [pulses]);
  const onPulseMeasure = useCallback((pulseId, pathLength, kind) => {
    if (!Number.isFinite(pathLength) || pathLength <= 0) return;
    const startedAt = performance.now();
    setPulses((current) => current.map((pulse) => {
      const field = kind === 'card' ? 'cardLength' : 'edgeLength';
      if (pulse.id !== pulseId || pulse[field] === pathLength) return pulse;
      const measured = { ...pulse, [field]: pathLength };
      const timing = getCanvasPulseTiming(measured.edgeLength, measured.cardLength);
      if (!timing) return measured;
      return { ...measured, ...timing, startedAt: pulse.startedAt ?? startedAt };
    }));
  }, []);
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
  const addReference = useCallback((nodeId, source, mode, file) => {
    const nodeType = nodes.find((node) => node.id === nodeId)?.type;
    if (!['image', 'video'].includes(nodeType)) return;
    if (source === 'library') { openPicker({ nodeId, nodeType, purpose: 'reference', mode }); return; }
    if (!file) return;
    const type = getCanvasMediaFileType(file, nodeType);
    if (!type) return;
    const validation = nodeType === 'video'
      ? validateCanvasVideoReferenceAddition(nodes, nodeId, { asset_type: type })
      : { allowed: true };
    if (!validation.allowed) { showGlobalToast('warning', validation.message); return; }
    const url = URL.createObjectURL(file);
    setNodes((current) => addCanvasReference(current, nodeId, { name: file.name, url, asset_type: type, source: 'local-preview' }, mode));
  }, [nodes, openPicker, setNodes]);
  const removeReference = useCallback((nodeId, sourceId) => {
    setNodes((current) => disconnectCanvasImage(removeCanvasReference(current, nodeId, sourceId), nodeId, sourceId));
  }, [setNodes]);
  const connectNodes = useCallback((current, connection) => {
    if (isCanvasVideoConnection(current, connection)) {
      const target = current.find((node) => node.id === connection.target);
      return connectCanvasVideo(current, connection, target?.data?.videoCapabilities);
    }
    if (isCanvasImageConnection(current, connection)) return connectCanvasImage(current, connection);
    return isCanvasTextConnection(current, connection)
      ? connectCanvasText(current, connection)
      : connectTextToAudio(current, connection);
  }, []);
  const isConnectionValid = useCallback((connection, currentNodes = nodes) => {
    if (isCanvasVideoConnection(currentNodes, connection)) {
      const target = currentNodes.find((node) => node.id === connection.target);
      return canConnectCanvasVideo(currentNodes, connection, target?.data?.videoCapabilities);
    }
    if (isCanvasImageConnection(currentNodes, connection)) return canConnectCanvasImage(currentNodes, connection);
    return isTextAudioConnection(currentNodes, connection) || isCanvasTextConnection(currentNodes, connection);
  }, [nodes]);
  const removeEdges = useCallback((edgeIds) => {
    const removed = new Set(edgeIds);
    if (!removed.size) return;
    setNodes((current) => getCanvasTextEdges(current).reduce((next, edge) => removed.has(edge.id) ? disconnectCanvasText(next, edge.target, edge.source) : next, current));
    setNodes((current) => getCanvasImageEdges(current).reduce((next, edge) => removed.has(edge.id) ? disconnectCanvasImage(next, edge.target, edge.source) : next, current));
    setNodes((current) => getCanvasVideoEdges(current).reduce((next, edge) => removed.has(edge.id) ? disconnectCanvasVideo(next, edge.target, edge.source) : next, current));
    setNodes((current) => getCanvasReferenceEdges(current).reduce((next, edge) => removed.has(edge.id) ? removeCanvasReference(next, edge.target, edge.source) : next, current));
    setNodes((current) => getTextAudioEdges(current).reduce((next, edge) => removed.has(edge.id) ? disconnectTextAudio(next, edge.target, edge.source) : next, current));
  }, [setNodes]);
  const graphEdges = useMemo(() => [
    ...getCanvasReferenceEdges(nodes).filter((edge) => nodes.find((node) => node.id === edge.target)?.type !== 'video'),
    ...getTextAudioEdges(nodes), ...getCanvasTextEdges(nodes), ...getCanvasImageEdges(nodes), ...getCanvasVideoEdges(nodes),
  ], [nodes]);
  const highlightedEdgeIds = useMemo(() => {
    if (!hoveredEdgeId) return new Set();
    const hovered = graphEdges.find((edge) => edge.id === hoveredEdgeId);
    if (!hovered) return new Set();
    const upstreamNodeIds = new Set([hovered.source]);
    const downstreamNodeIds = new Set([hovered.target]);
    let changed = true;
    while (changed) {
      changed = false;
      graphEdges.forEach((edge) => {
        if (upstreamNodeIds.has(edge.target) && !upstreamNodeIds.has(edge.source)) {
          upstreamNodeIds.add(edge.source);
          changed = true;
        }
        if (downstreamNodeIds.has(edge.source) && !downstreamNodeIds.has(edge.target)) {
          downstreamNodeIds.add(edge.target);
          changed = true;
        }
      });
    }
    return new Set(graphEdges.filter((edge) => (
      (upstreamNodeIds.has(edge.source) && upstreamNodeIds.has(edge.target))
      || (downstreamNodeIds.has(edge.source) && downstreamNodeIds.has(edge.target))
      || edge.id === hoveredEdgeId
    )).map((edge) => edge.id));
  }, [graphEdges, hoveredEdgeId]);
  const edges = graphEdges.map((edge) => ({ ...edge, type: 'canvasConnection', data: {
    ...edge.data,
    pulses: pulses.filter((pulse) => pulse.source === edge.source && pulse.target === edge.target),
    onPulseMeasure,
    highlighted: highlightedEdgeIds.has(edge.id),
    onHover: setHoveredEdgeId,
    onDelete: (edgeId) => removeEdges([edgeId]),
  } }));
  return {
    nodes: nodes.map((node) => ({ ...node, data: { ...node.data, onPulseMeasure, connectionPulses: pulses.filter((pulse) => pulse.target === node.id && graphEdges.some((edge) => edge.source === pulse.source && edge.target === pulse.target)), references: getCanvasPromptReferences(nodes, node.id), onAddReference: addReference, onRemoveReference: removeReference } })),
    edges,
    isValidConnection: isConnectionValid,
    connectNodes,
    onConnect: (connection, addedNode = null) => {
      const candidates = addedNode ? appendCanvasNode(nodes, addedNode) : nodes;
      const exists = graphEdges.some((edge) => edge.source === connection.source && edge.target === connection.target);
      if (!exists && isConnectionValid(connection, candidates)) {
        const pulse = { id: crypto.randomUUID(), source: connection.source, target: connection.target, createdAt: performance.now(), startedAt: null, edgeDuration: null };
        setPulses((current) => [...current, pulse]);
      }
      setNodes((current) => connectNodes(addedNode ? appendCanvasNode(current, addedNode) : current, connection));
    },
    onEdgesChange: (changes) => {
      removeEdges(changes.filter((change) => change.type === 'remove').map((change) => change.id));
    },
  };
}
