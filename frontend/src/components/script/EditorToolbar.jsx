import { useState } from 'react';
import { Button } from '../ui';

const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function ToolbarBtn({ onClick, children, title }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <Button
      variant="secondary"
      size="small"
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      contentClassName={`!text-font-size-12 !font-font-weight-medium !transition-colors ${pressed ? '!text-[#090909]' : '!text-[#FFFFFFCC]'}`}
      className="!h-[26px] !min-w-[26px] !rounded-[5px] !px-[8px] !shadow-none"
      style={{
        minWidth: '26px',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        fontFamily: FONT_MEDIUM,
        background: pressed ? '#2DC3E1' : hovered ? '#FFFFFF14' : 'transparent',
        transition: 'background 0.15s, color 0.15s',
        transform: pressed ? 'scale(0.93)' : 'scale(1)',
        outline: 'none',
      }}
    >
      {children}
    </Button>
  );
}

export default function EditorToolbar({ editor }) {
  if (!editor) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        paddingBottom: '12px',
        borderBottom: '1px solid #FFFFFF14',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 1,
        background: '#161616',
      }}
    >
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="一级标题">
        H1
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="二级标题">
        H2
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setParagraph().run()} title="正文">
        正文
      </ToolbarBtn>

      <div style={{ width: '1px', height: '16px', background: '#FFFFFF14', margin: '0px 2px', flexShrink: 0 }} />

      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} title="加粗">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M3 6h4a2 2 0 0 0 0-4H3v4zm0 0h4.5a2.5 2.5 0 0 1 0 5H3V6z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ToolbarBtn>

      <div style={{ width: '1px', height: '16px', background: '#FFFFFF14', margin: '0px 2px', flexShrink: 0 }} />

      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} title="无序列表">
        <svg width="14" height="12" viewBox="0 0 14 12" fill="none" aria-hidden="true">
          <circle cx="1.5" cy="2" r="1.2" fill="currentColor" />
          <circle cx="1.5" cy="6" r="1.2" fill="currentColor" />
          <circle cx="1.5" cy="10" r="1.2" fill="currentColor" />
          <path d="M5 2h8M5 6h8M5 10h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} title="有序列表">
        <svg width="14" height="12" viewBox="0 0 14 12" fill="none" aria-hidden="true">
          <text x="0" y="3.5" fontSize="4" fill="currentColor" fontFamily="monospace">1.</text>
          <text x="0" y="7.5" fontSize="4" fill="currentColor" fontFamily="monospace">2.</text>
          <text x="0" y="11.5" fontSize="4" fill="currentColor" fontFamily="monospace">3.</text>
          <path d="M5 2h8M5 6h8M5 10h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </ToolbarBtn>
    </div>
  );
}
