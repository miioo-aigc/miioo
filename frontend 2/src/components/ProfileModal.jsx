import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ConfirmDialog from './ConfirmDialog';
import WechatOfficialQr from './WechatOfficialQr';
import { createSerialPolling } from '../utils/serialPolling';
import { apiUpdateProfile, apiUploadAvatar, apiDeleteAccount, apiGetWechatQrCode, apiPollWechatBind, apiUnbindWechat, apiSendPhoneCode, apiVerifyPhoneCode, apiRebindPhone } from '../api/user';

const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_REGULAR = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

const DANGER_RED = '#F75F5F';
const DANGER_RED_PRESS = 'rgba(247,95,95,0.7)';

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BackArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '24px', height: '24px', rotate: '90deg', flexShrink: 0, transformOrigin: '50% 50%' }}>
      <path d="M12 6L8 10L4 6" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UnlinkIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M7.369 5.344L9.962 2.751C10.916 1.796 12.432 1.764 13.348 2.68C14.263 3.595 14.231 5.111 13.276 6.065L10.684 8.658" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.361 7.357L2.769 9.95C1.814 10.904 1.69 12.374 2.697 13.335C3.704 14.296 5.129 14.219 6.083 13.264L8.676 10.671" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.921 7.025L10.217 5.729" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.896 10.05L7.192 8.754" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Avatar({ size = 64, src }) {
  if (src) {
    return (
      <img
        src={src}
        width={size}
        height={size}
        style={{ borderRadius: 'calc(infinity * 1px)', width: size, height: size, objectFit: 'cover', flexShrink: 0, display: 'block' }}
        alt="头像"
      />
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 'calc(infinity * 1px)', flexShrink: 0 }}>
      <rect width="28" height="28" rx="14" fill="#2DC3E1" />
      <rect x="0.5" y="0.5" width="27" height="27" rx="13.5" stroke="#FFFFFF80" />
      <path d="M16.028 20.344C16.028 21.48 15.12 22.4 14 22.4C12.88 22.4 11.973 21.48 11.973 20.344C11.973 19.209 12.88 18.288 14 18.288C15.12 18.288 16.028 19.209 16.028 20.344Z" fill="#FFFFFF" />
      <path d="M5.6 5.6C5.612 7.379 6.161 9.028 7.092 10.389C7.96 11.658 8.728 13.064 8.728 14.601V20.836C8.728 21.7 8.028 22.4 7.164 22.4C6.3 22.4 5.6 21.7 5.6 20.836V5.6Z" fill="#191919" />
      <path d="M22.4 20.836C22.4 21.7 21.699 22.4 20.836 22.4C19.972 22.4 19.271 21.7 19.271 20.836V14.601C19.271 13.064 20.04 11.658 20.907 10.389C21.838 9.028 22.387 7.379 22.399 5.6V20.836Z" fill="#191919" />
      <path d="M21.818 8.66C21.937 8.354 22.399 8.385 22.399 8.713C22.399 13.418 18.639 17.231 13.999 17.231C9.36 17.231 5.6 13.418 5.6 8.713C5.6 8.385 6.062 8.354 6.18 8.66C7.408 11.821 10.446 14.059 13.999 14.059C17.553 14.059 20.591 11.821 21.818 8.66Z" fill="#191919" />
    </svg>
  );
}

// 白名单：字母、数字、中文、下划线、连字符、点号、空格（单个、非首尾）
// 禁止首尾非字母数字中文，以及连续重复的符号（_ - . 空格）
const ALLOWED_CHAR_RE = /[^\p{L}\p{N}\p{Script=Han}_\-. ]/gu;
const REPEAT_SPECIAL_RE = /([_\-. ])\1+/g;
const TRIM_SPECIAL_RE = /^[_\-. ]+|[_\-. ]+$/g;

function filterUsername(raw) {
  let v = raw.replace(ALLOWED_CHAR_RE, '');
  v = v.replace(REPEAT_SPECIAL_RE, '$1');
  return v;
}

