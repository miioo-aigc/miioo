import { useMemo, useRef, useState } from 'react';
import { Tabs, DropdownMenu, DeleteIcon } from '../ui';
import AssetPickerModal from '../AssetPickerModal';
import SubtitleLibraryPanel from './SubtitleLibraryPanel';
import { apiUploadCreationAudio, apiUploadCreationImage, apiUploadCreationVideo } from '../../api/creation';
import { apiGetAssetDetail } from '../../api/assets';
import { prepareCompositionAsset } from '../../api/CompositionAssetImport';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { compositionMediaSource } from '../../utils/CompositionMediaSource';
import { readMediaDuration } from '../../utils/ReadMediaDuration';
import { formatTime, useCompositionEditorStore } from '../../stores/compositionEditorStore';

const FONT = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function AudioIcon({ color = 'currentColor' }) {
  return (
    <svg width="24" height="24" viewBox="0 0 1024 1024" fill={color} style={{ flexShrink: 0 }} aria-hidden="true">
      <path d="M96 336h64v384H96zM0 451h64v186H0zM224 272h64v512h-64zM352 448h64v160h-64zM480 400h64v256h-64zM608 336h64v384h-64zM736 464h64v128h-64zM864 400h64v256h-64zM960 448h64v160h-64z" />
    </svg>
  );
}

