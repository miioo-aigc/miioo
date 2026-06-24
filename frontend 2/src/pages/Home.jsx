import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PulsingBorder } from '@paper-design/shaders-react';
import { apiGetProjects, apiUpdateProject, apiDeleteProject, apiGetProject, apiGetProjectOverview } from '../api/project';
import { getToken, getRefreshToken, refreshAccessToken } from '../api/request';
import { clearTokens, apiLogout, apiCompleteWechatCallback } from '../api/auth';
import { apiListProviders } from '../api/config';
import { apiGetCurrentUser, apiGetNotifications } from '../api/user';
import { apiGetSubjects, apiGetSubjectsPage, apiGetEpisodes, apiGetScriptWorkspace, apiFinalizeScriptWorkspace, apiExtractSubjectsFromScript } from '../api/subject';
import { apiGetStoryboards, apiGenerateStoryboardsFromFinalScript, apiGetTask } from '../api/storyboard';
import { invalidate } from '../utils/cache';
import { normalizeImageUrl } from '../utils/imageUrl';
import { subscribe, peekCache } from '../utils/cache';
import { K, MEDIUM } from '../utils/cacheKeys';
import wechatQR from '../assets/wechat.jpg';
import PrimaryNav from '../components/PrimaryNav';
import LoginModal from '../components/LoginModal';
import ApiConfigModal from '../components/ApiConfigModal';
import NoModelNotice from '../components/NoModelNotice';
import AccountMenu from '../components/AccountMenu';
import ProfileModal from '../components/ProfileModal';
import NewProjectModal from '../components/NewProjectModal';
import WatermarkSettingsModal from '../components/WatermarkSettingsModal';
import NotificationCenterModal from '../components/NotificationCenterModal';
import ProjectList from './ProjectList';
import GlobalSettings from './GlobalSettings';
import SubjectPage from './SubjectPage';
import StoryboardPage from './StoryboardPage';
import DotsLoading from '../components/DotsLoading';
import AssetsPage from './AssetsPage';
import CreationPage from './CreationPage';
import bizQrCodeImg from '../assets/biz-qr-code.png';

const ICON_STYLE = { flexShrink: '0' };

