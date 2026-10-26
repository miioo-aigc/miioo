/** 图片生成参考契约：本地文件先上传，原图与资产身份独立于展示缩略图。 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isManagedImageUrl = (url) => typeof url === 'string' && /^(https?:\/\/[^/\s]+|\/(?!\/))/.test(url);
export function getImageReferenceId(ref) {
  return [ref?.assetId, ref?.asset_id, ref?.backendId].find((id) => typeof id === 'string' && UUID.test(id));
}
export function getImageReferenceUrl(ref) {
  return typeof ref === 'string' ? ref : ref?.originalUrl || ref?.original_url || ref?.fileUrl || ref?.file_url || ref?.persistentUrl || ref?.url || '';
}
export function assertImageReferenceUrls(urls = [], { allowAssetIds = false } = {}) {
  for (const url of urls) {
    if (!isManagedImageUrl(url) && !(allowAssetIds && UUID.test(url))) {
      throw new Error('参考图尚未上传完成或地址已失效，请重新上传后再生成');
    }
  }
}

export async function resolveImageReference(ref, { upload, signal, fetchLocal = globalThis.fetch }) {
  signal?.throwIfAborted();
  const assetId = getImageReferenceId(ref);
  if (assetId) return { assetId };
  if (ref?.uploading || ref?.uploadStatus === 'uploading') throw new Error('参考图正在上传，请等待上传完成后再生成');
  if (ref?.uploadStatus === 'error') throw new Error('参考图上传失败，请重新上传后再生成');
  let file = ref instanceof Blob ? ref : ref?.file;
  const url = getImageReferenceUrl(ref);
  if (!file && isManagedImageUrl(url)) return { url };
  if (!file && (url.startsWith('blob:') || url.startsWith('data:image/'))) {
    const response = await fetchLocal(url, { signal });
    if (!response.ok) throw new Error('参考图读取失败，请重新上传');
    file = await response.blob();
  }
  if (!(file instanceof Blob)) throw new Error('参考图缺少服务端可读取地址，请重新上传');
  if (!(file instanceof File)) file = new File([file], ref?.name || '参考图', { type: file.type || 'image/png' });
  const result = await upload(file);
  signal?.throwIfAborted();
  const uploadedUrl = result.uploaded_url || result.uploadedUrl;
  const uploadedId = getImageReferenceId(result) || getImageReferenceId(result.image);
  if (!isManagedImageUrl(uploadedUrl) || !uploadedId) throw new Error('上传响应缺少有效原图地址或资产编号，请重新上传');
  return { url: uploadedUrl, assetId: uploadedId };
}

export async function buildImageReferences(refs, options) {
  const reference_images = [];
  const attachments = [];
  const seenIds = new Set();
  const seenUrls = new Set();
  for (const ref of refs) {
    const id = getImageReferenceId(ref);
    const originalUrl = getImageReferenceUrl(ref);
    if ((id && seenIds.has(id)) || (originalUrl && seenUrls.has(originalUrl))) continue;
    const resolved = await resolveImageReference(ref, options);
    if (resolved.assetId && !seenIds.has(resolved.assetId)) {
      attachments.push({ asset_id: resolved.assetId, asset_type: 'image', role: 'reference' });
      seenIds.add(resolved.assetId);
    }
    if (resolved.url && !seenUrls.has(resolved.url)) reference_images.push(resolved.url);
    if (resolved.url) seenUrls.add(resolved.url);
    if (originalUrl) seenUrls.add(originalUrl);
  }
  return { reference_images, attachments };
}
