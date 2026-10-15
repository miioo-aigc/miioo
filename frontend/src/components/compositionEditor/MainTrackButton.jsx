import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { TextButton, Tooltip, DropdownMenu } from '../ui';
import ConfirmDialog from '../ConfirmDialog';
import { useCompositionEditorStore } from '../../stores/compositionEditorStore';
import { getTrackDeletionState } from '../../utils/TrackDeletion';

export default function MainTrackButton({ track, active, onChange }) {
  const [menu, setMenu] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const segments = useCompositionEditorStore((state) => state.segments);
  const trackSettings = useCompositionEditorStore((state) => state.trackSettings);
  const deleteTrack = useCompositionEditorStore((state) => state.deleteTrack);
  const { count, reason } = getTrackDeletionState(segments, trackSettings, track);

  function openMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu({
      left: Math.max(8, Math.min(event.type === 'keydown' ? rect.left : event.clientX, window.innerWidth - 288)),
      top: Math.max(8, Math.min(event.type === 'keydown' ? rect.bottom : event.clientY, window.innerHeight - 100)),
    });
  }

  return <>
    <Tooltip label={active ? '取消主轨道' : '设置为主轨道'} delay={250}>
    <TextButton variant="link" size="small" aria-label={`${track} ${active ? '取消主轨道' : '设置为主轨道'}`} aria-pressed={active}
      onContextMenu={openMenu}
      onKeyDown={(event) => { if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) openMenu(event); }}
      onClick={() => onChange(track)} className="hover:bg-white-10"
      style={{ width: 28, height: 24, padding: 0, border: 'none', borderRadius: 'var(--radius-small)', boxShadow: 'none' }}>
      <span className={active ? 'text-brand-main' : 'text-white-60'}>{track}</span>
    </TextButton>
    </Tooltip>
    {menu && createPortal(<DropdownMenu
      width={reason ? '280px' : '178px'}
      style={{ position: 'fixed', ...menu, bottom: 'auto', right: 'auto', marginBottom: 0, zIndex: 110 }}
      onClose={() => setMenu(null)}
      items={[{ key: 'delete', label: reason || '删除轨道', icon: <Trash2 size={16} />, danger: true, disabled: !!reason,
        onClick: () => { if (count) setConfirming(true); else deleteTrack(track); } }]}
    />, document.body)}
    {confirming && <ConfirmDialog
      title={`删除 ${track} 轨道？`}
      description={reason || `此轨道包含 ${count} 个片段。删除轨道将同时删除轨道内的全部片段，素材区及资产库原文件不受影响。`}
      confirmText={reason ? '知道了' : '删除轨道'}
      onCancel={() => setConfirming(false)}
      onConfirm={() => { if (!reason) deleteTrack(track); setConfirming(false); }}
    />}
  </>;
}
