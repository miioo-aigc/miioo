import CompositionSaveButton from './CompositionSaveButton';
import { ArrowLeft } from 'lucide-react';
import { Button, EditExportIcon, IconButton, Tooltip } from '../ui';
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
        <Tooltip label="返回剪辑草稿列表" placement="bottom" offset={8}>
          <IconButton variant="link" aria-label="返回剪辑草稿列表" style={{ width: 32, height: 32 }} onClick={handleBack} disabled={!ready || saving}>
            <ArrowLeft size={20} className="text-white-80" />
          </IconButton>
        </Tooltip>
        <div className="flex min-w-0 items-center gap-[4px] text-[14px] leading-[20px] text-white-80 font-font-weight-medium" style={{ fontFamily: "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif" }}>
          <span className="min-w-0 truncate">{projectName || '项目'} / {episode?.title || (episode?.episode_number != null ? `第${episode.episode_number}集` : '剧集')} /</span>
          <div className="flex min-w-0 items-center gap-[12px]">
            <DraftNameEditor name={draftName} disabled={!ready} onCommit={setName} />
            <CompositionSaveButton ready={ready} disabled={exporting} showToast={showToast} />
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-[8px]">
        <Button size="large" className="cursor-pointer" variant="accent" icon={<EditExportIcon />} onClick={() => startExport()} disabled={!ready || saving || !hasSegments || exporting}>导出成片</Button>
      </div>
    </header>
  );
}
