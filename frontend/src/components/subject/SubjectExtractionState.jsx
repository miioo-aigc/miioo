/**
 * 主体提取过程的加载态和失败态。
 * 组件只负责展示和重试回调，不持有提取状态、API 或主体列表副作用。
 */
import LoadingAnimation from '../LoadingAnimation';
import { Button } from '../ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export function SubjectExtractionLoading({ message }) {
  return (
    <div role="status" aria-label="正在提取主体" style={{ position: 'absolute', inset: 0, marginBottom: '24px', marginRight: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', backgroundColor: '#161616', borderRadius: '16px', border: '1px solid #FFFFFF14' }}>
      <LoadingAnimation width={200} />
      <span style={{ fontFamily: FONT, fontSize: '12px', color: '#FFFFFF99' }}>{message}</span>
    </div>
  );
}

export function SubjectExtractionError({ loading = false, onRetry }) {
  return (
    <div style={{ position: 'absolute', inset: 0, marginBottom: '24px', marginRight: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', backgroundColor: '#161616', borderRadius: '16px', border: '1px solid #FFFFFF14' }}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <circle cx="16" cy="16" r="15" stroke="#FFFFFF66" strokeWidth="1.5" />
        <circle cx="10" cy="13" r="2" fill="#FFFFFF66" />
        <circle cx="22" cy="13" r="2" fill="#FFFFFF66" />
        <path d="M10 23 Q16 19 22 23" stroke="#FFFFFF66" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF99' }}>糟糕，提取主体失败了，待会儿再试试吧！</span>
      <Button variant="accent" loading={loading} onClick={onRetry}>重新提取主体</Button>
    </div>
  );
}
