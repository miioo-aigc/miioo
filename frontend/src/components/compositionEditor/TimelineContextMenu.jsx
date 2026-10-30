import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Gauge, Volume2, VolumeX } from 'lucide-react';
import { AssetIcon, DetachAudioIcon, ShowEditorIcon } from './TimelineActionIcons';
import cutIcon from '../../assets/compositionEditor/Cut.svg';
import splitLeftIcon from '../../assets/compositionEditor/SplitLeft.svg';
import splitRightIcon from '../../assets/compositionEditor/SplitRight.svg';
import { DropdownMenu, DeleteIcon } from '../ui';
import { computeAudioWindows, computeVisualWindows, useCompositionEditorStore } from '../../stores/compositionEditorStore';
import { commonClipActions } from './TimelineSelection';

export default function TimelineContextMenu({ position, onClose, onDeleteTrack }) {
  const state = useCompositionEditorStore();
  const panelRef = useRef(null);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    panel.style.left = Math.max(8, Math.min(position.x, window.innerWidth - rect.width - 8)) + 'px';
    panel.style.top = Math.max(8, Math.min(position.y, window.innerHeight - rect.height - 8)) + 'px';
  });
  useEffect(() => {
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    return () => {
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);
  const available = commonClipActions(state, [...computeVisualWindows(state.segments).windows, ...computeAudioWindows(state.segments).windows]);
  const labels = { split: '切割', trimLeft: '向左裁剪', trimRight: '向右裁剪', detach: '分离音轨', speed: '倍速', volume: '音量', delete: '删除' };
  const shortcuts = { split: 'C', trimLeft: 'Q', trimRight: 'W', delete: '⌫' };
  const icons = { split: <AssetIcon src={cutIcon} />, trimLeft: <AssetIcon src={splitLeftIcon} />, trimRight: <AssetIcon src={splitRightIcon} />,
    detach: <DetachAudioIcon />, speed: <Gauge size={16} />, volume: <Volume2 size={16} />, delete: <DeleteIcon size={16} color="currentColor" /> };
  const items = available.map((key) => ({
    key, icon: icons[key], label: <span className="flex items-center justify-between gap-[16px] whitespace-nowrap"><span>{labels[key]}</span>{shortcuts[key] && <span className="shrink-0 text-[12px] text-text-hint">{shortcuts[key]}</span>}</span>, danger: key === 'delete',
    ...(key === 'speed' || key === 'volume' ? {
      submenuWidth: 120,
      submenuMinWidth: 120,
      items: (key === 'speed' ? [0.5, 0.75, 1, 1.5, 2, 3, 4] : [0, 0.5, 1, 1.5, 2]).map((value) => ({
        key: value, icon: key === 'speed' ? <Gauge size={16} /> : value === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />, label: key === 'speed' ? value + ' 倍' : value === 0 ? '静音' : Math.round(value * 100) + '%',
        onClick: () => state.applySelectionAction(key, value),
      })),
    } : { onClick: () => state.applySelectionAction(key) }),
  }));
  const selected = state.segments.find(seg => seg.id === state.selectedId);
  const deleteIndex = items.findIndex(item => item.key === 'delete');
  if (!state.segments.some(seg => (state.selectedIds.includes(seg.id) || seg.id === state.selectedId) && seg.type === 'subtitle')) items.splice(deleteIndex < 0 ? items.length : deleteIndex, 0, { key: 'show-editor', icon: <ShowEditorIcon />, label: '显示编辑框', disabled: state.selectedIds.length > 1 || !selected || !['image', 'video'].includes(selected.type) || Boolean(state.trackSettings[selected.track || 'V1']?.locked || state.trackSettings[selected.track || 'V1']?.hidden), onClick: state.showVisualEditor });
  if (position.track) {
    const track = position.track;
    const label = { V: '视频', A: '音频', S: '字幕' }[track[0]];
    const all = [...Object.keys(state.trackSettings), ...state.segments.map(s => s.track || (s.type === 'audio' ? 'A1' : s.type === 'subtitle' ? 'S1' : 'V1'))];
    const full = all.some(t => t[0] === track[0] && Number(t.slice(1)) >= 6);
    items.splice(0, items.length, ...['above', 'below'].map(side => ({ key: side,
      label: (side === 'above' ? '↑向上' : '↓向下') + '新增' + label + '轨道', disabled: full,
      onClick: () => state.insertTrack(track, side),
    })));
    items.push({ key: 'delete-track', label: '删除轨道', dangerOnHover: true, color: '#FFFFFF', icon: <DeleteIcon size={16} color="currentColor" />, onClick: () => onDeleteTrack(track) });
  }
  return createPortal(<div ref={panelRef} style={{ position: 'fixed', left: position.x, top: position.y, zIndex: 100, width: 'max-content', minWidth: 120, maxWidth: 'calc(100vw - 16px)' }}>
    <DropdownMenu items={items} onClose={onClose} width="max-content" style={{
      position: 'relative', minWidth: 120, maxWidth: 'calc(100vw - 16px)', whiteSpace: 'nowrap',
      bottom: 'auto', right: 'auto', marginBottom: 0,
    }} />
  </div>, document.body);
}
