import { useState } from 'react';
import { sendVerificationCode, loginWithPhone, bindPhone } from '../api/auth';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const QR_CODE_URL = 'https://app.paper.design/file-assets/01KQYRKV5GAPKWF7X9K33912CS/01KR8EAVS6CW9V257SBVP40T1A.png';

function BrandLogo() {
  return (
    <svg width="80" height="25" viewBox="0 0 80 25" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 70, height: 25, display: 'block', flexShrink: 0 }}>
      <path d="M28.3 7.265H32.862V24.161H28.3V7.265Z" fill="#FFFFFF" />
      <path d="M35.903 7.265H40.465V24.161H35.903V7.265Z" fill="#FFFFFF" />
      <path d="M15.206 21.204C15.206 22.837 13.882 24.16 12.249 24.16C10.616 24.16 9.292 22.837 9.292 21.204C9.292 19.571 10.616 18.247 12.249 18.247C13.882 18.247 15.206 19.571 15.206 21.204Z" fill="#00D4FF" />
      <path fillRule="evenodd" clipRule="evenodd" d="M0 24.161L0 3.295H0.056H0.472C1.175 5.75 2.626 7.89 4.562 9.453V24.161H0Z" fill="#FFFFFF" />
      <path fillRule="evenodd" clipRule="evenodd" d="M24.498 24.161H19.936V9.453C21.872 7.89 23.323 5.75 24.026 3.295H24.442H24.498L24.498 24.161Z" fill="#FFFFFF" />
      <path d="M55.333 15.713C55.333 13.847 53.82 12.334 51.954 12.334C50.087 12.334 48.575 13.847 48.575 15.713C48.575 17.579 50.087 19.092 51.954 19.092V24.161C47.288 24.161 43.506 20.378 43.506 15.713C43.506 11.047 47.288 7.265 51.954 7.265C56.619 7.265 60.401 11.047 60.401 15.713C60.401 20.378 56.619 24.161 51.954 24.161V19.092C53.82 19.092 55.333 17.579 55.333 15.713Z" fill="#FFFFFF" />
      <path d="M74.931 15.713C74.931 13.847 73.418 12.334 71.552 12.334C69.686 12.334 68.173 13.847 68.173 15.713C68.173 17.579 69.686 19.092 71.552 19.092V24.161C66.887 24.161 63.105 20.378 63.105 15.713C63.105 11.047 66.887 7.265 71.552 7.265C76.218 7.265 80 11.047 80 15.713C80 20.378 76.218 24.161 71.552 24.161V19.092C73.418 19.092 74.931 17.579 74.931 15.713Z" fill="#FFFFFF" />
      <path d="M35.734 0C37.274 0 38.522 1.248 38.522 2.788C38.522 4.327 37.274 5.575 35.734 5.575C35.243 5.575 34.783 5.449 34.382 5.226C35.239 4.75 35.818 3.837 35.818 2.788C35.818 1.739 35.239 0.825 34.382 0.349C34.783 0.127 35.243 0 35.734 0Z" fill="#00D4FF" style={{ opacity: '0.4' }} />
      <path d="M38.437 0C39.977 0 41.225 1.248 41.225 2.788C41.225 4.327 39.977 5.575 38.437 5.575C37.947 5.575 37.486 5.449 37.086 5.226C37.942 4.75 38.522 3.837 38.522 2.788C38.522 1.739 37.942 0.825 37.086 0.349C37.486 0.127 37.947 0 38.437 0ZM35.814 2.938C35.813 2.958 35.812 2.979 35.81 2.999C35.812 2.979 35.813 2.958 35.814 2.938Z" fill="#00D4FF" style={{ opacity: '0.2' }} />
      <path d="M35.818 2.788C35.818 4.327 34.57 5.575 33.03 5.575C31.491 5.575 30.243 4.327 30.243 2.788C30.243 1.248 31.491 0 33.03 0C34.57 0 35.818 1.248 35.818 2.788Z" fill="#00D4FF" style={{ opacity: '0.6' }} />
      <path d="M33.115 2.788C33.115 4.327 31.867 5.575 30.327 5.575C28.788 5.575 27.54 4.327 27.54 2.788C27.54 1.248 28.788 0 30.327 0C31.867 0 33.115 1.248 33.115 2.788Z" fill="#00D4FF" />
      <path fillRule="evenodd" clipRule="evenodd" d="M12.249 12.165C17.842 12.165 22.559 8.416 24.026 3.295H24.442C24.479 3.684 24.498 4.078 24.498 4.477C24.498 11.242 19.014 16.727 12.249 16.727C5.484 16.727 0 11.242 0 4.477C0 4.078 0.019 3.684 0.056 3.295H0.472C1.939 8.416 6.656 12.165 12.249 12.165Z" fill="#FFFFFF" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <defs>
        <clipPath id="login-modal-success-clip">
          <rect width="16" height="16" fill="#fff" />
        </clipPath>
      </defs>
      <g clipPath="url(#login-modal-success-clip)">
        <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round" />
        <path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function ModalHeader({ onClose }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
        justifyContent: 'space-between',
        width: '100%',
        paddingTop: 16,
        paddingBottom: 16,
        paddingLeft: 24,
        paddingRight: 32,
        position: 'relative',
        backgroundColor: '#161616',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingTop: 24,
          paddingBottom: 24,
          flex: 1,
          gap: 4,
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            height: 20,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            fontFamily: FONT_MEDIUM,
            fontWeight: 500,
            color: '#FFFFFF',
            fontSize: 20,
            lineHeight: '24px',
          }}
        >
          欢迎登录
        </div>
        <BrandLogo />
      </div>
      <button
        type="button"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          padding: 0,
          margin: 0,
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          width: 16,
          height: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: 0,
        margin: 0,
        border: 0,
        background: 'transparent',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 'fit-content',
          fontFamily: active ? FONT_MEDIUM : FONT,
          fontWeight: active ? 500 : 400,
          color: '#FFFFFF',
          fontSize: 14,
          lineHeight: '18px',
        }}
      >
        {children}
      </div>
      {active && <div style={{ height: 2, width: '100%', flexShrink: 0, backgroundColor: '#DDDDDD' }} />}
    </button>
  );
}

