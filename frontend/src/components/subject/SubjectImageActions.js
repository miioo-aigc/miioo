/**
 * @file SubjectImageActions.js
 * @structure-index
 *
 * ─── 主体图片业务动作适配 ───────────────────────────────────────────
 *   createSubjectImageActionHandlers  创建上传、下载、定稿动作回调
 *   handleUpload                      兼容资产选择和本地文件上传
 *   handleDownload                    下载主体图片并反馈结果
 *   handleSettledChange               切换定稿、同步封面和调用对应接口
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   仅依赖主体图片 API 和图片地址工具；状态 setter、Toast、封面回调与 Blob 下载由页面显式传入
 *   不引用 React、不创建隐式页面状态、不负责图片列表展示
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  抽离主体图片上传、下载和定稿动作适配，页面保留状态与反馈副作用
 *   2026-07-22  右侧候选图上传改走通用图片资产接口，不再写入主体参考图关系
 *   2026-07-28  普通项目资产通过 assets PATCH 支持设置/取消定稿，生成图仍走主体候选图接口
 *   2026-07-27  上传中的本地图片禁止提前定稿，避免临时 ID 触发无效请求
 *   2026-07-28  候选图新增时间字段，支持本地上传和资产库选择后的统一排序
 *   2026-07-28  本地候选图落库前使用加载占位，定稿成功后立即同步主体封面
 */
import {
  apiDownloadSubjectImage,
  apiGetSubjectDetail,
  apiSetPrimarySubjectImage,
  apiUnsetPrimarySubjectImage,
} from '../../api/subject';
import { apiUploadCreationImage } from '../../api/creation';
import { apiGetSubjectAssets, apiSetPrimarySubjectAsset, apiUpdateAsset } from '../../api/assets';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { invalidate } from '../../utils/cache';
import { K, MEDIUM } from '../../utils/cacheKeys';

function resolveSubjectImageId(detail, image) {
  const targetUrl = normalizeImageUrl(image?.rawUrl || image?.url);
  const payload = detail?.data && typeof detail.data === 'object' ? detail.data
    : detail?.result && typeof detail.result === 'object' ? detail.result
      : detail;
  const candidates = [
    ...(Array.isArray(payload?.candidate_images) ? payload.candidate_images : []),
    ...(Array.isArray(payload?.candidateImages) ? payload.candidateImages : []),
    ...(Array.isArray(payload?.images) ? payload.images : []),
    ...(payload?.primary_image ? [payload.primary_image] : []),
    ...(payload?.primaryImage ? [payload.primaryImage] : []),
  ];
  const matched = candidates.find((candidate) => {
    const candidateUrl = normalizeImageUrl(candidate?.image_url || candidate?.imageUrl || candidate?.url
      || candidate?.file_url || candidate?.fileUrl || candidate?.original_url || candidate?.originalUrl
      || candidate?.preview_url || candidate?.previewUrl || candidate?.large_url || candidate?.largeUrl);
    return targetUrl && candidateUrl && targetUrl === candidateUrl;
  });
  return matched?.id || matched?.image_id || matched?.imageId || matched?.subject_image_id || matched?.subjectImageId || null;
}

