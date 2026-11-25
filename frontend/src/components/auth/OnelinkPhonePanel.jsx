import Button from '../ui/Button';
import TextField from '../ui/TextField';
import brandLogo from '../../assets/miioo-brand-logo.svg';

// 仅共享手机号弹窗的展示；发码、关联、绑定分别由调用方提供。
export default function OnelinkPhonePanel({ phone, code, busy, seconds, error, traceId, linking, onPhone, onCode, onSend, onSubmit, onBack, onHome }) {
  return (
    <section className="relative flex min-h-[529px] w-[400px] max-w-full flex-col rounded-[20px] bg-surface-modal text-text-primary">
      <button type="button" aria-label="关闭并返回首页" onClick={onHome} className="absolute right-[28px] top-[16px] flex size-[24px] items-center justify-center text-text-secondary hover:text-text-primary focus-visible:outline-1 focus-visible:outline-brand-main">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeLinecap="round" /></svg>
      </button>
      <div className="flex h-[121px] shrink-0 items-center justify-center gap-[4px]">
        <h1 className="text-[20px] leading-[25px]">欢迎登录</h1>
        <button type="button" aria-label="返回首页" onClick={onHome} className="rounded-[4px] focus-visible:outline-1 focus-visible:outline-brand-main"><img src={brandLogo} alt="miioo" width="70" height="25" /></button>
      </div>
      <div className="flex flex-1 flex-col gap-[32px] px-[32px]">
        <div className="flex h-[36px] shrink-0 items-center gap-[8px] rounded-[8px] bg-[#52BF921A] px-[12px] text-[14px] leading-[18px]">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#52BF92" /><path d="M4.5 8L7 10.5L11.5 5.5" stroke="white" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>{linking ? '请验证手机号，关联已有账号' : '关联账号成功，请绑定手机号'}</span>
        </div>
        <div className="flex flex-col gap-[24px]">
          <TextField label="手机号" aria-label="手机号" placeholder="请输入11位数字手机号" type="tel" autoComplete="tel" value={phone} disabled={busy} onChange={onPhone} wrapperStyle={{ gap: 4 }} />
          <TextField label="验证码" aria-label="短信验证码" placeholder="请输入短信验证码" inputMode="numeric" autoComplete="one-time-code" value={code} disabled={busy} onChange={onCode} wrapperStyle={{ gap: 4 }} suffix={
            <Button variant="secondary" disabled={busy || !/^1\d{10}$/.test(phone) || seconds > 0} onClick={onSend} style={{ height: 24, paddingLeft: 8, paddingRight: 8, borderRadius: 6 }} contentClassName="text-[12px]">{seconds ? seconds + 's' : '获取'}</Button>
          } />
        </div>
        {error && <p role="alert" className="text-[14px] text-status-wrong break-words">{error}</p>}
        {traceId && <p className="text-[12px] text-text-secondary break-all">问题追踪编号：{traceId}</p>}
      </div>
      <div className="flex shrink-0 flex-col gap-[16px] p-[32px]">
        <Button variant="accent" disabled={busy || !/^1\d{10}$/.test(phone) || !/^\d{4,6}$/.test(code)} onClick={onSubmit} style={{ height: 40 }} contentClassName="text-[16px]">{linking ? '验证并关联' : '绑定并登录'}</Button>
        <button type="button" disabled={busy} onClick={onBack} className="text-center text-[14px] leading-[18px] text-text-secondary hover:text-text-primary disabled:opacity-50">{linking ? '返回账号选择' : '稍后绑定，进入首页'}</button>
      </div>
    </section>
  );
}
