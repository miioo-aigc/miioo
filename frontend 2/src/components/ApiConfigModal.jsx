import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Toggle from './Toggle';
import ConfirmDialog from './ConfirmDialog';
import { apiOneClickSetup, apiCreateModel, apiListModels, apiUpdateModel, apiGetBanner, apiListProviders, apiTestConnection, apiUpdateProvider, apiGetCardVisibility } from '../api/config';
import bizQrCodeImg from '../assets/biz-qr-code.png';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const INSET_BORDER_CLASS = 'shadow-[inset_0px_0px_0px_1px_var(--color-white-8)]';
const BUTTON_SHADOW_CLASS = 'shadow-[3px_3px_8px_var(--color-black-40)]';
const ACCENT_BUTTON_GRADIENT =
  'linear-gradient(in oklab 107.50999999999999deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)';
const PRIMARY_BUTTON_GRADIENT =
  'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)';
const RECOMMENDATION_GRADIENT =
  'linear-gradient(in oklab 180deg, oklab(75.5% -0.102 -0.072 / 10%) 0%, oklab(23.4% -0.001 -.0004) 100%)';
const MODEL_DESCRIPTION = 'GPT-5.2 是 GPT-5 系列最新一代旗舰级智能模型，在架构设计、推理能力和应用性能上实现重大突破。相比 GPT-5.1…';
const DEFAULT_PROVIDER_NAME = 'API服务商';
const MODEL_TABS = ['对话模型', '图片模型', '视频模型', '配音模型'];
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
    'audio': '配音模型',
  };
  return mapping[category] || null;
}

