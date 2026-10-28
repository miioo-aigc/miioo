import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Gauge, Volume2, VolumeX } from 'lucide-react';
import { AssetIcon, DetachAudioIcon } from './TimelineActionIcons';
import cutIcon from '../../assets/compositionEditor/Cut.svg';
import splitLeftIcon from '../../assets/compositionEditor/SplitLeft.svg';
import splitRightIcon from '../../assets/compositionEditor/SplitRight.svg';
import { DropdownMenu, DeleteIcon } from '../ui';
import { computeAudioWindows, computeVisualWindows, useCompositionEditorStore } from '../../stores/compositionEditorStore';
import { commonClipActions } from './TimelineSelection';

export default function TimelineContextMenu({ position, onClose }) {
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
  if (!items.length) return null;
  return createPortal(<div ref={panelRef} style={{ position: 'fixed', left: position.x, top: position.y, zIndex: 100, width: 'max-content', minWidth: 120, maxWidth: 'calc(100vw - 16px)' }}>
    <DropdownMenu items={items} onClose={onClose} width="max-content" style={{
      position: 'relative', minWidth: 120, maxWidth: 'calc(100vw - 16px)', whiteSpace: 'nowrap',
      bottom: 'auto', right: 'auto', marginBottom: 0,
    }} />
  </div>, document.body);
}
