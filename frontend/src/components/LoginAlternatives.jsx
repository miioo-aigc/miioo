import { useEffect, useRef, useState } from 'react';
import { startOnelinkLogin } from '../api/OnelinkAuth';
import { showGlobalToast } from '../stores/toastStore';
import Tooltip from './ui/Tooltip';

// 登录专属入口：按设计稿呈现，认证行为由父组件传入。
export default function LoginAlternatives({ onWechat, onPhone, showHeading = true }) {
  const requestRef = useRef(null);
  const [pending, setPending] = useState(false);
  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);
  const handleOnelink = async () => {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setPending(true);
    let redirecting = false;
    try {
      const result = await startOnelinkLogin({ signal: controller.signal, isCurrent: () => requestRef.current === controller });
      redirecting = result?.redirecting === true;
    } catch (error) {
      if (!controller.signal.aborted) showGlobalToast('error', error.message || '账号登录暂时不可用，请稍后重试');
    } finally {
      if (!redirecting && requestRef.current === controller) {
        requestRef.current = null;
        setPending(false);
      }
    }
  };
  const entryClass = 'flex min-w-0 flex-1 items-center justify-center gap-[8px] h-[32px] rounded-full border border-stroke-normal bg-[#171717] text-text-secondary text-[12px] leading-[16px] cursor-pointer hover:border-stroke-accent hover:text-text-primary focus-visible:outline-1 focus-visible:outline-brand-main';
  return (
    <div className="flex w-full shrink-0 flex-col items-center gap-[16px] px-[32px] pb-[32px] bg-surface-modal" style={{ paddingTop: showHeading ? 24 : 8 }}>
      {showHeading && <div className="flex w-full items-center gap-[16px]">
        <span className="h-[0.5px] flex-1 bg-stroke-normal" />
        <span className="text-[12px] leading-[16px] text-text-hint">其他登录</span>
        <span className="h-[0.5px] flex-1 bg-stroke-normal" />
      </div>}
      <div className="flex w-full items-center gap-[16px]">
        <button type="button" onClick={onPhone || onWechat} className={entryClass}>
          {onPhone ? <><svg aria-hidden="true" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16" style={{ flexShrink: 0 }}>
                  <path d="M820.413 861.229q0 25.197-10.079 46.866t-27.717 38.299-41.323 26.205-50.898 9.575l-357.795 0q-27.213 0-50.898-9.575t-41.323-26.205-27.717-38.299-10.079-46.866l0-675.276q0-25.197 10.079-47.37t27.717-38.803 41.323-26.205 50.898-9.575l357.795 0q27.213 0 50.898 9.575t41.323 26.205 27.717 38.803 10.079 47.37l0 675.276zM738.776 234.332l-455.559 0 0 577.512 455.559 0 0-577.512zM510.996 840.064q-21.165 0-36.787 15.118t-15.622 37.291q0 21.165 15.622 36.787t36.787 15.622q22.173 0 37.291-15.622t15.118-36.787q0-22.173-15.118-37.291t-37.291-15.118zM591.626 148.662q0-8.063-5.039-12.598t-11.087-4.535l-128 0q-5.039 0-10.583 4.535t-5.543 12.598 5.039 12.598 11.087 4.535l128 0q6.047 0 11.087-4.535t5.039-12.598z" fill="var(--color-text-secondary)" />
                </svg><span>手机号</span></> : <><svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="shrink-0" aria-hidden="true"><path d="M693.12 347.264c11.776 0 23.36 0.896 35.008 2.176-31.36-146.048-187.456-254.528-365.696-254.528C163.2 94.912 0 230.656 0 403.136c0 99.52 54.272 181.248 145.024 244.736L108.8 756.864l126.72-63.488c45.312 8.896 81.664 18.112 126.912 18.112 11.392 0 22.656-0.512 33.792-1.344-7.04-24.256-11.2-49.6-11.2-76.032C385.088 475.776 521.024 347.264 693.12 347.264zM498.304 249.024c27.392 0 45.376 17.984 45.376 45.248 0 27.136-17.984 45.312-45.376 45.312-27.072 0-54.336-18.176-54.336-45.312C443.968 266.944 471.168 249.024 498.304 249.024zM244.672 339.584c-27.2 0-54.592-18.176-54.592-45.312 0-27.264 27.392-45.248 54.592-45.248S289.92 266.944 289.92 294.272C289.92 321.408 271.872 339.584 244.672 339.584zM1024 629.76c0-144.896-145.024-262.976-307.904-262.976-172.48 0-308.224 118.144-308.224 262.976 0 145.28 135.808 262.976 308.224 262.976 36.096 0 72.512-9.024 108.736-18.112l99.392 54.528-27.264-90.624C969.728 783.872 1024 711.488 1024 629.76zM616.128 584.384c-17.984 0-36.224-17.92-36.224-36.224 0-18.048 18.24-36.224 36.224-36.224 27.52 0 45.376 18.176 45.376 36.224C661.504 566.464 643.648 584.384 616.128 584.384zM815.488 584.384c-17.856 0-36.032-17.92-36.032-36.224 0-18.048 18.112-36.224 36.032-36.224 27.264 0 45.376 18.176 45.376 36.224C860.864 566.464 842.752 584.384 815.488 584.384z" fill="currentColor" /></svg><span>微信登录</span></>}
        </button>
        {/* 授权地址由后端生成，当前标签页完成授权并回到独立回调页。 */}
        <Tooltip label="使用OneLinkAI账号登录" className="flex-1 min-w-0">
        <button type="button" aria-label={pending ? "正在跳转账号登录" : "onelinkai账号登录"} aria-busy={pending} disabled={pending} onClick={handleOnelink} className={entryClass + " group/onelink"}><svg className="text-text-secondary group-hover/onelink:text-white/90" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="11.503 3.157 97.026 10.047" xmlSpace="preserve" width="97" height="10" aria-hidden="true">
                <g>
                  <path d="M20.65 13.495H15.151C13.43 13.495 12.037 11.912 12.037 9.952V6.201C12.037 4.242 13.43 2.659 15.151 2.659h5.499c1.723 0 3.116 1.583 3.117 3.542v3.751C23.767 11.912 22.374 13.495 20.65 13.495zM15.151 4.743c-0.716 0-1.283 0.645-1.282 1.458v3.751c0 0.812 0.568 1.459 1.282 1.459h5.499c0.716 0 1.283-0.645 1.283-1.459V6.201c0-0.812-0.568-1.459-1.283-1.458H15.151z" fill="currentColor" />
                  <rect x="62.62" width="1.832" height="10.837" y="2.659" fill="currentColor" />
                  <path d="M36.596 13.495h-1.833V6.201c0-0.812-0.568-1.459-1.283-1.458H27.432v8.752H25.599V2.659h7.881c1.723 0 3.116 1.583 3.116 3.542V13.495z" fill="currentColor" />
                  <path d="M77.283 13.495h-1.834V6.201c0-0.812-0.568-1.459-1.282-1.458h-6.048v8.752h-1.834V2.659h7.882c1.723 0 3.116 1.583 3.116 3.542V13.495z" fill="currentColor" />
                  <path d="M60.788 13.495h-7.148c-1.723 0-3.116-1.583-3.117-3.543V2.659h1.834v7.293c0 0.812 0.568 1.459 1.283 1.459h7.148V13.495z" fill="currentColor" />
                  <path d="M38.428 2.659h10.262v2.084h-10.262M38.428 9.118h7.698l1.832-2.083h-9.53M48.69 13.495V11.411h-10.262v2.084H48.69z" fill="currentColor" />
                  <rect x="106.24" width="1.832" height="10.837" y="2.659" fill="currentColor" />
                  <path d="M94.511 4.743h0.768c0.385 0 0.751 0.209 1.009 0.542L102.061 13.495h2.346L97.718 3.993c-0.587-0.854-1.484-1.334-2.439-1.334H92.678v10.836h3.665l1.832-2.084h-3.664L94.511 4.743 94.511 4.743z" fill="currentColor" />
                  <polygon points="90.807 2.659 87.839 2.659 80.949 8.807 80.949 2.659 79.115 2.659 79.115 13.495 80.949 13.495 80.949 11.453 84.724 8.078 88.518 13.495 90.845 13.495 86.171 6.785" fill="currentColor" />
                </g>
                </svg></button>
        </Tooltip>
      </div>
    </div>
  );
}
