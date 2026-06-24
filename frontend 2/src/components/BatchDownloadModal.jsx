import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

const CONFIRM_GRADIENT =
  'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)';

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M12 4L4 12M4 4l8 8" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M7 12.667C10.13 12.667 12.667 10.13 12.667 7C12.667 3.87 10.13 1.333 7 1.333C3.87 1.333 1.333 3.87 1.333 7C1.333 10.13 3.87 12.667 7 12.667Z" stroke="rgba(255,255,255,0.60)" strokeLinejoin="round" />
      <path d="M11.074 11.074L13.902 13.902" stroke="rgba(255,255,255,0.60)" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%' }}>
      <path d="M3.333 8L6.667 11.333L13.333 4.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MediaCard({ item, selected, onToggle }) {
  const [hov, setHov] = useState(false);

  return (
    <div
      style={{
        height: '124px',
        borderRadius: '8px',
        flex: 1,
        position: 'relative',
        border: selected ? '1px solid #2EC2E1' : '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
        transition: 'border-color 0.12s',
      }}
      onClick={onToggle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {/* 缩略图 */}
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundImage: `url(${item.thumbnail || item.url})`,
          backgroundSize: 'cover',
          backgroundPosition: '50%',
          borderRadius: '7px',
          overflow: 'hidden',
        }}
      />

      {/* hover 遮罩 */}
      {hov && !selected && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
      )}

      {/* 选中遮罩 */}
      {selected && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(46,194,225,0.08)', pointerEvents: 'none' }} />
      )}

      {/* 镜头编号标签 */}
      <div style={{
        position: 'absolute', bottom: '6px', left: '6px',
        backgroundColor: 'rgba(0,0,0,0.50)',
        borderRadius: '4px', padding: '2px 6px',
      }}>
        <span style={{ fontFamily: FONT, fontSize: '11px', lineHeight: '16px', color: 'rgba(255,255,255,0.70)' }}>
          {item.label}
        </span>
      </div>

      {/* 勾选框 */}
      <div style={{ position: 'absolute', top: '6px', right: '6px', padding: '2px' }}>
        <div style={{
          position: 'relative',
          width: '16px', height: '16px',
          borderRadius: '4px',
          backgroundColor: selected ? '#2DC3E1' : '#090909',
          border: '1px solid rgba(255,255,255,0.20)',
          flexShrink: 0,
        }}>
          {selected && <CheckIcon />}
        </div>
      </div>
    </div>
  );
}

