import { Check, ArrowLeft } from 'lucide-react';
import { Button, EditExportIcon } from '../ui';
import { EpisodeSelector } from '../storyboard/StoryboardControls';
import { useCompositionEditorStore } from '../../stores/compositionEditorStore';
import { getErrorMessage } from '../../api/error';

export default function WorkspaceHeader({ projectName, episodes, episode, onEpisodeChange, onBack, showToast, ready }) {
  const dirty = useCompositionEditorStore((state) => state.dirty);
  const saving = useCompositionEditorStore((state) => state.saving);
  const save = useCompositionEditorStore((state) => state.save);
  const startExport = useCompositionEditorStore((state) => state.startExport);
  const hasSegments = useCompositionEditorStore((state) => state.segments.length > 0);
  const exporting = useCompositionEditorStore((state) => state.exportState.status === 'exporting');
  async function handleSave() {
    try { await save(); showToast?.('草稿已保存', 'success'); }
    catch (error) { showToast?.(getErrorMessage(error, '保存草稿失败'), 'error'); }
  }
  async function handleBack() {
    if (dirty) {
      try { await save(); }
      catch (error) { showToast?.(getErrorMessage(error, '保存失败，请重试后返回'), 'error'); return; }
    }
    onBack();
  }
  return (
    <header className="relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-[12px]">
      <div className="flex flex-wrap items-center gap-[22px] text-font-size-14 leading-[20px]">
        <div className="flex items-center gap-[4px]">
          <span className="text-text-secondary">{projectName}</span><span className="text-text-hint">›</span>
          <EpisodeSelector episodes={episodes} value={episode} onChange={onEpisodeChange} />
        </div>
        <span className="text-white/[0.8]" role="status">{!ready ? '正在加载草稿…' : saving ? '保存中…' : dirty ? '有未保存草稿' : '已保存'}</span>
      </div>
      <div className="flex items-center gap-[8px]">
        <Button className="cursor-pointer" icon={<ArrowLeft size={16} />} onClick={handleBack} disabled={!ready || saving}>返回草稿</Button>
        <Button className="cursor-pointer" icon={<Check size={16} />} onClick={handleSave} loading={saving} disabled={!ready || exporting}>保存草稿</Button>
        <Button className="cursor-pointer" variant="accent" icon={<EditExportIcon />} onClick={() => startExport()} disabled={!ready || saving || !hasSegments || exporting}>导出成片</Button>
      </div>
    </header>
  );
}
