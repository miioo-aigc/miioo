/**
 * @file CreationAssetPickerModal.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   创作输入区的资产选择弹窗接线适配；将首尾帧选择与普通参考素材选择
 *   统一映射到通用 AssetPickerModal，不持有页面状态或业务副作用。
 *
 * ─── 数据流 ─────────────────────────────────────────────────────────
 *   open / accept / frameAssetTarget 由 InputCard 显式传入；关闭、确认和
 *   首尾帧目标清理通过显式回调返回页面。
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只依赖通用 AssetPickerModal，不读取 CreationPage 闭包，不调用 API、
 *   Store 或 Toast。
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-16  从 CreationPage 的 InputCard 抽离资产选择弹窗接线
 */
import AssetPickerModal from '../AssetPickerModal';

export default function CreationAssetPickerModal({
  open,
  onClose,
  onConfirm,
  accept = 'all',
  frameAssetTarget = null,
  onFrameAssetTargetClear,
  projectId = null,
  creativeAssets = null,
  preSelectedIds = [],
  preSelectedUrls = [],
  preSelectedSubjectIds = [],
  model = '',
}) {
  const handleClose = () => {
    onClose?.();
    onFrameAssetTargetClear?.();
  };

  return (
    <AssetPickerModal
      open={open}
      onClose={handleClose}
      onConfirm={onConfirm}
      accept={frameAssetTarget ? 'image' : accept}
      projectId={projectId}
      creativeAssets={creativeAssets}
      preSelectedIds={preSelectedIds}
      preSelectedUrls={preSelectedUrls}
      preSelectedSubjectIds={preSelectedSubjectIds}
      model={model}
    />
  );
}