function Tabs({ tab, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, alignSelf: 'stretch' }}>
      <TabButton active={tab === 'phone'} onClick={() => onChange('phone')}>手机号</TabButton>
      <TabButton active={tab === 'wechat'} onClick={() => onChange('wechat')}>微信扫码</TabButton>
    </div>
  );
}

function SendCodeButton({ phone }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const backgroundColor = pressed ? '#111111' : hovered ? '#1D1E1E' : '#161616';
  const borderColor = pressed ? '#FFFFFF14' : hovered ? '#FFFFFF1F' : '#FFFFFF0D';
  const textColor = pressed ? '#FFFFFF99' : hovered ? '#FFFFFF' : '#FFFFFFCC';

  return (
    <button
      type="button"
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 24,
        flexShrink: 0,
        borderRadius: 6,
        paddingLeft: 8,
        paddingRight: 8,
        gap: 4,
        boxShadow: pressed ? 'none' : '#00000066 3px 3px 8px',
        backgroundColor,
        border: `1px solid ${borderColor}`,
        outline: '1px solid #00000080',
        cursor: 'pointer',
        transition: 'background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={() => sendVerificationCode(phone)}
    >
      <div style={{ fontFamily: FONT, color: textColor, fontSize: 12, lineHeight: '16px', transition: 'color 120ms ease' }}>获取</div>
    </button>
  );
}

