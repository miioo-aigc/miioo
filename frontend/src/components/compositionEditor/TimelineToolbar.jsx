import { Undo2, Redo2, Captions } from 'lucide-react';
import { DeleteIcon, IconButton, Tooltip } from '../ui';
import cutIcon from '../../assets/compositionEditor/Cut.svg';
import splitLeftIcon from '../../assets/compositionEditor/SplitLeft.svg';
import splitRightIcon from '../../assets/compositionEditor/SplitRight.svg';
import { computeAudioWindows, computeVisualWindows, computeSubtitleWindows, useCompositionEditorStore } from '../../stores/compositionEditorStore';

function DetachAudioIcon({ size = 16, style }) {
  return (<svg width={size} height={size} viewBox="0 0 1024 1024" fill="none" style={style}><path d="M705.706667 616.448c47.061333 0 85.205333 38.144 85.205333 85.205333v154.88a85.205333 85.205333 0 0 1-85.205333 85.205334H292.693333a85.205333 85.205333 0 0 1-85.205333-85.205334v-154.88c0-47.061333 38.144-85.205333 85.205333-85.205333z m0 67.114667H292.693333a18.048 18.048 0 0 0-18.090666 18.090666v154.88c0 9.984 8.106667 18.090667 18.090666 18.090667h413.013334c9.984 0 18.090667-8.106667 18.090666-18.090667v-154.88a18.048 18.048 0 0 0-18.090666-18.090666z m198.784-172.928a33.536 33.536 0 1 1 0 67.114666H93.866667a33.536 33.536 0 1 1 0-67.114666h810.538666zM274.56 133.76c18.56 0 33.578667 15.018667 33.578667 33.578667v242.602666a33.536 33.536 0 1 1-67.114667 0V167.296c0-18.517333 15.018667-33.536 33.536-33.536z m304.64 103.253333c18.517333 0 33.536 15.018667 33.536 33.578667v139.349333a33.536 33.536 0 1 1-67.114667 0V270.549333c0-18.517333 15.018667-33.536 33.578667-33.536z m144.512-51.626666c18.56 0 33.578667 15.018667 33.578667 33.578666v190.976a33.536 33.536 0 1 1-67.114667 0V218.922667c0-18.517333 15.018667-33.536 33.578667-33.536zM434.688 30.506667c18.56 0 33.578667 15.018667 33.578667 33.578666v345.856a33.536 33.536 0 1 1-67.114667 0V64.085333c0-18.517333 15.018667-33.536 33.578667-33.536z" fill="currentColor" /></svg>);
}

function AssetIcon({ src, size = 16 }) {
  return <span aria-hidden="true" className="block shrink-0" style={{ width: size, height: size, backgroundColor: 'currentColor', mask: `url("${src}") center / contain no-repeat`, WebkitMask: `url("${src}") center / contain no-repeat` }} />;
}

export default function TimelineToolbar({ showToast }) {
  const state = useCompositionEditorStore();
  const selected = state.segments.find((item) => item.id === state.selectedId);
  const window = [...computeVisualWindows(state.segments).windows, ...computeAudioWindows(state.segments).windows, ...computeSubtitleWindows(state.segments).windows].find((item) => item.seg.id === state.selectedId);
  const canSplit = window && state.cursor > window.start && state.cursor < window.end;
  const actions = [
    { label: '撤销', Icon: Undo2, disabled: !state.past.length, onClick: state.undo },
    { label: '恢复', Icon: Redo2, disabled: !state.future.length, onClick: state.redo },
    { label: '切割', icon: <AssetIcon src={cutIcon} />, disabled: !canSplit, onClick: state.splitSelected },
    { label: '向左裁剪', icon: <AssetIcon src={splitLeftIcon} />, disabled: !canSplit || selected?.type === 'subtitle', onClick: () => state.trimSelected('left') },
    { label: '向右裁剪', icon: <AssetIcon src={splitRightIcon} />, disabled: !canSplit || selected?.type === 'subtitle', onClick: () => state.trimSelected('right') },
    { label: '分离音轨', Icon: DetachAudioIcon, disabled: selected?.type !== 'video' || state.hasDetachedAudio(state.selectedId), onClick: () => state.detachAudio(state.selectedId) },
    { label: '删除', Icon: DeleteIcon, disabled: !selected, onClick: () => state.removeSegment(state.selectedId) },
    { label: '添加字幕', Icon: Captions, onClick: () => { try { state.addSubtitle(); } catch (error) { showToast?.(error.message, 'error'); } } },
  ];
  return (
    <div role="toolbar" aria-label="时间线编辑工具" className="flex h-[40px] shrink-0 items-center gap-[10px] border-b border-stroke-normal px-[12px]">
      {actions.map(({ label, Icon, icon, disabled, onClick }) => (
        <Tooltip key={label} label={label} delay={250}>
          <IconButton
            aria-label={label}
            icon={icon || <Icon size={16} color="currentColor" style={{ width: 16, height: 16, flexShrink: 0 }} />}
            variant="secondary"
            size="small"
            style={{ width: 24, height: 24, padding: 0, border: 'none', borderRadius: 6, boxShadow: 'none', backgroundImage: 'none' }}
            className="cursor-pointer !bg-transparent enabled:hover:!bg-white-10 enabled:active:!bg-white-10 disabled:!bg-transparent"
            contentClassName="!text-white-80 group-enabled:group-hover:!text-white group-enabled:group-active:!text-white group-disabled:!text-white-30"
            disabled={disabled || !state.loaded}
            onClick={onClick}
          />
        </Tooltip>
      ))}
    </div>
  );
}
