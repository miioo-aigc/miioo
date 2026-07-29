import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditableText as StoryboardEditableText } from './TextEditCol';

// ─── 参数下拉选择器 ───────────────────────────────────────────────────────────

const PARAM_OPTIONS = {
  framing: ['全景', '中景', '近景', '特写'],
  cameraMotion: ['固定机位', '跟拍镜头', '环绕镜头', '缓推镜头', '缓拉镜头', '左摇镜头', '右摇镜头', '左移镜头', '右移镜头', '上升镜头', '下降镜头'],
  angle: ['平视拍摄', '仰视拍摄', '俯视拍摄', '左侧45度拍摄', '右侧45度拍摄', '正面视角拍摄', '背面视角拍摄', '侧面视角拍摄', '过肩镜头拍摄', '主观镜头拍摄'],
  composition: ['三分法构图', '中心构图', '前景构图', '对角线构图', '对称构图', '框架构图', '三角形构图', '留白构图', '引导线构图'],
  duration: Array.from({ length: 13 }, (_, i) => `${i + 3}s`),
};

const PARAM_LABELS = {
  framing: '景别',
  cameraMotion: '运镜',
  angle: '拍摄角度',
  composition: '构图',
  duration: '时长',
};

function ParamSelect({ field, value, onChange, onClose, triggerRef }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, visibility: 'hidden' });

  // 依赖触发器变化重新测量弹层位置；ref.current 的高度在首次渲染后可读取。
  useEffect(() => {
    if (!triggerRef?.current || !ref.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuH = ref.current.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= menuH + 4 ? rect.bottom + 4 : rect.top - menuH - 4;
    setPos((prev) => {
      if (prev.top === top && prev.left === rect.left && prev.visibility === 'visible') return prev;
      return { top, left: rect.left, visibility: 'visible' };
    });
  }, [triggerRef]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target) && triggerRef?.current && !triggerRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, triggerRef]);

  return createPortal(
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        visibility: pos.visibility,
        zIndex: 9999,
        backgroundColor: '#1D1E1E',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        padding: '4px',
        boxShadow: '0px 4px 16px rgba(0,0,0,0.40)',
        minWidth: '100px',
      }}
    >
      {(PARAM_OPTIONS[field] || []).map((opt) => (
        <div
          key={opt}
          onMouseDown={(e) => { e.preventDefault(); onChange(opt); onClose(); }}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            lineHeight: '18px',
            color: opt === value ? '#FFFFFF' : 'rgba(255,255,255,0.60)',
            backgroundColor: opt === value ? '#161616' : 'transparent',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
          }}
          onMouseEnter={(e) => { if (opt !== value) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { if (opt !== value) e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {opt}
        </div>
      ))}
    </div>,
    document.body
  );
}


// ─── 参数触发器（景别/运镜/拍摄角度/构图/时长）────────────────────────────────

function ParamTrigger({ field, label, value, isActive, triggerRef, onToggle, onClose, onUpdate }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <div
      ref={(element) => { triggerRef.current = element; }}
      onClick={onToggle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        height: '22px',
        paddingInline: '6px',
        borderRadius: '6px',
        cursor: 'pointer',
        backgroundColor: pressed
          ? 'rgba(255,255,255,0.10)'
          : isActive
          ? 'rgba(255,255,255,0.08)'
          : hov
          ? 'rgba(255,255,255,0.06)'
          : 'transparent',
        border: `1px solid ${isActive ? 'rgba(255,255,255,0.18)' : hov ? 'rgba(255,255,255,0.10)' : 'transparent'}`,
        transition: 'background-color 0.12s, border-color 0.12s',
        userSelect: 'none',
      }}
    >
      <span style={{
        fontSize: '12px',
        color: hov || isActive ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.35)',
        fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
        transition: 'color 0.12s',
        whiteSpace: 'nowrap',
      }}>
        {label}：
      </span>
      <span style={{
        fontSize: '12px',
        color: hov || isActive ? '#FFFFFF' : 'rgba(255,255,255,0.80)',
        fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
        transition: 'color 0.12s',
        whiteSpace: 'nowrap',
      }}>
        {value || '—'}
      </span>
      {isActive && (
        <ParamSelect
          field={field}
          value={value}
          onChange={onUpdate}
          onClose={onClose}
          triggerRef={triggerRef}
        />
      )}
    </div>
  );
}

// ─── 画面描述列 ───────────────────────────────────────────────────────────────

function DescriptionCol({ shot, onChange }) {
  const [activeParam, setActiveParam] = useState(null);
  const triggerRefs = useMemo(
    () => Object.fromEntries(Object.keys(PARAM_LABELS).map((field) => [field, { current: null }])),
    []
  );

  function updateParam(field, val) {
    onChange({ ...shot, params: { ...shot.params, [field]: val } });
  }

  return (
    <div style={{
      flex: 1,
      minWidth: '300px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px',
      paddingBottom: '8px',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
      alignSelf: 'stretch',
    }}>
      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif', flex: '0 1 auto', height: '20px', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
        画面描述
      </span>
      <StoryboardEditableText
        value={shot.description}
        onChange={(v) => onChange({ ...shot, description: v })}
        placeholder="描述画面内容…"
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', flexShrink: 0, marginTop: 'auto' }}>
        {Object.entries(PARAM_LABELS).map(([field, label]) => (
          <ParamTrigger
            key={field}
            field={field}
            label={label}
            value={shot.params[field]}
            isActive={activeParam === field}
            triggerRef={triggerRefs[field]}
            onToggle={() => setActiveParam(activeParam === field ? null : field)}
            onClose={() => setActiveParam(null)}
            onUpdate={(v) => updateParam(field, v)}
          />
        ))}
      </div>
    </div>
  );
}


export default DescriptionCol;
