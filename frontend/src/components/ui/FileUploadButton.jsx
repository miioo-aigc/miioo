/**
 * @file FileUploadButton.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   FileUploadButton 只提供上传入口按钮的通用视觉，不处理文件、API 或业务状态
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   通过 onClick 将点击行为交给调用方，不依赖业务域、页面或 Store
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-17  统一主体页面与分镜页面的上传入口视觉实现
 */
import { useState } from 'react';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

export default function FileUploadButton({ children, onClick, disabled = false, className = '', style, ...props }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const isDisabled = disabled || !onClick;

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className={className}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '22px', paddingInline: '6px', borderRadius: '6px',
        backgroundColor: pressed ? '#1a1a1a' : hovered ? '#222323' : '#161616',
        border: '1px solid rgba(255,255,255,0.08)', outline: '1px solid #00000080',
        cursor: isDisabled ? 'not-allowed' : 'pointer', fontSize: '12px', lineHeight: '14px',
        color: isDisabled ? 'rgba(255,255,255,0.24)' : hovered ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.40)',
        fontFamily: FONT, whiteSpace: 'nowrap', transition: 'background-color 0.10s, color 0.10s',
        opacity: isDisabled ? 0.65 : 1,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
