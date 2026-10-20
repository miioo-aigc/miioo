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
 *   下载反馈通过全局下载 Toast/进度反馈统一承接
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-10-19  手动定稿开始即登记共享版本，等待此前自动封面写入完成后再提交
 *   2026-10-19  上传校验面板会话与目标编号，失败反馈并清理占位，本地上传使用独立编号
 *   2026-10-19  定稿操作共享面板互斥，成功后按图片身份更新；封面同步不重复写接口
 *   2026-09-18  下载入口接入全局下载 Toast/进度反馈
 *   2026-07-15  抽离主体图片上传、下载和定稿动作适配，页面保留状态与反馈副作用
 *   2026-07-22  右侧候选图上传改走通用图片资产接口，不再写入主体参考图关系
 *   2026-07-28  普通项目资产通过 assets PATCH 支持设置/取消定稿，生成图仍走主体候选图接口
 *   2026-07-27  上传中的本地图片禁止提前定稿，避免临时 ID 触发无效请求
 *   2026-07-28  候选图新增时间字段，支持本地上传和资产库选择后的统一排序
 *   2026-07-28  本地候选图落库前使用加载占位，定稿成功后立即同步主体封面
 *   2026-08-05  适配主体候选图专用上传/资产登记接口，候选图操作与源资产操作彻底分离
 *   2026-08-05  资产库选择改走主体 from-asset 接口，由后端创建独立候选资产并保留源资产关系
 *   2026-08-05  锁定资产登记期间的定稿入口，避免临时 ID 提前提交
 */