export default function BatchDownloadModal({ shots, onClose, onConfirm }) {
  const [tab, setTab] = useState('video'); // 'image' | 'video'
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());

  // 根据 tab 构建素材列表，只保留有真实素材的 shot
  const items = useMemo(() => {
    return shots
      .filter((s) => {
        const media = tab === 'image' ? s.storyboardImage : s.storyboardVideo;
        return !!media?.url;
      })
      .map((s) => {
        const media = tab === 'image' ? s.storyboardImage : s.storyboardVideo;
        return {
          id: `${s.id}-${tab}`,
          shotId: s.id,
          label: `镜头 ${s.number}`,
          url: media.url,
          thumbnail: media.thumbnail || media.url,
          name: tab === 'image'
            ? `shot-${s.number}-image.jpg`
            : `shot-${s.number}-video.mp4`,
        };
      })
      .filter((item) => {
        if (!search.trim()) return true;
        return item.label.includes(search.trim());
      });
  }, [shots, tab, search]);

  const availableItems = items;

  function toggleItem(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleTabChange(newTab) {
    setTab(newTab);
    setSelected(new Set());
  }

  const selectedCount = selected.size;

  function handleConfirm() {
    const toDownload = availableItems.filter((i) => selected.has(i.id));
    onConfirm?.(toDownload);
    onClose();
  }

  // 全选/取消全选
  function toggleSelectAll() {
    if (selectedCount === availableItems.length && availableItems.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(availableItems.map((i) => i.id)));
    }
  }

  const allSelected = availableItems.length > 0 && selectedCount === availableItems.length;

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.60)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        display: 'flex', flexDirection: 'column',
        width: '800px', height: '600px',
        borderRadius: '16px', overflow: 'hidden',
        backgroundColor: '#161616',
        fontFamily: FONT,
      }}>
        {/* 顶部标题栏 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', flexShrink: 0,
        }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>
            批量下载
          </span>
          <div
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '6px' }}
            onClick={onClose}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <CloseIcon />
          </div>
        </div>

        {/* Tab 栏 + 搜索框 */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '8px 24px', gap: '12px', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
            {['image', 'video'].map((t) => {
              const label = t === 'image' ? '图片' : '视频';
              const active = tab === t;
              return (
                <div
                  key={t}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                  onClick={() => handleTabChange(t)}
                >
                  <span style={{
                    fontFamily: active ? FONT_MEDIUM : FONT,
                    fontWeight: active ? 500 : 400,
                    fontSize: '14px', lineHeight: '18px',
                    color: active ? '#FFFFFF' : 'rgba(255,255,255,0.60)',
                    transition: 'color 0.12s',
                  }}>
                    {label}
                  </span>
                  {active && (
                    <div style={{ height: '2px', alignSelf: 'stretch', backgroundColor: '#DDDDDD', borderRadius: '1px' }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* 搜索框 */}
          <div style={{
            display: 'flex', alignItems: 'center', height: '36px', width: '232px',
            paddingLeft: '12px', paddingRight: '6px',
            borderRadius: '8px', justifyContent: 'space-between', flexShrink: 0,
            backgroundColor: '#1D1E1E',
            border: '1px solid rgba(255,255,255,0.08)',
            outline: '1px solid rgba(0,0,0,0.50)',
          }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索素材"
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontFamily: FONT, fontSize: '14px', lineHeight: '18px',
                color: '#FFFFFF',
                caretColor: '#2DC3E1',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', height: '24px', flexShrink: 0, borderRadius: '6px', padding: '0 8px', gap: '4px' }}>
              <SearchIcon />
            </div>
          </div>
        </div>

        {/* 全选行 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 24px 0', flexShrink: 0,
        }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            onClick={toggleSelectAll}
          >
            <div style={{
              position: 'relative',
              width: '14px', height: '14px',
              borderRadius: '3px',
              backgroundColor: allSelected ? '#2DC3E1' : 'transparent',
              border: allSelected ? '1px solid #2DC3E1' : '1px solid rgba(255,255,255,0.30)',
              flexShrink: 0,
            }}>
              {allSelected && (
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%' }}>
                  <path d="M3.333 8L6.667 11.333L13.333 4.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.60)' }}>
              全选
            </span>
          </div>
          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.40)' }}>
            已选 {selectedCount} / {availableItems.length}
          </span>
        </div>

        {/* 素材网格 */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '8px 24px 0',
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          {items.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: FONT, fontSize: '14px', color: 'rgba(255,255,255,0.30)' }}>
                {search ? '未找到匹配素材' : '暂无素材'}
              </span>
            </div>
          ) : (
            // 每行 4 列
            Array.from({ length: Math.ceil(items.length / 4) }, (_, rowIdx) => (
              <div key={rowIdx} style={{ display: 'flex', gap: '12px', alignSelf: 'stretch' }}>
                {items.slice(rowIdx * 4, rowIdx * 4 + 4).map((item) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    selected={selected.has(item.id)}
                    onToggle={() => toggleItem(item.id)}
                  />
                ))}
                {/* 补齐不足 4 列的空位 */}
                {items.slice(rowIdx * 4, rowIdx * 4 + 4).length < 4 &&
                  Array.from({ length: 4 - items.slice(rowIdx * 4, rowIdx * 4 + 4).length }, (_, i) => (
                    <div key={`empty-${i}`} style={{ flex: 1 }} />
                  ))
                }
              </div>
            ))
          )}
        </div>

        {/* 底部操作栏 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '16px',
          justifyContent: 'flex-end', alignSelf: 'stretch',
          padding: '16px 24px',
          flexShrink: 0,
        }}>
          <GhostBtn onClick={onClose}>取消</GhostBtn>
          <ConfirmBtn onClick={handleConfirm} disabled={selectedCount === 0}>
            {selectedCount > 0 ? `下载 ${selectedCount} 个` : '确定'}
          </ConfirmBtn>
        </div>
      </div>
    </div>,
    document.body
  );
}

function GhostBtn({ children, onClick }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', height: '36px', flexShrink: 0,
        borderRadius: '8px', paddingInline: '16px', gap: '4px',
        boxShadow: 'rgba(0,0,0,0.40) 3px 3px 8px',
        backgroundColor: pressed ? '#1a1a1a' : hov ? '#1e1e1e' : '#161616',
        border: '1px solid rgba(255,255,255,0.05)',
        outline: '1px solid rgba(0,0,0,0.50)',
        cursor: 'pointer',
        transition: 'background-color 0.10s',
      }}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', whiteSpace: 'nowrap' }}>
        {children}
      </span>
    </div>
  );
}

function ConfirmBtn({ children, onClick, disabled }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', height: '36px', flexShrink: 0,
        borderRadius: '8px',
        boxShadow: 'rgba(0,0,0,0.40) 3px 3px 8px',
        outline: '1px solid rgba(0,0,0,0.50)',
        backgroundImage: CONFIRM_GRADIENT,
        padding: '1px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'opacity 0.12s',
      }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      <div style={{
        display: 'flex', alignItems: 'center',
        flexGrow: 1, flexShrink: 1, flexBasis: '0%',
        borderRadius: '7px', paddingInline: '15px', gap: '4px',
        backgroundColor: pressed ? '#1a1a1a' : hov ? '#1e1e1e' : '#161616',
        transition: 'background-color 0.10s',
      }}>
        <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>
          {children}
        </span>
      </div>
    </div>
  );
}
