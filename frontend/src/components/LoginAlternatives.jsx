import { useEffect, useRef, useState } from 'react';
import { startOnelinkLogin } from '../api/OnelinkAuth';
import { showGlobalToast } from '../stores/toastStore';

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
                </svg><span>手机号</span></> : <><svg viewBox="0 0 819.2 819.2" version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true">
                  <path d="M269.916 273.463c-14.206 0-28.411 9.47-28.412 23.676s14.206 23.676 28.412 23.676 23.676-9.47 23.676-23.676c0-14.798-9.47-23.676-23.676-23.676zM462.286 410.785c-9.47 0-18.349 10.062-18.349 18.941 0 10.062 9.47 18.941 18.349 18.941 14.206 0 23.676-9.47 23.676-18.941s-9.47-18.941-23.676-18.941zM401.32 320.815c14.206 0 23.676-10.062 23.676-23.676 0-14.206-9.47-23.676-23.676-23.676s-28.411 9.47-28.412 23.676 14.206 23.676 28.412 23.676zM565.278 410.785c-9.47 0-18.349 10.062-18.349 18.941 0 10.062 9.47 18.941 18.349 18.941 14.206 0 23.676-9.47 23.676-18.941s-9.47-18.941-23.676-18.941z" transform="translate(0.01 0)" fill="#28C445" />
                  <path transform="translate(0.01 0)" d="M343.312 474.711C343.312 488.325 345.68 501.347 349.231 514.369C343.312 514.961 336.801 515.553 330.882 515.553C307.206 515.552 288.264 510.817 265.772 505.49L200.663 538.637L219.012 481.222C172.251 448.075 143.84 404.866 143.84 353.37C143.84 262.808 228.482 191.78 330.882 191.779C422.628 191.779 503.719 248.602 519.701 324.959C513.782 324.367 507.863 323.775 501.943 323.775C413.157 324.959 343.312 391.845 343.312 474.711ZM408.422 2.369C182.905 2.369 0.006 185.268 0.006 410.785C0.006 636.302 182.905 819.201 408.422 819.201C633.939 819.201 816.838 636.302 816.838 410.785C816.838 185.268 633.939 2.369 408.422 2.369ZM607.895 581.847L622.101 629.199L571.197 600.787C552.848 605.522 533.907 610.257 514.965 610.258C425.587 610.258 355.15 548.7 355.15 472.343C354.558 396.579 424.995 335.021 513.781 335.021C598.423 335.021 673.004 397.171 673.005 472.935C673.005 515.553 645.185 553.434 607.895 581.847Z" fill="#28C445" />
                </svg><span>微信登录</span></>}
        </button>
        {/* 授权地址由后端生成，当前标签页完成授权并回到独立回调页。 */}
        <button type="button" aria-label={pending ? "正在跳转账号登录" : "onelinkai账号登录"} aria-busy={pending} disabled={pending} onClick={handleOnelink} className={entryClass}><svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="11.503 3.157 97.026 10.047" xmlSpace="preserve" width="97" height="10" aria-hidden="true">
                <g>
                  <path d="M20.65 13.495H15.151C13.43 13.495 12.037 11.912 12.037 9.952V6.201C12.037 4.242 13.43 2.659 15.151 2.659h5.499c1.723 0 3.116 1.583 3.117 3.542v3.751C23.767 11.912 22.374 13.495 20.65 13.495zM15.151 4.743c-0.716 0-1.283 0.645-1.282 1.458v3.751c0 0.812 0.568 1.459 1.282 1.459h5.499c0.716 0 1.283-0.645 1.283-1.459V6.201c0-0.812-0.568-1.459-1.283-1.458H15.151z" fill="#FFFFFF99" />
                  <rect x="62.62" width="1.832" height="10.837" y="2.659" fill="#FFFFFF99" />
                  <path d="M36.596 13.495h-1.833V6.201c0-0.812-0.568-1.459-1.283-1.458H27.432v8.752H25.599V2.659h7.881c1.723 0 3.116 1.583 3.116 3.542V13.495z" fill="#FFFFFF99" />
                  <path d="M77.283 13.495h-1.834V6.201c0-0.812-0.568-1.459-1.282-1.458h-6.048v8.752h-1.834V2.659h7.882c1.723 0 3.116 1.583 3.116 3.542V13.495z" fill="#FFFFFF99" />
                  <path d="M60.788 13.495h-7.148c-1.723 0-3.116-1.583-3.117-3.543V2.659h1.834v7.293c0 0.812 0.568 1.459 1.283 1.459h7.148V13.495z" fill="#FFFFFF99" />
                  <path d="M38.428 2.659h10.262v2.084h-10.262M38.428 9.118h7.698l1.832-2.083h-9.53M48.69 13.495V11.411h-10.262v2.084H48.69z" fill="#FFFFFF99" />
                  <rect x="106.24" width="1.832" height="10.837" y="2.659" fill="#FFFFFF99" />
                  <path d="M94.511 4.743h0.768c0.385 0 0.751 0.209 1.009 0.542L102.061 13.495h2.346L97.718 3.993c-0.587-0.854-1.484-1.334-2.439-1.334H92.678v10.836h3.665l1.832-2.084h-3.664L94.511 4.743 94.511 4.743z" fill="#FFFFFF99" />
                  <polygon points="90.807 2.659 87.839 2.659 80.949 8.807 80.949 2.659 79.115 2.659 79.115 13.495 80.949 13.495 80.949 11.453 84.724 8.078 88.518 13.495 90.845 13.495 86.171 6.785" fill="#FFFFFF99" />
                </g>
                </svg></button>
      </div>
    </div>
  );
}
