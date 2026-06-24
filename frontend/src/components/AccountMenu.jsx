import { useEffect, useRef, useState } from 'react';
import { apiLogout } from '../api/auth';

// ─────────────────────────────────────────────────────────────────────────────

const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_REGULAR = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M11 2.5L13.5 5L5.5 13H3V10.5L11 2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M6 14H3.333C2.965 14 2.667 13.702 2.667 13.333V2.667C2.667 2.298 2.965 2 3.333 2H6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.667 11.333L14 8L10.667 4.667" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 8H6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function MenuItem({ icon: Icon, label, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      className="flex items-center gap-[4px] px-[12px] py-[8px] self-stretch rounded-md cursor-pointer w-full text-left border-0"
      style={{
        background: hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        color: hovered ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.6)',
        fontFamily: FONT_REGULAR,
        transition: 'background 120ms, color 120ms',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <Icon />
      <span style={{ fontFamily: FONT_REGULAR, fontSize: '14px', lineHeight: '20px' }}>
        {label}
      </span>
    </button>
  );
}

function Divider() {
  return <div className="self-stretch h-px bg-stroke-normal mx-[4px] flex-shrink-0" />;
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-baseline gap-[6px] w-full">
      <span style={{ fontFamily: FONT_REGULAR, fontSize: '12px', lineHeight: '18px', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
        {label}
      </span>
      <span className="truncate" style={{ fontFamily: FONT_REGULAR, fontSize: '12px', lineHeight: '18px', color: 'rgba(255,255,255,0.5)' }}>
        {value}
      </span>
    </div>
  );
}

function AvatarTrigger({ size, onOpenProfile, avatarUrl }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      className="relative border-0 cursor-pointer flex-shrink-0"
      style={{ padding: 0, background: 'transparent', borderRadius: 'calc(infinity * 1px)', width: size, height: size }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={(e) => { e.stopPropagation(); onOpenProfile(); }}
      title="编辑个人信息"
    >
      <AvatarSvg size={size} avatarUrl={avatarUrl} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'calc(infinity * 1px)',
          background: pressed ? 'rgba(0,0,0,0.45)' : hovered ? 'rgba(0,0,0,0.3)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 120ms',
        }}
      >
        {hovered && (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 2.5L13.5 5L5.5 13H3V10.5L11 2.5Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </button>
  );
}

function AvatarSvg({ size, avatarUrl }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="avatar"
        width={size}
        height={size}
        style={{ borderRadius: 'calc(infinity * 1px)', display: 'block', width: size, height: size, objectFit: 'cover' }}
      />
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 'calc(infinity * 1px)', display: 'block' }}>
      <rect width="28" height="28" rx="14" fill="#2DC3E1" />
      <rect x="0.5" y="0.5" width="27" height="27" rx="13.5" stroke="#FFFFFF80" />
      <path d="M16.028 20.344C16.028 21.48 15.12 22.4 14 22.4C12.88 22.4 11.973 21.48 11.973 20.344C11.973 19.209 12.88 18.288 14 18.288C15.12 18.288 16.028 19.209 16.028 20.344Z" fill="#FFFFFF" />
      <path d="M5.6 5.6C5.612 7.379 6.161 9.028 7.092 10.389C7.96 11.658 8.728 13.064 8.728 14.601V20.836C8.728 21.7 8.028 22.4 7.164 22.4C6.3 22.4 5.6 21.7 5.6 20.836V5.6Z" fill="#191919" />
      <path d="M22.4 20.836C22.4 21.7 21.699 22.4 20.836 22.4C19.972 22.4 19.271 21.7 19.271 20.836V14.601C19.271 13.064 20.04 11.658 20.907 10.389C21.838 9.028 22.387 7.379 22.399 5.6V20.836Z" fill="#191919" />
      <path d="M21.818 8.66C21.937 8.354 22.399 8.385 22.399 8.713C22.399 13.418 18.639 17.231 13.999 17.231C9.36 17.231 5.6 13.418 5.6 8.713C5.6 8.385 6.062 8.354 6.18 8.66C7.408 11.821 10.446 14.059 13.999 14.059C17.553 14.059 20.591 11.821 21.818 8.66Z" fill="#191919" />
    </svg>
  );
}

export default function AccountMenu({
  nickname = '',
  phone = '未绑定',
  wechat = '未绑定',
  avatarUrl = '',
  onLogout,
  onOpenProfile,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
     {/* Trigger */}
     <button
       type="button"
      className="[font-synthesis:none] flex items-center gap-[4px] rounded-full pl-[4px] pr-[12px] py-[4px] bg-black-20 antialiased cursor-pointer border-0"
       onClick={() => setOpen((v) => !v)}
       aria-expanded={open}
     >
       <AvatarSvg size={28} avatarUrl={avatarUrl} />
        <span
          className="truncate max-w-[120px]"
          style={{ fontFamily: FONT_REGULAR, fontSize: '14px', lineHeight: '20px', color: '#FFFFFF' }}
        >
          {nickname}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] flex flex-col rounded-medium bg-select-bg border border-select-border p-[4px] z-50"
          style={{
            width: '200px',
            boxShadow: '0px 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          {/* User info */}
          <div className="flex flex-col items-center pt-[16px] px-[12px] pb-[12px] gap-0">
            <AvatarTrigger
              size={40}
              onOpenProfile={() => { setOpen(false); onOpenProfile?.(); }}
              avatarUrl={avatarUrl}
            />
            {/* Nickname */}
            <span
              className="mt-[10px] w-full text-center truncate"
              style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}
            >
              {nickname}
            </span>
            {/* Phone + WeChat */}
            <div className="flex flex-col items-start w-full pt-[8px] gap-[2px]">
              {/* Phone */}
              <div className="flex items-center justify-between w-full mt-[6px] gap-[4px]">
                <span style={{ fontFamily: FONT_REGULAR, fontSize: '12px', lineHeight: '18px', color: '#FFFFFF99', flexShrink: 0 }}>手机号</span>
                <span className="truncate" style={{ fontFamily: FONT_REGULAR, fontSize: '12px', lineHeight: '18px', color: '#FFFFFFCC' }}>{phone}</span>
              </div>
              {/* WeChat */}
              <div className="flex items-center justify-between w-full mt-[2px] gap-[4px]">
                <span style={{ fontFamily: FONT_REGULAR, fontSize: '12px', lineHeight: '18px', color: '#FFFFFF99', flexShrink: 0 }}>微信</span>
                <span className="truncate" style={{ fontFamily: FONT_REGULAR, fontSize: '12px', lineHeight: '18px', color: '#FFFFFF66' }}>{wechat}</span>
              </div>
            </div>
          </div>

          <Divider />

          <div className="flex flex-col pt-[4px]">
            <MenuItem
              icon={IconEdit}
              label="编辑个人信息"
              onClick={() => { setOpen(false); onOpenProfile?.(); }}
            />
            <MenuItem
              icon={IconLogout}
              label="退出登录"
              onClick={async () => { setOpen(false); await apiLogout(); onLogout?.(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
