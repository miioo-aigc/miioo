import { useEffect, useRef, useState } from 'react';
import { completeOnelinkLogin, startOnelinkLogin } from '../../api/OnelinkAuth';
import { apiSendCode } from '../../api/auth';
import { apiSendRebindPhoneCode, apiRebindPhone } from '../../api/user';
import Button from '../ui/Button';
import OnelinkPhonePanel from './OnelinkPhonePanel';
import brandLogo from '../../assets/miioo-brand-logo.svg';

// 沿用回调页 400px 容器，顶部 44px、其余 32px 内边距；表单复用基础组件，错误页区块间距 40px，表单间距 16px。
export default function OnelinkCallback({ capture }) {
  const [screen, setScreen] = useState('loading');
  const [error, setError] = useState('');
  const [traceId, setTraceId] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const locked = useRef(false);
  const alive = useRef(false);
  const goHome = () => window.location.replace('/');
  const accept = result => {
    if (result.next === 'home') window.location.replace('/');
    else setScreen(result.next);
  };
  const fail = err => {
    setError(err.message || '操作未完成，请稍后重试');
    setTraceId(typeof err.traceId === 'string' ? err.traceId : '');
  };
  useEffect(() => {
    alive.current = true;
    let active = true;
    completeOnelinkLogin(capture).then(result => {
      if (active) accept(result);
    }).catch(err => {
      if (active) { fail(err); setScreen('error'); }
    });
    return () => { active = false; alive.current = false; };
  }, [capture]);
  useEffect(() => {
    if (!seconds) return;
    const timer = setTimeout(() => setSeconds(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  async function run(action) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true); setError(''); setTraceId('');
    let redirecting = false;
    try { redirecting = (await action())?.redirecting === true; } catch (err) { if (alive.current) fail(err); }
    finally {
      if (!redirecting) { locked.current = false; if (alive.current) setBusy(false); }
    }
  }
  const form = screen === 'link' || screen === 'phone_bind';
  const titles = { loading: '正在完成账号登录', choice: '首次使用 onelinkai 登录', link: '关联已有账号', phone_bind: '登录成功，完善手机号', bound: '账号绑定成功', error: '登录未完成' };
  if (form) return (
    <main className="min-h-screen flex items-center justify-center bg-surface-base p-[24px]">
      <OnelinkPhonePanel phone={phone} code={code} busy={busy} seconds={seconds} error={error} traceId={traceId} linking={screen === 'link'}
        onPhone={e => setPhone(e.target.value.slice(0, 11))} onCode={e => setCode(e.target.value.slice(0, 6))}
        onHome={goHome} onBack={screen === 'link' ? () => { setScreen('choice'); setError(''); } : goHome}
        onSend={() => run(async () => {
          if (screen === 'phone_bind') await apiSendRebindPhoneCode(phone);
          else await apiSendCode(phone);
          if (alive.current) setSeconds(60);
        })}
        onSubmit={() => run(async () => {
          if (screen === 'phone_bind') { await apiRebindPhone(phone, code); goHome(); }
          else accept(await completeOnelinkLogin(capture, { choice: 'link_existing', phone, smsCode: code }));
        })}
      />
    </main>
  );
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-base px-[24px] pt-[24px] pb-[24px]">
      <section className="relative w-[400px] max-w-full self-auto h-auto rounded-[20px] bg-surface-modal px-[32px] pt-[44px] pb-[32px] text-text-primary">
        <button type="button" aria-label="返回首页" onClick={goHome} className="absolute right-[20px] top-[20px] flex size-[24px] items-center justify-center text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-1 focus-visible:outline-brand-main">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
        </button>
        <button type="button" aria-label="返回首页" onClick={goHome} className="mx-auto mb-[24px] block cursor-pointer rounded-[4px] focus-visible:outline-1 focus-visible:outline-brand-main">
          <img src={brandLogo} alt="miioo" width="80" height="25" className="block" />
        </button>
        <h1 className="text-[20px] text-center mb-[24px]">{titles[screen]}</h1>
        <div className={screen === 'error' || screen === 'choice' ? 'flex flex-col gap-[40px]' : 'flex flex-col gap-[16px]'}>
          {screen === 'loading' && <p role="status">正在验证授权信息，请稍候…</p>}
          {screen === 'choice' && <>
            <p className="flex flex-[0_1_auto] h-[24px] items-center justify-center text-center text-[14px] text-text-secondary">已有 miioo 账号请选择关联，以继续使用原有项目。</p>
            <div className="flex items-center gap-[16px]">
              <Button variant="secondary" className="min-w-0 flex-1" disabled={busy} onClick={() => run(async () => accept(await completeOnelinkLogin(capture, { choice: 'create' })))}>创建新账号</Button>
              <Button variant="accent" className="min-w-0 flex-1" disabled={busy} onClick={() => { setScreen('link'); setError(''); }}>关联已有账号</Button>
            </div>
          </>}
          {error && <p role="alert" className="flex flex-[0_1_auto] h-[64px] items-center justify-center text-center text-[14px] text-text-secondary break-words">{error}</p>}
          {traceId && <p className="text-[12px] text-text-secondary break-all">问题追踪编号：{traceId}</p>}
          {screen === 'error' ? (
            <div className="flex items-center gap-[16px]">
              <Button variant="secondary" className="flex-1" disabled={busy} onClick={goHome}>返回首页</Button>
              <Button variant="accent" className="flex-1" disabled={busy} onClick={() => run(() => startOnelinkLogin({ isCurrent: () => alive.current }))}>重新登录</Button>
            </div>
          ) : screen !== 'choice' && <Button variant="secondary" disabled={busy} onClick={goHome}>返回首页</Button>}
        </div>
      </section>
    </main>
  );
}
