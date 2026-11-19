/** 项目内、登录会话内共享的内存剪贴板；不持久化媒体地址或节点内容到浏览器存储。 */
export function createCanvasNodeClipboard() {
  const empty = Object.freeze([]);
  let snapshot = { projectId: null, session: null, nodes: empty };
  const listeners = new Set();
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    read(projectId, session) {
      if (session !== snapshot.session) snapshot = { projectId: null, session, nodes: empty };
      return projectId && projectId === snapshot.projectId ? snapshot.nodes : empty;
    },
    write(projectId, session, nodes) {
      if (!projectId || !nodes.length) return;
      snapshot = { projectId, session, nodes: structuredClone(nodes) };
      listeners.forEach(listener => listener());
    },
  };
}
