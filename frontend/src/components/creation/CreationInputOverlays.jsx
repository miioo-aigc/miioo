/**
 * @file CreationInputOverlays.jsx
 * @description 创作输入区的弹窗组合接线层。
 *
 * ─── 结构索引 ───────────────────────────────────────────
 *   CreationInputOverlays  L18–L52
 *     ├ 资产选择弹窗                                      L34–L43
 *     └ 配音选择弹窗                                      L44–L49
 *
 * 组件只负责把资产选择和配音两个弹窗接入显式 props；资产转换、音色状态和生成参数
 * 仍由 InputCard 持有，弹窗本体的接口和业务行为不在此处重新实现。
 * 2026-10-30 移除创作输入区独立真人素材弹窗接线。
 */

import CreationAssetPickerModal from './CreationAssetPickerModal';
import DubbingVoiceModal from './CreationDubbingVoiceModal';

export default function CreationInputOverlays({
  assetPickerOpen,
  onAssetPickerClose,
  onFrameAssetTargetClear,
  onAssetConfirm,
  assetPickerAccept,
  assetPickerPreSelectedIds = [],
  assetPickerPreSelectedUrls = [],
  voiceModalOpen,
  onVoiceModalClose,
  onVoiceConfirm,
  showToast,
  model = '',
}) {
  return (
    <>
      <CreationAssetPickerModal
        open={assetPickerOpen}
        onClose={onAssetPickerClose}
        onFrameAssetTargetClear={onFrameAssetTargetClear}
        onConfirm={onAssetConfirm}
        accept={assetPickerAccept}
        preSelectedIds={assetPickerPreSelectedIds}
        preSelectedUrls={assetPickerPreSelectedUrls}
        model={model}
      />
      <DubbingVoiceModal
        open={voiceModalOpen}
        onClose={onVoiceModalClose}
        onConfirm={onVoiceConfirm}
        showToast={showToast}
      />
    </>
  );
}
