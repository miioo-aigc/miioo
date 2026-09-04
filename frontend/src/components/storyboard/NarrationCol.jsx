/**
 * @file NarrationCol.jsx
 * @structure-index
 *
 * 分镜旁白列的编辑状态和展示组合；镜头数据通过显式 props 写回页面。
 * 更新记录：2026-09-04 台词记录增加 role_type、subject_id、voice 字段，移除语速/音量及全局应用回调。
 */

import { useState } from 'react';
import { AddSlotBtn } from './NarrationAtoms';
import NarrationAddButton from './NarrationAddButton';
import { NarrationItem } from './NarrationItems';
import VoiceDubModal from './VoiceDubModal';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function normalizeVoice(voice) {
  if (!voice) return null;
  const voiceId = voice.voice_id || voice.voiceId || voice.id;
  if (!voiceId) return null;
  return {
    voice_id: voiceId,
    voice_name: voice.voice_name || voice.voiceName || voice.name || voiceId,
    voice_preview_url: voice.voice_preview_url || voice.voicePreviewUrl || voice.preview_url || voice.previewUrl || voice.audioUrl || null,
  };
}

function normalizeSegment(segment, globalVoiceParams) {
  const role = segment?.role ?? '';
  const voice = normalizeVoice(segment?.voice || segment);
  return {
    role,
    role_type: segment?.role_type || (role === '旁白' ? 'narrator' : 'subject'),
    subject_id: segment?.subject_id || segment?.subjectId || null,
    voice: voice || normalizeVoice(globalVoiceParams[role]),
    lines: segment?.lines ?? '',
  };
}

function serializeSegment(segment) {
  const voice = normalizeVoice(segment?.voice);
  return {
    role: segment?.role ?? '',
    role_type: segment?.role_type || (segment?.role === '旁白' ? 'narrator' : 'subject'),
    subject_id: segment?.subject_id || null,
    voice_id: voice?.voice_id || null,
    voice_name: voice?.voice_name || null,
    voice_preview_url: voice?.voice_preview_url || null,
    lines: segment?.lines ?? '',
  };
}

function NarrationCol({ segments, onChange, chars, globalVoiceParams = {}, onVoiceChange }) {
  // dubList: 多条角色+台词记录，每条 { role, role_type, subject_id, voice, lines }
  const [dubList, setDubList] = useState(() => {
    const validSegments = segments.filter((s) => s?.lines?.trim());
    if (validSegments.length === 0) return null;
    return validSegments.map((seg) => normalizeSegment(seg, globalVoiceParams));
  });
  // editingIdx: null=新增, number=编辑第几条
  const [editingIdx, setEditingIdx] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const list = dubList ?? [];
  const hasContent = list.length > 0;

  function mergeWithGlobal(data) {
    const character = chars.find((item) => item.name === data?.role);
    return {
      role: data?.role ?? '',
      voice: normalizeVoice(data?.voice) || normalizeVoice(globalVoiceParams[data?.role]) || normalizeVoice(character),
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

  function buildNext(data) {
    const next = list.length > 0 ? [...list] : [];
    const character = chars.find((item) => item.name === data?.role);
    const entry = {
      ...data,
      role_type: data?.role === '旁白' ? 'narrator' : 'subject',
      subject_id: character?.id || null,
      voice: normalizeVoice(data?.voice),
    };
    if (editingIdx === null) {
      next.push(entry);
    } else {
      next[editingIdx] = entry;
    }
    return next;
  }

  async function handleConfirm(data) {
    const next = buildNext(data);
    setDubList(next);
    onChange(next.map(serializeSegment));
    setModalOpen(false);
    return true;
  }

  function handleDelete(idx) {
    const next = list.filter((_, i) => i !== idx);
    setDubList(next.length > 0 ? next : null);
    onChange(next.map(serializeSegment));
  }

  const modalInitialData = editingIdx !== null && list[editingIdx]
    ? mergeWithGlobal(list[editingIdx])
    : { role: '', voice: null, lines: '' };

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
        globalVoices={globalVoiceParams}
        onVoiceChange={onVoiceChange}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

function NarrationColWrapper({ shot, onChange, chars, globalVoiceParams, onVoiceChange }) {
  return (
    <NarrationCol
      segments={shot.narration.segments}
      onChange={(segs) => onChange({ ...shot, narration: { segments: segs } })}
      chars={chars}
      globalVoiceParams={globalVoiceParams}
      onVoiceChange={onVoiceChange}
    />
  );
}

export { NarrationCol, NarrationColWrapper };
