/**
 * @file GenerationSubmitButton.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   生成面板底部提交按钮的统一视觉、加载态和图标展示
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收 loading、文案、图标类型和点击回调，不调用生成 API 或读取页面状态
 */
import { useState } from 'react';
import DotsLoading from '../DotsLoading';

const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function MediaIcon({ type }) {
  if (type === 'video') return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }} aria-hidden="true"><path d="M12.333 2.333H3.667V13.667H12.333V2.333Z" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" /><path d="M3.667 3.667H1.333V12.333H3.667V3.667Z" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" /><path d="M14.667 3.667H12.333V12.333H14.667V3.667Z" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" /><path d="M7.333 6.667L9.333 8L7.333 9.333V6.667Z" fill="#090909" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }} aria-hidden="true"><path d="M3 5V3.188C3 2.891 3.029 2.783 3.083 2.674C3.138 2.566 3.218 2.481 3.32 2.422C3.422 2.364 3.523 2.333 3.801 2.333H12.199C12.477 2.333 12.578 2.364 12.68 2.422C12.782 2.481 12.862 2.566 12.916 2.674C12.971 2.783 13 2.891 13 3.188V5" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" /><path d="M1.667 5H14.333V13.667H1.667V5Z" stroke="#090909" strokeLinejoin="round" /><path fillRule="evenodd" clipRule="evenodd" d="M4.333 8.667C4.886 8.667 5.333 8.219 5.333 7.667C5.333 7.114 4.886 6.667 4.333 6.667C3.781 6.667 3.333 7.114 3.333 7.667C3.333 8.219 3.781 8.667 4.333 8.667Z" fill="#090909" /><path d="M1.856 13.463L5 10L6.667 11.333L8.667 9L14.131 13.463" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function GenerationSubmitButton({ loading = false, disabled = false, label, loadingLabel = '生成中…', type = 'image', onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const isDisabled = disabled || loading;
  const backgroundColor = loading ? 'rgba(45,195,225,0.60)' : pressed ? '#28b0cc' : hovered ? '#32cde8' : '#2DC3E1';
  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      onMouseEnter={() => !isDisabled && setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => !isDisabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{ display: 'inline-flex', alignItems: 'center', height: '36px', borderRadius: '8px', paddingInline: '16px', gap: '4px', backgroundColor, backgroundImage: 'linear-gradient(in oklab 107.5deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)', backgroundOrigin: 'border-box', border: '1px solid #FFFFFF33', outline: '1px solid #00000080', cursor: isDisabled ? 'not-allowed' : 'pointer', transition: 'background-color 0.10s', flexShrink: 0 }}
    >
      {loading ? <DotsLoading size={3} color="#090909" gap={2} /> : <MediaIcon type={type} />}
      <span style={{ fontSize: '14px', lineHeight: '18px', color: '#090909', fontFamily: FONT_MEDIUM, fontWeight: 500, whiteSpace: 'nowrap' }}>{loading ? loadingLabel : label}</span>
    </button>
  );
}
