/**
 * @file GenerateImagePanel.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────
 *   生成面板容器       负责图片生成表单、参考图编辑区和结果列表布局
 *   模型与分辨率状态   负责模型能力加载及当前分辨率联动
 *   GenerationModelField / GenerationOptionFields  参数选择纯展示组合
 *   ReferenceImageField  参考图展示、上传入口和删除回调组合
 *   GenerationSubmitButton  底部生成动作纯展示按钮
 *   参考图状态         负责本地上传、资产库选择、预览和删除
 *   生成结果状态       通过显式回调接收结果列表更新和定稿写回
 *   媒体详情弹窗       负责生成图片详情查看和下载交互
 *
 * ─── 依赖边界 ───────────────────────────────────────────────
 *   页面通过 props 注入页面级 UI、提示词构建器和业务回调；
 *   图片上传 API、模型 API 和资产选择能力在本组件内部使用；
 *   不引用页面入口、页面 Store 或页面闭包变量。
 */

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import AssetPickerModal from '../AssetPickerModal';
import MediaDetailModal from '../MediaDetailModal';
import { apiListModels } from '../../api/config';
import { apiUploadCreationAudio, apiUploadCreationImage, apiUploadCreationVideo } from '../../api/creation';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { normalizeStoryboardModelList } from '../../utils/storyboardModelAdapter';
import { GenerationModelField, GenerationOptionFields } from './GenerationParamsFields';
import GenerationSubmitButton from './GenerationSubmitButton';
import ReferenceImageField from './ReferenceImageField';
import { ImgUploadCard } from './StoryboardImageUpload';
import ImageResultCard from './ImageResultCard';