const NAV_ITEMS = [
  {
    key: 'home',
    label: '首页',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={ICON_STYLE}>
        <path d="M3 6V14H13V6L8 2L3 6Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.333 9.667V14H9.667V9.667H6.333Z" stroke="#FFFFFF" strokeLinejoin="round" />
        <path d="M3 14H13" stroke="#FFFFFF" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'project',
    label: '项目',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={ICON_STYLE}>
        <path d="M1.667 3C1.667 2.632 1.965 2.333 2.333 2.333H6.333L8 4.333H13.666C14.035 4.333 14.333 4.632 14.333 5V13.667C14.333 14.035 14.035 14.333 13.666 14.333H2.333C1.965 14.333 1.667 14.035 1.667 13.667V3Z" stroke="#FFFFFF" strokeLinejoin="round" />
        <path d="M5.983 9.333H9.983" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'create',
    label: '创作',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={ICON_STYLE}>
        <g clipPath="url(#clip0_1037_281)">
          <path d="M5.86347 1.33264L9.56947 4.62603L13.7004 2.20108L11.6275 6.68533L15.3335 9.97995L10.3922 9.56735L8.5392 13.6859L7.51017 9.15599L2.56885 8.74462L6.89621 6.12943L5.86347 1.33264Z" stroke="white" strokeWidth="1.23533" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M1.3335 15.3413L7.51015 9.15601" stroke="white" strokeWidth="1.23533" strokeLinecap="round" />
        </g>
        <defs>
          <clipPath id="clip0_1037_281">
            <rect width="16" height="16" fill="white" />
          </clipPath>
        </defs>
      </svg>
    ),
  },
  {
    key: 'assets',
    label: '资产',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={ICON_STYLE}>
        <path d="M1.667 2.667C1.667 2.298 1.965 2 2.333 2H6.333L8 4H13.667C14.035 4 14.333 4.298 14.333 4.667V13.333C14.333 13.701 14.035 14 13.667 14H2.333C1.965 14 1.667 13.701 1.667 13.333V2.667Z" stroke="#FFFFFF" strokeLinejoin="round" />
        <path d="M8 6.667L8.748 8.304L10.536 8.509L9.21 9.726L9.567 11.491L8 10.605L6.433 11.491L6.79 9.726L5.464 8.509L7.252 8.304L8 6.667Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function MenuPopupItem({ label, onClick, showExternalIcon = false }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      className="flex items-center w-full rounded-[6px] border-0 bg-transparent text-left cursor-pointer"
      style={{
        padding: '8px 12px',
        gap: '4px',
        justifyContent: showExternalIcon ? 'space-between' : 'flex-start',
        backgroundColor: pressed ? '#FFFFFF14' : hovered ? '#FFFFFF0D' : 'transparent',
        transition: 'background-color 120ms ease, color 120ms ease',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      <div
        className="w-fit shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif]"
        style={{ fontSize: '14px', lineHeight: '18px', color: pressed || hovered ? '#FFFFFF' : '#FFFFFFCC' }}
      >
        {label}
      </div>
      {showExternalIcon && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <path d="M4.5 11.5L11.5 4.5" stroke="#FFFFFF80" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 4.5H11.5V9" stroke="#FFFFFF80" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

const COMMUNITY_QR_CODE_URL = wechatQR;
const BIZ_QR_CODE_URL = bizQrCodeImg;

const CREATION_MANUAL_URL = 'https://gcn0je6sgrhe.feishu.cn/wiki/QaKLwOx0ii2qWakn4cXcybbMnrf?from=from_copylink';

function QRCodePopup({ anchorLeft }) {
  return (
    <div className="qr-popup" style={{ left: anchorLeft ?? 40, bottom: 24, translate: '0 -50%' }} role="dialog" aria-label="官方社群二维码">
      <div className="qr-popup-code" style={{ backgroundImage: `url(${COMMUNITY_QR_CODE_URL})` }} />
      <div className="qr-popup-caption font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif]">
        扫码加入用户交流群
      </div>
    </div>
  );
}

function MoreOptionsMenu({ close, setWatermarkSettingsOpen }) {
  const [bizQrVisible, setBizQrVisible] = useState(false);
  const bizItemRef = useRef(null);
  const containerRef = useRef(null);

  const handleMenuClick = (label) => {
    if (label === '创作手册') {
      window.open(CREATION_MANUAL_URL, '_blank');
    } else if (label === '更新日志') {
      // 链接待补充
    } else if (label === '开源社区') {
      window.open('https://github.com/wangchengxv/miioo', '_blank');
    } else if (label === '用户协议') {
      window.open('https://gcn0je6sgrhe.feishu.cn/wiki/FIspwGURtikxiwk28svc4thOn9c?from=from_copylink', '_blank');
    } else if (label === '隐私政策') {
      window.open('https://gcn0je6sgrhe.feishu.cn/wiki/LKlewdQJ0iaYVmkOPXVc4PWgnoc?from=from_copylink', '_blank');
    } else if (label === '商务合作') {
      setBizQrVisible((v) => !v);
    } else if (label === 'AI生成水印设置') {
      close();
      setWatermarkSettingsOpen(true);
    }
  };

  const getBizQrTop = () => {
    if (!bizItemRef.current || !containerRef.current) return 0;
    const itemTop = bizItemRef.current.offsetTop;
    const popupHeight = 177;
    const containerRect = containerRef.current.getBoundingClientRect();
    const maxTop = window.innerHeight - 24 - popupHeight - containerRect.top;
    return Math.min(itemTop, maxTop);
  };

  const FONT = "'AlibabaPuHuiTi_2_55_Regular', 'Alibaba PuHuiTi 2.0', system-ui, sans-serif";

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: '40px',
        bottom: '0',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        width: '150px',
        borderRadius: '8px',
        boxShadow: '#00000066 0px 4px 16px',
        backgroundColor: '#161616',
        border: '1px solid #FFFFFF0D',
        padding: '4px',
      }}
    >
      {/* 外链类：创作手册、更新日志、开源社区 */}
      {['创作手册', '更新日志', '开源社区'].map((label) => (
        <MenuPopupItem key={label} label={label} showExternalIcon onClick={() => handleMenuClick(label)} />
      ))}

      {/* 内页类：用户协议、隐私政策、商务合作 */}
      {['用户协议', '隐私政策'].map((label) => (
        <MenuPopupItem key={label} label={label} onClick={() => handleMenuClick(label)} />
      ))}
      <div ref={bizItemRef} style={{ width: '100%' }}>
        <MenuPopupItem label="商务合作" onClick={() => handleMenuClick('商务合作')} />
      </div>

      {/* AI生成水印设置 */}
      <MenuPopupItem label="AI生成水印设置" onClick={() => handleMenuClick('AI生成水印设置')} />

      {/* 备案信息 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '4px',
          padding: '8px 12px',
          borderRadius: '6px',
        }}
      >
        <span style={{ fontFamily: FONT, fontSize: '10px', lineHeight: '12px', color: '#FFFFFF80' }}>
          ©2026 Miioo AI
        </span>
        <span style={{ fontFamily: FONT, fontSize: '10px', lineHeight: '12px', color: '#FFFFFF80' }}>
          济南三脚猫科技有限公司
        </span>
        <span style={{ fontFamily: FONT, fontSize: '10px', lineHeight: '12px', color: '#FFFFFF80' }}>
          鲁ICP备2026030778号
        </span>
      </div>

      {/* 商务合作二维码浮层 */}
      {bizQrVisible && (
        <div
          style={{
            position: 'absolute',
            left: 'calc(100% + 8px)',
            top: getBizQrTop(),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '9px',
            borderRadius: '8px',
            boxShadow: '#00000066 0px 4px 16px',
            backgroundColor: '#161616',
            border: '1px solid #FFFFFF14',
            padding: '16px',
            zIndex: 60,
          }}
        >
          <div
            style={{
              width: '120px',
              height: '120px',
              backgroundImage: `url(${BIZ_QR_CODE_URL})`,
              backgroundSize: 'cover',
              backgroundPosition: '50%',
              flexShrink: 0,
            }}
          />
          <div style={{ fontFamily: FONT, color: '#FFFFFFCC', fontSize: '12px', lineHeight: '16px' }}>
            扫码添加客服
          </div>
        </div>
      )}
    </div>
  );
}

const BOTTOM_NAV_ITEMS = [
  {
    key: 'apps',
    label: '应用',
    tooltip: '官方社群',
    popup: ({ anchorLeft }) => <QRCodePopup anchorLeft={anchorLeft} />,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={ICON_STYLE}>
        <path d="M14 2H10.667V5.333H14V2Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 10.667H10.667V14H14V10.667Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.333 10.667H2V14H5.333V10.667Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.333 2H2V5.333H5.333V2Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.667 8H10" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.667 8H13.334" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 12.333V13" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 5.667V10.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 2.667V3.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'notifications',
    label: '通知',
    tooltip: '消息中心',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={ICON_STYLE}>
        <path d="M3.8 12.2H3.3V12.7H3.8V12.2ZM12.2 12.2V12.7H12.7V12.2H12.2ZM2 11.7C1.724 11.7 1.5 11.924 1.5 12.2C1.5 12.476 1.724 12.7 2 12.7V12.2V11.7ZM14 12.7C14.276 12.7 14.5 12.476 14.5 12.2C14.5 11.924 14.276 11.7 14 11.7V12.2V12.7ZM9.5 12.2H10C10 11.924 9.776 11.7 9.5 11.7V12.2ZM6.5 12.2V11.7C6.224 11.7 6 11.924 6 12.2H6.5ZM8 2V1.5C5.404 1.5 3.3 3.604 3.3 6.2H3.8H4.3C4.3 4.157 5.957 2.5 8 2.5V2ZM3.8 6.2H3.3V12.2H3.8H4.3V6.2H3.8ZM3.8 12.2V12.7H12.2V12.2V11.7H3.8V12.2ZM12.2 12.2H12.7V6.2H12.2H11.7V12.2H12.2ZM12.2 6.2H12.7C12.7 3.604 10.596 1.5 8 1.5V2V2.5C10.043 2.5 11.7 4.157 11.7 6.2H12.2ZM2 12.2V12.7H14V12.2V11.7H2V12.2ZM8 14V14.5C9.105 14.5 10 13.605 10 12.5H9.5H9C9 13.052 8.552 13.5 8 13.5V14ZM9.5 12.5H10V12.2H9.5H9V12.5H9.5ZM9.5 12.2V11.7H6.5V12.2V12.7H9.5V12.2ZM6.5 12.2H6V12.5H6.5H7V12.2H6.5ZM6.5 12.5H6C6 13.605 6.895 14.5 8 14.5V14V13.5C7.448 13.5 7 13.052 7 12.5H6.5Z" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    key: 'api',
    label: 'API',
    tooltip: '配置API',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={ICON_STYLE}>
        <rect x="2" y="2" width="12" height="12" rx="2" stroke="#FFFFFF" />
        <path d="M4.98 6.364L4.452 8.248C4.448 8.26 4.45 8.272 4.458 8.284C4.466 8.296 4.476 8.302 4.488 8.302H5.484C5.496 8.302 5.506 8.296 5.514 8.284C5.522 8.272 5.524 8.26 5.52 8.248L4.992 6.364C4.992 6.36 4.99 6.358 4.986 6.358C4.982 6.358 4.98 6.36 4.98 6.364ZM3.426 10C3.342 10 3.276 9.966 3.228 9.898C3.18 9.83 3.17 9.756 3.198 9.676L4.44 5.944C4.476 5.848 4.534 5.77 4.614 5.71C4.698 5.65 4.79 5.62 4.89 5.62H5.106C5.21 5.62 5.302 5.65 5.382 5.71C5.466 5.77 5.524 5.848 5.556 5.944L6.798 9.676C6.826 9.756 6.816 9.83 6.768 9.898C6.72 9.966 6.654 10 6.57 10H6.354C6.258 10 6.168 9.97 6.084 9.91C6.004 9.846 5.95 9.766 5.922 9.67L5.73 8.992C5.726 8.96 5.704 8.944 5.664 8.944H4.308C4.272 8.944 4.25 8.96 4.242 8.992L4.05 9.67C4.026 9.766 3.972 9.846 3.888 9.91C3.808 9.97 3.718 10 3.618 10H3.426ZM8.222 6.304V7.75C8.222 7.778 8.238 7.796 8.27 7.804C8.422 7.824 8.57 7.834 8.714 7.834C9.038 7.834 9.284 7.764 9.452 7.624C9.624 7.48 9.71 7.276 9.71 7.012C9.71 6.48 9.378 6.214 8.714 6.214C8.57 6.214 8.422 6.224 8.27 6.244C8.238 6.252 8.222 6.272 8.222 6.304ZM7.73 10C7.638 10 7.558 9.966 7.49 9.898C7.426 9.83 7.394 9.75 7.394 9.658V5.992C7.394 5.896 7.426 5.81 7.49 5.734C7.554 5.658 7.634 5.616 7.73 5.608C8.07 5.576 8.398 5.56 8.714 5.56C9.314 5.56 9.764 5.68 10.064 5.92C10.364 6.156 10.514 6.5 10.514 6.952C10.514 7.452 10.368 7.83 10.076 8.086C9.788 8.342 9.36 8.47 8.792 8.47C8.66 8.47 8.486 8.462 8.27 8.446C8.238 8.446 8.222 8.462 8.222 8.494V9.658C8.222 9.75 8.188 9.83 8.12 9.898C8.052 9.966 7.972 10 7.88 10H7.73ZM11.623 10C11.531 10 11.451 9.966 11.383 9.898C11.316 9.83 11.281 9.75 11.281 9.658V5.962C11.281 5.87 11.316 5.79 11.383 5.722C11.451 5.654 11.531 5.62 11.623 5.62H11.864C11.956 5.62 12.036 5.654 12.104 5.722C12.171 5.79 12.206 5.87 12.206 5.962V9.658C12.206 9.75 12.171 9.83 12.104 9.898C12.036 9.966 11.956 10 11.864 10H11.623Z" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    key: 'menu',
    label: '菜单',
    tooltip: '更多选项',
    popup: null, // 将在组件内部动态注入
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={ICON_STYLE}>
        <path d="M2.65 3.983H13.317" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.65 7.983H13.317" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.65 11.983H13.317" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];



const CMB_ICON_DEFAULT = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
    <path d="M3.33329 14.6667H12.6666C13.0348 14.6667 13.3333 14.3682 13.3333 14V4.66671H9.99996V1.33337H3.33329C2.9651 1.33337 2.66663 1.63185 2.66663 2.00004V14C2.66663 14.3682 2.9651 14.6667 3.33329 14.6667Z" fill="#2DC3E1" stroke="#2DC3E1" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 1.33337L13.3333 4.66671" stroke="#2DC3E1" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8.67439 7.93831C8.72969 7.77042 8.75735 7.68696 8.80278 7.67166C8.82264 7.66496 8.84415 7.66496 8.86401 7.67166C8.90944 7.68696 8.9371 7.77042 8.9924 7.93831C9.22252 8.63952 9.33807 8.99012 9.55534 9.26763C9.65558 9.39553 9.77113 9.51108 9.89903 9.61132C10.1765 9.8286 10.5271 9.94414 11.2284 10.1743C11.3962 10.2296 11.4797 10.2572 11.495 10.3026C11.5017 10.3225 11.5017 10.344 11.495 10.3639C11.4797 10.4093 11.3962 10.437 11.2284 10.4923C10.5271 10.7224 10.1765 10.8379 9.89903 11.0552C9.77064 11.1554 9.65559 11.271 9.55534 11.3989C9.33806 11.6769 9.22252 12.0275 8.9924 12.7282C8.9371 12.8961 8.90945 12.9796 8.86401 12.9949C8.84415 13.0015 8.82265 13.0015 8.80278 12.9949C8.75735 12.9796 8.72969 12.8961 8.67439 12.7282C8.44428 12.027 8.32872 11.6764 8.11146 11.3989C8.01117 11.271 7.89576 11.1558 7.76776 11.0557C7.48975 10.8379 7.13915 10.7224 6.43795 10.4918C6.27055 10.437 6.1871 10.4093 6.1713 10.3634C6.16475 10.3437 6.16475 10.3224 6.1713 10.3026C6.1871 10.2572 6.27055 10.2296 6.43795 10.1743C7.13915 9.94414 7.48976 9.82859 7.76776 9.61132C7.89566 9.51109 8.01072 9.39553 8.11095 9.26763C8.32823 8.98962 8.44428 8.63952 8.67439 7.93831ZM5.17233 6.51418C5.20887 6.40258 5.22714 6.34678 5.25775 6.33641C5.2709 6.33204 5.2851 6.33204 5.29824 6.33641C5.32886 6.34678 5.34713 6.40258 5.38367 6.51418C5.53724 6.98181 5.61427 7.21538 5.75896 7.40055C5.82612 7.48598 5.90315 7.56302 5.98859 7.62968C6.17377 7.77486 6.40733 7.85189 6.87447 8.00497C6.98607 8.04201 7.04236 8.06028 7.05224 8.0909C7.05661 8.10404 7.05661 8.11824 7.05224 8.13139C7.04236 8.162 6.98656 8.18027 6.87447 8.21681C6.40733 8.37088 6.17326 8.44742 5.98859 8.59211C5.90322 8.65911 5.82628 8.73621 5.75946 8.82173C5.61428 9.00691 5.53725 9.24047 5.38417 9.7081C5.34713 9.8197 5.32886 9.8755 5.29824 9.88587C5.2851 9.89024 5.2709 9.89024 5.25775 9.88587C5.22714 9.8755 5.20887 9.8197 5.17233 9.7081C5.01826 9.24047 4.94172 9.0069 4.79654 8.82173C4.72969 8.73639 4.65276 8.65945 4.56742 8.59261C4.38224 8.44743 4.14868 8.3704 3.68104 8.21731C3.56944 8.18027 3.51365 8.16201 3.50328 8.13139C3.49891 8.11824 3.49891 8.10404 3.50328 8.0909C3.51365 8.06028 3.56944 8.04201 3.68104 8.00547C4.14868 7.8514 4.38225 7.77487 4.56742 7.62968C4.65284 7.56302 4.72988 7.48599 4.79654 7.40056C4.94172 7.21538 5.01875 6.98182 5.17184 6.51419L5.17233 6.51418ZM7.65616 5.11325C7.67937 5.04363 7.69073 5.00856 7.70949 5.00214C7.71781 4.99929 7.72685 4.99929 7.73517 5.00214C7.75393 5.00856 7.76578 5.04363 7.7885 5.11325C7.88479 5.40558 7.93269 5.55126 8.02355 5.6673C8.06503 5.72063 8.11292 5.76853 8.16675 5.81051C8.2823 5.90087 8.42847 5.94877 8.72031 6.04506C8.78993 6.06827 8.825 6.07963 8.83142 6.09839C8.83424 6.10672 8.83424 6.11574 8.83142 6.12407C8.825 6.14283 8.78993 6.15419 8.72031 6.1774C8.42847 6.27369 8.2823 6.32159 8.16626 6.41196C8.11293 6.45375 8.06485 6.50183 8.02305 6.55516C7.93269 6.67121 7.88479 6.81688 7.7885 7.10921C7.76578 7.17883 7.75393 7.2139 7.73517 7.22032C7.72685 7.22318 7.71781 7.22318 7.70949 7.22032C7.69073 7.2139 7.67937 7.17883 7.65616 7.10921C7.56037 6.81688 7.51197 6.67121 7.42161 6.55516C7.37982 6.50182 7.33174 6.45374 7.2784 6.41196C7.16285 6.32159 7.01668 6.27369 6.72435 6.1774C6.65473 6.15419 6.61966 6.14283 6.61324 6.12407C6.61042 6.11574 6.61042 6.10672 6.61324 6.09839C6.61966 6.07963 6.65473 6.06827 6.72435 6.04506C7.01668 5.94927 7.16285 5.90087 7.2784 5.81051C7.33174 5.76873 7.37982 5.72064 7.42161 5.6673C7.51197 5.55126 7.55987 5.40558 7.65616 5.11325Z" fill="white"/>
  </svg>
);

const CMB_ICON_HOVER = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
    <defs>
      <linearGradient id="cmb-h0" x1="8" y1="0.833" x2="8" y2="15.166" gradientUnits="userSpaceOnUse"><stop stopColor="#7AE5B9"/><stop offset="1" stopColor="#2DC3E1"/></linearGradient>
      <linearGradient id="cmb-h1" x1="8" y1="0.833" x2="8" y2="15.166" gradientUnits="userSpaceOnUse"><stop stopColor="#7AE5B9"/><stop offset="1" stopColor="#2DC3E1"/></linearGradient>
      <linearGradient id="cmb-h2" x1="8" y1="1.333" x2="8" y2="14.667" gradientUnits="userSpaceOnUse"><stop stopColor="#7AE5B9"/><stop offset="1" stopColor="#2DC3E1"/></linearGradient>
      <linearGradient id="cmb-h3" x1="8" y1="0.833" x2="8" y2="15.166" gradientUnits="userSpaceOnUse"><stop stopColor="#7AE5B9"/><stop offset="1" stopColor="#2DC3E1"/></linearGradient>
      <linearGradient id="cmb-h4" x1="8" y1="1.333" x2="8" y2="14.667" gradientUnits="userSpaceOnUse"><stop stopColor="#7AE5B9"/><stop offset="1" stopColor="#2DC3E1"/></linearGradient>
    </defs>
    <path d="M9.64644 0.979858C9.84171 0.784596 10.1582 0.784596 10.3535 0.979858L13.6865 4.31287C13.8817 4.50813 13.8817 4.82464 13.6865 5.0199C13.4912 5.21516 13.1747 5.21516 12.9795 5.0199L9.64644 1.68689C9.45118 1.49163 9.45118 1.17512 9.64644 0.979858Z" fill="url(#cmb-h0)"/>
    <path d="M3.33329 14.6667H12.6666C13.0348 14.6667 13.3333 14.3682 13.3333 14V4.66671H9.99996V1.33337H3.33329C2.9651 1.33337 2.66663 1.63185 2.66663 2.00004V14C2.66663 14.3682 2.9651 14.6667 3.33329 14.6667Z" fill="url(#cmb-h1)"/>
    <path d="M3.33329 14.6667H12.6666C13.0348 14.6667 13.3333 14.3682 13.3333 14V4.66671H9.99996V1.33337H3.33329C2.9651 1.33337 2.66663 1.63185 2.66663 2.00004V14C2.66663 14.3682 2.9651 14.6667 3.33329 14.6667Z" fill="url(#cmb-h2)"/>
    <path d="M2.16663 14.0004V2.00037C2.16663 1.35603 2.68929 0.833374 3.33362 0.833374H9.99963C10.2758 0.833374 10.4996 1.05723 10.4996 1.33337V4.16638H13.3336C13.6095 4.16656 13.8334 4.3905 13.8336 4.66638V14.0004C13.8334 14.6446 13.3109 15.1664 12.6666 15.1664H3.33362C2.6894 15.1664 2.1668 14.6446 2.16663 14.0004ZM3.16663 14.0004C3.1668 14.0923 3.24167 14.1664 3.33362 14.1664H12.6666C12.7586 14.1664 12.8334 14.0923 12.8336 14.0004V5.16638H9.99963C9.72364 5.16621 9.49963 4.94242 9.49963 4.66638V1.83337H3.33362C3.24157 1.83337 3.16663 1.90832 3.16663 2.00037V14.0004Z" fill="url(#cmb-h3)"/>
    <path d="M2.16663 14.0004V2.00037C2.16663 1.35603 2.68929 0.833374 3.33362 0.833374H9.99963C10.2758 0.833374 10.4996 1.05723 10.4996 1.33337V4.16638H13.3336C13.6095 4.16656 13.8334 4.3905 13.8336 4.66638V14.0004C13.8334 14.6446 13.3109 15.1664 12.6666 15.1664H3.33362C2.6894 15.1664 2.1668 14.6446 2.16663 14.0004ZM3.16663 14.0004C3.1668 14.0923 3.24167 14.1664 3.33362 14.1664H12.6666C12.7586 14.1664 12.8334 14.0923 12.8336 14.0004V5.16638H9.99963C9.72364 5.16621 9.49963 4.94242 9.49963 4.66638V1.83337H3.33362C3.24157 1.83337 3.16663 1.90832 3.16663 2.00037V14.0004Z" fill="url(#cmb-h4)"/>
    <path d="M8.67439 7.93831C8.72969 7.77042 8.75735 7.68696 8.80278 7.67166C8.82264 7.66496 8.84415 7.66496 8.86401 7.67166C8.90944 7.68696 8.9371 7.77042 8.9924 7.93831C9.22252 8.63952 9.33807 8.99012 9.55534 9.26763C9.65558 9.39553 9.77113 9.51108 9.89903 9.61132C10.1765 9.8286 10.5271 9.94414 11.2284 10.1743C11.3962 10.2296 11.4797 10.2572 11.495 10.3026C11.5017 10.3225 11.5017 10.344 11.495 10.3639C11.4797 10.4093 11.3962 10.437 11.2284 10.4923C10.5271 10.7224 10.1765 10.8379 9.89903 11.0552C9.77064 11.1554 9.65559 11.271 9.55534 11.3989C9.33806 11.6769 9.22252 12.0275 8.9924 12.7282C8.9371 12.8961 8.90945 12.9796 8.86401 12.9949C8.84415 13.0015 8.82265 13.0015 8.80278 12.9949C8.75735 12.9796 8.72969 12.8961 8.67439 12.7282C8.44428 12.027 8.32872 11.6764 8.11146 11.3989C8.01117 11.271 7.89576 11.1558 7.76776 11.0557C7.48975 10.8379 7.13915 10.7224 6.43795 10.4918C6.27055 10.437 6.1871 10.4093 6.1713 10.3634C6.16475 10.3437 6.16475 10.3224 6.1713 10.3026C6.1871 10.2572 6.27055 10.2296 6.43795 10.1743C7.13915 9.94414 7.48976 9.82859 7.76776 9.61132C7.89566 9.51109 8.01072 9.39553 8.11095 9.26763C8.32823 8.98962 8.44428 8.63952 8.67439 7.93831ZM5.17233 6.51418C5.20887 6.40258 5.22714 6.34678 5.25775 6.33641C5.2709 6.33204 5.2851 6.33204 5.29824 6.33641C5.32886 6.34678 5.34713 6.40258 5.38367 6.51418C5.53724 6.98181 5.61427 7.21538 5.75896 7.40055C5.82612 7.48598 5.90315 7.56302 5.98859 7.62968C6.17377 7.77486 6.40733 7.85189 6.87447 8.00497C6.98607 8.04201 7.04236 8.06028 7.05224 8.0909C7.05661 8.10404 7.05661 8.11824 7.05224 8.13139C7.04236 8.162 6.98656 8.18027 6.87447 8.21681C6.40733 8.37088 6.17326 8.44742 5.98859 8.59211C5.90322 8.65911 5.82628 8.73621 5.75946 8.82173C5.61428 9.00691 5.53725 9.24047 5.38417 9.7081C5.34713 9.8197 5.32886 9.8755 5.29824 9.88587C5.2851 9.89024 5.2709 9.89024 5.25775 9.88587C5.22714 9.8755 5.20887 9.8197 5.17233 9.7081C5.01826 9.24047 4.94172 9.0069 4.79654 8.82173C4.72969 8.73639 4.65276 8.65945 4.56742 8.59261C4.38224 8.44743 4.14868 8.3704 3.68104 8.21731C3.56944 8.18027 3.51365 8.16201 3.50328 8.13139C3.49891 8.11824 3.49891 8.10404 3.50328 8.0909C3.51365 8.06028 3.56944 8.04201 3.68104 8.00547C4.14868 7.8514 4.38225 7.77487 4.56742 7.62968C4.65284 7.56302 4.72988 7.48599 4.79654 7.40056C4.94172 7.21538 5.01875 6.98182 5.17184 6.51419L5.17233 6.51418ZM7.65616 5.11325C7.67937 5.04363 7.69073 5.00856 7.70949 5.00214C7.71781 4.99929 7.72685 4.99929 7.73517 5.00214C7.75393 5.00856 7.76578 5.04363 7.7885 5.11325C7.88479 5.40558 7.93269 5.55126 8.02355 5.6673C8.06503 5.72063 8.11292 5.76853 8.16675 5.81051C8.2823 5.90087 8.42847 5.94877 8.72031 6.04506C8.78993 6.06827 8.825 6.07963 8.83142 6.09839C8.83424 6.10672 8.83424 6.11574 8.83142 6.12407C8.825 6.14283 8.78993 6.15419 8.72031 6.1774C8.42847 6.27369 8.2823 6.32159 8.16626 6.41196C8.11293 6.45375 8.06485 6.50183 8.02305 6.55516C7.93269 6.67121 7.88479 6.81688 7.7885 7.10921C7.76578 7.17883 7.75393 7.2139 7.73517 7.22032C7.72685 7.22318 7.71781 7.22318 7.70949 7.22032C7.69073 7.2139 7.67937 7.17883 7.65616 7.10921C7.56037 6.81688 7.51197 6.67121 7.42161 6.55516C7.37982 6.50182 7.33174 6.45374 7.2784 6.41196C7.16285 6.32159 7.01668 6.27369 6.72435 6.1774C6.65473 6.15419 6.61966 6.14283 6.61324 6.12407C6.61042 6.11574 6.61042 6.10672 6.61324 6.09839C6.61966 6.07963 6.65473 6.06827 6.72435 6.04506C7.01668 5.94927 7.16285 5.90087 7.2784 5.81051C7.33174 5.76873 7.37982 5.72064 7.42161 5.6673C7.51197 5.55126 7.55987 5.40558 7.65616 5.11325Z" fill="white"/>
  </svg>
);

