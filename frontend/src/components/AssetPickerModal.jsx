/**
 * @file AssetPickerModal.jsx
 * @description 项目资产、创作资产与 Seedance 素材的统一选择弹窗。
 *
 * ─── 结构索引 ───────────────────────────────────────────
 *   资产卡片、空态与悬浮预览                           L92-L453
 *   弹窗状态、外部数据适配与会话复位                   L455-L753
 *   项目/创作/Seedance 数据请求                        L754-L1102
 *   筛选、选择确认与弹窗渲染                           L1104-L1609
 *
 *   2026-08-20  Seedance 视频对齐资产库，通过原生视频短暂解码后停帧展示封面
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useCreationStore } from '../stores/creationStore';
import Checkbox from './Checkbox';
import { generationsToFlatList } from '../utils/creativeDaysAdapter';
import { apiGetProjects } from '../api/project';
import { apiGetAssetsPage, enrichWithStoryboards } from '../api/assets';
import { apiListCreationImages, apiListCreationVideos, apiListCreationAudios } from '../api/creation';
import { normalizeImageUrl } from '../utils/imageUrl';
import { dedupeByMediaAliases, getCreationAssetMediaAliases } from '../utils/creationHistoryAdapter';
import { apiGetLiveMaterialAsset, apiGetLiveMaterialPreview, apiListLiveMaterialAssets, apiListLiveMaterialGroups } from '../api/liveMaterials';
import SeedanceFolderCard from './assets/SeedanceFolderCard';
import SeedanceAssetCard from './assets/SeedanceAssetCard';
import { isSeedanceModel } from '../utils/seedanceModel';
import DotsLoading from './DotsLoading';
import CreationAudioResultCard from './creation/CreationAudioResultCard';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

// accept='image' → 只允许图片类资产；'video' → 只允许视频类资产；
// accept='media' → 只允许图片和视频类资产；'audio' → 只允许音频类资产；'all' → 不限制
const PROJECT_SUB_TABS_ALL = ['角色', '场景', '道具', '分镜', '音频', '成片'];
const PROJECT_SUB_TABS_IMAGE = ['角色', '场景', '道具', '分镜'];
const PROJECT_SUB_TABS_VIDEO = ['分镜'];
const PROJECT_SUB_TABS_MEDIA = ['角色', '场景', '道具', '分镜', '成片'];
const PROJECT_SUB_TABS_AUDIO = ['音频'];
const CREATIVE_SUB_TABS_ALL = ['图片', '视频', '配音'];
const CREATIVE_SUB_TABS_IMAGE = ['图片'];
const CREATIVE_SUB_TABS_VIDEO = ['视频'];
const CREATIVE_SUB_TABS_MEDIA = ['图片', '视频'];
const CREATIVE_SUB_TABS_AUDIO = ['配音'];
const CREATIVE_PAGE_SIZE = 9;
const SEEDANCE_VIDEO_POSTER_STORAGE_KEY = 'seedance-video-posters';
const CREATIVE_SUB_TAB_TYPE_MAP = { '图片': 'image', '视频': 'video', '配音': 'audio' };

function getStoredSeedanceVideoPoster(assetId) {
  if (!assetId) return null;
  try {
    const posters = JSON.parse(localStorage.getItem(SEEDANCE_VIDEO_POSTER_STORAGE_KEY) || '{}');
    return posters[assetId] || null;
  } catch {
    return null;
  }
}

function createCreativePagination() {
  return {
    image: { nextPage: 1, hasMore: true, loaded: false },
    video: { nextPage: 1, hasMore: true, loaded: false },
    audio: { nextPage: 1, hasMore: true, loaded: false },
  };
}


// 子 Tab → projectAssetsMap 的 key
const SUB_TAB_KEY_MAP = {
  '角色': 'chars',
  '场景': 'scenes',
  '道具': 'props',
  '分镜': 'storyboard',
  '音频': 'audio',
  '成片': 'final_cut',
  '图片': 'images',
  '视频': 'videos',
  '配音': 'dubbing',
};

// 子 Tab → 后端 category / asset_type 过滤参数
// 数组表示该 tab 需要拉取多个 category 或媒体类型的资产。
const SUB_TAB_CATEGORY_MAP = {
  '角色':   { category: 'character' },
  '场景':   { category: 'scene' },
  '道具':   { category: 'prop' },
  '分镜': { category: ['storyboard', 'reference'], asset_type: ['image', 'video'] },
  '音频':   { category: ['audio', 'reference'] },
  '成片':   { category: 'film' },
};

function AssetCard({ asset, isSelected, isHovered, isDisabled, onMouseEnter, onMouseMove, onMouseLeave, onClick, compact = false, inlineVideoPreview = false }) {
  const [failedPosterUrl, setFailedPosterUrl] = useState(null);
  const videoRef = useRef(null);
  const assetType = String(asset.asset_type || asset.type || '').toLowerCase();
  const isVideo = assetType === 'video';
  const isSeedanceVideo = asset.isSeedanceMaterial && isVideo && Boolean(asset.url);
  const rawPosterUrl = (isSeedanceVideo ? getStoredSeedanceVideoPoster(asset.id) : null) || asset.posterUrl || null;
  const assetPosterUrl = rawPosterUrl && failedPosterUrl !== rawPosterUrl
    ? rawPosterUrl
    : null;
  const posterUrl = assetPosterUrl;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isSeedanceVideo) return undefined;
    if (isHovered) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
    return undefined;
  }, [isHovered, isSeedanceVideo, asset.url]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isSeedanceVideo || isHovered || posterUrl) return undefined;
    let cancelled = false;
    const showDecodedFrame = async () => {
      try {
        await video.play();
        window.setTimeout(() => {
          if (!cancelled) {
            video.pause();
            video.currentTime = 0;
          }
        }, 160);
      } catch {
        // 视频源不允许自动播放时，悬停播放仍作为兜底交互。
      }
    };
    showDecodedFrame();
    return () => { cancelled = true; };
  }, [isHovered, isSeedanceVideo, posterUrl, asset.url]);

  useEffect(() => {
    const video = videoRef.current;
    if (!inlineVideoPreview || !isHovered || !video) return undefined;
    video.currentTime = 0;
    video.play().catch(() => {});
    return () => {
      video.pause();
      try { video.currentTime = 0; } catch { /* ignore reset errors during unmount */ }
    };
  }, [inlineVideoPreview, isHovered, asset.url]);

  return (
    <div
      onClick={isDisabled ? undefined : onClick}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        width: compact ? 'calc((100% - 32px) / 3)' : '175px',
        height: compact ? '135px' : '208px',
        borderRadius: '10px', overflow: 'hidden',
        flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: '#1C1C1C',
        border: `1px solid ${isSelected ? '#FFFFFF33' : isHovered ? 'rgba(255,255,255,0.2)' : '#FFFFFF0F'}`,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'border-color 100ms',
        opacity: isDisabled ? 0.6 : 1,
      }}
    >
      {/* 图片区 */}
      <div style={{
        height: compact ? '100%' : '168px', flexShrink: 0, position: 'relative',
        background: asset.url ? 'transparent' : (asset.bgColor || '#252525'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {asset.isSeedanceMaterial && asset.url && !isVideo ? (
          <div
            aria-label={asset.name || 'Seedance素材'}
            role="img"
            style={{
              width: '100%',
              height: '100%',
              backgroundImage: `url(${normalizeImageUrl(asset.url)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: isHovered && !isSelected ? 0.85 : 1,
              transition: 'opacity 100ms',
            }}
          />
        ) : isSeedanceVideo ? (
          <video
            ref={videoRef}
            src={normalizeImageUrl(asset.url)}
            poster={posterUrl ? (posterUrl.startsWith('data:') ? posterUrl : normalizeImageUrl(posterUrl)) : undefined}
            muted
            playsInline
            preload="auto"
            aria-label={asset.name || 'Seedance视频素材'}
            style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#1A1A1A', pointerEvents: 'none', opacity: isHovered && !isSelected ? 0.85 : 1, transition: 'opacity 100ms' }}
            onLoadedData={(event) => {
              if (posterUrl) return;
              const video = event.currentTarget;
              try {
                video.currentTime = 0;
                video.pause();
              } catch {
                // 视频尚未准备好定位时，保留浏览器当前已加载的首帧。
              }
            }}
          />
        ) : isVideo && inlineVideoPreview && asset.url ? (
          <video
            ref={videoRef}
            src={normalizeImageUrl(asset.url)}
            poster={posterUrl ? normalizeImageUrl(posterUrl) : undefined}
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isHovered && !isSelected ? 0.95 : 1, transition: 'opacity 100ms' }}
            muted
            autoPlay={isHovered}
            loop
            playsInline
            preload="metadata"
          />
        ) : isVideo && (posterUrl || asset.url) ? (
          // 普通资产视频沿用既有封面与视频展示；Seedance 视频已在上方独立停帧展示。
          posterUrl ? (
            <img
              src={normalizeImageUrl(posterUrl)}
              alt=""
              onError={() => {
                if (assetPosterUrl) setFailedPosterUrl(assetPosterUrl);
              }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isHovered && !isSelected ? 0.85 : 1, transition: 'opacity 100ms' }}
            />
          ) : (
            <video
              ref={videoRef}
              src={normalizeImageUrl(asset.url)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isHovered && !isSelected ? 0.85 : 1, transition: 'opacity 100ms' }}
              muted
              playsInline
              preload="auto"
              onLoadedData={(event) => {
                const video = event.currentTarget;
                try {
                  video.currentTime = Math.min(0.05, Number.isFinite(video.duration) ? video.duration : 0.05);
                  video.pause();
                } catch {
                  // 当前帧已经可用时无需继续定位。
                }
              }}
            />
          )
        ) : asset.url ? (
          <img src={normalizeImageUrl(asset.url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isHovered && !isSelected ? 0.85 : 1, transition: 'opacity 100ms' }} />
        ) : asset.type === 'audio' ? (
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M12 26V8l16-3v18" stroke="#FFFFFF26" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="8" cy="26" r="4" stroke="#FFFFFF26" strokeWidth="1.5"/>
            <circle cx="24" cy="23" r="4" stroke="#FFFFFF26" strokeWidth="1.5"/>
          </svg>
        ) : (
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="3" y="6" width="26" height="20" rx="3" stroke="#FFFFFF26" strokeWidth="1.5" />
            <circle cx="11" cy="13" r="2.5" stroke="#FFFFFF26" strokeWidth="1.5" />
            <path d="M4 22L10 15L15 20L20 14L28 22" stroke="#FFFFFF26" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        )}
        {/* 复选框 */}
        <div style={{ position: 'absolute', top: '8px', left: '8px' }}>
          <Checkbox checked={isSelected} hovered={isHovered} disabled={isDisabled} />
        </div>
        {/* 收藏图标（仅创作资产有 starred 字段时显示） */}
        {asset.starred && (
          <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5l1.545 3.13 3.455.503-2.5 2.436.59 3.44L7 9.369l-3.09 1.64.59-3.44L2 5.133l3.455-.503L7 1.5z" fill="#F0B429" stroke="#F0B429" strokeWidth="1.1" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>
      {/* 底部标签 */}
      {!compact && (
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', background: '#1C1C1C', flex: 1 }}>
        <span style={{
          fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%',
        }}>{asset.name || '未命名'}</span>
      </div>
      )}
    </div>
  );
}

function getPickerMediaKey(asset) {
  return getCreationAssetMediaAliases(asset);
}

function dedupePickerAssets(list) {
  return dedupeByMediaAliases(list, getPickerMediaKey, (previous, asset) => ({
      ...previous,
      ...asset,
      id: previous.id || asset.id,
      assetId: previous.assetId || asset.assetId || asset.asset_id || null,
      name: previous.name !== '未命名' ? previous.name : (asset.name || previous.name),
      prompt: previous.prompt || asset.prompt || '',
      input_prompt: previous.input_prompt || asset.input_prompt || '',
      model: previous.model || asset.model || '',
      resolution: previous.resolution || asset.resolution || '',
      ratio: previous.ratio || asset.ratio || '',
      duration: previous.duration ?? asset.duration ?? null,
      reference_images: previous.reference_images || asset.reference_images || null,
      reference_image_urls: previous.reference_image_urls || asset.reference_image_urls || null,
      gen_params: previous.gen_params || asset.gen_params || null,
      generation_params: previous.generation_params || asset.generation_params || null,
      provider_params: previous.provider_params || asset.provider_params || null,
      metadata: { ...(asset.metadata || {}), ...(previous.metadata || {}) },
      metadata_json: previous.metadata_json || asset.metadata_json || null,
      posterUrl: previous.posterUrl || asset.posterUrl || null,
    }));
}

function unwrapLiveMaterialAsset(payload) {
  if (!payload || typeof payload !== 'object') return {};
  return payload.asset || payload.data || payload.result || payload;
}

function normalizeSeedanceMediaUrl(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim()
    .replace(/\\\//g, '/')
    .replace(/\\&/g, '&')
    .replace(/\\_/g, '_');
  const urlMatch = trimmed.match(/https?:\/\/[^\s)\]]+/i);
  const url = (urlMatch ? urlMatch[0] : trimmed).replace(/[),]+$/, '');
  if (url.startsWith('asset://')) return null;
  return normalizeImageUrl(url);
}

/**
 * Seedance 的 asset_ref_url 仅用于提交给服务商，不能作为图片地址。
 * 选择器保留两类地址，防止后续持久化时把 asset:// 写入浏览器展示字段。
 */
function toSeedancePickerAsset(rawAsset, group = {}) {
  const asset = unwrapLiveMaterialAsset(rawAsset);
  const rawAssetType = String(asset.asset_type || asset.assetType || asset.type || 'image').toLowerCase();
  const isVideo = rawAssetType.startsWith('video');
  const rawPreviewUrl = asset.preview_url || asset.previewUrl || null;
  const sourceUrl = asset.download_url
    || asset.downloadUrl
    || asset.original_url
    || asset.originalUrl
    || asset.source_url
    || asset.sourceUrl
    || null;
  const fileUrl = asset.file_url || asset.fileUrl || null;
  const explicitPosterUrl = asset.poster_url
    || asset.posterUrl
    || asset.thumbnail_url
    || asset.thumbnailUrl
    || asset.cover_url
    || asset.coverUrl
    || asset.first_frame_url
    || asset.firstFrameUrl
    || asset.image_url
    || asset.imageUrl
    || asset.media_url
    || asset.mediaUrl
    || asset.avatar_url
    || asset.avatarUrl
    || null;
  // 虚拟人像有时会返回“有值但不可展示”的 asset:// preview_url，不能先按原始字符串选中它，
  // 必须逐个归一化后再取第一个可访问地址，否则会把后面的 source_url 一起挡掉。
  const normalizeFirstMediaUrl = (...values) => values.map(normalizeSeedanceMediaUrl).find(Boolean) || null;
  const normalizedPreviewUrl = normalizeFirstMediaUrl(rawPreviewUrl, sourceUrl, fileUrl);
  const normalizedSourceUrl = normalizeFirstMediaUrl(sourceUrl, fileUrl, rawPreviewUrl);
  const isAigcMaterial = String(group.group_type || asset.group_type || '').toUpperCase() === 'AIGC';
  const normalizedMediaUrl = isVideo
    ? normalizeFirstMediaUrl(sourceUrl, fileUrl, rawPreviewUrl)
    : normalizeFirstMediaUrl(...(isAigcMaterial
      ? [sourceUrl, fileUrl, rawPreviewUrl]
      : [rawPreviewUrl, sourceUrl, fileUrl]));
  const normalizedExplicitPosterUrl = normalizeFirstMediaUrl(explicitPosterUrl);
  const normalizedPosterUrl = normalizedExplicitPosterUrl
    || (isVideo && normalizedPreviewUrl !== normalizedMediaUrl ? normalizedPreviewUrl : null);

  return {
    id: asset.id,
    name: asset.name || group.name || '未命名',
    url: normalizedMediaUrl,
    // fileUrl 必须是可展示/下载的真实媒体地址，不能复用 asset:// 服务商引用。
    fullUrl: normalizedSourceUrl || normalizedPreviewUrl,
    fileUrl: normalizedSourceUrl || normalizedPreviewUrl,
    asset_type: isVideo ? 'video' : rawAssetType,
    posterUrl: normalizedPosterUrl,
    isLiveMaterial: String(group.group_type || asset.group_type || '').toUpperCase() !== 'AIGC',
    isAigcMaterial,
    isSeedanceCertifiedMaterial: true,
    groupId: asset.group_id || asset.groupId || group.id,
    groupType: group.group_type || asset.group_type || asset.groupType || 'LivenessFace',
    assetRefUrl: asset.asset_ref_url || asset.assetRefUrl || null,
    previewUrl: normalizedPreviewUrl,
    sourceUrl: normalizedSourceUrl,
    status: asset.status || 'active',
    error_message: asset.error_message || null,
    isSeedanceMaterial: true,
    bgColor: '#252525',
  };
}

function EmptyState() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="16" fill="#FFFFFF05" />
        <path d="M22 42C22 38.686 24.686 36 28 36H46L52 42H72C75.314 42 78 44.686 78 48V68C78 71.314 75.314 74 72 74H28C24.686 74 22 71.314 22 68V42Z" fill="#FFFFFF0A" stroke="#FFFFFF1A" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="34" y="50" width="32" height="16" rx="3" fill="#FFFFFF0D" stroke="#FFFFFF14" strokeWidth="1" />
        <path d="M34 66L42 56L48 62L54 55L66 66" stroke="#FFFFFF26" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="60" cy="54" r="2.5" stroke="#FFFFFF26" strokeWidth="1.5" />
      </svg>
      <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '20px', color: '#FFFFFF40' }}>资产库暂无资产</span>
    </div>
  );
}

function LoadingState() {
  return (
    <div role="status" aria-label="正在加载资产" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <DotsLoading size={6} color="#2DC3E1" gap={4} />
    </div>
  );
}

function AssetHoverPreview({ url, mouseX, mouseY }) {
  const [imgSize, setImgSize] = useState(null);
  const GAP = 16;

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }, [url]);

  if (!imgSize) return null;

  const maxW = window.innerWidth * 0.35;
  const maxH = window.innerHeight * 0.35;
  const ratio = imgSize.w / imgSize.h;

  let previewW;
  let previewH;
  if (ratio >= 1) {
    previewW = maxW;
    previewH = previewW / ratio;
    if (previewH > maxH) { previewH = maxH; previewW = previewH * ratio; }
  } else {
    previewH = maxH;
    previewW = previewH * ratio;
    if (previewW > maxW) { previewW = maxW; previewH = previewW / ratio; }
  }

  let left = mouseX + GAP;
  let top = mouseY + GAP;
  if (left + previewW > window.innerWidth - GAP) left = mouseX - previewW - GAP;
  if (top + previewH > window.innerHeight - GAP) top = mouseY - previewH - GAP;
  left = Math.max(GAP, left);
  top = Math.max(GAP, top);

  return (
    <div
      style={{
        position: 'fixed', left, top,
        width: previewW, height: previewH,
        zIndex: 99999, pointerEvents: 'none',
        borderRadius: '8px', overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        border: '1px solid rgba(255,255,255,0.12)',
        backgroundColor: '#111',
      }}
    >
      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );
}

export default function AssetPickerModal({
  open,
  onClose,
  onConfirm,
  // accept: 'image' | 'video' | 'all'  控制可选资产类型
  accept = 'all',
  // projectId: 当前项目 ID，传入后会从后端拉取真实项目列表和资产数据
  projectId = null,
  // creativeAssets: { images: [], videos: [], dubbing: [] }  创作资产；未传时从 store 读取
  creativeAssets: creativeAssetsProp = null,
  // preSelectedIds: string[]  已存在的资产ID，打开时默认选中且不可取消
  preSelectedIds = [],
  // preSelectedUrls: string[]  已存在资产的图片URL，打开时默认选中且不可取消（用于跨ID来源匹配，如主体参考图）
  preSelectedUrls = [],
  // preSelectedSubjectIds: string[]  已存在资产对应的主体ID，打开时默认选中且不可取消（最可靠的跨来源匹配键）
  preSelectedSubjectIds = [],
  // excludedAssetIds: string[]  已被当前业务复制/占用的源资产 ID，不展示为可选项
  excludedAssetIds = [],
  // excludedAssetUrls: string[]  后端暂未返回源资产 ID 时，按媒体地址兜底禁选
  excludedAssetUrls = [],
  model = '',
}) {
  const generationsByTab = useCreationStore((s) => s.generationsByTab);
  const favorites = useCreationStore((s) => s.favorites);

  // 创作资产本地缓存（弹窗内懒加载，避免依赖 CreationPage 初始化）
  const [localCreativeAssets, setLocalCreativeAssets] = useState(null);
  const [creativePagination, setCreativePagination] = useState(createCreativePagination);
  const creativeRequestedPagesRef = useRef(new Set());
  const creativeSessionRef = useRef(0);
  const [seedanceGroups, setSeedanceGroups] = useState([]);
  const [seedanceAssets, setSeedanceAssets] = useState([]);
  const [seedanceLoading, setSeedanceLoading] = useState(false);
  const [activeSeedanceGroup, setActiveSeedanceGroup] = useState(null);
  const [seedanceSubTab, setSeedanceSubTab] = useState('real');
  const showSeedanceTab = isSeedanceModel(model);

  // 将后端历史记录条目归一化为 picker 卡片格式
  function normalizeCreativeItem(item, type) {
    const parseObject = (value) => {
      if (!value) return {};
      if (typeof value === 'object' && !Array.isArray(value)) return value;
      if (typeof value !== 'string') return {};
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    };
    const rawMetadata = item?.metadata_json ?? item?.metadataJson ?? item?.metadata ?? {};
    const metadata = parseObject(rawMetadata);
    const parameterContainers = [
      item?.params, item?.parameters, item?.generation, item?.options,
      item?.gen_params, item?.genParams, item?.generation_params, item?.generationParams,
      item?.provider_params, item?.providerParams,
      metadata?.params, metadata?.parameters, metadata?.generation, metadata?.options,
      metadata?.gen_params, metadata?.genParams, metadata?.generation_params, metadata?.generationParams,
      metadata?.provider_params, metadata?.providerParams,
    ].map(parseObject).filter((value) => Object.keys(value).length > 0);
    const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');
    const directGenerationParams = {
      expand_options: item?.expand_options ?? item?.expandOptions ?? metadata?.expand_options ?? metadata?.expandOptions,
      subject_completion_options: item?.subject_completion_options ?? item?.subjectCompletionOptions ?? metadata?.subject_completion_options ?? metadata?.subjectCompletionOptions,
      optimize_prompt: item?.optimize_prompt ?? item?.optimizePrompt ?? metadata?.optimize_prompt ?? metadata?.optimizePrompt,
      sequential_image_generation: item?.sequential_image_generation ?? item?.sequentialImageGeneration ?? metadata?.sequential_image_generation ?? metadata?.sequentialImageGeneration,
      provider_params: item?.provider_params ?? item?.providerParams ?? metadata?.provider_params ?? metadata?.providerParams,
    };
    const mergedParams = Object.assign({}, ...parameterContainers, directGenerationParams);
    const generationParams = Object.keys(mergedParams).length > 0 ? mergedParams : null;
    // 视频优先取 video_url，图片/音频取 original_url/file_url
    const rawUrl = type === 'video'
      ? (item.video_url || item.videoUrl || item.preview_video_url || item.previewVideoUrl || item.original_url || item.file_url || item.url || item.thumbnail_url || item.thumbnailUrl || item.thumbnail || '')
      : type === 'audio'
        ? (item.audio_url || item.audioUrl || item.original_url || item.file_url || item.url || item.preview_url || item.previewUrl || '')
        : (item.original_url || item.file_url || item.url || item.thumbnail_url || item.thumbnailUrl || '');
    const url = normalizeImageUrl(rawUrl) || null;

    // 视频封面：poster_url / thumbnail_url，用于静态预览
    const posterUrl = type === 'video'
      ? (normalizeImageUrl(item.poster_url || item.posterUrl || item.thumbnail_url || item.thumbnailUrl || item.cover_url || item.coverUrl || item.first_frame_url || item.firstFrameUrl || item.preview_url || item.previewUrl || item.image_url || item.imageUrl || item.thumbnail || '') || null)
      : null;

    return {
      // 先保留创作接口的完整字段，详情面板需要使用这些原始生成信息。
      ...item,
      id: item.id,
      assetId: item.assetId || item.asset_id || item.image?.asset_id || item.image?.assetId || null,
      backendId: item.backendId || null,
      name: item.name || item.prompt?.slice(0, 20) || '未命名',
      // AssetCard 渲染视频时优先用 posterUrl（封面图），无封面时 url 传视频地址让 <video> 加载
      url,
      posterUrl,
      // 悬浮预览大图用 fullUrl（视频类型可以用 poster）
      fullUrl: type === 'video' ? (posterUrl || url || item.thumbnail_url || item.thumbnailUrl || '') : url,
      fileUrl: url,
      asset_type: type,
      starred: item.is_favorite ?? item.is_liked ?? item.isLiked ?? false,
      bgColor: '#252525',
      prompt: firstValue(item.prompt, item.prompt_resolved, item.promptResolved, item.input_prompt, item.inputPrompt, item.prompt_raw, item.promptRaw, metadata.prompt, metadata.prompt_resolved, metadata.promptResolved, metadata.input_prompt, metadata.inputPrompt, metadata.prompt_raw, metadata.promptRaw, mergedParams.prompt, mergedParams.input_prompt, mergedParams.inputPrompt) || '',
      input_prompt: firstValue(item.input_prompt, item.inputPrompt, item.prompt_raw, item.promptRaw, item.prompt, item.prompt_resolved, item.promptResolved, metadata.input_prompt, metadata.inputPrompt, metadata.prompt_raw, metadata.promptRaw, metadata.prompt, metadata.prompt_resolved, metadata.promptResolved, mergedParams.input_prompt, mergedParams.inputPrompt, mergedParams.prompt) || '',
      prompt_raw: firstValue(item.prompt_raw, item.promptRaw, metadata.prompt_raw, metadata.promptRaw, mergedParams.prompt_raw, mergedParams.promptRaw) || '',
      prompt_resolved: firstValue(item.prompt_resolved, item.promptResolved, metadata.prompt_resolved, metadata.promptResolved, mergedParams.prompt_resolved, mergedParams.promptResolved) || '',
      model: firstValue(item.model, metadata.model, mergedParams.model) || '',
      resolution: firstValue(item.resolution, item.size, metadata.resolution, metadata.size, mergedParams.resolution, mergedParams.size) || '',
      ratio: firstValue(item.ratio, item.aspect_ratio, item.aspectRatio, metadata.ratio, metadata.aspect_ratio, metadata.aspectRatio, mergedParams.ratio, mergedParams.aspect_ratio, mergedParams.aspectRatio) || '',
      duration: firstValue(item.duration, metadata.duration, mergedParams.duration) ?? null,
      reference_images: firstValue(item.reference_images, item.referenceImages, metadata.reference_images, metadata.referenceImages, mergedParams.reference_images, mergedParams.referenceImages) || null,
      reference_image_urls: firstValue(item.reference_image_urls, item.referenceImageUrls, metadata.reference_image_urls, metadata.referenceImageUrls, mergedParams.reference_image_urls, mergedParams.referenceImageUrls) || null,
      gen_params: generationParams || null,
      generation_params: generationParams || null,
      provider_params: firstValue(item.provider_params, item.providerParams, metadata.provider_params, metadata.providerParams) || null,
      metadata_json: item.metadata_json ?? (Object.keys(metadata).length > 0 ? metadata : null),
      metadata: { ...metadata, params: mergedParams },
      source: item.source ?? item.source_type ?? item.sourceType ?? 'ai-generated',
      source_type: item.source_type ?? item.sourceType ?? null,
    };
  }

  const creativeAssets = useMemo(() => {
    if (creativeAssetsProp) {
      return {
        images: dedupePickerAssets(creativeAssetsProp.images),
        videos: dedupePickerAssets(creativeAssetsProp.videos),
        dubbing: dedupePickerAssets(creativeAssetsProp.dubbing),
      };
    }
    // 优先使用弹窗内加载的数据；如果还没加载，降级到 store 数据
    if (localCreativeAssets) {
      return {
        images: dedupePickerAssets(localCreativeAssets.images),
        videos: dedupePickerAssets(localCreativeAssets.videos),
        dubbing: dedupePickerAssets(localCreativeAssets.dubbing),
      };
    }

    // 从 store 转换数据格式（store 由 CreationPage 初始化，可能为空）
    return {
      images: dedupePickerAssets(generationsToFlatList(generationsByTab.image || [], favorites).map(item => ({
        ...item,
        bgColor: item.bgColor || '#1F2324',
      })).filter((item) => !!item.url)),
      videos: dedupePickerAssets(generationsToFlatList(generationsByTab.video || [], favorites).map(item => ({
        ...item,
        // url = 视频地址（给 <video> 标签），posterUrl = 封面图片（给 <img> 标签）
        url: item.videoUrl || item.video_url || item.posterUrl || item.url || null,
        // 封面图可能来自 store 卡片本身的缩略图字段，也可能来自 generationsToFlatList 提取的 imageUrl/poster
        posterUrl: item.thumbnail_url || item.thumbnailUrl || item.thumbnail || item.image_url || item.imageUrl || item.url || item.poster || null,
        asset_type: 'video',
        bgColor: item.bgColor || '#1F2324',
      })).filter((item) => !!(item.url || item.posterUrl))),
      dubbing: dedupePickerAssets(generationsToFlatList(generationsByTab.dubbing || [], favorites).map(item => ({
        ...item,
        bgColor: item.bgColor || '#1F2324',
        type: 'audio',
      }))),
    };
  }, [creativeAssetsProp, localCreativeAssets, generationsByTab, favorites]);

  const projectSubTabsAvail = useMemo(
    () => accept === 'video' ? PROJECT_SUB_TABS_VIDEO : accept === 'image' ? PROJECT_SUB_TABS_IMAGE : accept === 'media' ? PROJECT_SUB_TABS_MEDIA : accept === 'audio' ? PROJECT_SUB_TABS_AUDIO : PROJECT_SUB_TABS_ALL,
    [accept],
  );
  const creativeSubTabsAvail = useMemo(
    () => accept === 'video' ? CREATIVE_SUB_TABS_VIDEO : accept === 'image' ? CREATIVE_SUB_TABS_IMAGE : accept === 'media' ? CREATIVE_SUB_TABS_MEDIA : accept === 'audio' ? CREATIVE_SUB_TABS_AUDIO : CREATIVE_SUB_TABS_ALL,
    [accept],
  );

  const [activeTab, setActiveTab] = useState('project');
  const [projectSubTab, setProjectSubTab] = useState(projectSubTabsAvail[0]);
  const [creativeSubTab, setCreativeSubTab] = useState(creativeSubTabsAvail[0]);
  const [favOnly, setFavOnly] = useState(false);
  const [finalOnly, setFinalOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    if (!showSeedanceTab && activeTab === 'seedance') {
      // 模型切换到非 Seedance 时清理当前不可用的业务 Tab。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab('project');
      setActiveSeedanceGroup(null);
      setSeedanceSubTab('real');
    }
  }, [showSeedanceTab, activeTab]);
  // 调用方常以内联 map 传入预选 ID；用值签名作为依赖，避免每次渲染都重置选择并形成更新循环。
  const preSelectedIdsKey = JSON.stringify(preSelectedIds ?? []);
  const preSelectedSet = new Set((preSelectedIds ?? []).filter((id) => id != null).map((id) => String(id)));
  const excludedAssetSet = new Set((excludedAssetIds ?? []).filter((id) => id != null).map((id) => String(id)));
  const excludedAssetUrlSet = useMemo(
    () => new Set((excludedAssetUrls ?? []).flatMap((url) => getCreationAssetMediaAliases({ url })).filter(Boolean)),
    [excludedAssetUrls],
  );
  // 主体ID集合（最可靠的跨来源匹配键：主体参考图与资产库为不同记录ID，但同属一个 subject_id）
  const preSelectedSubjectSet = useMemo(
    () => new Set((preSelectedSubjectIds ?? []).filter(Boolean)),
    [preSelectedSubjectIds]
  );
  // 预选URL → 文件名集合（兜底匹配：缩略图/原图协议或host不同，但文件名一致）
  const urlKey = (u) => {
    const n = normalizeImageUrl(u);
    if (!n) return null;
    // 取 path 最后一段（去掉 query），归一化协议/host/缩略图前缀差异
    const noQuery = n.split('?')[0].split('#')[0];
    const seg = noQuery.split('/').filter(Boolean).pop() || null;
    return seg;
  };
  const preSelectedUrlSet = useMemo(
    () => new Set((preSelectedUrls ?? []).map(urlKey).filter(Boolean)),
    [preSelectedUrls]
  );

  // 判断某张资产卡片是否为预选（不可取消）：subject_id 命中 / ID 命中 / URL文件名 命中
  const isPreSelected = (asset) => {
    if (!asset) return false;
    const assetIds = [asset.id, asset.assetId, asset.asset_id].filter((id) => id != null).map((id) => String(id));
    if (assetIds.some((id) => preSelectedSet.has(id))) return true;
    if (asset.subject_id && preSelectedSubjectSet.has(asset.subject_id)) return true;
    const k1 = urlKey(asset.url);
    if (k1 && preSelectedUrlSet.has(k1)) return true;
    const k2 = urlKey(asset.fileUrl);
    if (k2 && preSelectedUrlSet.has(k2)) return true;
    return false;
  };

  // 已复制到当前主体的源资产仍展示，但不可再次选择。
  const isExcludedAsset = (asset) => {
    if (!asset) return false;
    const assetIds = [asset.assetId, asset.asset_id, asset.id]
      .filter((id) => id != null)
      .map((id) => String(id));
    if (assetIds.some((id) => excludedAssetSet.has(id))) return true;
    return getCreationAssetMediaAliases(asset).some((url) => excludedAssetUrlSet.has(url));
  };

  // 每次弹窗打开时用 preSelectedIds 初始化选中状态；关闭时清空本次会话的全部临时操作。
  useEffect(() => {
    if (open) {
      // 弹窗打开时从外部预选数据恢复本地选择；这里不是派生渲染状态。
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 弹窗会话开始时同步外部预选项
      setSelected(new Set(JSON.parse(preSelectedIdsKey)));
    } else {
      // 关闭弹窗时清理临时选择和懒加载缓存，避免下次打开复用旧会话。
      setSelected(new Set());
      // 关闭时重置创作资产本地缓存，下次打开重新加载
      creativeSessionRef.current += 1;
      creativeRequestedPagesRef.current.clear();
      setLocalCreativeAssets(null);
      setCreativePagination(createCreativePagination());
      setLoadingCreativeTabs(new Set());
      setLoadingTabKeys(new Set());
      setSeedanceGroups([]);
      setSeedanceAssets([]);
      setActiveSeedanceGroup(null);
      setActiveTab('project');
      setProjectSubTab(projectSubTabsAvail[0]);
      setCreativeSubTab(creativeSubTabsAvail[0]);
      setFavOnly(false);
      setFinalOnly(true);
      setSearch('');
      setSearchFocused(false);
      setHoveredCard(null);
      setPreviewImage(null);
      setMousePos({ x: 0, y: 0 });
      clearTimeout(hoverTimerRef.current);
      setProjectOpen(false);
      setProjectHovIdx(null);
      setProjectMenuRect(null);
      setActiveProjectId(projectId || null);
      setSeedanceSubTab('real');
      setCloseHovered(false);
      setCancelHovered(false);
      setCancelPressed(false);
      setConfirmHovered(false);
      setConfirmPressed(false);
      setConfirming(false);
      setFavHovered(false);
      setFinalHovered(false);
    }
  }, [open, preSelectedIdsKey, projectId, projectSubTabsAvail, creativeSubTabsAvail]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [closeHovered, setCloseHovered] = useState(false);
  const [previewImage, setPreviewImage] = useState(null); // { url, x, y }
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const hoverTimerRef = useRef(null);
  const [cancelHovered, setCancelHovered] = useState(false);
  const [cancelPressed, setCancelPressed] = useState(false);
  const [confirmHovered, setConfirmHovered] = useState(false);
  const [confirmPressed, setConfirmPressed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [favHovered, setFavHovered] = useState(false);
  const [finalHovered, setFinalHovered] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectHovIdx, setProjectHovIdx] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(projectId || null);
  const [projectMenuRect, setProjectMenuRect] = useState(null);
  const projectBtnRef = useRef(null);

  useEffect(() => {
    if (!open || !showSeedanceTab || activeTab !== 'seedance') return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeedanceLoading(true);
    apiListLiveMaterialGroups()
      .then(async (groups) => {
        if (cancelled) return;
        const normalizedGroups = Array.isArray(groups) ? groups : [];
        const groupsWithPreviews = await Promise.all(normalizedGroups.map(async (group) => {
          try {
            const assets = await apiListLiveMaterialAssets(group.id);
            return {
              ...group,
              images: (Array.isArray(assets) ? assets : []).slice(0, 2).map((asset) => {
                const rawAssetType = String(asset.asset_type || asset.assetType || asset.type || 'image').toLowerCase();
                const assetType = rawAssetType.startsWith('video/') ? 'video' : rawAssetType;
                const posterUrl = normalizeImageUrl(asset.poster_url || asset.posterUrl || asset.thumbnail_url || asset.thumbnailUrl || asset.cover_url || asset.coverUrl || asset.first_frame_url || asset.firstFrameUrl || '') || null;
                const mediaUrl = normalizeImageUrl(assetType === 'video'
                  ? (asset.source_url || asset.sourceUrl || asset.file_url || asset.fileUrl || asset.preview_url || asset.previewUrl || '')
                  : (asset.source_url || asset.sourceUrl || asset.file_url || asset.fileUrl || asset.preview_url || asset.previewUrl || '')) || null;
                if (!mediaUrl && !posterUrl) return null;
                return assetType === 'video'
                  ? { url: mediaUrl, type: 'video', posterUrl }
                  : { url: posterUrl || mediaUrl, type: assetType, posterUrl };
              }).filter(Boolean),
            };
          } catch {
            return { ...group, images: [] };
          }
        }));
        if (!cancelled) setSeedanceGroups(groupsWithPreviews);
      })
      .catch((error) => {
        if (!cancelled) console.error('[AssetPickerModal] 拉取Seedance素材组失败:', error);
      })
      .finally(() => {
        if (!cancelled) setSeedanceLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, activeTab, showSeedanceTab]);

  useEffect(() => {
    if (!activeSeedanceGroup) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSeedanceAssets([]);
      return undefined;
    }
    let cancelled = false;
    setSeedanceLoading(true);
    apiListLiveMaterialAssets(activeSeedanceGroup.id)
      .then((assets) => {
        if (cancelled) return;
        setSeedanceAssets((Array.isArray(assets) ? assets : []).map((asset) => (
          toSeedancePickerAsset(asset, activeSeedanceGroup)
        )));
      })
      .catch((error) => {
        if (!cancelled) console.error('[AssetPickerModal] 拉取Seedance素材失败:', error);
      })
      .finally(() => {
        if (!cancelled) setSeedanceLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeSeedanceGroup]);

  // ── 从后端拉取真实数据 ──────────────────────────────────────────────────
  const [apiProjects, setApiProjects] = useState(null);
  const [apiAssetsMap, setApiAssetsMap] = useState(null);
  // 已加载完成的 tab key 集合：key = `${projectId}__${tabKey}`
  const [loadedTabKeys, setLoadedTabKeys] = useState(new Set());
  const [loadingTabKeys, setLoadingTabKeys] = useState(new Set());
  const [loadingCreativeTabs, setLoadingCreativeTabs] = useState(new Set());

  useEffect(() => {
    const handleSubjectDeleted = (event) => {
      const detail = event.detail || {};
      const deletedSubjectId = detail.subjectId;
      if (!deletedSubjectId || (detail.projectId && projectId && detail.projectId !== projectId)) return;
      const subjectId = String(deletedSubjectId);
      const targetProjectId = detail.projectId || projectId;
      setApiAssetsMap((prev) => Object.fromEntries(Object.entries(prev || {}).map(([pid, tabs]) => [
        pid,
        pid !== targetProjectId
          ? tabs
          : Object.fromEntries(Object.entries(tabs || {}).map(([tab, assets]) => [
            tab,
            (assets || []).filter((asset) => String(asset?.subject_id ?? asset?.subjectId ?? '') !== subjectId),
          ])),
      ])));
      setLoadedTabKeys((prev) => {
        const next = new Set(prev);
        if (targetProjectId) {
          ['chars', 'scenes', 'props'].forEach((tab) => next.delete(pickerTabKey(targetProjectId, tab)));
        }
        return next;
      });
    };
    window.addEventListener('subject:deleted', handleSubjectDeleted);
    return () => window.removeEventListener('subject:deleted', handleSubjectDeleted);
  }, [projectId]);

  useEffect(() => {
    const handleAssetsDeleted = (event) => {
      const detail = event.detail || {};
      if (detail.projectId && projectId && detail.projectId !== projectId) return;
      const deletedIds = new Set((detail.assetIds || []).map((id) => String(id)));
      if (deletedIds.size === 0) return;
      const targetProjectId = detail.projectId || projectId;
      setApiAssetsMap((prev) => Object.fromEntries(Object.entries(prev || {}).map(([pid, tabs]) => [
        pid,
        pid !== targetProjectId
          ? tabs
          : Object.fromEntries(Object.entries(tabs || {}).map(([tab, assets]) => [
            tab,
            (assets || []).filter((asset) => !deletedIds.has(String(asset?.id ?? asset?.asset_id ?? ''))),
          ])),
      ])));
      setLoadedTabKeys((prev) => {
        const next = new Set(prev);
        if (targetProjectId) {
          ['chars', 'scenes', 'props', 'storyboard', 'audio', 'final'].forEach((tab) => next.delete(pickerTabKey(targetProjectId, tab)));
        }
        return next;
      });
    };
    window.addEventListener('project-assets:deleted', handleAssetsDeleted);
    return () => window.removeEventListener('project-assets:deleted', handleAssetsDeleted);
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        // 拉取所有项目列表
        const projList = await apiGetProjects();
        const projs = Array.isArray(projList) ? [...projList].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)).map(p => ({ id: p.id, name: p.name })) : [];
        setApiProjects(projs);
      } catch (err) {
        console.error('[AssetPickerModal] 拉取项目列表失败:', err);
        setApiProjects([]);
      }
    })();
  }, [open]);

  const pickerTabKey = (pid, tabKey) => `${pid}__${tabKey}`;

  function normalizePickerAsset(a) {
    const metadata = typeof a.metadata_json === 'string'
      ? (() => { try { return JSON.parse(a.metadata_json) || {}; } catch { return {}; } })()
      : (a.metadata_json || a.metadata || {});
    const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');
    return {
      // 保留资产接口的原始字段，避免资产库选择后丢失生成参数、参考素材和来源信息。
      ...a,
      id: a.id,
      name: a.name || '未命名',
      // 卡片使用缩略图快速展示；选择资产时通过 fileUrl 下载原图，避免将 AVIF 缩略图当作上传文件。
      url: normalizeImageUrl(a.thumbnail_url || a.thumbnailUrl || a.preview_url || a.previewUrl || a.file_url || a.fileUrl) || null,
      fullUrl: normalizeImageUrl(a.download_url || a.downloadUrl || a.original_url || a.originalUrl || a.large_url || a.largeUrl || a.file_url || a.fileUrl) || null,
      fileUrl: normalizeImageUrl(a.download_url || a.downloadUrl || a.original_url || a.originalUrl || a.large_url || a.largeUrl || a.file_url || a.fileUrl) || null,
      posterUrl: a.asset_type === 'video'
        ? (normalizeImageUrl(a.poster_url || a.posterUrl || a.thumbnail_url || a.thumbnailUrl || a.cover_url || a.coverUrl || a.first_frame_url || a.firstFrameUrl || '') || null)
        : null,
      subject_id: a.subject_id ?? null,
      starred: a.is_starred ?? false,
      is_primary: a.is_primary
        ?? a.isPrimary
        ?? a.is_finalized
        ?? a.isFinalized
        ?? a.finalized
        ?? false,
      bgColor: '#252525',
      category: a.category,
      asset_type: a.asset_type,
      prompt: firstValue(a.prompt, a.input_prompt, a.inputPrompt, metadata.prompt, metadata.input_prompt, metadata.inputPrompt) || '',
      input_prompt: firstValue(a.input_prompt, a.inputPrompt, a.prompt, metadata.input_prompt, metadata.inputPrompt, metadata.prompt) || '',
      model: firstValue(a.model, metadata.model) || '',
      ratio: firstValue(a.ratio, a.aspect_ratio, a.aspectRatio, metadata.ratio, metadata.aspect_ratio, metadata.aspectRatio) || '',
      resolution: firstValue(a.resolution, a.size, metadata.resolution, metadata.size) || '',
      duration: firstValue(a.duration, metadata.duration) ?? null,
      gen_params: firstValue(a.gen_params, a.genParams, a.generation_params, a.generationParams, metadata.gen_params, metadata.genParams, metadata.generation_params, metadata.generationParams) || null,
      generation_params: firstValue(a.generation_params, a.generationParams, a.gen_params, a.genParams, metadata.generation_params, metadata.generationParams, metadata.gen_params, metadata.genParams) || null,
      provider_params: firstValue(a.provider_params, a.providerParams, metadata.provider_params, metadata.providerParams) || null,
      reference_images: firstValue(a.reference_images, a.referenceImages, metadata.reference_images, metadata.referenceImages) || null,
      reference_image_urls: firstValue(a.reference_image_urls, a.referenceImageUrls, metadata.reference_image_urls, metadata.referenceImageUrls) || null,
      created_at: a.created_at ?? '',
      source: a.source ?? null,
      source_type: a.source_type ?? null,
      metadata_json: a.metadata_json ?? (Object.keys(metadata).length > 0 ? metadata : null),
      metadata,
    };
  }

  // 切换 Tab 时一次性拉取该 Tab 的全部数据（循环翻页直到 hasMore=false）
  useEffect(() => {
    if (!open || activeTab !== 'project') return;
    const pullProjectId = activeProjectId || projectId;
    if (!pullProjectId) return;

    const tabKey = SUB_TAB_KEY_MAP[projectSubTab];
    const pKey = pickerTabKey(pullProjectId, tabKey);
    // 已加载过该分类，跳过
    if (loadedTabKeys.has(pKey)) return;

    const categoryFilter = SUB_TAB_CATEGORY_MAP[projectSubTab];
    if (!categoryFilter) return;

    setLoadingTabKeys(prev => new Set([...prev, pKey]));

    (async () => {
      try {
        const categories = Array.isArray(categoryFilter.category) ? categoryFilter.category : [categoryFilter.category];
        const configuredAssetTypes = categoryFilter.asset_type
          ? (Array.isArray(categoryFilter.asset_type) ? categoryFilter.asset_type : [categoryFilter.asset_type])
          : [undefined];
        const acceptedAssetTypes = accept === 'image'
          ? ['image']
          : accept === 'video'
            ? ['video']
            : configuredAssetTypes;
        const allItems = [];

        for (const cat of categories) {
          for (const assetType of acceptedAssetTypes) {
            let cursor = undefined;
            let hasMore = true;

            while (hasMore) {
              const page = await apiGetAssetsPage({
                project_id: pullProjectId,
                scope: 'project',
                limit: 100,
                cursor,
                category: cat,
                ...(assetType ? { asset_type: assetType } : {}),
              });
              allItems.push(...page.list);
              hasMore = page.hasMore;
              cursor = page.nextCursor;
              if (!cursor) break;
            }
          }
        }

        // 分镜 Tab 需要用分镜板数据交叉比对，补全 is_primary / ratio 字段。
        // storyboard/reference 两类接口可能返回同一媒体，合并前按媒体地址去重。
        const isStoryboardTab = tabKey === 'storyboard';
        const enriched = await enrichWithStoryboards(pullProjectId, allItems, isStoryboardTab);
        // 主体分类只展示仍绑定主体的资产。主体删除时，创作资产可能按既有规则
        // 保留但解除 subject_id；这类资产不能再冒充已存在的角色/场景/道具。
        const subjectCategoryTabs = new Set(['chars', 'scenes', 'props']);
        const normalized = dedupePickerAssets(enriched
          .map(normalizePickerAsset)
          .filter((asset) => !subjectCategoryTabs.has(tabKey) || Boolean(asset.subject_id)));
        setApiAssetsMap(prev => ({
          ...prev,
          [pullProjectId]: { ...(prev?.[pullProjectId] ?? {}), [tabKey]: normalized },
        }));
        setLoadedTabKeys(prev => new Set([...prev, pKey]));
      } catch (err) {
        console.error('[AssetPickerModal] 拉取项目资产失败:', err);
      } finally {
        setLoadingTabKeys(prev => {
          const next = new Set(prev);
          next.delete(pKey);
          return next;
        });
      }
    })();
  }, [open, activeTab, accept, projectId, activeProjectId, projectSubTab, loadedTabKeys]);

  // 创作资产按类型独立分页。页码在请求发出前写入 ref，避免 effect、滚动事件或
  // React 严格模式重复触发同一页，尤其保证第一页在一次弹窗会话中只请求一次。
  const loadCreativePage = async (type) => {
    if (!type || creativeAssetsProp) return;
    const pageMeta = creativePagination[type];
    if (!pageMeta?.hasMore) return;

    const page = pageMeta.nextPage;
    const requestKey = `${type}:${page}`;
    if (creativeRequestedPagesRef.current.has(requestKey)) return;
    creativeRequestedPagesRef.current.add(requestKey);

    const requestSession = creativeSessionRef.current;
    setLoadingCreativeTabs(prev => new Set([...prev, type]));

    try {
      const listApi = type === 'image'
        ? apiListCreationImages
        : type === 'video'
          ? apiListCreationVideos
          : apiListCreationAudios;
      const resp = await listApi({ page, page_size: CREATIVE_PAGE_SIZE });
      if (requestSession !== creativeSessionRef.current) return;

      const list = Array.isArray(resp) ? resp : (resp?.list ?? resp?.items ?? resp?.data ?? []);
      const normalized = list
        .map(item => normalizeCreativeItem(item, type === 'audio' ? 'audio' : type))
        .filter(item => type === 'audio' || !!(item.url || item.posterUrl));
      const assetKey = type === 'audio' ? 'dubbing' : type === 'video' ? 'videos' : 'images';

      setLocalCreativeAssets(prev => ({
        images: prev?.images ?? [],
        videos: prev?.videos ?? [],
        dubbing: prev?.dubbing ?? [],
        [assetKey]: dedupePickerAssets([...(prev?.[assetKey] ?? []), ...normalized]),
      }));

      const total = Number(resp?.total ?? resp?.count);
      const explicitHasMore = resp?.has_more ?? resp?.hasMore;
      const hasMore = explicitHasMore !== undefined
        ? Boolean(explicitHasMore)
        : Number.isFinite(total)
          ? page * CREATIVE_PAGE_SIZE < total
          : list.length >= CREATIVE_PAGE_SIZE;
      setCreativePagination(prev => ({
        ...prev,
        [type]: { nextPage: page + 1, hasMore: hasMore && list.length > 0, loaded: true },
      }));
    } catch (err) {
      console.error('[AssetPickerModal] 拉取创作资产失败:', err);
      if (requestSession === creativeSessionRef.current) {
        setCreativePagination(prev => ({
          ...prev,
          [type]: { ...prev[type], hasMore: false, loaded: true },
        }));
      }
    } finally {
      if (requestSession === creativeSessionRef.current) {
        setLoadingCreativeTabs(prev => {
          const next = new Set(prev);
          next.delete(type);
          return next;
        });
      }
    }
  };

  // 首次进入某个创作资产分类时只请求第一页，后续页由内容区滚动触发。
  useEffect(() => {
    if (!open || activeTab !== 'creative' || creativeAssetsProp) return;
    const type = CREATIVE_SUB_TAB_TYPE_MAP[creativeSubTab];
    if (!type || creativePagination[type]?.loaded) return;
    const frame = requestAnimationFrame(() => loadCreativePage(type));
    return () => cancelAnimationFrame(frame);
    // loadCreativePage 读取当前分页快照；该 effect 只由当前分类的分页状态驱动首次请求。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab, creativeSubTab, creativeAssetsProp, creativePagination]);

  const projects = useMemo(() => apiProjects ?? [], [apiProjects]);
  const projectAssetsMap = apiAssetsMap ?? {};
  // 从 store 读取创作资产数据（当 prop 未传入时）

  // 当 projects 列表变化时，同步 activeProjectId（优先使用 projectId）
  useEffect(() => {
    if (projectId) {
      // projectId 是父页面传入的外部上下文，需要同步到弹窗本地选择状态。
      setActiveProjectId(projectId);
      return;
    }
    if (projects.length > 0 && !projects.find(p => p.id === activeProjectId)) {
      // 项目列表首次加载后选择第一个可用项目。
      setActiveProjectId(projects[0].id);
    }
  }, [projects, projectId, activeProjectId]);

  // 当 accept 变化时，重置子 Tab 到第一个可用项
  useEffect(() => {
    // accept 改变了可用 Tab 集合，需同步清理当前不可用的本地选择。
    // eslint-disable-next-line react-hooks/set-state-in-effect -- accept 变化时重置受限 Tab
    setProjectSubTab(projectSubTabsAvail[0]);
    setCreativeSubTab(creativeSubTabsAvail[0]);
  }, [accept, projectSubTabsAvail, creativeSubTabsAvail]);

  if (!open) return null;

  const activeProjectName = projects.find(p => p.id === activeProjectId)?.name ?? '选择项目';

  const toggle = (asset) => {
    if (isPreSelected(asset)) return; // 预选项不可取消
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(asset.id) ? next.delete(asset.id) : next.add(asset.id);
      return next;
    });
  };

  const handleRequestClose = () => {
    onClose?.();
  };

  const handleConfirm = async () => {
    if (confirming) return;
    // 构建全量 id→asset map，供按 ID 查完整对象
    const allAssets = [
      ...Object.values(projectAssetsMap).flatMap(p => Object.values(p).flat()),
      ...Object.values(creativeAssets).flat(),
      ...seedanceAssets,
    ];
    const assetMap = Object.fromEntries(allAssets.map(a => [a.id, a]));
    // 只返回本次新增选择的资产，排除上轮已存在的预选项（preSelectedIds），避免上游重复输入
    let selectedAssets = Array.from(selected)
      .filter(id => !preSelectedSet.has(String(id)))
      .map(id => assetMap[id])
      .map((asset) => {
        if (!asset) return null;
        const assetId = asset.assetId || asset.asset_id || asset.id;
        return assetId && assetId !== asset.id ? { ...asset, id: assetId, pickerId: asset.id } : asset;
      })
      .filter(Boolean);

    const selectedSeedanceAssets = selectedAssets.filter((asset) => asset.isSeedanceMaterial);
    if (selectedSeedanceAssets.length > 0) {
      setConfirming(true);
      try {
        // 素材列表可能只返回 asset:// 身份或旧审核状态。确认前获取详情，
        // 让保存到分镜的数据始终带可展示的 preview_url/source_url。
        const hydratedAssets = await Promise.all(selectedAssets.map(async (asset) => {
          if (!asset.isSeedanceMaterial || !asset.id) return asset;
          // 虚拟人像列表接口已经返回完整的 source_url/preview_url，且列表卡片
          // 已经使用同一个对象完成渲染。确认时再次请求详情会引入另一套字段
          // 或覆盖 group 标识，导致回填到输入框后无法识别为图片。保留列表对象，
          // 只把它已有的可展示地址和 assetRefUrl 原样交给输入框。
          if (asset.isAigcMaterial || String(asset.groupType || '').toUpperCase() === 'AIGC') {
            return asset;
          }
          try {
            const detail = await apiGetLiveMaterialAsset(asset.id);
            const detailAsset = unwrapLiveMaterialAsset(detail);
            let hydrated = toSeedancePickerAsset({ ...asset, ...detailAsset }, {
              id: asset.groupId,
              name: asset.name,
              group_type: asset.groupType,
            });
            // 虚拟人像的详情有时只返回服务商引用或受控媒体地址。此时通过统一预览接口
            // 获取当前页面真正可读取的地址，同时保留 assetRefUrl 供 Seedance 生成请求使用。
            if (asset.isAigcMaterial && !hydrated.url) {
              const preview = await apiGetLiveMaterialPreview(asset.id);
              const previewUrl = normalizeSeedanceMediaUrl(preview?.previewUrl);
              if (previewUrl) {
                hydrated = {
                  ...hydrated,
                  url: previewUrl,
                  fullUrl: previewUrl,
                  fileUrl: previewUrl,
                  previewUrl,
                  sourceUrl: hydrated.sourceUrl || previewUrl,
                };
              }
            }
            return hydrated;
          } catch (error) {
            console.warn('[AssetPickerModal] 获取Seedance素材详情失败，使用列表数据继续保存:', error);
            return asset;
          }
        }));
        selectedAssets = hydratedAssets;
      } finally {
        setConfirming(false);
      }
    }
    onConfirm?.(selectedAssets);
    handleRequestClose();
  };

  const handleSelectProject = (p) => {
    setActiveProjectId(p.id);
    setProjectOpen(false);
    setProjectHovIdx(null);
    setProjectMenuRect(null);
  };

  const toggleProjectMenu = () => {
    const nextOpen = !projectOpen;
    if (nextOpen) {
      const rect = projectBtnRef.current?.getBoundingClientRect();
      setProjectMenuRect(rect ? { top: rect.bottom + 4, left: rect.left, width: rect.width } : null);
    } else {
      setProjectMenuRect(null);
    }
    setProjectOpen(nextOpen);
  };
  // 项目资产分镜图和分镜视频合并为一个 Tab，但仍按独立资产卡片平铺展示，
  // 与角色、场景、道具的卡片结构保持一致。
  const isCompactCard = activeTab === 'creative' && (creativeSubTab === '图片' || creativeSubTab === '视频');
  const isSeedanceAssetGrid = activeTab === 'seedance' && Boolean(activeSeedanceGroup);

  // 获取当前内容区资产列表
  const getCurrentAssets = () => {
    if (activeTab === 'project') {
      const projectData = projectAssetsMap[activeProjectId] ?? {};
      const key = SUB_TAB_KEY_MAP[projectSubTab];
      return projectData[key] ?? [];
    } else if (activeTab === 'creative') {
      const key = SUB_TAB_KEY_MAP[creativeSubTab];
      return creativeAssets[key] ?? [];
    }
    return seedanceAssets;
  };

  const rawAssets = getCurrentAssets();
  const filteredAssets = rawAssets.filter(a => {
    if (accept === 'media') {
      const assetType = String(a?.asset_type || a?.assetType || a?.type || '').toLowerCase();
      if (assetType === 'audio' || assetType.startsWith('audio/')) return false;
      if (activeTab === 'project' && !['image', 'video'].includes(assetType)) return false;
    }
    if (activeTab === 'creative' && creativeSubTab !== '配音' && !(a.url || a.posterUrl)) return false;
    if (activeTab === 'project' && finalOnly && !a.is_primary) return false;
    if (favOnly && !a.starred) return false;
    if (search && !(a.name || '').includes(search)) return false;
    return true;
  });
  const currentProjectTabKey = activeProjectId
    ? pickerTabKey(activeProjectId, SUB_TAB_KEY_MAP[projectSubTab])
    : null;
  const activeCreativeType = CREATIVE_SUB_TAB_TYPE_MAP[creativeSubTab];
  const creativeLoading = !creativeAssetsProp && loadingCreativeTabs.has(activeCreativeType);
  const contentLoading = activeTab === 'project'
    ? (!activeProjectId || apiProjects === null || Boolean(currentProjectTabKey && loadingTabKeys.has(currentProjectTabKey)))
    : activeTab === 'creative'
      ? (creativeLoading && rawAssets.length === 0)
      : seedanceLoading;

  const handleContentScroll = (event) => {
    if (activeTab !== 'creative' || creativeAssetsProp || creativeLoading) return;
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollHeight - scrollTop - clientHeight <= 120) {
      loadCreativePage(activeCreativeType);
    }
  };


    // ── 资产卡片悬浮预览处理 ──────────────────────────────────────────────
  function handlePreviewEnter(e, asset) {
    if (!asset?.url) return;
    const { clientX, clientY } = e;
    setMousePos({ x: clientX, y: clientY });
    hoverTimerRef.current = setTimeout(() => {
      setPreviewImage({ url: asset.fullUrl || asset.url, x: clientX, y: clientY });
    }, 500);
  }

  function handlePreviewMove(e) {
    setMousePos({ x: e.clientX, y: e.clientY });
  }

  function handlePreviewLeave() {
    clearTimeout(hoverTimerRef.current);
    setPreviewImage(null);
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={handleRequestClose}
    >
      <div
        style={{ width: '800px', height: '600px', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#161616', border: '1px solid #FFFFFF14' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', flexShrink: 0 }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>从资产中选择</span>
          <button
            type="button"
            onClick={handleRequestClose}
            onMouseEnter={() => setCloseHovered(true)}
            onMouseLeave={() => setCloseHovered(false)}
            style={{ background: closeHovered ? 'rgba(255,255,255,0.08)' : 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', transition: 'background 100ms', flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke={closeHovered ? 'rgba(255,255,255,0.8)' : '#FFFFFF66'} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── 顶部大 Tab + 搜索框 ── */}
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '24px', paddingRight: '24px', gap: '24px', flexShrink: 0 }}>
          {['project', 'creative', ...(showSeedanceTab ? ['seedance'] : [])].map((tab) => {
            const label = tab === 'project' ? '项目资产' : tab === 'creative' ? '创作资产' : 'seedance素材库';
            const isActive = activeTab === tab;
            return (
              <div
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  paddingTop: '12px', paddingBottom: '6px',
                  borderBottom: '2px solid transparent',
                  cursor: 'pointer', flexShrink: 0, transition: 'border-color 100ms',
                }}
              >
                <span style={{
                  fontFamily: isActive ? FONT_MEDIUM : FONT,
                  fontWeight: isActive ? 500 : 400,
                  fontSize: '14px', lineHeight: '20px',
                  color: isActive ? '#2DC3E1' : '#FFFFFF99',
                  transition: 'color 100ms',
                }}>{label}</span>
              </div>
            );
          })}
          {/* 右侧搜索框 */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', height: '48px' }}>
            {/* 搜索框 */}
            <div style={{
              display: 'flex', alignItems: 'center', height: '36px', width: '232px',
              paddingLeft: '12px', paddingRight: '6px', borderRadius: '8px',
              justifyContent: 'space-between', flexShrink: 0,
              background: searchFocused ? 'rgba(45,195,225,0.04)' : '#1D1E1E',
              border: `1px solid ${searchFocused ? 'rgba(45,195,225,0.6)' : '#FFFFFF14'}`,
              outline: searchFocused ? '3px solid rgba(45,195,225,0.08)' : '1px solid #00000080',
              transition: 'border-color 120ms, background 120ms',
            }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索资产"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', caretColor: '#2DC3E1' }}
                className="placeholder:text-[rgba(255,255,255,0.4)]"
              />
              <div style={{ display: 'flex', alignItems: 'center', height: '24px', borderRadius: '6px', padding: '0 8px' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M7 12.667C10.13 12.667 12.667 10.13 12.667 7C12.667 3.87 10.13 1.333 7 1.333C3.87 1.333 1.333 3.87 1.333 7C1.333 10.13 3.87 12.667 7 12.667Z" stroke={searchFocused ? '#FFFFFF' : '#FFFFFF99'} strokeLinejoin="round" />
                  <path d="M11.074 11.074L13.902 13.902" stroke={searchFocused ? '#FFFFFF' : '#FFFFFF99'} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* ── 子 Tab 栏 ── */}
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '24px', paddingRight: '24px', paddingTop: '12px', gap: '24px', flexShrink: 0 }}>
          {activeTab === 'project' && (
            <>
              {/* 项目名称下拉 */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  ref={projectBtnRef}
                  onClick={toggleProjectMenu}
                  style={{ display: 'flex', alignItems: 'center', gap: '0', height: '32px', paddingLeft: '16px', paddingRight: '8px', borderRadius: '8px', background: projectOpen ? '#FFFFFF1A' : '#FFFFFF0D', cursor: 'pointer', flexShrink: 0, transition: 'background 100ms' }}
                >
                  <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '14px', lineHeight: '18px', color: '#FFFFFFCC', whiteSpace: 'nowrap' }}>{activeProjectName}</span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, transition: 'transform 150ms', transform: projectOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFFCC" stroke="#FFFFFFCC" strokeWidth="1.333" strokeLinejoin="round" />
                  </svg>
                </div>
                {projectOpen && projects.length > 0 && createPortal(
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 1200 }} onClick={() => { setProjectOpen(false); setProjectHovIdx(null); }} />
                      <div
                        style={{
                          position: 'fixed',
                          top: projectMenuRect?.top ?? 0,
                          left: projectMenuRect?.left ?? 0,
                          zIndex: 1201,
                          minWidth: projectMenuRect?.width ?? 120,
                          background: '#1C1C1C',
                          border: '1px solid #FFFFFF14',
                          borderRadius: '10px',
                          padding: '4px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0',
                        }}
                      >
                        {projects.map((p, i) => (
                          <div
                            key={p.id}
                            onClick={() => handleSelectProject(p)}
                            onMouseEnter={() => setProjectHovIdx(i)}
                            onMouseLeave={() => setProjectHovIdx(null)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              height: '32px', paddingLeft: '12px', paddingRight: '12px', borderRadius: '7px',
                              cursor: 'pointer',
                              background: projectHovIdx === i ? '#FFFFFF0F' : 'transparent',
                              transition: 'background 80ms',
                            }}
                          >
                            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: activeProjectId === p.id ? '#FFFFFF' : '#FFFFFFB3', whiteSpace: 'nowrap' }}>{p.name}</span>
                            {activeProjectId === p.id && (
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginLeft: '8px' }}>
                                <path d="M3.333 8L6.667 11.333L13.333 4.667" stroke="#2DC3E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                        ))}
                      </div>
                    </>,
                    document.body
                  )}
              </div>
              {/* 子 Tab */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
                {projectSubTabsAvail.map((tab) => {
                  const isActive = projectSubTab === tab;
                  return (
                    <div
                      key={tab}
                      onClick={() => setProjectSubTab(tab)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                      <span style={{ fontFamily: isActive ? FONT_MEDIUM : FONT, fontWeight: isActive ? 500 : 400, fontSize: '14px', lineHeight: '18px', color: isActive ? '#FFFFFF' : '#FFFFFF99', transition: 'color 100ms', whiteSpace: 'nowrap' }}>{tab}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {activeTab === 'creative' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
              {creativeSubTabsAvail.map((tab) => {
                const isActive = creativeSubTab === tab;
                return (
                  <div
                    key={tab}
                    onClick={() => setCreativeSubTab(tab)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                  >
                    <span style={{ fontFamily: isActive ? FONT_MEDIUM : FONT, fontWeight: isActive ? 500 : 400, fontSize: '14px', lineHeight: '18px', color: isActive ? '#FFFFFF' : '#FFFFFF99', transition: 'color 100ms', whiteSpace: 'nowrap' }}>{tab}</span>
                  </div>
                );
              })}
            </div>
          )}
          {activeTab === 'seedance' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
              {activeSeedanceGroup ? (
                <button type="button" onClick={() => setActiveSeedanceGroup(null)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF66' }}>
                  返回/
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
                  {['real', 'virtual'].map((tab) => (
                    <button key={tab} type="button" onClick={() => setSeedanceSubTab(tab)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: seedanceSubTab === tab ? FONT_MEDIUM : FONT, fontSize: '14px', lineHeight: '18px', color: seedanceSubTab === tab ? '#FFFFFF' : '#FFFFFF99' }}>
                      {tab === 'real' ? '真人人像' : '虚拟人像'}
                    </button>
                  ))}
                </div>
              )}
              {activeSeedanceGroup && <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>{activeSeedanceGroup.name}</span>}
            </div>
          )}
        </div>

        {/* ── 内容区（可滚动） ── */}
        <div onScroll={handleContentScroll} style={{ flex: 1, overflowY: 'auto', padding: '8px 24px', display: 'flex', flexDirection: 'column' }}>
          {contentLoading ? <LoadingState /> : activeTab === 'seedance' && !activeSeedanceGroup ? (
            seedanceGroups.filter((group) => seedanceSubTab === 'virtual' ? String(group.group_type || '').toUpperCase() === 'AIGC' : String(group.group_type || '').toUpperCase() !== 'AIGC').length === 0 ? <EmptyState /> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px', paddingTop: '8px', paddingBottom: '8px', alignContent: 'flex-start' }}>
                {seedanceGroups.filter((group) => seedanceSubTab === 'virtual' ? String(group.group_type || '').toUpperCase() === 'AIGC' : String(group.group_type || '').toUpperCase() !== 'AIGC').map((group) => (
                  <SeedanceFolderCard
                    key={group.id}
                    name={group.name || '未命名素材组'}
                    count={group.asset_count ?? 0}
                    images={group.images || []}
                    onOpen={() => setActiveSeedanceGroup(group)}
                  />
                ))}
              </div>
            )
          ) : filteredAssets.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={{ display: isSeedanceAssetGrid ? 'grid' : 'flex', gridTemplateColumns: isSeedanceAssetGrid ? 'repeat(3, minmax(0, 1fr))' : undefined, flexWrap: isSeedanceAssetGrid ? undefined : 'wrap', gap: '16px', paddingTop: '8px', paddingBottom: '8px', alignContent: 'flex-start' }}>
              {filteredAssets.map((asset) => {
                const disabled = isPreSelected(asset) || isExcludedAsset(asset);
                const isInlineCreativeVideo = activeTab === 'creative' && creativeSubTab === '视频';
                if (activeTab === 'creative' && creativeSubTab === '配音') {
                  return (
                    <div key={asset.id} style={{ width: 'calc((100% - 32px) / 3)', flexShrink: 0 }}>
                      <CreationAudioResultCard
                        status="done"
                        audioUrl={asset.url || asset.audio_url || asset.audioUrl || null}
                        prompt={asset.prompt || asset.name || ''}
                        batchMode
                        isSelected={selected.has(asset.id) || disabled}
                        selectionDisabled={disabled}
                        selectionCheckboxPosition="left"
                        onToggleSelect={() => toggle(asset)}
                      />
                    </div>
                  );
                }
                if (asset.isSeedanceMaterial) {
                  return (
                    <div key={asset.id} style={{ width: '100%', minWidth: 0 }}>
                      <SeedanceAssetCard
                        asset={asset}
                        width="100%"
                        selected={selected.has(asset.id) || disabled}
                        disabled={disabled}
                        showActions={false}
                        showSelection
                        onClick={() => toggle(asset)}
                      />
                    </div>
                  );
                }
                return (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    isSelected={selected.has(asset.id) || disabled}
                    isHovered={hoveredCard === asset.id}
                    isDisabled={disabled}
                    onMouseEnter={(e) => {
                      setHoveredCard(asset.id);
                      if (!isInlineCreativeVideo) handlePreviewEnter(e, asset);
                    }}
                    onMouseMove={isInlineCreativeVideo ? undefined : handlePreviewMove}
                    onMouseLeave={() => {
                      setHoveredCard(null);
                      if (!isInlineCreativeVideo) handlePreviewLeave();
                    }}
                    onClick={() => toggle(asset)}
                    compact={isCompactCard}
                    inlineVideoPreview={isInlineCreativeVideo}
                  />
                );
              })}
              {activeTab === 'creative' && creativeLoading && (
                <div role="status" aria-label="正在加载更多资产" style={{ width: '100%', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DotsLoading size={6} color="#2DC3E1" gap={4} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', flexShrink: 0, borderRadius: '0 0 16px 16px' }}>
          {activeTab === 'project' && (
            <div
              onClick={() => setFinalOnly(v => !v)}
              onMouseEnter={() => setFinalHovered(true)}
              onMouseLeave={() => setFinalHovered(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flexShrink: 0 }}
            >
              <Checkbox checked={finalOnly} hovered={finalHovered} />
              <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '18px', color: finalHovered ? '#FFFFFF' : '#FFFFFF99', whiteSpace: 'nowrap' }}>仅显示定稿图</span>
            </div>
          )}
          {activeTab === 'creative' && (
            <div
              onClick={() => setFavOnly(v => !v)}
              onMouseEnter={() => setFavHovered(true)}
              onMouseLeave={() => setFavHovered(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flexShrink: 0 }}
            >
              <Checkbox checked={favOnly} hovered={favHovered} />
              <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '18px', color: favHovered ? '#FFFFFF' : '#FFFFFF99', whiteSpace: 'nowrap' }}>仅显示收藏</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0, marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={handleRequestClose}
            onMouseEnter={() => setCancelHovered(true)}
            onMouseLeave={() => { setCancelHovered(false); setCancelPressed(false); }}
            onMouseDown={() => setCancelPressed(true)}
            onMouseUp={() => setCancelHovered(true)}
            style={{ display: 'flex', alignItems: 'center', height: '36px', borderRadius: '8px', padding: '0 16px', cursor: 'pointer', background: cancelPressed ? '#1A1A1A' : cancelHovered ? '#1D1D1D' : '#161616', border: '1px solid #FFFFFF0D', outline: '1px solid #00000080', boxShadow: '#00000066 3px 3px 8px', transition: 'background 100ms' }}
          >
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: cancelHovered ? '#FFFFFFCC' : '#FFFFFF99', whiteSpace: 'nowrap', transition: 'color 100ms' }}>取消</span>
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming}
            onMouseEnter={() => setConfirmHovered(true)}
            onMouseLeave={() => { setConfirmHovered(false); setConfirmPressed(false); }}
            onMouseDown={() => setConfirmPressed(true)}
            onMouseUp={() => setConfirmHovered(true)}
            style={{ display: 'flex', flexDirection: 'column', height: '36px', borderRadius: '8px', outline: '1px solid #00000080', boxShadow: '#00000066 3px 3px 8px', padding: '1px', backgroundImage: 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.08))', cursor: confirming ? 'wait' : 'pointer', border: 'none', transition: 'opacity 100ms', opacity: confirming || confirmPressed ? 0.75 : 1 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, borderRadius: '7px', padding: '0 15px', background: confirmPressed ? '#111111' : confirmHovered ? '#1A1A1A' : '#161616', transition: 'background 100ms' }}>
              <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>{confirming ? '处理中...' : '确定'}</span>
            </div>
          </button>
          </div>
        </div>
      </div>
      {previewImage && createPortal(
        <AssetHoverPreview key={previewImage.url} url={previewImage.url} mouseX={mousePos.x} mouseY={mousePos.y} />,
        document.body
      )}
    </div>,
    document.body
  );
}
