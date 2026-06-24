import { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react';

/**
 * 主导航 · 液态切换 indicator
 * - items: [{ key, label?, icon }]
 * - activeKey: 当前激活项（可为 null 表示无选中）
 * - onChange: 点击切换回调
 * - variant: 'expanded' (默认，带文字) | 'compact' (只图标，32x32) | 'vertical'
 *
 * 交互：
 * 1) activeKey 变化时 indicator 流动 / 出现 / 消失
 * 2) 点击瞬间：源按钮液态挤压，目标按钮液态放大过冲
 * 3) activeKey = null 时不渲染 indicator（toggle 行为由外层控制）
 */
function Tooltip({ label }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 'calc(100% + 2px)',
        top: '50%',
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        padding: '4px 8px',
        borderRadius: '4px',
        backgroundColor: '#161616',
        border: '1px solid #FFFFFF0D',
        whiteSpace: 'nowrap',
        fontFamily: "'AlibabaPuHuiTi_2_55_Regular', 'Alibaba PuHuiTi 2.0', system-ui, sans-serif",
        fontSize: '12px',
        fontWeight: 400,
        lineHeight: '16px',
        color: '#FFFFFFE6',
      }}
    >
      {label}
    </div>
  );
}

export default function PrimaryNav({ items, activeKey = null, onChange, variant = 'expanded' }) {
  const containerRef = useRef(null);
  const itemRefs = useRef(new Map());
  const innerRef = useRef(null);
  const indicatorRef = useRef(null);
  const prevKeyRef = useRef(activeKey);

  const [hoveredKey, setHoveredKey] = useState(null);
  const [popupAnchorLeft, setPopupAnchorLeft] = useState(null);

  const isCompact = variant === 'compact';
  const isVertical = variant === 'vertical';

  const measure = useCallback(() => {
    const target = activeKey != null ? itemRefs.current.get(activeKey) : null;

    if (isCompact) {
      const activeItem = items.find((item) => item.key === activeKey);
      setPopupAnchorLeft(target && activeItem?.popup ? target.getBoundingClientRect().right + 8 : null);
    }

    const container = containerRef.current;
    const indicator = indicatorRef.current;
    if (!container || !indicator || !target) return;
    const c = container.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    indicator.style.top = `${t.top - c.top}px`;
    indicator.style.left = `${t.left - c.left}px`;
    indicator.style.width = `${t.width}px`;
    indicator.style.height = `${t.height}px`;
    indicator.style.opacity = '1';
  }, [activeKey, isCompact, items]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure]);

  useLayoutEffect(() => {
    if (activeKey == null) return;
    const el = innerRef.current;
    if (!el) return;
    el.classList.remove('primary-nav-squish');
    void el.offsetWidth;
    el.classList.add('primary-nav-squish');
  }, [activeKey]);

  useEffect(() => {
    const prevKey = prevKeyRef.current;
    if (prevKey === activeKey) return;
    const fromEl = prevKey != null ? itemRefs.current.get(prevKey) : null;
    const toEl = activeKey != null ? itemRefs.current.get(activeKey) : null;
    const clear = (el) => el && el.classList.remove('primary-nav-item-shrink', 'primary-nav-item-pop');
    clear(fromEl);
    clear(toEl);
    if (fromEl) {
      void fromEl.offsetWidth;
      fromEl.classList.add('primary-nav-item-shrink');
    }
    if (toEl) {
      void toEl.offsetWidth;
      toEl.classList.add('primary-nav-item-pop');
    }
    prevKeyRef.current = activeKey;
  }, [activeKey]);

  useEffect(() => {
    if (!isCompact) return;
    const hasOpenPopup = items.some((item) => item.popup && item.key === activeKey);
    if (!hasOpenPopup) return;

    const handleOutsideClick = (e) => {
      const container = containerRef.current;
      if (container && !container.contains(e.target)) {
        const activeItem = items.find((item) => item.key === activeKey);
        onChange?.(activeItem?.key);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [activeKey, isCompact, items, onChange]);

  const registerItem = (key) => (el) => {
    if (el) itemRefs.current.set(key, el);
    else itemRefs.current.delete(key);
  };

  const hasOpenPopup = isCompact && items.some((item) => item.popup && item.key === activeKey);
  const containerCls = isCompact
    ? 'primary-nav flex flex-col items-center gap-8 self-stretch'
    : isVertical
    ? 'primary-nav flex flex-col items-center justify-center gap-16 flex-1'
    : 'primary-nav flex flex-col items-start gap-12';
  const itemCls = isCompact
    ? 'primary-nav-item flex items-center justify-center rounded-full size-[32px]'
    : isVertical
    ? 'primary-nav-item flex flex-col items-center justify-center gap-[2px] rounded-[16px] size-[48px]'
    : 'primary-nav-item flex items-center gap-8 px-20 py-12 rounded-full';

  return (
    <div ref={containerRef} className={containerCls} style={isVertical ? { '--primary-nav-indicator-radius': '16px' } : undefined}>
      {activeKey != null && (
        <div ref={indicatorRef} className="primary-nav-indicator" style={{ opacity: 0 }}>
          <div ref={innerRef} className="primary-nav-indicator-inner fluid-glass" />
        </div>
      )}

      {items.map((item) => {
        const isActive = item.key === activeKey;
        const isHovered = hoveredKey === item.key;
        const showTooltip = isCompact && item.tooltip && isHovered && !isActive && !hasOpenPopup;
        const showPopup = isCompact && item.popup && isActive;
        const popupContent = typeof item.popup === 'function'
          ? item.popup({ close: () => onChange?.(item.key), anchorLeft: popupAnchorLeft })
          : item.popup;
        return (
          <div key={item.key} style={{ position: 'relative' }}>
            <button
              ref={registerItem(item.key)}
              type="button"
              className={itemCls}
              style={{
                ...(isVertical ? { borderRadius: '16px', flexDirection: 'column' } : undefined),
                position: 'relative',
              }}
              onClick={() => onChange?.(item.key)}
              onMouseEnter={() => setHoveredKey(item.key)}
              onMouseLeave={() => setHoveredKey(null)}
              aria-label={item.label}
            >
              {item.icon}
              {!isCompact && item.label && (
                <span
                  className={`w-fit shrink-0 ${isVertical ? 'text-xs/4' : 'text-base/5'} ${
                    isActive
                      ? "font-['AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] font-medium"
                      : "font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif]"
                  }`}
                  style={isVertical ? { fontSize: '14px', lineHeight: '16px' } : undefined}
                >
                  {item.label}
                </span>
              )}
            </button>
            {showTooltip && <Tooltip label={item.tooltip} />}
            {showPopup && popupContent}
            {isCompact && item.bubble && !showPopup && item.bubble}
          </div>
        );
      })}
    </div>
  );
}
