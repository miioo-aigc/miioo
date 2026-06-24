import { memo } from "react";
import Checkbox from "./Checkbox";
import SbCardActionBtn from "./SbCardActionBtn";
import { IconDrag, IconAdd, IconCopy, IconDelete } from "./StoryboardIcons";

const NUMBER_BTNS = [
  { key:'drag', icon: <IconDrag />, label: '拖拽移动分镜' },
  { key:'add', icon: <IconAdd />, label: '下方添加空分镜' },
  { key:'copy', icon: <IconCopy />, label: '复制当前分镜' },
  { key:'delete', icon: <IconDelete />, label: '删除分镜' },
];
function NumberCol({ number, isHovered, onAdd, onCopy, onDeleteRequest, onDragHandlePress, isSelectMode = false, isSelected = false, onToggleSelect }) {
  return (
    <div
      onClick={isSelectMode ? onToggleSelect : undefined}
      style={{
        width: '40px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: isSelectMode ? 'flex-start' : isHovered ? 'flex-start' : 'center',
        paddingTop: isSelectMode ? '12px' : (!isSelectMode && isHovered) ? '12px' : 0,
        paddingBottom: (!isSelectMode && isHovered) ? '12px' : 0,
        gap: '6px',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        backgroundColor: isSelectMode ? (isSelected ? 'rgba(45,195,225,0.08)' : 'transparent') : isHovered ? '#111111' : 'transparent',
        borderTopLeftRadius: '12px',
        borderBottomLeftRadius: '12px',
        transition: 'background-color 150ms',
        overflow: 'hidden',
        cursor: isSelectMode ? 'pointer' : 'default',
        position: 'relative',
      }}
    >
      {isSelectMode ? (
        <>
          <Checkbox checked={isSelected} />
          <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '14px', fontWeight: 700, color: '#FFFFFF', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif', lineHeight: 1 }}>
            {String(number).padStart(2, '0')}
          </span>
        </>
      ) : (
        <>
          {!isHovered && (
            <span style={{
              fontSize: '14px',
              fontWeight: 700,
              color: '#FFFFFF',
              fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
            }}>
              {String(number).padStart(2, '0')}
            </span>
          )}
          {isHovered && NUMBER_BTNS.map((btn, i) => (
            <SbCardActionBtn
              key={btn.key}
              btn={btn}
              index={i}
              onAdd={onAdd}
              onCopy={onCopy}
              onDeleteRequest={onDeleteRequest}
              onDragHandlePress={onDragHandlePress}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ─── 参数触发器（景别/运镜/拍摄角度/构图/时长）────────────────────────────────


export default memo(NumberCol);