function TextInput({ placeholder, value, onChange, suffix }) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  const borderColor = focused ? '#2DC3E1' : hovered ? 'rgba(255,255,255,0.2)' : '#FFFFFF14';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 36,
        paddingLeft: 12,
        paddingRight: 6,
        borderRadius: 8,
        justifyContent: 'space-between',
        alignSelf: 'stretch',
        flexShrink: 0,
        backgroundColor: '#1D1E1E',
        border: `1px solid ${borderColor}`,
        outline: '1px solid #00000080',
        boxShadow: focused ? '0px 0px 10px #2DC3E150' : 'none',
        mixBlendMode: focused ? 'lighten' : 'normal',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="placeholder:text-[#FFFFFF66]"
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          border: 0,
          outline: 'none',
          fontFamily: FONT,
          color: '#FFFFFF',
          fontSize: 14,
          lineHeight: '18px',
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {suffix}
    </div>
  );
}

function Field({ label, placeholder, value, onChange, suffix, errorText }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, alignSelf: 'stretch', padding: 0 }}>
      <div style={{ alignSelf: 'stretch', fontFamily: FONT, color: '#FFFFFF99', fontSize: 14, lineHeight: '18px' }}>{label}</div>
      <TextInput placeholder={placeholder} value={value} onChange={onChange} suffix={suffix} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0, paddingLeft: 13, paddingRight: 13, alignSelf: 'stretch', borderRadius: 8, opacity: 0 }}>
        <div style={{ width: 'fit-content', fontFamily: FONT, color: '#F75F5F', fontSize: 14, lineHeight: '18px' }}>{errorText}</div>
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 40,
        borderRadius: 8,
        paddingLeft: 16,
        paddingRight: 16,
        gap: 4,
        justifyContent: 'center',
        alignSelf: 'stretch',
        flexShrink: 0,
        backgroundColor: '#2DC3E1',
        backgroundImage: 'linear-gradient(in oklab 107.50999999999999deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)',
        border: '1px solid #FFFFFF33',
        outline: '1px solid #00000080',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, color: '#090909', fontSize: 16, lineHeight: '20px' }}>{children}</div>
    </button>
  );
}

function Agreement({ checked, onToggle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          padding: 2,
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            flexShrink: 0,
            backgroundColor: checked ? '#2DC3E1' : '#090909',
            border: '1px solid #FFFFFF33',
            outline: '1px solid #00000080',
            position: 'relative',
          }}
        >
          {checked && (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
              <path d="M3.333 8L6.667 11.333L13.333 4.667" stroke="#090909" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </button>
      <div style={{ fontFamily: FONT, color: '#FFFFFF99', fontSize: 12, lineHeight: '16px' }}>
        登录即表示您同意并遵守 {' '}《用户协议》{' '}与{' '}《隐私政策》
      </div>
    </div>
  );
}

function PhoneLoginView({ onLogin, onChangeTab }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [agreed, setAgreed] = useState(false);

  const handleLogin = async () => {
    await loginWithPhone(phone, code);
    onLogin();
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 24, width: '100%', paddingLeft: 32, paddingRight: 32, flex: 1, backgroundColor: '#161616' }}>
        <Tabs tab="phone" onChange={onChangeTab} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, alignSelf: 'stretch', padding: 0 }}>
          <Field label="手机号" placeholder="请输入11位数字手机号" value={phone} onChange={(e) => setPhone(e.target.value)} errorText="手机号格式错误" />
          <Field label="验证码" placeholder="请输入短信验证码" value={code} onChange={(e) => setCode(e.target.value)} suffix={<SendCodeButton phone={phone} />} errorText="验证码错误" />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, justifyContent: 'space-between', width: '100%', backgroundColor: '#161616', padding: 32 }}>
        <PrimaryButton onClick={handleLogin}>登录</PrimaryButton>
        <Agreement checked={agreed} onToggle={() => setAgreed((value) => !value)} />
      </div>
    </>
  );
}

