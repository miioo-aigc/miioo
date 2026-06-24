import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FONT, FONT_MEDIUM } from '../utils/fonts';
import { normalizeImageUrl } from '../utils/imageUrl';
import { buildPromptFromShot } from '../utils/storyboardHelpers';
import { apiUploadCreationImage, apiUploadCreationVideo, apiUploadCreationAudio } from '../api/creation';
import { apiListModels } from '../api/config';
import PanelPromptInput from './PanelPromptInput';
import PanelSelect from './PanelSelect';
import ImgUploadCard from './ImgUploadCard';
import ImgItem from './ImgItem';
import AssetPickerModal from './AssetPickerModal';
import RefSlotBtn from './RefSlotBtn';
import MediaViewModal from './MediaViewModal';
import MediaHoverPreview from './MediaHoverPreview';
import SpinnerIcon from './SpinnerIcon';
import ModalCloseBtn from './ModalCloseBtn';

export default function GenerateImagePanel({ shot, projectId, chars = [], scenes = [], props = [], onClose, onGenerate, onShowToast, generatedImages = [], onSetGeneratedImages, onSettleImage }) {
  const [modelList, setModelList] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [model, setModel] = useState('');
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await apiListModels({ category: 'image' });
        const list = Array.isArray(data) ? data : (data?.items || data?.models || []);
        const merged = list.map((m) => {
          const modelId = m.model_id || m.id;
          return { value: modelId, label: m.name || modelId, capabilities: m.capabilities || {}, is_default: m.is_default };
        });
        setModelList(merged);
        if (merged.length > 0) {
          const first = merged.find(m => m.is_default) || merged[0];
          setModel(first.value);
          const caps = first.capabilities;
          {
            const resList = (caps?.supported_resolutions?.length ? caps.supported_resolutions : caps?.supported_sizes) || [];
            if (resList.length > 0) setResolution(resList[0]);
          }
          {
            const durList = caps?.supported_durations;
            if (durList?.length > 0) setDuration(`${durList[0]}s`);
          }
        }
      } catch {
        setModelList([]);
      } finally {
        setModelsLoading(false);
      }
    })();
  }, []);

  const [prompt, setPrompt] = useState(() => buildPromptFromShot(shot));
  const [refImages, setRefImages] = useState(() => {
    const images = [];
    if (shot?.mainRefs?.length > 0) {
      shot.mainRefs.forEach(ref => {
        if (ref?.url && !ref.url.toLowerCase().endsWith(".avif") && !ref.url.includes("/derived/assets/")) { images.push(ref); return; }
        if (ref.type && ref.id) {
          const subjects = ref.type === 'char' ? chars : ref.type === 'scene' ? scenes : props;
          const found = subjects?.find(s => s.id === ref.id);
          if (found?.imageUrl) {
            images.push({ ...ref, url: normalizeImageUrl(found.imageUrl), name: found.name });
            return;
          }
        }
        if (ref?.url && !ref.url.toLowerCase().endsWith(".avif") && !ref.url.includes("/derived/assets/")) images.push(ref);
      });
    }
    return images;
  });
  const [refImgPickerOpen, setRefImgPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [btnHov, setBtnHov] = useState(false);
  const [btnPressed, setBtnPressed] = useState(false);
  const [viewImageUrl, setViewImageUrl] = useState(null);
  const [refImgPreview, setRefImgPreview] = useState(null);
  const refImgHoverTimer = useRef(null);
  const refFileRef = useRef(null);

  const currentModel = useMemo(() => modelList.find(m => m.value === model), [model, modelList]);
  const availableResolutions = (() => {
    const caps = currentModel?.capabilities || {};
    return (caps.supported_resolutions?.length ? caps.supported_resolutions : caps.supported_sizes) || [];
  })();

  const maxRefImages = currentModel?.capabilities?.max_reference_images;
  const refCountText = maxRefImages != null ? `${refImages.length}/${maxRefImages}` : null;
  const canAddRef = maxRefImages == null || refImages.length < maxRefImages;

  const currentResolutions = (() => {
    const caps = currentModel?.capabilities || {};
    return (caps.supported_resolutions?.length ? caps.supported_resolutions : caps.supported_sizes) || [];
  })();
  useEffect(() => {
    if (currentResolutions.length > 0) {
      if (!currentResolutions.includes(resolution)) {
        setResolution(currentResolutions[0]);
      }
    }
  }, [model, currentResolutions]);

  async function handleRefImageUpload(file) {
    try {
      const result = await apiUploadCreationImage({
        file,
        category: 'reference',
        project_id: projectId,
      });
      const uploadedUrl = result.uploaded_url || result.uploadedUrl || result.url || result.file_url || '';
      setRefImages(prev => [...prev, { id: result.id || result.asset_id || uploadedUrl, url: uploadedUrl, name: file.name }]);
      return result;
    } catch (error) {
      console.error('主体图上传失败:', error);
      onShowToast?.('主体图上传失败', 'error');
      throw error;
    }
  }

  function handleRefImageAssetConfirm(selectedAssets) {
    if (!selectedAssets || selectedAssets.length === 0) return;
    const newItems = selectedAssets.map(a => ({
      id: a.id,
      assetId: a.id,
      url: normalizeImageUrl(a.fileUrl || a.originalUrl || a.original_url || a.thumbnailUrl || a.thumbnail_url || a.url || a.file_url),
      name: a.name || a.filename || '',
    }));
    setRefImages(prev => {
      const merged = [...prev, ...newItems];
      return maxRefImages != null ? merged.slice(0, maxRefImages) : merged;
    });
    setRefImgPickerOpen(false);
  }

  async function handleRefFileChange(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) { onShowToast?.('抱歉，平台暂不支持上传20M以上的图片资源！', 'error'); continue; }
      try {
        await handleRefImageUpload(file);
      } catch (error) {}
    }
    e.target.value = '';
  }

  function removeRefImage(id) {
    setRefImages((prev) => prev.filter((img) => img.id !== id));
  }

  async function handleGenerate() {
    if (loading) return;
    setLoading(true);
    const placeholder = `pending-${Date.now()}`;
    onSetGeneratedImages((prev) => [{ url: null, settled: false, id: placeholder }, ...prev]);
    try {
      const result = await onGenerate?.({ model, resolution, prompt, refImages });
      onSetGeneratedImages((prev) =>
        prev.map((item) => item.id === placeholder ? { ...item, url: result?.url ?? null } : item)
      );
      onShowToast?.('图片生成成功', 'success');
    } catch (err) {
      onSetGeneratedImages((prev) => prev.filter((item) => item.id !== placeholder));
      const status = err?.status;
      const msg = err?.message || '';
      if (msg) {
        console.error('[GenerateImagePanel] 图片生成错误详情:', { status, msg, err });
      }
      if (status === 502 || status === 504 || msg.includes('fetch') || msg.includes('Network')) {
        onShowToast?.('生成服务暂时不可用，请稍后重试', 'error');
      } else if (status === 429) {
        onShowToast?.('生成请求过于频繁，请稍后再试', 'error');
      } else if (status === 401 || status === 403) {
        onShowToast?.('登录已过期，请重新登录', 'error');
      } else if (status === 422) {
        onShowToast?.(msg || '生成参数有误，请检查后重试', 'error');
      } else if (status) {
        onShowToast?.(msg || `生成失败（${status}），请稍后重试`, 'error');
      } else {
        onShowToast?.(msg || '生成失败，请检查网络连接后重试', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  const imageReferenceItems = useMemo(() => {
    const items = [];
    refImages.forEach((img) => {
      items.push({
        id: img.id,
        name: img.name || (img.url ? img.url.split('/').pop()?.split('?')[0]?.replace(/\.[^.]+$/, '') || '参考图' : '参考图'),
        type: 'image',
      });
    });
    chars.forEach((c) => {
      if (!items.some((i) => i.id === c.id)) {
        items.push({ id: c.id, name: c.name || '角色', type: 'character' });
      }
    });
    scenes.forEach((s) => {
      if (!items.some((i) => i.id === s.id)) {
        items.push({ id: s.id, name: s.name || '场景', type: 'scene' });
      }
    });
    props.forEach((p) => {
      if (!items.some((i) => i.id === p.id)) {
        items.push({ id: p.id, name: p.name || '道具', type: 'prop' });
      }
    });
    return items;
  }, [refImages, chars, scenes, props]);

  const btnBg = loading ? 'rgba(45,195,225,0.60)' : btnPressed ? '#28b0cc' : btnHov ? '#32cde8' : '#2DC3E1';

  return createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 900, pointerEvents: 'auto' }}
        onMouseDown={onClose}
      />
      <div
        style={{
          position: 'fixed', right: '24px', top: '60px', bottom: '24px',
          width: '600px', zIndex: 901,
          display: 'flex', flexDirection: 'column',
          backgroundColor: '#161616',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '-10px 24px 64px rgba(0,0,0,0.60)',
          animation: 'slideInRight 220ms cubic-bezier(0.22,1,0.36,1) forwards',
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', flexShrink: 0 }}>
          <span style={{ fontSize: '16px', lineHeight: '20px', color: '#FFFFFF', fontFamily: FONT_MEDIUM, fontWeight: 500 }}>生成分镜图</span>
          <ModalCloseBtn onClick={onClose} />
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: '419px', flexShrink: 0, padding: '8px 12px 80px 24px', gap: '20px', overflowY: 'auto' }}>
            <span style={{ fontSize: "14px", lineHeight: "18px", color: "rgba(255,255,255,0.80)", fontFamily: FONT }}>分镜{String(shot?.number ?? 1).padStart(2, "0")}</span>

            <PanelPromptInput value={prompt} onChange={setPrompt} referenceItems={imageReferenceItems} />
            <PanelSelect label="选择模型" value={modelsLoading ? '加载中...' : (modelList.find(m => m.value === model)?.label || '请选择')} options={modelList.map(m => m.label)} onChange={(label) => {
              const selected = modelList.find(m => m.label === label);
              if (selected) setModel(selected.value);
            }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", lineHeight: "18px", color: "rgba(255,255,255,0.60)", fontFamily: FONT }}>参考图</span>
                {refCountText && <span style={{ fontSize: "14px", lineHeight: "18px", color: "rgba(255,255,255,0.40)", fontFamily: FONT }}>{refCountText}</span>}
              </div>
              {canAddRef && <input ref={refFileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleRefFileChange} />}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {refImages.map((img) => (
                  <div
                    key={img.id}
                    onMouseEnter={(e) => {
                      const { clientX, clientY } = e;
                      clearTimeout(refImgHoverTimer.current);
                      refImgHoverTimer.current = setTimeout(() => {
                        if (img.url) setRefImgPreview({ url: img.url, x: clientX, y: clientY });
                      }, 500);
                    }}
                    onMouseMove={(e) => setRefImgPreview(p => p ? { ...p, x: e.clientX, y: e.clientY } : p)}
                    onMouseLeave={() => { clearTimeout(refImgHoverTimer.current); setRefImgPreview(null); }}
                    style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.12)' }}>
                    <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div
                      onClick={() => { clearTimeout(refImgHoverTimer.current); setRefImgPreview(null); removeRefImage(img.id); }}
                      style={{ position: 'absolute', top: '4px', right: '4px', width: '18px', height: '18px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.70)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    </div>
                  </div>
                ))}
                {canAddRef && (
                <div
                  style={{
                    width: '120px', height: '120px', borderRadius: '6px', flexShrink: 0,
                    border: '1px dashed rgba(255,255,255,0.08)',
                    backgroundColor: '#1D1E1E',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                >
                  <RefSlotBtn onClick={() => refFileRef.current?.click()}>本地上传</RefSlotBtn>
                  <RefSlotBtn onClick={() => setRefImgPickerOpen(true)}>从资产库选择</RefSlotBtn>
                </div>
                )}
              </div>
            </div>
            <AssetPickerModal accept="image" open={refImgPickerOpen} onClose={() => setRefImgPickerOpen(false)} projectId={projectId} preSelectedIds={refImages.map(img => img.assetId).filter(Boolean)} preSelectedUrls={refImages.map(img => img.url).filter(Boolean)} onConfirm={handleRefImageAssetConfirm} />

            <PanelSelect label="分辨率" value={resolution} options={availableResolutions} onChange={setResolution} />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '12px', paddingRight: '24px', paddingTop: '8px', paddingBottom: '8px', background: '#161616', height: '100%', boxSizing: 'border-box' }}>
            <ImgUploadCard
              projectId={projectId}
              onUpload={async (file) => {
                try {
                  const isVideo = file.type.startsWith('video/');
                  const isAudio = file.type.startsWith('audio/');
                  const maxSize = isVideo ? 200 * 1024 * 1024 : isAudio ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
                  const typeLabel = isVideo ? '视频' : isAudio ? '音频' : '图片';
                  if (file.size > maxSize) { alert(`抱歉，平台暂不支持上传${maxSize / 1024 / 1024}M以上的${typeLabel}资源！`); e.target.value = ''; return; }
                  const uploadFn = isVideo ? apiUploadCreationVideo : isAudio ? apiUploadCreationAudio : apiUploadCreationImage;
                  const result = await uploadFn({ file, category: 'reference', project_id: projectId });
                  const uploadedUrl = result.uploaded_url || result.uploadedUrl || result.url || result.file_url || '';
                  onSetGeneratedImages((prev) => [{ url: uploadedUrl, settled: false, id: result.asset_id || result.id || uploadedUrl }, ...prev]);
                  onSettleImage?.(uploadedUrl);
                } catch {
                  onShowToast?.('上传失败，请重试', 'error');
                }
              }}
              onAssetSelect={(assets) => {
                assets.forEach(a => {
                  const url = normalizeImageUrl(a.fileUrl || a.originalUrl || a.original_url || a.thumbnailUrl || a.thumbnail_url || a.url || a.file_url);
                  if (url) { onSetGeneratedImages((prev) => [{ url, settled: false, id: a.id || url }, ...prev]); onSettleImage?.(url); }
                });
              }}
            />
            {generatedImages.map((img, i) => (
              <ImgItem
                key={img.id ?? img.url + i}
                imageUrl={img.url}
                settled={img.settled}
                onView={setViewImageUrl}
                onSettledChange={(newSettled) => {
                  onSetGeneratedImages((prev) =>
                    prev.map((item, idx) =>
                      idx === i ? { ...item, settled: newSettled } : { ...item, settled: newSettled ? false : item.settled }
                    )
                  );
                  if (newSettled && img.url) onSettleImage?.(img.url);
                }}
              />
            ))}
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: '419px',
            padding: '16px 24px',
            background: '#161616',
            borderBottomLeftRadius: '16px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div
            onClick={loading ? undefined : handleGenerate}
            onMouseEnter={() => !loading && setBtnHov(true)}
            onMouseLeave={() => { setBtnHov(false); setBtnPressed(false); }}
            onMouseDown={() => !loading && setBtnPressed(true)}
            onMouseUp={() => setBtnPressed(false)}
            style={{
              display: 'inline-flex', alignItems: 'center', height: '36px', borderRadius: '8px', paddingInline: '16px', gap: '4px',
              backgroundColor: btnBg,
              backgroundImage: 'linear-gradient(in oklab 107.5deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)',
              backgroundOrigin: 'border-box',
              border: '1px solid #FFFFFF33', outline: '1px solid #00000080',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.10s',
              flexShrink: 0,
            }}
          >
            {loading ? (
              <SpinnerIcon color="#090909" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M3 5V3.188C3 2.891 3.029 2.783 3.083 2.674C3.138 2.566 3.218 2.481 3.32 2.422C3.422 2.364 3.523 2.333 3.801 2.333H12.199C12.477 2.333 12.578 2.364 12.68 2.422C12.782 2.481 12.862 2.566 12.916 2.674C12.971 2.783 13 2.891 13 3.188V5" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M1.667 5H14.333V13.667H1.667V5Z" stroke="#090909" strokeLinejoin="round" />
                <path fillRule="evenodd" clipRule="evenodd" d="M4.333 8.667C4.886 8.667 5.333 8.219 5.333 7.667C5.333 7.114 4.886 6.667 4.333 6.667C3.781 6.667 3.333 7.114 3.333 7.667C3.333 8.219 3.781 8.667 4.333 8.667Z" fill="#090909" />
                <path d="M1.856 13.463L5 10L6.667 11.333L8.667 9L14.131 13.463" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span style={{ fontSize: '14px', lineHeight: '18px', color: '#090909', fontFamily: FONT_MEDIUM, fontWeight: 500, whiteSpace: 'nowrap' }}>
              {loading ? '生成中…' : '生成分镜图'}
            </span>
          </div>
        </div>
      </div>
      {viewImageUrl && <MediaViewModal url={viewImageUrl} onClose={() => setViewImageUrl(null)} />}
      {refImgPreview && createPortal(
        <MediaHoverPreview url={refImgPreview.url} isVideo={false} mouseX={refImgPreview.x} mouseY={refImgPreview.y} />,
        document.body
      )}
    </>,
    document.body
  );
}
