import { useState, useRef } from 'react';
import NarrationCol from './NarrationCol';
import NumberCol from './NumberCol';
import DescriptionCol from './DescriptionCol';
import TextEditCol from './TextEditCol';
import MediaCol from './MediaCol';
import MainRefCol from './MainRefCol';
import ConfirmDialog from './ConfirmDialog';
import { apiUploadStoryboardImage, apiUploadStoryboardVideo } from '../api/storyboard';
import { normalizeImageUrl } from '../utils/imageUrl';

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

function MainRefColWrapper({ shot, onChange, chars, projectId }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      alignItems: 'flex-start',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif' }}>
        主体参考
      </span>
      <MainRefCol
        shot={shot}
        onChange={onChange}
        chars={chars}
        projectId={projectId}
      />
    </div>
  );
}

function MediaColWrapper({ label, media, onUpload, accept, isVideo, isLast = false, onAIGenerate, shotMeta, generating }) {
  return (
    <div style={{
      width: 'calc(15% - 1px)',
      minWidth: '160px', maxWidth: '220px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px',
      borderRight: isLast ? 'none' : '1px solid rgba(255,255,255,0.08)',
      alignSelf: 'stretch',
    }}>
      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif', flexShrink: 0 }}>
        {label}
      </span>
      <MediaCol
        media={media}
        onUpload={onUpload}
        accept={accept}
        isVideo={isVideo}
        label={label}
        onAIGenerate={onAIGenerate}
        shotMeta={shotMeta}
        generating={generating}
      />
    </div>
  );
}

export default function ShotRow({ shot, onChange, onAdd, onCopy, onDelete, chars, isDragging, onDragStart, onDragOver, onDrop, insertBefore, insertAfter, onGenerateImage, onGenerateVideo, globalVoiceParams, onSaveGlobalVoice, projectId, generatingImage, generatingVideo, isSelectMode = false, isSelected = false, onToggleSelect }) {
  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dragFromHandle = useRef(false);
  function armDragHandle() {
    dragFromHandle.current = true;
    window.addEventListener('mouseup', () => { dragFromHandle.current = false; }, { once: true });
  }

  return (
    <>
      {insertBefore && (
        <div style={{ height: '2px', borderRadius: '1px', backgroundColor: '#2DC3E1', flexShrink: 0, marginBlock: '-4px', zIndex: 10 }} />
      )}
      <div
        draggable={!isSelectMode}
        onDragStart={(e) => {
          if (isSelectMode || !dragFromHandle.current) { e.preventDefault(); return; }
          onDragStart?.();
        }}
        onDragEnd={() => { dragFromHandle.current = false; }}
        onDragOver={(e) => { e.preventDefault(); onDragOver?.(); }}
        onDrop={(e) => { e.preventDefault(); onDrop?.(); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          minHeight: '140px',
          height: '140px',
          minWidth: '1160px',
          borderRadius: '12px',
          backgroundColor: '#1D1E1E',
          border: `1px solid ${isSelected ? 'rgba(45,195,225,0.60)' : hovered ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)'}`,
          boxShadow: hovered ? 'rgba(0,0,0,0.50) 0px 0px 30px' : 'none',
          flexShrink: 0,
          transition: 'border-color 150ms, box-shadow 150ms, opacity 150ms',
          overflow: 'hidden',
          opacity: isDragging ? 0.40 : 1,
        }}
      >
        <NumberCol
          number={shot.number}
          isHovered={hovered}
          onAdd={onAdd}
          onCopy={onCopy}
          onDeleteRequest={() => setConfirmDelete(true)}
          onDragHandlePress={armDragHandle}
          isSelectMode={isSelectMode}
          isSelected={isSelected}
          onToggleSelect={onToggleSelect}
        />
        <DescriptionCol shot={shot} onChange={onChange} />
        <TextEditCol
          label="光影"
          value={shot.lightShadow}
          onChange={(v) => onChange({ ...shot, lightShadow: v })}
        />
        <TextEditCol
          label="环境音"
          value={shot.ambientSound}
          onChange={(v) => onChange({ ...shot, ambientSound: v })}
        />
        <NarrationColWrapper shot={shot} onChange={onChange} chars={chars} globalVoiceParams={globalVoiceParams} onSaveGlobalVoice={onSaveGlobalVoice} />
        <MainRefColWrapper shot={shot} onChange={onChange} chars={chars} projectId={projectId} />
        <MediaColWrapper
          label="分镜图"
          media={shot.storyboardImage}
          onUpload={(m) => {
            onChange({ ...shot, storyboardImage: m });
            if (m.file) {
              apiUploadStoryboardImage(projectId, shot.id, m.file)
                .then(result => {
                  const url = normalizeImageUrl(result.url || result.image_url || result.imageUrl);
                  if (url) onChange({ ...shot, storyboardImage: { id: url, url, name: m.name, type: m.type } });
                })
                .catch(err => console.error('[StoryboardPage] 图片上传失败:', err));
            }
          }}
          accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.svg"
          isVideo={false}
          onAIGenerate={onGenerateImage}
          generating={generatingImage}
        />
        <MediaColWrapper
          label="分镜视频"
          media={shot.storyboardVideo}
          onUpload={(m) => {
            onChange({ ...shot, storyboardVideo: m });
            if (m.file) {
              apiUploadStoryboardVideo(projectId, shot.id, m.file)
                .then(result => {
                  const url = normalizeImageUrl(result.video_url || result.videoUrl || result.url);
                  if (url) onChange({ ...shot, storyboardVideo: { id: url, url, name: m.name, type: m.type } });
                })
                .catch(err => console.error('[StoryboardPage] 视频上传失败:', err));
            }
          }}
          accept=".mp4,.webm,.mov,.avi,.mkv"
          isVideo={true}
          isLast={true}
          onAIGenerate={onGenerateVideo}
          generating={generatingVideo}
          shotMeta={{
            label: `镜头 ${String(shot.number).padStart(2, '0')}`,
            prompt: shot.description,
            model: shot.storyboardVideo?.model ?? '—',
            resolution: shot.storyboardVideo?.resolution ?? '—',
            duration: shot.params?.duration ? parseFloat(shot.params.duration) : undefined,
            aspectRatio: '16:9',
            finalized: shot.storyboardVideo?.finalized ?? false,
          }}
        />
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title="确定要删除吗？"
          description={`此操作不可撤销，镜头 ${String(shot.number).padStart(2, '0')} 将被永久删除。`}
          confirmText="删除"
          onConfirm={() => { setConfirmDelete(false); onDelete?.(); }}
          onCancel={() => setConfirmDelete(false)}
          zIndex={9998}
        />
      )}
      {insertAfter && (
        <div style={{ height: '2px', borderRadius: '1px', backgroundColor: '#2DC3E1', flexShrink: 0, marginBlock: '-4px', zIndex: 10 }} />
      )}
    </>
  );
}
