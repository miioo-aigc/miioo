import { useState, memo } from 'react';
import { createPortal } from 'react-dom';
import { useModalSize } from '../utils/useModalSize';
import { FONT, FONT_MEDIUM } from '../utils/fonts';
import StarIcon from './StarIcon';
import ModalActionBtn from './ModalActionBtn';
import CopyPromptButton from './CopyPromptButton';
import ConfirmDialog from './ConfirmDialog';
import downloadImage from '../utils/downloadImage';
import formatCreationDate from '../utils/formatCreationDate';

const DETAIL_PANEL_DIVIDER = (
  <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px', flexShrink: 0 }} />
);

function ImageDetailModal({ card, onClose, onDelete, favorited, onToggleFavorite }) {
  const { width: modalW, height: modalH } = useModalSize();
  const [starAnim, setStarAnim] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  function handleStarClick() {
    setStarAnim(true);
    setTimeout(() => setStarAnim(false), 300);
    onToggleFavorite?.();
  }

  function handleCopyPrompt() {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }

  return (
    <>
      {createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
          onClick={onClose}
        >
          <div
            style={{ width: `${modalW}px`, borderRadius: '16px', border: '1px solid #FFFFFF14', backgroundColor: '#161616', boxShadow: '#00000099 -10px 24px 64px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
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

            <div style={{ display: 'flex', height: `${modalH - 60}px` }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A', position: 'relative', overflow: 'hidden' }}>
                {card.imageUrl && (
                  <img src={card.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
                )}
              </div>

              <div style={{ width: '280px', flexShrink: 0, backgroundColor: '#161616', borderLeft: '1px solid #FFFFFF0F', display: 'flex', flexDirection: 'column', height: `${modalH - 60}px`, position: 'relative' }}>
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: '76px' }}>
                  {DETAIL_PANEL_DIVIDER}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px 20px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>提示词</div>
                      <CopyPromptButton text={card.prompt} onCopy={handleCopyPrompt} />
                    </div>
                    <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>
                      {card.promptHTML ? <span dangerouslySetInnerHTML={{ __html: card.promptHTML }} /> : (card.prompt || '—')}
                    </div>
                  </div>

                  {card.refImages && card.refImages.length > 0 && (
                    <>
                      {DETAIL_PANEL_DIVIDER}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px', flexShrink: 0 }}>
                        <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>参考图</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                          {card.refImages.map((img, i) => {
                            const imgUrl = img.url || img.previewUrl || '';
                            return (
                              <div key={i} style={{ width: 'calc(50% - 6px)', height: '84px', borderRadius: '6px', border: '1px solid #FFFFFF14', backgroundColor: '#FFFFFF14', overflow: 'hidden', flexShrink: 0, backgroundImage: imgUrl ? `url(${imgUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }} />
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {DETAIL_PANEL_DIVIDER}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px', flexShrink: 0 }}>
                    <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>生成参数</div>
                    {card.model && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: 'rgba(255,255,255,0.6)' }}>模型</span>
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '16px 20px', flexShrink: 0 }}>
                    <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.66px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>AI 生成时间</div>
                    <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.12px', color: 'rgba(255,255,255,0.8)' }}>{formatCreationDate(card.createdAt)}</div>
                  </div>

                  {DETAIL_PANEL_DIVIDER}
                </div>

                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '280px', display: 'flex', gap: '8px', padding: '16px 20px 20px', flexShrink: 0, backgroundColor: '#161616' }}>
                  <ModalActionBtn
                    label="收藏" onClick={handleStarClick}
                    icon={<div style={{ transform: starAnim ? 'scale(1.4)' : 'scale(1)', transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)', display: 'flex' }}><StarIcon filled={favorited} strokeColor="rgba(255,255,255,0.6)" /></div>}
                  />
                  <ModalActionBtn label="下载" onClick={() => downloadImage(card.imageUrl)}
                    icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8.003 11.3V2" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 7.333L8 11.333L12 7.333" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 14H12" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  />
                  <ModalActionBtn label="删除" onClick={() => setConfirmDelete(true)}
                    icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3.333V14.667H13V3.333H3Z" stroke="#FFFFFF99" strokeLinejoin="round" /><path d="M6.667 6.667V11" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" /><path d="M9.333 6.667V11" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" /><path d="M1.333 3.333H14.667" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" /><path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="#FFFFFF99" strokeLinejoin="round" /></svg>}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {confirmDelete && (
        <ConfirmDialog title="确认删除" description="删除后无法恢复，确定要删除这张图片吗？" confirmText="删除"
          onConfirm={() => { setConfirmDelete(false); onDelete?.(); }} onCancel={() => setConfirmDelete(false)} zIndex={1100} />
      )}
      {toastVisible && createPortal(
        <div style={{ position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'none' }}>
          <div className="flex items-center gap-[8px] px-[16px] py-[8px] rounded-medium bg-toast-bg backdrop-blur-[20px]" style={{ whiteSpace: 'nowrap', animation: 'slideUpBounce 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round" />
              <path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-text-primary text-font-size-16 font-font-weight-regular" style={{ fontFamily: FONT }}>您已复制提示词</span>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default memo(ImageDetailModal);
