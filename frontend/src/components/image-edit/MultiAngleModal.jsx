import { useRef, useState } from 'react';
import ImageEditChrome, { ImageEditFooter } from './ImageEditChrome';
import MultiAngleStage from './MultiAngleStage';
import MultiAnglePanel from './MultiAnglePanel';
import { buildMultiAnglePrompt } from '../../utils/MultiAngle';
import { showGlobalToast } from '../../stores/toastStore';
import { buildCreationImageReferencePrefill } from '../../utils/creationDetailAdapter';

export default function MultiAngleModal({ card, onClose, onGenerate }) {
  const [angles, setAngles] = useState({ horizontal: 0, vertical: 0 });
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const reset = () => setAngles({ horizontal: 0, vertical: 0 });
  const submit = async () => {
    if (submitting.current) return;
    const reference = buildCreationImageReferencePrefill(card);
    if (!reference) { showGlobalToast('未找到可用原图，请先上传原图', 'error'); return; }
    if (!onGenerate) { showGlobalToast('当前列表暂不支持新增创作任务', 'error'); return; }
    submitting.current = true;
    setBusy(true);
    try {
      await onGenerate({ files: reference.appendFiles.map((file) => ({ ...file, type: 'image/png' })), genType: 'image', count: 1, model: card.model, ratio: card.ratio, resolution: card.resolution, prompt: buildMultiAnglePrompt(angles.horizontal, angles.vertical), promptHTML: '' });
      showGlobalToast('创作请求发送成功，正在原列表生成图片', 'success');
      onClose();
    } catch (error) { showGlobalToast(error.message || '创作请求发送失败，请重试', 'error'); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <ImageEditChrome title="多机位编辑" onClose={onClose} busy={busy} footer={<ImageEditFooter onReset={reset} onClose={onClose} onSubmit={submit} busy={busy} disabled={!card.imageUrl} label="AI生成" />}>
    <div className="multi-angle-body"><MultiAngleStage imageUrl={card.imageUrl} angles={angles} onChange={setAngles} disabled={busy} /><MultiAnglePanel angles={angles} onChange={setAngles} disabled={busy} /></div>
  </ImageEditChrome>;
}