const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

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
  embedded = false,
  onCandidateMedia,
  formState,
  onFormStateChange,
}) {
  const [modelList, setModelList] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [model, setModel] = useState(() => formState?.model || '');
  const [resolution, setResolution] = useState(() => formState?.resolution || '');

  useEffect(() => {
    (async () => {
      try {
        const data = await apiListModels({ category: 'image' });
        const merged = normalizeStoryboardModelList(data, 'image');
        setModelList(merged);
        if (merged.length > 0) {
          const first = merged.find(m => m.is_default) || merged[0];
          const restoredModel = formState?.model && merged.some((item) => item.value === formState.model)
            ? formState.model
            : first.value;
          setModel(restoredModel);
          const caps = first.capabilities;
          {
            const resList = (caps?.supported_resolutions?.length ? caps.supported_resolutions : caps?.supported_sizes) || [];
            if (resList.length > 0 && !formState?.resolution) setResolution(resList[0]);
          }
        }
      } catch {
        setModelList([]);
      } finally {
        setModelsLoading(false);
      }
    })();
  }, [formState?.model, formState?.resolution]);
  // 提示词：仅暂存在当前弹窗的本地 state，编辑不回写分镜列表字段。
  // 关闭面板时组件卸载、本地态丢弃，下次打开按 shot 当前字段重新生成初始内容。
  // 点击「生成分镜图」时才把 prompt 随 onGenerate 传回后端。
  const [prompt, setPrompt] = useState(() => formState?.prompt ?? buildStoryboardPrompt(shot));
  const [refImages, setRefImages] = useState(() => {
    if (formState?.refImages) return formState.refImages;
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
  const [mediaDetailOpen, setMediaDetailOpen] = useState(false);
  const [mediaDetailActiveIdx, setMediaDetailActiveIdx] = useState(0);

  useEffect(() => {
    onFormStateChange?.({ model, resolution, prompt, refImages });
  }, [model, resolution, prompt, refImages, onFormStateChange]);

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

  async function handleRefFileChange(files) {
    // ReferenceImageField 已将原生 change 事件转换为文件数组；这里不要再读取 target.files。
    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) return;

    for (const file of selectedFiles) {
      if (file.size > 20 * 1024 * 1024) { onShowToast?.('抱歉，平台暂不支持上传20M以上的图片资源！', 'error'); continue; }
      try {
        await handleRefImageUpload(file);
      } catch {
        // 错误已在 handleRefImageUpload 中处理
        // 继续处理下一个文件
      }
    }
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


  const content = (
    <>
      {/* 点击空白关闭 */}
      {!embedded && <div
        style={{ position: 'fixed', inset: 0, zIndex: 900, pointerEvents: 'auto' }}
        onMouseDown={onClose}
      />}
      <div
        style={{
          position: embedded ? 'relative' : 'fixed', right: embedded ? undefined : '24px', top: embedded ? undefined : '60px', bottom: embedded ? undefined : '24px',
          width: embedded ? '100%' : '600px', height: embedded ? '100%' : undefined, zIndex: embedded ? undefined : 901,
          display: 'flex', flexDirection: 'column',
          backgroundColor: '#161616',
          borderRadius: embedded ? 0 : '12px',
          border: embedded ? 0 : '1px solid rgba(255,255,255,0.08)',
          boxShadow: embedded ? 'none' : '-10px 24px 64px rgba(0,0,0,0.60)',
          animation: embedded ? 'none' : 'slideInRight 220ms cubic-bezier(0.22,1,0.36,1) forwards',
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {!embedded && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', flexShrink: 0 }}>
          <span style={{ fontSize: '16px', lineHeight: '20px', color: '#FFFFFF', fontFamily: FONT_MEDIUM, fontWeight: 500 }}>生成分镜图</span>
          <ModalCloseBtn onClick={onClose} />
        </div>}

        {/* 内容区：左表单 + 右预览 */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* 左侧表单 */}
          <div style={{ display: 'flex', flexDirection: 'column', width: embedded ? '457px' : '419px', flexShrink: 0, padding: embedded ? '12px 16px 80px 24px' : '8px 12px 80px 24px', gap: '20px', overflowY: 'auto', boxSizing: 'border-box' }}>
            <PanelPromptInput value={prompt} onChange={setPrompt} referenceItems={imageReferenceItems} />
            <GenerationModelField
              value={modelsLoading ? '加载中...' : (modelList.find(m => m.value === model)?.label || '请选择')}
              options={modelList.map(m => m.label)}
              onChange={handleModelChange}
              disabled={modelsLoading}
            />

            <ReferenceImageField
              images={refImages}
              countLabel={refCountText}
              canAdd={canAddRef}
              onFilesSelected={handleRefFileChange}
              onRemove={removeRefImage}
              onOpenAssetPicker={() => setRefImgPickerOpen(true)}
            />
            <AssetPickerModal accept="image" open={refImgPickerOpen} onClose={() => setRefImgPickerOpen(false)} projectId={projectId} preSelectedIds={refImages.map(img => img.assetId).filter(Boolean)} preSelectedUrls={refImages.map(img => img.url).filter(Boolean)} onConfirm={handleRefImageAssetConfirm} />

            <GenerationOptionFields resolution={resolution} resolutionOptions={availableResolutions} onResolutionChange={setResolution} />

          </div>

          {/* 右侧图片列表 */}
          <div style={{ display: embedded ? 'none' : 'flex', flex: 1, overflowY: 'auto', flexDirection: 'column', gap: '12px', paddingLeft: '12px', paddingRight: '24px', paddingTop: '8px', paddingBottom: '8px', background: '#161616', height: '100%', boxSizing: 'border-box' }}>
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
                  const candidate = { url: normalizeImageUrl(uploadedUrl), settled: false, id: result.asset_id || result.id || uploadedUrl, asset_id: result.asset_id || result.assetId || null, media_type: 'image', source: 'local-upload' };
                  onSetGeneratedImages((prev) => [candidate, ...prev]);
                  onCandidateMedia?.(candidate);
                } catch {
                  onShowToast?.('上传失败，请重试', 'error');
                }
              }}
              onAssetSelect={(assets) => {
                assets.forEach(a => {
                  const url = normalizeImageUrl(a.fileUrl || a.originalUrl || a.original_url || a.thumbnailUrl || a.thumbnail_url || a.url || a.file_url);
                  // 仅加入候选列表，不自动定稿；只有勾选「定稿」才会传入封面
                  if (url) {
                    const candidate = { url, settled: false, id: a.id || url, asset_id: a.asset_id || a.assetId || a.id || null, media_type: 'image', source: 'asset-library' };
                    onSetGeneratedImages((prev) => [candidate, ...prev]);
                    onCandidateMedia?.(candidate);
                  }
                });
              }}
            />
            {generatedImages.map((img, i) => (
              <ImageResultCard
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
                onDownload={(imageUrl) => {
                  if (!imageUrl) return;
                  const link = document.createElement('a');
                  link.href = imageUrl;
                  link.download = imageUrl.split('/').pop() || 'image.jpg';
                  link.click();
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
            width: embedded ? '457px' : '419px',
            padding: '16px 24px',
            background: '#161616',
            borderBottomLeftRadius: '16px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <GenerationSubmitButton
            loading={loading}
            label="生成分镜图"
            type="image"
            onClick={handleGenerate}
          />
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

    </>
  );
  return embedded ? content : createPortal(content, document.body);
}
