import { useRef, useState } from 'react';
import { buildImageEditRequest } from '../utils/MediaEditRequest';
import { showGlobalToast } from '../stores/toastStore';
import { apiPrepareEditSource, apiSubmitImageEdit } from '../api/ImageEdit';
import { prepareImageEditDestination, uploadImageEditFile } from '../api/ImageEditSave';

export default function useImageEditSubmission({ card, onSave, onComplete, keepOpen = false }) {
  const [busy, setBusy] = useState(false);
  const [comparison, setComparison] = useState({ active: false, result: null, error: '', retrySave: false });
  const running = useRef(false);
  const pending = useRef(null);
  const originalCard = useRef(card);
  async function submit(options) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setComparison((value) => ({ ...value, error: '' }));
    try {
      if (!onSave?.scope || !onSave.pending) throw new Error('当前列表未连接云端编辑保存');
      if (!pending.current) {
        const request = buildImageEditRequest(keepOpen ? originalCard.current : card, options);
        const source = await apiPrepareEditSource(keepOpen ? originalCard.current : card);
        const destination = await prepareImageEditDestination(onSave.scope, source.id);
        pending.current = { request, source, destination };
      }
      const work = pending.current;
      if (work.uncertain) throw new Error('上次提交结果尚不明确，请先核查任务或资产库，避免重复生成');
      if (!work.accepted && !work.image) {
        work.uncertain = true;
        if (work.request.file) {
          work.image = await uploadImageEditFile(work.request.file, { sourceAssetId: work.source.id, editMode: work.request.edit_mode });
        } else {
          work.accepted = await apiSubmitImageEdit(work.source, { ...work.request, business_context: work.destination });
        }
        work.uncertain = false;
      }
      setComparison((value) => ({ ...value, active: true }));
      const result = await onSave.pending({ accepted: work.accepted, image: work.image, mode: work.request.edit_mode,
        destination: work.destination, sourceId: work.source.id });
      pending.current = null;
      setComparison({ active: true, result, error: '', retrySave: false });
      showGlobalToast('编辑图片已保存', 'success');
      if (!keepOpen) onComplete?.();
    } catch (error) {
      if (error.terminal || (pending.current && !pending.current.uncertain)) pending.current = null;
      setComparison((value) => ({ ...value, result: error.preview || value.result, error: error.message || '图片编辑失败，请重试', retrySave: Boolean(pending.current?.accepted || pending.current?.image) }));
      showGlobalToast(error.message || '图片编辑失败，请重试', 'error');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return { busy, submit, comparison };
}
