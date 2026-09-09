import { useState } from 'react';
import ImageEditChrome from './ImageEditChrome';
import Button from '../ui/Button';
import { showGlobalToast } from '../../stores/toastStore';
import './Upscale.css';

const QUALITY_OPTIONS = ['2K', '3K', '4K'];

function QualityOption({ value, selected, onClick }) {
  return <Button
    variant="secondary"
    size="large"
    className="upscale-quality-option"
    aria-pressed={selected}
    onClick={() => onClick(value)}
  >{value}</Button>;
}

function UpscaleFooter({ onClose, onSubmit, disabled }) {
  return <footer className="upscale-footer">
    <Button variant="secondary" size="large" onClick={onClose}>取消</Button>
    <Button variant="primary" size="large" disabled={disabled} onClick={onSubmit}>AI生成</Button>
  </footer>;
}

export default function UpscaleModal({ card, onClose }) {
  const [quality, setQuality] = useState('2K');

  function submit() {
    if (!card?.imageUrl) {
      showGlobalToast('未找到可用原图，请关闭后重试', 'error');
      return;
    }
    showGlobalToast(`已选择${quality}智能超清，生成服务暂未接入`, 'info');
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
