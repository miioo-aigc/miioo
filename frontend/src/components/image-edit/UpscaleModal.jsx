import { useState } from 'react';
import ImageEditChrome from './ImageEditChrome';
import { QualityOption, UpscaleFooter } from './UpscaleControls';
import { showGlobalToast } from '../../stores/toastStore';
import { buildImageEditRequest } from '../../utils/MediaEditRequest';
import './Upscale.css';

const QUALITY_OPTIONS = ['2K', '3K', '4K'];

export default function UpscaleModal({ card, onPrepare, onClose }) {
  const [quality, setQuality] = useState('2K');

  async function submit() {
    if (!card?.imageUrl) {
      showGlobalToast('未找到可用原图，请关闭后重试', 'error');
      return;
    }
    try {
      const request = buildImageEditRequest(card, {
        mode: 'upscale',
        model_requirement: 'Seedream 5.0',
        target_resolution: quality,
      });
      await onPrepare?.(request);
      showGlobalToast(`已准备${quality}图片智能超清参数，等待后端编辑接口接入`, 'info');
    } catch (error) {
      showGlobalToast(error.message || '智能超清参数准备失败，请重试', 'error');
    }
  }

  return <ImageEditChrome
    title="智能超清"
    onClose={onClose}
    baseWidth={1200}
    baseHeight={900}
    footer={<UpscaleFooter onClose={onClose} onSubmit={submit} disabled={!card?.imageUrl} />}
  >
    <div className="upscale-body">
      <div className="upscale-stage">
        {card?.imageUrl ? <img src={card.imageUrl} alt="智能超清预览" /> : <span role="status">图片加载失败，请关闭后重试</span>}
      </div>
      <div className="upscale-toolbar">
        <span className="upscale-current-quality">当前画质：1K</span>
        <div className="upscale-quality-options" role="group" aria-label="选择输出画质">
          {QUALITY_OPTIONS.map((value) => <QualityOption key={value} value={value} selected={quality === value} onClick={setQuality} />)}
        </div>
      </div>
    </div>
  </ImageEditChrome>;
}
