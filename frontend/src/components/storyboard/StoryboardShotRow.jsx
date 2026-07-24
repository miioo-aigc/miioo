import { useRef, useState } from 'react';
import ConfirmDialog from '../ConfirmDialog';
import { StoryboardShotRowContext } from './StoryboardShotRowContext';

/**
 * 分镜列表中的单行组合容器。
 *
 * 该组件只负责行级交互和布局边界：拖拽、悬停、插入提示线和删除确认。
 * 编号列、编辑列、媒体列仍由页面通过 children 传入，避免组件反向依赖
 * StoryboardPage 内的 API、状态或页面局部组件。
 */
export default function StoryboardShotRow({
  shot,
  children,
  onDelete,
  isDragging = false,
  onDragStart,
  onDragOver,
  onDrop,
  insertBefore = false,
  insertAfter = false,
  isSelectMode = false,
  isSelected = false,
  isActive = false,
  onSelect,
}) {
  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dragFromHandle = useRef(false);

  function armDragHandle() {
    dragFromHandle.current = true;
    window.addEventListener('mouseup', () => {
      dragFromHandle.current = false;
    }, { once: true });
  }

  return (
    <>
      {insertBefore && (
        <div style={{ height: '2px', borderRadius: '1px', backgroundColor: '#2DC3E1', flexShrink: 0, marginBlock: '-4px', zIndex: 10 }} />
      )}
      <div
        data-storyboard-shot-row="true"
        onClick={onSelect}
        draggable={!isSelectMode}
        onDragStart={(event) => {
          if (isSelectMode || !dragFromHandle.current) {
            event.preventDefault();
            return;
          }
          onDragStart?.();
        }}
        onDragEnd={() => { dragFromHandle.current = false; }}
        onDragOver={(event) => {
          event.preventDefault();
          onDragOver?.();
        }}
        onDrop={(event) => {
          event.preventDefault();
          onDrop?.();
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          minHeight: '140px',
          height: '140px',
          minWidth: '1160px',
          borderRadius: '12px',
          backgroundColor: '#1D1E1E',
          border: `1px solid ${isSelected || isActive ? 'rgba(45,195,225,0.60)' : hovered ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)'}`,
          boxShadow: isActive ? '0 0 0 1px rgba(45,195,225,0.30)' : hovered ? 'rgba(0,0,0,0.50) 0px 0px 30px' : 'none',
          flexShrink: 0,
          transition: 'border-color 150ms, box-shadow 150ms, opacity 150ms',
          overflow: 'hidden',
          opacity: isDragging ? 0.40 : 1,
        }}
      >
        <StoryboardShotRowContext.Provider value={{
          hovered,
          onDragHandlePress: armDragHandle,
          onDeleteRequest: () => setConfirmDelete(true),
        }}>
          {children}
        </StoryboardShotRowContext.Provider>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title="确定要删除吗？"
          description={`此操作不可撤销，镜头 ${String(shot?.number ?? '').padStart(2, '0')} 将被永久删除。`}
          confirmText="删除"
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete?.();
          }}
          onCancel={() => setConfirmDelete(false)}
          zIndex={9998}
        />
      )}
      {insertAfter && (
        <div style={{ height: '2px', borderRadius: '1px', backgroundColor: '#2DC3E1', flexShrink: 0, marginBlock: '-4px', zIndex: 10 }} />
      )}
    </>
  );
}
