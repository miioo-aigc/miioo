import { apiGetAssetDetail } from './assets';

function validateAsset(asset, mediaType) {
  if (!asset?.id || !asset.file_url || asset.asset_type !== mediaType
    || asset.is_deleted || asset.deleted_at) {
    throw new Error('所选素材不可用，请重新生成、上传或选择其他素材');
  }
}

// 选择素材只建立草稿引用，不创建项目资产或修改原资产归属。
export async function prepareCompositionAsset(item, projectId, mediaType) {
  if (!projectId) throw new Error('缺少当前项目信息，请重新打开剪辑页面');
  const id = item.assetId || item.asset_id || item.id;
  if (!id) throw new Error('所选素材缺少资产编号，请重新选择');
  const source = await apiGetAssetDetail(id);
  validateAsset(source, mediaType);
  return source;
}
