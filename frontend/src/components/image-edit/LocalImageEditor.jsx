import ImageCropModal from '../ImageCropModal';
import ImageFlipModal from './ImageFlipModal';
import MultiAngleModal from './MultiAngleModal';
import InpaintModal from './InpaintModal';
import UpscaleModal from './UpscaleModal';
import OutpaintModal from './OutpaintModal';

export default function LocalImageEditor({ mode, card, onClose, onSave, onComplete = onClose }) {
  if (mode === '裁剪' || mode === '翻转') {
    const Editor = mode === '裁剪' ? ImageCropModal : ImageFlipModal;
    return <Editor imageUrl={card.imageUrl} onClose={onClose} onComplete={onComplete} onSave={async (image) => {
      if (!onSave) throw new Error('当前列表未连接保存回调');
      await onSave(image);
      URL.revokeObjectURL(image.fileUrl);
    }} />;
  }
  if (mode === '多机位') return <MultiAngleModal card={card} onClose={onClose} onComplete={onComplete} />;
  if (mode === '局部重绘' || mode === '消除笔') return <InpaintModal card={card} mode={mode === '消除笔' ? 'eraser' : 'inpaint'} onClose={onClose} />;
  if (mode === '智能超清') return <UpscaleModal card={card} onClose={onClose} />;
  if (mode === '扩图') return <OutpaintModal card={card} onClose={onClose} />;
  return null;
}
