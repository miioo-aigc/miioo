import { useState, useEffect, useRef } from 'react';
import { apiMarkAnnouncementRead, apiMarkNotificationRead } from '../api/user';
import useNotificationFeed from '../hooks/useNotificationFeed';
import { notificationKey, mergeConfirmedReads } from '../utils/NotificationReadState';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TabButton({ active, children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: 0,
        margin: 0,
        border: 0,
        background: 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: 'fit-content',
        fontFamily: active ? FONT_MEDIUM : FONT,
        fontWeight: active ? 500 : 400,
        color: disabled ? '#FFFFFF66' : (active ? '#FFFFFF' : '#FFFFFF99'),
        fontSize: 14,
        lineHeight: '18px',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function NotificationCard({ item, onOpenDetail }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const isUnread = !!item.unread;

  return (
    <button
      type="button"
      className="flex shrink-0 items-start gap-[12px] self-stretch rounded-lg px-[12px] py-[8px] border-0 text-left cursor-pointer transition-colors"
      style={{
        backgroundColor: pressed
          ? '#FFFFFF14'
          : hovered
          ? (isUnread ? '#7AE5B90A' : '#FFFFFF0D')
          : (isUnread ? '#7AE5B905' : 'transparent'),
        borderLeft: '3px solid transparent',
        paddingLeft: '10px',
        transition: 'background-color 150ms, border-color 150ms',
      }}
      onClick={onOpenDetail}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      <div className="flex flex-col items-start gap-[4px] flex-1 min-w-0">
        <div className="flex items-center justify-between w-full min-w-0 gap-[12px]">
          <div className="flex items-center min-w-0 gap-[6px]">
            <div
              className="truncate text-sm leading-[18px]"
              style={{
                fontFamily: FONT_MEDIUM,
                fontWeight: 500,
                color: isUnread ? '#FFFFFF' : '#FFFFFFB3',
                transition: 'color 150ms',
              }}
            >
              {item.title}
            </div>
            {isUnread && (
              <span
                className="shrink-0 w-[5px] h-[5px] rounded-full"
                style={{ backgroundColor: '#7AE5B9' }}
                aria-label="未读"
              />
            )}
          </div>
          <time
            className="shrink-0 text-[12px] leading-[16px]"
            style={{ fontFamily: FONT, color: '#FFFFFF66' }}
          >
            {item.created_at}
          </time>
        </div>
        <div
          className="self-stretch text-sm leading-[20px]"
          style={{
            fontFamily: FONT,
            color: isUnread ? '#FFFFFF99' : '#FFFFFF4D',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            transition: 'color 150ms',
          }}
        >
          {item.content}
        </div>
      </div>
    </button>
  );
}

function NotificationEmptyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M44 7H4V37H11V42L21 37H44V7Z" fill="white" fillOpacity="0.1"/>
      <path d="M31 16V17" stroke="white" strokeOpacity="0.3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17 16V17" stroke="white" strokeOpacity="0.3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M31 25C31 25 29 28 24 28C19 28 17 25 17 25" stroke="white" strokeOpacity="0.3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function NotificationEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-[12px] flex-1">
      <NotificationEmptyIcon />
      <div className="font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[12px] leading-[16px] text-[#FFFFFF66]">
        暂无通知
      </div>
    </div>
  );
}

