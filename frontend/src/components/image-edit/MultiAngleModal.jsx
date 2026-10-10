import { useState } from 'react';
import ImageEditChrome, { ImageEditFooter } from './ImageEditChrome';
import MultiAngleStage from './MultiAngleStage';
import MultiAnglePanel from './MultiAnglePanel';
import { buildMultiAnglePrompt } from '../../utils/MultiAngle';
import useImageEditSubmission from '../../hooks/useImageEditSubmission';
import ImageEditComparison from './ImageEditComparison';

export default function MultiAngleModal({ card, onClose, onSave, onComplete = onClose }) {
  const [angles, setAngles] = useState({ horizontal: 0, vertical: 0 });
  const { busy, submit: generate, comparison } = useImageEditSubmission({ card, onSave, onComplete, keepOpen: true });
  const reset = () => setAngles({ horizontal: 0, vertical: 0 });
  const submit = async () => {
    await generate({
        mode: 'multi_angle',
        internal_prompt: buildMultiAnglePrompt(angles.horizontal, angles.vertical),
        multi_angle_options: { ...angles, horizontal_angle: angles.horizontal, vertical_angle: angles.vertical, mode: 'multi_angle' },
      });
  };
  return <ImageEditChrome title="多机位编辑" onClose={onClose} busy={busy} allowCloseWhileBusy footer={<ImageEditFooter onReset={reset} onClose={onClose} onSubmit={submit} busy={busy} allowCloseWhileBusy disabled={!card.imageUrl} label="AI生成" />}>
    <div className="multi-angle-body"><ImageEditComparison comparison={comparison} busy={busy} onRetry={submit}><MultiAngleStage imageUrl={card.imageUrl} angles={angles} onChange={setAngles} disabled={busy} /></ImageEditComparison><MultiAnglePanel angles={angles} onChange={setAngles} disabled={busy} /></div>
  </ImageEditChrome>;
}
