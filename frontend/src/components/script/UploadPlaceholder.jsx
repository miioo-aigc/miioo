/**
 * @file UploadPlaceholder.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   剧本文件上传入口、格式校验和大小校验
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 ScriptPage 抽离，保持文件选择行为不变
 */
import { useRef, useState } from 'react';
import { Button } from '../ui';

const ALLOWED_EXTS = ['.txt', '.md', '.pdf', '.docx', '.doc'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_CHARS = 100000;

function UploadPlaceholder({ onFileSelect, disabled = false }) {
  const [hovered, setHovered] = useState(false);
  const fileInputRef = useRef(null);

  const defaultBack = { opacity: 0.6, bg: '#FFFFFF14', rotate: '0deg' };
  const defaultFront = { bg: '#262626', rotate: '345deg', tx: 'calc(-50% - 7.015px)', ty: 'calc(-50% + 6.717px)' };
  const defaultIcon = { stroke: '#FFFFFF33', tx: 'calc(-50% - 1.349px)', ty: 'calc(-50% + 1.757px)', rotate: '345deg' };

  const hoverBack = { opacity: 0.6, bg: '#FFFFFF3D', rotate: '5deg' };
  const hoverFront = { bg: '#3D3D3D', rotate: '351deg', tx: 'calc(-50% - 4.422px)', ty: 'calc(-50% + 3.811px)' };
  const hoverIcon = { stroke: '#FFFFFF80', tx: 'calc(-50% - 0.865px)', ty: 'calc(-50% + 1.012px)', rotate: '351deg' };

  const back = hovered ? hoverBack : defaultBack;
  const front = hovered ? hoverFront : defaultFront;
  const icon = hovered ? hoverIcon : defaultIcon;
  const transition = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)';

  const handleChange = async (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    const invalid = selected.filter((file) => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      return !ALLOWED_EXTS.includes(ext);
    });
    if (invalid.length) {
      alert('仅支持 .txt/.docx/.pdf/.md/.doc 格式的文件');
      e.target.value = '';
      return;
    }

    const tooLarge = selected.filter((file) => file.size > MAX_FILE_SIZE);
    if (tooLarge.length) {
      alert(`文件大小不能超过 10MB：${tooLarge.map((f) => f.name).join('、')}`);
      e.target.value = '';
      return;
    }

    for (const file of selected) {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (ext === '.txt' || ext === '.md') {
        const content = await file.text();
        if (content.length > MAX_CHARS) {
          alert(`"${file.name}" 超过 10 万字符限制`);
          e.target.value = '';
          return;
        }
      }
    }

    onFileSelect?.(selected);
    e.target.value = '';
  };

  return (
    <div style={{ position: 'relative', width: '44px', height: '60px', flexShrink: 0 }}>
      <Button
        variant="secondary"
        aria-label="上传剧本文件"
        onMouseEnter={() => !disabled && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => !disabled && fileInputRef.current?.click()}
        disabled={disabled}
        contentClassName="relative !h-full !w-full !rounded-[8px] !p-0"
        className="!h-[60px] !w-[44px] !rounded-[8px] !p-0 !shadow-none"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '0px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: 'transparent',
          border: 'none',
          opacity: disabled ? 0.45 : 1,
          outline: 'none',
          outlineOffset: '0px',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: '44px',
            height: '60px',
            borderRadius: '4px',
            flexShrink: 0,
            boxShadow: '#FFFFFF14 0px 0px 0px 0.5px inset',
            opacity: back.opacity,
            background: back.bg,
            rotate: back.rotate,
            transition,
          }}
        />
        <div
          aria-hidden="true"
          style={{
            width: '44px',
            height: '60px',
            borderRadius: '4px',
            position: 'absolute',
            boxShadow: '#FFFFFF14 0px 0px 0px 0.5px inset',
            transformOrigin: 'top left',
            background: front.bg,
            rotate: front.rotate,
            left: '50%',
            top: '50%',
            translate: `${front.tx} ${front.ty}`,
            transition,
          }}
        />
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            translate: `${icon.tx} ${icon.ty}`,
            rotate: icon.rotate,
            transformOrigin: '0% 0%',
            transition,
          }}
        >
          <path d="M8 3v10M3 8h10" stroke={icon.stroke} strokeWidth="1.5" strokeLinecap="round" style={{ transition }} />
        </svg>
      </Button>
      <input ref={fileInputRef} type="file" multiple accept=".txt,.md,.pdf,.docx,.doc" className="hidden" onChange={handleChange} />
    </div>
  );
}

export default UploadPlaceholder;
