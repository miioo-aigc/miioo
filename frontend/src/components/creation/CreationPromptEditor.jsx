/**
 * @file CreationPromptEditor.jsx
 * @description 创作输入区的提示词编辑与素材引用展示层。
 *
 * 组件只负责编辑器 DOM、占位提示和 @素材选择菜单；文件变更、生成请求、
 * 任务轮询与弹窗状态仍由 InputCard 通过 props 提供或处理。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import CreationDubbingEmotionMenu from './CreationDubbingEmotionMenu';
import CreationDubbingPauseMenu from './CreationDubbingPauseMenu';
import CreationDubbingInterjectionMenu from './CreationDubbingInterjectionMenu';
import { DubbingVoiceFileCard } from './CreationDubbingVoiceModal';
import { UploadPlaceholder } from './CreationUploadArea';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function PromptPlaceholder({ genType, refMode, dubbingAdvancedEnabled, disabled, onDocumentSelect, voiceWrapWidth = 0 }) {
  const documentInputRef = useRef(null);
  const baseStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
    fontFamily: FONT,
    fontSize: '14px',
    lineHeight: '18px',
    color: '#FFFFFF66',
    userSelect: 'none',
  };

  if (genType === 'image') {
    return (
      <span style={{ ...baseStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span>上传参考图，输入文字或</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(45,195,225,0.10)', color: '#2DC3E1', borderRadius: '6px', padding: '0 4px', fontSize: '14px', lineHeight: '18px', height: '18px', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}>@</span>
        <span>主体，描述你想生成的图片</span>
      </span>
    );
  }

  if (genType === 'video' && refMode === 'all') {
    return (
      <span style={{ ...baseStyle, display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
        <span>可自由组合图、文、音频、视频等元素，通过</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(45,195,225,0.10)', color: '#2DC3E1', borderRadius: '6px', padding: '0 4px', fontSize: '14px', lineHeight: '18px', height: '18px', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}>@</span>
        <span>绑定参考内容</span>
      </span>
    );
  }

  if (genType === 'dubbing' && dubbingAdvancedEnabled) {
    return (
      <span style={{ ...baseStyle, left: `${voiceWrapWidth}px`, maxWidth: `calc(100% - ${voiceWrapWidth}px)`, lineHeight: '150%', whiteSpace: 'pre-wrap' }}>
        请在此输入或者
        <button
          type="button"
          disabled={disabled}
          onClick={() => documentInputRef.current?.click()}
          style={{ border: 0, padding: 0, background: 'transparent', color: '#2DC3E1', font: 'inherit', lineHeight: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px', cursor: disabled ? 'not-allowed' : 'pointer', pointerEvents: 'auto' }}
        >
          上传
        </button>
        文字内容，生成您的精彩音频。<br />
        左下角支持添加情绪、停顿以及语气词，更多调整可以查看叠加效果器
        <input
          ref={documentInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.html"
          tabIndex={-1}
          aria-hidden="true"
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onDocumentSelect?.(file);
          }}
        />
      </span>
    );
  }

  const text = genType === 'video' && refMode === 'frame'
    ? '输入文字，描述你想创作的画面内容'
    : genType === 'video' && refMode === 'multi_shot'
      ? '请添加智能多帧分镜图'
      : genType === 'dubbing'
        ? '文字转语音'
        : '描述你想生成的内容';

  return <span style={baseStyle}>{text}</span>;
}

function CreationPromptEditor({
  editorRef,
  files,
  disabled,
  hasContent,
  genType,
  refMode,
  dubbingAdvancedEnabled,
  onDocumentSelect,
  onInput,
  onBeforeInput,
  onKeyDown,
  onPaste,
  onFocus,
  onBlur,
  renderFileCard,
  mentionOpen,
  mentionQuery,
  mentionPos,
  mentionMenuRef,
  mentionIndex,
  onMentionSelect,
  onMentionIndexChange,
  emotionMenuPosition,
  emotionMenuSelectedEmotion,
  onEmotionSelect,
  pauseMenuPosition,
  interjectionMenuPosition,
  onPauseSelect,
  onPauseCustomInput,
  onInterjectionSelect,
  voiceControl,
}) {
  const usesAdvancedDubbingTypography = genType === 'dubbing' && dubbingAdvancedEnabled;
  const voiceControlRef = useRef(null);
  const [voiceControlSize, setVoiceControlSize] = useState({ width: 0, height: 0 });
  const mentionFiles = files.filter((file) => (
    mentionQuery === '' || file.name.toLowerCase().includes(mentionQuery.toLowerCase())
  ));

  useEffect(() => {
    if (!mentionOpen || mentionFiles.length === 0) return;
    const menu = mentionMenuRef.current;
    const selectedItem = menu?.querySelector(`[data-mention-index="${mentionIndex}"]`);
    if (!menu || !selectedItem) return;

    const itemTop = selectedItem.offsetTop;
    const itemBottom = itemTop + selectedItem.offsetHeight;
    const visibleTop = menu.scrollTop + 4;
    const visibleBottom = menu.scrollTop + menu.clientHeight - 4;
    if (itemTop < visibleTop) {
      menu.scrollTop = Math.max(0, itemTop - 4);
    } else if (itemBottom > visibleBottom) {
      menu.scrollTop = itemBottom - menu.clientHeight + 4;
    }
  }, [mentionFiles.length, mentionIndex, mentionMenuRef, mentionOpen]);

  const measureVoiceControl = useCallback(() => {
    const element = voiceControlRef.current;
    if (!element) {
      setVoiceControlSize({ width: 0, height: 0 });
      return;
    }
    const nextSize = {
      width: Math.ceil(element.getBoundingClientRect().width),
      height: Math.ceil(element.getBoundingClientRect().height),
    };
    setVoiceControlSize((currentSize) => (
      currentSize.width === nextSize.width && currentSize.height === nextSize.height
        ? currentSize
        : nextSize
    ));
  }, []);

  useEffect(() => {
    const element = voiceControlRef.current;
    if (!voiceControl || !element) {
      setVoiceControlSize({ width: 0, height: 0 });
      return undefined;
    }

    measureVoiceControl();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measureVoiceControl);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measureVoiceControl, voiceControl, voiceControl?.voiceId, voiceControl?.voiceName]);

  const voiceWrapGap = voiceControl ? 16 : 0;
  const voiceWrapWidth = voiceControlSize.width + voiceWrapGap;
  const voiceWrapHeight = voiceControlSize.height;

  return (
    <>
      {files.length > 0 && (
        <div style={{ position: 'absolute', left: 0, right: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '8px', bottom: 'calc(100% + 24px)' }}>
          {files.map((file, index) => renderFileCard(file, index))}
        </div>
      )}
      <div style={{ flex: 1, alignSelf: 'stretch', position: 'relative' }}>
      {voiceControl && (
        <div ref={voiceControlRef} style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, width: 'max-content', maxWidth: 'calc(100% - 16px)' }}>
          {voiceControl.voiceId ? (
            <DubbingVoiceFileCard
              voiceName={voiceControl.voiceName}
              onRemove={voiceControl.onRemove}
              onOpenModal={voiceControl.onOpen}
            />
          ) : (
            <UploadPlaceholder
              onDirectClick={voiceControl.onOpen}
              tooltip="选择音色"
              allowedExts={voiceControl.allowedExts}
              acceptAttr={voiceControl.acceptAttr}
              disabled={disabled}
            />
          )}
        </div>
      )}
      {!hasContent && <PromptPlaceholder genType={genType} refMode={refMode} dubbingAdvancedEnabled={dubbingAdvancedEnabled} disabled={disabled} onDocumentSelect={onDocumentSelect} voiceWrapWidth={voiceWrapWidth} />}
      <div
        ref={editorRef}
        className={voiceControl ? 'creation-prompt-editor--voice-wrap' : undefined}
        contentEditable={!disabled}
        suppressContentEditableWarning
        style={{
          '--creation-voice-wrap-width': `${voiceWrapWidth}px`,
          '--creation-voice-wrap-height': `${voiceWrapHeight}px`,
          width: '100%',
          height: '100%',
          resize: 'none',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontFamily: FONT,
          fontSize: usesAdvancedDubbingTypography ? '16px' : '14px',
          lineHeight: usesAdvancedDubbingTypography ? '200%' : '18px',
          color: usesAdvancedDubbingTypography ? '#FFFFFFE6' : '#FFFFFFCC',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          cursor: disabled ? 'not-allowed' : 'text',
        }}
        onInput={onInput}
        onBeforeInput={onBeforeInput}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {usesAdvancedDubbingTypography && (
        <CreationDubbingEmotionMenu
          position={emotionMenuPosition}
          selectedEmotion={emotionMenuSelectedEmotion}
          onSelect={onEmotionSelect}
        />
      )}
      {usesAdvancedDubbingTypography && pauseMenuPosition && (
        <div style={{ position: 'absolute', top: pauseMenuPosition.top, left: pauseMenuPosition.left, zIndex: 110 }}>
          <CreationDubbingPauseMenu onSelect={onPauseSelect} onCustomInput={onPauseCustomInput} />
        </div>
      )}
      {usesAdvancedDubbingTypography && interjectionMenuPosition && (
        <div style={{ position: 'absolute', top: interjectionMenuPosition.top, left: interjectionMenuPosition.left, zIndex: 110 }}>
          <CreationDubbingInterjectionMenu onSelect={onInterjectionSelect} />
        </div>
      )}
      {mentionOpen && mentionFiles.length > 0 && (
        <div ref={mentionMenuRef} style={{
          position: 'absolute',
          top: mentionPos.top,
          left: mentionPos.left,
          zIndex: 100,
          width: '200px',
          maxHeight: '112px',
          overflowY: 'auto',
          borderRadius: '8px',
          boxShadow: '#00000066 0px 4px 16px',
          background: '#1D1E1E',
          border: '1px solid #FFFFFF0D',
          padding: '4px',
        }}>
          {mentionFiles.map((file, index) => (
            <div
              key={file.name + index}
              data-mention-index={index}
              onMouseDown={(event) => { event.preventDefault(); onMentionSelect(file); }}
              onMouseEnter={() => onMentionIndexChange(index)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '6px',
                background: index === mentionIndex ? '#FFFFFF0D' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                flexShrink: 0,
                background: (file.previewUrl || file.url) ? 'transparent' : '#FFFFFF14',
                backgroundImage: (file.previewUrl || file.url) ? `url(${file.previewUrl || file.url})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }} />
              <span style={{
                flex: 1,
                fontFamily: FONT,
                fontSize: '14px',
                lineHeight: '18px',
                color: index === mentionIndex ? '#FFFFFF' : '#FFFFFF99',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {file.name}
              </span>
            </div>
          ))}
        </div>
      )}
      </div>
    </>
  );
}

export default CreationPromptEditor;
