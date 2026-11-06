import { useState } from 'react';
import { showGlobalToast } from '../../stores/toastStore';
import { commitCanvasNodeOutput } from './CanvasResultMutations.js';
import { getCanvasOperationLocks } from './CanvasOperationGuards.js';

/** 独立草稿会话；保存使用最新节点，避免覆盖编辑期间的异步字段。 */
export function useCanvasTextEditor({ nodes, history, cancelPendingClicks }) {
  const [session, setSession] = useState(null);
  return {
    session,
    open: (id) => {
      const node = nodes.find((item) => item.id === id && item.type === 'text');
      if (!node) return;
      if (node.data.generating || node.data.generationPending || node.data.submissionLocked
        || getCanvasOperationLocks(nodes).upstreamProtected.has(id)) {
        showGlobalToast('请等待文本生成完成后再编辑内容', 'info');
        return;
      }
      cancelPendingClicks();
      setSession({ id, title: node.data.label || '文本', content: node.data.content || '' });
    },
    close: () => setSession(null),
    save: (content) => {
      if (!session) return;
      if (typeof content !== 'string' || !content.trim()) {
        showGlobalToast('文本结果不能为空', 'warning');
        return false;
      }
      const current = history.getCurrentNodes?.() || nodes;
      const target = current.find((node) => node.id === session.id && node.type === 'text');
      if (!target || target.data.generating || target.data.generationPending || target.data.editing
        || target.data.submissionLocked || getCanvasOperationLocks(current).upstreamProtected.has(session.id)) {
        showGlobalToast('当前节点结果受到任务保护，无法保存编辑', 'warning');
        setSession(null);
        return false;
      }
      const submittedAt = Date.now();
      const batchId = `canvas-edit-${crypto.randomUUID()}`;
      history.begin();
      try {
        history.setNodes((currentNodes) => currentNodes.map((node) => node.id === session.id
          ? commitCanvasNodeOutput(node, { id: batchId, source: 'edit', requestedCount: 1,
            results: [{ id: `${batchId}-result`, index: 0, type: 'text', content }],
            submittedAt, completedAt: Date.now(), snapshot: { source: 'text-editor' }, taskIds: [] })
          : node));
      } finally { history.end(); }
      setSession(null);
      return true;
    },
  };
}
