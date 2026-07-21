/**
 * @file ScriptUploadCard.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   剧本模式和分镜脚本入口卡片的导出视觉、动态阴影、文件选择与模板动作
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-21  新增三种剧本创作入口的上传卡片
 *   2026-07-21  接入用户提供的 @2x 卡片导出图，保留代码交互层
 */
import { useRef, useState } from 'react';
import { IconButton } from '../ui';

const SCRIPT_EXTENSIONS = ['.txt', '.md', '.pdf', '.docx', '.doc'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_CHARS = 100000;

function extensionOf(file) {
  return `.${file.name.split('.').pop().toLowerCase()}`;
}

function validateStoryboardFile(file) {
  if (extensionOf(file) !== '.xlsx') throw new Error('仅支持 .xlsx 格式的分镜脚本文件');
}

async function validateScriptFile(file) {
  const extension = extensionOf(file);
  if (!SCRIPT_EXTENSIONS.includes(extension)) throw new Error('仅支持 .txt/.docx/.pdf/.md/.doc 格式的文件');
  if (file.size > MAX_FILE_SIZE) throw new Error('文件大小不能超过 10MB');
  if (['.txt', '.md'].includes(extension) && (await file.text()).length > MAX_CHARS) {
    throw new Error('剧本文件不能超过 10 万字符');
  }
}

function ScriptUploadCard({ title, accept, file, onFileSelect, onRemove, extraAction, layer = 1, variant = 'script' }) {
  const inputRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const storyboard = variant === 'storyboard';
  const cardImage = storyboard ? '/script/storyboard-upload-card.avif' : '/script/script-upload-card.avif';

  const handleChange = async (event) => {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    try {
      if (storyboard) validateStoryboardFile(selected);
      else await validateScriptFile(selected);
      onFileSelect?.(selected);
    } catch (error) {
      window.alert(error.message);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${title}，点击选择文件`}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        top: storyboard ? '-24px' : '0',
        zIndex: hovered ? 10 : layer,
        boxSizing: 'border-box',
        width: '200px',
        height: '240px',
        flex: '0 0 200px',
        padding: 0,
        overflow: 'visible',
        borderRadius: '16px',
        cursor: 'pointer',
        background: `url("${cardImage}") center / 100% 100% no-repeat`,
        transform: `${storyboard ? 'rotate(7.41deg)' : 'rotate(-6.65deg)'} scale(${hovered ? 1.05 : 1})`,
        transformOrigin: 'top left',
        boxShadow: hovered
          ? `0 26px 58px rgba(0, 0, 0, .6), ${storyboard ? '50px 50px 100px 30px #1351AB99' : '-50px -50px 100px 30px #6B035E99'}`
          : `0 16px 38px rgba(0, 0, 0, .3), ${storyboard ? '50px 50px 100px 30px #1351AB4D' : '-50px -50px 100px 30px #6B035E4D'}`,
        transition: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 300ms ease',
        outline: 'none',
      }}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: '16px' }}>
        <div style={{ position: 'absolute', inset: 0 }} aria-hidden="true" />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {file && <div style={{ position: 'absolute', top: '158px', left: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 7px', borderRadius: '6px', background: '#FFFFFF14' }}>
            <span title={file.name} style={{ minWidth: 0, flex: 1, overflow: 'hidden', color: '#FFFFFFCC', fontSize: '10px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
            <IconButton size="small" variant="secondary" aria-label={`移除文件 ${file.name}`} onClick={(event) => { event.stopPropagation(); onRemove?.(); }} className="!h-[20px] !w-[20px] !rounded-full !p-0 !shadow-none" contentClassName="!h-full !w-full !rounded-full !p-0">×</IconButton>
          </div>}
          {extraAction && <button type="button" onClick={(event) => { event.stopPropagation(); extraAction.onClick?.(event); }} style={{ position: 'absolute', top: '142px', border: 0, padding: 0, background: 'transparent', color: 'var(--color-brand-main)', cursor: 'pointer', fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif", fontSize: '12px', lineHeight: '20px', transform: 'translateX(14px)', textDecoration: 'none', zIndex: 2 }}>{extraAction.label}</button>}
        </div>
      </div>
    </div>
  );
}

export default ScriptUploadCard;
