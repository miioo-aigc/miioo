import { useState } from 'react';
import ImageEditChrome from './ImageEditChrome';
import { QualityOption, UpscaleFooter } from './UpscaleControls';
import { showGlobalToast } from '../../stores/toastStore';
import useImageEditSubmission from '../../hooks/useImageEditSubmission';
import './Upscale.css';
import ImageEditComparison, { ComparisonImage } from './ImageEditComparison';

const QUALITY_OPTIONS = ['2K', '3K', '4K'];

export default function UpscaleModal({ card, onSave, onClose, onComplete = onClose }) {
  const [quality, setQuality] = useState('2K');
  const { busy, submit: generate, comparison } = useImageEditSubmission({ card, onSave, onComplete, keepOpen: true });
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const sourceUrl = card?.originalUrl || card?.original_url || card?.download_url || card?.downloadUrl || card?.imageUrl;

  async function submit() {
    if (comparison.retrySave) { await generate(); return; }
    if (!card?.imageUrl) {
      showGlobalToast('未找到可用原图，请关闭后重试', 'error');
      return;
    }
    try {
      await generate({
        mode: 'upscale',
        model_requirement: 'Seedream 5.0',
        target_resolution: quality,
      });
    } catch (error) {
      showGlobalToast(error.message || '智能超清参数准备失败，请重试', 'error');
    }
  }

  return <ImageEditChrome
    title="智能超清"
    onClose={onClose}
    busy={busy}
    allowCloseWhileBusy
    baseWidth={1200}
    baseHeight={900}
    footer={<UpscaleFooter onClose={onClose} onSubmit={submit} disabled={busy || !card?.imageUrl} label={comparison.retrySave ? '重试任务保存' : 'AI生成'} closeLabel="关闭" />}
  >
    <div className="upscale-body">
      <ImageEditComparison comparison={comparison} busy={busy} onRetry={() => generate()} view={view} onViewChange={setView}>
        <ComparisonImage key={sourceUrl} src={sourceUrl} alt="智能超清原图" view={view} onViewChange={setView} />
      </ImageEditComparison>
      <div className="upscale-toolbar" inert={busy}>
        <span className="upscale-current-quality">当前画质：1K</span>
        <div className="upscale-quality-options" role="group" aria-label="选择输出画质">
          {QUALITY_OPTIONS.map((value) => <QualityOption key={value} value={value} selected={quality === value} onClick={setQuality} />)}
        </div>
      </div>
    </div>
  </ImageEditChrome>;
}
