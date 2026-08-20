/**
 * @file StoryboardCreationPanel.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────
 *   弹窗布局           固定 600px 宽，组织 54px header、457px 表单区和 141px 候选区
 *   候选媒体           统一展示图片/视频候选，并提供上传与资产库入口
 *   页签状态           维护图片/视频页签并通知页面记忆最近使用的页签
 *
 * ─── 更新记录 ───────────────────────────────────────────────
 *   2026-07-23         按 Paper 设计稿重写创作弹窗布局和候选区样式
 */

import { useRef, useState } from 'react';
import AssetPickerModal from '../AssetPickerModal';
import Checkbox from '../Checkbox';
import { apiUploadCreationImage } from '../../api/creation';
import { apiUploadStoryboardVideo } from '../../api/storyboard';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { ModalCloseBtn } from './StoryboardControls';
import FileUploadButton from '../ui/FileUploadButton';
import DotsLoading from '../DotsLoading';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function getUploadMediaType(file) {
  if (file?.type?.startsWith('video/')) return 'video';
  if (file?.type?.startsWith('image/')) return 'image';
  return null;
}

const ASSET_GENERATION_KEYS = new Set([
  'model', 'resolution', 'size', 'duration', 'ratio', 'aspect_ratio', 'aspectRatio',
  'sound_effect', 'soundEffect', 'generate_audio', 'generateAudio', 'audio_setting', 'audioSetting',
  'reference_images', 'referenceImages', 'first_frame_url', 'firstFrameUrl',
  'last_frame_url', 'lastFrameUrl', 'reference_video_url', 'referenceVideoUrl',
  'reference_audio_url', 'referenceAudioUrl', 'reference_mode', 'referenceMode',
  'reference_mode_label', 'referenceModeLabel',
  'generation_mode', 'generationMode', 'generate_mode', 'generateMode',
  'watermark', 'multi_shot', 'multiShot', 'expand_options', 'expandOptions',
  'subject_completion_options', 'subjectCompletionOptions', 'optimize_prompt', 'optimizePrompt',
  'sequential_image_generation', 'sequentialImageGeneration', 'prompt_raw', 'promptRaw',
  'prompt_resolved', 'promptResolved', 'provider_params', 'providerParams',
]);

