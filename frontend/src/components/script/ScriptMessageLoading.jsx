/**
 * @file ScriptMessageLoading.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   展示剧本 AI 等待态的品牌动画和循环打字文案
 *
 * ─── 状态与副作用 ───────────────────────────────────────────────────
 *   文案逐字显示后循环重置，卸载时清理计时器
 */
import { useEffect, useState } from 'react';
import LoadingAnimation from '../LoadingAnimation';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const LABEL = '编辑头脑风暴中';

export default function ScriptMessageLoading() {
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setVisibleLength((current) => (current >= LABEL.length ? 0 : current + 1));
    }, 140);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '32px', minHeight: '32px' }}>
      <LoadingAnimation width="88px" style={{ height: '32px' }} />
      <span
        style={{
          color: '#2DC3E1',
          fontFamily: FONT,
          fontSize: '14px',
          lineHeight: '20px',
          whiteSpace: 'nowrap',
        }}
      >
        {LABEL.slice(0, visibleLength)}
      </span>
    </div>
  );
}
