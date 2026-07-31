/**
 * 结构索引
 * ========
 *   组件 MediaDetailModal       通用媒体详情弹窗（图片/视频）     L30–L420
 *     - 复用自 AssetsPage 的 SubjectAssetDetailModal
 *     - 左侧：大图/视频预览 + 缩略图列表（始终显示，不设数量下限）
 *     - 右侧：创作信息面板（名称/描述/提示词/参数/按钮）
 *     - 尺寸跟随屏幕缩放（useModalSize）
 *
 *   Props:
 *     mode: 'image' | 'video'          媒体模式
 *     images: Array<{ id, url/fileUrl, is_primary, prompt?, model?, ratio?, resolution?, created_at?, refImages? }>
 *     name: string                     主体名称（标题）
 *     description?: string             描述文本
 *     videoUrl?: string                视频模式下的视频 URL
 *     showDelete?: boolean             是否显示删除按钮
 *     showDownload?: boolean           是否显示下载按钮
 *     zIndex?: number                  弹窗层级（默认 200）
 *     source?: string                  图片来源：'local-upload' | 'asset-library'（AI生成无需传入）
 *     onClose: () => void              关闭回调
 *     onDownload?: (imageId?, fileUrl?) => void  下载回调
 *     onDeleteImage?: (imageId) => void 删除回调
 *     onPrimaryChange?: (image, nextValue) => void 定稿开关回调
 *     showPrimaryBadge?: boolean              是否显示缩略图定稿标签（默认显示）
 *     shotNumber?: string              分镜名称
 *     generatedAt?: string            AI 生成时间
 *   2026-07-03  删除左侧底部 refImages 条（已在右侧信息区展示）；缩略图列表始终显示
 *   2026-07-06  右侧信息区字段对齐 AssetsPage ShotDetailModal：分镜编号横向布局、分镜模式隐藏名称描述、生成参数仅模型+分辨率、时间标签统一"AI 生成时间"
 *   2026-07-06  新增 source prop：区分 AI 生成 / 本地上传 / 资产库，非 AI 图片右侧显示「来源」字段；生成参数和 AI 生成时间仅 AI 生成时展示
 *   2026-07-28  主体候选图按当前图片来源展示创作信息：本地上传隐藏，资产库图片使用资产自身字段
 *   2026-07-31  参考图仅展示当前候选图片原数据中的关联图片，不再继承主体参考图
 *   2026-07-28  主体详情图定稿状态改用 Toggle，定稿唯一性由主体页动作链路保证
 *   2026-07-28  主体详情图隐藏缩略图定稿标签，保留其他页面默认展示
 */

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalSize } from '../utils/useModalSize';
import ConfirmDialog from './ConfirmDialog';
import Toggle from './Toggle';
import { normalizeImageUrl } from '../utils/imageUrl';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export default function MediaDetailModal({
  activeIndex = 0,
  mode = 'image',
  images = [],
  name = '',
  description = '',
  videoUrl = null,
  showDelete = false,
  shotNumber = '',
  generatedAt = '',
  showDownload = true,
  zIndex = 200,
  source = '',
  onClose,
  onDownload,
  onDeleteImage,
  onPrimaryChange,
  showPrimaryBadge = true,
}) {
  const { width: modalW, height: modalH } = useModalSize();
  const imgs = images ?? [];
  const defaultIdx = activeIndex >= 0 && activeIndex < imgs.length ? activeIndex : imgs.findIndex((img) => img.is_primary);
  const [activeImg, setActiveImg] = useState(defaultIdx >= 0 ? defaultIdx : 0);
  const [hovClose, setHovClose] = useState(false);
  const [hovDownload, setHovDownload] = useState(false);
  const [hovDelete, setHovDelete] = useState(false);
  const [pressDelete, setPressDelete] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const copyToastTimer = useRef(null);

  function showCopyToast() {
    clearTimeout(copyToastTimer.current);
    setCopyToast(true);
    copyToastTimer.current = setTimeout(() => setCopyToast(false), 2000);
  }

  const currentImg = imgs[activeImg];
  const isPrimary = currentImg?.is_primary ?? false;
  const currentSource = currentImg?.detailSource || currentImg?.source || source;
  const refImages = (currentSource === 'local-upload' ? [] : (currentImg?.refImages ?? [])).map((ref) => {
    const url = typeof ref === 'string' ? ref : ref?.url ?? ref?.fileUrl ?? ref?.file_url;
    return typeof ref === 'string' ? { url: normalizeImageUrl(url) } : { ...ref, url: normalizeImageUrl(url) };
  }).filter((ref) => ref.url);

  // 分镜模式 / 非分镜模式判断
  const isShotMode = !!shotNumber;
  // 当前图片的生成参数（模型、分辨率、画面比例）
  const genModel = currentImg?.model || null;
  const genResolution = currentImg?.resolution || null;
  const genRatio = currentImg?.ratio || null;
  // 是否 AI 生成
  const isAiGenerated = !currentSource || currentSource === 'ai-generated' || currentSource === 'subject-image';
  const canShowGenerationInfo = isAiGenerated || currentSource === 'asset-library';
  // 来源标签
  const sourceLabel = currentSource === 'local-upload' ? '本地上传' : currentSource === 'asset-library' ? '资产库' : '';

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: zIndex,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
        onClick={onClose}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: `${modalW}px`,
            height: `${modalH}px`,
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '#00000099 -10px 24px 64px',
            backgroundColor: '#161616',
            border: '1px solid #FFFFFF14',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            paddingTop: '20px',
            paddingBottom: '20px',
            paddingLeft: '24px',
            paddingRight: '24px',
            backgroundColor: '#161616',
          }}>
            <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFF' }}>查看详情</span>
            <button
              type="button"
              style={{
                width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: hovClose ? '#FFFFFF14' : 'transparent', border: 'none', cursor: 'pointer',
                borderRadius: '6px', padding: 0, flexShrink: 0, transition: 'background 0.12s',
              }}
              onMouseEnter={() => setHovClose(true)}
              onMouseLeave={() => setHovClose(false)}
              onClick={onClose}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M12 4L4 12M4 4L12 12" stroke="#FFFFFF99" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div style={{ display: 'flex', height: `${modalH - 60}px`, flex: 1 }}>
            {/* Left: preview + thumbnails */}
            <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, flexBasis: '0%', minWidth: 0, minHeight: 0, backgroundColor: '#0D0D0D' }}>
              {/* Main media */}
              <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: '0%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, position: 'relative', backgroundColor: '#0A0A0A' }}>
                {mode === 'video' && videoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', padding: '16px', boxSizing: 'border-box' }}
                  />
                ) : (
                  <img
                    src={currentImg?.fileUrl ?? currentImg?.url ?? null}
                    alt=""
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', padding: '16px', boxSizing: 'border-box', transition: 'opacity 0.15s' }}
                  />
                )}
              </div>

              {/* Thumbnails */}
                <div style={{
                  flexShrink: 0,
                  paddingTop: '14px', paddingBottom: '16px', paddingLeft: '16px', paddingRight: '16px',
                  backgroundColor: '#161616',
                  borderTop: '1px solid #FFFFFF0F',
                }}>
                  <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', alignItems: 'center' }}>
                    {imgs.map((img, idx) => {
                      const thumbUrl = img.fileUrl ?? img.url ?? null;
                      if (!thumbUrl) return null;
                      const isActive = idx === activeImg;
                      return (
                        <div
                          key={img.id ?? idx}
                          style={{
                            borderRadius: '6px',
                            overflow: 'hidden',
                            width: '120px',
                            height: '84px',
                            flexShrink: 0,
                            cursor: 'pointer',
                            boxShadow: isActive ? '#2DC3E166 0px 0px 10px 1px' : 'none',
                            backgroundColor: '#FFFFFF14',
                            border: isActive ? '1px solid #2DC3E1' : '1px solid #FFFFFF33',
                            transition: 'border-color 0.15s, box-shadow 0.15s',
                          }}
                          onClick={() => setActiveImg(idx)}
                        >
                          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                            <div style={{ width: '100%', height: '100%', backgroundImage: `url(${thumbUrl})`, backgroundSize: 'cover', backgroundPosition: '50%' }} />
                            {showPrimaryBadge && img.is_primary && (
                              <span style={{ position: 'absolute', left: '6px', bottom: '6px', padding: '2px 4px', borderRadius: '2px', backgroundColor: '#4AC981', color: '#0A0A0A', fontFamily: FONT, fontSize: '10px', lineHeight: '12px', fontWeight: 500 }}>定稿</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
            </div>

            {/* Right: info panel — 对齐 ShotDetailModal 高度约束 */}
            <div style={{
              width: '280px', display: 'flex', flexDirection: 'column',
              height: `${modalH - 60}px`, flexShrink: 0,
              backgroundColor: '#161616', borderLeft: '1px solid #FFFFFF0F',
            }}>
              {/* Scrollable content */}
              <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: '0%', overflowY: 'auto', minHeight: 0 }}>
                {/* Primary status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
                  <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>是否定稿</span>
                  {onPrimaryChange ? (
                    <Toggle
                      value={isPrimary}
                      onChange={(nextValue) => onPrimaryChange?.(currentImg, nextValue)}
                    />
                  ) : isPrimary ? (
                    <div style={{
                      paddingLeft: '4px', paddingRight: '4px', paddingTop: '2px', paddingBottom: '2px',
                      borderRadius: '2px', backgroundColor: '#4AC981',
                      boxShadow: '#FFFFFF14 0px 0px 0px 1px inset',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                    }}>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', color: '#0A0A0A', fontWeight: 500 }}>定稿</span>
                    </div>
                  ) : (
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF66' }}>否</span>
                  )}
                </div>

                <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />

                {/* Shot number（分镜模式）- 对齐 ShotDetailModal 横向布局 */}
                {isShotMode && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>分镜编号</span>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{shotNumber}</span>
                    </div>
                    <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                  </>
                )}

                {/* Name + description（仅非分镜模式展示） */}
                {!isShotMode && (name || description) && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '8px' }}>
                      {name && <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFF' }}>{name}</span>}
                      {description && (
                        <p style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFFCC', margin: 0 }}>{description}</p>
                      )}
                    </div>
                    <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                  </>
                )}

                {/* Prompt */}
                {canShowGenerationInfo && (currentImg?.input_prompt || currentImg?.prompt) && (
                  <>
                    <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>提示词</span>
                        <button
                          type="button"
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '24px', height: '24px', borderRadius: '4px',
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            opacity: 0.6, transition: 'opacity 0.12s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                          onClick={() => {
                            navigator.clipboard.writeText(currentImg.input_prompt ?? currentImg.prompt);
                            showCopyToast();
                          }}
                          title="复制提示词"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                            <path d="M4.33337 4.14383V2.60413C4.33337 2.08636 4.75311 1.66663 5.27087 1.66663H13.3959C13.9136 1.66663 14.3334 2.08636 14.3334 2.60413V10.7291C14.3334 11.2469 13.9136 11.6666 13.3959 11.6666H11.8388" stroke="white" strokeOpacity="0.6" strokeLinecap="round" strokeLinejoin="round"/>
                            <path fillRule="evenodd" clipRule="evenodd" d="M1.66663 5.27083V13.3958C1.66663 13.9136 2.08636 14.3333 2.60413 14.3333H10.7291C11.2469 14.3333 11.6666 13.9136 11.6666 13.3958V5.27083C11.6666 4.75307 11.2469 4.33333 10.7291 4.33333H2.60413C2.08636 4.33333 1.66663 4.75307 1.66663 5.27083Z" stroke="white" strokeOpacity="0.6" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                      <p style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFFCC', margin: 0 }}>{currentImg.input_prompt ?? currentImg.prompt}</p>
                    </div>
                  </>
                )}

                {/* Ref images (shot mode: in right panel) */}
                {refImages.length > 0 && (
                  <>
                    <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>参考图</span>
                      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', flex: 1, minWidth: 0 }}>
                        {refImages.map((ref, idx) => (
                          <div
                            key={idx}
                            style={{
                              borderRadius: '4px', overflow: 'hidden',
                              width: '80px', height: '56px', flexShrink: 0,
                              backgroundColor: '#FFFFFF14',
                              border: '1px solid #FFFFFF33',
                              backgroundImage: `url(${ref.url || ref.fileUrl || ''})`,
                              backgroundSize: 'cover', backgroundPosition: '50%',
                            }}
                            title={ref.title || ''}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Generation params — 分镜模式仅模型+分辨率，非分镜含画面比例 */}
                {canShowGenerationInfo && (genModel || genRatio || genResolution) && (
                  <>
                    <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '12px' }}>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>生成参数</span>
                      {[
                        { label: '模型', value: genModel },
                        ...(isShotMode ? [] : [{ label: '画面比例', value: genRatio }]),
                        { label: '分辨率', value: genResolution },
                      ].filter(({ value }) => value).map(({ label, value }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>{label}</span>
                          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* AI 生成时间 — 对齐 ShotDetailModal 标签 */}
                {isAiGenerated && (currentImg?.created_at || generatedAt) && (
                  <>
                    <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '4px' }}>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>AI 生成时间</span>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF66' }}>{generatedAt || currentImg.created_at}</span>
                    </div>
                  </>
                )}
              </div>

              {/* 非 AI 生成的来源标识 */}
              {!isAiGenerated && (
                <>
                  <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>来源</span>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{sourceLabel}</span>
                  </div>
                </>
              )}

              {/* Sticky buttons */}
              <div style={{ flexShrink: 0, paddingTop: '12px', paddingBottom: '20px', paddingLeft: '20px', paddingRight: '20px', borderTop: '1px solid #FFFFFF0A', display: 'flex', gap: '8px' }}>
                {showDelete && (
                  <button
                    type="button"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flex: 1, height: '40px', borderRadius: '8px', gap: '8px',
                      backgroundColor: pressDelete ? '#FFFFFF26' : hovDelete ? '#FFFFFF1F' : '#FFFFFF14',
                      border: '1px solid #FFFFFF1F', cursor: 'pointer', transition: 'background-color 0.12s',
                      opacity: pressDelete ? 0.8 : 1,
                    }}
                    onMouseEnter={() => setHovDelete(true)}
                    onMouseLeave={() => { setHovDelete(false); setPressDelete(false); }}
                    onMouseDown={() => setPressDelete(true)}
                    onMouseUp={() => setPressDelete(false)}
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M2.333 3.667V12.333C2.333 12.784 2.716 13.167 3.167 13.167H10.833C11.284 13.167 11.667 12.784 11.667 12.333V3.667" stroke="#FF6B6B" strokeLinejoin="round" />
                      <path d="M5.333 6V10.667" stroke="#FF6B6B" strokeLinecap="round" />
                      <path d="M8.667 6V10.667" stroke="#FF6B6B" strokeLinecap="round" />
                      <path d="M1 3.667H13" stroke="#FF6B6B" strokeLinecap="round" />
                      <path d="M4.333 3.667L5.15 1.333H8.85L9.667 3.667" stroke="#FF6B6B" strokeLinejoin="round" />
                    </svg>
                    <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FF6B6B' }}>删除</span>
                  </button>
                )}
                {showDownload && (
                  <button
                    type="button"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flex: showDelete ? 1 : undefined,
                      width: showDelete ? undefined : '100%',
                      height: '40px', borderRadius: '8px', gap: '8px',
                      backgroundColor: hovDownload ? '#FFFFFF1F' : '#FFFFFF14',
                      border: '1px solid #FFFFFF1F', cursor: 'pointer', transition: 'background-color 0.12s',
                    }}
                    onMouseEnter={() => setHovDownload(true)}
                    onMouseLeave={() => setHovDownload(false)}
                    onClick={() => {
                      if (onDownload) {
                        onDownload(currentImg?.id, currentImg?.fileUrl ?? currentImg?.url);
                      }
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M7 2V9M7 9L4 6.5M7 9L10 6.5M2 11H12" stroke="#FFFFFF99" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>下载</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirm dialog */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="确认删除图片"
          message="确认删除图片？\n删除后无法恢复，需谨慎操作。"
          confirmLabel="删除"
          confirmVariant="danger"
          onClickOutside={() => setShowDeleteConfirm(false)}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            setShowDeleteConfirm(false);
            onDeleteImage?.(currentImg?.id);
          }}
        />
      )}

      {/* Copy toast */}
      {copyToast && createPortal(
        <div style={{ position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(30,30,30,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 14.667C11.682 14.667 14.667 11.682 14.667 8C14.667 4.318 11.682 1.333 8 1.333C4.318 1.333 1.333 4.318 1.333 8C1.333 11.682 4.318 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round"/><path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ fontSize: '14px', color: '#FFFFFF', fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif" }}>提示词复制成功</span>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
