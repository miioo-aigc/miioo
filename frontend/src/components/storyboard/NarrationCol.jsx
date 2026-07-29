/**
 * @file NarrationCol.jsx
 * @structure-index
 *
 * 分镜旁白列的编辑状态和展示组合；镜头数据通过显式 props 写回页面。
 */

import { useState } from 'react';
import { AddSlotBtn } from './NarrationAtoms';
import NarrationAddButton from './NarrationAddButton';
import { NarrationItem } from './NarrationItems';
import VoiceDubModal from './VoiceDubModal';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function NarrationCol({ segments, onChange, chars, globalVoiceParams = {}, onSaveGlobalVoice }) {
  // dubList: 多条角色+台词记录，每条 { role, speed, volume, lines }
  const [dubList, setDubList] = useState(() => {
    const validSegments = segments.filter((s) => s?.lines?.trim());
    if (validSegments.length === 0) return null;
    return validSegments.map((seg) => {
      const globalForRole = seg.role ? (globalVoiceParams[seg.role] ?? {}) : {};
      return {
        role: seg.role ?? '',
        speed: globalForRole.speed ?? 1.0,
        volume: globalForRole.volume ?? 70,
        lines: seg.lines ?? '',
      };
    });
  });
  // editingIdx: null=新增, number=编辑第几条
  const [editingIdx, setEditingIdx] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

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
      {/* 标题行 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: '0 1 auto', height: '20px' }}>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT }}>台词分配</span>
        {hasContent && (
          <NarrationAddButton onClick={openAdd} />
        )}
      </div>

      {/* 内容区 */}
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

function NarrationColWrapper({ shot, onChange, chars, globalVoiceParams, onSaveGlobalVoice }) {
  return (
    <NarrationCol
      segments={shot.narration.segments}
      onChange={(segs) => onChange({ ...shot, narration: { segments: segs } })}
      chars={chars}
      globalVoiceParams={globalVoiceParams}
      onSaveGlobalVoice={onSaveGlobalVoice}
    />
  );
}

export { NarrationCol, NarrationColWrapper };
