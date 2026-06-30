import { useState } from 'react';
import { createPortal } from 'react-dom';
import ConfirmDialog from './ConfirmDialog';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function StarIcon({ filled = false, strokeColor = '#FFFFFF' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M7 1.5l1.545 3.13 3.455.503-2.5 2.436.59 3.44L7 9.369l-3.09 1.64.59-3.44L2 5.133l3.455-.503L7 1.5z"
        fill={filled ? '#F0B429' : 'none'}
        stroke={filled ? '#F0B429' : strokeColor}
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

async function downloadImage(url) {
  if (!url) return;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = 'creation.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
  } catch {
    window.open(url, '_blank');
  }
}

function formatCreationDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ConfirmDeleteModal 已迁移至 ConfirmDialog 共享组件

function ModalActionBtn({ icon, label, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        borderRadius: '8px',
        border: '1px solid #FFFFFF1F',
        backgroundColor: hovered ? '#FFFFFF1F' : '#FFFFFF14',
        cursor: 'pointer',
        transition: 'background-color 0.15s',
      }}
    >
      {icon}
      <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>{label}</span>
    </button>
  );
}

const DETAIL_PANEL_DIVIDER = (
  <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px', flexShrink: 0 }} />
);

export default function ImageDetailModal({ card, onClose, onDelete, favorited, onToggleFavorite }) {
  const [starAnim, setStarAnim] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleStarClick() {
    setStarAnim(true);
    setTimeout(() => setStarAnim(false), 300);
    onToggleFavorite?.();
  }

  return (
    <>
      {createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
          onClick={onClose}
        >
          <div
            style={{ width: '960px', borderRadius: '16px', border: '1px solid #FFFFFF14', backgroundColor: '#161616', boxShadow: '#00000099 -10px 24px 64px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', backgroundColor: '#161616', flexShrink: 0 }}>
              <span style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', fontWeight: 500, lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFF' }}>查看详情</span>
              <div
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: closeHovered ? '#FFFFFF14' : 'transparent', transition: 'background 120ms' }}
                onClick={onClose}
                onMouseEnter={() => setCloseHovered(true)}
                onMouseLeave={() => setCloseHovered(false)}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4L12 12" stroke={closeHovered ? '#FFFFFF' : '#FFFFFF99'} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* Body */}
            <div style={{ display: 'flex', height: '540px' }}>
              {/* Left: image viewer */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A', position: 'relative', overflow: 'hidden' }}>
                {card.imageUrl && (
                  <img
                    src={card.imageUrl}
                    alt=""
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                )}
              </div>

              {/* Right: info panel */}
              <div style={{ width: '280px', flexShrink: 0, backgroundColor: '#161616', borderLeft: '1px solid #FFFFFF0F', display: 'flex', flexDirection: 'column', height: '540px' }}>
                {/* Scrollable content area */}
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {DETAIL_PANEL_DIVIDER}

                {/* 提示词 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px 20px', flexShrink: 0 }}>
                  <div style={{ fontFamily: FONT, fontSize: '11px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>提示词</div>
                  <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{card.prompt || '—'}</div>
                </div>

                {/* 参考图 */}
                {card.refImages && card.refImages.length > 0 && (
                  <>
                    {DETAIL_PANEL_DIVIDER}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px', flexShrink: 0 }}>
                      <div style={{ fontFamily: FONT, fontSize: '11px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>参考图</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        {card.refImages.map((img, i) => {
                          const imgUrl = img.url || img.previewUrl || '';
                          return (
                            <div key={i} style={{
                              width: 'calc(50% - 6px)',
                              height: '84px',
                              borderRadius: '6px',
                              border: '1px solid #FFFFFF14',
                              backgroundColor: '#FFFFFF14',
                              overflow: 'hidden',
                              flexShrink: 0,
                              backgroundImage: imgUrl ? `url(${imgUrl})` : 'none',
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }} />
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {DETAIL_PANEL_DIVIDER}

                {/* 生成参数 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px', flexShrink: 0 }}>
                  <div style={{ fontFamily: FONT, fontSize: '11px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>生成参数</div>
                  {card.model && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>模型</span>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{card.model}</span>
                    </div>
                  )}
                  {card.ratio && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>画面比例</span>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{card.ratio}</span>
                    </div>
                  )}
                  {card.resolution && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>分辨率</span>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{card.resolution}</span>
                    </div>
                  )}
                </div>

                {DETAIL_PANEL_DIVIDER}

                {/* AI生成时间 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '16px 20px', flexShrink: 0 }}>
                  <div style={{ fontFamily: FONT, fontSize: '11px', lineHeight: '14px', letterSpacing: '0.66px', textTransform: 'uppercase', color: '#FFFFFF99' }}>AI 生成时间</div>
                  <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.12px', color: '#FFFFFF66' }}>{formatCreationDate(card.createdAt || card.generatedAt)}</div>
                </div>

                {DETAIL_PANEL_DIVIDER}

                </div>

                {/* Bottom actions — fixed at bottom */}
                <div style={{ display: 'flex', gap: '8px', padding: '16px 20px 20px', flexShrink: 0, borderTop: '1px solid #FFFFFF0A' }}>
                  <ModalActionBtn
                    label="收藏"
                    onClick={handleStarClick}
                    icon={
                      <div style={{ transform: starAnim ? 'scale(1.4)' : 'scale(1)', transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)', display: 'flex' }}>
                        <StarIcon filled={favorited} strokeColor="rgba(255,255,255,0.6)" />
                      </div>
                    }
                  />
                  <ModalActionBtn
                    label="下载"
                    onClick={() => downloadImage(card.imageUrl)}
                    icon={
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8.003 11.3V2" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M4 7.333L8 11.333L12 7.333" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M4 14H12" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    }
                  />
                  <ModalActionBtn
                    label="删除"
                    onClick={() => setConfirmDelete(true)}
                    icon={
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 3.333V14.667H13V3.333H3Z" stroke="#FFFFFF99" strokeLinejoin="round" />
                        <path d="M6.667 6.667V11" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M9.333 6.667V11" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M1.333 3.333H14.667" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="#FFFFFF99" strokeLinejoin="round" />
                      </svg>
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="确认删除"
          description="删除后无法恢复，确定要删除这张图片吗？"
          confirmText="删除"
          onConfirm={() => { setConfirmDelete(false); onDelete?.(); }}
          onCancel={() => setConfirmDelete(false)}
          zIndex={1100}
        />
      )}
    </>
  );
}
