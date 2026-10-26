import { useCallback, useEffect, useRef, useState } from 'react';
import { getAuthSessionGeneration } from '../api/request';
import { showGlobalToast } from '../stores/toastStore';

// 资料弹窗异步动作：同步防重、取消使回调失效、账号和卸载隔离。
export function useProfileOperation(identity = '') {
  const scope = useRef(0);
  const mounted = useRef(true);
  const pending = useRef(false);
  const sent = useRef(null);
  const [loading, setLoading] = useState(false);
  const cancel = useCallback(() => {
    scope.current++;
    if (sent.current === getAuthSessionGeneration()) {
      showGlobalToast('warning', '请求已发送，关闭或修改输入不能撤回操作，请重新核对账号状态。');
    }
    sent.current = null;
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; cancel(); };
  }, [identity, cancel]);
  const run = useCallback(async (action) => {
    if (pending.current || !mounted.current) return;
    pending.current = true;
    const version = scope.current;
    const generation = getAuthSessionGeneration();
    const current = () => mounted.current && scope.current === version && generation === getAuthSessionGeneration();
    setLoading(true);
    const markSent = () => { sent.current = generation; };
    try { await action(current, markSent); } catch (error) {
      if (current()) showGlobalToast('error', error?.isNetworkError
        ? '网络连接异常，操作结果未确认，请核对后再试；输入已保留。'
        : (error?.message || '操作失败，请稍后重试；输入已保留。'));
    } finally {
      sent.current = null;
      pending.current = false;
      if (mounted.current && generation === getAuthSessionGeneration()) setLoading(false);
    }
  }, []);
  return { loading, run, cancel };
}
