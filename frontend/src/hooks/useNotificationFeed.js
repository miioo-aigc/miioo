import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGetNotifications, apiGetUserAnnouncements } from '../api/user';
import { notificationKey, mergeConfirmedReads } from '../utils/NotificationReadState';

export default function useNotificationFeed({ open, userId, activeTab, confirmedReads }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const session = useRef(null);
  const [sentinel, setSentinel] = useState(null);
  const loadNotifications = useCallback(async () => {
    const current = session.current;
    if (!current || current.busy || !current.more) return;
    current.busy = true;
    setLoading(true);
    setLoadError(false);
    try {
      const data = current.tab === 'system'
        ? await apiGetUserAnnouncements({ page: current.page, pageSize: 10, signal: current.controller.signal })
        : await apiGetNotifications({ type: 'creation_log', page: current.page, pageSize: 10, signal: current.controller.signal });
      if (session.current !== current) return;
      current.more = data.list.length > 0 && (data.hasMore ?? current.page * 10 < data.total);
      current.page++;
      setNotifications((items) => {
        const merged = new Map(items.map((item) => [notificationKey(item), item]));
        for (const item of data.list) merged.set(notificationKey(item), item);
        return mergeConfirmedReads([...merged.values()], confirmedReads.current);
      });
      setHasMore(current.more);
    } catch {
      if (session.current === current) setLoadError(true);
    } finally {
      if (session.current === current) { current.busy = false; setLoading(false); }
    }
  }, [confirmedReads]);

  useEffect(() => {
    if (!open || !userId) return;
    const current = { tab: activeTab, page: 1, more: true, busy: false, controller: new AbortController() };
    session.current = current;
    // 新账号或页签从第一页开始；旧请求通过会话引用和取消信号双重隔离。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotifications([]);
    setHasMore(false);
    loadNotifications();
    return () => { session.current = null; current.controller.abort(); };
  }, [open, userId, activeTab, loadNotifications]);

  useEffect(() => {
    if (!sentinel || !hasMore || loading || loadError) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadNotifications();
    }, { root: sentinel.parentElement });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, hasMore, loading, loadError, loadNotifications]);

  return { notifications, setNotifications, loading, loadError, hasMore, loadNotifications, setSentinel };
}
