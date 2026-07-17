/**
 * @file FileCard.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   已选剧本文件的名称、大小和移除操作展示
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 ScriptPage 抽离，保持文件卡片行为不变
 */
import { useState } from 'react';
import { IconButton } from '../ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function truncateFileName(name) {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex === -1) return name;
  const base = name.slice(0, dotIndex);
  const ext = name.slice(dotIndex);
  const maxBase = 12;
  if (base.length <= maxBase) return name;
  return base.slice(0, maxBase) + '… ' + ext;
}

function FileCard({ file, onRemove, disabled = false }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '2px',
        paddingLeft: '8px',
        paddingRight: '8px',
        paddingTop: '6px',
        paddingBottom: '6px',
        borderRadius: '8px',
        width: '100px',
        height: '100px',
        justifyContent: 'space-between',
        flexShrink: 0,
        position: 'relative',
        background: '#1D1E1E',
        border: `1px solid ${hovered ? '#FFFFFF33' : '#FFFFFF14'}`,
        transition: 'border-color 0.15s',
        opacity: disabled ? 0.45 : 1,
      }}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          fontFamily: FONT,
          fontSize: '14px',
          lineHeight: '150%',
          alignSelf: 'stretch',
          flex: 1,
          overflow: 'hidden',
          color: '#FFFFFF',
        }}
      >
        {truncateFileName(file.name)}
      </div>
      <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '150%', alignSelf: 'stretch', color: '#FFFFFF66' }}>
        {formatFileSize(file.size)}
      </div>
      {hovered && !disabled && (
        <IconButton
          size="small"
          variant="secondary"
          aria-label={`移除文件 ${file.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="!absolute !top-[-5px] !right-[-5px] !h-[16px] !w-[16px] !rounded-full !p-0 !shadow-none"
          contentClassName="!h-full !w-full !rounded-full !p-0"
          style={{
            background: '#505151',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4.667 4.667L11.333 11.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4.667 11.333L11.333 4.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </IconButton>
      )}
    </div>
  );
}

export default FileCard;
