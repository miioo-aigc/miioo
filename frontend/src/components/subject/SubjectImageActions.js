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
 */
import {
  apiDownloadSubjectImage,
  apiSetPrimarySubjectImage,
} from '../../api/subject';
import { apiUploadCreationImage } from '../../api/creation';
import { normalizeImageUrl } from '../../utils/imageUrl';

export function createSubjectImageActionHandlers({
  projectId,
  subjectId,
  setGeneratedImages,
  onCoverChange,
  setPrimaryImageUrl,
  setPrimaryImageId,
  showToast,
  triggerBlobDownload,
}) {
  function handleUpload(fileOrAsset) {
    if (fileOrAsset && typeof fileOrAsset === 'object' && fileOrAsset.id) {
      const rawUrl = fileOrAsset.url
        || fileOrAsset.file_url
        || fileOrAsset.fileUrl
        || fileOrAsset.originalUrl
        || fileOrAsset.original_url
        || fileOrAsset.thumbnailUrl
        || fileOrAsset.thumbnail_url;

      setGeneratedImages((prev) => [{
        rawUrl,
        url: normalizeImageUrl(rawUrl),
        settled: false,
        id: fileOrAsset.id,
      }, ...prev]);
      return;
    }

    if (!(fileOrAsset instanceof File)) return;

    const blobUrl = URL.createObjectURL(fileOrAsset);
    const tempId = `upload-${Date.now()}`;
    setGeneratedImages((prev) => [{
      rawUrl: blobUrl,
      url: blobUrl,
      settled: false,
      id: tempId,
    }, ...prev]);

    if (projectId) {
      // 主体接口只提供参考图上传，没有候选图上传接口。
      // 右侧自定义图片必须走通用创作上传，不能写入主体 reference_images。
      apiUploadCreationImage({ file: fileOrAsset, category: 'reference', project_id: projectId })
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
          setGeneratedImages((prev) => prev.map((image) => (
            image.id === tempId
              ? {
                ...image,
                id: realId || tempId,
                rawUrl: realUrl || blobUrl,
                url: normalizeImageUrl(realUrl || blobUrl),
                settled: false,
              }
              : image
          )));
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
      onCoverChange?.(image?.rawUrl ?? image?.url ?? null);
      if (image.id && !String(image.id).startsWith('generated-')) {
        apiSetPrimarySubjectImage(projectId, subjectId, image.id).catch((error) => {
          console.error('[SubjectPage] 设置定稿图失败:', error);
        });
      }
    } else {
      onCoverChange?.(null);
      setPrimaryImageUrl(null);
      setPrimaryImageId(null);
    }

    setGeneratedImages((prev) => prev.map((item, itemIndex) => (
      itemIndex === index
        ? { ...item, settled: newSettled }
        : { ...item, settled: newSettled ? false : item.settled }
    )));
  }

  return { handleUpload, handleDownload, handleSettledChange };
}
