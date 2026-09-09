/**
 * 结构索引
 * ========
 *   组件 MediaDetailModal       通用媒体详情弹窗（图片/视频）     L93–L574
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
 *     onToggleFavorite?: (image) => void 收藏回调（图片模式顶部操作，可选）
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
 *   2026-08-06  详情弹窗统一使用 3:2、90% 视口和 1200×800 最小尺寸，并整体等比缩放
 *   2026-09-04  图片模式右栏采用顶部操作、中间滚动、底部图片编辑固定布局，视频模式保留原操作区
 *   2026-09-09  局部重绘、智能超清、裁剪、翻转图标对齐创作页，功能逻辑不变
 *   2026-09-09  图片模式按标题栏剩余高度分配左右栏，完整保留底部内边距；视频布局不变
 *   2026-09-09  图片编辑关闭或取消返回详情，编辑完成保持原关闭行为
 */

import { useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalSize } from '../utils/useModalSize';
import LocalImageEditor from './image-edit/LocalImageEditor';
import { ImageEditContext } from './image-edit/ImageEditContext';
import ConfirmDialog from './ConfirmDialog';
import Toggle from './Toggle';
import { normalizeImageUrl } from '../utils/imageUrl';
import { showGlobalToast } from '../stores/toastStore';
import CopyPromptButton from './ui/CopyPromptButton';
import { FavoriteIcon, DeleteIcon } from './ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function PanelAction({ icon, label, onClick, active = false }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', minWidth: '24px', height: '24px', padding: 0, border: 0, borderRadius: '7px', backgroundColor: hovered ? '#FFFFFF14' : '#161616', cursor: 'pointer', transition: 'background-color 0.12s' }}
    >
      {icon}
    </button>
  );
}

