import { createPortal } from 'react-dom';
import { useRef, useState } from 'react';
import Checkbox from '../Checkbox';
import { useStoryboardShotRowActions } from './StoryboardShotRowContext';

const NUMBER_BTNS = [
  { key: 'drag', icon: <IconDrag />, label: '拖拽移动分镜' },
  { key: 'add', icon: <IconAdd />, label: '下方添加空分镜' },
  { key: 'copy', icon: <IconCopy />, label: '复制当前分镜' },
  { key: 'delete', icon: <IconDelete />, label: '删除分镜' },
];

function IconDrag() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M6.333 3.333C6.333 4.07 5.736 4.667 5 4.667C4.264 4.667 3.667 4.07 3.667 3.333C3.667 2.597 4.264 2 5 2C5.736 2 6.333 2.597 6.333 3.333ZM5 9.333C5.736 9.333 6.333 8.736 6.333 8C6.333 7.264 5.736 6.667 5 6.667C4.264 6.667 3.667 7.264 3.667 8C3.667 8.736 4.264 9.333 5 9.333ZM5 14C5.736 14 6.333 13.403 6.333 12.667C6.333 11.93 5.736 11.333 5 11.333C4.264 11.333 3.667 11.93 3.667 12.667C3.667 13.403 4.264 14 5 14Z" fill="#FFFFFF"/><path fillRule="evenodd" clipRule="evenodd" d="M12.333 3.333C12.333 4.07 11.736 4.667 11 4.667C10.264 4.667 9.667 4.07 9.667 3.333C9.667 2.597 10.264 2 11 2C11.736 2 12.333 2.597 12.333 3.333ZM11 9.333C11.736 9.333 12.333 8.736 12.333 8C12.333 7.264 11.736 6.667 11 6.667C10.264 6.667 9.667 7.264 9.667 8C9.667 8.736 10.264 9.333 10.264 9.333ZM11 14C11.736 14 12.333 13.403 12.333 12.667C12.333 11.93 11.736 11.333 11 11.333C10.264 11.333 9.667 11.93 9.667 12.667C9.667 13.403 10.264 14 11 14Z" fill="#FFFFFF"/></svg>;
}

function IconAdd() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 10.667V5.333M14 9V7M2 9V7M4.667 2H2.667C2.298 2 2 2.298 2 2.667V4.667M11.333 2H13.333C13.702 2 14 2.298 14 2.667V4.667M11.333 14H13.333C13.702 14 14 13.702 14 13.333V11.333M4.667 14H2.667C2.298 14 2 13.702 2 13.333V11.333M9 2H7M10.667 8H5.333M9 14H7" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function IconCopy() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4.333 4.144V2.604C4.333 2.086 4.753 1.667 5.271 1.667H13.396C13.914 1.667 14.333 2.086 14.333 2.604V10.729C14.333 11.247 13.914 11.667 13.396 11.667H11.839M10.729 4.333H2.604C2.086 4.333 1.667 4.753 1.667 5.271V13.396C1.667 13.914 2.086 14.333 2.604 14.333H10.729C11.247 14.333 11.667 13.914 11.667 13.396V5.271C11.667 4.753 11.247 4.333 10.729 4.333Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function IconDelete() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3.333V14.667H13V3.333H3ZM6.667 6.667V11M9.333 6.667V11M1.333 3.333H14.667M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function CardActionBtn({ btn, index, onAdd, onCopy, onDeleteRequest, onDragHandlePress }) {
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState(null);
  const btnRef = useRef(null);
  function handleMouseEnter() {
    setHovered(true);
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setTooltipPos({ top: rect.top + rect.height / 2, left: rect.right + 6 });
    }
  }
  return (
    <>
      <div ref={btnRef} onMouseDown={btn.key === 'drag' ? onDragHandlePress : undefined}
        onClick={() => { if (btn.key === 'add') onAdd?.(); if (btn.key === 'copy') onCopy?.(); if (btn.key === 'delete') onDeleteRequest?.(); }}
        onMouseEnter={handleMouseEnter} onMouseLeave={() => { setHovered(false); setTooltipPos(null); }}
        style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', cursor: btn.key === 'drag' ? 'grab' : 'pointer', backgroundColor: hovered ? 'rgba(255,255,255,0.08)' : 'transparent', animation: 'slideDownBounce 300ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards', animationDelay: `${index * 50}ms`, opacity: 0, transition: 'background-color 0.10s' }}>
        {btn.icon}
      </div>
      {hovered && tooltipPos && createPortal(<div style={{ position: 'fixed', top: tooltipPos.top, left: tooltipPos.left, transform: 'translateY(-50%)', zIndex: 9999, pointerEvents: 'none', backgroundColor: '#090909', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '5px 8px', fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.80)', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif', whiteSpace: 'nowrap', boxShadow: '0 4px 24px var(--color-shadow)' }}>{btn.label}</div>, document.body)}
    </>
  );
}

export default function ShotNumberColumn({ number, isHovered: isHoveredProp = false, onAdd, onCopy, onDeleteRequest: onDeleteRequestProp, onDragHandlePress: onDragHandlePressProp, isSelectMode = false, isSelected = false, onToggleSelect }) {
  const rowActions = useStoryboardShotRowActions();
  const isHovered = rowActions?.hovered ?? isHoveredProp;
  const onDeleteRequest = rowActions?.onDeleteRequest ?? onDeleteRequestProp;
  const onDragHandlePress = rowActions?.onDragHandlePress ?? onDragHandlePressProp;
  return <div onClick={isSelectMode ? onToggleSelect : undefined} style={{ width: '40px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: isSelectMode ? 'flex-start' : isHovered ? 'flex-start' : 'center', paddingTop: isSelectMode || isHovered ? '12px' : 0, paddingBottom: !isSelectMode && isHovered ? '12px' : 0, gap: '6px', borderRight: '1px solid rgba(255,255,255,0.08)', backgroundColor: isSelectMode ? (isSelected ? 'rgba(45,195,225,0.08)' : 'transparent') : isHovered ? '#111111' : 'transparent', borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px', transition: 'background-color 150ms', overflow: 'hidden', cursor: isSelectMode ? 'pointer' : 'default', position: 'relative' }}>
    {isSelectMode ? <><Checkbox checked={isSelected} /><span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '14px', fontWeight: 700, color: '#FFFFFF', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif', lineHeight: 1 }}>{String(number).padStart(2, '0')}</span></> : <>{!isHovered && <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif' }}>{String(number).padStart(2, '0')}</span>}{isHovered && NUMBER_BTNS.map((btn, index) => <CardActionBtn key={btn.key} btn={btn} index={index} onAdd={onAdd} onCopy={onCopy} onDeleteRequest={onDeleteRequest} onDragHandlePress={onDragHandlePress} />)}</>}
  </div>;
}

export { CardActionBtn };
