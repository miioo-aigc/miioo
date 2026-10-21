import { useCallback, useEffect, useRef, useState } from 'react';
import { apiCreateCanvasProject, apiGetCanvasProjectEntry, apiListCanvasProjects } from '../../api/CanvasProjects';
import { getAuthSessionGeneration, getToken } from '../../api/request';
import { normalizeProjectList } from '../../utils/projectAdapter';
import { showGlobalToast } from '../../stores/toastStore';

// 只编排正式项目入口；路由和登录弹窗仍由页面管理。
export function useCanvasProjects({ active, context, isLoggedIn, onLogin, onOpen }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scope = useRef(null);
  const lock = useRef(false);
  const version = useRef(0);
  const reload = useCallback(async () => {
    const owner = scope.current;
    const request = ++version.current;
    const isCurrent = () => owner && owner === scope.current && request === version.current
      && owner.session === getAuthSessionGeneration();
    if (!isCurrent() || !getToken()) return;
    setLoading(true);
    setError('');
    try {
      const projects = await apiListCanvasProjects({ isCurrent });
      if (isCurrent()) setItems(normalizeProjectList(projects));
    } catch (cause) {
      if (isCurrent()) setError(cause.message || '获取画布项目失败');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const owner = { session: getAuthSessionGeneration() };
    scope.current = owner;
    Promise.resolve().then(() => {
      if (scope.current !== owner) return;
      if (active && isLoggedIn) reload();
      else { setItems([]); setError(''); setLoading(false); }
    });
    return () => { scope.current = null; };
  }, [active, context, isLoggedIn, reload]);

  const run = async (action) => {
    if (!isLoggedIn || !getToken()) { onLogin(); return; }
    if (lock.current) return;
    const owner = scope.current;
    const isCurrent = () => owner && owner === scope.current && owner.session === getAuthSessionGeneration();
    lock.current = true;
    try {
      const canvasId = await action(isCurrent);
      if (canvasId && isCurrent()) onOpen(canvasId);
    } catch (cause) {
      if (isCurrent()) showGlobalToast('error', cause.message || '画布项目操作失败');
    } finally { lock.current = false; }
  };
  const create = () => run(async () => {
    try { return (await apiCreateCanvasProject()).first_canvas_id; }
    catch (cause) {
      if (!cause.status) throw new Error((cause.message || '创建结果未确认') + '；请刷新项目列表核对后再操作', { cause });
      throw cause;
    }
  });
  const open = (project) => run((isCurrent) => apiGetCanvasProjectEntry(project.id, { isCurrent }));
  return { items, loading, error, reload, create, open };
}