export default function AssetLibraryPanel({ albumState, onFetch, episodeNumber, projectId, onAssetAdded, onRemoveAsset }) {
  const [mediaType, setMediaType] = useState('video');
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingAssets, setPendingAssets] = useState([]);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const visiblePendingAssets = pendingAssets.filter((item) => item.type === mediaType);
  const addAsset = useCompositionEditorStore((s) => s.addAsset);
  const segments = useCompositionEditorStore((s) => s.segments);

  const addedSet = useMemo(
    () => new Set(segments.map((s) => s.assetId)),
    [segments],
  );

  const assets = (albumState.assets || []).filter((asset) => asset.asset_type === mediaType
    && (episodeNumber == null || asset.episode_number == null || String(asset.episode_number) === String(episodeNumber)));

  const handleClick = (asset) => {
    addAsset(asset);
  };

  const normalizeAddedAsset = (raw, file) => {
    const asset = raw?.asset || raw?.data || raw;
    return {
      ...asset,
      manuallyAdded: true,
      id: asset?.assetId || asset?.asset_id || asset?.id,
      asset_type: asset?.asset_type || asset?.type || mediaType,
      name: asset?.name || file?.name || '未命名素材',
      fileUrl: compositionMediaSource({ ...asset, asset_type: asset?.asset_type || asset?.type || mediaType }),
      videoUrl: (asset?.asset_type || asset?.type || mediaType) === 'video'
        ? compositionMediaSource({ ...asset, asset_type: 'video' }) : null,
      url: normalizeImageUrl(asset?.thumbnail_url || asset?.thumbnailUrl || asset?.poster_url || (mediaType === 'image' ? asset?.file_url || asset?.url : null)),
      thumbnailUrl: normalizeImageUrl(asset?.thumbnail_url || asset?.thumbnailUrl),
      posterUrl: normalizeImageUrl(asset?.poster_url || asset?.posterUrl),
      duration: asset?.duration || asset?.metadata_json?.duration || null,
    };
  };

  const addNewAssets = (items) => {
    const valid = items.filter((item) => item?.id);
    if (valid.length) {
      onAssetAdded?.(valid);
      scrollRef.current?.scrollTo({ top: 0 });
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !projectId) return;
    setUploading(true);
    setPendingAssets([{ name: file.name, type: mediaType, label: '上传处理中…' }]);
    scrollRef.current?.scrollTo({ top: 0 });
    setMenuOpen(false);
    setUploadError(null);
    try {
      const upload = mediaType === 'video' ? apiUploadCreationVideo : mediaType === 'audio' ? apiUploadCreationAudio : apiUploadCreationImage;
      const [result, localDuration] = await Promise.all([
        upload({ file, category: 'reference', project_id: projectId, asset_name: file.name }),
        readMediaDuration(file, mediaType),
      ]);
      if (!result.asset_id) throw new Error('上传失败，未返回资产 ID');
      const asset = normalizeAddedAsset(await apiGetAssetDetail(result.asset_id), file);
      if (!asset.id || !asset.fileUrl) throw new Error('上传结果缺少素材信息，请重试');
      const responseMedia = result.video || result.audio || {};
      asset.duration = [asset.duration, responseMedia.duration, responseMedia.metadata_json?.duration, localDuration]
        .map(Number).find((duration) => Number.isFinite(duration) && duration > 0) ?? null;
      addNewAssets([asset]);
    } catch (error) {
      setUploadError(error.message || '上传失败，请重试');
    } finally {
      setUploading(false);
      setPendingAssets([]);
      setMenuOpen(false);
    }
  };

  return (
    <aside className="w-full min-w-0 flex flex-col gap-[8px] bg-neutral-200 overflow-hidden px-[12px] py-[8px]">
      <div className="flex min-w-0 items-center justify-between gap-[8px]">
        <Tabs options={[{ value: 'video', label: '视频' }, { value: 'image', label: '图片' }, { value: 'audio', label: '音频' }, { value: 'subtitle', label: '字幕' }]} value={mediaType} onChange={setMediaType} gap="12px" variant="plain-ghost" />
        <div className={`relative shrink-0 ${mediaType === 'subtitle' ? 'hidden' : ''}`}>
          <input ref={fileInputRef} type="file" accept={mediaType === 'video' ? 'video/*' : mediaType === 'audio' ? 'audio/*' : 'image/*'} className="hidden" onChange={handleUpload} />
          <button type="button" onClick={() => setMenuOpen((open) => !open)} disabled={uploading} className="flex h-[28px] cursor-pointer items-center justify-center gap-[4px] rounded-[4px] px-[6px] text-[14px] leading-[16px] text-text-secondary hover:bg-white-10 disabled:cursor-not-allowed disabled:opacity-50">
            <span>添加素材</span>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
              <path d="M4.5 6.25L8 9.75L11.5 6.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {menuOpen && <DropdownMenu width="140px" style={{ top: '100%', bottom: 'auto', marginTop: '4px' }} items={[{ key: 'upload', label: '本地上传', onClick: () => fileInputRef.current?.click() }, { key: 'library', label: '从资产库选择', onClick: () => { setPickerOpen(true); setMenuOpen(false); } }]} onClose={() => setMenuOpen(false)} />}
        </div>
      </div>
      <AssetPickerModal
        open={pickerOpen}
        projectId={projectId}
        accept={mediaType}
        preSelectedIds={(albumState.assets || []).filter((asset) => asset.asset_type === mediaType).map((asset) => asset.id).filter(Boolean)}
        onClose={() => setPickerOpen(false)}
        onConfirm={async (selected) => {
        if (!selected.length) return;
        setPickerOpen(false);
        setUploading(true);
        setUploadError(null);
        setPendingAssets(selected.map((item) => ({ name: item.name || '未命名素材', type: mediaType, label: '添加处理中…' })));
        scrollRef.current?.scrollTo({ top: 0 });
        try {
          const items = await Promise.all(selected.map(async (item) => {
            const detail = await prepareCompositionAsset(item, projectId, mediaType);
            return normalizeAddedAsset(detail);
          }));
          addNewAssets(items);
          setUploadError(null);
        } catch (error) { setUploadError(error.message || '素材添加失败'); }
        finally { setUploading(false); setPendingAssets([]); }
        }}
      />
      {uploadError && <div role="alert" className="text-text-danger text-[12px]">{uploadError}</div>}
      {mediaType === 'subtitle' && <SubtitleLibraryPanel />}
      <div ref={scrollRef} className={`min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto mr-[-6px] pr-[12px] ${mediaType === 'subtitle' ? 'hidden' : ''}`} style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.3) transparent', scrollbarGutter: 'stable' }}>
        {albumState.warning && !albumState.loading && (
          <div role="status" className="px-[8px] py-[12px] text-text-secondary text-font-size-12">
            {albumState.warning}
            <button type="button" onClick={onFetch} className="cursor-pointer text-brand-main px-[8px]">重试</button>
          </div>
        )}
        {albumState.loading && (
          <div className="py-[32px] text-center">
            <span className="text-text-hint text-font-size-14">素材加载中…</span>
          </div>
        )}

        {!albumState.loading && albumState.error && (
          <div className="py-[32px] text-center flex flex-col gap-[12px]">
            <span className="text-text-danger text-font-size-14">{albumState.error}</span>
            <button
              type="button"
              onClick={onFetch}
              className="self-center flex items-center h-9 rounded-medium px-[16px] bg-btn-primary-bg-normal hover:bg-btn-primary-bg-hover border border-btn-primary-border cursor-pointer"
            >
              <span className="text-btn-primary-text text-font-size-14" style={{ fontFamily: FONT }}>重试</span>
            </button>
          </div>
        )}

        {!albumState.loading && !albumState.error && assets.length === 0 && visiblePendingAssets.length === 0 && (
          <div className="py-[32px] text-center">
            <span className="text-text-hint text-font-size-14">
              当前分类暂无素材
            </span>
          </div>
        )}

        {((!albumState.loading && !albumState.error && assets.length > 0) || visiblePendingAssets.length > 0) && (
          <div className="grid grid-cols-2 gap-x-[12px] gap-y-[12px]">
            {visiblePendingAssets.map((pendingAsset, index) => (
              <div key={`pending-${index}`} role="status" aria-live="polite" aria-busy="true" className="flex min-w-0 flex-col gap-[6px]">
                <div className="relative overflow-hidden flex aspect-video w-full items-center justify-center gap-[8px] rounded-[8px] border border-white-10 bg-neutral-500 text-[12px] text-text-secondary">
                  <span aria-hidden="true" className="h-[16px] w-[16px] animate-spin rounded-full border-2 border-white/20 border-t-brand-main" />
                  {pendingAsset.label}
                  <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[33.333%]" style={{ background: 'linear-gradient(to top, var(--color-black-50), transparent)' }} />
                  <span className="absolute bottom-[4px] left-[8px] right-[8px] truncate text-font-size-14 text-text-primary" title={pendingAsset.name}>{pendingAsset.name}</span>
                </div>
              </div>
            ))}
            {assets.map((asset) => {
              const added = addedSet.has(asset.id);
              const isVideo = asset.asset_type === 'video';
              const isAudio = asset.asset_type === 'audio';
              const showDuration = (isVideo || isAudio) && asset.duration != null;
              const thumb = asset.thumbnailUrl || asset.posterUrl;
              return (
                <div
                  key={asset.id}
                  onClick={() => handleClick(asset)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleClick(asset); }
                  }}
                  role="button"
                  tabIndex={0}
                  title={`添加到时间线：${asset.name || '未命名素材'}${showDuration ? ` · ${formatTime(asset.duration)}` : ''}`}
                  className={`group relative flex min-w-0 w-full flex-col items-start gap-[6px] cursor-pointer text-left ${added ? 'text-brand-main' : ''}`}
                >
                  <span className="relative flex items-center justify-center w-full aspect-video rounded-[8px] bg-neutral-500 overflow-hidden shrink-0 border border-white-10 transition-colors group-hover:border-white-30">
                    {isAudio ? (
                      <span className="text-text-secondary"><AudioIcon /></span>
                    ) : thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="w-full h-full object-contain"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="text-text-hint text-font-size-12" style={{ fontFamily: FONT }}>
                        {isVideo ? '视频' : '图片'}
                      </span>
                    )}
                    {added && (
                      <span aria-label="已添加到时间线" className="absolute left-[8px] top-[8px] flex h-[24px] items-center gap-[4px] rounded-[4px] bg-transparent bg-gradient-to-b from-[rgba(0,0,0,0.6)] to-[rgba(0,0,0,0.6)] px-[8px] text-[12px] text-[#2DC3E1]" style={{ fontFamily: FONT_MEDIUM }}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M5.25 8.1L7.1 9.85L10.8 6.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>已添加</span>
                      </span>
                    )}
                    {showDuration && (
                      <span className="absolute right-[8px] top-[8px] flex h-[24px] items-center rounded-[4px] bg-transparent bg-gradient-to-b from-[rgba(0,0,0,0.6)] to-[rgba(0,0,0,0.6)] px-[8px] text-[12px] text-[rgba(255,255,255,0.8)]" style={{ fontFamily: FONT }}>
                        {formatTime(asset.duration)}
                      </span>
                    )}
                    <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[33.333%]" style={{ background: 'linear-gradient(to top, var(--color-black-50), transparent)' }} />
                    <span className="pointer-events-none absolute bottom-[4px] left-[8px] right-[32px] truncate text-text-primary text-font-size-14" style={{ fontFamily: FONT }}>
                      {asset.name || '未命名素材'}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`从素材区移除${asset.name || '素材'}`}
                    onClick={(event) => { event.stopPropagation(); onRemoveAsset?.(asset); }}
                    className="absolute bottom-[6px] right-[6px] hidden h-[20px] w-[20px] cursor-pointer items-center justify-center rounded-[4px] bg-black/40 text-[#FF4D5A] transition-colors hover:bg-black/65 hover:text-[#FF7A83] group-hover:flex focus-visible:flex focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#FF4D5A]"
                  >
                    <DeleteIcon size={16} color="currentColor" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