function CreationManualButton() {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const showDefault = !hovered || pressed;

  return (
    <button
      type="button"
      className="flex items-center rounded-[7px] gap-1 h-9 py-0 bg-transparent border-0 cursor-pointer"
      onClick={() => { if (CREATION_MANUAL_URL) window.open(CREATION_MANUAL_URL, '_blank'); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      {showDefault ? CMB_ICON_DEFAULT : CMB_ICON_HOVER}
      {showDefault ? (
        <div className="inline-block w-max shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#2DC3E1] text-sm/4.5">
          创作手册
        </div>
      ) : (
        <div className="inline-block w-max shrink-0 font-['AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] font-medium text-transparent bg-clip-text text-sm/4.5" style={{ backgroundImage: 'linear-gradient(in oklab 180deg, oklab(84.6% -0.114 0.031) 0%, oklab(75.5% -0.102 -0.072) 100%)' }}>
          创作手册
        </div>
      )}
    </button>
  );
}

function LoginButton({ onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      className="flex flex-col h-[36px] shrink-0 rounded-full p-px relative overflow-hidden cursor-pointer border-0 bg-transparent"
      style={{
        boxShadow: pressed ? 'none' : '#00000066 3px 3px 8px',
        transition: 'box-shadow 120ms ease',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      {/* outer gradient layers */}
      <span className="absolute inset-0 rounded-full" style={{ backgroundImage: 'linear-gradient(in oklab 148.76deg, oklab(100% 0 0 / 70%) 3.64%, oklab(56.7% 0 0 / 30%) 42.81%)', opacity: pressed ? 0 : hovered ? 0 : 1, transition: 'opacity 150ms ease' }} />
      <span className="absolute inset-0 rounded-full" style={{ backgroundImage: 'linear-gradient(in oklab 183.38deg, oklab(100% 0 0 / 90%) -10.72%, oklab(56.7% 0 0 / 30%) 41.97%)', opacity: hovered && !pressed ? 1 : 0, transition: 'opacity 150ms ease' }} />
      <span className="absolute inset-0 rounded-full" style={{ backgroundImage: 'linear-gradient(in oklab 228.51deg, oklab(100% 0 0 / 40%) 11.17%, oklab(56.7% 0 0 / 30%) 45.43%)', opacity: pressed ? 1 : 0, transition: 'opacity 150ms ease' }} />

      {/* inner fill */}
      <div className="flex items-center grow shrink basis-[0%] rounded-full px-20 gap-4 self-stretch relative overflow-hidden">
        <span className="absolute inset-0 rounded-full" style={{ backgroundImage: 'linear-gradient(in oklab 180deg, oklab(23.1% 0 0) 0%, oklab(0% 0 0) 100%)', opacity: pressed ? 0 : hovered ? 0 : 1, transition: 'opacity 150ms ease' }} />
        <span className="absolute inset-0 rounded-full" style={{ backgroundImage: 'linear-gradient(in oklab 183.84deg, oklab(38% 0 0) 5.46%, oklab(0% 0 0) 108.34%)', opacity: hovered && !pressed ? 1 : 0, transition: 'opacity 150ms ease' }} />
        <span className="absolute inset-0 rounded-full" style={{ backgroundImage: 'linear-gradient(in oklab 183.84deg, oklab(9.1% 0 0) 5.46%, oklab(0% 0 0) 108.34%)', opacity: pressed ? 1 : 0, transition: 'opacity 150ms ease' }} />
        <span className="inline-block w-max shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-white text-sm/4.5 relative">登录</span>
      </div>
    </button>
  );
}

const SECONDARY_TEXT = 'rgba(255, 255, 255, 0.60)';

// ── HomeSloganText: soft-blur-in per-character (animate-text / soft-blur-in) ──
const SLOGAN_LINES = ['无订阅费用', '一键配置API，开启漫剧创作之旅'];
const SOFT_BLUR_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const SOFT_BLUR_DURATION = 900;
const SOFT_BLUR_STAGGER = 25;
const SOFT_BLUR_LINE_DELAY = 400;

function HomeSloganText() {
  const ref0 = useRef(null);
  const ref1 = useRef(null);

  useEffect(() => {
    const refs = [ref0, ref1];
    refs.forEach((ref, lineIdx) => {
      const container = ref.current;
      if (!container) return;
      const units = Array.from(container.querySelectorAll('[data-char]'));
      const lineStart = lineIdx * SOFT_BLUR_LINE_DELAY;
      units.forEach((span, i) => {
        span.animate(
          [
            { opacity: 0, transform: 'translateY(16px)', filter: 'blur(12px)' },
            { opacity: 1, transform: 'translateY(0px)',  filter: 'blur(0px)'  },
          ],
          {
            duration: SOFT_BLUR_DURATION,
            delay: lineStart + i * SOFT_BLUR_STAGGER,
            easing: SOFT_BLUR_EASING,
            fill: 'both',
          }
        );
      });
    });
  }, []);

  const outerCharStyle = {
    display: 'inline-block',
    willChange: 'transform, opacity, filter',
  };

  const lineStyles = [
    {
      // 第一行
      opacity: 0.7,
      fontFamily: '"Source Sans 3",system-ui,sans-serif',
      fontWeight: 200,
      fontSize: '52px',
      lineHeight: '64px',
      whiteSpace: 'nowrap',
    },
    {
      // 第二行
      opacity: 0.7,
      fontFamily: '"Source Sans 3",system-ui,sans-serif',
      fontWeight: 200,
      fontSize: '52px',
      lineHeight: '64px',
      whiteSpace: 'nowrap',
    },
  ];

  const innerCharStyles = [
    {
      display: 'inline-block',
      backgroundImage: 'linear-gradient(in oklab 180deg, oklab(100% 0 0) 50%, oklab(70.1% 0.003 -0.043 / 10%) 115.99%)',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      WebkitTextStroke: '1px #FFFFFF80',
    },
    {
      display: 'inline-block',
      backgroundImage: 'linear-gradient(in oklab 180deg, oklab(100% 0 0) 50%, oklab(70.1% 0.003 -0.043 / 20%) 115.99%)',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      WebkitTextStroke: '1px #FFFFFF80',
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        top: '33.333%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        pointerEvents: 'none',
        zIndex: 1,
        whiteSpace: 'nowrap',
        overflow: 'visible',
      }}
    >
      <div ref={ref0} style={lineStyles[0]}>
        {Array.from(SLOGAN_LINES[0]).map((char, i) => (
          <span key={i} data-char style={outerCharStyle}>
            <span style={innerCharStyles[0]}>{char}</span>
          </span>
        ))}
      </div>
      <div ref={ref1} style={{ ...lineStyles[1], marginLeft: '-38px' }}>
        {Array.from(SLOGAN_LINES[1]).map((char, i) => (
          <span key={i} data-char style={outerCharStyle}>
            <span style={innerCharStyles[1]}>{char}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function StartCreationButton({ onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const scale = pressed ? 1 : hovered ? 1.035 : 1;
  const contentColor = pressed ? SECONDARY_TEXT : '#FFFFFF';

  return (
    <div
      className="bottom-[80px] fixed w-[200px] h-[52px]"
      style={{
        left: '50vw',
        transform: `translateX(-50%) scale(${scale})`,
        transformOrigin: '50% 50%',
        transition: 'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      role="button"
      tabIndex={0}
      onClick={onClick}
    >
      {/* outer shader bloom — subtle 8px spill onto bg image on hover */}
      <div
        aria-hidden="true"
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: '-8px',
          opacity: hovered && !pressed ? 1 : 0,
          transition: 'opacity 220ms ease',
        }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(55% 70% at 18% 50%, rgba(0, 197, 239, 0.45) 0%, rgba(0, 197, 239, 0) 75%),' +
              'radial-gradient(55% 70% at 82% 50%, rgba(208, 78, 232, 0.4) 0%, rgba(208, 78, 232, 0) 75%),' +
              'radial-gradient(50% 60% at 50% 50%, rgba(255, 200, 22, 0.32) 0%, rgba(255, 200, 22, 0) 75%)',
            filter: 'blur(8px)',
          }}
        />
      </div>

      <PulsingBorder
        speed={1} roundness={1} thickness={1} softness={1}
        intensity={0.2} bloom={0.28} spots={4} spotSize={0.49}
        pulse={0.25} smoke={0.55} smokeSize={0.6}
        scale={1} rotation={0} aspectRatio="auto"
        colors={['#00C5EF', '#D04EE8', '#FFC816']}
        colorBack="#00000000"
        className="rounded-full absolute inset-0 bg-black"
      />
      <div
        className="flex absolute items-center gap-12 left-[50%] top-[50%] p-0"
        style={{
          translate: '-50% -50%',
          color: contentColor,
          transition: 'color 140ms ease',
        }}
      >
        <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px', flexShrink: '0' }}>
          <path d="M643.346 393.248c6.186-18.779 9.279-28.114 14.361-29.826a10.715 10.715 0 0 1 6.849 0c5.081 1.712 8.175 11.047 14.361 29.826 25.739 78.432 38.664 117.648 62.966 148.689 11.212 14.306 24.137 27.23 38.443 38.443 31.041 24.303 70.257 37.227 148.689 62.966 18.779 6.186 28.114 9.279 29.826 14.361a10.771 10.771 0 0 1 0 6.849c-1.712 5.081-11.047 8.175-29.826 14.361-78.432 25.739-117.648 38.664-148.689 62.966-14.361 11.212-27.23 24.137-38.443 38.443-24.303 31.097-37.227 70.312-62.966 148.689-6.186 18.779-9.279 28.114-14.361 29.826a10.771 10.771 0 0 1-6.849 0c-5.081-1.712-8.175-11.047-14.361-29.826-25.739-78.432-38.664-117.648-62.966-148.689a225.077 225.077 0 0 0-38.443-38.387c-31.097-24.358-70.312-37.283-148.744-63.077-18.724-6.131-28.059-9.224-29.826-14.361a10.771 10.771 0 0 1 0-6.794c1.767-5.081 11.102-8.175 29.826-14.361 78.432-25.739 117.648-38.664 148.744-62.966 14.306-11.212 27.175-24.137 38.387-38.443 24.303-31.097 37.283-70.257 63.022-148.689zM251.629 233.954c4.087-12.483 6.131-18.724 9.555-19.884a7.18 7.18 0 0 1 4.529 0c3.424 1.16 5.468 7.401 9.555 19.884 17.178 52.306 25.794 78.432 41.978 99.144 7.512 9.555 16.128 18.172 25.684 25.628 20.713 16.239 46.838 24.855 99.089 41.978 12.483 4.143 18.779 6.186 19.884 9.611a7.18 7.18 0 0 1 0 4.529c-1.105 3.424-7.346 5.468-19.884 9.555-52.251 17.233-78.432 25.794-99.089 41.978a150.235 150.235 0 0 0-25.628 25.684c-16.239 20.713-24.855 46.838-41.978 99.144-4.143 12.483-6.186 18.724-9.611 19.884a7.18 7.18 0 0 1-4.529 0c-3.424-1.16-5.468-7.401-9.555-19.884-17.233-52.306-25.794-78.432-42.033-99.144a150.235 150.235 0 0 0-25.628-25.628c-20.713-16.239-46.838-24.855-99.144-41.978-12.483-4.143-18.724-6.186-19.884-9.611a7.18 7.18 0 0 1 0-4.529c1.16-3.424 7.401-5.468 19.884-9.555 52.306-17.233 78.432-25.794 99.144-42.033 9.555-7.457 18.172-16.073 25.628-25.628 16.239-20.713 24.855-46.838 41.978-99.144zM529.454 77.256c2.596-7.788 3.866-11.71 5.965-12.428a4.419 4.419 0 0 1 2.872 0c2.099 0.718 3.424 4.64 5.965 12.428 10.771 32.698 16.128 48.992 26.291 61.972 4.64 5.965 9.997 11.323 16.018 16.018 12.925 10.108 29.274 15.465 61.917 26.236 7.788 2.596 11.71 3.866 12.428 5.965a4.474 4.474 0 0 1 0 2.872c-0.718 2.099-4.64 3.369-12.428 5.965-32.643 10.771-48.992 16.128-61.972 26.236a94.063 94.063 0 0 0-16.018 16.018c-10.108 12.98-15.465 29.274-26.236 61.972-2.541 7.788-3.866 11.71-5.965 12.428a4.419 4.419 0 0 1-2.872 0c-2.099-0.718-3.369-4.64-5.965-12.428-10.715-32.698-16.128-48.992-26.236-61.972a93.897 93.897 0 0 0-16.018-16.018c-12.925-10.108-29.274-15.465-61.972-26.236-7.788-2.596-11.71-3.866-12.428-5.965a4.474 4.474 0 0 1 0-2.872c0.718-2.099 4.64-3.369 12.428-5.965 32.698-10.715 49.047-16.128 61.972-26.236a93.897 93.897 0 0 0 16.018-16.018c10.108-12.98 15.465-29.274 26.236-61.972z" fill="currentColor" />
        </svg>
        <span className="w-fit shrink-0 font-['AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] font-medium text-base/5" style={{ color: 'currentColor' }}>开始创作</span>
      </div>
    </div>
  );
}

const STEP_TABS = [
  {
    key: 'global',
    label: '项目总览',
    alwaysEnabled: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M7.667 6.667V2H2V6.667H7.667Z" stroke="#FFFFFF" strokeLinejoin="round" />
        <path d="M14 14V9.333H8.333V14H14Z" stroke="#FFFFFF" strokeLinejoin="round" />
        <path d="M10.333 2V6.667H14V2H10.333Z" stroke="#FFFFFF" strokeLinejoin="round" />
        <path d="M2 9.333V14H5.667V9.333H2Z" stroke="#FFFFFF" strokeLinejoin="round" />
      </svg>
    ),
    activeWidth: 110,
    activeIcon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <defs>
          <linearGradient id="gs_active_0" x1="4.83333" y1="2" x2="4.83333" y2="6.66667" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="gs_active_1" x1="11.1667" y1="9.33337" x2="11.1667" y2="14" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="gs_active_2" x1="12.1667" y1="2" x2="12.1667" y2="6.66667" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="gs_active_3" x1="3.83333" y1="9.33337" x2="3.83333" y2="14" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
        </defs>
        <path d="M7.66667 6.66667V2H2V6.66667H7.66667Z" fill="url(#gs_active_0)" stroke="url(#gs_active_0)" strokeLinejoin="round"/>
        <path d="M14 14V9.33337H8.33337V14H14Z" fill="url(#gs_active_1)" stroke="url(#gs_active_1)" strokeLinejoin="round"/>
        <path d="M10.3334 2V6.66667H14V2H10.3334Z" fill="url(#gs_active_2)" stroke="url(#gs_active_2)" strokeLinejoin="round"/>
        <path d="M2 9.33337V14H5.66667V9.33337H2Z" fill="url(#gs_active_3)" stroke="url(#gs_active_3)" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: 'script',
    label: '剧本',
    alwaysEnabled: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M1.667 2.333H5.333C6.806 2.333 8 3.527 8 5V14C8 12.896 7.105 12 6 12H1.667V2.333Z" stroke="#FFFFFF" strokeLinejoin="round" />
        <path d="M14.333 2.333H10.667C9.194 2.333 8 3.527 8 5V14C8 12.896 8.895 12 10 12H14.333V2.333Z" stroke="#FFFFFF" strokeLinejoin="round" />
      </svg>
    ),
    activeWidth: 80,
    activeIcon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <defs>
          <linearGradient id="sc_active_0" x1="4.833" y1="2.333" x2="4.833" y2="14" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="sc_active_1" x1="11.167" y1="2.333" x2="11.167" y2="14" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
        </defs>
        <path d="M1.667 2.333H5.333C6.806 2.333 8 3.527 8 5V14C8 12.896 7.105 12 6 12H1.667V2.333Z" fill="url(#sc_active_0)" stroke="url(#sc_active_0)" strokeLinejoin="round"/>
        <path d="M14.333 2.333H10.667C9.194 2.333 8 3.527 8 5V14C8 12.896 8.895 12 10 12H14.333V2.333Z" fill="url(#sc_active_1)" stroke="url(#sc_active_1)" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: 'subject',
    label: '主体',
    alwaysEnabled: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M3.333 3.333H10.667H12.667V14.667H3.333V3.333Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.333 3.333L10.667 1.333V3.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 9.333C8.736 9.333 9.333 8.736 9.333 8C9.333 7.264 8.736 6.667 8 6.667C7.264 6.667 6.667 7.264 6.667 8C6.667 8.736 7.264 9.333 8 9.333Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.667 11.333H9.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    activeWidth: 80,
    activeIcon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <defs>
          <linearGradient id="_64i21n0" x1="7" y1="1.333" x2="7" y2="3.333" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="_64i21n1" x1="7" y1="1.333" x2="7" y2="3.333" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="_64i21n2" x1="8" y1="3.333" x2="8" y2="14.667" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="_64i21n3" x1="8" y1="3.333" x2="8" y2="14.667" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
        </defs>
        <path d="M3.333 3.333L10.667 1.333V3.333" fill="url(#_64i21n0)" />
        <path d="M3.333 3.333L10.667 1.333V3.333" stroke="url(#_64i21n1)" strokeLinejoin="round" />
        <path d="M3.333 3.333H10.667H12.667V14.667H3.333V3.333Z" fill="url(#_64i21n2)" stroke="url(#_64i21n3)" strokeLinejoin="round" />
        <path d="M8 9.333C8.736 9.333 9.333 8.736 9.333 8C9.333 7.264 8.736 6.667 8 6.667C7.264 6.667 6.667 7.264 6.667 8C6.667 8.736 7.264 9.333 8 9.333Z" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.667 11.333H9.333" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'storyboard',
    label: '分镜',
    alwaysEnabled: false,
    activeWidth: 80,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M5.333 2H2.667C2.298 2 2 2.298 2 2.667V5.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.333 14H2.667C2.298 14 2 13.701 2 13.333V10.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.667 14H13.333C13.701 14 14 13.701 14 13.333V10.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.667 2H13.333C13.701 2 14 2.298 14 2.667V5.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11.333 8C11.333 6.159 9.841 4.667 8 4.667C6.159 4.667 4.667 6.159 4.667 8C4.667 9.841 6.159 11.333 8 11.333C9.841 11.333 11.333 9.841 11.333 8Z" stroke="#FFFFFF" />
        <path d="M8 9C7.448 9 7 8.552 7 8C7 7.448 7.448 7 8 7C8.552 7 9 7.448 9 8C9 8.552 8.552 9 8 9Z" fill="#FFFFFF" />
      </svg>
    ),
    activeIcon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <defs>
          <linearGradient id="sb_active_0" x1="3.167" y1="2" x2="3.167" y2="5.333" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="sb_active_1" x1="3.167" y1="10.667" x2="3.167" y2="14" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="sb_active_2" x1="12.833" y1="10.667" x2="12.833" y2="14" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="sb_active_3" x1="12.833" y1="2" x2="12.833" y2="5.333" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
          <linearGradient id="sb_active_4" x1="8" y1="4.667" x2="8" y2="11.333" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C2F2FF"/><stop offset="1" stopColor="#2DC3E1"/>
          </linearGradient>
        </defs>
        <path d="M5.333 2H2.667C2.298 2 2 2.298 2 2.667V5.333" stroke="url(#sb_active_0)" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.333 14H2.667C2.298 14 2 13.701 2 13.333V10.667" stroke="url(#sb_active_1)" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.667 14H13.333C13.701 14 14 13.701 14 13.333V10.667" stroke="url(#sb_active_2)" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.667 2H13.333C13.701 2 14 2.298 14 2.667V5.333" stroke="url(#sb_active_3)" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11.333 8C11.333 6.159 9.841 4.667 8 4.667C6.159 4.667 4.667 6.159 4.667 8C4.667 9.841 6.159 11.333 8 11.333C9.841 11.333 11.333 9.841 11.333 8Z" stroke="url(#sb_active_4)" />
        <path d="M8 9C7.448 9 7 8.552 7 8C7 7.448 7.448 7 8 7C8.552 7 9 7.448 9 8C9 8.552 8.552 9 8 9Z" fill="url(#sb_active_4)" />
      </svg>
    ),
  },
  {
    key: 'edit',
    label: '剪辑',
    alwaysEnabled: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M14.333 5.667V3H11.333M14.333 5.667V10.333M14.333 5.667H11.333M11.333 3V5.667M11.333 3H10M14.333 10.333V13H11.333M14.333 10.333H11.333M11.333 5.667H10M1.667 5.667V3H4.667M1.667 5.667V10.333M1.667 5.667H4.667M4.667 3V5.667M4.667 3H6M1.667 10.333V13H4.667M1.667 10.333H4.667M4.667 5.667H6M4.667 13V10.333M4.667 13H6M4.667 10.333H6M11.333 13V10.333M11.333 13H10M11.333 10.333H10" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 2.333V3.667" stroke="#FFFFFF" strokeLinecap="round" />
        <path d="M8 5.667V7" stroke="#FFFFFF" strokeLinecap="round" />
        <path d="M8 9V10.333" stroke="#FFFFFF" strokeLinecap="round" />
        <path d="M8 12.333V13.667" stroke="#FFFFFF" strokeLinecap="round" />
      </svg>
    ),
  },
];

function WorkflowHeadbar({ activeStep, onStepChange, unlockedSteps, isLoggedIn, currentUser, onLoginClick, onLogout, onOpenProfile, onLogoClick }) {
  return (
    <div className="[font-synthesis:none] flex items-center justify-between gap-[37px] self-stretch h-[60px] relative shrink-0 antialiased px-24">
      {/* Logo */}
      <svg width="80" height="25" viewBox="0 0 80 25" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, cursor: 'pointer' }} onClick={onLogoClick} role="button" aria-label="返回首页">
        <path d="M28.3 7.265H32.862V24.161H28.3V7.265Z" fill="#FFFFFF" />
        <path d="M35.903 7.265H40.465V24.161H35.903V7.265Z" fill="#FFFFFF" />
        <path d="M15.206 21.204C15.206 22.837 13.882 24.16 12.249 24.16C10.616 24.16 9.292 22.837 9.292 21.204C9.292 19.571 10.616 18.247 12.249 18.247C13.882 18.247 15.206 19.571 15.206 21.204Z" fill="#00D4FF" />
        <path fillRule="evenodd" clipRule="evenodd" d="M0 24.161L0 3.295H0.056H0.472C1.175 5.75 2.626 7.89 4.562 9.453V24.161H0Z" fill="#FFFFFF" />
        <path fillRule="evenodd" clipRule="evenodd" d="M24.498 24.161H19.936V9.453C21.872 7.89 23.323 5.75 24.026 3.295H24.442H24.498L24.498 24.161Z" fill="#FFFFFF" />
        <path d="M55.333 15.713C55.333 13.847 53.82 12.334 51.954 12.334C50.087 12.334 48.575 13.847 48.575 15.713C48.575 17.579 50.087 19.092 51.954 19.092V24.161C47.288 24.161 43.506 20.378 43.506 15.713C43.506 11.047 47.288 7.265 51.954 7.265C56.619 7.265 60.401 11.047 60.401 15.713C60.401 20.378 56.619 24.161 51.954 24.161V19.092C53.82 19.092 55.333 17.579 55.333 15.713Z" fill="#FFFFFF" />
        <path d="M74.931 15.713C74.931 13.847 73.418 12.334 71.552 12.334C69.686 12.334 68.173 13.847 68.173 15.713C68.173 17.579 69.686 19.092 71.552 19.092V24.161C66.887 24.161 63.105 20.378 63.105 15.713C63.105 11.047 66.887 7.265 71.552 7.265C76.218 7.265 80 11.047 80 15.713C80 20.378 76.218 24.161 71.552 24.161V19.092C73.418 19.092 74.931 17.579 74.931 15.713Z" fill="#FFFFFF" />
        <path d="M35.734 0C37.274 0 38.522 1.248 38.522 2.788C38.522 4.327 37.274 5.575 35.734 5.575C35.243 5.575 34.783 5.449 34.382 5.226C35.239 4.75 35.818 3.837 35.818 2.788C35.818 1.739 35.239 0.825 34.382 0.349C34.783 0.127 35.243 0 35.734 0Z" fill="#00D4FF" style={{ opacity: 0.4 }} />
        <path d="M38.437 0C39.977 0 41.225 1.248 41.225 2.788C41.225 4.327 39.977 5.575 38.437 5.575C37.947 5.575 37.486 5.449 37.086 5.226C37.942 4.75 38.522 3.837 38.522 2.788C38.522 1.739 37.942 0.825 37.086 0.349C37.486 0.127 37.947 0 38.437 0Z" fill="#00D4FF" style={{ opacity: 0.2 }} />
        <path d="M35.818 2.788C35.818 4.327 34.57 5.575 33.03 5.575C31.491 5.575 30.243 4.327 30.243 2.788C30.243 1.248 31.491 0 33.03 0C34.57 0 35.818 1.248 35.818 2.788Z" fill="#00D4FF" style={{ opacity: 0.6 }} />
        <path d="M33.115 2.788C33.115 4.327 31.867 5.575 30.327 5.575C28.788 5.575 27.54 4.327 27.54 2.788C27.54 1.248 28.788 0 30.327 0C31.867 0 33.115 1.248 33.115 2.788Z" fill="#00D4FF" />
        <path fillRule="evenodd" clipRule="evenodd" d="M12.249 12.165C17.842 12.165 22.559 8.416 24.026 3.295H24.442C24.479 3.684 24.498 4.078 24.498 4.477C24.498 11.242 19.014 16.727 12.249 16.727C5.484 16.727 0 11.242 0 4.477C0 4.078 0.019 3.684 0.056 3.295H0.472C1.939 8.416 6.656 12.165 12.249 12.165Z" fill="#FFFFFF" />
      </svg>

      {/* Right: 创作手册 + user */}
      <div className="flex items-center gap-24 p-0">
        <CreationManualButton />
        {isLoggedIn ? (
          <AccountMenu
            nickname={currentUser.nickname ?? ''}
            phone={currentUser.phone_bound ? (currentUser.phone ?? '已绑定') : '未绑定'}
            wechat={currentUser.wechat_bound ? (currentUser.wechat ?? '已绑定') : '未绑定'}
            avatarUrl={currentUser.avatar_url ?? ''}
            onLogout={onLogout}
            onOpenProfile={onOpenProfile}
          />
        ) : (
          <LoginButton onClick={onLoginClick} />
        )}
      </div>

      {/* Step tabs — absolute centered */}
      <div className="flex items-center gap-24 absolute" style={{ left: 'calc(50% - 9px)', top: '50%', translate: '-50% -50%' }}>
        {STEP_TABS.map((tab) => {
          const isActive = tab.key === activeStep;
          const activeIndex = STEP_TABS.findIndex(t => t.key === activeStep);
          const tabIndex = STEP_TABS.findIndex(t => t.key === tab.key);
          // Steps before or at the current active step are always accessible
          const isDisabled = !tab.alwaysEnabled && !unlockedSteps.has(tab.key) && !isActive && tabIndex > activeIndex;

          if (isActive) {
            return (
              <div
                key={tab.key}
                className="flex flex-col items-start gap-0 rounded-full relative p-0 h-[32px]"
                style={{ cursor: 'pointer' }}
                onClick={() => onStepChange(tab.key)}
              >
                <PulsingBorder
                  speed={1} roundness={1} thickness={0.1} softness={0.75}
                  intensity={0.2} bloom={0.25} spots={2} spotSize={0.5}
                  pulse={0.25} smoke={0.3} smokeSize={0.6}
                  scale={1} rotation={0} aspectRatio="auto"
                  frame={tab.key === 'subject' ? 6788171.039985808 : 2135739.739999904}
                  colors={['#0DC1FD']}
                  colorBack="#00000000"
                  className="h-[32px] rounded-full shrink-0 bg-black"
                  style={{ width: `${tab.activeWidth ?? 110}px` }}
                />
                <div className="flex items-center gap-[4px] absolute p-0" style={{ left: '50%', top: '50%', translate: '-50% -50%' }}>
                  {tab.activeIcon ?? tab.icon}
                  <span
                    className="inline-block w-max shrink-0 font-['AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] font-medium text-transparent bg-clip-text text-sm/[18px]"
                    style={{ backgroundImage: 'linear-gradient(in oklab 180deg, oklab(93.3% -0.043 -0.030) 0%, 31.4%, oklab(75.5% -0.102 -0.072) 100%)' }}
                  >
                    {tab.label}
                  </span>
                </div>
              </div>
            );
          }

          if (isDisabled) {
            return (
              <div
                key={tab.key}
                className="flex flex-col h-[32px] rounded-full p-px [outline:1px_solid_#00000080]"
                style={{ backgroundImage: 'linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)', pointerEvents: 'none' }}
              >
                <div className="flex items-center grow shrink basis-[0%] rounded-full px-[15px] gap-[4px] self-stretch justify-center bg-[#090909]">
                  <span style={{ opacity: 0.4, display: 'flex', alignItems: 'center' }}>{tab.icon}</span>
                  <span className="inline-block w-max shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#FFFFFF66] text-sm/[18px]">
                    {tab.label}
                  </span>
                </div>
              </div>
            );
          }

          // alwaysEnabled, non-active
          return (
            <div
              key={tab.key}
              className="flex flex-col h-[32px] rounded-full p-px [outline:1px_solid_#00000080] cursor-pointer"
              style={{ backgroundImage: 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)' }}
              onClick={() => onStepChange(tab.key)}
            >
              <div className="flex items-center grow shrink basis-[0%] rounded-full px-[15px] gap-[4px] self-stretch justify-center bg-[#090909] hover:bg-[#1D1E1E] transition-colors">
                {tab.icon}
                <span className="inline-block w-max shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-white text-sm/[18px]">
                  {tab.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 归一化：后端 API 返回 snake_case -> 前端 camelCase/shorthand
function normalizeSubjects(items) {
  const list = items.map(item => ({
    ...item,
    desc: item.description ?? item.desc ?? '',
    imageUrl: normalizeImageUrl(item.primary_image_url ?? item.image_url ?? item.imageUrl),
  }));

  // 按创建时间稳定排序，避免后端返回顺序不一致导致列表跳动
  list.sort((a, b) => {
    const timeA = a.created_at || a.createdAt || a.create_time || '';
    const timeB = b.created_at || b.createdAt || b.create_time || '';
    if (timeA && timeB) return timeA.localeCompare(timeB);
    // 没有时间字段时按名称排序
    return (a.name || '').localeCompare(b.name || '');
  });

  return list;
}

const BG_VIDEOS = ["/video/bg-video-01.mp4", "/video/bg-video-02.mp4", "/video/bg-video-03.mp4", "/video/bg-video-04.mp4", "/video/bg-video-05.mp4", "/video/bg-video-06.mp4", "/video/bg-video-07.mp4", "/video/bg-video-08.mp4"];
const BG_VIDEO_POSTER = "/video/bg-video-poster.png";

export default function Home({ onProjectCreated }) {
  const [activeKey, setActiveKey] = useState(() => {
    // 只有明确保存了非 home 的 activeKey 才恢复，否则默认 home
    const savedKey = localStorage.getItem('miioo_active_key');
    return savedKey || 'home';
  });
  const [bottomActiveKey, setBottomActiveKey] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [apiConfigOpen, setApiConfigOpen] = useState(false);
  const [noModelNoticeOpen, setNoModelNoticeOpen] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  // mock 模式下也需要检查 token，退出登录后应该显示未登录状态
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [apiConfigured, setApiConfigured] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [watermarkSettingsOpen, setWatermarkSettingsOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeStep, setActiveStep] = useState('script'); // loadProjectDetails 会按项目恢复正确步骤
  const [subjectInitialTab, setSubjectInitialTab] = useState('char');
  const [sharedChars, setSharedChars] = useState(null);
  const [sharedScenes, setSharedScenes] = useState(null);
  const [sharedProps, setSharedProps] = useState(null);
  // 主体分页 meta：{ cursor, hasMore, loading, rawList }
  const [subjectPageMeta, setSubjectPageMeta] = useState({
    chars:  { cursor: null, hasMore: false, loading: false, rawList: [] },
    scenes: { cursor: null, hasMore: false, loading: false, rawList: [] },
    props:  { cursor: null, hasMore: false, loading: false, rawList: [] },
  });
  const [extractError, setExtractError] = useState(null);
  const [extractErrorProjectId, setExtractErrorProjectId] = useState(null);
  const [generateError, setGenerateError] = useState(null);
  const [generateErrorProjectId, setGenerateErrorProjectId] = useState(null);
  const [isGeneratingStoryboards, setIsGeneratingStoryboards] = useState(false);
  const [completedEpisodesCount, setCompletedEpisodesCount] = useState(0);
  const generatingStoryboardsRef = useRef(false); // 同步锁，防止并发调用
  // 自上次提取主体后，剧本是否又重新定稿过（用于控制"开始提取主体"按钮行为）
  const [scriptFinalizedSinceExtraction, setScriptFinalizedSinceExtraction] = useState(false);
  const [scriptEpisodes, setScriptEpisodes] = useState([]);
  const [scriptPhase, setScriptPhase] = useState('initial');
  const [scriptHasStarted, setScriptHasStarted] = useState(false);
  const [scriptContent, setScriptContent] = useState('');
  const [scriptDraftContent, setScriptDraftContent] = useState('');
  const [episodeStatuses, setEpisodeStatuses] = useState({});
  const [storyboardInitialEpisodeIndex, setStoryboardInitialEpisodeIndex] = useState(null);
  // Tracks which non-alwaysEnabled steps have ever had content — once unlocked, stays unlocked
  const [unlockedSteps, setUnlockedSteps] = useState(new Set());
  const [currentUser, setCurrentUser] = useState({});
  const [forceExtract, setForceExtract] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // 同步跟踪当前项目 ID
  useEffect(() => {
    currentProjectIdRef.current = activeProject?.id || null;
  }, [activeProject?.id]);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  // 跨项目异步操作的 pending 结果暂存
  const pendingExtractionsRef = useRef({}); // { projectId: { chars, scenes, props } }
  const currentProjectIdRef = useRef(null);  // 同步跟踪当前项目
  const bgVideoRef = useRef(null);
  const currentVideoIndexRef = useRef(0);

  const showToast = (msg, type = 'warning') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  };

  // 背景视频循环：播完当前视频后切换到下一个（纯 ref 操作，不触发 React 重渲染）
  const handleVideoEnded = () => {
    const next = (currentVideoIndexRef.current + 1) % BG_VIDEOS.length;
    currentVideoIndexRef.current = next;
    const video = bgVideoRef.current;
    if (!video) return;
    video.src = BG_VIDEOS[next];
    video.load();
    video.play().catch(() => {});
  };

  // 统一的退出登录处理函数
  const handleLogout = async () => {
    try {
      // 调用后端退出登录接口
      await apiLogout();
    } catch (error) {
      console.error('退出登录接口调用失败:', error);
    }

    // 清除登录凭证
    clearTokens();

    // 只清除当前会话状态，保留项目数据和解锁状态供下次登录使用
    localStorage.removeItem('miioo_active_project_id');
    localStorage.removeItem('miioo_active_step');
    localStorage.removeItem('miioo_active_key');

    // 强制刷新页面并跳转到首页
    // 使用 location.replace 而不是 location.href，确保不会留在历史记录中
    window.location.replace('/');
  };

  // 监听项目切换并保存 ID（仅在有→无切换时清除，初始化/null→null 不操作）
  const prevProjectIdRef = useRef();
  useEffect(() => {
    const prevId = prevProjectIdRef.current;
    const currentId = activeProject?.id;
    if (currentId) {
      localStorage.setItem('miioo_active_project_id', currentId);
    } else if (prevId) {
      // 之前有项目，现在没了 → 用户主动退出项目
      localStorage.removeItem('miioo_active_project_id');
    }
    // 初始化时 prevId=undefined, currentId=undefined → 什么都不做
    prevProjectIdRef.current = currentId;
  }, [activeProject?.id]);

  // 监听步骤切换并保存（按项目 ID 单独存储，避免不同项目间互相污染）
  useEffect(() => {
    if (activeProject?.id) {
      localStorage.setItem(`miioo_active_step_${activeProject.id}`, activeStep);
    }
  }, [activeStep, activeProject?.id]);

  // 监听 activeKey 变化并保存
  useEffect(() => {
    if (activeKey !== 'home') {
      localStorage.setItem('miioo_active_key', activeKey);
    } else {
      // 回到首页时清除缓存，确保刷新不会跳转
      localStorage.removeItem('miioo_active_key');
    }
  }, [activeKey]);

  // 监听解锁状态变化并保存（按项目 ID）
  useEffect(() => {
    if (activeProject?.id && unlockedSteps.size > 0) {
      const key = `miioo_unlocked_steps_${activeProject.id}`;
      localStorage.setItem(key, JSON.stringify([...unlockedSteps]));
    }
  }, [unlockedSteps, activeProject?.id]);

  // 统一的项目数据加载函数
  const loadProjectDetails = async (projectId) => {
    setIsLoadingProject(true);
    // 每次进入项目时主动失效 episodes 和 overview 缓存，确保拿到后端最新数据
    invalidate(K.episodes(projectId));
    invalidate(K.projectOverview(projectId));
    try {
      // 0. 切换项目前先清空旧项目所有数据状态，避免闪现旧数据
      setActiveProject(null);
      setActiveStep('script');
      setScriptContent('');
      setScriptEpisodes([]);
      setScriptPhase('initial');
      setScriptHasStarted(false);
      setScriptFinalizedSinceExtraction(false);
      setSharedChars([]);
      setSharedScenes([]);
      setSharedProps([]);
      setEpisodeStatuses({});
      setUnlockedSteps(new Set());
      if (extractErrorProjectId !== projectId) {
        setExtractError(null);
        setExtractErrorProjectId(null);
      }
      if (generateErrorProjectId !== projectId) {
        setGenerateError(null);
        setGenerateErrorProjectId(null);
      }
      setSubjectInitialTab('char');

      // ── 缓存快速路径：如果核心数据都有缓存，立即填充并关掉 loading ──────────
      const cachedProject = peekCache(K.project(projectId), MEDIUM.CONTENT);
      const cachedEpisodes = peekCache(K.episodes(projectId), MEDIUM.CONTENT);
      const cachedScript = peekCache(K.script(projectId), MEDIUM.CONTENT);
      const cachedChars = peekCache(K.subjects(projectId, 'character'), MEDIUM.CONTENT);
      const cachedScenes = peekCache(K.subjects(projectId, 'scene'), MEDIUM.CONTENT);
      const cachedProps = peekCache(K.subjects(projectId, 'prop'), MEDIUM.CONTENT);

      if (cachedProject && cachedEpisodes) {
        // 从缓存填充状态，立即关掉 loading → StoryboardPage 秒挂载
        setActiveProject(cachedProject);
        setScriptEpisodes(cachedEpisodes);
        if (cachedScript) {
          const scriptContent = cachedScript.script?.content || cachedScript.content || '';
          setScriptContent(scriptContent);
          setScriptPhase(scriptContent ? 'view' : 'initial');
          setScriptHasStarted(!!scriptContent);
        }
        // 确保缓存数据是数组（兼容旧缓存存的 SubjectListResponse 对象）
        const ensureArray = (data) => Array.isArray(data) ? data : (data?.list || data?.items || data?.data || []);
        if (cachedChars) setSharedChars(normalizeSubjects(ensureArray(cachedChars)));
        if (cachedScenes) setSharedScenes(normalizeSubjects(ensureArray(cachedScenes)));
        if (cachedProps) setSharedProps(normalizeSubjects(ensureArray(cachedProps)));
        // 恢复步骤
        const savedStep = localStorage.getItem(`miioo_active_step_${projectId}`);
        setActiveStep(savedStep || 'script');
        const savedUnlocked = localStorage.getItem(`miioo_unlocked_steps_${projectId}`);
        if (savedUnlocked) setUnlockedSteps(new Set(JSON.parse(savedUnlocked)));
        const savedFinalized = localStorage.getItem(`miioo_finalized_since_extraction_${projectId}`);
        setScriptFinalizedSinceExtraction(savedFinalized === 'true');
        // 立即关掉 loading，让 StoryboardPage 先渲染缓存数据
        setIsLoadingProject(false);
        // 后台继续刷新（不阻塞 UI）
      }
      // ── 结束缓存快速路径 ────────────────────────────────────────────────────
      // 1. 加载项目基本信息
      const projectData = await apiGetProject(projectId);
      setActiveProject(projectData);

      // 2. 恢复步骤解锁状态（从 localStorage，按项目 ID）
      const savedUnlocked = localStorage.getItem(`miioo_unlocked_steps_${projectId}`);
      if (savedUnlocked) {
        setUnlockedSteps(new Set(JSON.parse(savedUnlocked)));
      } else {
        setUnlockedSteps(new Set());
      }

      // 如果后端已有主体数据，自动解锁 subject 步骤
      // （避免换浏览器/清缓存后明明有数据却被锁住）
      if (!savedUnlocked || !JSON.parse(savedUnlocked).includes('subject')) {
        try {
          const anySubjects = await apiGetSubjects(projectId, { type: 'character' }).catch(() => []);
          if (Array.isArray(anySubjects) && anySubjects.length > 0) {
            setUnlockedSteps(prev => {
              const next = new Set(prev);
              next.add('subject');
              return next;
            });
          }
        } catch {}
      }

      // 恢复"定稿 flag"（按项目 ID）
      const savedFinalized = localStorage.getItem(`miioo_finalized_since_extraction_${projectId}`);
      setScriptFinalizedSinceExtraction(savedFinalized === 'true');

      // 恢复当前步骤（按项目 ID，新项目默认回到 script）
      // 注意：不使用全局 miioo_active_step，避免不同项目间互相污染
      const savedStep = localStorage.getItem(`miioo_active_step_${projectId}`);
      setActiveStep(savedStep || 'script');

      // 3. 并行加载所有数据
      const SUBJECT_LIMIT = 20;
      const [scriptData, charsPage, scenesPage, propsPage, episodesData, overviewData] = await Promise.all([
        apiGetScriptWorkspace(projectId).catch(err => {
          console.error('加载剧本数据失败:', err);
          return { content: '', episodes: [], phase: 'initial' };
        }),
        apiGetSubjectsPage(projectId, { type: 'character', limit: SUBJECT_LIMIT }).catch(() => ({ list: [], nextCursor: null, hasMore: false })),
        apiGetSubjectsPage(projectId, { type: 'scene', limit: SUBJECT_LIMIT }).catch(() => ({ list: [], nextCursor: null, hasMore: false })),
        apiGetSubjectsPage(projectId, { type: 'prop', limit: SUBJECT_LIMIT }).catch(() => ({ list: [], nextCursor: null, hasMore: false })),
        apiGetEpisodes(projectId).catch(() => []),
        apiGetProjectOverview(projectId).catch(() => null),
      ]);

      // 4. 更新状态
      const scriptContent = scriptData.script?.content || scriptData.content || '';
      setScriptContent(scriptContent);
      setScriptEpisodes(episodesData || []);
      setScriptPhase(scriptContent ? 'view' : 'initial');
      setScriptHasStarted(!!scriptContent);

      setSharedChars(normalizeSubjects(charsPage.list));
      setSharedScenes(normalizeSubjects(scenesPage.list));
      setSharedProps(normalizeSubjects(propsPage.list));
      setSubjectPageMeta({
        chars:  { cursor: charsPage.nextCursor,  hasMore: charsPage.hasMore,  loading: false, rawList: charsPage.list },
        scenes: { cursor: scenesPage.nextCursor, hasMore: scenesPage.hasMore, loading: false, rawList: scenesPage.list },
        props:  { cursor: propsPage.nextCursor,  hasMore: propsPage.hasMore,  loading: false, rawList: propsPage.list },
      });
      // setSharedProps already set above from propsPage.list

      // 从后端数据中提取剧集状态，优先用 overview 的 episode_progress（状态更精准）
      // 不依赖后端 status 字符串（实际值与文档不符），直接用计数字段判断：
      // - video_generated_count > 0 → 'generated'（蓝色，已生成分镜视频）
      // - 否则 → 'pending'（灰色）
      if (overviewData?.episode_progress?.length > 0) {
        const statusMap = {};
        overviewData.episode_progress.forEach((ep, index) => {
          if (ep.video_generated_count > 0) {
            statusMap[index] = 'generated';
          } else {
            statusMap[index] = 'pending';
          }
        });
        setEpisodeStatuses(statusMap);
      } else if (episodesData.length > 0) {
        const VALID_STATUSES = ['edited', 'generated', 'pending'];
        const normalizeStatus = (s) => VALID_STATUSES.includes(s) ? s : 'pending';
        const statusMap = {};
        episodesData.forEach((episode, index) => {
          statusMap[index] = normalizeStatus(episode.status);
        });
        setEpisodeStatuses(statusMap);
      }

      // 5. 加载分镜数据（需要剧集 ID）并用最新 episodesData 的 ID 写入缓存
      if (episodesData.length > 0) {
        // 先清空所有旧的分镜缓存（包含旧 episode ID 的 key），避免 StoryboardPage 用错 ID
        invalidate(K.storyboardsPrefix(projectId));
        const storyboardsData = await apiGetStoryboards(projectId, {
          episode_id: episodesData[0].id
        }).catch(() => []);

        // 根据分镜数据判断是否解锁分镜步骤
        if (storyboardsData.length > 0) {
          setUnlockedSteps(prev => new Set([...prev, 'storyboard']));
        }
      }

    } catch (error) {
      console.error('加载项目详情失败:', error);
      // 加载失败时清除缓存
      localStorage.removeItem('miioo_active_project_id');
      localStorage.removeItem('miioo_active_step');
      localStorage.removeItem('miioo_active_key');
      setActiveProject(null);
      setActiveProjectId(null);
    } finally {
      setIsLoadingProject(false);
    }
  };

  // 处理微信回调（根路径 ?code=&state=）
  useEffect(() => {
    const handleWechatCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');

      if (!code || !state) return; // 没有微信参数，继续正常流程

      try {
        // 调用后端完成回调
        const result = await apiCompleteWechatCallback({ code, state });
        console.log('[Home] 微信回调完成:', result);

        // 如果是 iframe 内，通知父窗口
        if (window.self !== window.top) {
          try {
            window.parent.postMessage({
              type: 'wechat-callback-complete',
              payload: result,
            }, '*');
          } catch (err) {
            console.error('[Home] postMessage 失败:', err);
          }
        } else {
          // 顶层窗口直接处理回调结果
          if (result?.status === 'confirmed' && result?.access_token) {
            // token 已由 apiCompleteWechatCallback 写入，触发页面刷新完成登录
            window.location.replace('/');
          } else if (result?.status === 'need_bind_mobile') {
            // 通知自身（LoginModal 监听同一个 message 事件）
            window.dispatchEvent(new MessageEvent('message', {
              data: { type: 'wechat-callback-complete', payload: result },
            }));
          }
        }

        // 清理 URL 中的微信参数（避免刷新重复执行）
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (err) {
        console.error('[Home] 微信回调处理失败:', err);
        // 无论 iframe 还是顶层，均通知 LoginModal 显示错误
        const errorPayload = {
          type: 'wechat-callback-complete',
          payload: { status: 'error', message: err?.message || '微信登录失败，请稍后重试' },
        };
        if (window.self !== window.top) {
          try { window.parent.postMessage(errorPayload, '*'); } catch {}
        } else {
          window.dispatchEvent(new MessageEvent('message', { data: errorPayload }));
        }
        // 清理 URL（即使失败也要清理，避免重复尝试）
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    };

    handleWechatCallback();
  }, []);

  useEffect(() => {
    // 没有 token → 跳过所有鉴权请求，避免 401
    if (!getToken()) {
      setProjectsLoaded(true);
      return;
    }

    // 启动验证：先尝试刷新 token（避免过期 token 直接发 401），再确认 token 有效
    const doAuth = async () => {
      // 先静默刷新一次 token（有 refresh_token 才尝试）
      if (getRefreshToken()) {
        await refreshAccessToken();
      }

      // token 刷新后仍然无效 → 跳过 API 请求，避免无意义的 401
      if (!getToken()) {
        setProjectsLoaded(true);
        return;
      }

      try {
        const user = await apiGetCurrentUser();
        setIsLoggedIn(true);
        setCurrentUser({ ...user, avatar_url: normalizeImageUrl(user.avatar_url) ?? '' });
      } catch (err) {
        // 401 / 其他鉴权错误 → authFetch 已清 token + 触发 logout 事件
        setProjectsLoaded(true);
        return; // 阻止后续加载
      }
      // 仅在验证成功时加载鉴权数据（此时 token 必然有效）
      if (!getToken()) return;
      refreshAccessToken().finally(() => {
      apiGetProjects().then((data) => {
        const normalized = data.map((p) => ({ ...p, cover: p.cover ?? p.cover_url }));
        // 按创建时间倒序排列，最新的在前
        const sorted = [...normalized].sort((a, b) => {
          const timeA = new Date(a.created_at || 0).getTime();
          const timeB = new Date(b.created_at || 0).getTime();
          return timeB - timeA;
        });
        setProjects(sorted);

        // 只在项目页面（activeKey === 'project'）且有缓存项目 ID 时才恢复
        const savedProjectId = localStorage.getItem('miioo_active_project_id');
        const savedKey = localStorage.getItem('miioo_active_key');

        if (savedKey === 'project' && savedProjectId) {
          const exists = sorted.some(p => p.id === savedProjectId);
          if (exists) {
            setActiveProjectId(savedProjectId);
            loadProjectDetails(savedProjectId);
          } else {
            // 项目已被删除，清除缓存
            localStorage.removeItem('miioo_active_project_id');
            localStorage.removeItem('miioo_active_step');
            localStorage.removeItem('miioo_active_key');
          }
        }
      }).catch(() => {}).finally(() => {
        setProjectsLoaded(true);
      });
          apiGetNotifications().then(setNotifications).catch(() => {});
          apiListProviders().then((data) => {
            const providers = Array.isArray(data) ? data : (data?.providers || []);
            if (providers.length > 0) setApiConfigured(true);
          }).catch(() => {});
        });
      };
      doAuth(); // 启动鉴权流程
  }, []);

  // 订阅项目列表后台更新
  useEffect(() => {
    const unsubscribe = subscribe(K.projects(), (data) => {
      if (Array.isArray(data)) {
        const normalized = data.map((p) => ({ ...p, cover: p.cover ?? p.cover_url }));
        const sorted = [...normalized].sort((a, b) => {
          const timeA = new Date(a.created_at || 0).getTime();
          const timeB = new Date(b.created_at || 0).getTime();
          return timeB - timeA;
        });
        setProjects(sorted);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handleForceLogout = () => {
      if (!localStorage.getItem('token')) return;
      setIsLoggedIn(false);
      setLoginOpen(true);
    };

    // 微信回调 need_bind_mobile：确保登录弹窗打开，再让 LoginModal 内部切换到绑定手机步骤
    const handleWechatNeedBind = (event) => {
      if (event.data?.type === 'wechat-callback-complete' &&
          event.data?.payload?.status === 'need_bind_mobile') {
        setLoginOpen(true);
      }
    };

    const handleProjectAssetsDeleted = (event) => {
      const projectId = event?.detail?.projectId;
      if (!projectId || projectId !== activeProject?.id) return;

      const SUBJECT_LIMIT = 20;
      Promise.all([
        apiGetSubjectsPage(projectId, { type: 'character', limit: SUBJECT_LIMIT }).catch(() => ({ list: [], nextCursor: null, hasMore: false })),
        apiGetSubjectsPage(projectId, { type: 'scene', limit: SUBJECT_LIMIT }).catch(() => ({ list: [], nextCursor: null, hasMore: false })),
        apiGetSubjectsPage(projectId, { type: 'prop', limit: SUBJECT_LIMIT }).catch(() => ({ list: [], nextCursor: null, hasMore: false })),
      ]).then(([charsPage, scenesPage, propsPage]) => {
        setSharedChars(normalizeSubjects(charsPage.list));
        setSharedScenes(normalizeSubjects(scenesPage.list));
        setSharedProps(normalizeSubjects(propsPage.list));
        setSubjectPageMeta({
          chars:  { cursor: charsPage.nextCursor,  hasMore: charsPage.hasMore,  loading: false, rawList: charsPage.list },
          scenes: { cursor: scenesPage.nextCursor, hasMore: scenesPage.hasMore, loading: false, rawList: scenesPage.list },
          props:  { cursor: propsPage.nextCursor,  hasMore: propsPage.hasMore,  loading: false, rawList: propsPage.list },
        });
      }).catch((err) => {
        console.error('资产删除后刷新主体数据失败:', err);
      });
    };

    window.addEventListener('auth:logout', handleForceLogout);
    window.addEventListener('message', handleWechatNeedBind);
    window.addEventListener('project-assets:deleted', handleProjectAssetsDeleted);
    return () => {
      window.removeEventListener('auth:logout', handleForceLogout);
      window.removeEventListener('message', handleWechatNeedBind);
      window.removeEventListener('project-assets:deleted', handleProjectAssetsDeleted);
    };
  }, [activeProject?.id]);

  const handleUnlockStep = (stepKey) => {
    setUnlockedSteps((prev) => {
      if (prev.has(stepKey)) return prev;
      const next = new Set(prev);
      next.add(stepKey);
      return next;
    });
  };

  // 加载更多主体（滚动触底时调用）
  const loadMoreSubjects = async (type) => {
    const key = type === 'character' ? 'chars' : type === 'scene' ? 'scenes' : 'props';
    const meta = subjectPageMeta[key];
    if (!meta || meta.loading || !meta.hasMore) return;
    setSubjectPageMeta(prev => ({ ...prev, [key]: { ...prev[key], loading: true } }));
    try {
      const page = await apiGetSubjectsPage(activeProject.id, { type, limit: 20, cursor: meta.cursor });
      const newItems = normalizeSubjects(page.list);
      if (key === 'chars') setSharedChars(prev => [...(prev || []), ...newItems]);
      else if (key === 'scenes') setSharedScenes(prev => [...(prev || []), ...newItems]);
      else setSharedProps(prev => [...(prev || []), ...newItems]);
      setSubjectPageMeta(prev => ({
        ...prev,
        [key]: { cursor: page.nextCursor, hasMore: page.hasMore, loading: false, rawList: [...meta.rawList, ...page.list] },
      }));
    } catch (err) {
      console.error(`[Home] 加载更多主体失败 (${type}):`, err);
      setSubjectPageMeta(prev => ({ ...prev, [key]: { ...prev[key], loading: false } }));
    }
  };

  // 提取主体回调（由 SubjectPage 在挂载时调用）
  const handleExtractSubjects = async () => {
    const projectId = activeProject.id;
    const projectName = activeProject.name || projectId;
    setExtractError(null);
    try {
      // 调用主动提取接口（POST）而非仅查询已有主体
      const result = await apiExtractSubjectsFromScript(projectId);
      const allSubjects = [...(result.created || []), ...(result.updated || [])];

      const charsData = allSubjects.filter(s => s.type === 'character');
      const scenesData = allSubjects.filter(s => s.type === 'scene');
      const propsData = allSubjects.filter(s => s.type === 'prop');

      const normalizedChars = normalizeSubjects(charsData);
      const normalizedScenes = normalizeSubjects(scenesData);
      const normalizedProps = normalizeSubjects(propsData);

      if (normalizedChars.length === 0 && normalizedScenes.length === 0 && normalizedProps.length === 0) {
        if (currentProjectIdRef.current === projectId) {
          setExtractError('提取主体失败，请稍后重试');
          setExtractErrorProjectId(projectId);
          showToast('提取主体失败，请稍后重试', 'error');
        }
        return;
      }

      // 项目已切换：暂存结果 + toast 通知
      if (currentProjectIdRef.current !== projectId) {
        pendingExtractionsRef.current[projectId] = {
          chars: normalizedChars,
          scenes: normalizedScenes,
          props: normalizedProps,
        };
        showToast(`「${projectName}」主体抽取完成`, 'success');
        return;
      }

      setSharedChars(normalizedChars);
      setSharedScenes(normalizedScenes);
      setSharedProps(normalizedProps);
      setForceExtract(false);
    } catch (err) {
      console.error('提取主体失败:', err);
      if (currentProjectIdRef.current === projectId) {
        setExtractError('提取主体失败，请重试');
        setExtractErrorProjectId(projectId);
        showToast('提取主体失败，请重试', 'error');
      }
    }
  };

  // 切回项目时，检查是否有暂存的提取结果等待应用
  useEffect(() => {
    const pid = activeProject?.id;
    if (!pid) return;
    const pending = pendingExtractionsRef.current[pid];
    if (!pending) return;
    setSharedChars(pending.chars);
    setSharedScenes(pending.scenes);
    setSharedProps(pending.props);
    setForceExtract(false);
    delete pendingExtractionsRef.current[pid];
  }, [activeProject?.id]);

  // 智能分镜生成回调（由 StoryboardPage 在挂载时调用）
  const handleGenerateStoryboards = async () => {
    if (generatingStoryboardsRef.current) return;
    generatingStoryboardsRef.current = true;
    setIsGeneratingStoryboards(true);
    setCompletedEpisodesCount(0);
    setGenerateError(null);
    setGenerateErrorProjectId(null);
    try {
      let freshEpisodes = await apiGetEpisodes(activeProject.id).catch(() => []);
      if (freshEpisodes.length === 0 && scriptContent) {
        const finalizeResult = await apiFinalizeScriptWorkspace(activeProject.id, {
          episode_count: null, model: null,
        });
        const finalized = finalizeResult?.items || finalizeResult?.episodes || finalizeResult?.data;
        if (Array.isArray(finalized) && finalized.length > 0) {
          freshEpisodes = finalized;
          setScriptEpisodes(freshEpisodes);
        }
      }

      // episode_number → episode_id 映射，用于按集失效缓存
      const episodeNumberToId = {};
      freshEpisodes.forEach(ep => {
        if (ep.episode_number != null && ep.id) {
          episodeNumberToId[ep.episode_number] = ep.id;
        }
      });

      // 1. 启动任务，拿到 taskId
      const taskResp = await apiGenerateStoryboardsFromFinalScript(activeProject.id);
      const taskId = taskResp?.id;
      if (!taskId) throw new Error('未获取到任务 ID');

      // 2. 轮询任务，每完成一集立即失效对应缓存，让 StoryboardPage 实时看到结果
      const TIMEOUT_MS = 500 * 1000; // 500 秒超时
      const INTERVAL = 3000;
      let finalTask = null;
      const notifiedEpisodeNumbers = new Set(); // 已通知过的分集，避免重复失效
      let prevCurrentEpisodeNumber = null; // 上次轮询时的 current_episode_number
      const pollStartTime = Date.now();

      const flushEpisode = (num) => {
        if (notifiedEpisodeNumbers.has(num)) return;
        notifiedEpisodeNumbers.add(num);
        setCompletedEpisodesCount(notifiedEpisodeNumbers.size);
        const epId = episodeNumberToId[num];
        if (!epId) return;
        invalidate(K.storyboards(activeProject.id, epId));
        invalidate(K.storyboards(activeProject.id));
        apiGetStoryboards(activeProject.id, { episode_id: epId }).catch(() => {});
      };

      while (Date.now() - pollStartTime < TIMEOUT_MS) {
        await new Promise(r => setTimeout(r, INTERVAL));
        if (Date.now() - pollStartTime >= TIMEOUT_MS) break;
        const t = await apiGetTask(taskId).catch(() => null);
        if (!t) continue;
        console.log('[poll] task status:', t.status, 'params:', JSON.stringify(t.params));

        // 路径1：completed_episode_numbers 字段（后端明确告知哪些集已完成）
        const completedNums = t.params?.completed_episode_numbers;
        if (Array.isArray(completedNums)) {
          completedNums.forEach(num => flushEpisode(num));
        }

        // 路径2：current_episode_number 变化 → 说明上一集已完成
        const currentNum = t.params?.current_episode_number;
        if (currentNum != null && prevCurrentEpisodeNumber != null && currentNum !== prevCurrentEpisodeNumber) {
          flushEpisode(prevCurrentEpisodeNumber);
        }
        if (currentNum != null) prevCurrentEpisodeNumber = currentNum;

        // 终态判断
        const status = t.status;
        if (status !== 'pending' && status !== 'running') {
          finalTask = t;
          break;
        }
      }

      if (!finalTask) throw new Error('POLL_TIMEOUT');
      if (finalTask.status === 'failed') {
        const msg = finalTask.params?.status_message || finalTask.params?.error || '分镜生成失败';
        throw new Error(msg);
      }

      // 3. 任务完成，重新拉取最新 episodes（后端可能已创建新 UUID）
      const latestEpisodes = await apiGetEpisodes(activeProject.id).catch(() => freshEpisodes);
      if (Array.isArray(latestEpisodes) && latestEpisodes.length > 0) {
        setScriptEpisodes(latestEpisodes);
      }

      // 4. 用最新 episodes 做兜底刷新分镜（确保用正确的 episode ID）
      const finalEpisodes = (Array.isArray(latestEpisodes) && latestEpisodes.length > 0)
        ? latestEpisodes : freshEpisodes;
      finalEpisodes.forEach(ep => {
        if (!ep.id) return;
        invalidate(K.storyboards(activeProject.id, ep.id));
        apiGetStoryboards(activeProject.id, { episode_id: ep.id }).catch(() => {});
      });
      invalidate(K.storyboards(activeProject.id));
      apiGetStoryboards(activeProject.id).catch(() => {});

    } catch (err) {
      console.error('智能分镜生成失败:', err);
      const status = err?.status;
      const msg = err?.message || String(err);
      let errorMsg;
      if (msg === 'POLL_TIMEOUT') {
        errorMsg = '剧本生成超时，请重新生成';
      } else if (status === 502) {
        errorMsg = '服务器繁忙，请稍后重试';
      } else if (status === 504 || msg.includes('timeout') || msg.includes('Timeout') || msg.includes('abort')) {
        errorMsg = '请求超时，请重试！';
      } else if (status === 500) {
        errorMsg = '服务器内部错误，请稍后重试';
      } else if (status === 503) {
        errorMsg = '服务暂时不可用，请稍后重试';
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network')) {
        errorMsg = '网络连接失败，请检查网络后重试';
      } else if (msg) {
        errorMsg = `分镜生成失败：${msg}`;
      } else {
        errorMsg = '分镜生成失败，请重试';
      }
      setGenerateError(errorMsg);
      setGenerateErrorProjectId(activeProject?.id);
      showToast(errorMsg, 'error');
    }
    setIsGeneratingStoryboards(false);
    generatingStoryboardsRef.current = false;
  };

  // 定稿成功回调：标记"提取主体后已重新定稿"，允许用户再次提取（弹确认弹窗）
  const handleScriptFinalized = () => {
    setScriptFinalizedSinceExtraction(true);
    if (activeProject?.id) {
      localStorage.setItem(`miioo_finalized_since_extraction_${activeProject.id}`, 'true');
    }
  };

  const handleNavChange = (key) => {
    setActiveKey(key);
    setActiveProject(null);
    setActiveProjectId(null);
    localStorage.removeItem('miioo_active_project_id');
    localStorage.removeItem('miioo_active_step');
          localStorage.removeItem('miioo_active_key');

    // 每次切到项目列表都从后端拉取最新数据
    if (key === 'project') {
      apiGetProjects().then((data) => {
        const normalized = data.map((p) => ({ ...p, cover: p.cover ?? p.cover_url }));
        const sorted = [...normalized].sort((a, b) => {
          const timeA = new Date(a.created_at || 0).getTime();
          const timeB = new Date(b.created_at || 0).getTime();
          return timeB - timeA;
        });
        setProjects(sorted);
      }).catch(() => {});
    }
  };

  const showApiBubble = !apiConfigOpen && (!isLoggedIn || (isLoggedIn && !apiConfigured));

  const bottomNavItems = useMemo(() => BOTTOM_NAV_ITEMS.map((item) => {
    if (item.key === 'menu') {
      return {
        ...item,
        popup: ({ close }) => (
          <MoreOptionsMenu close={close} setWatermarkSettingsOpen={setWatermarkSettingsOpen} />
        ),
      };
    }
    if (item.key !== 'api' || !showApiBubble) return item;
    return {
      ...item,
      bubble: (
        <div
          style={{
            position: 'absolute',
            left: '35.5px',
            top: '50%',
            translate: '0 -50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 0,
            padding: '8px 16px',
            borderRadius: '8px',
            backgroundColor: '#FFFFFF',
            pointerEvents: 'none',
            zIndex: 50,
            whiteSpace: 'nowrap',
            animation: 'api-bubble-nudge 2.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) 1.2s infinite',
          }}
        >
          <div className="w-fit font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#090909] text-sm/4.5">
            点击此处配置API
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              position: 'absolute',
              left: 7,
              top: '50%',
              rotate: '90deg',
              translate: '0 -50%',
              transformOrigin: '0% 0%',
            }}
          >
            <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
          </svg>
        </div>
      ),
    };
  }), [showApiBubble, setWatermarkSettingsOpen]);

  const handleBottomNavChange = (key) => {
    if (key === 'api') {
      if (!isLoggedIn) { setLoginOpen(true); return; }
      setBottomActiveKey(null);
      setApiConfigOpen(true);
      return;
    }
    if (key === 'notifications') {
      setBottomActiveKey(null);
      setNotificationCenterOpen(true);
      return;
    }

    setBottomActiveKey((prev) => (prev === key ? null : key));
  };

  const handleProjectCreated = (project) => {
    // 新项目插入到列表最前面，统一字段映射：cover_url -> cover
    const normalized = { ...project, cover: project.cover ?? project.cover_url };
    setProjects((prev) => [normalized, ...prev]);
    // 清空旧项目的残留状态，避免闪现旧数据
    setScriptContent('');
    setScriptEpisodes([]);
    setScriptPhase('initial');
    setScriptHasStarted(false);
    setScriptFinalizedSinceExtraction(false);
    setSharedChars([]);
    setSharedScenes([]);
    setSharedProps([]);
    setEpisodeStatuses({});
    setUnlockedSteps(new Set());
    // 直接用创建接口返回的项目数据，无需再调一次 apiGetProject
    setActiveProject(normalized);
    setActiveProjectId(normalized.id);
    setActiveStep('script');
    setActiveKey('project');
  };

  // 在 iframe 内（微信 redirect 回调）不渲染完整 UI，只执行 useEffect 回调逻辑
  if (window.self !== window.top) {
    return null;
  }

  return (
    <div className="[font-synthesis:none] overflow-clip w-screen h-screen relative bg-neutral-400 antialiased">
      {/* background — only visible on home page */}
      {activeKey === 'home' && (
        <>
          <video
            ref={bgVideoRef}
            src={BG_VIDEOS[0]}
            autoPlay
            muted
            playsInline
            onEnded={handleVideoEnded}
            className="absolute inset-0 object-cover"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center' }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(ellipse 52.305% 69.61% at 50% 44.45% in oklab, oklab(0% 0 0 / 0%) 0%, 24.46%, oklab(0% 0 0 / 10%) 43.6%, 77.4%, oklab(0% 0 0 / 60%) 100%)' }}
          />
        </>
      )}
      {activeKey !== 'home' && (
        <div className="absolute inset-0 bg-neutral-400" />
      )}

      <div className="flex flex-col items-start absolute inset-0" style={{ paddingBottom: "0px" }}>
        {/* headbar */}
        {!activeProject ? (
        <div className="flex items-center px-24 py-12 justify-between gap-[37px] self-stretch">
          <svg width="66" height="19.92" viewBox="0 0 947 286" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flex: '0 1 auto', width: '66px', cursor: activeKey !== 'home' ? 'pointer' : 'default' }} aria-label="miioo" role={activeKey !== 'home' ? 'button' : undefined} onClick={activeKey !== 'home' ? () => setActiveKey('home') : undefined}>
            <path d="M335 86H389V286H335V86Z" fill="white"/>
            <path d="M425 86H479V286H425V86Z" fill="white"/>
            <path d="M180 251C180 270.33 164.33 286 145 286C125.67 286 110 270.33 110 251C110 231.67 125.67 216 145 216C164.33 216 180 231.67 180 251Z" fill="#00D4FF"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M0 286L0.00488281 39H0.667969H5.58887C13.9136 68.0675 31.0835 93.3978 54 111.894V286H0Z" fill="white"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M290 286H236V111.894C258.917 93.3978 276.086 68.0674 284.41 39H289.332H289.995L290 286Z" fill="white"/>
            <path d="M655 186C655 163.909 637.091 146 615 146C592.909 146 575 163.909 575 186C575 208.091 592.909 226 615 226V286C559.772 286 515 241.228 515 186C515 130.772 559.772 86 615 86C670.228 86 715 130.772 715 186C715 241.228 670.228 286 615 286V226C637.091 226 655 208.091 655 186Z" fill="white"/>
            <path d="M887 186C887 163.909 869.091 146 847 146C824.909 146 807 163.909 807 186C807 208.091 824.909 226 847 226V286C791.772 286 747 241.228 747 186C747 130.772 791.772 86 847 86C902.228 86 947 130.772 947 186C947 241.228 902.228 286 847 286V226C869.091 226 887 208.091 887 186Z" fill="white"/>
            <path opacity="0.4" d="M423 0C441.225 0 456 14.7746 456 33C456 51.2254 441.225 66 423 66C417.194 66 411.74 64.498 407 61.8652C417.138 56.2337 424 45.4193 424 33C424 20.5805 417.138 9.76525 407 4.13379C411.739 1.50119 417.194 0 423 0Z" fill="#00D4FF"/>
            <path opacity="0.2" d="M455 0C473.225 0 488 14.7746 488 33C488 51.2254 473.225 66 455 66C449.194 66 443.74 64.498 439 61.8652C449.138 56.2337 456 45.4193 456 33C456 20.5805 449.138 9.76525 439 4.13379C443.739 1.50119 449.194 0 455 0ZM423.951 34.7764C423.938 35.0196 423.923 35.2621 423.905 35.5039C423.923 35.2621 423.938 35.0196 423.951 34.7764Z" fill="#00D4FF"/>
            <path opacity="0.6" d="M424 33C424 51.2254 409.225 66 391 66C372.775 66 358 51.2254 358 33C358 14.7746 372.775 0 391 0C409.225 0 424 14.7746 424 33Z" fill="#00D4FF"/>
            <path d="M392 33C392 51.2254 377.225 66 359 66C340.775 66 326 51.2254 326 33C326 14.7746 340.775 0 359 0C377.225 0 392 14.7746 392 33Z" fill="#00D4FF"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M145 144C211.206 144 267.047 99.6278 284.41 39H289.332C289.773 43.6071 290 48.2771 290 53C290 133.081 225.081 198 145 198C64.9189 198 0 133.081 0 53C0 48.2772 0.226074 43.6072 0.667969 39H5.58887C22.9517 99.6278 78.7935 144 145 144Z" fill="white"/>
          </svg>
          <div className="flex items-center gap-16 p-0">
            <CreationManualButton />
            {isLoggedIn ? (
              <AccountMenu
                nickname={currentUser.nickname ?? ''}
                phone={currentUser.phone_bound ? (currentUser.phone ?? '已绑定') : '未绑定'}
                wechat={currentUser.wechat_bound ? (currentUser.wechat ?? '已绑定') : '未绑定'}
                avatarUrl={currentUser.avatar_url ?? ''}
                onLogout={handleLogout}
                onOpenProfile={() => setProfileOpen(true)}
              />
            ) : (
              <LoginButton onClick={() => setLoginOpen(true)} />
            )}
          </div>
        </div>
        ) : (
        <WorkflowHeadbar
          activeStep={activeStep}
          onStepChange={setActiveStep}
          unlockedSteps={unlockedSteps}
          isLoggedIn={isLoggedIn}
          currentUser={currentUser}
          onLoginClick={() => setLoginOpen(true)}
          onLogout={handleLogout}
          onOpenProfile={() => setProfileOpen(true)}
          onLogoClick={() => {
            setActiveProject(null);
            setActiveProjectId(null);
            setActiveKey('home');
            localStorage.removeItem('miioo_active_project_id');
            localStorage.removeItem('miioo_active_step');
          localStorage.removeItem('miioo_active_key');
          }}
        />
        )}

        {/* body: nav + content */}
        <div className="flex flex-1 min-h-0 overflow-hidden self-stretch w-auto">
          {/* primary navigation */}
          <div className="flex flex-col items-start gap-0 px-[16px] self-stretch w-auto" style={{ position: 'relative', zIndex: 10 }}>
            <div
              className="flex flex-col items-start justify-center py-24 flex-1"
              style={{
                paddingLeft: '0px',
                paddingRight: '0px',
                transition: 'padding-left 320ms cubic-bezier(0.4, 0, 0.2, 1), padding-right 320ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <PrimaryNav items={NAV_ITEMS} activeKey={activeKey} onChange={handleNavChange} variant="vertical" />
            </div>

            {/* bottom icon group */}
            <div
              className="py-24"
              style={{
                paddingLeft: '0px',
                paddingRight: '0px',
                                alignSelf: 'stretch',
                transition: 'padding-left 320ms cubic-bezier(0.4, 0, 0.2, 1), padding-right 320ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <PrimaryNav
                items={bottomNavItems}
                activeKey={bottomActiveKey}
                onChange={handleBottomNavChange}
                variant="compact"
              />
            </div>
          </div>

          {/* page content */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative">
            {activeKey === 'home' && (
              <>
                <HomeSloganText />
                <StartCreationButton onClick={() => {
                  if (!isLoggedIn) { setLoginOpen(true); return; }
                  setNewProjectOpen(true);
                }} />
              </>
            )}
            {activeKey === 'project' && isLoadingProject && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DotsLoading size={6} color="#2DC3E1" gap={5} />
              </div>
            )}
            {activeKey === 'project' && !activeProject && !isLoadingProject && projectsLoaded && (
              <ProjectList
                projects={projects}
                onNewProject={() => {
                  if (!isLoggedIn) { setLoginOpen(true); return; }
                  if (!apiConfigured) { setNoModelNoticeOpen(true); return; }
                  setNewProjectOpen(true);
                }}
                onOpenProject={(p) => {
                  loadProjectDetails(p.id);
                  setActiveKey('project');
                }}
                onRenameProject={(projectId, newName) => {
                  apiUpdateProject(projectId, { name: newName }).then(() => {
                    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, name: newName } : p)));
                  });
                }}
                onDeleteProject={(projectId) => {
                  apiDeleteProject(projectId).then(() => {
                    setProjects((prev) => prev.filter((p) => p.id !== projectId));
                  });
                }}
              />
            )}
            {activeKey === 'project' && activeProject && activeStep !== 'subject' && activeStep !== 'storyboard' && (
              <GlobalSettings
                projectId={activeProject.id}
                projectName={activeProject.name}
                projectDescription={activeProject.description || activeProject.desc}
                projectCoverUrl={activeProject.cover_url || activeProject.cover}
                projectRatio={activeProject.aspect_ratio || activeProject.ratio}
                projectStyle={activeProject.visual_style || activeProject.style}
                onProjectUpdate={(updates) => {
                  return apiUpdateProject(activeProject.id, updates).then(() => {
                    // 字段映射：cover_url -> cover
                    const mappedUpdates = { ...updates };
                    if (updates.cover_url !== undefined) {
                      mappedUpdates.cover = updates.cover_url;
                      showToast('封面保存成功', 'success');
                    }
                    setActiveProject((prev) => ({ ...prev, ...mappedUpdates }));
                    setProjects((prev) => prev.map((p) => (p.id === activeProject.id ? { ...p, ...mappedUpdates } : p)));
                  });
                }}
                onBack={() => {
                  setActiveProject(null);
                  setActiveProjectId(null);
                  localStorage.removeItem('miioo_active_project_id');
                  localStorage.removeItem('miioo_active_step');
          localStorage.removeItem('miioo_active_key');
                }}
                showToast={showToast}
                activeStep={activeStep}
                onStepChange={setActiveStep}
                onUnlockStep={handleUnlockStep}
                isSubjectUnlocked={unlockedSteps.has('subject')}
                chars={sharedChars ?? []}
                scenes={sharedScenes ?? []}
                props={sharedProps ?? []}
                episodes={scriptEpisodes}
                onEpisodesChange={setScriptEpisodes}
                scriptPhase={scriptPhase}
                onScriptPhaseChange={setScriptPhase}
                scriptHasStarted={scriptHasStarted}
                onScriptHasStartedChange={setScriptHasStarted}
                scriptContent={scriptContent}
                onScriptContentChange={setScriptContent}
                scriptDraftContent={scriptDraftContent}
                onScriptDraftContentChange={setScriptDraftContent}
                onGoToSubject={(tab) => {
                  setSubjectInitialTab(tab ?? 'char');
                  setForceExtract(true);
                  handleUnlockStep('subject');
                  setActiveStep('subject');
                }}
                scriptFinalizedSinceExtraction={scriptFinalizedSinceExtraction}
                onScriptFinalized={handleScriptFinalized}
                episodeStatuses={episodeStatuses}
                onGoToStoryboard={(episodeIndex) => {
                  setStoryboardInitialEpisodeIndex(episodeIndex);
                  handleUnlockStep('storyboard');
                  setActiveStep('storyboard');
                }}
              />
            )}
            {activeKey === 'project' && activeProject && activeStep === 'subject' && (
              <SubjectPage
                projectRatio={activeProject.aspect_ratio || activeProject.ratio}
                projectId={activeProject.id}
                projectName={activeProject.name}
                onBack={() => {
                  setActiveProject(null);
                  setActiveProjectId(null);
                  localStorage.removeItem('miioo_active_project_id');
                  localStorage.removeItem('miioo_active_step');
          localStorage.removeItem('miioo_active_key');
                }}
                episodeName="第一集"
                onUnlockStep={handleUnlockStep}
                initialTab={subjectInitialTab}
                chars={sharedChars}
                onCharsChange={setSharedChars}
                scenes={sharedScenes}
                onScenesChange={setSharedScenes}
                props={sharedProps}
                onPropsChange={setSharedProps}
                isStoryboardGenerated={unlockedSteps.has('storyboard')}
                onStartStoryboard={() => {
                  handleUnlockStep('storyboard');
                  handleGenerateStoryboards();
                  setActiveStep('storyboard');
                }}
                onExtractSubjects={forceExtract ? handleExtractSubjects : undefined}
                extractError={extractError}
                onLoadMoreChars={() => loadMoreSubjects('character')}
                onLoadMoreScenes={() => loadMoreSubjects('scene')}
                onLoadMoreProps={() => loadMoreSubjects('prop')}
                hasMoreChars={subjectPageMeta.chars.hasMore}
                hasMoreScenes={subjectPageMeta.scenes.hasMore}
                hasMoreProps={subjectPageMeta.props.hasMore}
              />
            )}
            {activeKey === 'project' && activeProject && activeStep === 'storyboard' && (
              <StoryboardPage
                projectId={activeProject.id}
                projectName={activeProject.name}
                projectRatio={activeProject.aspect_ratio || activeProject.ratio}
                chars={sharedChars ?? []}
                scenes={sharedScenes ?? []}
                props={sharedProps ?? []}
                episodes={scriptEpisodes}
                initialEpisodeIndex={storyboardInitialEpisodeIndex}
                onUnlockStep={handleUnlockStep}
                onGenerateStoryboards={handleGenerateStoryboards}
                isGenerating={isGeneratingStoryboards}
                completedEpisodesCount={completedEpisodesCount}
                generateError={generateError}
                onVideoGenerated={(episodeIndex) => {
                  setEpisodeStatuses((prev) => {
                    if (prev[episodeIndex] === 'generated' || prev[episodeIndex] === 'edited') return prev;
                    return { ...prev, [episodeIndex]: 'generated' };
                  });
                }}
              />
            )}
            {activeKey === 'assets' && (
              <AssetsPage projects={projects} isLoggedIn={isLoggedIn} />
            )}
            {activeKey === 'create' && (
              <CreationPage
                isLoggedIn={isLoggedIn}
                onLoginClick={() => setLoginOpen(true)}
                apiConfigured={apiConfigured}
                onShowNoModelNotice={() => setNoModelNoticeOpen(true)}
              />
            )}
          </div>
        </div>
      </div>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={async () => {
        setLoginOpen(false);
        setIsLoggedIn(true);
        // 登录成功后立即拉取用户信息，确保头像菜单中手机号等绑定状态即时正确显示
        try {
          const user = await apiGetCurrentUser();
          setCurrentUser({ ...user, avatar_url: normalizeImageUrl(user.avatar_url) ?? '' });
        } catch {}
        apiGetProjects().then((data) => {
          const normalized = data.map((p) => ({ ...p, cover: p.cover ?? p.cover_url }));
          const sorted = [...normalized].sort((a, b) => {
            const timeA = new Date(a.created_at || 0).getTime();
            const timeB = new Date(b.created_at || 0).getTime();
            return timeB - timeA;
          });
          setProjects(sorted);
        }).catch(() => {});
        apiListProviders().then((data) => {
          const providers = Array.isArray(data) ? data : (data?.providers || []);
          if (providers.length > 0) setApiConfigured(true);
        }).catch(() => {});
      }} />
      <ApiConfigModal open={apiConfigOpen} onClose={() => setApiConfigOpen(false)} onConfigured={() => setApiConfigured(true)} />
      {noModelNoticeOpen && (
        <NoModelNotice
          onConfigureAPI={() => {
            setNoModelNoticeOpen(false);
            setApiConfigOpen(true);
          }}
          onViewTutorial={() => setNoModelNoticeOpen(false)}
          onClose={() => setNoModelNoticeOpen(false)}
        />
      )}
      <NotificationCenterModal
        open={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
        showToast={showToast}
      />
      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onLogout={handleLogout}
        currentUser={currentUser}
        onProfileUpdated={(updated) => setCurrentUser(prev => ({ ...prev, ...updated, avatar_url: normalizeImageUrl(updated.avatar_url ?? prev.avatar_url) ?? '' }))}
      />
      <NewProjectModal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onConfirm={(project) => {
          handleProjectCreated(project);
        }}
      />
      {watermarkSettingsOpen && (
        <WatermarkSettingsModal
          onClose={() => setWatermarkSettingsOpen(false)}
          showToast={showToast}
        />
      )}
      {toast && createPortal(
        <div style={{
          position: 'fixed',
          top: '25vh',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          pointerEvents: 'none',
          animation: 'slideUpBounce 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}>
          <div
            className="flex items-center gap-[8px] px-[16px] py-[8px] rounded-medium bg-toast-bg backdrop-blur-[20px]"
            style={{ whiteSpace: 'nowrap' }}
          >
            {toast.type === 'success' && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round" />
                <path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {toast.type === 'warning' && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#EB8B14" stroke="#EB8B14" strokeWidth="1.333" strokeLinejoin="round" />
                <path fillRule="evenodd" clipRule="evenodd" d="M8 12.333C8.46 12.333 8.833 11.96 8.833 11.5C8.833 11.04 8.46 10.667 8 10.667C7.54 10.667 7.167 11.04 7.167 11.5C7.167 11.96 7.54 12.333 8 12.333Z" fill="#FFFFFF" />
                <path d="M8 4V9.333" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#F75F5F" stroke="#F75F5F" strokeWidth="1.333" strokeLinejoin="round" />
                <path d="M5.333 5.333L10.667 10.667M10.667 5.333L5.333 10.667" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" />
              </svg>
            )}
            <span className="text-text-primary text-font-size-16 font-font-weight-regular" style={{ fontFamily: "'AlibabaPuHuiTi 2 55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif" }}>
              {toast.msg}
            </span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
