import { useState, useRef, useCallback, useEffect } from 'react';
import ScriptPage from './ScriptPage';
import { apiUpdateProject, apiUploadProjectCover } from '../api/project';
import { normalizeImageUrl } from '../utils/imageUrl';
import styleXianxia from '../assets/styles/xianxia-3d.png';
import styleSuspenseAnime from '../assets/styles/suspense-anime-2d.png';
import styleCyberpunk from '../assets/styles/cyberpunk-3d.png';
import stylePixar from '../assets/styles/pixar-style.png';
import styleWuxia from '../assets/styles/wuxia-cg.png';
import styleGhibli from '../assets/styles/ghibli-style.png';
import styleShinkai from '../assets/styles/shinkai-style.png';
import styleAncientChinese from '../assets/styles/ancient-chinese.png';
import styleUrbanWorkplace from '../assets/styles/urban-workplace.png';
import stylePostApocalyptic from '../assets/styles/post-apocalyptic.png';
import styleLiveActionSuspense from '../assets/styles/live-action-suspense.png';

// ─────────────────────────────────────────────────────────────────────────────

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

// 视觉风格映射
const VISUAL_STYLES = {
  custom: { label: '自定义', coverImg: null },
  'xianxia-3d': { label: '3D东方仙侠', coverImg: styleXianxia },
  'suspense-anime-2d': { label: '2D悬疑动漫', coverImg: styleSuspenseAnime },
  'cyberpunk-3d': { label: '3D赛博朋克', coverImg: styleCyberpunk },
  'pixar-style': { label: '皮克斯风格', coverImg: stylePixar },
  'wuxia-cg': { label: 'CG武侠', coverImg: styleWuxia },
  'ghibli-style': { label: '宫崎骏风格', coverImg: styleGhibli },
  'shinkai-style': { label: '新海诚风格', coverImg: styleShinkai },
  'ancient-chinese-live-action': { label: '真人古风写实', coverImg: styleAncientChinese },
  'urban-workplace': { label: '都市职场', coverImg: styleUrbanWorkplace },
  'post-apocalyptic-modern': { label: '末日废土', coverImg: stylePostApocalyptic },
  'live-action-suspense': { label: '真人悬疑', coverImg: styleLiveActionSuspense },
};

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({ label, count, images = [], onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const isClickable = !!onClick;
  const hasImages = images.length > 0;
  const gridImages = images.slice(0, 6);

  return (
    <div
      onMouseEnter={() => isClickable && setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => isClickable && setPressed(true)}
      onMouseUp={() => isClickable && setPressed(false)}
      onClick={onClick}
      style={{
        height: '200px',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        borderRadius: '8px',
        padding: '16px',
        position: 'relative',
        background: pressed ? '#252525' : hovered ? '#222222' : '#1D1E1E',
        border: `1px solid ${hovered ? '#FFFFFF26' : '#FFFFFF14'}`,
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'background 0.15s, border-color 0.15s',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* header inside card */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'relative', zIndex: 1 }}>
        <span style={{ fontFamily: FONT_MEDIUM, fontSize: '14px', lineHeight: '100%', color: '#FFFFFF' }}>{label}</span>
        <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', color: '#FFFFFF99' }}>{count ?? 0} 个</span>
      </div>
      {/* content area */}
      {hasImages ? (
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
          gap: '4px',
          minHeight: 0,
        }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ borderRadius: '4px', overflow: 'hidden', background: '#FFFFFF08' }}>
              {gridImages[i] && (
                <img src={gridImages[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="24" height="24" rx="4" stroke="#FFFFFF26" strokeWidth="1.5" />
            <circle cx="12" cy="13" r="2.5" stroke="#FFFFFF26" strokeWidth="1.5" />
            <path d="M4 22L10 16L14 20L20 13L28 22" stroke="#FFFFFF26" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF33' }}>暂无素材</span>
        </div>
      )}
      {isClickable && hovered && (
        <div style={{
          position: 'absolute', bottom: '10px', right: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '20px', height: '20px', borderRadius: '9999px',
          background: '#FFFFFF14', zIndex: 1,
        }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 12L12 4M12 4H6M12 4V10" stroke="#FFFFFF99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ── Episode grid ───────────────────────────────────────────────────────────

const EPISODE_STATUS = {
  edited:    { bg: '#003422', border: '#52BF9266', color: '#52BF92', label: '已剪辑定稿' },
  generated: { bg: '#06252C', border: '#2DC3E166', color: '#2DC3E1', label: '已生成视频，待剪辑' },
  pending:   { bg: '#FFFFFF08', border: '#FFFFFF14', color: '#FFFFFF99', label: '未生成视频' },
};

function EpisodeCard({ index, status = 'pending', onClick }) {
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const s = EPISODE_STATUS[status] || EPISODE_STATUS.pending;
  const label = String(index + 1).padStart(2, '0');
  const isClickable = status === 'generated' || status === 'edited';

  const handleMouseEnter = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    setHovered(true);
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
        onClick={isClickable ? onClick : undefined}
        style={{
          width: '100%',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '5px',
          background: s.bg,
          border: `1px solid ${s.border}`,
          cursor: isClickable ? 'pointer' : 'default',
          transition: 'opacity 0.12s',
          opacity: hovered && isClickable ? 0.7 : 1,
        }}
      >
        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '100%', color: s.color }}>{label}</span>
      </div>
      {hovered && (
        <div style={{
          position: 'fixed',
          left: tooltipPos.x,
          top: tooltipPos.y,
          transform: 'translate(-50%, -100%)',
          background: '#2A2A2A',
          border: '1px solid #FFFFFF14',
          borderRadius: '6px',
          padding: '6px 10px',
          pointerEvents: 'none',
          zIndex: 9999,
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF99' }}>
            第{index + 1}集 · {s.label}{isClickable ? ' · 点击跳转' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

function EpisodeGrid({ episodes = [], statuses = {}, onEpisodeClick }) {
  const total = episodes.length;
  const isEmpty = total === 0;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      borderRadius: '8px',
      padding: '16px',
      background: '#1D1E1E',
      border: '1px solid #FFFFFF14',
      height: '200px',
      boxSizing: 'border-box',
    }}>
      {/* header inside card */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontFamily: FONT_MEDIUM, fontSize: '14px', lineHeight: '100%', color: '#FFFFFF' }}>剧集结构</span>
        {!isEmpty && <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', color: '#FFFFFF99' }}>共 {total} 集</span>}
      </div>
      {isEmpty ? (
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="6" width="24" height="20" rx="3" stroke="#FFFFFF26" strokeWidth="1.5" />
            <path d="M4 12H28" stroke="#FFFFFF26" strokeWidth="1.5" />
            <path d="M11 6V12" stroke="#FFFFFF26" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M21 6V12" stroke="#FFFFFF26" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="8" y="16" width="4" height="3" rx="1" fill="#FFFFFF26" />
            <rect x="14" y="16" width="4" height="3" rx="1" fill="#FFFFFF26" />
            <rect x="20" y="16" width="4" height="3" rx="1" fill="#FFFFFF26" />
          </svg>
          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF33' }}>暂无剧集</span>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(32px, 1fr))',
          gap: '6px',
          overflowY: 'auto',
          alignContent: 'flex-start',
          flex: 1,
          paddingRight: '2px',
        }}>
          {episodes.map((_, i) => (
            <EpisodeCard key={i} index={i} status={statuses[i] ?? 'pending'} onClick={() => onEpisodeClick?.(i)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Text input ─────────────────────────────────────────────────────────────

function TextInput({ value, onChange, placeholder, maxLength }) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        height: '36px',
        width: '100%',
        borderRadius: '8px',
        paddingLeft: '12px',
        paddingRight: '6px',
        background: focused ? '#252525' : hovered ? '#222222' : '#1D1E1E',
        border: `1px solid ${focused ? '#FFFFFF33' : '#FFFFFF14'}`,
        outline: focused ? '1px solid #2DC3E180' : '1px solid #00000080',
        boxSizing: 'border-box',
        transition: 'background 0.2s, border-color 0.2s, outline 0.2s',
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="placeholder:text-[#FFFFFF66]"
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontFamily: FONT,
          fontSize: '14px',
          lineHeight: '18px',
          color: '#FFFFFF',
        }}
      />
      {maxLength !== undefined && (
        <span
          style={{
            fontFamily: FONT,
            fontSize: '12px',
            lineHeight: '18px',
            color: 'rgba(255, 255, 255, 0.4)',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  );
}

// ── Textarea ───────────────────────────────────────────────────────────────

function TextArea({ value, onChange, placeholder, maxLength }) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <textarea
        value={value}
        onChange={(e) => {
          let v = e.target.value;
          if (maxLength !== undefined) v = v.slice(0, maxLength);
          onChange(v);
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          height: '72px',
          width: '100%',
          borderRadius: '8px',
          padding: '9px 12px',
          background: focused ? '#252525' : hovered ? '#222222' : '#1D1E1E',
          border: `1px solid ${focused ? '#FFFFFF33' : '#FFFFFF14'}`,
          outline: focused ? '1px solid #2DC3E180' : '1px solid #00000080',
          fontFamily: FONT,
          fontSize: '14px',
          lineHeight: '18px',
          color: value ? '#FFFFFF' : '#FFFFFF66',
          resize: 'none',
          boxSizing: 'border-box',
          transition: 'background 0.2s, border-color 0.2s, outline 0.2s',
        }}
      />
      {maxLength !== undefined && (
        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF33', textAlign: 'right' }}>
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  );
}

// ── Cover upload ───────────────────────────────────────────────────────────

function CoverUpload({ coverUrl, onUpload, isSaving }) {
  const [hovered, setHovered] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { alert('抱歉，平台暂不支持上传20M以上的图片资源！'); e.target.value = ''; return; }
    e.target.value = '';

    setIsUploading(true);
    try {
      const url = await apiUploadProjectCover(file);
      if (url) onUpload(url);
    } catch (err) {
      console.error('[CoverUpload] 上传失败', err);
    } finally {
      setIsUploading(false);
    }
  };

  const busy = isUploading || isSaving;

  return (
    <div
      onClick={() => !busy && fileInputRef.current?.click()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '200px',
        borderRadius: '8px',
        gap: '8px',
        alignSelf: 'stretch',
        flexShrink: 0,
        background: coverUrl ? 'transparent' : '#1D1E1E',
        border: coverUrl ? 'none' : `1.5px dashed ${hovered ? '#FFFFFF33' : '#FFFFFF1A'}`,
        cursor: busy ? 'not-allowed' : 'pointer',
        overflow: 'hidden',
        position: 'relative',
        transition: 'border-color 0.2s',
        opacity: busy ? 0.6 : 1,
      }}
    >
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      {coverUrl ? (
        <>
          <img src={normalizeImageUrl(coverUrl)} alt="项目封面" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {busy && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: '8px',
            }}>
              <div style={{
                width: '24px', height: '24px',
                border: '2px solid #FFFFFF33',
                borderTopColor: '#FFFFFF',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '18px', color: '#FFFFFF99' }}>
                {isUploading ? '上传中...' : '保存中...'}
              </span>
            </div>
          )}
          {hovered && !busy && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: '8px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <rect x="3" y="3" width="18" height="18" rx="3" stroke="#FFFFFF99" strokeWidth="1.5" />
                <circle cx="8.5" cy="8.5" r="1.5" stroke="#FFFFFF99" strokeWidth="1.5" />
                <path d="M3 15l5-5 4 4 3-3 6 6" stroke="#FFFFFF99" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '18px', color: '#FFFFFF99' }}>点击更换封面</span>
            </div>
          )}
        </>
      ) : (
        <>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <rect x="3" y="3" width="18" height="18" rx="3" stroke={hovered ? '#FFFFFF66' : '#FFFFFF33'} strokeWidth="1.5" style={{ transition: 'stroke 0.2s' }} />
            <circle cx="8.5" cy="8.5" r="1.5" stroke={hovered ? '#FFFFFF66' : '#FFFFFF33'} strokeWidth="1.5" style={{ transition: 'stroke 0.2s' }} />
            <path d="M3 15l5-5 4 4 3-3 6 6" stroke={hovered ? '#FFFFFF66' : '#FFFFFF33'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.2s' }} />
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '18px', color: hovered ? '#FFFFFF99' : '#FFFFFF66', transition: 'color 0.2s' }}>点击上传封面图片</span>
            <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF33' }}>支持 JPG、PNG，建议尺寸 16:9</span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Project name heading (editable inline) ─────────────────────────────────

function ProjectNameHeading({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef(null);

  const startEdit = () => {
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const stopEdit = () => setEditing(false);

  return editing ? (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={stopEdit}
      onKeyDown={(e) => { if (e.key === 'Enter') stopEdit(); }}
      style={{
        fontFamily: FONT_MEDIUM,
        fontWeight: 500,
        fontSize: '20px',
        lineHeight: '24px',
        color: '#FFFFFF',
        background: 'transparent',
        border: 'none',
        outline: 'none',
        borderBottom: '1px solid #FFFFFF33',
        padding: '0 2px',
        minWidth: '120px',
      }}
      autoFocus
    />
  ) : (
    <div
      style={{
        fontFamily: FONT_MEDIUM,
        fontWeight: 500,
        fontSize: '20px',
        lineHeight: '24px',
        color: '#FFFFFF',
        cursor: 'text',
        borderBottom: hovered ? '1px solid #FFFFFF33' : '1px solid transparent',
        padding: '0 2px',
        transition: 'border-color 0.15s',
      }}
      onClick={startEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {value || '项目名称'}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function GlobalSettings({
  projectName = '',
  projectId,
  projectDescription = '',
  projectCoverUrl = '',
  projectRatio = '16:9',
  projectStyle = 'xianxia-3d',
  onProjectUpdate,
  onBack,
  showToast,
  activeStep,
  onStepChange,
  onGoToSubject,
  isSubjectUnlocked = false,
  scriptFinalizedSinceExtraction = false,
  onScriptFinalized,
  onEpisodesChange,
  chars = [],
  scenes = [],
  props = [],
  episodes = [],
  scriptPhase,
  onScriptPhaseChange,
  scriptHasStarted,
  onScriptHasStartedChange,
  scriptContent,
  onScriptContentChange,
  scriptDraftContent,
  onScriptDraftContentChange,
  episodeStatuses = {},
  onGoToStoryboard,
}) {
  const [name, setName] = useState(projectName);
  const [description, setDescription] = useState(projectDescription);
  const [coverUrl, setCoverUrl] = useState(projectCoverUrl);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimerRef = useRef(null);
  const onProjectUpdateRef = useRef(onProjectUpdate);
  useEffect(() => { onProjectUpdateRef.current = onProjectUpdate; }, [onProjectUpdate]);

  // 立即保存函数（返回 Promise）
  const saveImmediately = async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const hasChanges =
      name !== projectName ||
      description !== projectDescription ||
      coverUrl !== projectCoverUrl;

    if (hasChanges && projectId && onProjectUpdateRef.current) {
      const updates = {};
      if (name !== projectName) updates.name = name;
      if (description !== projectDescription) updates.description = description;
      if (coverUrl !== projectCoverUrl) updates.cover_url = coverUrl;

      if (Object.keys(updates).length > 0) {
        setIsSaving(true);
        try {
          await onProjectUpdateRef.current(updates);
        } finally {
          setIsSaving(false);
        }
      }
    }
  };

  // 同步 props 变化
  useEffect(() => {
    setName(projectName);
  }, [projectName]);

  useEffect(() => {
    setDescription(projectDescription);
  }, [projectDescription]);

  useEffect(() => {
    setCoverUrl(projectCoverUrl);
  }, [projectCoverUrl]);

  // 自动保存：name, description, coverUrl 变化时 debounce 调用 onProjectUpdate
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    // 只有当值与初始 props 不同时才保存
    const hasChanges =
      name !== projectName ||
      description !== projectDescription ||
      coverUrl !== projectCoverUrl;

    console.log('[GlobalSettings] useEffect triggered', {
      hasChanges,
      projectId,
      hasOnProjectUpdate: !!onProjectUpdate,
      coverUrl,
      projectCoverUrl,
      coverChanged: coverUrl !== projectCoverUrl
    });

    if (hasChanges && projectId && onProjectUpdateRef.current) {
      console.log('[GlobalSettings] Setting save timer');
      saveTimerRef.current = setTimeout(async () => {
        const updates = {};
        if (name !== projectName) updates.name = name;
        if (description !== projectDescription) updates.description = description;
        if (coverUrl !== projectCoverUrl) updates.cover_url = coverUrl;

        console.log('[GlobalSettings] Calling onProjectUpdate with:', updates);

        if (Object.keys(updates).length > 0) {
          setIsSaving(true);
          try {
            await onProjectUpdateRef.current(updates);
          } finally {
            setIsSaving(false);
          }
        }
      }, 800);
    }

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [name, description, coverUrl, projectId, projectName, projectDescription, projectCoverUrl]);

  if (activeStep === 'script') {
    return (
      <div
        style={{
          flex: '1 1 0%',
          overflow: 'hidden',
          padding: '0px 24px 24px 0px',
          height: '100%',
          minHeight: 0,
          boxSizing: 'border-box',
          display: 'flex',
        }}
      >
        <ScriptPage
          projectId={projectId}
          onGoToSubject={onGoToSubject}
          isSubjectUnlocked={isSubjectUnlocked}
          scriptFinalizedSinceExtraction={scriptFinalizedSinceExtraction}
          onScriptFinalized={onScriptFinalized}
          onEpisodesChange={onEpisodesChange}
          phase={scriptPhase}
          onPhaseChange={onScriptPhaseChange}
          hasStarted={scriptHasStarted}
          onHasStartedChange={onScriptHasStartedChange}
          scriptContent={scriptContent}
          onScriptContentChange={onScriptContentChange}
          draftContent={scriptDraftContent}
          onDraftContentChange={onScriptDraftContentChange}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        flex: '1 1 0%',
        overflow: 'auto',
        padding: '0px 24px 24px 0px',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          borderRadius: '16px',
          padding: '16px 24px',
          background: '#161616',
          border: '1px solid #FFFFFF14',
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Header row: project name + search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', alignSelf: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            <svg
              width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
              style={{ flexShrink: 0, rotate: '90deg', transformOrigin: '50% 50%', cursor: 'pointer' }}
              onClick={async () => {
                await saveImmediately();
                onBack?.();
              }}
            >
              <path d="M12 6L8 10L4 6" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <ProjectNameHeading value={name} onChange={setName} />
          </div>
        </div>

        {/* Asset overview */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '16px', alignSelf: 'stretch' }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>资产概况</span>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', alignSelf: 'stretch' }}>
            {[
              { label: '角色', tab: 'char', count: chars.length, items: chars },
              { label: '场景', tab: 'scene', count: scenes.length, items: scenes },
              { label: '道具', tab: 'prop', count: props.length, items: props },
            ].map(({ label, tab, count, items }) => (
              <StatCard
                key={label}
                label={label}
                count={count}
                images={items.map((it) => it.imageUrl || it.image_url || it.primary_image_url).filter(Boolean)}
                onClick={tab ? (isSubjectUnlocked || count > 0 ? () => onGoToSubject?.(tab) : undefined) : undefined}
              />
            ))}
            <EpisodeGrid episodes={episodes} statuses={episodeStatuses} onEpisodeClick={onGoToStoryboard} />
          </div>
        </div>

        {/* Project info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignSelf: 'stretch' }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>项目信息</span>

          {/* 项目名称 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '24.15%' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>项目名称</span>
            <TextInput value={name} onChange={setName} placeholder="输入项目名称" maxLength={30} />
          </div>

          {/* 项目描述 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '24.15%' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>项目描述</span>
            <TextArea value={description} onChange={setDescription} placeholder="简单描述一下这个项目…" maxLength={300} />
          </div>

          {/* 画面比例 — 只读展示 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '24.15%' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>画面比例</span>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center', height: '36px', flexShrink: 0 }}>
              {/* 16:9 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <div style={{
                      borderRadius: '9999px',
                      flexShrink: 0,
                      background: projectRatio === '16:9' ? '#2DC3E133' : '#090909',
                      border: `1px solid ${projectRatio === '16:9' ? '#FFFFFF1A' : 'transparent'}`,
                      outline: '1px solid #00000080',
                      width: '16px',
                      height: '16px'
                    }} />
                    {projectRatio === '16:9' && (
                      <div style={{ borderRadius: '9999px', position: 'absolute', left: '50%', top: '50%', background: '#0A0A0A', width: '6px', height: '6px', translate: '-50% -50%' }} />
                    )}
                  </div>
                  <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: projectRatio === '16:9' ? '#FFFFFF' : '#FFFFFF66' }}>16:9</span>
                  <div style={{ marginLeft: 'auto', width: '28px', height: '18px', borderRadius: '3px', flexShrink: 0, borderWidth: '1.5px', borderStyle: 'solid', borderColor: '#FFFFFF33' }} />
                </div>
              </div>
              {/* 9:16 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  borderRadius: '9999px',
                  flexShrink: 0,
                  background: projectRatio === '9:16' ? '#2DC3E133' : '#090909',
                  border: `1px solid ${projectRatio === '9:16' ? '#FFFFFF1A' : 'transparent'}`,
                  outline: '1px solid #00000080',
                  width: '16px',
                  height: '16px',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {projectRatio === '9:16' && (
                    <div style={{ borderRadius: '9999px', background: '#0A0A0A', width: '6px', height: '6px' }} />
                  )}
                </div>
                <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: projectRatio === '9:16' ? '#FFFFFF' : '#FFFFFF66' }}>9:16</span>
                <div style={{ marginLeft: 'auto', width: '18px', height: '28px', borderRadius: '3px', flexShrink: 0, borderWidth: '1.5px', borderStyle: 'solid', borderColor: '#FFFFFF33' }} />
              </div>
            </div>
          </div>

          {/* 视觉风格 — 只读展示 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '24.15%' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>视觉风格</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
                <div style={{ height: '200px', borderRadius: '6px', overflow: 'hidden', alignSelf: 'stretch', position: 'relative', flexShrink: 0, background: '#2A2A2A' }}>
                  {VISUAL_STYLES[projectStyle]?.coverImg && (
                    <img
                      src={VISUAL_STYLES[projectStyle].coverImg}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  )}
                  <div
                    style={{
                      position: 'absolute', left: 0, right: 0, bottom: -1,
                      paddingTop: '18px', paddingBottom: '12px', paddingLeft: '16px', paddingRight: '16px',
                      display: 'flex', alignItems: 'flex-end', gap: '4px', justifyContent: 'space-between',
                      borderRadius: '0 0 6px 6px',
                      backgroundImage: 'linear-gradient(in oklab 180deg, oklab(0% 0 0 / 0%) 0%, oklab(0% 0 0 / 60%) 100%)',
                    }}
                  >
                    <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '16px', color: '#FFFFFF' }}>
                      {VISUAL_STYLES[projectStyle]?.label || '未设置'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 项目封面 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '24.15%' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>项目封面</span>
            <CoverUpload coverUrl={coverUrl} onUpload={setCoverUrl} isSaving={isSaving} />
          </div>
        </div>
      </div>
    </div>
  );
}
