/**
 * 首页导航配置与图标展示。仅提供静态配置，不读取页面状态或执行导航副作用。
 */

import { QRCodePopup } from './HomeBottomMenus';

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
    tooltip: '配置API Key',
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
const BG_VIDEOS = ["/video/bg-video-01.mp4", "/video/bg-video-02.mp4", "/video/bg-video-03.mp4", "/video/bg-video-04.mp4", "/video/bg-video-05.mp4", "/video/bg-video-06.mp4", "/video/bg-video-07.mp4", "/video/bg-video-08.mp4"];

export { NAV_ITEMS, BOTTOM_NAV_ITEMS, BG_VIDEOS };