// 将前端 tab 映射到后端 category
function getTabCategory(tab) {
  const mapping = {
    '对话模型': 'chat',
    '图片模型': 'image',
    '视频模型': 'video',
    '配音模型': 'audio',
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

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 text-text-primary">
      <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="currentColor" stroke="currentColor" strokeWidth="1.333" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon({ stroke = '#D13A3B' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
      <path d="M3 3.333V14.667H13V3.333H3Z" stroke={stroke} strokeLinejoin="round" />
      <path d="M6.667 6.667V11" stroke={stroke} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.333 6.667V11" stroke={stroke} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.333 3.333H14.667" stroke={stroke} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke={stroke} strokeLinejoin="round" />
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

function BoltIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
      <path d="M6.333 1.333H12.333L8.667 6H13.667L5.667 14.667L7.333 8.333H2.667L6.333 1.333Z" stroke="#FFFFFF" strokeLinejoin="round" />
    </svg>
  );
}

function SecondaryButton({ children, className = '', onClick, type = 'button', icon = null, textClassName = '' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`flex shrink-0 items-center justify-center gap-[4px] rounded-lg border border-solid border-btn-primary-border bg-btn-primary-bg-normal px-[16px] outline outline-1 outline-stroke-outline transition-colors hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active ${BUTTON_SHADOW_CLASS} ${className}`}
    >
      {icon}
      <div className={`shrink-0 text-sm/4.5 text-text-secondary ${textClassName}`} style={{ fontFamily: FONT }}>
        {children}
      </div>
    </button>
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

function AccentButton({ children, className = '', onClick, type = 'button', textClassName = '' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`flex shrink-0 items-center justify-center gap-[4px] rounded-lg border border-solid border-stroke-accent bg-btn-accent-bg-normal bg-origin-border px-[16px] outline outline-1 outline-stroke-outline transition-colors hover:bg-btn-accent-bg-hover active:bg-btn-accent-bg-active ${className}`}
      style={{ backgroundImage: ACCENT_BUTTON_GRADIENT }}
    >
      <div className={`shrink-0 text-center text-sm/4.5 font-medium text-text-inverse ${textClassName}`} style={{ fontFamily: FONT_MEDIUM }}>
        {children}
      </div>
    </button>
  );
}

function Toast({ toasts }) {
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

function Tag({ children, roundedClassName = 'rounded-sm' }) {
  return (
    <div className={`flex items-start bg-tag-bg-blue px-[4px] py-[0px] ${roundedClassName} ${INSET_BORDER_CLASS}`}>
      <div className="w-fit text-sm/4.5 text-tag-text-blue" style={{ fontFamily: FONT }}>
        {children}
      </div>
    </div>
  );
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

function SelectOption({ option, selected, onSelect }) {
  const stateClassName = option.disabled
    ? 'bg-select-item-bg-disabled text-select-item-text-disabled cursor-not-allowed'
    : selected
      ? 'bg-select-item-bg-active text-select-item-text-active'
      : 'bg-select-item-bg-normal text-select-item-text-normal hover:bg-select-item-bg-hover hover:text-select-item-text-hover active:bg-select-item-bg-active active:text-select-item-text-active cursor-pointer';

  return (
    <button
      type="button"
      disabled={option.disabled}
      onClick={() => onSelect(option.value)}
      className={`flex w-full items-center rounded-md px-[12px] py-[8px] text-left text-sm/4.5 transition-colors ${stateClassName}`}
      style={{ fontFamily: FONT }}
    >
      {option.label}
    </button>
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

function RecommendationBanner({ bannerData }) {
  const { image_url } = bannerData || {};

  if (!image_url) return null;

  const tutorialUrl = ''; // 教程链接，前端写死，暂时留空
  const fullImageUrl = image_url.startsWith('http') ? image_url : `${import.meta.env.VITE_API_BASE_URL}${image_url}`;

  return (
    <div
      className="flex items-start gap-[12px] px-[16px] py-[12px] rounded-lg justify-end h-[96px] shrink-0 bg-[#1D1E1E] bg-cover bg-[position:50%] [box-shadow:#FFFFFF14_0px_0px_0px_1px_inset]"
      style={{ backgroundImage: `url(${fullImageUrl})` }}
    >
      <div className="flex items-end gap-[8px] self-stretch">
        <button
          type="button"
          onClick={tutorialUrl ? () => window.open(tutorialUrl, '_blank') : undefined}
          disabled={!tutorialUrl}
          className="flex items-center h-[32px] rounded-lg px-[16px] gap-[4px] [box-shadow:#00000066_3px_3px_8px] bg-[#161616] border border-solid border-[#FFFFFF0D] [outline:1px_solid_#00000080] transition-colors hover:bg-[#1D1E1E] active:bg-[#161616] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="inline-block w-max shrink-0 text-[#FFFFFF99] text-sm/4.5" style={{ fontFamily: FONT }}>
            教程
          </div>
        </button>
        <button
          type="button"
          onClick={() => window.open(link_url || 'https://www.onelinkai.cloud/', '_blank')}
          className="flex items-center h-[32px] rounded-lg px-[16px] gap-[4px] bg-[#2DC3E1] bg-origin-border border border-solid border-[#FFFFFF33] [outline:1px_solid_#00000080] transition-colors hover:bg-[#53D3ED] active:bg-[#139EBA]"
          style={{ backgroundImage: ACCENT_BUTTON_GRADIENT }}
        >
          <div className="inline-block text-center font-medium text-[#090909] text-sm/4.5" style={{ fontFamily: FONT_MEDIUM }}>
            获取
          </div>
        </button>
      </div>
    </div>
  );
}

const CARD_BASE = 'flex flex-col items-center gap-3 px-[16px] py-3 flex-1 rounded-lg h-50 bg-[#1D1E1E] text-xs/4 cursor-pointer hover:bg-[#242525] active:bg-[#141414] transition-colors';

function InitialProviderCard({ onConfigure, onToggle }) {
  return (
    <div className={CARD_BASE} onClick={onConfigure}>
      <div className="flex items-center justify-between gap-3 self-stretch">
        <div className="flex-1 text-base/5 font-medium text-white" style={{ fontFamily: FONT_MEDIUM }}>
          OneLinkAI
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <StatusSwitch on={false} onClick={onToggle} />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center self-stretch">
        <AccentButton className="h-9" onClick={(e) => { e.stopPropagation(); onConfigure(); }} textClassName="text-center">
          开始配置API
        </AccentButton>
      </div>
    </div>
  );
}

function UnconfiguredProviderCard({ name, onConfigure }) {
  return (
    <div className={CARD_BASE} onClick={onConfigure}>
      <div className="flex items-center justify-between gap-3 self-stretch">
        <div className="flex-1 text-base/5 font-medium text-white" style={{ fontFamily: FONT_MEDIUM }}>
          {name}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <StatusSwitch on={false} onClick={onConfigure} />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center self-stretch">
        <SecondaryButton className="h-9" onClick={(e) => { e.stopPropagation(); onConfigure(); }}>
          开始配置API
        </SecondaryButton>
      </div>
    </div>
  );
}

function ConfiguredProviderCard({ title, modelCount, date, enabled, onEdit, onTest, onToggle, deletable = false, onDelete }) {
  return (
    <div className={CARD_BASE} onClick={onEdit}>
      <div className="flex items-center gap-3 self-stretch justify-between">
        <div className="flex-1 font-medium text-white text-base/5" style={{ fontFamily: FONT_MEDIUM }}>
          {title}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <StatusSwitch on={enabled} onClick={onToggle} />
        </div>
      </div>
      <div className="flex flex-col items-start gap-3 self-stretch flex-1">
        <InfoRow label="已配置模型" value={`${modelCount}个`} />
        <InfoRow label="添加时间" value={date} />
      </div>
      <div
        className={`flex items-center self-stretch h-[32px] shrink-0 ${deletable ? 'justify-between gap-[16px]' : 'justify-end gap-[32px]'}`}
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
  availableModelCount = 23,
  bannerData,
  otherProviders = [],
  onEditOtherProvider,
  onToggleOtherProvider,
  onTestOtherProvider,
  onConfigureOtherProvider,
}) {
  const [showQrCode, setShowQrCode] = useState(false);
  return (
    <div className="[font-synthesis:none] flex h-[600px] w-[800px] max-w-[calc(100vw-48px)] flex-col overflow-hidden text-xs/4 antialiased">
      <div className="flex items-center justify-between gap-[16px] rounded-t-2xl bg-surface-modal px-[24px] py-[16px]">
        <div className="flex-1 text-base/5 font-medium text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
          配置API
        </div>
        <button type="button" onClick={onClose} className="flex shrink-0 items-center justify-center transition-opacity hover:opacity-80 active:opacity-60" aria-label="关闭配置API">
          <CloseIcon />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[16px] overflow-y-auto bg-surface-modal px-[24px] py-[8px]">
        <RecommendationBanner bannerData={bannerData} />

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

        <div className="flex flex-col gap-[4px] self-stretch">
          <div className="self-stretch text-xs font-normal " style={{ fontFamily: FONT_MEDIUM, fontWeight: 400, color: "rgba(255, 255, 255, 0.6)" }}>
            配置说明
          </div>
          <div className="text-xs leading-[150%] text-text-secondary" style={{ fontFamily: FONT }}>
            平台已内置OneLinkAI、火山引擎主流模型列表，前往官网
            <span
              onClick={() => window.open('https://www.onelinkai.cloud/', '_blank')}
              className="cursor-pointer text-text-accent underline-offset-2 transition-all hover:underline hover:brightness-125 active:opacity-70"
            >获取API</span>
            即可一键完成配置。
            <br />
            如果您有其他厂商的API接入需求，
            <span className="relative inline-block">
              <span
                onClick={() => setShowQrCode(v => !v)}
                className="cursor-pointer text-text-accent underline-offset-2 transition-all hover:underline hover:brightness-125 active:opacity-70"
              >请联系我们</span>
              {showQrCode && (
                <>
                  <div className="fixed inset-0 z-[9998]" onClick={() => setShowQrCode(false)} />
                  <div
                    className="absolute z-[9999] flex flex-col items-center gap-[9px] rounded-lg p-[16px]"
                    style={{
                      bottom: 'calc(100% + 8px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      boxShadow: '#00000066 0px 4px 16px',
                      backgroundColor: '#161616',
                      border: '1px solid #FFFFFF14',
                    }}
                  >
                    <div
                      className="w-[120px] h-[120px] shrink-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${bizQrCodeImg})` }}
                    />
                    <div className="text-xs/4 text-[#FFFFFFCC]" style={{ fontFamily: FONT }}>
                      扫码添加工作人员
                    </div>
                  </div>
                </>
              )}
            </span>
            。
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-[16px] rounded-b-2xl bg-surface-modal px-[24px] py-[16px]">
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
    <div className="flex items-start gap-[24px] self-stretch">
      {MODEL_TABS.map((tab) => {
        const active = tab === activeTab;
        return (
          <button
            key={tab}
            type="button"
            className="transition-opacity hover:opacity-80 active:opacity-60"
            onClick={() => onChange(tab)}
          >
            <div
              className={`w-fit text-sm/4.5 transition-colors ${active ? 'font-medium text-text-primary' : 'text-text-secondary hover:text-text-primary active:text-text-secondary'}`}
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
      className="flex items-start gap-1.5 px-3 rounded-lg flex-col justify-center self-stretch bg-[#1D1E1E]"
      style={animating ? { animation: 'model-card-disable 280ms ease' } : undefined}
    >
      <div className="flex items-center gap-1.5 justify-between self-stretch py-[8px]">
        <div className="flex items-center gap-[8px]">
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
              <TrashIcon stroke="#D13A3B" />
            </button>
          )}
        </div>
      </div>
      <div className="self-stretch pb-[8px] text-[#FFFFFF99] text-xs/4" style={{ fontFamily: FONT }}>
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
}) {
  const activeTabIndex = Math.max(MODEL_TABS.indexOf(activeTab), 0);
  const [disablingId, setDisablingId] = useState(null);
  const cardRefs = useRef({});
  const pendingFlip = useRef(false);
  const prevPositions = useRef({});

  const activeModels = modelsByTab[activeTab] ?? [];
  const showEmptyState = !apiTested && activeModels.length === 0;

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
        <PrimaryButton className="h-9" innerClassName="px-[15px]" onClick={onSave}>
          保存
        </PrimaryButton>
      }
    >
      <div className="flex flex-col items-start gap-[8px] self-stretch">
        <div className="self-stretch text-sm/4.5 text-text-primary" style={{ fontFamily: FONT }}>
          全局API
        </div>
        <div className="flex items-start gap-[8px] self-stretch">
          <TextInput
            value={apiValue}
            onChange={apiDisabled ? undefined : onApiChange}
            placeholder={apiPlaceholder}
            disabled={apiDisabled}
          />
          <AccentButton className="h-9" textClassName="text-center" onClick={onTest}>
            测试连接
          </AccentButton>
        </div>
        {apiTested && apiValue.includes('*') && (
          <div className="text-xs/4 text-text-hint" style={{ fontFamily: FONT }}>
            API已配置，出于安全考虑仅显示部分字符。可重新输入完整 API 进行更新
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col items-start gap-[12px] self-stretch overflow-hidden min-h-0">
        <ModelTabs activeTab={activeTab} onChange={onChangeTab} />
        <div className="w-full flex-1 overflow-hidden min-h-0">
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
                <div key={tab} className="flex shrink-0 flex-col gap-[12px] overflow-y-auto pr-[2px]" style={{ width: `${100 / MODEL_TABS.length}%`, height: '100%' }}>
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
                        <button
                          type="button"
                          onClick={onAddModel}
                          className="flex h-9 w-full shrink-0 items-center justify-center gap-[4px] rounded-lg bg-btn-primary-bg-normal px-[16px] outline-none transition-colors hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active"
                          style={{ border: '1px dashed #FFFFFF33' }}
                        >
                          <PlusIcon className="h-[16px] w-[16px] text-text-secondary" />
                          <div className="shrink-0 text-center text-sm/4.5 text-text-secondary" style={{ fontFamily: FONT }}>
                            添加模型
                          </div>
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
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
  const [state, setState] = useState(createDefaultState);
  const [toasts, setToasts] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [availableModelCount, setAvailableModelCount] = useState(23);
  const [bannerData, setBannerData] = useState(null);

  const showToast = useCallback((type, message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const loadModelsFromBackend = useCallback(() => {
    apiListModels().then((models) => {
      if (!models || !models.length) return;
      setState((current) => {
        const modelsByTab = createEmptyModelsByTab();
        models.forEach((model) => {
          if (current.onelinkProviderId && model.provider_id !== current.onelinkProviderId) return;
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
      setAvailableModelCount(models.length);
    }).catch((err) => {
      console.error('加载模型列表失败:', err);
    });
  }, []);

  const initializeFromBackend = useCallback(() => {
    Promise.all([
      apiListProviders().catch(() => []),
      apiListModels().catch(() => []),
      apiGetBanner().catch(() => null),
      apiGetCardVisibility().catch(() => []),
    ]).then(([providersData, allModels, bannerResult, cardVisibility]) => {
      if (bannerResult) setBannerData(bannerResult);

      const rawList = Array.isArray(providersData) ? providersData : (providersData?.items ?? providersData?.providers ?? []);
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

      let onelinkUpdate = {};
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
          onelinkModelsByTab: groupedByProvider[onelinkProvider.id] || createEmptyModelsByTab(),
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

      setState(current => ({
        ...current,
        ...onelinkUpdate,
        otherProviders: formattedOtherProviders,
        visibleCardKeys,
      }));

      setAvailableModelCount((allModels || []).length);
    }).catch(err => {
      console.warn('初始化配置失败:', err);
    });
  }, []);

  const testConnection = useCallback(async () => {
    try {
      // key 来自后端（脱敏值），直接让后端用已存的 key 测试
      if (state.onelinkKeyIsFromServer && state.onelinkProviderId) {
        const result = await apiTestConnection(state.onelinkProviderId);
        if (result?.test_success === false) {
          showToast('error', result?.test_message || '连接失败，请检查API是否正确');
        } else {
          showToast('success', '连接成功！');
        }
        return;
      }

      const keyToTest = state.onelinkApiKeyActual.trim();
      if (!keyToTest) {
        showToast('error', '请先输入API');
        return;
      }
      const result = await apiOneClickSetup({ api_key: keyToTest });

      // oneclick-setup 已将模型写入后端，直接从 /api/models 拉取带真实 id 的完整数据
      if (result.test_success || (result.models && result.models.length > 0)) {
        loadModelsFromBackend();
        setState((current) => ({ ...current, apiTested: true }));
        setAvailableModelCount(result.models?.length ?? 0);
      }

      if (result.test_success) {
        showToast('success', '连接成功！');
      } else {
        showToast('error', result.test_message || '连接失败，请检查API是否正确');
      }
    } catch (error) {
      console.error('测试连接失败:', error);
      const msg = error?.message && !error.message.startsWith('请求失败') && error.message !== 'Unauthorized'
        ? error.message
        : '连接失败，请检查API是否正确';
      showToast('error', msg);
    }
  }, [showToast, state.onelinkApiKeyActual, state.onelinkKeyIsFromServer, state.onelinkProviderId, loadModelsFromBackend]);

  const requestDelete = useCallback((type, id) => {
    setConfirmDelete({ type, id });
  }, []);

  // 加载广告位数据和 provider 信息
  useEffect(() => {
    if (!open) return;
    initializeFromBackend();
  }, [open, initializeFromBackend]);

  function resetState() {
    setState(createDefaultState);
  }

  function closeMain() {
    resetState();
    onClose?.();
  }

  function closeChild() {
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
      onClose?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, state.childView]);

  // 打开 onelink-config 或 other-provider-config 子弹窗时从后端加载模型列表
  useEffect(() => {
    if (state.childView === 'onelink-config') {
      loadModelsFromBackend();
    } else if (state.childView === 'other-provider-config') {
      const providerId = state.activeOtherProviderId;
      if (!providerId) return;
      // 只有已配置的 provider（有 UUID）才拉模型
      const provider = state.otherProviders.find(p => p.id === providerId);
      if (!provider?.configured) return;
      apiListModels().then((models) => {
        if (!models || !models.length) return;
        const providerModels = models.filter(m => m.provider_id === providerId);
        if (providerModels.length === 0) return;
        setState(current => {
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
          return {
            ...current,
            editProviderModelsByTab: Object.fromEntries(
              Object.entries(modelsByTab).map(([tab, list]) => [tab, sortModels(list)])
            ),
          };
        });
      }).catch(err => console.error('加载自定义服务商模型列表失败:', err));
    }
  }, [state.childView, state.activeOtherProviderId, loadModelsFromBackend]);

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

  const openOneLinkConfig = () => {
    // 打开配置弹窗时重新拉取最新的模型列表
    loadModelsFromBackend();
    setState((current) => ({ ...current, childView: 'onelink-config' }));
  };

  const openOtherProviderConfig = (providerId) => {
    const provider = state.otherProviders.find(p => p.id === providerId);
    if (!provider) return;

    // 打开配置弹窗时重新拉取该 provider 的最新模型列表
    if (provider.configured) {
      apiListModels().then((models) => {
        if (!models || !models.length) return;
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
        setState(current => ({
          ...current,
          activeOtherProviderId: providerId,
          editProviderApiKey: provider.apiKeyMasked,
          editProviderApiKeyActual: provider.apiKeyMasked,
          editProviderKeyIsFromServer: provider.configured,
          editProviderApiTested: provider.configured,
          editProviderModelsByTab: Object.fromEntries(
            Object.entries(modelsByTab).map(([tab, list]) => [tab, sortModels(list)])
          ),
          editProviderModelDraft: createEmptyModelDraft(),
          childView: 'other-provider-config',
          activeModelTab: '对话模型',
        }));
      }).catch(err => console.error('加载模型列表失败:', err));
    } else {
      setState(current => ({
        ...current,
        activeOtherProviderId: providerId,
        editProviderApiKey: provider.apiKeyMasked,
        editProviderApiKeyActual: provider.apiKeyMasked,
        editProviderKeyIsFromServer: provider.configured,
        editProviderApiTested: provider.configured,
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
    // 保存时刷新该 provider 的模型列表以同步最新状态
    const providerId = state.activeOtherProviderId;
    if (providerId) {
      apiListModels().then((models) => {
        if (!models || !models.length) return;
        const providerModels = models.filter(m => m.provider_id === providerId);
        if (providerModels.length === 0) return;
        setState(current => {
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
          const updatedOtherProviders = current.otherProviders.map(p =>
            p.id === providerId
              ? { ...p, modelsByTab: Object.fromEntries(
                  Object.entries(modelsByTab).map(([tab, list]) => [tab, sortModels(list)])
                )}
              : p
          );
          return {
            ...current,
            otherProviders: updatedOtherProviders,
            editProviderModelsByTab: Object.fromEntries(
              Object.entries(modelsByTab).map(([tab, list]) => [tab, sortModels(list)])
            ),
            childView: null,
          };
        });
      }).catch(err => console.error('刷新模型列表失败:', err));
    }
  };

  const toggleOtherProvider = (providerId) => {
    const provider = state.otherProviders.find(p => p.id === providerId);
    if (!provider || !provider.configured) return;
    const newEnabled = !provider.enabled;
    apiUpdateProvider(providerId, { is_enabled: newEnabled }).catch(err => {
      console.error('更新服务商状态失败:', err);
    });
    setState(current => ({
      ...current,
      otherProviders: current.otherProviders.map(p =>
        p.id === providerId ? { ...p, enabled: newEnabled } : p
      ),
    }));
  };

  const testOtherProviderFromCard = async (providerId) => {
    const provider = state.otherProviders.find(p => p.id === providerId);
    if (!provider?.configured) return;
    try {
      const result = await apiTestConnection(providerId);
      if (result?.test_success === false) {
        showToast('error', result?.test_message || '连接失败，请检查API是否正确');
      } else {
        showToast('success', '连接成功！');
      }
    } catch (error) {
      console.error('测试连接失败:', error);
      showToast('error', '连接失败，请检查API是否正确');
    }
  };

  const testOtherProviderConnection = async () => {
    const providerId = state.activeOtherProviderId;
    if (!providerId) return;
    try {
      if (!state.editProviderKeyIsFromServer && state.editProviderApiKeyActual.trim()) {
        // 判断是否已配置（已配置的有 UUID，未配置的用 cardKey 作占位 ID）
        const provider = state.otherProviders.find(p => p.id === providerId);
        const isConfigured = provider?.configured;
        try {
          if (isConfigured) {
            await apiUpdateProvider(providerId, { api_key: state.editProviderApiKeyActual.trim() });
          } else {
            // 未配置的服务商需要先创建，再测试
            const { apiCreateProvider } = await import('../api/config');
            const created = await apiCreateProvider({
              name: provider?.name || providerId,
              provider_type: providerId,
              api_key: state.editProviderApiKeyActual.trim(),
            });
            // 更新 providerId 为后端返回的真实 UUID
            setState(current => ({
              ...current,
              activeOtherProviderId: created.id,
              editProviderKeyIsFromServer: true,
              otherProviders: current.otherProviders.map(p =>
                p.id === providerId ? { ...p, id: created.id, configured: true, apiKeyMasked: current.editProviderApiKey } : p
              ),
            }));
            // 用新 UUID 测试连接
            const result = await apiTestConnection(created.id);
            if (result?.test_success === false) {
              showToast('error', result?.test_message || '连接失败，请检查API是否正确');
            } else {
              showToast('success', '连接成功！');
              setState(current => ({ ...current, editProviderApiTested: true }));
              // 拉取该 provider 的模型列表
              const models = await apiListModels().catch(() => []);
              const providerModels = (models || []).filter(m => m.provider_id === created.id);
              if (providerModels.length > 0) {
                setState(current => {
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
                  return {
                    ...current,
                    editProviderModelsByTab: Object.fromEntries(
                      Object.entries(modelsByTab).map(([tab, list]) => [tab, sortModels(list)])
                    ),
                  };
                });
              }
            }
            return;
          }
          setState(current => ({
            ...current,
            editProviderKeyIsFromServer: true,
            otherProviders: current.otherProviders.map(p =>
              p.id === providerId ? { ...p, apiKeyMasked: current.editProviderApiKey } : p
            ),
          }));
        } catch (e) {
          console.warn('保存 API Key 失败，继续测试连接:', e.message);
        }
      }
      const result = await apiTestConnection(providerId);
      if (result?.test_success === false) {
        showToast('error', result?.test_message || '连接失败，请检查API是否正确');
      } else {
        showToast('success', '连接成功！');
        setState(current => ({ ...current, editProviderApiTested: true }));
        // 拉取该 provider 的模型列表
        apiListModels().then((models) => {
          if (!models || !models.length) return;
          const providerModels = models.filter(m => m.provider_id === providerId);
          if (providerModels.length === 0) return;
          setState(current => {
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
            return {
              ...current,
              editProviderModelsByTab: Object.fromEntries(
                Object.entries(modelsByTab).map(([tab, list]) => [tab, sortModels(list)])
              ),
            };
          });
        }).catch(err => console.error('加载模型列表失败:', err));
      }
    } catch (error) {
      console.error('测试连接失败:', error);
      const msg = error?.message && !error.message.startsWith('请求失败') && error.message !== 'Unauthorized'
        ? error.message
        : '连接失败，请检查API是否正确';
      showToast('error', msg);
    }
  };

  const toggleEditProviderModel = (modelId) =>
    setState((current) => {
      const tab = current.activeModelTab;
      const updated = (current.editProviderModelsByTab[tab] ?? []).map((model) => {
        if (model.id !== modelId) return model;
        const nowEnabled = !model.enabled;
        const nowDefault = nowEnabled ? model.isDefault : false;
        apiUpdateModel(model.id, {
          is_enabled: nowEnabled,
          ...(nowDefault !== model.isDefault ? { is_default: nowDefault } : {}),
        }).catch(err => console.error('更新模型状态失败:', err));
        return { ...model, enabled: nowEnabled, isDefault: nowDefault, isNew: false, justDisabled: !nowEnabled };
      });
      return {
        ...current,
        editProviderModelsByTab: { ...current.editProviderModelsByTab, [tab]: sortModels(updated) },
      };
    });

  const setDefaultEditProviderModel = (modelId) => {
    setState((current) => {
      const tab = current.activeModelTab;
      const targetModel = (current.editProviderModelsByTab[tab] ?? []).find(m => m.id === modelId);
      const isCurrentlyDefault = targetModel?.isDefault;
      const newIsDefault = !isCurrentlyDefault;
      const needEnable = newIsDefault && !targetModel?.enabled;
      apiUpdateModel(modelId, { is_default: newIsDefault, ...(needEnable ? { is_enabled: true } : {}) })
        .catch(err => console.error('设为默认失败:', err));
      const updated = (current.editProviderModelsByTab[tab] ?? []).map(model => ({
        ...model,
        isDefault: isCurrentlyDefault ? false : model.id === modelId,
        enabled: model.id === modelId && needEnable ? true : model.enabled,
      }));
      return {
        ...current,
        editProviderModelsByTab: { ...current.editProviderModelsByTab, [tab]: sortModels(updated) },
      };
    });
  };

  const deleteEditProviderModel = (modelId) =>
    setState((current) => {
      const tab = current.activeModelTab;
      return {
        ...current,
        editProviderModelsByTab: {
          ...current.editProviderModelsByTab,
          [tab]: (current.editProviderModelsByTab[tab] ?? []).filter(m => m.id !== modelId),
        },
      };
    });

  const addEditProviderModelWithValidation = async () => {
    try {
      const draft = state.editProviderModelDraft;
      const tab = state.activeModelTab;
      const category = getTabCategory(tab);
      if (!draft.identifier.trim()) {
        showToast('error', '请输入模型标识');
        return;
      }
      const result = await apiCreateModel({
        provider_id: state.activeOtherProviderId,
        model_id: draft.identifier,
        name: draft.name || draft.identifier,
        category,
        description: draft.note || null,
        is_enabled: true,
      });
      const newModel = {
        id: result.id,
        name: result.name,
        description: result.description || MODEL_DESCRIPTION,
        enabled: result.is_enabled ?? true,
        isNew: true,
        modelId: result.model_id,
      };
      setState((current) => {
        const sorted = sortModels([...(current.editProviderModelsByTab[tab] ?? []), newModel]);
        return {
          ...current,
          editProviderModelsByTab: { ...current.editProviderModelsByTab, [tab]: sorted },
          editProviderModelDraft: createEmptyModelDraft(),
          childView: 'other-provider-config',
        };
      });
      showToast('success', '模型添加成功！');
    } catch (error) {
      console.error('添加模型失败:', error);
      showToast('error', '模型添加失败！id不匹配');
    }
  };

  const saveOneLinkConfig = () => {
    // 保存时刷新模型列表以同步最新状态
    loadModelsFromBackend();
    setState((current) => ({ ...current, mainConfigured: true, onelinkEnabled: true, childView: null }));
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

  const addOnelinkModel = () =>
    setState((current) => {
      const draft = current.onelinkModelDraft;
      const tab = current.activeModelTab;
      const newModel = { id: `onelinkModels-${Date.now()}`, name: draft.name || 'GPT5.1', description: draft.note || MODEL_DESCRIPTION, enabled: true, isNew: true };
      const sorted = sortModels([...(current.onelinkModelsByTab[tab] ?? []), newModel]);
      return {
        ...current,
        onelinkModelsByTab: { ...current.onelinkModelsByTab, [tab]: sorted },
        onelinkModelDraft: createEmptyModelDraft(),
        childView: 'onelink-config',
      };
    });

  const addOnelinkModelWithValidation = async () => {
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

      // 成功后添加到列表（ModelConfigResponse 字段：name / is_enabled）
      const newModel = {
        id: result.id,
        name: result.name,
        description: result.description || MODEL_DESCRIPTION,
        enabled: result.is_enabled ?? true,
        isNew: true,
        modelId: result.model_id,
      };

      setState((current) => {
        const sorted = sortModels([...(current.onelinkModelsByTab[tab] ?? []), newModel]);
        return {
          ...current,
          onelinkModelsByTab: { ...current.onelinkModelsByTab, [tab]: sorted },
          onelinkModelDraft: createEmptyModelDraft(),
          childView: 'onelink-config',
        };
      });

      showToast('success', '模型添加成功！');
    } catch (error) {
      console.error('添加模型失败:', error);
      showToast('error', '模型添加失败！id不匹配');
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

  const deleteOnelinkModel = (modelId) =>
    setState((current) => {
      const tab = current.activeModelTab;
      return {
        ...current,
        onelinkModelsByTab: {
          ...current.onelinkModelsByTab,
          [tab]: (current.onelinkModelsByTab[tab] ?? []).filter((m) => m.id !== modelId),
        },
      };
    });

  // const deleteCustomProviderModel = (modelId) =>
  //   setState((current) => {
  //     const tab = current.activeModelTab;
  //     return {
  //       ...current,
  //       customProviders: current.customProviders.map((provider) =>
  //         provider.id === current.activeCustomProviderId
  //           ? { ...provider, modelsByTab: { ...(provider.modelsByTab ?? createEmptyModelsByTab()), [tab]: (provider.modelsByTab?.[tab] ?? []).filter((m) => m.id !== modelId) } }
  //           : provider,
  //       ),
  //     };
  //   });

  // const deleteCustomProvider = (providerId) =>
  //   setState((current) => ({ ...current, customProviders: current.customProviders.filter((provider) => provider.id !== providerId) }));

  const toggleOnelinkModel = (modelId) =>
    setState((current) => {
      const tab = current.activeModelTab;
      const updated = (current.onelinkModelsByTab[tab] ?? []).map((model) => {
        if (model.id !== modelId) return model;
        const nowEnabled = !model.enabled;
        // 如果关闭启用且该模型是默认模型，则清除默认状态
        const nowDefault = nowEnabled ? model.isDefault : false;

        // 同步后端
        apiUpdateModel(model.id, {
          is_enabled: nowEnabled,
          ...(nowDefault !== model.isDefault ? { is_default: nowDefault } : {})
        }).catch((err) => {
          console.error('更新模型状态失败:', err);
        });

        return { ...model, enabled: nowEnabled, isDefault: nowDefault, isNew: false, justDisabled: !nowEnabled };
      });
      return {
        ...current,
        onelinkModelsByTab: { ...current.onelinkModelsByTab, [tab]: sortModels(updated) },
      };
    });

  // const toggleCustomProviderModel = (modelId) =>
  //   setState((current) => {
  //     const tab = current.activeModelTab;
  //     return {
  //       ...current,
  //       customProviders: current.customProviders.map((provider) =>
  //         provider.id === current.activeCustomProviderId
  //           ? { ...provider, modelsByTab: { ...(provider.modelsByTab ?? createEmptyModelsByTab()), [tab]: sortModels((provider.modelsByTab?.[tab] ?? []).map((model) => { if (model.id !== modelId) return model; const nowEnabled = !model.enabled; return { ...model, enabled: nowEnabled, isNew: false, justDisabled: !nowEnabled }; })) } }
  //           : provider,
  //       ),
  //     };
  //   });

  const setDefaultOnelinkModel = (modelId) => {
    setState((current) => {
      const tab = current.activeModelTab;
      const targetModel = (current.onelinkModelsByTab[tab] ?? []).find((m) => m.id === modelId);
      const isCurrentlyDefault = targetModel?.isDefault;
      const newIsDefault = !isCurrentlyDefault;

      // 如果设为默认且模型未启用，则同时启用
      const needEnable = newIsDefault && !targetModel?.enabled;

      // 同步后端
      const updateData = { is_default: newIsDefault };
      if (needEnable) {
        updateData.is_enabled = true;
      }
      apiUpdateModel(modelId, updateData).catch((err) => {
        console.error('设为默认失败:', err);
      });

      const updated = (current.onelinkModelsByTab[tab] ?? []).map((model) => ({
        ...model,
        isDefault: isCurrentlyDefault ? false : model.id === modelId,
        enabled: model.id === modelId && needEnable ? true : model.enabled,
      }));
      return {
        ...current,
        onelinkModelsByTab: { ...current.onelinkModelsByTab, [tab]: sortModels(updated) },
      };
    });
  };

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
            title="配置OneLinkAI API"
            apiValue={state.onelinkApiKey}
            apiPlaceholder="输入你的API"
            onApiChange={(event) => {
              const inputValue = event.target.value;
              const maskedValue = inputValue.length > 7
                ? `${inputValue.slice(0, 3)}${'*'.repeat(Math.max(7, inputValue.length - 7))}${inputValue.slice(-4)}`
                : inputValue;
              setState((current) => ({
                ...current,
                onelinkApiKeyActual: inputValue,
                onelinkApiKey: maskedValue,
                onelinkKeyIsFromServer: false,
              }));
            }}
            activeTab={state.activeModelTab}
            onChangeTab={(tab) => updateState('activeModelTab', tab)}
            modelsByTab={state.onelinkModelsByTab}
            onAddModel={() => updateState('childView', 'edit-onelink-model')}
            onCancel={closeChild}
            onSave={saveOneLinkConfig}
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
            onCancel={() => updateState('childView', 'onelink-config')}
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
              const inputValue = event.target.value;
              const maskedValue = inputValue.length > 7
                ? `${inputValue.slice(0, 3)}${'*'.repeat(Math.max(7, inputValue.length - 7))}${inputValue.slice(-4)}`
                : inputValue;
              setState((current) => ({
                ...current,
                editProviderApiKeyActual: inputValue,
                editProviderApiKey: maskedValue,
                editProviderKeyIsFromServer: false,
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
            onCancel={() => updateState('childView', 'other-provider-config')}
            onSave={addEditProviderModelWithValidation}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Toast toasts={toasts} />
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
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-surface-overlay p-[24px] backdrop-blur-[20px]" onClick={closeMain}>
        <div className="relative overflow-hidden rounded-2xl" onClick={(event) => event.stopPropagation()}>
          <MainModal
            configured={state.mainConfigured}
            onelinkEnabled={state.onelinkEnabled}
            onelinkModelsByTab={state.onelinkModelsByTab}
            onelinkCreatedAt={state.onelinkCreatedAt}
            onClose={closeMain}
            onOpenOneLink={openOneLinkConfig}
            onComplete={closeMain}
            onEditOneLink={openOneLinkConfig}
            onToggleOneLink={() =>
              setState((current) => {
                if (!current.mainConfigured) return { ...current, childView: 'onelink-config' };
                return { ...current, onelinkEnabled: !current.onelinkEnabled };
              })
            }
            onTestOneLink={testConnection}
            availableModelCount={availableModelCount}
            bannerData={bannerData}
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