export function createSubjectImageActionHandlers({
  projectId,
  subjectId,
  subjectType = 'character',
  setGeneratedImages,
  onCoverChange,
  setPrimaryImageUrl,
  setPrimaryImageId,
  showToast,
  triggerBlobDownload,
}) {
  function handleUpload(fileOrAsset) {
    const selectedAssetId = fileOrAsset?.assetId || fileOrAsset?.asset_id || fileOrAsset?.id;
    if (fileOrAsset && typeof fileOrAsset === 'object' && selectedAssetId) {
      // 创作历史卡片的展示 ID 可能是 history-{id}-{index}，绑定主体必须使用真实资产 UUID。
      if (String(selectedAssetId).startsWith('history-')) {
        showToast('该创作历史图片没有可绑定的资产编号，请先保存到资产库', 'error');
        return;
      }
      const rawUrl = fileOrAsset.url
        || fileOrAsset.file_url
        || fileOrAsset.fileUrl
        || fileOrAsset.fullUrl
        || fileOrAsset.originalUrl
        || fileOrAsset.original_url
        || fileOrAsset.thumbnailUrl
        || fileOrAsset.thumbnail_url;

      setGeneratedImages((prev) => [{
        rawUrl,
        url: normalizeImageUrl(rawUrl),
        settled: false,
        id: selectedAssetId,
        assetId: selectedAssetId,
        source: 'creation-asset',
        detailSource: 'asset-library',
        prompt: fileOrAsset.prompt,
        input_prompt: fileOrAsset.input_prompt,
        model: fileOrAsset.model,
        ratio: fileOrAsset.ratio,
        resolution: fileOrAsset.resolution,
        // 资产库返回的时间优先；缺失时记录本次绑定时间，保证即时排序稳定。
        created_at: fileOrAsset.created_at || fileOrAsset.createdAt || Date.now(),
      }, ...prev]);
      apiUpdateAsset(selectedAssetId, { subject_id: subjectId, category: subjectType })
        .then(() => invalidate(K.projectAssets(projectId), MEDIUM.CONTENT))
        .catch((error) => {
          console.error('[SubjectPage] 绑定候选图资产失败:', error);
          setGeneratedImages((prev) => prev.filter((image) => image.assetId !== selectedAssetId));
          showToast(error.message || '保存候选图失败', 'error');
        });
      return;
    }

    if (!(fileOrAsset instanceof File)) return;

      const tempId = `upload-${Date.now()}`;
      setGeneratedImages((prev) => [{
      // 上传接口返回真实资产 URL 前不展示 blob 预览，避免后续接口刷新时出现黑色闪烁。
      rawUrl: null,
      url: null,
      settled: false,
      id: tempId,
      source: 'local-upload',
      detailSource: 'local-upload',
      uploading: true,
      created_at: Date.now(),
    }, ...prev]);

    if (projectId) {
      // 主体接口只提供参考图上传，没有候选图上传接口。
      // 右侧自定义图片必须走通用创作上传，不能写入主体 reference_images。
      apiUploadCreationImage({ file: fileOrAsset, category: subjectType, project_id: projectId })
        .then((response) => {
          const uploadedImage = response?.image || response?.asset || {};
          const realId = response?.asset_id || response?.id || uploadedImage.asset_id || uploadedImage.id;
          const realUrl = response?.uploaded_url
            || response?.uploadedUrl
            || response?.file_url
            || response?.url
            || uploadedImage.original_url
            || uploadedImage.originalUrl
            || uploadedImage.file_url
            || uploadedImage.url;
          if (!realId) throw new Error('上传候选图后未返回资产编号');
          const uploadedMetadata = typeof uploadedImage?.metadata_json === 'object'
            ? uploadedImage.metadata_json
            : {};
          return apiUpdateAsset(realId, {
            subject_id: subjectId,
            category: subjectType,
            // 资产 PATCH 不支持顶层 source_type，来源写入契约允许的扩展元数据，保证刷新后仍可区分本地上传。
            metadata_json: { ...uploadedMetadata, source_type: 'local-upload', origin: 'local-upload' },
          }).then(() => {
            // 主体页上传的本地图片属于项目主体资产，上传成功后必须让资产库重新读取。
            invalidate(K.projectAssets(projectId), MEDIUM.CONTENT);
            setGeneratedImages((prev) => prev.map((image) => (
              image.id === tempId
                ? {
                  ...image,
                  id: realId,
                  assetId: realId,
                  source: 'creation-asset',
                  detailSource: 'local-upload',
                  rawUrl: realUrl || null,
                  url: normalizeImageUrl(realUrl) || null,
                  uploading: false,
                  settled: false,
                }
                : image
            )));
          });
        })
        .catch((error) => {
          console.error('[SubjectPage] 上传候选图失败:', error);
          setGeneratedImages((prev) => prev.filter((image) => image.id !== tempId));
        });
    }
  }

  async function handleDownload(imageId) {
    try {
      const blob = await apiDownloadSubjectImage(projectId, subjectId, imageId);
      triggerBlobDownload(blob, `subject-image-${imageId}.jpg`);
      showToast('下载成功', 'success');
    } catch (error) {
      console.error('[SubjectPage] 下载图片失败:', error);
      showToast('下载失败', 'error');
    }
  }

  function handleSettledChange(image, index, newSettled) {
    if (newSettled) {
      const nextCoverUrl = image?.rawUrl ?? image?.url ?? null;
      onCoverChange?.(nextCoverUrl);
      // 主体候选图可能同时带有生成资产编号，但它仍应使用主体候选图定稿接口；
      // 只有候选区本地上传/资产库选择产生的 creation-asset 才走资产接口。
      const assetId = image.source === 'creation-asset' ? (image.assetId || image.id) : null;
      const temporaryId = String(image?.id || '').startsWith('batch-') || String(image?.id || '').startsWith('generated-');
      const setPrimaryRequest = assetId
        ? apiUnsetPrimarySubjectImage(projectId, subjectId)
          .then(() => apiSetPrimarySubjectAsset(projectId, subjectId, assetId, { category: subjectType }))
        : image.id && !temporaryId
          ? apiGetSubjectAssets(projectId, subjectId, { category: subjectType })
            .then((assets) => Promise.all(
              (assets || [])
                .filter((asset) => asset.is_primary)
                .map((asset) => apiUpdateAsset(asset.id || asset.asset_id, { is_primary: false }))
            ))
            .then(() => apiSetPrimarySubjectImage(projectId, subjectId, image.id))
          : apiGetSubjectDetail(projectId, subjectId)
            .then((detail) => {
              const realImageId = resolveSubjectImageId(detail, image);
              if (!realImageId) throw new Error('创作结果尚未同步到主体图片，请稍后重试');
              return apiSetPrimarySubjectImage(projectId, subjectId, realImageId);
            });

      setPrimaryRequest.catch((error) => {
        console.error('[SubjectPage] 设置定稿图失败:', error);
        showToast(error.message || '设置定稿图失败', 'error');
        setGeneratedImages((prev) => prev.map((item, itemIndex) => (
          itemIndex === index ? { ...item, settled: false } : item
        )));
      });
      // 先乐观更新卡片封面，接口完成后再次写回，覆盖上传/资产接口返回的最终地址。
      setPrimaryRequest.then((result) => {
        const persistedUrl = result?.file_url || result?.fileUrl || result?.url || result?.image_url;
        const persistedId = result?.id || result?.image_id || image.id;
        if (persistedUrl) {
          const normalizedUrl = normalizeImageUrl(persistedUrl);
          setGeneratedImages((prev) => prev.map((item) => (
            String(item.id) === String(image.id)
              ? { ...item, rawUrl: persistedUrl, url: normalizedUrl, uploading: false }
              : item
          )));
          onCoverChange?.(persistedUrl);
          setPrimaryImageUrl?.(normalizedUrl);
          setPrimaryImageId?.(persistedId);
        }
      }).catch(() => {});
      if (assetId) invalidate(K.projectAssets(projectId), MEDIUM.CONTENT);
    } else {
      onCoverChange?.(null);
      setPrimaryImageUrl(null);
      setPrimaryImageId(null);
      const assetId = image.source === 'creation-asset' ? (image.assetId || image.id) : null;
      const unsetRequest = assetId
        ? apiUpdateAsset(assetId, { is_primary: false })
          .then(() => apiUnsetPrimarySubjectImage(projectId, subjectId))
        : apiUnsetPrimarySubjectImage(projectId, subjectId);
      unsetRequest.catch((error) => {
        console.error('[SubjectPage] 取消定稿失败:', error);
        showToast(error.message || '取消定稿失败', 'error');
      });
      if (assetId) invalidate(K.projectAssets(projectId), MEDIUM.CONTENT);
    }

    setGeneratedImages((prev) => prev.map((item, itemIndex) => (
      itemIndex === index
        ? { ...item, settled: newSettled }
        : { ...item, settled: newSettled ? false : item.settled }
    )));
  }

  return { handleUpload, handleDownload, handleSettledChange };
}