function EditTool({ label, icon, onClick }) {
  const [hovered, setHovered] = useState(false);
  const edit = useContext(ImageEditContext);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={edit ? () => edit(label) : onClick}
      style={{ display: 'flex', flex: '1 1 0%', minWidth: 0, height: '64px', padding: '12px 8px', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 0, borderRadius: '6px', backgroundColor: hovered ? '#FFFFFF14' : '#FFFFFF0D', color: '#FFFFFFCC', cursor: 'pointer', transition: 'background-color 0.12s' }}
    >
      {icon}
      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{label}</span>
    </button>
  );
}

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
  onToggleFavorite,
  onCreateImage,
  showPrimaryBadge = true,
}) {
  const { width: modalW, height: modalH, scale: modalScale } = useModalSize();
  const imgs = images ?? [];
  const defaultIdx = activeIndex >= 0 && activeIndex < imgs.length ? activeIndex : imgs.findIndex((img) => img.is_primary);
  const [activeImg, setActiveImg] = useState(defaultIdx >= 0 ? defaultIdx : 0);
  const [hovClose, setHovClose] = useState(false);
  const [hovDownload, setHovDownload] = useState(false);
  const [hovDelete, setHovDelete] = useState(false);
  const [pressDelete, setPressDelete] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editMode, setEditMode] = useState(null);
  const [starAnim, setStarAnim] = useState(false);
  const copyToast = null;
  function showCopyToast() {
    showGlobalToast('提示词复制成功', 'success');
  }

  const currentImg = imgs[activeImg];
  if (editMode) return <LocalImageEditor mode={editMode} card={{ ...currentImg, imageUrl: currentImg?.fileUrl ?? currentImg?.url }} onClose={() => setEditMode(null)} onComplete={() => { setEditMode(null); onClose?.(); }} onSave={onCreateImage} />;
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
  const isImageMode = mode === 'image';

  function handleFavorite() {
    setStarAnim(true);
    setTimeout(() => setStarAnim(false), 300);
    onToggleFavorite?.(currentImg);
  }

  return (
    <ImageEditContext.Provider value={mode === 'image' ? setEditMode : null}>
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
            transform: `scale(${modalScale})`,
            transformOrigin: 'center center',
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
          <div style={{ display: 'flex', height: isImageMode ? undefined : `${modalH - 60}px`, flex: 1, minHeight: isImageMode ? 0 : undefined }}>
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

            {/* 图片模式随内容区拉伸，避免固定高度超出标题栏下方的可用空间。 */}
            <div style={{
              width: isImageMode ? '340px' : '280px', display: 'flex', flexDirection: 'column',
              height: isImageMode ? undefined : `${modalH - 60}px`, flexShrink: 0,
              minHeight: isImageMode ? 0 : undefined,
              backgroundColor: '#161616', borderLeft: '1px solid #FFFFFF0F',
            }}>
              {isImageMode && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, padding: '12px 20px', borderBottom: '1px solid #FFFFFF0A', backgroundColor: '#161616' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PanelAction
                      label="收藏"
                      active={false}
                      onClick={handleFavorite}
                      icon={<div style={{ display: 'flex', transform: starAnim ? 'scale(1.25)' : 'scale(1)', transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)' }}><FavoriteIcon /></div>}
                    />
                    {showDownload && (
                      <PanelAction
                        label="下载"
                        onClick={() => onDownload?.(currentImg?.id, currentImg?.fileUrl ?? currentImg?.url)}
                        icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M13.506 11.439C14.601 10.668 15.071 9.277 14.667 8C14.262 6.723 13.024 6.024 11.684 6.025H10.911C10.405 4.054 8.736 2.599 6.715 2.366C4.693 2.133 2.737 3.171 1.796 4.975C0.856 6.78 1.125 8.977 2.474 10.501" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /><path d="M8.003 13.667L8 7.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /><path d="M10.121 11.545L8 13.667L5.879 11.545" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      />
                    )}
                  </div>
                  {showDelete && (
                    <PanelAction
                      label="删除"
                      onClick={() => setShowDeleteConfirm(true)}
                        icon={<DeleteIcon size={14} />}
                    />
                  )}
                </div>
              )}
              {/* Scrollable content */}
              <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: '0%', overflowY: 'auto', minHeight: 0 }}>
                {/* Primary status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px' }}>
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
                        <CopyPromptButton text={currentImg.input_prompt ?? currentImg.prompt} onCopy={showCopyToast} />
                        {/* Shared copy button above is the active control. */}{globalThis.__MIIOO_LEGACY_COPY_BUTTON__ === true ? <button
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
                        </button> : null}
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
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', width: '100%', minWidth: 0 }}>
                        {refImages.map((ref, idx) => (
                          <div
                            key={idx}
                            style={{
                              borderRadius: '4px', overflow: 'hidden',
                              width: '100%', aspectRatio: '1 / 1',
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
                    <div style={{ display: 'flex', flexDirection: 'row', padding: '16px 20px', gap: '4px', justifyContent: 'flex-start', alignItems: 'center' }}>
                      <span style={{ flex: '1 1 0px', fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>AI 生成时间</span>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{generatedAt || currentImg.created_at}</span>
                    </div>
                  </>
                )}

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
              </div>

              {isImageMode ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, width: '340px', padding: '16px 20px 16px', boxSizing: 'border-box', borderTop: '1px solid #FFFFFF0D', backgroundColor: '#161616' }}>
                  <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>图片编辑</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', width: '100%' }}>
                    <EditTool label="多机位" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="9" height="8" rx="1.5" stroke="#FFFFFFCC" /><path d="M10 6.5L14.5 4.5V11.5L10 9.5V6.5Z" stroke="#FFFFFFCC" strokeLinejoin="round" /></svg>} />
                    <EditTool label="局部重绘" icon={<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="200" height="200" style={{ height: '16px', width: '16px', flexShrink: 0 }}><path d="M392.704 165.952a401.92 401.92 0 0 1 148.16 1.856 32 32 0 1 0 12.608-62.72 464.832 464.832 0 0 0-171.776-2.176 32 32 0 1 0 11.008 63.04z m-129.28 47.488a32 32 0 1 0-32.64-55.104 419.52 419.52 0 0 0-120.832 107.072 32 32 0 0 0 50.944 38.656c27.264-35.84 62.08-66.752 102.464-90.624z m458.88-36.16a32 32 0 0 0-36.928 52.288c21.76 15.36 41.472 32.768 58.88 52.032a32 32 0 1 0 47.488-42.88 419.968 419.968 0 0 0-69.44-61.44z m-618.88 249.344a32 32 0 1 0-62.4-14.08 371.264 371.264 0 0 0-4.096 141.952 32 32 0 1 0 63.168-10.432 307.968 307.968 0 0 1 3.392-117.44z m28.8 212.352a32 32 0 1 0-56.64 29.888 399.36 399.36 0 0 0 71.68 96.448 32 32 0 0 0 45.12-45.44 335.168 335.168 0 0 1-60.16-80.896z m141.696 141.696a32 32 0 1 0-30.72 56.128c17.28 9.472 35.456 17.92 54.208 25.088a32 32 0 1 0 22.912-59.776 379.52 379.52 0 0 1-46.4-21.44z m496.512-52.096a64 64 0 0 1-91.008 30.592l-40.704-23.488a64 64 0 0 1-19.008-94.08l248.32-328.064a36.224 36.224 0 0 1 62.336 35.968l-160 379.072z m-281.984 131.2c34.048-123.52 92.736-121.152 151.488-91.776 53.312 21.312 64 96 0 160-66.176 66.176-193.408 24.96-187.904-9.984 1.92-11.904 10.176-21.248 18.432-30.72 7.552-8.448 15.104-17.024 17.984-27.52z" fill="#FFFFFFCC" /></svg>} />
                    <EditTool label="智能超清" icon={<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="200" height="200" style={{ width: '16px', height: '16px', flexShrink: 0 }}><path d="M456.615 96.598a47.501 46.176 90 0 1 0 95.001H265.465c-42.64 0-77.116 35.465-77.116 79.329l0.105 109.123c339.504 33.271 512.818 192.409 519.994 477.412h50.127c40.247 0 73.267-31.614 76.803-72.107l0.312-7.222V524.585a47.393 46.071 90 0 1 92.247 0v253.55c0 96.285-75.815 174.329-169.466 174.329h-493.006A174.276 169.414 90 0 1 95.947 778.134v-507.152A174.382 169.518 90 0 1 265.413 96.598H456.616z m-132.288 516.194a28.779 27.976 90 0 0-27.975 28.779v57.61H240.349v-57.61a28.779 27.976 90 0 0-56.003 0v172.831a28.779 27.976 90 0 0 56.003 0V756.791h56.003v57.611a28.779 27.976 90 0 0 56.004 0v-172.778a28.779 27.976 90 0 0 -28.028-28.832z m140.036 0H408.359a28.779 27.976 90 0 0-27.872 25.837l-0.155 2.942v172.831c0 15.94 12.531 28.832 28.027 28.832h56.004a86.389 83.979 90 0 0 83.979-86.442v-57.611c0-47.715-37.595-86.389-83.979-86.389z m0 57.61c15.444 0 27.975 12.892 27.975 28.779V756.791a28.779 27.976 90 0 1-27.975 28.832h-28.028V670.402zM771.834 56.48a20.327 19.76 90 0 1 18.357 12.838l9.827 24.606c16.64 41.509 48.048 74.835 87.88 93.183l27.976 12.837a21.182 20.592 90 0 1 0 38.515l-29.64 13.587A175.078 170.194 90 0 0 799.654 342.445l-9.672 22.52a20.327 19.76 90 0 1-36.4 0l-9.568-22.627A174.918 170.039 90 0 0 657.436 252.045l-29.588-13.587a21.29 20.696 90 0 1 0-38.514l27.925-12.837a175.078 170.194 90 0 0 87.774-93.236l9.881-24.553A20.327 19.76 90 0 1 771.835 56.48z" fill="#FFFFFFCC" /></svg>} />
                    <EditTool label="消除笔" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M9.5 3L13 6.5L6.5 13H3V9.5L9.5 3Z" stroke="#FFFFFFCC" strokeLinejoin="round" /><path d="M7 5.5L10.5 9M3 13H13" stroke="#FFFFFFCC" strokeLinecap="round" /></svg>} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', width: '100%' }}>
                    <EditTool label="扩图" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3.5" y="3.5" width="9" height="9" rx="0.5" stroke="#FFFFFFCC" strokeDasharray="2 1.5" /><path d="M1.5 1.5L3.5 3.5M14.5 1.5L12.5 3.5M1.5 14.5L3.5 12.5M14.5 14.5L12.5 12.5" stroke="#FFFFFFCC" strokeLinecap="round" /></svg>} />
                    <EditTool label="裁剪" icon={<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="200" height="200" style={{ width: '16px', height: '16px', flexShrink: 0 }}><path d="M902.978 735.755 794.79 735.786 794.79 290.533C794.79 245.399 759.3 208.812 715.52 208.812L688.78 208.812C687.994 208.763 687.203 208.73 686.404 208.73L392.766 208.812 291.611 208.812 291.611 208.84 284.461 208.842 284.461 130.017 284.311 130.017 284.302 96.557C284.297 74.645 267.064 56.885 245.808 56.889 224.554 56.894 207.326 74.66 207.33 96.572L207.339 130.017 207.33 130.017 207.33 208.864 99.126 208.894C77.872 208.899 60.645 226.665 60.648 248.578 60.653 270.489 77.886 288.25 99.142 288.246L207.33 288.216 207.33 733.467C207.33 778.601 242.82 815.188 286.6 815.188L313.34 815.188C314.126 815.237 314.917 815.27 315.716 815.27L609.354 815.188 710.509 815.188 710.509 815.16 717.659 815.158 717.659 893.983 717.809 893.983 717.818 927.443C717.823 949.355 735.056 967.115 756.312 967.111 777.566 967.106 794.794 949.34 794.79 927.428L794.781 893.983 794.79 893.983 794.79 815.136 902.994 815.106C924.248 815.101 941.475 797.335 941.472 775.422 941.468 753.511 924.234 735.752 902.978 735.755L902.978 735.755ZM609.209 735.838 325.382 735.838C304.639 735.838 284.462 714.872 284.462 693.488L284.462 288.193 392.913 288.162 676.741 288.162C697.483 288.162 717.66 309.128 717.66 330.512L717.66 735.807 609.209 735.838 609.209 735.838Z" fill="#FFFFFFCC" /></svg>} />
                    <EditTool label="翻转" icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2V14" stroke="#FFFFFFCC" strokeLinecap="round" strokeDasharray="2 1.5" /><path d="M2 5L5.5 8L2 11V5ZM14 5L10.5 8L14 11V5Z" fill="#FFFFFFCC" /></svg>} />
                    <div style={{ width: '100%', height: '64px', opacity: 0 }} />
                  </div>
                </div>
              ) : <div style={{ flexShrink: 0, paddingTop: '16px', paddingBottom: '20px', paddingLeft: '20px', paddingRight: '20px', borderTop: '1px solid #FFFFFF0A', display: 'flex', gap: '8px' }}>
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
              </div>}
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
    </ImageEditContext.Provider>
  );
}
