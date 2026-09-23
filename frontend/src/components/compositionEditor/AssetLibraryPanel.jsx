import { useMemo, useState } from 'react';
import { Tabs } from '../ui';
import { formatTime, useCompositionEditorStore } from '../../stores/compositionEditorStore';

const FONT = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function AudioIcon({ color = 'currentColor' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M8 2.667L3.333 5.333V10.667L8 13.333L12.667 10.667V5.333L8 2.667Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M8 6V9.667" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export default function AssetLibraryPanel({ albumState, onFetch, episodeNumber }) {
  const [mediaType, setMediaType] = useState('video');
  const addAsset = useCompositionEditorStore((s) => s.addAsset);
  const select = useCompositionEditorStore((s) => s.select);
  const segments = useCompositionEditorStore((s) => s.segments);

  const addedSet = useMemo(
    () => new Set(segments.map((s) => s.assetId)),
    [segments],
  );

  const assets = (albumState.assets || []).filter((asset) => asset.asset_type === mediaType
    && (episodeNumber == null || asset.episode_number == null || String(asset.episode_number) === String(episodeNumber)));

  const handleClick = (asset) => {
    if (addedSet.has(asset.id)) {
      const seg = segments.find((s) => s.assetId === asset.id);
      if (seg) select(seg.id);
      return;
    }
    addAsset(asset);
  };

  return (
    <aside className="w-[352px] max-w-[28%] min-w-0 shrink-0 flex flex-col gap-[8px] bg-neutral-200 overflow-hidden px-[12px] py-[8px]">
      <Tabs options={[{ value: 'video', label: '视频' }, { value: 'image', label: '图片' }, { value: 'audio', label: '音频' }]} value={mediaType} onChange={setMediaType} gap="12px" variant="plain-ghost" />
      <div className="min-h-0 flex-1 overflow-y-auto">
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

        {!albumState.loading && !albumState.error && assets.length === 0 && (
          <div className="py-[32px] text-center">
            <span className="text-text-hint text-font-size-14">
              当前分类暂无素材
            </span>
          </div>
        )}

        {!albumState.loading && !albumState.error && assets.length > 0 && (
          <div className="grid grid-cols-2 gap-[8px]">
            {assets.map((asset) => {
              const added = addedSet.has(asset.id);
              const isVideo = asset.asset_type === 'video';
              const isAudio = asset.asset_type === 'audio';
              const thumb = asset.thumbnailUrl || asset.posterUrl;
              return (
                <button
                  type="button"
                  key={asset.id}
                  onClick={() => handleClick(asset)}
                  title={`${asset.name || '未命名素材'}${asset.duration != null ? ` · ${formatTime(asset.duration)}` : ''}`}
                  className={`relative flex flex-col items-start gap-[6px] min-w-0 w-full overflow-hidden rounded-medium border p-[6px] cursor-pointer text-left transition-colors ${
                    added
                      ? 'bg-white-10 border-stroke-active'
                      : 'bg-surface-card border-stroke-normal hover:border-stroke-accent'
                  }`}
                >
                  <span className="flex items-center justify-center w-full aspect-video rounded-small bg-neutral-500 overflow-hidden shrink-0">
                    {isAudio ? (
                      <span className="text-text-secondary"><AudioIcon /></span>
                    ) : thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="text-text-hint text-font-size-12" style={{ fontFamily: FONT }}>
                        {isVideo ? '视频' : '图片'}
                      </span>
                    )}
                  </span>

                  <span
                    className="flex-1 min-w-0 truncate text-text-secondary text-font-size-12"
                    style={{ fontFamily: FONT }}
                  >
                    {asset.name || '未命名素材'}
                  </span>

                  {asset.duration != null && (
                    <span className="shrink-0 text-text-hint text-font-size-12" style={{ fontFamily: FONT }}>
                      {formatTime(asset.duration)}
                    </span>
                  )}

                  {added && (
                    <span className="shrink-0 px-[6px] py-[2px] rounded-small bg-tag-bg-blue border border-tag-border text-tag-text-blue text-font-size-12 font-font-weight-medium" style={{ fontFamily: FONT_MEDIUM }}>
                      已添加
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
