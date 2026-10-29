/**
 * @file ApiConfigModal.jsx
 * @structure-index
 *
 * ─── 通用配置组件 ────────────────────────────────────────────────
 *   ConfigModelModal()       服务商 API Key、模型 Tab 与保存操作      L707
 *   PrimaryButton()          弹窗主按钮视觉和禁用状态                 L225
 *
 * ─── 页面级状态与动作 ────────────────────────────────────────────
 *   ApiConfigModal()         每次打开创建独立配置会话                 L949
 *   testConnection()        主服务商配置写入互斥、归属和补读           L1174
 *   toggleOtherProvider()    服务商开关即时显示、排队和失败核对       L1425
 *   beginOtherModelMutation() 模型写入互斥、认证与会话归属            L1551
 *   saveOneLinkConfig()      OneLinkAI 等待写入后保存退出             L1662
 *
 * ─── 更新记录 ───────────────────────────────────────────────────
 *   2026-10-29  推荐横幅独立为动态背景、本地客服二维码及标题官网链接。
 *   2026-10-23  乙方案：服务商开关排队核对，其他模型写入隔离及补读版本保护。
 *   2026-10-22  其他服务商严格测试结果，保存失败停止，输入与会话隔离在途结果。
 *   2026-10-22  初始化成功后开放配置，失败可重试；其他服务商读取隔离迟到响应。
 *   2026-10-22  主模型写入成功后更新；读取和写入增加请求归属及重复提交保护。
 *   2026-10-12  编辑服务商模型三动作移出状态更新函数，失败保留列表并提示。
 *   2026-08-26  OneLinkAI API Key 清空时禁用保存并显示原因 Tooltip
 *   2026-09-28  严格校验连接结果，新密钥测试通过后才允许保存；忽略过期测试
 *   保留原因：服务商会话、认证及读写编排集中维护，本批不混入历史弹窗结构迁移。
 *   后续拆分边界：配置子弹窗；验证范围：测试、输入变更、保存及请求竞态；2026-10-23 增加规范实体与跨服务商默认同步。
 *   2026-10-23  主服务商共享在途锁；补读等待、认证归属及新增草稿保护。
 */
import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Toggle from './Toggle';
import ApiRecommendationBanner from './apiConfig/ApiRecommendationBanner';
import ConfirmDialog from './ConfirmDialog';
import Tooltip from './ui/Tooltip';
import RemoteReadStatus from './feedback/RemoteReadStatus';
import { apiOneClickSetup, apiCreateModel, apiCreateProvider, apiListModels, apiUpdateModel, apiDeleteModel, apiListProviders, apiTestConnection, apiUpdateProvider, apiGetCardVisibility } from '../api/config';
import { getToken, getAuthSessionGeneration } from '../api/request.js';
import { createProviderEnableQueue } from '../api/ProviderEnableQueue.js';
import { applyModelResult, validateModelResult } from '../utils/ModelConfigState.js';
// 全局 API 卡片背景图（本地打包，保证离线可用）
import globalApiBg from '../assets/api-global-bg.png';
import { showGlobalToast } from '../stores/toastStore';
import { DeleteIcon } from './ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const BUTTON_SHADOW_CLASS = 'shadow-[3px_3px_8px_var(--color-black-40)]';
const ACCENT_BUTTON_GRADIENT =
  'linear-gradient(in oklab 107.50999999999999deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)';
const PRIMARY_BUTTON_GRADIENT =
  'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)';
// OneLinkAI 高亮卡片主按钮渐变（白底青绿）
const CARD_ACCENT_BUTTON_GRADIENT =
  'linear-gradient(in oklab 108.35000000000002deg, oklab(63.1% 0.005 -0.180 / 40%) 24.34%, oklab(84.6% -0.114 0.031 / 0%) 86.04%)';
const MODEL_DESCRIPTION = 'GPT-5.2 是 GPT-5 系列最新一代旗舰级智能模型，在架构设计、推理能力和应用性能上实现重大突破。相比 GPT-5.1…';
const MODEL_TABS = ['对话模型', '图片模型', '视频模型', '配音模型', '音乐模型'];
// 跨弹窗会话保留在途锁，避免关闭重开后并发写同一服务商。
const providerTestPending = new Set();
const otherModelPending = new Map();
const primaryPending = new Map();
const getPrimaryPending = () => primaryPending.get(getAuthSessionGeneration());
function acquirePrimaryRequest(isCurrent) {
  const generation = getAuthSessionGeneration();
  if (primaryPending.has(generation)) return null;
  let complete;
  const done = new Promise(resolve => { complete = resolve; });
  const request = { isCurrent, done, finish() {
    if (primaryPending.get(generation) === request) primaryPending.delete(generation);
    complete();
  } };
  primaryPending.set(generation, request);
  return request;
}
const providerEnableQueue = createProviderEnableQueue({
  update: apiUpdateProvider, read: apiListProviders, getGeneration: getAuthSessionGeneration,
});
const pendingOtherModels = () => [
  ...[...otherModelPending].filter(([key]) => key.startsWith(`${getAuthSessionGeneration()}:`))
    .map(([, request]) => request.done),
  ...(getPrimaryPending() ? [getPrimaryPending().done] : []),
];
const TAB_SLIDE_DURATION = 220;

const CARD_KEY_NAMES = {
  onelink: 'OneLinkAI',
  minimax: 'MiniMax',
  aiping: 'AIPing',
  volcengine: 'Volcengine',
  vidu: 'Vidu',
  fal: 'Fal',
};

// 将后端 category 映射到前端 tab
function getCategoryTab(category) {
  const mapping = {
    'chat': '对话模型',
    'image': '图片模型',
    'video': '视频模型',
    'voice': '配音模型',
    'music': '音乐模型',
  };
  return mapping[category] || null;
}

// 将前端 tab 映射到后端 category
function getTabCategory(tab) {
  const mapping = {
    '对话模型': 'chat',
    '图片模型': 'image',
    '视频模型': 'video',
    '配音模型': 'voice',
    '音乐模型': 'music',
  };
  return mapping[tab] || null;
}
// const MAX_PROVIDER_CARDS = 9;
// const MAX_CUSTOM_PROVIDERS = MAX_PROVIDER_CARDS - 1;
// const PROVIDER_OPTIONS = [
//   { label: 'OpenAI Compatible', value: 'openai-compatible' },
//   { label: 'SiliconFlow', value: 'siliconflow' },
//   { label: 'Volcengine', value: 'volcengine' },
// ];

function createEmptyModelDraft() {
  return { name: '', identifier: '', note: '' };
}

// function createCustomProviderDraft() {
//   return { name: '', vendor: '', baseUrl: '', apiKey: '', models: [] };
// }

function sortModels(models) {
  return [...models].sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    if (a.enabled && !b.enabled) return -1;
    if (!a.enabled && b.enabled) return 1;
    if (a.enabled && b.enabled) {
      if (a.isNew && !b.isNew) return -1;
      if (!a.isNew && b.isNew) return 1;
    }
    if (!a.enabled && !b.enabled) {
      if (a.justDisabled && !b.justDisabled) return -1;
      if (!a.justDisabled && b.justDisabled) return 1;
    }
    return 0;
  });
}

function createEmptyModelsByTab() {
  return Object.fromEntries(MODEL_TABS.map((tab) => [tab, []]));
}

function createDefaultState() {
  return {
    mainConfigured: false,
    childView: null,
    onelinkEnabled: false,
    onelinkProviderId: null,
    onelinkCreatedAt: '---',
    activeModelTab: '对话模型',
    onelinkApiKey: '',
    onelinkApiKeyActual: '',
    onelinkKeyIsFromServer: false,
    apiTested: false,
    onelinkModelsByTab: createEmptyModelsByTab(),
    onelinkModelDraft: createEmptyModelDraft(),
    // Other providers from backend
    otherProviders: [],
    visibleCardKeys: ['onelink'], // card-visibility API 返回的可见卡片键
    activeOtherProviderId: null,
    editProviderApiKey: '',
    editProviderApiKeyActual: '',
    editProviderKeyIsFromServer: false,
    editProviderApiTested: false,
    editProviderModelsByTab: createEmptyModelsByTab(),
    editProviderModelDraft: createEmptyModelDraft(),
  };
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 text-text-primary">
      <path d="M2.667 2.667L13.333 13.333" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.667 13.333L13.333 2.667" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon({ className = 'h-[16px] w-[16px] text-white-80' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}


function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
      <path d="M14 8.667V13.333C14 13.701 13.701 14 13.333 14H2.667C2.298 14 2 13.701 2 13.333V2.667C2 2.298 2.298 2 2.667 2H7.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.667 8.907V11.333H7.106L14 4.436L11.565 2L4.667 8.907Z" stroke="#FFFFFF" strokeLinejoin="round" />
    </svg>
  );
}

function CardWatermark() {
  return (
    <svg width="123" height="123" viewBox="58 75.5 82 82" fill="none" xmlns="http://www.w3.org/2000/svg" className="pointer-events-none absolute left-[-9px] bottom-[-18px]">
      <path d="M121.043 104.998L109.978 93.934L76.782 127.129L87.847 138.194L121.043 104.998Z" fill="#647DF533" />
      <path d="M140.001 101.828L140.001 126.427C140.001 128.912 139.013 131.297 137.256 133.053L115.985 154.323C114.228 156.08 111.844 157.068 109.359 157.068L84.587 157.068L76.783 149.264L87.849 138.199L98.914 149.264L132.109 116.068L121.046 105.004L132.109 93.938L140.001 101.828Z" fill="#FFFFFF14" />
      <path d="M121.01 82.963L109.951 94.16L98.892 82.963L65.713 116.551L76.772 127.748L65.713 138.942L58 131.135L58 105.895C58 103.38 58.987 100.969 60.743 99.19L81.829 77.845C83.585 76.067 85.968 75.068 88.452 75.068L113.211 75.068L121.01 82.963Z" fill="#FFFFFF14" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
      <path d="M6.333 1.333H12.333L8.667 6H13.667L5.667 14.667L7.333 8.333H2.667L6.333 1.333Z" stroke="#FFFFFF" strokeLinejoin="round" />
    </svg>
  );
}

