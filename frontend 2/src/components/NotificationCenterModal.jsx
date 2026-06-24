import { useState, useEffect } from 'react';
import { apiGetNotifications, apiMarkAllNotificationsRead } from '../api/user';

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
      className="flex items-start gap-[12px] self-stretch rounded-lg px-[12px] py-[8px] border-0 text-left cursor-pointer transition-colors"
      style={{
        backgroundColor: pressed
          ? '#FFFFFF14'
          : hovered
          ? (isUnread ? '#7AE5B90A' : '#FFFFFF0D')
          : (isUnread ? '#7AE5B905' : 'transparent'),
        borderLeft: isUnread ? '3px solid #7AE5B9' : '3px solid transparent',
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
        <div className="flex items-center gap-[6px] w-full min-w-0">
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
      <div
        className="shrink-0 text-xs leading-[16px]"
        style={{
          fontFamily: FONT,
          color: isUnread ? '#FFFFFF66' : '#FFFFFF33',
          transition: 'color 150ms',
        }}
      >
        {item.time}
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
              {item.time}
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

export default function NotificationCenterModal({ open, onClose, showToast }) {
  const [activeTab, setActiveTab] = useState('creation');
  const [notifications, setNotifications] = useState([]);
  const [detailItem, setDetailItem] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadNotifications();
  }, [open, activeTab]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      // type: 'creation_log' / 'system_notice' / 'team_collab'
      const typeMap = {
        creation: 'creation_log',
        system: 'system_notice',
        team: 'team_collab',
      };
      const data = await apiGetNotifications({ type: typeMap[activeTab] });
      setNotifications(data);
    } catch (error) {
      console.error('加载消息失败:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiMarkAllNotificationsRead();
      showToast?.('已全部标记为已读', 'success');
      loadNotifications();
    } catch (error) {
      console.error('一键已读失败:', error);
      showToast?.('操作失败', 'warning');
    }
  };

  const handleTabClick = (tab) => {
    if (tab === 'team') {
      showToast?.('团队功能开发中，敬请期待！', 'warning');
      return;
    }
    setActiveTab(tab);
  };

  if (!open) return null;

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
          <div className="flex flex-col gap-[8px] py-[8px] px-[24px] bg-surface-modal overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <span className="text-[#FFFFFF99] text-sm">加载中...</span>
              </div>
            ) : notifications.length === 0 ? (
              <NotificationEmptyState />
            ) : (
              notifications.map((item) => (
                <NotificationCard
                  key={item.id}
                  item={item}
                  onOpenDetail={() => setDetailItem(item)}
                />
              ))
            )}
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

            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex flex-col h-[36px] shrink-0 rounded-medium [box-shadow:var(--color-shadow)_3px_3px_8px] [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0 p-px cursor-pointer border-0"
              style={{ backgroundImage: 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)' }}
            >
              <div className="flex items-center grow shrink basis-[0%] rounded-[7px] px-[16px] gap-[4px] bg-btn-primary-bg-normal hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active">
                <span className="text-text-primary text-font-size-14 font-font-weight-regular" style={{ fontFamily: FONT }}>
                  一键已读
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
