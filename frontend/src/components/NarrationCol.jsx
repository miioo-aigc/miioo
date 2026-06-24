import { useState, useEffect } from 'react';
import { FONT } from '../utils/fonts';
import NarrationItem from './NarrationItem';
import AddNarrationBtn from './AddNarrationBtn';
import AddSlotBtn from './AddSlotBtn';
import VoiceDubModal from './VoiceDubModal';

function NarrationCol({ segments, onChange, chars, globalVoiceParams = {}, onSaveGlobalVoice }) {
  const [dubList, setDubList] = useState(null);
  const [editingIdx, setEditingIdx] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (dubList === null && segments.length > 0) {
      const validSegments = segments.filter((s) => s?.lines?.trim());
      if (validSegments.length > 0) {
        const list = validSegments.map((seg) => {
          const globalForRole = seg.role ? (globalVoiceParams[seg.role] ?? {}) : {};
          return {
            role: seg.role ?? '',
            speed: globalForRole.speed ?? 1.0,
            volume: globalForRole.volume ?? 70,
            lines: seg.lines ?? '',
          };
        });
        setDubList(list);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const list = dubList ?? [];
  const hasContent = list.length > 0;

  function mergeWithGlobal(data) {
    const globalForRole = data?.role ? (globalVoiceParams[data.role] ?? {}) : {};
    return {
      speed: data?.speed ?? globalForRole.speed ?? 1.0,
      volume: data?.volume ?? globalForRole.volume ?? 70,
      role: data?.role ?? '',
      lines: data?.lines ?? '',
    };
  }

  function openAdd() {
    setEditingIdx(null);
    setModalOpen(true);
  }

  function openEdit(idx) {
    setEditingIdx(idx);
    setModalOpen(true);
  }

  function buildNext(data, usesGlobal = false) {
    const next = list.length > 0 ? [...list] : [];
    const entry = usesGlobal ? { ...data, _usesGlobal: true } : data;
    if (editingIdx === null) {
      next.push(entry);
    } else {
      next[editingIdx] = entry;
    }
    return next;
  }

  function handleSaveCurrent(data) {
    const next = buildNext(data);
    setDubList(next);
    onChange(next.map((d) => ({ role: d.role, lines: d.lines })));
    setModalOpen(false);
  }

  function handleSaveGlobal(data) {
    const next = buildNext(data, true);
    setDubList(next);
    onChange(next.map((d) => ({ role: d.role, lines: d.lines })));
    if (data.role) {
      onSaveGlobalVoice?.(data.role, { speed: data.speed, volume: data.volume });
    }
    setModalOpen(false);
  }

  function handleDelete(idx) {
    const next = list.filter((_, i) => i !== idx);
    setDubList(next.length > 0 ? next : null);
    onChange(next.map((d) => ({ role: d.role, lines: d.lines })));
  }

  const modalInitialData = editingIdx !== null && list[editingIdx]
    ? mergeWithGlobal(list[editingIdx])
    : { role: '', speed: 1.0, volume: 70, lines: '' };

  return (
    <div style={{
      width: 'calc(10% - 1px)',
      minWidth: '120px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      alignSelf: 'stretch',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT }}>台词分配</span>
        {hasContent && (
          <AddNarrationBtn onClick={openAdd} />
        )}
      </div>

      {!hasContent ? (
        <AddSlotBtn onClick={openAdd} />
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
          {list.map((item, idx) => (
            <NarrationItem
              key={idx}
              item={item}
              onEdit={() => openEdit(idx)}
              onDelete={() => handleDelete(idx)}
            />
          ))}
        </div>
      )}

      <VoiceDubModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        chars={chars}
        initialData={modalInitialData}
        onSaveCurrent={handleSaveCurrent}
        onSaveGlobal={handleSaveGlobal}
      />
    </div>
  );
}

export default NarrationCol;
