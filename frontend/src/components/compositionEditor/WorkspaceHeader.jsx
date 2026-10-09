import { Check } from 'lucide-react';
import { Button, EditExportIcon } from '../ui';
import { useCompositionEditorStore } from '../../stores/compositionEditorStore';
import { getErrorMessage } from '../../api/error';
import DraftNameEditor from './DraftNameEditor';

export default function WorkspaceHeader({ projectName, episode, onBack, showToast, ready }) {
  const draftName = useCompositionEditorStore((state) => state.name);
  const setName = useCompositionEditorStore((state) => state.setName);
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
    <header className="relative z-20 flex shrink-0 items-center justify-between gap-[16px]">
      <div className="flex min-w-0 items-center gap-[18px]">
        <Button variant="secondary" size="large" style={{ height: '32px' }} className="shrink-0 cursor-pointer" onClick={handleBack} disabled={!ready || saving}>返回</Button>
        <div className="flex min-w-0 items-center gap-[4px] text-[14px] leading-[20px] text-text-secondary" style={{ fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif" }}>
          <span className="min-w-0 truncate">{projectName || '项目'} › {episode?.title || (episode?.episode_number != null ? `第${episode.episode_number}集` : '剧集')} ›</span>
          <DraftNameEditor name={draftName} disabled={!ready} onCommit={setName} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-[8px]">
        <Button size="large" className="cursor-pointer" icon={<Check size={16} />} onClick={handleSave} loading={saving} disabled={!ready || exporting} aria-label="保存草稿">
          {!ready ? '加载中…' : saving ? '保存中…' : dirty ? '保存草稿' : '已保存'}
        </Button>
        <Button size="large" className="cursor-pointer" variant="accent" icon={<EditExportIcon />} onClick={() => startExport()} disabled={!ready || saving || !hasSegments || exporting}>导出成片</Button>
      </div>
    </header>
  );
}