function NotificationDetailModal({ item, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-surface-overlay backdrop-blur-[20px]"
      onClick={onClose}
    >
      <div
        className="w-[400px] max-h-[80vh] flex flex-col rounded-large bg-surface-modal overflow-hidden"
        style={{ boxShadow: '0px 8px 32px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-[16px] justify-between py-[16px] bg-surface-modal rounded-t-large px-[24px]">
          <span className="flex-1 font-['AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] font-medium text-white text-base leading-[20px]">
            {item.title}
          </span>
          <button type="button" onClick={onClose} className="shrink-0 cursor-pointer border-0 bg-transparent p-0" aria-label="关闭">
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col items-start gap-[16px] py-[8px] bg-surface-modal px-[24px] overflow-y-auto flex-1">
          <div className="text-[14px] leading-[175%] self-stretch font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFFCC] break-words whitespace-pre-wrap">
            {item.content}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-[16px] justify-between bg-surface-modal py-[16px] px-[24px] rounded-b-large">
          <div className="flex flex-1 items-center">
            <div className="flex-1 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF66] text-xs leading-[16px]">
              {item.created_at}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex flex-col h-[36px] shrink-0 rounded-lg [box-shadow:#00000066_3px_3px_8px] [outline:1px_solid_#00000080] p-px cursor-pointer border-0"
              style={{ backgroundImage: 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)' }}
            >
              <div className="flex items-center grow shrink basis-[0%] rounded-[7px] px-[15px] gap-[4px] bg-btn-primary-bg-normal hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active">
                <span className="inline-block w-max shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-white text-sm leading-[18px]">
                  关闭
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotificationCenterModal({ open, onClose, showToast, userId, initialTab = 'creation' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [detailItem, setDetailItem] = useState(null);
  const readPending = useRef(new Set());
  const confirmedReads = useRef(new Set());
  const lifetime = useRef(0);
  const { notifications, setNotifications, loading, loadError, hasMore, loadNotifications, setSentinel } = useNotificationFeed({ open, userId, activeTab, confirmedReads });
  useEffect(() => {
    const generation = ++lifetime.current;
    confirmedReads.current.clear();
    readPending.current.clear();
    return () => { lifetime.current = generation + 1; };
  }, [userId, open]);

  useEffect(() => {
    const onRead = (event) => {
      if (event.detail?.userId !== userId) return;
      confirmedReads.current.add(`announcement:${event.detail.id}`);
      setNotifications((items) => mergeConfirmedReads(items, confirmedReads.current));
    };
    window.addEventListener('announcement:read', onRead);
    return () => window.removeEventListener('announcement:read', onRead);
  }, [userId, setNotifications]);

  const openDetail = async (item) => {
    setDetailItem(item);
    const key = notificationKey(item);
    const generation = lifetime.current;
    if (confirmedReads.current.has(key) || readPending.current.has(key) || !(item.unread ?? !item.is_read)) return;
    readPending.current.add(key);
    try {
      if (item.kind === 'announcement') await apiMarkAnnouncementRead(item.id);
      else await apiMarkNotificationRead(item.id);
      if (generation !== lifetime.current) return;
      confirmedReads.current.add(key);
      setNotifications((items) => mergeConfirmedReads(items, confirmedReads.current));
    } catch (error) {
      if (generation === lifetime.current) showToast?.(error.message || '标记已读失败，请重新打开重试', 'warning');
    } finally {
      if (generation === lifetime.current) readPending.current.delete(key);
    }
  };

  const handleTabClick = (tab) => {
    if (tab === 'team') {
      showToast?.('团队功能开发中，敬请期待！', 'warning');
      return;
    }
    if (tab === activeTab) return;
    setDetailItem(null);
    setNotifications([]);
    setActiveTab(tab);
  };

  if (!open || !userId) return null;

  return (
    <>
      {detailItem && (
        <NotificationDetailModal item={detailItem} onClose={() => setDetailItem(null)} />
      )}
      <div
        className="fixed inset-0 flex items-center justify-center bg-surface-overlay backdrop-blur-[20px] z-50"
        onClick={onClose}
      >
        <div
          className="w-[800px] h-[600px] flex flex-col rounded-large bg-surface-modal overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-[16px] justify-between py-[16px] bg-surface-modal rounded-t-large px-[24px]">
            <span className="flex-1 font-['AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] font-medium text-white text-base leading-[20px]">
              消息中心
            </span>
            <button onClick={onClose} className="cursor-pointer border-0 bg-transparent p-0" aria-label="关闭">
              <CloseIcon />
            </button>
          </div>

          {/* Tab 分页器 */}
          <div className="flex items-center gap-[24px] px-[24px] py-[12px] bg-surface-modal">
            <TabButton active={activeTab === 'creation'} onClick={() => handleTabClick('creation')}>
              创作日志
            </TabButton>
            <TabButton active={activeTab === 'system'} onClick={() => handleTabClick('system')}>
              系统通知
            </TabButton>
            <TabButton disabled onClick={() => handleTabClick('team')}>
              团队协作
            </TabButton>
          </div>

          {/* Body */}
          <div key={activeTab} className="flex flex-col gap-[8px] py-[8px] px-[24px] bg-surface-modal overflow-y-auto flex-1 min-h-0">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center flex-1">
                <span className="text-[#FFFFFF99] text-sm">加载中...</span>
              </div>
            ) : loadError && notifications.length === 0 ? (
              <button type="button" onClick={loadNotifications}>加载失败，点击重试</button>
            ) : notifications.length === 0 ? (
              <NotificationEmptyState />
            ) : (
              notifications.map((item) => (
                <NotificationCard
                  key={item.id}
                  item={item}
                  onOpenDetail={() => openDetail(item)}
                />
              ))
            )}
            {notifications.length > 0 && loading && <div role="status" className="shrink-0 py-[8px] text-center text-[12px] text-text-hint">加载中...</div>}
            {notifications.length > 0 && loadError && <button type="button" className="shrink-0 py-[8px] text-[12px] text-text-secondary" onClick={loadNotifications}>加载失败，点击重试</button>}
            {hasMore && <div ref={setSentinel} className="h-[1px] shrink-0" aria-hidden="true" />}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-[16px] py-[16px] px-[24px] rounded-b-large bg-surface-modal">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center h-[36px] shrink-0 rounded-medium px-[16px] gap-[4px] bg-btn-primary-bg-normal hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active border border-btn-primary-border [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0 [box-shadow:var(--color-shadow)_3px_3px_8px] cursor-pointer"
            >
              <span className="text-btn-primary-text text-font-size-14 font-font-weight-regular" style={{ fontFamily: FONT }}>
                关闭
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
