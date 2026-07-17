import { useEffect, useRef, useState } from 'react';
import { getEpisodeLabel } from './storyboardControlUtils';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

const EPISODE_ITEM_H = 36;
const EPISODE_MAX_VISIBLE = 10;

function EpisodeSelector({ episodes, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const rootRef = useRef(null);
  const [selectorWidth, setSelectorWidth] = useState(null);

  // 测量所有选集标题的实际像素宽度，取最大值
  useEffect(() => {
    const tempSpan = document.createElement('span');
    tempSpan.style.cssText = `
      position: absolute;
      visibility: hidden;
      pointer-events: none;
      white-space: nowrap;
      font-family: ${FONT_MEDIUM};
      font-size: 14px;
      font-weight: 500;
      line-height: 20px;
      padding: 0 6px;
    `;
    document.body.appendChild(tempSpan);

    let maxWidth = 0;

    if (episodes && episodes.length > 0) {
      episodes.forEach((ep) => {
        tempSpan.textContent = getEpisodeLabel(ep);
        const width = tempSpan.scrollWidth;
        if (width > maxWidth) maxWidth = width;
      });
    } else {
      tempSpan.textContent = getEpisodeLabel(value);
      maxWidth = tempSpan.scrollWidth;
    }

    document.body.removeChild(tempSpan);
    const nextWidth = Math.max(maxWidth + 12, 60);
    const frameId = requestAnimationFrame(() => setSelectorWidth(nextWidth));
    return () => cancelAnimationFrame(frameId);
  }, [episodes, value]);

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const dropdownMaxH = EPISODE_ITEM_H * EPISODE_MAX_VISIBLE + 8;

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      {open ? (
        <div
          className="flex items-center gap-[6px] h-[28px] pl-[10px] pr-[6px] rounded-[6px] cursor-pointer border border-solid bg-input-bg-normal border-input-border-focus [outline:1px_solid_var(--color-stroke-outline)]"
          style={{ boxShadow: '0px 0px 10px var(--color-glow)', width: selectorWidth ? `${selectorWidth + 32}px` : '80px' }}
          onClick={() => setOpen(false)}
        >
          <span className="flex-1 text-input-text-content text-font-size-14 truncate" style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, lineHeight: '20px' }}>
            {getEpisodeLabel(value)}
          </span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <path d="M10.5 5.833L7 9.333L3.5 5.833H10.5Z" fill="#FFFFFF99" stroke="#FFFFFF99" strokeWidth="1.167" strokeLinejoin="round" />
          </svg>
        </div>
      ) : (
        <div
          className="flex items-center rounded-[6px] cursor-pointer"
          style={{ height: '28px', padding: '0 6px', width: selectorWidth ? `${selectorWidth}px` : '60px', backgroundColor: hovered ? '#FFFFFF0F' : 'transparent', transition: 'background-color 0.12s' }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={() => setOpen(true)}
        >
          <span style={{ fontFamily: FONT_MEDIUM, fontSize: '14px', lineHeight: '20px', color: '#FFFFFFD9', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {getEpisodeLabel(value)}
          </span>
        </div>
      )}
      {open && (
        <div
          className="flex flex-col rounded-medium bg-select-bg border border-select-border absolute z-50"
          style={{ top: 'calc(100% + 4px)', left: 0, width: selectorWidth ? `${selectorWidth + 32}px` : '80px', padding: '4px', boxShadow: '0px 4px 16px var(--color-select-shadow)', maxHeight: `${dropdownMaxH}px`, overflowY: episodes.length > EPISODE_MAX_VISIBLE ? 'auto' : 'visible' }}
        >
          {episodes.map((ep, i) => {
            const isStr = typeof ep === 'string';
            const isActive = isStr ? ep === value : (ep.id && value?.id ? ep.id === value.id : ep === value);
            const isHov = hoveredIdx === i;
            return (
              <div
                key={ep.id || ep}
                className="flex items-center px-[12px] rounded-[6px] shrink-0"
                style={{ height: `${EPISODE_ITEM_H}px`, cursor: 'pointer', backgroundColor: isActive ? 'var(--color-select-item-bg-active)' : isHov ? 'var(--color-select-item-bg-hover)' : 'transparent', color: isActive || isHov ? 'var(--color-select-item-text-hover)' : 'var(--color-select-item-text-normal)' }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => { onChange(ep); setOpen(false); setHovered(false); }}
              >
                <span className="text-font-size-14 font-font-weight-regular" style={{ fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', width: '100%' }}>{getEpisodeLabel(ep)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 批量生成弹窗已迁移至 components/storyboard/BatchGenerateModals.jsx ───

function ModalCloseBtn({ onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{
        width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '6px', cursor: 'pointer', flexShrink: 0,
        backgroundColor: hov ? 'rgba(255,255,255,0.08)' : 'transparent',
        transition: 'background-color 0.10s',
      }}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}


export { EpisodeSelector, ModalCloseBtn };
