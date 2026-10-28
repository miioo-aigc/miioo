import { Undo2, Redo2, Captions } from 'lucide-react';
import { commonClipActions } from './TimelineSelection';
import { AssetIcon, DetachAudioIcon } from './TimelineActionIcons';
import useTimelineShortcuts from './UseTimelineShortcuts';
import { DeleteIcon, IconButton, Tooltip } from '../ui';
import cutIcon from '../../assets/compositionEditor/Cut.svg';
import splitLeftIcon from '../../assets/compositionEditor/SplitLeft.svg';
import splitRightIcon from '../../assets/compositionEditor/SplitRight.svg';
import { computeAudioWindows, computeVisualWindows, computeSubtitleWindows, useCompositionEditorStore } from '../../stores/compositionEditorStore';

export default function TimelineToolbar({ showToast }) {
  useTimelineShortcuts(showToast);
  const state = useCompositionEditorStore();
  const selected = state.segments.find((item) => item.id === state.selectedId);
  const window = [...computeVisualWindows(state.segments).windows, ...computeAudioWindows(state.segments).windows, ...computeSubtitleWindows(state.segments).windows].find((item) => item.seg.id === state.selectedId);
  const canSplit = window && state.cursor > window.start && state.cursor < window.end;
  const common = commonClipActions(state, [...computeVisualWindows(state.segments).windows, ...computeAudioWindows(state.segments).windows]);
  const multi = state.selectedIds.length > 1;
  const actions = [
    { label: '撤销', Icon: Undo2, disabled: !state.past.length, onClick: state.undo },
    { label: '恢复', Icon: Redo2, disabled: !state.future.length, onClick: state.redo },
    { label: '切割', icon: <AssetIcon src={cutIcon} />, disabled: multi ? !common.includes('split') : !canSplit, onClick: multi ? () => state.applySelectionAction('split') : state.splitSelected },
    { label: '向左裁剪', icon: <AssetIcon src={splitLeftIcon} />, disabled: multi ? !common.includes('trimLeft') : !canSplit || selected?.type === 'subtitle', onClick: () => multi ? state.applySelectionAction('trimLeft') : state.trimSelected('left') },
    { label: '向右裁剪', icon: <AssetIcon src={splitRightIcon} />, disabled: multi ? !common.includes('trimRight') : !canSplit || selected?.type === 'subtitle', onClick: () => multi ? state.applySelectionAction('trimRight') : state.trimSelected('right') },
    { label: '分离音轨', Icon: DetachAudioIcon, disabled: multi ? !common.includes('detach') : selected?.type !== 'video' || state.hasDetachedAudio(state.selectedId), onClick: () => multi ? state.applySelectionAction('detach') : state.detachAudio(state.selectedId) },
    { label: '添加字幕', Icon: Captions, onClick: () => { try { state.addSubtitle(); } catch (error) { showToast?.(error.message, 'error'); } } },
    { label: '删除', Icon: DeleteIcon, danger: true, disabled: !selected && !state.selectedIds.length, onClick: state.deleteSelected },
  ];
  return (
    <div role="toolbar" aria-label="时间线编辑工具" className="flex h-[40px] shrink-0 items-center gap-[15px] border-b border-stroke-normal px-[12px]">
      {actions.map(({ label, Icon, icon, danger, disabled, onClick }) => (
        <Tooltip key={label} label={`${label}${({ 撤销: ' Ctrl/⌘+Z', 恢复: ' Ctrl/⌘+Shift+Z', 切割: ' C / Ctrl/⌘+B', 向左裁剪: ' Q', 向右裁剪: ' W', 删除: ' Delete / Backspace' })[label] || ''}`} delay={250}>
          <IconButton
            aria-label={label}
            icon={icon || <Icon size={16} color="currentColor" style={{ width: 16, height: 16, flexShrink: 0 }} />}
            variant="secondary"
            size="small"
            style={{ width: 24, height: 24, padding: 0, border: 'none', borderRadius: 6, boxShadow: 'none', backgroundImage: 'none' }}
            className="cursor-pointer !bg-transparent enabled:hover:!bg-white-10 enabled:active:!bg-white-10 disabled:!bg-transparent"
            contentClassName={danger
              ? '!text-white-80 group-enabled:group-hover:!text-btn-danger-text group-enabled:group-active:!text-btn-danger-text group-disabled:!text-white-30'
              : '!text-white-80 group-enabled:group-hover:!text-white group-enabled:group-active:!text-white group-disabled:!text-white-30'}
            disabled={disabled || !state.loaded}
            onClick={onClick}
          />
        </Tooltip>
      ))}
    </div>
  );
}
