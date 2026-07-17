/**
 * @file CreationInputOverlays.jsx
 * @description 创作输入区的弹窗组合接线层。
 *
 * ─── 结构索引 ───────────────────────────────────────────
 *   CreationInputOverlays  L19–L55
 *     ├ 资产选择弹窗                                      L35–L41
 *     ├ 配音选择弹窗                                      L42–L45
 *     └ 真人素材弹窗                                      L47–L52
 *
 * 组件只负责把三个输入区弹窗接入显式 props；资产转换、音色状态和生成参数
 * 仍由 InputCard 持有，弹窗本体的接口和业务行为不在此处重新实现。
 */

import CreationAssetPickerModal from './CreationAssetPickerModal';
import DubbingVoiceModal from './CreationDubbingVoiceModal';
import CreationLiveMaterialModal from './CreationLiveMaterialModal';

export default function CreationInputOverlays({
  assetPickerOpen,
  onAssetPickerClose,
  onFrameAssetTargetClear,
  onAssetConfirm,
  assetPickerAccept,
  voiceModalOpen,
  onVoiceModalClose,
  onVoiceConfirm,
  liveMaterialModalOpen,
  onLiveMaterialModalClose,
  onLiveMaterialConfirm,
  liveMaterialInitialSelected = [],
}) {
  return (
    <>
      <CreationAssetPickerModal
        open={assetPickerOpen}
        onClose={onAssetPickerClose}
        onFrameAssetTargetClear={onFrameAssetTargetClear}
        onConfirm={onAssetConfirm}
        accept={assetPickerAccept}
      />
      <DubbingVoiceModal
        open={voiceModalOpen}
        onClose={onVoiceModalClose}
        onConfirm={onVoiceConfirm}
      />
      <CreationLiveMaterialModal
        open={liveMaterialModalOpen}
        onClose={onLiveMaterialModalClose}
        onConfirm={onLiveMaterialConfirm}
        initialSelected={liveMaterialInitialSelected}
      />
    </>
  );
}