function parseAssetMetadata(asset) {
  const raw = asset?.metadata_json ?? asset?.metadataJson ?? asset?.metadata ?? {};
  if (typeof raw !== 'string') return raw && typeof raw === 'object' ? raw : {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function parseObjectValue(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getAssetParameterContainers(asset, metadata) {
  return [
    asset?.params, asset?.parameters, asset?.generation, asset?.options,
    asset?.gen_params, asset?.genParams, asset?.generation_params, asset?.generationParams,
    asset?.provider_params, asset?.providerParams,
    metadata?.params, metadata?.parameters, metadata?.generation, metadata?.options,
    metadata?.gen_params, metadata?.genParams, metadata?.generation_params, metadata?.generationParams,
    metadata?.provider_params, metadata?.providerParams,
  ].map(parseObjectValue).filter((value) => Object.keys(value).length > 0);
}

function getAssetGenerationParams(asset, metadata) {
  const nested = Object.assign({}, ...getAssetParameterContainers(asset, metadata));
  const direct = {
    expand_options: asset?.expand_options ?? asset?.expandOptions ?? metadata?.expand_options ?? metadata?.expandOptions,
    subject_completion_options: asset?.subject_completion_options ?? asset?.subjectCompletionOptions ?? metadata?.subject_completion_options ?? metadata?.subjectCompletionOptions,
    optimize_prompt: asset?.optimize_prompt ?? asset?.optimizePrompt ?? metadata?.optimize_prompt ?? metadata?.optimizePrompt,
    sequential_image_generation: asset?.sequential_image_generation ?? asset?.sequentialImageGeneration ?? metadata?.sequential_image_generation ?? metadata?.sequentialImageGeneration,
    model: asset?.model ?? metadata?.model ?? nested?.model,
    resolution: asset?.resolution ?? asset?.size ?? metadata?.resolution ?? metadata?.size ?? nested?.resolution ?? nested?.size,
    duration: asset?.duration ?? metadata?.duration ?? nested?.duration,
    ratio: asset?.ratio ?? asset?.aspect_ratio ?? asset?.aspectRatio ?? metadata?.ratio ?? metadata?.aspect_ratio ?? metadata?.aspectRatio ?? nested?.ratio ?? nested?.aspect_ratio ?? nested?.aspectRatio,
    reference_images: asset?.reference_images ?? asset?.referenceImages ?? metadata?.reference_images ?? metadata?.referenceImages ?? nested?.reference_images ?? nested?.referenceImages,
    reference_image_urls: asset?.reference_image_urls ?? asset?.referenceImageUrls ?? metadata?.reference_image_urls ?? metadata?.referenceImageUrls ?? nested?.reference_image_urls ?? nested?.referenceImageUrls,
    provider_params: asset?.provider_params ?? asset?.providerParams ?? metadata?.provider_params ?? metadata?.providerParams ?? nested?.provider_params ?? nested?.providerParams,
    ...nested,
  };
  return Object.fromEntries(Object.entries({ ...nested, ...direct }).filter(([key, value]) => ASSET_GENERATION_KEYS.has(key) && value !== undefined && value !== null && value !== ''));
}

function CandidateItem({ item, onSelect, onPreview, onDownload }) {
  const [hovered, setHovered] = useState(false);
  if (item?.pending) {
    return (
      <div
        aria-label="生成中"
        role="status"
        style={{ width: '100px', height: '100px', position: 'relative', overflow: 'hidden', flexShrink: 0, borderRadius: '6px', border: '1px solid rgba(45,195,225,0.45)', background: '#1D1E1E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <DotsLoading size={5} color="#2DC3E1" gap={4} />
      </div>
    );
  }
  const isVideo = item.media_type === 'video' || item.type?.startsWith('video');
  const source = normalizeImageUrl(item.thumbnail_url || item.poster_url || item.url);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect?.();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={item.is_finalized ? '取消定稿' : '设为定稿'}
      style={{ width: '100px', height: '100px', position: 'relative', overflow: 'hidden', flexShrink: 0, borderRadius: '6px', border: `1px solid ${item.is_finalized ? '#2DC3E1' : hovered ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)'}`, background: '#1D1E1E', padding: 0, cursor: 'pointer', display: 'block', transition: 'border-color 120ms, box-shadow 120ms', boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.35)' : 'none' }}
    >
      {isVideo ? <video src={normalizeImageUrl(item.url)} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={source} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      <span style={{ position: 'absolute', left: '4px', top: '4px', padding: '1px 4px', borderRadius: '2px', background: '#00000099', color: '#FFFFFFCC', fontFamily: FONT, fontSize: '10px', lineHeight: '14px' }}>{isVideo ? '视频' : '图片'}</span>
      <Checkbox
        checked={item.is_finalized}
        aria-label={item.is_finalized ? '已定稿' : '未定稿'}
        style={{ position: 'absolute', right: '4px', top: '4px', width: '14px', height: '14px', pointerEvents: 'none' }}
      />
      {hovered && (
        <div style={{ position: 'absolute', right: '4px', bottom: '4px', display: 'flex', gap: '4px' }}>
          <button type="button" aria-label="放大" onClick={(event) => { event.stopPropagation(); onPreview?.(item); }} style={{ width: '24px', height: '24px', padding: 0, border: 0, borderRadius: '4px', background: '#00000099', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M5.333 2H2.667C2.298 2 2 2.298 2 2.667V5.333" fill="none" stroke="#FFFFFF" strokeLinejoin="round" />
              <path d="M5.333 14H2.667C2.298 14 2 13.701 2 13.333V10.667" fill="none" stroke="#FFFFFF" strokeLinejoin="round" />
              <path d="M10.667 14H13.333C13.701 14 14 13.701 14 13.333V10.667" fill="none" stroke="#FFFFFF" strokeLinejoin="round" />
              <path d="M10.667 2H13.333C13.701 2 14 2.298 14 2.667V5.333" fill="none" stroke="#FFFFFF" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" aria-label="下载" onClick={(event) => { event.stopPropagation(); onDownload?.(item); }} style={{ width: '24px', height: '24px', padding: 0, border: 0, borderRadius: '4px', background: '#00000099', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style={{ rotate: '180deg' }} aria-hidden="true">
              <path d="M8.003 4.7V14" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 8.667L8 4.667L12 8.667" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 2H12" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function UploadEntry({ onUpload, onOpenAssets }) {
  const inputRef = useRef(null);
  return (
    <div style={{ width: '100px', height: '100px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.08)', background: '#1D1E1E' }}>
      <input ref={inputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = ''; }} />
      <FileUploadButton onClick={() => inputRef.current?.click()}>本地上传</FileUploadButton>
      <FileUploadButton onClick={onOpenAssets}>从资产库选择</FileUploadButton>
    </div>
  );
}

export default function StoryboardCreationPanel({ initialTab = 'image', onTabChange, onClose, candidates = [], projectId, storyboardId, onCandidateMedia, onFinalizeToggle, onPreview, onDownload, children }) {
  const [tab, setTab] = useState(initialTab);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const changeTab = (next) => { setTab(next); onTabChange?.(next); };

  async function handleUpload(file) {
    const mediaType = getUploadMediaType(file);
    if (!mediaType) return;
    try {
      const result = mediaType === 'video'
        ? await apiUploadStoryboardVideo(projectId, storyboardId, file)
        : await apiUploadCreationImage({ file, category: 'storyboard', project_id: projectId });
      const url = normalizeImageUrl(result?.uploaded_url || result?.uploadedUrl || result?.video_url || result?.videoUrl || result?.url || result?.file_url || '');
      if (url) onCandidateMedia?.({ id: result?.id || result?.asset_id || url, url, media_type: mediaType, source: 'local-upload' });
    } catch {
      // 具体错误由页面统一提示；上传入口不能阻塞弹窗布局。
    }
  }

  function handleAssets(assets) {
    (assets || []).forEach((asset) => {
      const metadata = parseAssetMetadata(asset);
      const parameterContainers = getAssetParameterContainers(asset, metadata);
      const mergedParams = Object.assign({}, ...parameterContainers);
      const url = normalizeImageUrl(asset.fileUrl || asset.originalUrl || asset.original_url || asset.thumbnailUrl || asset.thumbnail_url || asset.url || asset.file_url);
      const rawType = String(asset.asset_type || asset.assetType || asset.media_type || asset.mediaType || asset.type || '').toLowerCase();
      const mediaType = rawType.startsWith('video') ? 'video' : rawType.startsWith('image') ? 'image' : null;
      if (url && mediaType) onCandidateMedia?.({
        id: asset.id || url,
        asset_id: asset.asset_id || asset.assetId || asset.id || null,
        url,
        thumbnail_url: asset.thumbnailUrl || asset.thumbnail_url || null,
        poster_url: asset.posterUrl || asset.poster_url || asset.thumbnailUrl || asset.thumbnail_url || null,
        download_url: asset.downloadUrl || asset.download_url || asset.fileUrl || asset.file_url || url,
        media_type: mediaType,
        source: 'asset-library',
        detailSource: 'asset-library',
        prompt: asset.input_prompt ?? asset.inputPrompt ?? asset.prompt_raw ?? asset.promptRaw ?? asset.prompt ?? asset.prompt_resolved ?? asset.promptResolved ?? metadata.input_prompt ?? metadata.inputPrompt ?? metadata.prompt_raw ?? metadata.promptRaw ?? metadata.prompt ?? metadata.prompt_resolved ?? metadata.promptResolved ?? mergedParams.input_prompt ?? mergedParams.inputPrompt ?? mergedParams.prompt,
        input_prompt: asset.input_prompt ?? asset.inputPrompt ?? asset.prompt_raw ?? asset.promptRaw ?? asset.prompt ?? asset.prompt_resolved ?? asset.promptResolved ?? metadata.input_prompt ?? metadata.inputPrompt ?? metadata.prompt_raw ?? metadata.promptRaw ?? metadata.prompt ?? metadata.prompt_resolved ?? metadata.promptResolved ?? mergedParams.input_prompt ?? mergedParams.inputPrompt ?? mergedParams.prompt,
        prompt_raw: asset.prompt_raw ?? asset.promptRaw ?? metadata.prompt_raw ?? metadata.promptRaw ?? mergedParams.prompt_raw ?? mergedParams.promptRaw,
        prompt_resolved: asset.prompt_resolved ?? asset.promptResolved ?? metadata.prompt_resolved ?? metadata.promptResolved ?? mergedParams.prompt_resolved ?? mergedParams.promptResolved,
        model: asset.model ?? metadata.model ?? mergedParams.model,
        resolution: asset.resolution ?? asset.size ?? metadata.resolution ?? metadata.size ?? mergedParams.resolution ?? mergedParams.size,
        duration: asset.duration ?? metadata.duration ?? mergedParams.duration,
        ratio: asset.ratio ?? asset.aspect_ratio ?? asset.aspectRatio ?? metadata.ratio ?? metadata.aspect_ratio ?? metadata.aspectRatio ?? mergedParams.ratio ?? mergedParams.aspect_ratio ?? mergedParams.aspectRatio,
        reference_images: asset.reference_images ?? asset.referenceImages ?? metadata.reference_images ?? metadata.referenceImages ?? mergedParams.reference_images ?? mergedParams.referenceImages,
        reference_image_urls: asset.reference_image_urls ?? asset.referenceImageUrls ?? metadata.reference_image_urls ?? metadata.referenceImages ?? mergedParams.reference_image_urls ?? mergedParams.referenceImageUrls,
        genParams: getAssetGenerationParams(asset, metadata),
        metadata: { ...metadata, params: mergedParams },
      });
    });
    setAssetPickerOpen(false);
  }

  return (
    <div style={{ position: 'fixed', right: '24px', top: '60px', bottom: '24px', width: '600px', height: 'auto', maxHeight: 'calc(100vh - 84px)', zIndex: 901, display: 'flex', flexDirection: 'column', background: '#161616', borderRadius: '16px', border: '1px solid #FFFFFF14', boxShadow: '-10px 24px 64px #00000099', overflow: 'hidden' }}>
      <header style={{ height: '54px', flexShrink: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 24px', background: '#161616', borderBottom: '1px solid #FFFFFF14', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', height: '100%' }}>
          {['video', 'image'].map((value) => <button key={value} type="button" onClick={() => changeTab(value)} style={{ height: '40px', padding: '10px', border: 0, borderBottom: `2px solid ${tab === value ? '#2DC3E1' : 'transparent'}`, background: 'transparent', color: tab === value ? '#2DC3E1' : '#FFFFFF99', fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '20px', cursor: 'pointer' }}>{value === 'video' ? '创作视频' : '创作图片'}</button>)}
        </div>
        <div style={{ paddingBottom: '18px' }}><ModalCloseBtn onClick={onClose} /></div>
      </header>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        <section style={{ width: '457px', minWidth: 0, minHeight: 0, overflow: 'hidden', background: '#161616' }}>{children}</section>
        <aside style={{ width: '141px', flex: '0 0 141px', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px 24px 8px 16px', boxSizing: 'border-box', overflowY: 'auto', background: '#161616', borderLeft: '1px solid #FFFFFF14' }}>
          <UploadEntry onUpload={handleUpload} onOpenAssets={() => setAssetPickerOpen(true)} />
          {candidates.map((item, index) => <CandidateItem key={item.id || item.url || index} item={item} onSelect={() => onFinalizeToggle?.(item)} onPreview={onPreview} onDownload={onDownload} />)}
        </aside>
        <AssetPickerModal accept="media" open={assetPickerOpen} onClose={() => setAssetPickerOpen(false)} projectId={projectId} onConfirm={handleAssets} />
      </div>
      <footer aria-hidden="true" style={{ position: 'absolute', left: 0, bottom: 0, width: '457px', height: '68px', pointerEvents: 'none', boxSizing: 'border-box' }} />
    </div>
  );
}