function PrimaryButton({ children, className = '', innerClassName = '', onClick, type = 'button', textClassName = '', disabled = false }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`group flex shrink-0 rounded-lg p-[1px] outline outline-1 outline-stroke-outline ${BUTTON_SHADOW_CLASS} ${className} disabled:opacity-40 disabled:pointer-events-none`}
      style={{ backgroundImage: PRIMARY_BUTTON_GRADIENT }}
    >
      <div className={`flex grow items-center justify-center gap-[4px] rounded-[7px] bg-btn-primary-bg-normal transition-colors group-hover:bg-btn-primary-bg-hover group-active:bg-btn-primary-bg-active ${innerClassName}`}>
        <div className={`shrink-0 text-sm/4.5 text-text-primary ${textClassName}`} style={{ fontFamily: FONT }}>
          {children}
        </div>
      </div>
    </button>
  );
}

function LegacyToast({ toasts }) {
  return (
    <div style={{ position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', pointerEvents: 'none' }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center gap-[8px] px-[16px] py-[8px] rounded-medium bg-toast-bg backdrop-blur-[20px]"
          style={{ whiteSpace: 'nowrap', animation: 'slideUpBounce 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
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
          <span className="text-text-primary text-font-size-16 font-font-weight-regular" style={{ fontFamily: FONT }}>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

void LegacyToast;

// ConfirmDeleteModal 已迁移至 ConfirmDialog 共享组件

function CardIconButton({ icon, onClick, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group flex flex-col rounded-lg shrink-0 [box-shadow:#00000066_3px_3px_8px] [outline:1px_solid_#00000080] p-px size-[32px] disabled:opacity-40 disabled:pointer-events-none"
      style={{ backgroundImage: PRIMARY_BUTTON_GRADIENT }}
    >
      <div className="flex items-center grow shrink basis-[0%] rounded-[7px] gap-[4px] justify-center bg-[#161616] transition-colors group-hover:bg-btn-primary-bg-hover group-active:bg-btn-primary-bg-active">
        {icon}
      </div>
    </button>
  );
}

function CardTextButton({ icon, label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group flex flex-col h-[32px] rounded-lg [box-shadow:#00000066_3px_3px_8px] [outline:1px_solid_#00000080] p-px disabled:opacity-40 disabled:pointer-events-none"
      style={{ backgroundImage: PRIMARY_BUTTON_GRADIENT }}
    >
      <div className="flex items-center grow shrink basis-[0%] rounded-[7px] px-[16px] gap-[4px] justify-center bg-[#161616] transition-colors group-hover:bg-btn-primary-bg-hover group-active:bg-btn-primary-bg-active">
        {icon}
        <div className="inline-block w-max shrink-0 text-[#FFFFFFCC] text-sm/4.5" style={{ fontFamily: FONT }}>
          {label}
        </div>
      </div>
    </button>
  );
}

function CardDeleteButton({ onClick, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="shrink-0 transition-opacity hover:opacity-70 active:opacity-40 disabled:pointer-events-none"
      aria-label="删除服务商"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
        <path d="M3 3.333V14.667H13V3.333H3Z" stroke={disabled ? '#A5A5A5' : '#D13A3B'} strokeLinejoin="round" />
        <path d="M6.667 6.667V11" stroke={disabled ? '#A5A5A5' : '#D13A3B'} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.333 6.667V11" stroke={disabled ? '#A5A5A5' : '#D13A3B'} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M1.333 3.333H14.667" stroke={disabled ? '#A5A5A5' : '#D13A3B'} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke={disabled ? '#A5A5A5' : '#D13A3B'} strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// StatusSwitch → 统一使用共享 Toggle，适配 on/onClick 接口
function StatusSwitch({ on, onClick }) {
  return <Toggle value={on} onChange={onClick} />;
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-[8px] self-stretch">
      <div className="shrink-0 text-sm/4.5 text-[#FFFFFF99]" style={{ fontFamily: FONT }}>
        {label}
      </div>
      <div className="shrink-0 text-sm/4.5 text-white" style={{ fontFamily: FONT }}>
        {value}
      </div>
    </div>
  );
}

function TextInput({ value, onChange, placeholder, readOnly = false, disabled = false }) {
  const baseClassName = disabled
    ? 'h-9 w-full rounded-lg bg-input-bg-disabled px-[12px] pr-[6px] text-sm/4.5 text-input-text-hint outline outline-1 outline-stroke-outline placeholder:text-input-text-hint'
    : readOnly
      ? 'h-9 w-full rounded-lg bg-neutral-300 px-[12px] pr-[6px] text-sm/4.5 text-text-hint outline outline-1 outline-stroke-outline transition-colors hover:outline-stroke-accent focus:outline-stroke-active'
      : 'h-9 w-full rounded-lg border border-solid border-input-border-normal bg-input-bg-normal px-[12px] pr-[6px] text-sm/4.5 text-input-text-content outline outline-1 outline-stroke-outline transition-colors placeholder:text-text-hint hover:border-input-border-hover hover:bg-input-bg-hover focus:border-input-border-focus focus:bg-input-bg-focus focus:[box-shadow:0px_0px_10px_var(--color-glow)] focus:[mix-blend-mode:lighten]';
  return (
    <input
      type="text"
      readOnly={readOnly}
      disabled={disabled}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={baseClassName}
      style={{ fontFamily: FONT }}
    />
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col items-start gap-[4px] self-stretch">
      <div className="self-stretch text-sm/4.5 text-text-secondary" style={{ fontFamily: FONT }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// function ProviderSelect({ value, onChange }) {
//   const [open, setOpen] = useState(false);
//   const containerRef = useRef(null);
//   const selectedOption = PROVIDER_OPTIONS.find((option) => option.value === value);
//   useEffect(() => {
//     if (!open) return undefined;
//     const handlePointerDown = (event) => {
//       if (!containerRef.current?.contains(event.target)) setOpen(false);
//     };
//     window.addEventListener('pointerdown', handlePointerDown);
//     return () => window.removeEventListener('pointerdown', handlePointerDown);
//   }, [open]);
//   return (
//     <div ref={containerRef} className="relative self-stretch">
//       ...
//     </div>
//   );
// }

const CARD_BASE = 'relative flex flex-col justify-center gap-3 px-[16px] py-3 rounded-lg h-[280px] overflow-clip text-xs/4 cursor-pointer transition-colors';
// OneLinkAI 高亮变体（蓝紫底 + 描边）
const CARD_VARIANT_ONELINK = 'bg-[#647DF533] border border-solid border-[#647DF580] hover:bg-[#647DF566] active:bg-[#647DF54D]';
// 其他服务商普通变体（深色底）
const CARD_VARIANT_DEFAULT = 'bg-[#FFFFFF0F] hover:bg-[#FFFFFF1A] active:bg-[#FFFFFF0A]';

// 卡片内白色主按钮（用于 OneLinkAI 高亮卡片）
function CardAccentButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 shrink-0 items-center justify-center gap-[4px] rounded-lg border border-solid border-[#FFFFFFCC] bg-white bg-origin-border px-[16px] transition-[filter] hover:brightness-105 active:brightness-95"
      style={{ backgroundImage: CARD_ACCENT_BUTTON_GRADIENT }}
    >
      <div className="shrink-0 text-center text-base/5 font-medium text-[#090909]" style={{ fontFamily: FONT_MEDIUM }}>
        {children}
      </div>
    </button>
  );
}

function InitialProviderCard({ onConfigure, onToggle }) {
  return (
    <div className={`${CARD_BASE} ${CARD_VARIANT_ONELINK}`} onClick={onConfigure}>
      <CardWatermark />
      <div className="relative flex items-center justify-between gap-3 self-stretch">
        <div className="flex-1 text-base/5 font-medium text-white" style={{ fontFamily: FONT_MEDIUM }}>
          OneLinkAI
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <StatusSwitch on={false} onClick={onToggle} />
        </div>
      </div>
      <div className="relative flex flex-1 items-center justify-center self-stretch">
        <CardAccentButton onClick={(e) => { e.stopPropagation(); onConfigure(); }}>
          开始配置
        </CardAccentButton>
      </div>
    </div>
  );
}

function UnconfiguredProviderCard({ name, onConfigure }) {
  return (
    <div className={`${CARD_BASE} ${CARD_VARIANT_DEFAULT}`} onClick={onConfigure}>
      <div className="flex items-center justify-between gap-3 self-stretch">
        <div className="flex-1 text-base/5 font-medium text-white" style={{ fontFamily: FONT_MEDIUM }}>
          {name}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <StatusSwitch on={false} onClick={onConfigure} />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center self-stretch">
        <PrimaryButton className="h-9" innerClassName="px-[15px]" textClassName="text-[#FFFFFFCC]" onClick={(e) => { e.stopPropagation(); onConfigure(); }}>
          开始配置
        </PrimaryButton>
      </div>
    </div>
  );
}

function ConfiguredProviderCard({ title, modelCount, date, enabled, onEdit, onTest, onToggle, deletable = false, onDelete, isOneLink = false }) {
  return (
    <div className={`${CARD_BASE} ${isOneLink ? CARD_VARIANT_ONELINK : CARD_VARIANT_DEFAULT}`} onClick={onEdit}>
      {isOneLink && <CardWatermark />}
      <div className="relative flex items-center gap-3 self-stretch justify-between">
        <div className="flex-1 font-medium text-white text-base/5" style={{ fontFamily: FONT_MEDIUM }}>
          {title}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <StatusSwitch on={enabled} onClick={onToggle} />
        </div>
      </div>
      <div className="relative flex flex-col items-start gap-3 self-stretch flex-1">
        <InfoRow label="已配置模型" value={`${modelCount}个`} />
        <InfoRow label="添加时间" value={date} />
      </div>
      <div
        className={`relative flex items-center self-stretch h-[32px] shrink-0 ${deletable ? 'justify-between gap-[16px]' : 'justify-end gap-[32px]'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {deletable && <CardDeleteButton onClick={onDelete} disabled={enabled} />}
        <div className="flex items-start gap-[12px]">
          <CardIconButton icon={<EditIcon />} onClick={onEdit} />
          <CardTextButton icon={<BoltIcon />} label="测试" onClick={onTest} />
        </div>
      </div>
    </div>
  );
}

// function CustomProviderCard({ configured, enabled, modelCount, providerName, onConfigure, onEdit, onToggle, onDelete, onTest }) {
//   if (configured) {
//     return (
//       <ConfiguredProviderCard
//         title={providerName}
//         modelCount={modelCount}
//         date="2026-01-01"
//         enabled={enabled}
//         onEdit={onEdit}
//         onTest={onTest}
//         onToggle={onToggle}
//         deletable
//         onDelete={onDelete}
//       />
//     );
//   }
//   return (
//     <div className={CARD_BASE} onClick={onConfigure}>
//       <SecondaryButton icon={<PlusIcon />} onClick={(e) => { e.stopPropagation(); onConfigure(); }}>
//         自定义服务商
//       </SecondaryButton>
//     </div>
//   );
// }

function MainModal({
  readStatus,
  onRetry,
  configured,
  onelinkEnabled,
  onelinkModelsByTab,
  onelinkCreatedAt,
  onClose,
  onOpenOneLink,
  onComplete,
  onEditOneLink,
  onToggleOneLink,
  onTestOneLink,
  otherProviders = [],
  onEditOtherProvider,
  onToggleOtherProvider,
  onTestOtherProvider,
  onConfigureOtherProvider,
}) {
  return (
    <div className="[font-synthesis:none] flex h-[600px] w-[800px] max-w-[calc(100vw-48px)] flex-col overflow-hidden text-xs/4 antialiased">
      <div className="flex items-center justify-between gap-[16px] rounded-t-2xl bg-surface-modal px-[24px] py-[16px]">
        <div className="flex-1 text-base/5 font-medium text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
          配置API Key
        </div>
        <button type="button" onClick={onClose} className="flex shrink-0 items-center justify-center transition-opacity hover:opacity-80 active:opacity-60" aria-label="关闭配置API Key">
          <CloseIcon />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[16px] overflow-y-auto bg-surface-modal px-[24px] py-[8px]">
        <ApiRecommendationBanner />
        {readStatus !== 'ready' ? (
          <RemoteReadStatus loading={readStatus === 'loading'} error={readStatus === 'error' ? '配置读取失败，请重试' : ''} onRetry={onRetry} />
        ) : <>

        <div className="flex flex-col gap-[8px] self-stretch">
          <div className="self-stretch text-sm/4.5 font-medium text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
            API服务商
          </div>
          <div className="flex flex-wrap items-start gap-[16px] self-stretch">
            <div className="w-[calc((100%-32px)/3)]">
              {configured ? (
                <ConfiguredProviderCard
                  title="OneLinkAI"
                  modelCount={Object.values(onelinkModelsByTab ?? {}).reduce((sum, arr) => sum + arr.length, 0)}
                  date={onelinkCreatedAt || '---'}
                  enabled={onelinkEnabled}
                  onEdit={onEditOneLink}
                  onTest={onTestOneLink}
                  onToggle={onToggleOneLink}
                  isOneLink
                />
              ) : (
                <InitialProviderCard onConfigure={onOpenOneLink} onToggle={onOpenOneLink} />
              )}
            </div>

            {otherProviders.map(provider => (
              <div key={provider.id} className="w-[calc((100%-32px)/3)]">
                {provider.configured ? (
                  <ConfiguredProviderCard
                    title={provider.name}
                    modelCount={Object.values(provider.modelsByTab ?? {}).reduce((sum, arr) => sum + arr.length, 0)}
                    date={provider.createdAt}
                    enabled={provider.enabled}
                    onEdit={() => onEditOtherProvider(provider.id)}
                    onTest={() => onTestOtherProvider(provider.id)}
                    onToggle={() => onToggleOtherProvider(provider.id)}
                  />
                ) : (
                  <UnconfiguredProviderCard name={provider.name} onConfigure={() => onConfigureOtherProvider?.(provider.cardKey)} />
                )}
              </div>
            ))}
          </div>
        </div>
        </>}
      </div>

      <div className="flex items-center justify-between gap-[16px] rounded-b-2xl bg-surface-modal px-[24px] py-[16px]">
        <div className="flex-1 text-xs leading-[150%] text-[#FFFFFFCC]" style={{ fontFamily: FONT }}>
          平台已内置OneLinkAI服务商的多个主流模型，前往官网获取API后即可一键完成配置。
          <br />
          如果您有其他厂商的API接入需求，请联系我们。
        </div>
        <PrimaryButton className="h-9" innerClassName="px-[15px]" onClick={onComplete}>
          完成
        </PrimaryButton>
      </div>
    </div>
  );
}

function NestedModal({ title, children, footer, onClose, wide = false }) {
  return (
    <div className={`[font-synthesis:none] flex h-[600px] ${wide ? 'w-[800px]' : 'w-[400px]'} max-w-[calc(100vw-80px)] flex-col overflow-hidden text-xs/4 antialiased`} onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between gap-[16px] rounded-t-2xl bg-surface-modal px-[24px] py-[16px]">
        <div className="flex-1 text-base/5 font-medium text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
          {title}
        </div>
        <button type="button" onClick={onClose} className="flex shrink-0 items-center justify-center transition-opacity hover:opacity-80 active:opacity-60">
          <CloseIcon />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-[16px] overflow-y-auto bg-surface-modal px-[24px] py-[8px]">{children}</div>
      <div className="flex items-center justify-end gap-[16px] rounded-b-2xl bg-surface-modal px-[24px] py-[16px]">
        {footer}
      </div>
    </div>
  );
}

function ModelTabs({ activeTab, onChange }) {
  return (
    <div className="flex items-center gap-[8px] self-stretch">
      {MODEL_TABS.map((tab) => {
        const active = tab === activeTab;
        return (
          <button
            key={tab}
            type="button"
            className={`flex items-center justify-center gap-[8px] rounded-t-lg px-[24px] pt-[10px] pb-[8px] transition-colors ${active ? 'bg-[#FFFFFF0D]' : 'hover:opacity-80 active:opacity-60'}`}
            onClick={() => onChange(tab)}
          >
            <div
              className={active ? 'text-base/5 font-medium text-[#2DC3E1]' : 'text-sm/5 text-[#FFFFFF80]'}
              style={{ fontFamily: active ? FONT_MEDIUM : FONT, fontWeight: active ? 500 : 400 }}
            >
              {tab}
            </div>
          </button>
        );
      })}
    </div>
  );
}

const ModelCard = forwardRef(function ModelCard({ model, onToggle, onDelete, onSetDefault, animating = false }, ref) {
  return (
    <div
      ref={ref}
      className="flex flex-col justify-center gap-[6px] self-stretch rounded-lg p-[12px] transition-colors hover:bg-[#FFFFFF0D]"
      style={animating ? { animation: 'model-card-disable 280ms ease' } : undefined}
    >
      <div className="flex items-center gap-1.5 justify-between self-stretch">
        <div className="flex items-center gap-[12px]">
          <div className="w-fit shrink-0 font-medium text-white text-sm/4.5" style={{ fontFamily: FONT_MEDIUM }}>
            {model.name}
          </div>
          <button
            type="button"
            onClick={onSetDefault}
            className={`flex h-[24px] shrink-0 items-center justify-center rounded-md border px-[8px] text-xs/4 transition-colors disabled:pointer-events-none disabled:opacity-50 ${
              model.isDefault
                ? 'border-[#2DC3E133] bg-[#2DC3E11A] text-[#2DC3E1]'
                : 'border-[#FFFFFF14] bg-[#FFFFFF08] text-[#FFFFFFCC] hover:bg-[#FFFFFF10] active:bg-[#FFFFFF08]'
            }`}
            style={{ fontFamily: model.isDefault ? FONT_MEDIUM : FONT }}
          >
            {model.isDefault ? '默认中' : '设为默认'}
          </button>
        </div>
        <div className="flex items-center gap-3 justify-end">
          <StatusSwitch on={model.enabled} onClick={onToggle} onLabel="启用" />
          {!model.enabled && (
            <button
              type="button"
              onClick={onDelete}
              className="transition-opacity hover:opacity-70 active:opacity-40"
              aria-label="删除模型"
            >
              <DeleteIcon size={16} color="#D13A3B" />
            </button>
          )}
        </div>
      </div>
      <div className="self-stretch text-[#FFFFFF99] text-xs/4" style={{ fontFamily: FONT }}>
        {model.description}
      </div>
    </div>
  );
});

function ConfigModelModal({
  title,
  apiValue,
  apiPlaceholder,
  onApiChange,
  apiDisabled = false,
  activeTab,
  onChangeTab,
  modelsByTab,
  onAddModel,
  onCancel,
  onSave,
  onToggleModel,
  onDeleteModel,
  onSetDefaultModel,
  onTest,
  apiTested = false,
  saveDisabled = false,
  saveDisabledTooltip = '',
}) {
  const activeTabIndex = Math.max(MODEL_TABS.indexOf(activeTab), 0);
  const [disablingId, setDisablingId] = useState(null);
  const cardRefs = useRef({});
  const pendingFlip = useRef(false);
  const prevPositions = useRef({});

  const activeModels = useMemo(() => modelsByTab[activeTab] ?? [], [modelsByTab, activeTab]);

  const snapshotPositions = useCallback(() => {
    prevPositions.current = {};
    for (const [id, el] of Object.entries(cardRefs.current)) {
      if (el) prevPositions.current[id] = el.getBoundingClientRect().top;
    }
  }, []);

  useLayoutEffect(() => {
    if (!pendingFlip.current) return;
    pendingFlip.current = false;
    for (const [id, el] of Object.entries(cardRefs.current)) {
      if (!el || prevPositions.current[id] == null) continue;
      const delta = prevPositions.current[id] - el.getBoundingClientRect().top;
      if (Math.abs(delta) < 1) continue;
      el.style.transition = 'none';
      el.style.transform = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)';
          el.style.transform = 'translateY(0)';
      });
      });
    }
  }, [activeModels]);

  const handleToggleModel = useCallback((modelId) => {
    const model = activeModels.find((m) => m.id === modelId);
    if (model?.enabled) {
      // 关闭启用 → 下移动画
      snapshotPositions();
      setDisablingId(modelId);
      setTimeout(() => {
        pendingFlip.current = true;
        setDisablingId(null);
        onToggleModel(modelId);
      }, 260);
    } else {
      // 打开启用 → 上移动画
      snapshotPositions();
      setTimeout(() => {
        pendingFlip.current = true;
        onToggleModel(modelId);
      }, 0);
    }
  }, [activeModels, onToggleModel, snapshotPositions]);

  const handleSetDefaultModel = useCallback((modelId) => {
    snapshotPositions();
    setTimeout(() => {
      pendingFlip.current = true;
      onSetDefaultModel(modelId);
    }, 0);
  }, [onSetDefaultModel, snapshotPositions]);

  return (
    <NestedModal
      title={title}
      onClose={onCancel}
      wide
      footer={
        saveDisabled && saveDisabledTooltip ? (
          <Tooltip label={saveDisabledTooltip}>
            <PrimaryButton className="h-9" innerClassName="px-[15px]" onClick={onSave} disabled>
              保存
            </PrimaryButton>
          </Tooltip>
        ) : (
          <PrimaryButton className="h-9" innerClassName="px-[15px]" onClick={onSave} disabled={saveDisabled}>
            保存
          </PrimaryButton>
        )
      }
    >
      <div className="flex min-h-0 flex-1 flex-col items-start gap-[12px] self-stretch">
      <div
        className="flex shrink-0 flex-col items-start gap-[12px] self-stretch rounded-lg px-[16px] py-[12px]"
        style={{ backgroundImage: `url(${globalApiBg})`, backgroundSize: 'cover', backgroundPosition: '50%' }}
      >
        <div className="self-stretch text-base/5 font-medium text-white" style={{ fontFamily: FONT_MEDIUM }}>
          全局 API
        </div>
        <div className="flex items-center gap-[18px] self-stretch">
          <input
            type="text"
            value={apiValue}
            onChange={apiDisabled ? undefined : onApiChange}
            placeholder={apiPlaceholder}
            disabled={apiDisabled}
            className="h-[36px] min-w-0 flex-1 rounded-full border border-solid border-[#71E0FA66] bg-[#00000066] px-[18px] text-xs text-[#FFFFFFE6] shadow-[inset_0px_2px_3px_#00000066] outline-none placeholder:text-[#FFFFFF80] disabled:cursor-not-allowed"
            style={{ fontFamily: FONT, lineHeight: '150%' }}
          />
          <button
            type="button"
            onClick={onTest}
            className="flex h-[30px] shrink-0 items-center justify-center gap-[4px] rounded-full border border-solid border-[#71E0FA66] bg-white bg-origin-border px-[12px] outline outline-1 outline-[#71E0FA66] transition-opacity hover:opacity-90 active:opacity-80"
            style={{ backgroundImage: ACCENT_BUTTON_GRADIENT }}
          >
            <div className="text-center text-sm/4.5 font-medium text-[#000000CC]" style={{ fontFamily: FONT_MEDIUM }}>
              测试链接
            </div>
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-start self-stretch overflow-hidden min-h-0">
        <ModelTabs activeTab={activeTab} onChange={onChangeTab} />
        <div className="w-full flex-1 overflow-hidden min-h-0 rounded-b-lg rounded-tr-lg bg-[#FFFFFF0D] px-[12px] py-[6px]">
          <div className="h-full overflow-x-hidden">
            <div
              className="flex h-full will-change-transform"
              style={{
                width: `${MODEL_TABS.length * 100}%`,
                transform: `translateX(-${activeTabIndex * (100 / MODEL_TABS.length)}%)`,
                transition: `transform ${TAB_SLIDE_DURATION}ms ease`,
              }}
            >
              {MODEL_TABS.map((tab) => {
              const tabModels = modelsByTab[tab] ?? [];
              const tabShowEmptyState = !apiTested && tabModels.length === 0;
              return (
                <div key={tab} className="flex shrink-0 flex-col gap-[2px] overflow-y-auto" style={{ width: `${100 / MODEL_TABS.length}%`, height: '100%' }}>
                  {tabShowEmptyState ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-[8px]">
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M37 22L34 25L23 14L26 11C28 9 33 7 37 11C41 15 38.5 20 37 22Z" fill="#2D2D2D" stroke="#2D2D2D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M42 6L37 11" stroke="#2D2D2D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M11 26L14 23L25 34L22 37C20 39 15 41 11 37C7 33 9.5 28 11 26Z" fill="#2D2D2D" stroke="#2D2D2D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M23 32L27 28" stroke="#2D2D2D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M6 42L11 37" stroke="#2D2D2D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M16 25L20 21" stroke="#2D2D2D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <div className="text-xs text-[#FFFFFF66]" style={{ fontFamily: FONT }}>
                        请先配置API Key
                      </div>
                    </div>
                  ) : (
                    <>
                      {tabModels.map((model) => (
                        <ModelCard
                          key={model.id ?? model.modelId}
                          ref={(el) => { if (tab === activeTab) cardRefs.current[model.id ?? model.modelId] = el; }}
                          model={model}
                          animating={tab === activeTab && disablingId === model.id}
                          onToggle={() => handleToggleModel(model.id)}
                          onDelete={() => onDeleteModel(model.id)}
                          onSetDefault={() => handleSetDefaultModel(model.id)}
                        />
                      ))}
                      {apiTested && tabModels.length < 30 && (
                        <div className="flex shrink-0 flex-col self-stretch py-[6px]">
                          <button
                            type="button"
                            onClick={onAddModel}
                            className="flex h-9 w-full shrink-0 items-center justify-center gap-[4px] rounded-lg bg-[#FFFFFF0D] px-[16px] outline-none transition-colors hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active"
                            style={{ border: '1px dashed #FFFFFF1F' }}
                          >
                            <PlusIcon className="h-[16px] w-[16px] text-[#FFFFFF99]" />
                            <div className="shrink-0 text-center text-xs/4 text-[#FFFFFF99]" style={{ fontFamily: FONT }}>
                              添加模型
                            </div>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
              })}
            </div>
          </div>
        </div>
      </div>
      </div>
    </NestedModal>
  );
}

function EditModelModal({ draft, onChange, onCancel, onSave, title = '添加模型' }) {
  const canSave = draft.name.trim() !== '' && draft.identifier.trim() !== '' && draft.note.trim() !== '';
  return (
    <NestedModal
      title={title}
      onClose={onCancel}
      footer={
        <PrimaryButton className="h-9" innerClassName="px-[15px]" onClick={onSave} disabled={!canSave}>
          添加并启用
        </PrimaryButton>
      }
    >
      <Field label="名称">
        <TextInput value={draft.name} onChange={(event) => onChange('name', event.target.value)} placeholder="请输入" />
      </Field>
      <Field label="模型标识">
        <TextInput value={draft.identifier} onChange={(event) => onChange('identifier', event.target.value)} placeholder="请输入" />
      </Field>
      <Field label="关联链接">
        <TextInput value="自动获取，不可修改" onChange={() => undefined} disabled />
      </Field>
      <Field label="备注">
        <TextInput value={draft.note} onChange={(event) => onChange('note', event.target.value)} placeholder="请输入" />
      </Field>
    </NestedModal>
  );
}

// function CustomProviderModal({ draft, onChange, onCancel, onAdd }) {
//   const canAdd = draft.name.trim() !== '' && draft.vendor !== '' && draft.baseUrl.trim() !== '' && draft.apiKey.trim() !== '';
//   return (
//     <NestedModal title="自定义API服务商" onClose={onCancel} footer={...}>
//       ...
//     </NestedModal>
//   );
// }

export default function ApiConfigModal({ open, onClose, onConfigured }) {
  if (!open) return null;
  return <ApiConfigSession open={open} onClose={onClose} onConfigured={onConfigured} />;
}

function ApiConfigSession({ open, onClose, onConfigured }) {
  const [state, setState] = useState(createDefaultState);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [readStatus, setReadStatus] = useState('loading');
  const initializationRequest = useRef(null);
  const otherProviderRequest = useRef(null);
  const primaryReadRequest = useRef(null);
  const providerInputRevision = useRef(0);
  const oneLinkTestRequest = useRef(0);
  const modelScope = useRef(0);
  const modelRevision = useRef(0);
  const primaryMutation = useRef(null);
  const providerSession = useRef(0);

  useLayoutEffect(() => {
    providerSession.current += 1;
    return () => { providerSession.current += 1; };
  }, []);

  const captureProviderScope = () => {
    const session = providerSession.current;
    const auth = getAuthSessionGeneration();
    return () => providerSession.current === session && getAuthSessionGeneration() === auth;
  };

  useLayoutEffect(() => {
    modelScope.current += 1;
    return () => { modelScope.current += 1; };
  }, [open]);

  const captureModelScope = useCallback(() => {
    const scope = modelScope.current;
    const auth = getAuthSessionGeneration();
    return () => modelScope.current === scope && getAuthSessionGeneration() === auth;
  }, []);

  useEffect(() => () => {
    oneLinkTestRequest.current += 1;
  }, [open]);

  const showToast = useCallback((type, message) => {
    showGlobalToast(type, message);
  }, []);

  const loadModelsFromBackend = useCallback(async (providerId, guard = () => true, reportFailure = false) => {
    if (primaryMutation.current?.isCurrent()) return;
    const isCurrent = captureModelScope();
    const revision = ++modelRevision.current;
    return apiListModels({ fresh: true }).then((models) => {
      if (!guard() || !isCurrent() || revision !== modelRevision.current) return;
      setState((current) => {
        if (!guard() || !isCurrent() || revision !== modelRevision.current) return current;
        const modelsByTab = createEmptyModelsByTab();
        models.forEach((model) => {
          if (model.provider_id !== (providerId || current.onelinkProviderId)) return;
          const tab = getCategoryTab(model.category);
          if (!tab) return;
          modelsByTab[tab].push({
            id: model.id,
            name: model.name || model.model_id,
            description: model.description || MODEL_DESCRIPTION,
            enabled: model.is_enabled ?? false,
            isDefault: model.is_default ?? false,
            modelId: model.model_id,
          });
      });
        return {
          ...current,
          onelinkModelsByTab: Object.fromEntries(
            Object.entries(modelsByTab).map(([tab, list]) => [tab, sortModels(list)])
          ),
        };
      });
      return true;
    }).catch((err) => {
      if (!guard() || !isCurrent() || revision !== modelRevision.current) return;
      if (reportFailure) throw err;
      showToast('error', '读取模型列表失败，请关闭配置后重试');
      console.error('加载模型列表失败:', err);
    });
  }, [captureModelScope, showToast]);

  const initializeFromBackend = useCallback(() => {
    if (initializationRequest.current?.isCurrent()) return;
    const isCurrent = captureModelScope();
    const revision = modelRevision.current;
    const request = { isCurrent };
    initializationRequest.current = request;
    setReadStatus('loading');
    if (!getToken()) {
      setReadStatus('error');
      initializationRequest.current = null;
      return;
    }
    Promise.all([
      (providerEnableQueue.hasPending() || pendingOtherModels().length
        ? Promise.all([providerEnableQueue.wait(), ...pendingOtherModels()]).then(() => {
        if (!isCurrent()) throw new Error('配置会话已失效');
        return apiListProviders();
        }) : apiListProviders()),
      (pendingOtherModels().length
        ? Promise.all(pendingOtherModels()).then(() => {
          if (!isCurrent()) throw new Error('配置会话已失效');
          return apiListModels({ fresh: true });
        }) : apiListModels({ fresh: true })),
      apiGetCardVisibility().catch(() => []),
    ]).then(([providersData, allModels, cardVisibility]) => {
      if (!getToken() || !isCurrent() || revision !== modelRevision.current) return;

      const rawList = Array.isArray(providersData) ? providersData : (providersData?.items ?? providersData?.providers);
      if (!Array.isArray(rawList)) throw new Error('服务商响应异常');
      const onelinkProvider = rawList.find(p => p.provider_type === 'onelink' || p.name === 'OneLinkAI');
      const otherProvidersList = rawList.filter(p => p !== onelinkProvider);

      // card-visibility 返回的可见卡片键（去掉 onelink，单独处理）
      const visibleKeys = cardVisibility.length > 0
        ? cardVisibility.filter(c => c.is_visible !== false).map(c => c.card_key)
        : ['onelink', ...otherProvidersList.map(p => p.provider_type).filter(Boolean)];
      const visibleCardKeys = visibleKeys.length > 0 ? visibleKeys : ['onelink'];

      // Group models by provider_id
      const groupedByProvider = {};
      (allModels || []).forEach(model => {
        const tab = getCategoryTab(model.category);
        if (!tab) return;
        const pid = model.provider_id;
        if (!groupedByProvider[pid]) groupedByProvider[pid] = createEmptyModelsByTab();
        groupedByProvider[pid][tab].push({
          id: model.id,
          name: model.name || model.model_id,
          description: model.description || MODEL_DESCRIPTION,
          enabled: model.is_enabled ?? false,
          isDefault: model.is_default ?? false,
          modelId: model.model_id,
      });
      });
      Object.values(groupedByProvider).forEach(byTab => {
        MODEL_TABS.forEach(tab => { if (byTab[tab]) byTab[tab] = sortModels(byTab[tab]); });
      });

      const defaults = createDefaultState();
      let onelinkUpdate = {
        mainConfigured: false, onelinkEnabled: false, onelinkProviderId: null,
        onelinkCreatedAt: defaults.onelinkCreatedAt, onelinkApiKey: '', onelinkApiKeyActual: '',
        onelinkKeyIsFromServer: false, apiTested: false, onelinkModelsByTab: createEmptyModelsByTab(),
      };
      if (onelinkProvider) {
        const maskedKey = onelinkProvider.api_key_masked || '';
        onelinkUpdate = {
          mainConfigured: true,
          onelinkEnabled: onelinkProvider.is_enabled ?? false,
          onelinkProviderId: onelinkProvider.id,
          onelinkCreatedAt: onelinkProvider.created_at ? onelinkProvider.created_at.slice(0, 10) : '---',
          onelinkApiKey: maskedKey,
          onelinkApiKeyActual: maskedKey,
          onelinkKeyIsFromServer: true,
          apiTested: true,
          ...(Array.isArray(allModels)
            ? { onelinkModelsByTab: groupedByProvider[onelinkProvider.id] || createEmptyModelsByTab() }
            : {}),
        };
      }

      // 所有非 onelink 的配置好的服务商，key 为 provider_type
      const configuredByType = {};
      otherProvidersList.forEach(p => {
        if (p.provider_type) configuredByType[p.provider_type] = p;
      });

      // 按 card-visibility 顺序构建 otherProviders（含未配置的可见服务商）
      const formattedOtherProviders = visibleCardKeys
        .filter(key => key !== 'onelink')
        .map(key => {
          const p = configuredByType[key];
          if (p) {
            return {
              id: p.id,
              cardKey: key,
              name: p.name || CARD_KEY_NAMES[key] || key,
              configured: true,
              enabled: p.is_enabled ?? false,
              createdAt: p.created_at ? p.created_at.slice(0, 10) : '---',
              apiKeyMasked: p.api_key_masked || '',
              modelsByTab: groupedByProvider[p.id] || createEmptyModelsByTab(),
            };
          }
          // 未配置但可见的服务商
        return {
            id: key,
            cardKey: key,
            name: CARD_KEY_NAMES[key] || key,
            configured: false,
            enabled: false,
            createdAt: '---',
            apiKeyMasked: '',
            modelsByTab: createEmptyModelsByTab(),
        };
      });

      setState(current => !isCurrent() ? current : ({
        ...current,
        ...onelinkUpdate,
        otherProviders: formattedOtherProviders.map((provider) => {
          if (Array.isArray(allModels)) return provider;
          const previousProvider = current.otherProviders.find((item) => item.cardKey === provider.cardKey);
          return previousProvider ? { ...provider, modelsByTab: previousProvider.modelsByTab } : provider;
        }),
        visibleCardKeys,
      }));
      setReadStatus('ready');

    }).catch(err => {
      if (!isCurrent() || revision !== modelRevision.current) return;
      setReadStatus('error');
      console.warn('初始化配置失败:', err);
    }).finally(() => {
      if (initializationRequest.current === request) initializationRequest.current = null;
    });
  }, [captureModelScope]);

  const testConnection = useCallback(async () => {
    if (pendingOtherModels().length || getPrimaryPending() || providerEnableQueue.has(state.onelinkProviderId)) {
      showToast('warning', '主服务商仍在处理请求，请稍候再试');
      return;
    }
    const requestId = ++oneLinkTestRequest.current;
    const scopeCurrent = captureModelScope();
    const isCurrent = () => scopeCurrent() && requestId === oneLinkTestRequest.current;
    const request = acquirePrimaryRequest(isCurrent);
    if (!request) return;
    modelRevision.current += 1;
    const fromServer = state.onelinkKeyIsFromServer && state.onelinkProviderId;
    let stage = fromServer ? 'test' : 'setup';
    setState((current) => ({ ...current, apiTested: false }));
    try {
      // key 来自后端（脱敏值），直接让后端用已存的 key 测试
      if (state.onelinkKeyIsFromServer && state.onelinkProviderId) {
        const result = await apiTestConnection(state.onelinkProviderId);
        if (!isCurrent()) return;
        const passed = result?.success === true;
        setState((current) => !isCurrent() ? current : ({ ...current, apiTested: passed }));
        showToast(passed ? 'success' : 'error', passed ? '连接成功！' : '当前key不可用');
        return;
      }

      const keyToTest = state.onelinkApiKeyActual.trim();
      if (!keyToTest) {
        showToast('error', '请先输入API');
        return;
      }
      const result = await apiOneClickSetup({ api_key: keyToTest });
      if (!isCurrent()) return;
      if (typeof result?.provider?.id !== 'string' || !result.provider.id.trim()
        || typeof result?.test_success !== 'boolean') throw new Error('配置响应异常');
      const passed = result.test_success === true;

      // oneclick-setup 已将模型写入后端，直接从 /api/models 拉取带真实 id 的完整数据
      if (passed) {
        setState((current) => !isCurrent() ? current : ({
          ...current,
          apiTested: true,
          onelinkProviderId: result.provider.id,
        }));
        stage = 'models';
        await loadModelsFromBackend(result.provider.id, isCurrent, true);
      }

      if (isCurrent()) showToast(passed ? 'success' : 'error', passed ? '连接成功！' : '当前key不可用');
    } catch {
      if (!isCurrent()) return;
      showToast('error', stage === 'setup' ? '配置结果未能确认，请重新打开配置核对后重试'
        : stage === 'models' ? '连接已通过，但模型列表读取失败，请重新打开配置核对'
          : '连接测试失败，请稍后重试');
    } finally {
      request.finish();
    }
  }, [captureModelScope, showToast, state.onelinkApiKeyActual, state.onelinkKeyIsFromServer, state.onelinkProviderId, loadModelsFromBackend]);

  const requestDelete = useCallback((type, id) => {
    setConfirmDelete({ type, id });
  }, []);

  // 加载广告位数据和 provider 信息
  useEffect(() => {
    if (!open) return;
    let active = true;
    queueMicrotask(() => { if (active) initializeFromBackend(); });
    return () => { active = false; };
  }, [open, initializeFromBackend]);

  function resetState() {
    providerSession.current += 1;
    setReadStatus('loading');
    modelScope.current += 1;
    oneLinkTestRequest.current += 1;
    setState(createDefaultState);
  }

  function closeMain() {
    resetState();
    onClose?.();
  }

  function closeChild() {
    modelScope.current += 1;
    oneLinkTestRequest.current += 1;
    setState((current) => ({
      ...current,
      childView: null,
      onelinkModelDraft: createEmptyModelDraft(),
    }));
  }

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (state.childView) {
        closeChild();
        return;
      }
      setState(createDefaultState);
      setReadStatus('loading');
      providerSession.current += 1;
      modelScope.current += 1;
      oneLinkTestRequest.current += 1;
      onClose?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, state.childView]);

  // const activeCustomProvider = useMemo(
  //   () => state.customProviders.find((provider) => provider.id === state.activeCustomProviderId) ?? null,
  //   [state.customProviders, state.activeCustomProviderId],
  // );
  // const customApiKey = activeCustomProvider?.apiKey ?? '';
  // const canAddCustomProvider = state.customProviders.length < MAX_CUSTOM_PROVIDERS;

  if (!open) return null;

  const updateState = (key, value) => setState((current) => ({ ...current, [key]: value }));

  const updateDraft = (draftKey, field, value) =>
    setState((current) => ({ ...current, [draftKey]: { ...current[draftKey], [field]: value } }));

  // const updateCustomProviderDraft = (field, value) =>
  //   setState((current) => ({ ...current, customProviderDraft: { ...current.customProviderDraft, [field]: value } }));

  const openOneLinkConfig = async () => {
    if (readStatus !== 'ready') return;
    if (primaryReadRequest.current?.isCurrent()) return;
    if (getPrimaryPending()) {
      showToast('warning', '主服务商仍在处理请求，请稍候再打开配置');
      return;
    }
    modelScope.current += 1;
    const isCurrent = captureModelScope();
    const request = { isCurrent };
    primaryReadRequest.current = request;
    try {
      await Promise.all(pendingOtherModels());
      if (!isCurrent()) return;
      const loaded = await loadModelsFromBackend(undefined, isCurrent, true);
      if (loaded && isCurrent()) setState((current) => ({ ...current, childView: 'onelink-config' }));
    } catch {
      if (isCurrent()) showToast('error', '读取模型列表失败，请再次点击配置重试');
    } finally {
      if (primaryReadRequest.current === request) primaryReadRequest.current = null;
    }
  };

  const openOtherProviderConfig = (providerId) => {
    if (readStatus !== 'ready') return;
    const provider = state.otherProviders.find(p => p.id === providerId);
    const lockKey = getAuthSessionGeneration() + ':' + (provider?.cardKey || providerId);
    if (otherModelPending.has(lockKey)) {
      showToast('warning', '该服务商模型仍在保存，请稍候再打开配置');
      return;
    }
    if (otherProviderRequest.current?.providerId === providerId && otherProviderRequest.current.isCurrent()) return;
    modelScope.current += 1;
    if (!provider) return;
    const isCurrent = captureModelScope();
    const request = { providerId, isCurrent };
    otherProviderRequest.current = request;

    // 打开配置弹窗时重新拉取该 provider 的最新模型列表
    if (provider.configured) {
      (pendingOtherModels().length ? Promise.all(pendingOtherModels()).then(() => {
        if (!isCurrent()) return null;
        return apiListModels({ fresh: true });
      }) : apiListModels({ fresh: true })).then((models) => {
        if (!isCurrent()) return;
        const providerModels = models.filter(m => m.provider_id === providerId);
        const modelsByTab = createEmptyModelsByTab();
        providerModels.forEach(model => {
          const tab = getCategoryTab(model.category);
          if (!tab) return;
          modelsByTab[tab].push({
            id: model.id,
            name: model.name || model.model_id,
            description: model.description || MODEL_DESCRIPTION,
            enabled: model.is_enabled ?? false,
            isDefault: model.is_default ?? false,
            modelId: model.model_id,
          });
      });
        setState(current => !isCurrent() ? current : ({
          ...current,
          activeOtherProviderId: providerId,
          editProviderApiKey: provider.apiKeyMasked,
          editProviderApiKeyActual: provider.apiKeyMasked,
          editProviderKeyIsFromServer: provider.configured,
          editProviderApiTested: false,
          editProviderModelsByTab: Object.fromEntries(
            Object.entries(modelsByTab).map(([tab, list]) => [tab, sortModels(list)])
          ),
          editProviderModelDraft: createEmptyModelDraft(),
          childView: 'other-provider-config',
          activeModelTab: '对话模型',
        }));
      }).catch(() => {
        if (isCurrent()) showToast('error', '读取模型列表失败，请再次点击配置重试');
      }).finally(() => {
        if (otherProviderRequest.current === request) otherProviderRequest.current = null;
      });
    } else {
      otherProviderRequest.current = null;
      setState(current => ({
        ...current,
        activeOtherProviderId: providerId,
        editProviderApiKey: provider.apiKeyMasked,
        editProviderApiKeyActual: provider.apiKeyMasked,
        editProviderKeyIsFromServer: provider.configured,
        editProviderApiTested: false,
        editProviderModelsByTab: provider.modelsByTab,
        editProviderModelDraft: createEmptyModelDraft(),
        childView: 'other-provider-config',
        activeModelTab: '对话模型',
      }));
    }
  };

  // 通过 card_key 打开未配置服务商的配置页
  const openUnconfiguredProviderConfig = (cardKey) => {
    const provider = state.otherProviders.find(p => p.cardKey === cardKey);
    if (!provider) return;
    openOtherProviderConfig(provider.id);
  };

  const saveOtherProviderConfig = () => {
    modelScope.current += 1;
    const providerId = state.activeOtherProviderId;
    if (providerId) {
      setState(current => {
        const modelsByTab = current.editProviderModelsByTab;
        const updatedOtherProviders = current.otherProviders.map(p =>
          p.id === providerId ? { ...p, modelsByTab } : p
        );
        return {
          ...current,
          otherProviders: updatedOtherProviders,
          childView: null,
        };
      });
    }
  };

  const toggleOtherProvider = (providerId) => {
    const provider = state.otherProviders.find(p => p.id === providerId);
    if (!provider || !provider.configured) return;
    const isCurrent = captureProviderScope();
    providerEnableQueue.toggle(providerId, provider.enabled, enabled => {
      if (!isCurrent()) return;
      setState(current => !isCurrent() ? current : ({
        ...current,
        otherProviders: current.otherProviders.map(p =>
          p.id === providerId ? { ...p, enabled } : p
        ),
      }));
    }, message => { if (isCurrent()) showToast('error', message); });
  };

  const toggleOneLinkProvider = () => {
    const providerId = state.onelinkProviderId;
    if (!providerId || !state.mainConfigured) return;
    if (getPrimaryPending()) {
      showToast('warning', '主服务商仍在处理请求，请稍候再试');
      return;
    }
    const isCurrent = captureProviderScope();
    providerEnableQueue.toggle(providerId, state.onelinkEnabled, enabled => {
      if (!isCurrent()) return;
      setState(current => !isCurrent() || current.onelinkProviderId !== providerId
        ? current : { ...current, onelinkEnabled: enabled });
    }, message => { if (isCurrent()) showToast('error', message); });
  };

  const runOtherProviderTest = async (providerId, fromCard = false) => {
    const provider = state.otherProviders.find(p => p.id === providerId);
    if (!provider || (fromCard && !provider.configured)) return;
    const lockKey = getAuthSessionGeneration() + ':' + (provider.cardKey || provider.id);
    if (providerTestPending.has(lockKey)) {
      showToast('warning', '该服务商仍在保存或测试，请稍候再试');
      return;
    }
    const scopeCurrent = captureModelScope();
    const inputRevision = providerInputRevision.current;
    const isCurrent = () => scopeCurrent() && (fromCard || providerInputRevision.current === inputRevision);
    const key = state.editProviderApiKeyActual.trim();
    const maskedKey = state.editProviderApiKey;
    if (!fromCard && !state.editProviderKeyIsFromServer && !key) {
      showToast('error', '请先输入API');
      return;
    }
    providerTestPending.add(lockKey);
    if (!fromCard) setState(current => ({ ...current, editProviderApiTested: false }));
    let stage = 'test';
    let targetId = providerId;
    try {
      if (!fromCard && !state.editProviderKeyIsFromServer) {
        stage = 'save';
        if (provider.configured) {
          await apiUpdateProvider(providerId, { api_key: key });
        } else {
          const created = await apiCreateProvider({
            name: provider.name || providerId,
            provider_type: provider.cardKey || providerId,
            api_key: key,
          });
          if (!created || typeof created.id !== 'string' || !created.id.trim()) throw new Error('保存结果缺少编号');
          targetId = created.id;
        }
        if (!isCurrent()) return;
        setState(current => !isCurrent() ? current : ({
          ...current, activeOtherProviderId: targetId, editProviderKeyIsFromServer: true,
          otherProviders: current.otherProviders.map(p => p.id === providerId
            ? { ...p, id: targetId, configured: true, apiKeyMasked: maskedKey } : p),
        }));
      }
      stage = 'test';
      const result = await apiTestConnection(targetId);
      if (!isCurrent()) return;
      if (result?.success !== true) {
        showToast('error', '连接未通过，请检查当前密钥后重试');
        return;
      }
      if (fromCard) {
        showToast('success', '连接成功！');
        return;
      }
      setState(current => !isCurrent() ? current : ({ ...current, editProviderApiTested: true }));
      stage = 'models';
      const revision = modelRevision.current;
      const modelLockKey = getAuthSessionGeneration() + ':' + (provider.cardKey || provider.id);
      if (otherModelPending.has(modelLockKey)) {
        showToast('success', '连接成功！模型修改进行中，保留当前列表');
        return;
      }
      const models = await apiListModels({ fresh: true });
      if (!isCurrent()) return;
      if (revision !== modelRevision.current) {
        showToast('success', '连接成功！模型已修改，保留当前列表');
        return;
      }
      const modelsByTab = createEmptyModelsByTab();
      models.filter(model => model.provider_id === targetId).forEach(model => {
        const tab = getCategoryTab(model.category);
        if (!tab) return;
        modelsByTab[tab].push({
          id: model.id, name: model.name || model.model_id,
          description: model.description || MODEL_DESCRIPTION,
          enabled: model.is_enabled ?? false, isDefault: model.is_default ?? false, modelId: model.model_id,
        });
      });
      setState(current => !isCurrent() || revision !== modelRevision.current ? current : ({
        ...current, editProviderModelsByTab: Object.fromEntries(
          Object.entries(modelsByTab).map(([tab, list]) => [tab, sortModels(list)])),
      }));
      showToast('success', '连接成功！');
    } catch {
      if (!isCurrent()) return;
      const message = stage === 'save' ? '密钥保存结果未能确认，请重新打开配置核对后重试'
        : stage === 'models' ? '连接已通过，但模型列表读取失败，请重新打开配置重试'
          : '连接测试失败，请稍后重试';
      showToast('error', message);
    } finally {
      providerTestPending.delete(lockKey);
    }
  };

  const testOtherProviderFromCard = providerId => runOtherProviderTest(providerId, true);
  const testOtherProviderConnection = () => runOtherProviderTest(state.activeOtherProviderId);

  const beginOtherModelMutation = () => {
    if (pendingOtherModels().length) {
      showToast('warning', '模型配置仍在保存，请稍候再试');
      return null;
    }
    const providerId = state.activeOtherProviderId;
    const provider = state.otherProviders.find(item => item.id === providerId);
    if (!provider?.configured) {
      showToast('warning', '请先保存服务商密钥，再添加或修改模型');
      return null;
    }
    const key = getAuthSessionGeneration() + ':' + (provider.cardKey || providerId);
    if (otherModelPending.has(key) || providerTestPending.has(key) || providerEnableQueue.has(providerId)) {
      showToast('warning', '该服务商仍在处理请求，请稍候再试');
      return null;
    }
    const isCurrent = captureModelScope();
    let complete;
    const done = new Promise(resolve => { complete = resolve; });
    const request = { isCurrent, providerId, done };
    otherModelPending.set(key, request);
    modelRevision.current += 1;
    return {
      ...request,
      finish() {
        if (isCurrent()) modelRevision.current += 1;
        if (otherModelPending.get(key) === request) otherModelPending.delete(key);
        complete();
      },
    };
  };

  const mutateOtherProviderModel = async (modelId, action) => {
    const tab = state.activeModelTab;
    const target = (state.editProviderModelsByTab[tab] ?? []).find(model => model.id === modelId);
    if (!target) return;
    const request = beginOtherModelMutation();
    if (!request) return;
    const enabled = !target.enabled;
    const isDefault = !target.isDefault;
    const update = action === 'toggle'
      ? { is_enabled: enabled, ...(!enabled ? { is_default: false } : {}) }
      : { is_default: isDefault, ...(isDefault && !target.enabled ? { is_enabled: true } : {}) };
    try {
      let result = null;
      if (action === 'delete') await apiDeleteModel(modelId);
      else result = await apiUpdateModel(modelId, update);
      if (!request.isCurrent()) return;
      if (action !== 'delete') validateModelResult(result, request.providerId, getTabCategory(tab), modelId);
      setState(current => {
        if (!request.isCurrent() || current.activeOtherProviderId !== request.providerId) return current;
        return applyModelResult(current, tab, request.providerId, modelId, result, sortModels);
      });
    } catch {
      if (request.isCurrent()) showToast('error', '模型操作未能确认，请重新打开配置核对后重试');
    } finally { request.finish(); }
  };

  const toggleEditProviderModel = modelId => mutateOtherProviderModel(modelId, 'toggle');
  const setDefaultEditProviderModel = modelId => mutateOtherProviderModel(modelId, 'default');
  const deleteEditProviderModel = modelId => mutateOtherProviderModel(modelId, 'delete');

  const addEditProviderModelWithValidation = async () => {
    const request = beginOtherModelMutation();
    if (!request) return;
    try {
      const draft = state.editProviderModelDraft;
      const tab = state.activeModelTab;
      const category = getTabCategory(tab);
      if (!draft.identifier.trim()) {
        showToast('error', '请输入模型标识');
        return;
      }
      const result = await apiCreateModel({
        provider_id: request.providerId,
        model_id: draft.identifier,
        name: draft.name || draft.identifier,
        category,
        description: draft.note || null,
        is_enabled: true,
      });
      if (!request.isCurrent()) return;
      validateModelResult(result, request.providerId, category);
      const newModel = {
        id: result.id,
        name: result.name,
        description: result.description || MODEL_DESCRIPTION,
        enabled: result.is_enabled,
        isDefault: result.is_default,
        isNew: true,
        modelId: result.model_id,
      };
      setState((current) => {
        if (!request.isCurrent() || current.activeOtherProviderId !== request.providerId) return current;
        current = applyModelResult(current, tab, request.providerId, result.id, result, sortModels);
        const sorted = sortModels([...(current.editProviderModelsByTab[tab] ?? []), newModel]);
        return {
          ...current,
          editProviderModelsByTab: { ...current.editProviderModelsByTab, [tab]: sorted },
          otherProviders: current.otherProviders.map(provider => provider.id === request.providerId
            ? { ...provider, modelsByTab: { ...provider.modelsByTab, [tab]: sorted } } : provider),
          editProviderModelDraft: current.editProviderModelDraft === draft ? createEmptyModelDraft() : current.editProviderModelDraft,
          childView: current.editProviderModelDraft === draft ? 'other-provider-config' : current.childView,
        };
      });
      showToast('success', '模型添加成功！');
    } catch {
      if (request.isCurrent()) showToast('error', '新增结果未能确认，请重新打开配置核对后重试');
    } finally { request.finish(); }
  };

  const saveOneLinkConfig = () => {
    if (getPrimaryPending()) {
      showToast('warning', '主服务商仍在处理请求，请稍候再保存');
      return;
    }
    if (!state.onelinkApiKeyActual.trim() || !state.apiTested) return;
    modelScope.current += 1;
    setState((current) => ({ ...current, mainConfigured: true, childView: null }));
    onConfigured?.();
  };

  // const saveCustomProviderModelConfig = () => {
  //   setState((current) => ({
  //     ...current,
  //     childView: null,
  //     customProviderModelDraft: createEmptyModelDraft(),
  //     customProviders: current.customProviders.map((provider) =>
  //       provider.id === current.activeCustomProviderId ? { ...provider, configured: true, enabled: true } : provider,
  //     ),
  //   }));
  //   onConfigured?.();
  // };

  // const addCustomProvider = () =>
  //   setState((current) => {
  //     if (current.customProviders.length >= MAX_CUSTOM_PROVIDERS) return current;
  //     const providerId = `custom-provider-${Date.now()}`;
  //     const draft = current.customProviderDraft;
  //     return {
  //       ...current,
  //       activeCustomProviderId: providerId,
  //       childView: 'custom-provider-model-config',
  //       customProviderDraft: createCustomProviderDraft(),
  //       customProviderModelDraft: createEmptyModelDraft(),
  //       customProviders: [
  //         ...current.customProviders,
  //         { id: providerId, configured: false, enabled: false, name: draft.name, vendor: draft.vendor, baseUrl: draft.baseUrl, apiKey: draft.apiKey, modelsByTab: createEmptyModelsByTab() },
  //       ],
  //     };
  //   });

  const addOnelinkModelWithValidation = async () => {
    if (pendingOtherModels().length) {
      showToast('warning', '模型配置仍在保存，请稍候再试');
      return;
    }
    if (getPrimaryPending() || providerEnableQueue.has(state.onelinkProviderId)) {
      showToast('warning', '主服务商仍在处理请求，请稍候再试');
      return;
    }
    if (!state.onelinkProviderId) {
      showToast('warning', '请先测试连接并完成服务商配置');
      return;
    }
    const isCurrent = captureModelScope();
    const request = acquirePrimaryRequest(isCurrent);
    if (!request) return;
    primaryMutation.current = request;
    modelRevision.current += 1;
    try {
      const draft = state.onelinkModelDraft;
      const tab = state.activeModelTab;
      const category = getTabCategory(tab);

      if (!draft.identifier.trim()) {
        showToast('error', '请输入模型标识');
        return;
      }

      // 调用后端接口添加模型（CreateModelRequest 要求 provider_id/name/model_id/category）
      const result = await apiCreateModel({
        provider_id: state.onelinkProviderId,
        model_id: draft.identifier,
        name: draft.name || draft.identifier,
        category,
        description: draft.note || null,
        is_enabled: true,
      });

      if (!isCurrent()) return;
      // 成功后添加到列表（ModelConfigResponse 字段：name / is_enabled）
      validateModelResult(result, state.onelinkProviderId, category);
      const newModel = {
        id: result.id,
        name: result.name,
        description: result.description || MODEL_DESCRIPTION,
        enabled: result.is_enabled,
        isDefault: result.is_default,
        isNew: true,
        modelId: result.model_id,
      };

      setState((current) => {
        if (!isCurrent()) return current;
        current = applyModelResult(current, tab, state.onelinkProviderId, result.id, result, sortModels);
        const sorted = sortModels([...(current.onelinkModelsByTab[tab] ?? []), newModel]);
        return {
          ...current,
          onelinkModelsByTab: { ...current.onelinkModelsByTab, [tab]: sorted },
          onelinkModelDraft: current.onelinkModelDraft === draft ? createEmptyModelDraft() : current.onelinkModelDraft,
          childView: current.onelinkModelDraft === draft ? 'onelink-config' : current.childView,
        };
      });

      showToast('success', '模型添加成功！');
    } catch (error) {
      if (!isCurrent()) return;
      console.error('添加模型失败:', error);
      showToast('error', '新增结果未能确认，请重新打开配置核对后重试');
    } finally {
      if (isCurrent()) modelRevision.current += 1;
      if (primaryMutation.current === request) primaryMutation.current = null;
      request.finish();
    }
  };

  // const addCustomProviderModel = () =>
  //   setState((current) => {
  //     const draft = current.customProviderModelDraft;
  //     const tab = current.activeModelTab;
  //     const newModel = { id: `customProviderModels-${Date.now()}`, name: draft.name || 'GPT5.1', description: draft.note || MODEL_DESCRIPTION, enabled: true, isNew: true };
  //     return {
  //       ...current,
  //       customProviderModelDraft: createEmptyModelDraft(),
  //       childView: 'custom-provider-model-config',
  //       customProviders: current.customProviders.map((provider) =>
  //         provider.id === current.activeCustomProviderId
  //           ? { ...provider, modelsByTab: { ...(provider.modelsByTab ?? createEmptyModelsByTab()), [tab]: sortModels([...(provider.modelsByTab?.[tab] ?? []), newModel]) } }
  //           : provider,
  //       ),
  //     };
  //   });

  const mutateOnelinkModel = async (modelId, action) => {
    if (pendingOtherModels().length) {
      showToast('warning', '模型配置仍在保存，请稍候再试');
      return;
    }
    if (getPrimaryPending() || providerEnableQueue.has(state.onelinkProviderId)) {
      showToast('warning', '主服务商仍在处理请求，请稍候再试');
      return;
    }
    const tab = state.activeModelTab;
    const providerId = state.onelinkProviderId;
    const target = (state.onelinkModelsByTab[tab] ?? []).find(model => model.id === modelId);
    if (!target) return;
    const isCurrent = captureModelScope();
    const request = acquirePrimaryRequest(isCurrent);
    if (!request) return;
    primaryMutation.current = request;
    modelRevision.current += 1;
    const enabled = !target.enabled;
    const isDefault = !target.isDefault;
    const update = action === 'toggle'
      ? { is_enabled: enabled, ...(!enabled ? { is_default: false } : {}) }
      : { is_default: isDefault, ...(isDefault && !target.enabled ? { is_enabled: true } : {}) };
    try {
      let result = null;
      if (action === 'delete') await apiDeleteModel(modelId);
      else result = await apiUpdateModel(modelId, update);
      if (!isCurrent()) return;
      if (action !== 'delete') validateModelResult(result, providerId, getTabCategory(tab), modelId);
      setState(current => {
        if (!isCurrent() || current.onelinkProviderId !== providerId) return current;
        return applyModelResult(current, tab, providerId, modelId, result, sortModels);
      });
    } catch {
      if (isCurrent()) showToast('error', '模型操作未能确认，请重新打开配置核对后重试');
    } finally {
      if (isCurrent()) modelRevision.current += 1;
      if (primaryMutation.current === request) primaryMutation.current = null;
      request.finish();
    }
  };

  const deleteOnelinkModel = modelId => mutateOnelinkModel(modelId, 'delete');
  const toggleOnelinkModel = modelId => mutateOnelinkModel(modelId, 'toggle');
  const setDefaultOnelinkModel = modelId => mutateOnelinkModel(modelId, 'default');

  // const setDefaultCustomProviderModel = (modelId) =>
  //   setState((current) => {
  //     const tab = current.activeModelTab;
  //     const provider = current.customProviders.find((p) => p.id === current.activeCustomProviderId);
  //     const targetModel = (provider?.modelsByTab?.[tab] ?? []).find((m) => m.id === modelId);
  //     const isCurrentlyDefault = targetModel?.isDefault;
  //     return {
  //       ...current,
  //       customProviders: current.customProviders.map((provider) =>
  //         provider.id === current.activeCustomProviderId
  //           ? { ...provider, modelsByTab: { ...(provider.modelsByTab ?? createEmptyModelsByTab()), [tab]: (provider.modelsByTab?.[tab] ?? []).map((model) => ({ ...model, isDefault: isCurrentlyDefault ? false : model.id === modelId })) } }
  //           : provider,
  //       ),
  //     };
  //   });

  // const toggleCustomProvider = (providerId) =>
  //   setState((current) => ({
  //     ...current,
  //     customProviders: current.customProviders.map((provider) =>
  //       provider.id === providerId && provider.configured ? { ...provider, enabled: !provider.enabled } : provider,
  //     ),
  //   }));

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    const { type, id } = confirmDelete;
    if (type === 'onelinkModel') deleteOnelinkModel(id);
    else if (type === 'editProviderModel') deleteEditProviderModel(id);
    setConfirmDelete(null);
  };

  const renderChildModal = () => {
    switch (state.childView) {
      case 'onelink-config':
        return (
          <ConfigModelModal
            title="配置OneLinkAI API Key"
            apiValue={state.onelinkApiKey}
            apiPlaceholder="输入你的API"
            onApiChange={(event) => {
              oneLinkTestRequest.current += 1;
              const inputValue = event.target.value;
              const maskedValue = inputValue.length > 7
                ? `${inputValue.slice(0, 3)}${'*'.repeat(Math.max(7, inputValue.length - 7))}${inputValue.slice(-4)}`
                : inputValue;
              setState((current) => ({
                ...current,
                onelinkApiKeyActual: inputValue,
                onelinkApiKey: maskedValue,
                onelinkKeyIsFromServer: false,
                apiTested: false,
              }));
            }}
            activeTab={state.activeModelTab}
            onChangeTab={(tab) => updateState('activeModelTab', tab)}
            modelsByTab={state.onelinkModelsByTab}
            onAddModel={() => updateState('childView', 'edit-onelink-model')}
            onCancel={closeChild}
            onSave={saveOneLinkConfig}
            saveDisabled={!state.onelinkApiKeyActual.trim() || !state.apiTested}
            saveDisabledTooltip={state.onelinkApiKeyActual.trim() ? '请先测试连接并通过后保存' : 'API Key不允许为空'}
            onToggleModel={toggleOnelinkModel}
            onDeleteModel={(id) => requestDelete('onelinkModel', id)}
            onSetDefaultModel={setDefaultOnelinkModel}
            onTest={testConnection}
            apiTested={state.apiTested}
          />
        );
      case 'edit-onelink-model':
        return (
          <EditModelModal
            draft={state.onelinkModelDraft}
            title="添加模型"
            onChange={(field, value) => updateDraft('onelinkModelDraft', field, value)}
            onCancel={() => {
              modelScope.current += 1;
              updateState('childView', 'onelink-config');
            }}
            onSave={addOnelinkModelWithValidation}
          />
        );
      case 'other-provider-config': {
        const activeProvider = state.otherProviders.find(p => p.id === state.activeOtherProviderId);
        return (
          <ConfigModelModal
            title={`配置${activeProvider?.name || 'API服务商'} API`}
            apiValue={state.editProviderApiKey}
            apiPlaceholder="输入你的API"
            onApiChange={(event) => {
              providerInputRevision.current += 1;
              const inputValue = event.target.value;
              const maskedValue = inputValue.length > 7
                ? `${inputValue.slice(0, 3)}${'*'.repeat(Math.max(7, inputValue.length - 7))}${inputValue.slice(-4)}`
                : inputValue;
              setState((current) => ({
                ...current,
                editProviderApiKeyActual: inputValue,
                editProviderApiKey: maskedValue,
                editProviderKeyIsFromServer: false,
                editProviderApiTested: false,
              }));
            }}
            activeTab={state.activeModelTab}
            onChangeTab={(tab) => updateState('activeModelTab', tab)}
            modelsByTab={state.editProviderModelsByTab}
            onAddModel={() => updateState('childView', 'edit-other-provider-model')}
            onCancel={closeChild}
            onSave={saveOtherProviderConfig}
            onToggleModel={toggleEditProviderModel}
            onDeleteModel={(id) => requestDelete('editProviderModel', id)}
            onSetDefaultModel={setDefaultEditProviderModel}
            onTest={testOtherProviderConnection}
            apiTested={state.editProviderApiTested}
          />
        );
      }
      case 'edit-other-provider-model':
        return (
          <EditModelModal
            draft={state.editProviderModelDraft}
            title="添加模型"
            onChange={(field, value) => updateDraft('editProviderModelDraft', field, value)}
            onCancel={() => {
              modelScope.current += 1;
              updateState('childView', 'other-provider-config');
            }}
            onSave={addEditProviderModelWithValidation}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {confirmDelete && (
        <ConfirmDialog
          title="确定要删除吗？"
          description="此操作不可撤销，请谨慎操作！"
          confirmText="删除"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
          zIndex={150}
        />
      )}
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-surface-overlay p-[24px] backdrop-blur-[20px]">
        <div className="relative overflow-hidden rounded-2xl" onClick={(event) => event.stopPropagation()}>
          <MainModal
            readStatus={readStatus}
            onRetry={initializeFromBackend}
            configured={state.mainConfigured}
            onelinkEnabled={state.onelinkEnabled}
            onelinkModelsByTab={state.onelinkModelsByTab}
            onelinkCreatedAt={state.onelinkCreatedAt}
            onClose={closeMain}
            onOpenOneLink={openOneLinkConfig}
            onComplete={closeMain}
            onEditOneLink={openOneLinkConfig}
            onToggleOneLink={toggleOneLinkProvider}
            onTestOneLink={testConnection}
          otherProviders={state.otherProviders}
            onEditOtherProvider={openOtherProviderConfig}
            onToggleOtherProvider={toggleOtherProvider}
            onTestOtherProvider={testOtherProviderFromCard}
            onConfigureOtherProvider={openUnconfiguredProviderConfig}
          />

          {state.childView ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-surface-overlay/60 backdrop-blur-[4px]" onClick={closeChild}>
              {renderChildModal()}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
