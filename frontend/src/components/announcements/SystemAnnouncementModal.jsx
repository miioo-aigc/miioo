import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { apiGetLatestAnnouncementPopup, apiMarkAnnouncementRead } from '../../api/user';
import { Button } from '../ui';

export default function SystemAnnouncementModal({ userId, showToast, onViewAll }) {
  const [announcement, setAnnouncement] = useState(null);
  const [closing, setClosing] = useState(false);
  const alive = useRef(false);
  const locked = useRef(false);
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    const controller = new AbortController();
    // 每次登录后挂载检查一次；刷新会再查，是否提醒始终以后端已读为准。
    apiGetLatestAnnouncementPopup({ signal: controller.signal }).then(
      (item) => { if (!cancelled) setAnnouncement(item); },
      (error) => { if (!cancelled) showToast?.(error.message || '获取公告失败', 'warning'); },
    );
    return () => { cancelled = true; alive.current = false; controller.abort(); };
  }, [userId, showToast]);
  const dismiss = async (viewAll = false) => {
    if (locked.current || !announcement) return;
    locked.current = true;
    setClosing(true);
    try {
      await apiMarkAnnouncementRead(announcement.id);
      if (alive.current) window.dispatchEvent(new CustomEvent('announcement:read', { detail: { userId, id: announcement.id } }));
    } catch (error) {
      if (alive.current) showToast?.(error.message || '已读状态保存失败，下次登录可能再次提醒', 'warning');
    } finally {
      if (alive.current) {
        setAnnouncement(null);
        setClosing(false);
        if (viewAll === true) onViewAll?.();
      }
      locked.current = false;
    }
  };
  if (!announcement) return null;
  return createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-surface-overlay backdrop-blur-[20px]" onClick={dismiss}>
    <div role="dialog" aria-modal="true" aria-label={announcement.title} className="flex flex-col w-[480px] max-w-[calc(100vw-40px)] min-h-[min(240px,80vh)] max-h-[min(600px,80vh)] rounded-large bg-surface-modal overflow-hidden" onClick={(event) => event.stopPropagation()}>
      <div className="flex shrink-0 items-center justify-between gap-[16px] px-[24px] py-[18px]">
        <h2 className="flex-1 min-w-0 text-[16px] [font-weight:500] text-text-primary break-words [overflow-wrap:anywhere]">{announcement.title}</h2>
        <button type="button" aria-label="关闭" disabled={closing} onClick={dismiss} className="shrink-0 text-text-secondary cursor-pointer"><X size={20} /></button>
      </div>
      <div className="flex flex-auto flex-col gap-[16px] px-[24px] py-[20px] overflow-y-auto min-h-0">
        <p className="text-font-size-14 leading-[1.8] text-text-secondary whitespace-pre-wrap break-words">{announcement.content}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-[16px] px-[24px] py-[16px]">
        <time className="min-w-0 text-font-size-12 text-text-hint [overflow-wrap:anywhere]">{announcement.publishedAt}</time>
        <div className="ml-auto flex items-center gap-[16px]">
          <Button variant="link" disabled={closing} onClick={() => dismiss(true)}>查看全部公告</Button>
          <Button disabled={closing} onClick={dismiss}>{closing ? '处理中...' : '我知道了'}</Button>
        </div>
      </div>
    </div>
  </div>, document.body);
}