function ProfileField({ label, value, onChange, placeholder, maxLength, onBlurSave, filterInput }) {
  const [editing, setEditing] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const [editHovered, setEditHovered] = useState(false);

  const handleEditClick = () => {
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleChange = (e) => {
    if (filterInput) {
      const filtered = filterInput(e.target.value);
      onChange({ ...e, target: { ...e.target, value: filtered } });
    } else {
      onChange(e);
    }
  };

  const handleBlur = () => {
    setFocused(false);
    setEditing(false);
    // trim首尾符号后再保存
    if (filterInput) {
      const trimmed = value.replace(TRIM_SPECIAL_RE, '');
      if (trimmed !== value) {
        onChange({ target: { value: trimmed } });
        onBlurSave?.(trimmed);
        return;
      }
    }
    onBlurSave?.();
  };

  const count = maxLength ? (value?.length ?? 0) : null;
  const atLimit = maxLength && count >= maxLength;

  if (!editing) {
    return (
      <div className="flex items-center w-full" style={{ padding: '12px 24px', gap: '8px', height: '44px' }}>
        <span style={{ fontFamily: FONT_REGULAR, fontSize: '14px', lineHeight: '20px', color: '#FFFFFF99', width: '44px', flexShrink: 0 }}>
          {label}
        </span>
        <div className="flex items-center overflow-hidden justify-end" style={{ flex: 1 }}>
          <div className="flex items-center rounded-[6px]" style={{ gap: '8px' }}>
            <span
              className="line-clamp-1"
              style={{ fontFamily: FONT_REGULAR, fontSize: '14px', lineHeight: '20px', color: '#FFFFFFD9' }}
            >
              {value || placeholder}
            </span>
            <button
              type="button"
              onClick={handleEditClick}
              onMouseEnter={() => setEditHovered(true)}
              onMouseLeave={() => setEditHovered(false)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path d="M2.333 14H14.333" stroke={editHovered ? '#FFFFFF' : '#FFFFFF99'} strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3.667 8.907V11.333H6.106L13 4.436L10.565 2L3.667 8.907Z" stroke={editHovered ? '#FFFFFF' : '#FFFFFF99'} strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center w-full" style={{ padding: '12px 24px', gap: '8px' }}>
      <span style={{ fontFamily: FONT_REGULAR, fontSize: '14px', lineHeight: '20px', color: '#FFFFFF99', width: '44px', flexShrink: 0 }}>
        {label}
      </span>
      <div
        className="flex-1 flex items-center rounded-[6px]"
        style={{
          border: `1px solid ${focused ? 'var(--color-input-border-focus)' : 'var(--color-input-border-normal)'}`,
          background: 'var(--color-input-bg-normal)',
          padding: '7px 10px',
          gap: '6px',
          transition: 'border-color 120ms',
          ...(focused ? { boxShadow: '0px 0px 10px var(--color-glow)', mixBlendMode: 'lighten' } : {}),
        }}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          maxLength={maxLength}
          className="flex-1 bg-transparent border-0 outline-none placeholder:text-[rgba(255,255,255,0.2)]"
          style={{ fontFamily: FONT_REGULAR, fontSize: '14px', lineHeight: '20px', color: 'rgba(255,255,255,0.85)', minWidth: 0 }}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
        />
        {maxLength && (
          <span style={{ fontFamily: FONT_REGULAR, fontSize: '12px', lineHeight: '18px', color: atLimit ? '#F75F5F' : 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
            {count}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}

function UnlinkButton({ onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const color = pressed ? DANGER_RED_PRESS : hovered ? DANGER_RED : '#FFFFFF99';
  return (
    <button
      type="button"
      className="flex items-center border-0 cursor-pointer bg-transparent"
      style={{ gap: '4px', padding: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={onClick}
    >
      <UnlinkIcon color={color} />
      <span style={{ fontFamily: FONT_REGULAR, fontSize: '14px', lineHeight: '20px', color, transition: 'color 120ms' }}>
        解绑
      </span>
    </button>
  );
}

function PhoneRow({ phone, onUnbind }) {
  return (
    <div className="flex items-center w-full" style={{ padding: '0 24px', height: '52px', justifyContent: 'space-between' }}>
      <span style={{ fontFamily: FONT_REGULAR, fontSize: '14px', lineHeight: '20px', color: '#FFFFFF99', width: '44px', flexShrink: 0 }}>
        手机号
      </span>
      <div className="flex items-center" style={{ gap: '8px' }}>
        <span style={{ fontFamily: FONT_REGULAR, fontSize: '14px', lineHeight: '20px', color: 'rgba(255,255,255,0.85)' }}>
          {phone}
        </span>
        <UnlinkButton onClick={onUnbind} />
      </div>
    </div>
  );
}

function WechatUnboundRow({ onBind }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      className="flex items-center w-full border-0 cursor-pointer"
      style={{ padding: '0 24px', height: '52px', justifyContent: 'space-between', background: 'transparent' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={onBind}
    >
      <span style={{ fontFamily: FONT_REGULAR, fontSize: '14px', lineHeight: '20px', color: '#FFFFFF99', width: '44px', flexShrink: 0, textAlign: 'left' }}>
        微信
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontFamily: FONT_REGULAR, fontSize: '14px', lineHeight: '20px', color: pressed ? 'rgba(82,191,146,0.7)' : '#52BF92', transition: 'color 120ms' }}>
          去绑定
        </span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ rotate: '270deg', flexShrink: 0 }}>
          <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round" />
        </svg>
      </div>
    </button>
  );
}

function WechatBoundRow({ nickname, onUnbind }) {
  return (
    <div className="flex items-center w-full" style={{ padding: '0 24px', height: '52px', justifyContent: 'space-between' }}>
      <span style={{ fontFamily: FONT_REGULAR, fontSize: '14px', lineHeight: '20px', color: '#FFFFFF99', width: '44px', flexShrink: 0 }}>
        微信
      </span>
      <div className="flex items-center" style={{ gap: '8px' }}>
        <span style={{ fontFamily: FONT_REGULAR, fontSize: '14px', lineHeight: '20px', color: 'rgba(255,255,255,0.85)' }}>
          {nickname}
        </span>
        <UnlinkButton onClick={onUnbind} />
      </div>
    </div>
  );
}

function DangerRow({ label, value, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div className="flex items-center w-full" style={{ padding: '12px 24px', height: '52px', justifyContent: 'space-between', flexShrink: 0 }}>
      <span style={{ fontFamily: FONT_REGULAR, fontSize: '14px', lineHeight: '20px', color: '#FFFFFF99' }}>
        {label}
      </span>
      <button
        type="button"
        className="border-0 cursor-pointer bg-transparent"
        style={{ padding: '2px 6px', margin: '-2px -6px', borderRadius: '6px', fontFamily: FONT_REGULAR, fontSize: '14px', lineHeight: '20px', color: pressed ? DANGER_RED_PRESS : DANGER_RED, background: pressed ? 'rgba(247,95,95,0.1)' : hovered ? 'rgba(247,95,95,0.06)' : 'transparent', transition: 'color 120ms, background 120ms', textAlign: 'right' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false); }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onClick={onClick}
      >
        {value}
      </button>
    </div>
  );
}

// DeleteConfirmDialog 已迁移至 ConfirmDialog 共享组件

// WechatUnbindConfirmDialog 已迁移至 ConfirmDialog 共享组件

const GRADIENT_BTN = 'linear-gradient(148.76deg, #ABFFFF4D 3.64%, #2DC3E100 42.81%), linear-gradient(#FFFFFF14)';

function GhostBtn({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="[font-synthesis:none] flex items-center gap-[4px] px-[16px] justify-center rounded-medium h-[36px] bg-btn-primary-bg-normal hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active border border-btn-primary-border [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0 [box-shadow:var(--color-shadow)_3px_3px_8px] shrink-0 antialiased cursor-pointer"
    >
      <span className="text-text-secondary text-font-size-14 shrink-0" style={{ fontFamily: FONT_REGULAR }}>
        {children}
      </span>
    </button>
  );
}

function PrimaryBtn({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="[font-synthesis:none] flex flex-col items-start h-[36px] rounded-medium [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0 [box-shadow:var(--color-shadow)_3px_3px_8px] shrink-0 antialiased p-[1px] cursor-pointer border-none"
      style={{ backgroundImage: GRADIENT_BTN }}
    >
      <div className="flex items-center gap-[4px] px-[16px] justify-center rounded-[7px] flex-1 w-full bg-btn-primary-bg-normal hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active">
        <span className="text-white text-font-size-14 shrink-0 whitespace-nowrap" style={{ fontFamily: FONT_REGULAR }}>
          {children}
        </span>
      </div>
    </button>
  );
}

function CodeInput({ value, onChange, phone, maskedPhone }) {
  const [countdown, setCountdown] = useState(0);
  const [inputState, setInputState] = useState('normal');
  const timerRef = useRef(null);

  const handleSend = async () => {
    if (countdown > 0) return;
    await apiSendPhoneCode(phone || maskedPhone);
    setCountdown(60);
  };

  useEffect(() => {
    if (countdown <= 0) return;
    timerRef.current = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [countdown]);

  const canSend = countdown === 0;

  const borderClass = inputState === 'focus'
    ? 'border-input-border-focus'
    : inputState === 'hover'
    ? 'border-input-border-hover'
    : 'border-input-border-normal';

  const shadowStyle = inputState === 'focus'
    ? { boxShadow: '0px 0px 10px var(--color-glow)', mixBlendMode: 'lighten' }
    : {};

  return (
    <div
      className={`flex items-center gap-[8px] h-[36px] pl-[12px] pr-[6px] rounded-medium justify-between self-stretch shrink-0 bg-input-bg-normal border border-solid ${borderClass} [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0 antialiased`}
      style={shadowStyle}
      onMouseEnter={() => inputState === 'normal' && setInputState('hover')}
      onMouseLeave={() => inputState === 'hover' && setInputState('normal')}
    >
      <input
        value={value}
        onChange={onChange}
        onFocus={() => setInputState('focus')}
        onBlur={() => setInputState('normal')}
        placeholder="请输入短信验证码"
        className="flex-1 bg-transparent border-0 outline-none text-input-text-content text-font-size-14 placeholder:text-input-text-hint"
        style={{ fontFamily: FONT_REGULAR, lineHeight: '18px' }}
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        className={`flex items-center h-[24px] shrink-0 rounded-[6px] px-[8px] gap-[4px] [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0 [box-shadow:var(--color-shadow)_3px_3px_8px] border border-btn-primary-border bg-btn-primary-bg-normal ${canSend ? 'hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active cursor-pointer' : 'cursor-default'}`}
      >
        <span
          className={`inline-block w-max shrink-0 text-font-size-12 ${canSend ? 'text-text-secondary' : 'text-text-disabled'}`}
          style={{ fontFamily: FONT_REGULAR }}
        >
          {countdown > 0 ? `${countdown}s` : '获取'}
        </span>
      </button>
    </div>
  );
}

function PhoneUnbindStep1({ currentPhone, onNext, onCancel }) {
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    if (!code) { setCodeError(true); return; }
    setLoading(true);
    const res = await apiVerifyPhoneCode(currentPhone, code);
    setLoading(false);
    if (!res.valid) { setCodeError(true); return; }
    setCodeError(false);
    onNext();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={onCancel}
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', background: '#161616', border: '0.555556px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden', width: '400px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between', width: '100%', padding: '16px 24px', boxSizing: 'border-box', borderRadius: '16px 16px 0 0' }}>
          <span style={{ flex: 1, fontFamily: FONT_MEDIUM, fontWeight: 500, color: '#FFFFFF', fontSize: '16px', lineHeight: '20px' }}>手机号解绑</span>
          <button type="button" onClick={onCancel} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}>
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '16px', padding: '8px 24px', width: '100%', boxSizing: 'border-box' }}>
          {/* Phone display */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', alignSelf: 'stretch' }}>
            <span style={{ fontFamily: FONT_REGULAR, color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '18px' }}>手机号</span>
            <span style={{ fontFamily: FONT_REGULAR, color: '#FFFFFF', fontSize: '14px', lineHeight: '18px' }}>{currentPhone}</span>
          </div>
          {/* Code field */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', alignSelf: 'stretch' }}>
            <span style={{ fontFamily: FONT_REGULAR, color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '18px' }}>验证码</span>
            <CodeInput value={code} onChange={e => { setCode(e.target.value); setCodeError(false); }} maskedPhone={currentPhone} />
            <div style={{ padding: '0 13px', opacity: codeError ? 1 : 0, transition: 'opacity 120ms' }}>
              <span style={{ fontFamily: FONT_REGULAR, color: '#F75F5F', fontSize: '14px', lineHeight: '18px' }}>验证码错误</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'flex-end', width: '100%', padding: '16px 24px', boxSizing: 'border-box', borderRadius: '0 0 16px 16px' }}>
          <GhostBtn onClick={onCancel}>取消</GhostBtn>
          <PrimaryBtn onClick={handleNext}>{loading ? '验证中…' : '下一步'}</PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

function PhoneUnbindStep2({ onBind, onCancel }) {
  const [newPhone, setNewPhone] = useState('');
  const [code, setCode] = useState('');
  const [phoneError, setPhoneError] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phoneInputState, setPhoneInputState] = useState('normal');

  const handleBind = async () => {
    const phoneOk = /^1\d{10}$/.test(newPhone);
    if (!phoneOk) { setPhoneError(true); return; }
    if (!code) { setCodeError(true); return; }
    setLoading(true);
    const res = await apiRebindPhone(newPhone, code).catch(() => null);
    setLoading(false);
    if (res === null) { setCodeError(true); return; }
    onBind(newPhone);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={onCancel}
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', background: '#161616', border: '0.555556px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden', width: '400px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between', width: '100%', padding: '16px 24px', boxSizing: 'border-box', borderRadius: '16px 16px 0 0' }}>
          <span style={{ flex: 1, fontFamily: FONT_MEDIUM, fontWeight: 500, color: '#FFFFFF', fontSize: '16px', lineHeight: '20px' }}>更换手机号</span>
          <button type="button" onClick={onCancel} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}>
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '16px', padding: '8px 24px', width: '100%', boxSizing: 'border-box' }}>
          {/* New phone field */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', alignSelf: 'stretch' }}>
            <span style={{ fontFamily: FONT_REGULAR, color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '18px' }}>手机号</span>
            <div
              className={`flex items-center h-[36px] pl-[12px] pr-[12px] rounded-medium self-stretch bg-input-bg-normal border border-solid ${phoneError ? 'border-input-border-wrong' : phoneInputState === 'focus' ? 'border-input-border-focus' : phoneInputState === 'hover' ? 'border-input-border-hover' : 'border-input-border-normal'} [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0 antialiased`}
              style={phoneInputState === 'focus' && !phoneError ? { boxShadow: '0px 0px 10px var(--color-glow)', mixBlendMode: 'lighten' } : {}}
              onMouseEnter={() => phoneInputState === 'normal' && setPhoneInputState('hover')}
              onMouseLeave={() => phoneInputState === 'hover' && setPhoneInputState('normal')}
            >
              <input
                value={newPhone}
                onChange={e => { setNewPhone(e.target.value); setPhoneError(false); }}
                onFocus={() => setPhoneInputState('focus')}
                onBlur={() => setPhoneInputState('normal')}
                placeholder="请输入11位数字手机号"
                maxLength={11}
                className="flex-1 bg-transparent border-0 outline-none text-input-text-content text-font-size-14 placeholder:text-input-text-hint"
                style={{ fontFamily: FONT_REGULAR, lineHeight: '18px' }}
              />
            </div>
            <div style={{ padding: '0 13px', opacity: phoneError ? 1 : 0, transition: 'opacity 120ms' }}>
              <span style={{ fontFamily: FONT_REGULAR, color: '#F75F5F', fontSize: '14px', lineHeight: '18px' }}>手机号格式错误</span>
            </div>
          </div>
          {/* Code field */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', alignSelf: 'stretch' }}>
            <span style={{ fontFamily: FONT_REGULAR, color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '18px' }}>验证码</span>
            <CodeInput value={code} onChange={e => { setCode(e.target.value); setCodeError(false); }} phone={newPhone} />
            <div style={{ padding: '0 13px', opacity: codeError ? 1 : 0, transition: 'opacity 120ms' }}>
              <span style={{ fontFamily: FONT_REGULAR, color: '#F75F5F', fontSize: '14px', lineHeight: '18px' }}>验证码错误</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'flex-end', width: '100%', padding: '16px 24px', boxSizing: 'border-box', borderRadius: '0 0 16px 16px' }}>
          <GhostBtn onClick={onCancel}>取消</GhostBtn>
          <PrimaryBtn onClick={handleBind}>{loading ? '绑定中…' : '绑定'}</PrimaryBtn>
        </div>
      </div>
    </div>
  );
}


function DeleteVerifyDialog({ maskedPhone, onConfirm, onCancel }) {
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!code) { setCodeError(true); return; }
    setLoading(true);
    const res = await apiVerifyPhoneCode(maskedPhone, code);
    setLoading(false);
    if (!res.valid) { setCodeError(true); return; }
    setCodeError(false);
    await onConfirm();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={onCancel}
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', background: '#161616', border: '0.555556px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden', width: '400px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between', width: '100%', padding: '16px 24px', boxSizing: 'border-box' }}>
          <span style={{ flex: 1, fontFamily: FONT_MEDIUM, fontWeight: 500, color: '#FFFFFF', fontSize: '16px', lineHeight: '20px' }}>验证手机号</span>
          <button type="button" onClick={onCancel} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}>
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '16px', padding: '8px 24px', width: '100%', boxSizing: 'border-box' }}>
          {/* Phone display */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', alignSelf: 'stretch' }}>
            <span style={{ fontFamily: FONT_REGULAR, color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '18px' }}>手机号</span>
            <span style={{ fontFamily: FONT_REGULAR, color: '#FFFFFF', fontSize: '14px', lineHeight: '18px' }}>{maskedPhone}</span>
          </div>
          {/* Code field */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', alignSelf: 'stretch' }}>
            <span style={{ fontFamily: FONT_REGULAR, color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '18px' }}>验证码</span>
            <CodeInput value={code} onChange={e => { setCode(e.target.value); setCodeError(false); }} maskedPhone={maskedPhone} />
            <div style={{ padding: '0 13px', opacity: codeError ? 1 : 0, transition: 'opacity 120ms' }}>
              <span style={{ fontFamily: FONT_REGULAR, color: '#F75F5F', fontSize: '14px', lineHeight: '18px' }}>验证码错误</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'flex-end', width: '100%', padding: '16px 24px', boxSizing: 'border-box' }}>
          <GhostBtn onClick={onCancel}>取消</GhostBtn>
          <button
            type="button"
            disabled={loading || !code}
            onClick={handleConfirm}
            className="[font-synthesis:none] flex items-center justify-center h-9 px-[16px] rounded-medium shrink-0 bg-btn-danger-bg-normal hover:bg-btn-danger-bg-hover active:bg-btn-danger-bg-active border border-btn-danger-border [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0 antialiased"
            style={{ cursor: loading || !code ? 'default' : 'pointer', opacity: loading || !code ? 0.5 : 1 }}
          >
            <span className="text-btn-danger-text text-font-size-14 font-font-weight-medium shrink-0" style={{ fontFamily: FONT_MEDIUM }}>
              {loading ? '注销中…' : '确认注销'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function WechatBindView({ onBack, onClose, onBindSuccess }) {
  const [qrStatus, setQrStatus] = useState('loading'); // loading | ready | scanned | expired | error
  const [authUrl, setAuthUrl] = useState('');
  const pollingRef = useRef(null);
  const ticketRef = useRef(null);

  const startPolling = (ticket) => {
    if (pollingRef.current) { pollingRef.current.stop(); pollingRef.current = null; }
    pollingRef.current = createSerialPolling({
      task: async () => apiPollWechatBind(ticket),
      interval: 2000,
      onResult: (data) => {
        if (data.status === 'scanned') {
          setQrStatus('scanned');
        } else if (data.status === 'confirmed') {
          pollingRef.current?.stop();
          onBindSuccess(data.wechat_nickname);
        } else if (data.status === 'expired') {
          pollingRef.current?.stop();
          setQrStatus('expired');
        } else if (data.status === 'error') {
          pollingRef.current?.stop();
          setQrStatus('error');
        }
      },
      onError: () => {
        pollingRef.current?.stop();
        setQrStatus('error');
      },
      maxConsecutiveErrors: 3,
      pauseWhenHidden: true,
    });
    pollingRef.current.start();
  };

  const loadQrCode = async () => {
    setQrStatus('loading');
    setAuthUrl('');
    try {
      const data = await apiGetWechatQrCode();
      ticketRef.current = data.ticket;
      setAuthUrl(data.qrCodeValue);
      setQrStatus('ready');
      startPolling(data.ticket);
    } catch {
      setQrStatus('error');
    }
  };

  useEffect(() => {
    loadQrCode();
    return () => { pollingRef.current?.stop(); pollingRef.current = null; };
  }, []);

  const isExpiredOrError = qrStatus === 'expired' || qrStatus === 'error';
  const qrLabel = {
    loading: '正在获取二维码…',
    ready: '请使用微信扫码',
    scanned: '扫码成功，请在微信端确认',
    expired: '二维码已过期，点击刷新',
    error: '加载失败，点击重试',
  }[qrStatus] ?? '请使用微信扫码';

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '4px' }}>
          <button type="button" onClick={() => { pollingRef.current?.stop(); onBack(); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
            <BackArrowIcon />
          </button>
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF', flex: 1 }}>
            微信绑定
          </span>
        </div>
        <button type="button" onClick={() => { pollingRef.current?.stop(); onClose(); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <CloseIcon />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '12px' }}>
        <div
          onClick={isExpiredOrError ? loadQrCode : undefined}
          style={{
            position: 'relative',
            width: 284,
            height: 284,
            flexShrink: 0,
            borderRadius: 8,
            overflow: 'hidden',
            cursor: isExpiredOrError ? 'pointer' : 'default',
          }}
        >
          {qrStatus !== 'loading' && !isExpiredOrError && authUrl && (
            <WechatOfficialQr
              authUrl={authUrl}
              containerId="wechat-bind-qr-container"
              onReady={() => {}}
              onError={() => setQrStatus('error')}
            />
          )}
          {qrStatus === 'loading' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
              <div style={{ width: 24, height: 24, border: '2px solid #FFFFFF33', borderTopColor: '#2DC3E1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}
          {isExpiredOrError && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1D1E1E', borderRadius: 8 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4V8M12 4L9 7M12 4L15 7" stroke="#FFFFFFCC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 12C4 7.582 7.582 4 12 4" stroke="#FFFFFFCC" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M20 12C20 16.418 16.418 20 12 20C7.582 20 4 16.418 4 12" stroke="#FFFFFF33" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <div style={{ fontFamily: FONT_REGULAR, color: '#FFFFFFCC', fontSize: 12, lineHeight: '16px' }}>点击刷新</div>
            </div>
          )}
          {qrStatus === 'scanned' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1D1E1E', borderRadius: 8 }}>
              <svg width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round" />
                <path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div style={{ fontFamily: FONT_REGULAR, color: '#52BF92', fontSize: 12, lineHeight: '16px' }}>扫码成功</div>
            </div>
          )}
        </div>
        <span style={{ fontFamily: FONT_REGULAR, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>
          {qrLabel}
        </span>
      </div>
    </>
  );
}

export default function ProfileModal({
  open,
  currentUser = {},
  onLogout,
  onClose,
  onProfileUpdated,
}) {
  const [nameVal, setNameVal] = useState('');
  const [deleteStep, setDeleteStep] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [wechatView, setWechatView] = useState('profile');
  const [boundWechat, setBoundWechat] = useState(null);
  const [phoneUnbindStep, setPhoneUnbindStep] = useState(null);
  const [boundPhone, setBoundPhone] = useState(null);
  const [wechatUnbindConfirm, setWechatUnbindConfirm] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = (msg, type = 'warning') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    if (!open) return;
    setNameVal(currentUser.nickname ?? '');
    setAvatarUrl(currentUser.avatar_url ?? null);
    setBoundPhone(currentUser.phone_bound ? (currentUser.phone ?? '已绑定') : null);
    setBoundWechat(currentUser.wechat_bound ? (currentUser.wechat ?? '已绑定') : null);
    setWechatView('profile');
    setDeleteStep(null);
    setPhoneUnbindStep(null);
  }, [open]);

  const handleClose = () => {
    if (wechatView !== 'profile') {
      setWechatView('profile');
      return;
    }
    onClose?.();
  };

  const handleLocalPreview = (localUrl) => setAvatarUrl(localUrl);

  const handleAvatarUploaded = async (cdnUrl) => {
    setAvatarUrl(cdnUrl);
    const updated = await apiUpdateProfile({ nickname: nameVal, avatar_url: cdnUrl }).catch(() => null);
    if (updated) onProfileUpdated?.(updated);
  };

  const handleBindSuccess = (nickname) => {
    setBoundWechat(nickname || '已绑定');
    setWechatView('profile');
  };

  const handleUnbindWechat = async () => {
    await apiUnbindWechat();
    setBoundWechat(null);
    setWechatUnbindConfirm(false);
  };

  const handlePhoneRebindSuccess = (newPhone) => {
    setBoundPhone(newPhone);
    setPhoneUnbindStep(null);
  };

  if (!open) return null;

  const isBindView = wechatView === 'qrcode' || wechatView === 'confirming';

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={handleClose}
    >
      <div
        style={{ width: '400px', minHeight: '456px', background: '#161616', border: '0.555556px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {isBindView ? (
          <WechatBindView
            onBack={() => setWechatView('profile')}
            onClose={handleClose}
            onBindSuccess={handleBindSuccess}
          />
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', gap: '16px' }}>
              <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: 'rgba(255,255,255,1)', flex: 1 }}>
                个人信息
              </span>
              <button type="button" className="flex items-center justify-center border-0 cursor-pointer rounded-[6px]" style={{ width: '28px', height: '28px', background: 'transparent', padding: 0 }} onClick={handleClose}>
                <CloseIcon />
              </button>
            </div>

            {/* Avatar section */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', gap: '8px' }}>
              <AvatarEditButton avatarSrc={avatarUrl} onLocalPreview={handleLocalPreview} onUploaded={handleAvatarUploaded} showToast={showToast} />
              <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: 'rgba(255,255,255,0.85)' }}>
                {nameVal || currentUser.nickname || ''}
              </span>
              <span style={{ fontFamily: FONT_REGULAR, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF99' }}>
                ID：{currentUser.display_id ?? currentUser.id ?? ''}
              </span>
            </div>

            {/* Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '0' }}>
              <ProfileField
                label="用户名"
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                placeholder="请输入用户名"
                maxLength={20}
                filterInput={filterUsername}
                onBlurSave={async (overrideVal) => {
                  const val = overrideVal ?? nameVal;
                  if (val !== (currentUser.nickname ?? '')) {
                    const updated = await apiUpdateProfile({ nickname: val, avatar_url: avatarUrl }).catch(() => null);
                    if (updated) {
                      onProfileUpdated?.(updated);
                    } else {
                      showToast('用户名修改失败，请稍后重试');
                      setNameVal(currentUser.nickname ?? '');
                    }
                  }
                }}
              />
              <PhoneRow phone={boundPhone} onUnbind={() => setPhoneUnbindStep('step1')} />
              {boundWechat ? (
                <WechatBoundRow nickname={boundWechat} onUnbind={() => setWechatUnbindConfirm(true)} />
              ) : (
                <WechatUnboundRow onBind={() => setWechatView('qrcode')} />
              )}
              <DangerRow label="注销账号" value="永久删除账号及所有数据" onClick={() => setDeleteStep('confirm')} />
            </div>
          </>
        )}
      </div>
      {deleteStep === 'confirm' && (
        <ConfirmDialog
          title="确认注销账号？"
          description="注销后账号及所有数据将被永久删除，无法恢复。"
          confirmText="继续注销"
          onConfirm={() => setDeleteStep('verify')}
          onCancel={() => setDeleteStep(null)}
          zIndex={70}
        />
      )}
      {deleteStep === 'verify' && (
        <DeleteVerifyDialog
          maskedPhone={boundPhone}
          onConfirm={async () => {
            await apiDeleteAccount();
            setDeleteStep(null);
            onLogout?.();
          }}
          onCancel={() => setDeleteStep(null)}
        />
      )}
      {phoneUnbindStep === 'step1' && (
        <PhoneUnbindStep1
          currentPhone={boundPhone}
          onNext={() => setPhoneUnbindStep('step2')}
          onCancel={() => setPhoneUnbindStep(null)}
        />
      )}
      {phoneUnbindStep === 'step2' && (
        <PhoneUnbindStep2
          onBind={handlePhoneRebindSuccess}
          onCancel={() => setPhoneUnbindStep(null)}
        />
      )}
      {wechatUnbindConfirm && (
        <ConfirmDialog
          title="确认解绑微信？"
          description="解绑后，微信将无法用于登录本账号。"
          confirmText="确认解绑"
          onConfirm={handleUnbindWechat}
          onCancel={() => setWechatUnbindConfirm(false)}
          zIndex={70}
        />
      )}
      {toast && createPortal(
        <div style={{ position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'none', animation: 'slideUpBounce 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
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
            {(toast.type === 'warning' || !toast.type) && (
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
            <span className="text-text-primary text-font-size-16 font-font-weight-regular" style={{ fontFamily: FONT_REGULAR }}>
              {toast.msg}
            </span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function AvatarEditButton({ avatarSrc, onLocalPreview, onUploaded, showToast }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      showToast('抱歉，平台暂不支持上传20M以上的图片资源！');
      e.target.value = '';
      return;
    }
    const localUrl = URL.createObjectURL(file);
    onLocalPreview(localUrl);
    const result = await apiUploadAvatar(file);
    if (result?.avatarUrl) {
      onUploaded(result.avatarUrl);
      URL.revokeObjectURL(localUrl);
    }
    e.target.value = '';
  };

  return (
    <button
      type="button"
      className="relative border-0 cursor-pointer"
      style={{ padding: 0, background: 'transparent', borderRadius: 'calc(infinity * 1px)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={() => fileInputRef.current?.click()}
    >
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" style={{ display: 'none' }} onChange={handleFileChange} />
      <div style={{ position: 'relative', width: '64px', height: '64px' }}>
        <Avatar size={64} src={avatarSrc} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: 'calc(infinity * 1px)', background: pressed ? 'rgba(0,0,0,0.45)' : hovered ? 'rgba(0,0,0,0.3)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 120ms' }}>
          {hovered && (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.5 3.5L16.5 6.5L7 16H4V13L13.5 3.5Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>
    </button>
  );
}