import {
  apiDownloadSubjectImage,
  apiAddSubjectImageFromAsset,
  apiGetSubjectDetail,
  apiSetPrimarySubjectImage,
  apiUploadSubjectCandidateImage,
  apiUnsetPrimarySubjectImage,
} from '../../api/subject';
import { mapSubjectImageResponse } from './SubjectImageMappers';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { startDownloadFeedback } from '../../utils/downloadFeedback';

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
  generatedImages = [],
  uploadingAssetIdsRef,
  primaryOperationRef,
  beforeManualPrimary,
  isCurrent,
  setGeneratedImages,
  onCoverChange,
  setPrimaryImageUrl,
  setPrimaryImageId,
  showToast,
  triggerBlobDownload,
}) {
  function handleUpload(fileOrAsset) {
    if (!isCurrent()) return;
    if (!projectId || !subjectId) {
      showToast('缺少项目或主体信息，请重新打开主体后再添加图片', 'error');
      return;
    }
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

      const normalizedAssetId = String(selectedAssetId);
      const normalizedUrl = normalizeImageUrl(rawUrl) || rawUrl;
      if (uploadingAssetIdsRef?.current?.has(normalizedAssetId)) {
        showToast('这张图片正在添加，请勿重复选择', 'error');
        return;
      }
      const alreadyAdded = (Array.isArray(generatedImages) ? generatedImages : []).some((image) => {
        const imageId = image?.assetId || (image?.source === 'creation-asset' ? image?.id : null);
        const imageUrl = normalizeImageUrl(image?.rawUrl || image?.url) || image?.rawUrl || image?.url;
        return (image?.sourceAssetId != null && String(image.sourceAssetId) === normalizedAssetId)
          || (imageId != null && String(imageId) === normalizedAssetId)
          || (normalizedUrl && imageUrl === normalizedUrl);
      });
      if (alreadyAdded) {
        showToast('这张图片已在候选列表中', 'error');
        return;
      }
      uploadingAssetIdsRef?.current?.add(normalizedAssetId);

      const assetPlaceholderId = `asset-upload-${normalizedAssetId}`;
      setGeneratedImages((prev) => !isCurrent() ? prev : [{
        rawUrl,
        url: normalizedUrl,
        settled: false,
        id: assetPlaceholderId,
        assetId: normalizedAssetId,
        sourceAssetId: normalizedAssetId,
        source: 'asset-library',
        detailSource: 'asset-library',
        uploading: true,
        panelUpload: true,
        prompt: fileOrAsset.prompt,
        input_prompt: fileOrAsset.input_prompt,
        model: fileOrAsset.model,
        ratio: fileOrAsset.ratio,
        resolution: fileOrAsset.resolution,
        // 资产库返回的时间优先；缺失时记录本次绑定时间，保证即时排序稳定。
        created_at: fileOrAsset.created_at || fileOrAsset.createdAt || Date.now(),
      }, ...prev]);
      // 交给后端按目标主体创建独立候选资产，并保留 source_asset_id 等源资产关系。
      // 不再由前端下载后重新上传，避免额外的异步窗口和刷新后丢失源资产血缘。
      return apiAddSubjectImageFromAsset(projectId, subjectId, normalizedAssetId)
        .then((response) => {
          if (!isCurrent()) return;
          const mapped = mapSubjectImageResponse(response);
          if (!mapped) throw new Error('资产库图片登记成功，但未返回主体候选图');
          setGeneratedImages((prev) => !isCurrent() ? prev : prev.map((image) => (
            image.id === assetPlaceholderId
              ? {
                ...mapped,
                source: 'subject-image',
                detailSource: 'asset-library',
                sourceAssetId: normalizedAssetId,
                uploading: false,
                panelUpload: true,
              }
              : image
          )));
        })
        .catch((error) => {
          if (!isCurrent()) return;
          console.error('[SubjectPage] 登记候选图资产失败:', error);
          setGeneratedImages((prev) => !isCurrent() ? prev : prev.filter((image) => image.id !== assetPlaceholderId));
          showToast(error?.message || '保存候选图失败，请刷新确认后重试', 'error');
        })
        .finally(() => {
          uploadingAssetIdsRef?.current?.delete(normalizedAssetId);
        });
    }

    if (!(fileOrAsset instanceof File)) return;

    const tempId = `upload-${crypto.randomUUID()}`;
    setGeneratedImages((prev) => !isCurrent() ? prev : [{
      // 上传接口返回真实资产 URL 前不展示 blob 预览，避免后续接口刷新时出现黑色闪烁。
      rawUrl: null,
      url: null,
      settled: false,
      id: tempId,
      source: 'local-upload',
      detailSource: 'local-upload',
      uploading: true,
      panelUpload: true,
      created_at: Date.now(),
    }, ...prev]);

    return apiUploadSubjectCandidateImage(projectId, subjectId, fileOrAsset)
        .then((response) => {
          if (!isCurrent()) return;
          const mapped = mapSubjectImageResponse(response);
          if (!mapped) throw new Error('上传候选图成功，但未返回主体候选图');
          setGeneratedImages((prev) => !isCurrent() ? prev : prev.map((image) => (
            image.id === tempId
              ? { ...mapped, source: 'subject-image', detailSource: 'local-upload', uploading: false, panelUpload: true }
              : image
          )));
        })
        .catch((error) => {
          if (!isCurrent()) return;
          console.error('[SubjectPage] 上传候选图失败:', error);
          setGeneratedImages((prev) => !isCurrent() ? prev : prev.filter((image) => image.id !== tempId));
          showToast(error?.message || '上传候选图失败，请刷新确认后重试', 'error');
        });
  }

  async function handleDownload(imageId) {
    const feedback = startDownloadFeedback();
    try {
      const blob = await apiDownloadSubjectImage(projectId, subjectId, imageId, { onProgress: feedback.setProgress });
      triggerBlobDownload(blob, `subject-image-${imageId}.jpg`);
      await feedback.complete('下载成功');
    } catch (error) {
      console.error('[SubjectPage] 下载图片失败:', error);
      await feedback.fail(error?.message || '下载失败，请重试');
    }
  }

  async function handleSettledChange(image, _index, newSettled) {
    if (!isCurrent()) return;
    if (primaryOperationRef.current.pending) {
      showToast('定稿图正在保存，请稍候', 'error');
      return;
    }
    if (image?.uploading) {
      showToast('图片正在保存，请稍候再设置定稿', 'error');
      return;
    }

    const imageId = String(image?.id || '');
    const temporaryId = imageId.startsWith('asset-upload-')
      || imageId.startsWith('upload-')
      || imageId.startsWith('batch-')
      || imageId.startsWith('generated-');
    if (temporaryId) {
      showToast('图片正在保存，请稍候再设置定稿', 'error');
      return;
    }
    const operation = primaryOperationRef.current;
    operation.pending = true;
    operation.version += 1;
    try {
      const pendingAutomaticSave = beforeManualPrimary?.();
      if (pendingAutomaticSave) await pendingAutomaticSave;
      if (!isCurrent()) return;
      let persistedId = image?.id;
      let result;
      if (newSettled) {
        if (!persistedId) {
          const detail = await apiGetSubjectDetail(projectId, subjectId);
          if (!isCurrent()) return;
          persistedId = resolveSubjectImageId(detail, image);
          if (!persistedId) throw new Error('创作结果尚未同步到主体图片，请稍后重试');
        }
        result = await apiSetPrimarySubjectImage(projectId, subjectId, persistedId);
      } else {
        await apiUnsetPrimarySubjectImage(projectId, subjectId);
      }
      if (!isCurrent()) return;
      const persistedUrl = newSettled
        ? result?.file_url || result?.fileUrl || result?.url || result?.image_url || image?.rawUrl || image?.url
        : null;
      const matches = (item) => image?.id != null
        ? String(item.id) === String(image.id)
        : normalizeImageUrl(item.rawUrl || item.url) === normalizeImageUrl(image?.rawUrl || image?.url);
      setGeneratedImages((prev) => !isCurrent() ? prev : prev.map((item) => (
        matches(item)
          ? { ...item, settled: newSettled, ...(newSettled ? { id: persistedId, rawUrl: persistedUrl, url: normalizeImageUrl(persistedUrl) } : {}) }
          : { ...item, settled: newSettled ? false : item.settled }
      )));
      onCoverChange?.(persistedUrl, { persist: false });
      setPrimaryImageUrl?.(normalizeImageUrl(persistedUrl));
      setPrimaryImageId?.(newSettled ? persistedId : null);
    } catch (error) {
      if (isCurrent()) showToast(error.message || '保存定稿图失败，请重试', 'error');
    } finally {
      operation.pending = false;
    }
  }

  return { handleUpload, handleDownload, handleSettledChange };
}
