import { useRef, useState } from 'react';
import ImageEditChrome, { ImageEditFooter } from './ImageEditChrome';
import MultiAngleStage from './MultiAngleStage';
import MultiAnglePanel from './MultiAnglePanel';
import { buildMultiAnglePrompt } from '../../utils/MultiAngle';
import { showGlobalToast } from '../../stores/toastStore';
import { buildImageEditRequest } from '../../utils/MediaEditRequest';

export default function MultiAngleModal({ card, onClose, onPrepare }) {
  const [angles, setAngles] = useState({ horizontal: 0, vertical: 0 });
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const reset = () => setAngles({ horizontal: 0, vertical: 0 });
  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      const request = buildImageEditRequest(card, {
        mode: 'multi_angle',
        internal_prompt: buildMultiAnglePrompt(angles.horizontal, angles.vertical),
      });
      await onPrepare?.(request);
      showGlobalToast('已准备多机位编辑参数，等待后端编辑接口接入', 'info');
    } catch (error) { showGlobalToast(error.message || '多机位参数准备失败，请重试', 'error'); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <ImageEditChrome title="多机位编辑" onClose={onClose} busy={busy} footer={<ImageEditFooter onReset={reset} onClose={onClose} onSubmit={submit} busy={busy} disabled={!card.imageUrl} label="AI生成" />}>
    <div className="multi-angle-body"><MultiAngleStage imageUrl={card.imageUrl} angles={angles} onChange={setAngles} disabled={busy} /><MultiAnglePanel angles={angles} onChange={setAngles} disabled={busy} /></div>
  </ImageEditChrome>;
}
