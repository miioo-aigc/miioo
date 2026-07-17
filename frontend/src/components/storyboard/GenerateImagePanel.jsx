/**
 * @file GenerateImagePanel.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────
 *   生成面板容器       负责图片生成表单、参考图编辑区和结果列表布局
 *   模型与分辨率状态   负责模型能力加载及当前分辨率联动
 *   参考图状态         负责本地上传、资产库选择、预览和删除
 *   生成结果状态       通过显式回调接收结果列表更新和定稿写回
 *   媒体详情弹窗       负责生成图片详情查看和下载交互
 *
 * ─── 依赖边界 ───────────────────────────────────────────────
 *   页面通过 props 注入页面级 UI、提示词构建器和业务回调；
 *   图片上传 API、模型 API 和资产选择能力在本组件内部使用；
 *   不引用页面入口、页面 Store 或页面闭包变量。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AssetPickerModal from '../AssetPickerModal';
import MediaDetailModal from '../MediaDetailModal';
import DotsLoading from '../DotsLoading';
import { apiListModels } from '../../api/config';
import { apiUploadCreationAudio, apiUploadCreationImage, apiUploadCreationVideo } from '../../api/creation';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { normalizeStoryboardModelList } from '../../utils/storyboardModelAdapter';
import { MediaHoverPreview as StoryboardMediaHoverPreview } from './MainRefCol';
import PanelSelect from './PanelSelect';
import { ImgUploadCard, ImgItem } from './StoryboardImageUpload';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function SpinnerIcon({ color = '#090909' }) {
  return <DotsLoading size={3} color={color} gap={2} />;
}

export default function GenerateImagePanel({
  shot,
  projectId,
  chars = [],
  scenes = [],
  props = [],
  onClose,
  onGenerate,
  onShowToast,
  generatedImages = [],
  onSetGeneratedImages,
  onSettleImage,
  projectRatio,
  buildStoryboardPrompt,
  ModalCloseBtn,
  PanelPromptInput,
  RefSlotBtn,
}) {
  const [modelList, setModelList] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [model, setModel] = useState('');
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await apiListModels({ category: 'image' });
        const merged = normalizeStoryboardModelList(data, 'image');
        setModelList(merged);
        if (merged.length > 0) {
          const first = merged.find(m => m.is_default) || merged[0];
          setModel(first.value);
          const caps = first.capabilities;
          {
            const resList = (caps?.supported_resolutions?.length ? caps.supported_resolutions : caps?.supported_sizes) || [];
            if (resList.length > 0) setResolution(resList[0]);
          }
        }
      } catch {
        setModelList([]);
      } finally {
        setModelsLoading(false);
      }
    })();
  }, []);
  // 提示词：仅暂存在当前弹窗的本地 state，编辑不回写分镜列表字段。
  // 关闭面板时组件卸载、本地态丢弃，下次打开按 shot 当前字段重新生成初始内容。
  // 点击「生成分镜图」时才把 prompt 随 onGenerate 传回后端。
  const [prompt, setPrompt] = useState(() => buildStoryboardPrompt(shot));
  const [refImages, setRefImages] = useState(() => {
    const images = [];
    // 添加主体参考图——为项目主体补全 url/name（否则标签丢失 type 会变紫色）
    if (shot?.mainRefs?.length > 0) {
      shot.mainRefs.forEach(ref => {
        if (ref?.url && !ref.url.toLowerCase().endsWith(".avif") && !ref.url.includes("/derived/assets/")) { images.push(ref); return; }
        // 从 chars/scenes/props 中查找补齐 url 和 name
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
  const [mediaDetailOpen, setMediaDetailOpen] = useState(false);
  const [mediaDetailActiveIdx, setMediaDetailActiveIdx] = useState(0);
  const [refImgPreview, setRefImgPreview] = useState(null); // { url, x, y }
  const refImgHoverTimer = useRef(null);
  const refFileRef = useRef(null);

  // 获取当前模型支持的分辨率（从后端 capabilities 派生）
  const currentModel = useMemo(() => modelList.find(m => m.value === model), [model, modelList]);
  const availableResolutions = (() => {
    const caps = currentModel?.capabilities || {};
    const allRes = (caps.supported_resolutions?.length ? caps.supported_resolutions : caps.supported_sizes) || [];
    if (projectRatio && currentModel?.resolutionSizeMap) {
      return allRes.filter(r => {
        const ratios = currentModel.resolutionSizeMap[r] || {};
        return Object.keys(ratios).length === 0 || Object.keys(ratios).includes(projectRatio);
      });
    }
    return allRes;
  })();

  const maxRefImages = currentModel?.capabilities?.max_reference_images;
  const refCountText = maxRefImages != null ? `${refImages.length}/${maxRefImages}` : null;
  const canAddRef = maxRefImages == null || refImages.length < maxRefImages;

  // 当模型切换时，重置分辨率
  function handleModelChange(label) {
    const selected = modelList.find((item) => item.label === label);
    if (!selected) return;

    setModel(selected.value);
    const capabilities = selected.capabilities || {};
    const resolutions = (capabilities.supported_resolutions?.length
      ? capabilities.supported_resolutions
      : capabilities.supported_sizes) || [];
    const compatibleResolutions = projectRatio && selected.resolutionSizeMap
      ? resolutions.filter((item) => {
          const ratios = selected.resolutionSizeMap[item] || {};
          return Object.keys(ratios).length === 0 || Object.keys(ratios).includes(projectRatio);
        })
      : resolutions;
    if (compatibleResolutions.length > 0 && !compatibleResolutions.includes(resolution)) {
      setResolution(compatibleResolutions[0]);
    }
  }

  async function handleRefImageUpload(file) {
    try {
      const result = await apiUploadCreationImage({
        file,
        category: 'reference',
        project_id: projectId,
      });
      const uploadedUrl = result.uploaded_url || result.uploadedUrl || result.url || result.file_url || '';

      // 添加到参考图列表（不再自动插入提示词标签，标签由用户手动 @ 引入）
      setRefImages(prev => [...prev, { id: result.id || result.asset_id || uploadedUrl, url: uploadedUrl, name: file.name }]);

      return result;
    } catch (error) {
      console.error('主体图上传失败:', error);
      onShowToast?.('主体图上传失败', 'error');
      throw error;
    }
  }

  // 从资产库选择参考图
  function handleRefImageAssetConfirm(selectedAssets) {
    if (!selectedAssets || selectedAssets.length === 0) return;
    const newItems = selectedAssets.map(a => ({
      id: a.id,
      assetId: a.id, // 标记来自资产库，用于 preSelectedIds 匹配
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
      } catch {
        // 错误已在 handleRefImageUpload 中处理
        // 继续处理下一个文件
      }
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
    const refImagesSnapshot = refImages.map(r => ({ url: r.url, fileUrl: r.url }));
    onSetGeneratedImages((prev) => [{ url: null, settled: false, id: placeholder, refImages: refImagesSnapshot, prompt, model, resolution, created_at: new Date().toISOString().replace('T', ' ').slice(0, 19) }, ...prev]);
    try {
      const result = await onGenerate?.({ model, resolution, prompt, refImages });
      onSetGeneratedImages((prev) =>
        prev.map((item) => item.id === placeholder ? { ...item, url: result?.url ?? null, created_at: item.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19) } : item)
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
    return refImages.map((img) => ({
      id: img.id,
      name: img.name || (img.url ? img.url.split('/').pop()?.split('?')[0]?.replace(/\.[^.]+$/, '') || '参考图' : '参考图'),
      _type: 'image',
    }));
  }, [refImages]);

  const btnBg = loading ? 'rgba(45,195,225,0.60)' : btnPressed ? '#28b0cc' : btnHov ? '#32cde8' : '#2DC3E1';

  return createPortal(
    <>
      {/* 点击空白关闭 */}
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
        {/* 标题栏 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', flexShrink: 0 }}>
          <span style={{ fontSize: '16px', lineHeight: '20px', color: '#FFFFFF', fontFamily: FONT_MEDIUM, fontWeight: 500 }}>生成分镜图</span>
          <ModalCloseBtn onClick={onClose} />
        </div>

        {/* 内容区：左表单 + 右预览 */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* 左侧表单 */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '419px', flexShrink: 0, padding: '8px 12px 80px 24px', gap: '20px', overflowY: 'auto' }}>
            <span style={{ fontSize: "14px", lineHeight: "18px", color: "rgba(255,255,255,0.80)", fontFamily: FONT }}>分镜{String(shot?.number ?? 1).padStart(2, "0")}</span>

            <PanelPromptInput value={prompt} onChange={setPrompt} referenceItems={imageReferenceItems} />
            <PanelSelect
              label="选择模型"
              value={modelsLoading ? '加载中...' : (modelList.find(m => m.value === model)?.label || '请选择')}
              options={modelList.map(m => m.label)}
              onChange={handleModelChange}
            />

            {/* 参考图 — 多张 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' }}>
              <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", gap: "8px" }}>
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
                    <img src={normalizeImageUrl(img.url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

          {/* 右侧图片列表 */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '12px', paddingRight: '24px', paddingTop: '8px', paddingBottom: '8px', background: '#161616', height: '100%', boxSizing: 'border-box' }}>
            <ImgUploadCard
              projectId={projectId}
              onUpload={async (file) => {
                try {
                  const isVideo = file.type.startsWith('video/');
                  const isAudio = file.type.startsWith('audio/');
                  const maxSize = isVideo ? 200 * 1024 * 1024 : isAudio ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
                  const typeLabel = isVideo ? '视频' : isAudio ? '音频' : '图片';
                 if (file.size > maxSize) { alert(`抱歉，平台暂不支持上传${maxSize / 1024 / 1024}M以上的${typeLabel}资源！`); return; }
                 const uploadFn = isVideo ? apiUploadCreationVideo : isAudio ? apiUploadCreationAudio : apiUploadCreationImage;
                  const result = await uploadFn({ file, category: 'reference', project_id: projectId });
                  const uploadedUrl = result.uploaded_url || result.uploadedUrl || result.url || result.file_url || '';
                  // 仅加入候选列表，不自动定稿；只有勾选「定稿」才会传入封面
                  onSetGeneratedImages((prev) => [{ url: uploadedUrl, settled: false, id: result.asset_id || result.id || uploadedUrl }, ...prev]);
                } catch {
                  onShowToast?.('上传失败，请重试', 'error');
                }
              }}
              onAssetSelect={(assets) => {
                assets.forEach(a => {
                  const url = normalizeImageUrl(a.fileUrl || a.originalUrl || a.original_url || a.thumbnailUrl || a.thumbnail_url || a.url || a.file_url);
                  // 仅加入候选列表，不自动定稿；只有勾选「定稿」才会传入封面
                  if (url) { onSetGeneratedImages((prev) => [{ url, settled: false, id: a.id || url }, ...prev]); }
                });
              }}
            />
            {generatedImages.map((img, i) => (
              <ImgItem
                key={img.id ?? img.url + i}
                imageUrl={img.url}
                settled={img.settled}
                onView={() => { setMediaDetailActiveIdx(i); setMediaDetailOpen(true); }}
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

        {/* footer: 生成按钮 — 绝对定位于底部 */}
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
      {mediaDetailOpen && (
        <MediaDetailModal
          zIndex={902}
          mode="image"
          source="ai-generated"
          images={generatedImages.filter(img => img.url).map(img => ({
            id: img.id,
            url: img.url,
            fileUrl: img.url,
            is_primary: img.settled ?? false,
            prompt: img.prompt || prompt,
            model: img.model || model,
            resolution: img.resolution || resolution,
            created_at: img.created_at,
            refImages: (img.refImages && img.refImages.length > 0) ? img.refImages : refImages.filter(r => r.url).map(r => ({ url: normalizeImageUrl(r.url || r.fileUrl || ''), fileUrl: r.url })),
          }))}
          name={`镜头 ${String(shot?.number ?? 1).padStart(2, '0')}`}
          shotNumber={`镜头 ${String(shot?.number ?? 1).padStart(2, '0')}`}
          generatedAt={generatedImages[mediaDetailActiveIdx]?.created_at || null}
          showDelete={false}
          showDownload={true}
          activeIndex={mediaDetailActiveIdx}
          onClose={() => setMediaDetailOpen(false)}
          onDownload={(imageId, fileUrl) => {
            const a = document.createElement('a');
            a.href = fileUrl || generatedImages[mediaDetailActiveIdx]?.url;
            a.download = `storyboard-image-${imageId || 'download'}.jpg`;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }}
        />
      )}
      {refImgPreview && createPortal(
        <StoryboardMediaHoverPreview url={refImgPreview.url} isVideo={false} mouseX={refImgPreview.x} mouseY={refImgPreview.y} />,
        document.body
      )}
    </>,
    document.body
  );
}