function WechatView({ onBackToPhone, onScanSuccess }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, paddingLeft: 32, paddingRight: 32, alignSelf: 'stretch', flex: 1, backgroundColor: '#161616' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, alignSelf: 'stretch', padding: 0 }}>
          <TabButton active={false} onClick={onBackToPhone}>手机号</TabButton>
          <TabButton active onClick={() => {}}>微信扫码</TabButton>
        </div>
        <button
          type="button"
          onClick={onScanSuccess}
          style={{
            display: 'flex',
            alignItems: 'center',
            flexDirection: 'column',
            gap: 12,
            padding: 0,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 200,
              height: 200,
              flexShrink: 0,
              backgroundImage: `url(${QR_CODE_URL})`,
              backgroundSize: 'cover',
              backgroundPosition: '50%',
            }}
          />
          <div style={{ width: 'fit-content', fontFamily: FONT, color: '#FFFFFF99', fontSize: 12, lineHeight: '16px' }}>
            请使用微信扫码
          </div>
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, justifyContent: 'space-between', width: '100%', backgroundColor: '#161616', padding: 32 }}>
        <Agreement checked={agreed} onToggle={() => setAgreed((value) => !value)} />
      </div>
    </>
  );
}

function BindPhoneView({ onBind, onBack }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');

  const handleBind = async () => {
    // TODO: wechatToken 需从微信 OAuth 回调中获取，当前 mock 传空字符串
    await bindPhone('', phone, code);
    onBind();
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16, width: '100%', paddingLeft: 32, paddingRight: 32, flex: 1, backgroundColor: '#161616' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: 8,
            alignSelf: 'stretch',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            backgroundColor: '#52BF921A',
          }}
        >
          <SuccessIcon />
          <div style={{ width: 'fit-content', flexShrink: 0, fontFamily: FONT, color: '#FFFFFF', fontSize: 14, lineHeight: '18px' }}>
            微信扫码成功，请绑定手机号
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, alignSelf: 'stretch', padding: 0 }}>
          <Field label="手机号" placeholder="请输入11位数字手机号" value={phone} onChange={(e) => setPhone(e.target.value)} errorText="手机号格式错误" />
          <Field label="验证码" placeholder="请输入短信验证码" value={code} onChange={(e) => setCode(e.target.value)} suffix={<SendCodeButton phone={phone} />} errorText="验证码错误" />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, justifyContent: 'space-between', width: '100%', backgroundColor: '#161616', padding: 32 }}>
        <PrimaryButton onClick={handleBind}>绑定并登录</PrimaryButton>
        <button
          type="button"
          onClick={onBack}
          style={{
            padding: 0,
            margin: 0,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: FONT,
            color: '#FFFFFF99',
            fontSize: 14,
            lineHeight: '18px',
          }}
        >
          返回扫码
        </button>
      </div>
    </>
  );
}

export default function LoginModal({ open, onClose, onSuccess }) {
  const [tab, setTab] = useState('phone');
  const [step, setStep] = useState('login');

  if (!open) return null;

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setTab('phone');
      setStep('login');
    }, 0);
  };

  const handleLoginSuccess = () => {
    onSuccess?.();
    handleClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          borderRadius: 16,
          overflow: 'clip',
          width: 800,
          height: 470,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ alignSelf: 'stretch', flex: 1, backgroundColor: '#DDDDDD' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, alignSelf: 'stretch', padding: 0, backgroundColor: '#161616' }}>
          <ModalHeader onClose={handleClose} />
          {step === 'bind' ? (
            <BindPhoneView onBind={handleLoginSuccess} onBack={() => setStep('login')} />
          ) : tab === 'phone' ? (
            <PhoneLoginView onLogin={handleLoginSuccess} onChangeTab={setTab} />
          ) : (
            <WechatView onBackToPhone={() => setTab('phone')} onScanSuccess={() => setStep('bind')} />
          )}
        </div>
      </div>
    </div>
  );
}
