export const CANVAS_GENERATION_FALLBACK = '正在创作，请稍等…';

export function getCanvasProgressMessage(message) {
  return typeof message === 'string' && message.trim() ? message.trim() : CANVAS_GENERATION_FALLBACK;
}

export function createCanvasProgressHandler(setNodes, requestId, signal) {
  return ({ message } = {}) => {
    if (signal.aborted) return;
    const text = getCanvasProgressMessage(message);
    setNodes((nodes) => {
      if (signal.aborted) return nodes;
      return nodes.map((node) => node.data?.generating && node.data.generationRequestId === requestId
        && (node.data.generationMessage !== text || node.data.generationMessageRequestId !== requestId)
        ? { ...node, data: { ...node.data, generationMessage: text, generationMessageRequestId: requestId } } : node);
    }, { record: false });
  };
}
