import { useState } from 'react';
import { showGlobalToast } from '../../stores/toastStore';

/** 独立草稿会话；保存使用最新节点，避免覆盖编辑期间的异步字段。 */
export function useCanvasTextEditor({ nodes, history, cancelPendingClicks }) {
  const [session, setSession] = useState(null);
  return {
    session,
    open: (id) => {
      const node = nodes.find((item) => item.id === id && item.type === 'text');
      if (!node) return;
      if (node.data.generating || node.data.generationPending) {
        showGlobalToast('请等待文本生成完成后再编辑内容', 'info');
        return;
      }
      cancelPendingClicks();
      setSession({ id, title: node.data.label || '文本', content: node.data.content || '' });
    },
    close: () => setSession(null),
    save: (content) => {
      if (!session) return;
      history.begin();
      history.setNodes((current) => current.map((node) => node.id === session.id
        ? { ...node, data: { ...node.data, content } } : node));
      history.end();
      setSession(null);
    },
  };
}
