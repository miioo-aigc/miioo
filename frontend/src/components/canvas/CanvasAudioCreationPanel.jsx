/**
 * 音频节点高级创作编排：复用配音编辑器、音色和工具栏。
 * 草稿由常驻节点外壳持有；这里只管理菜单、焦点及编辑器 DOM，不调用生成接口。
 * 2026-09-28 底栏分为参数行与高级操作行，发送按钮位于第二行右侧。
 * 2026-09-28 发送先补选音色，再校验台词；确认音色不自动发送。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useViewport } from '@xyflow/react';
import { ComposerSurface } from '../ui';
import CreationPromptEditor from '../creation/CreationPromptEditor';
import CreationDubbingAdvancedToolbar from '../creation/CreationDubbingAdvancedToolbar';
import DubbingVoiceModal from '../creation/CreationDubbingVoiceModal';
import CreationSendButton from '../creation/CreationSendButton';
import { useCreationPromptInteraction } from '../creation/useCreationPromptInteraction';
import { DEFAULT_DUBBING_EFFECTS } from '../creation/CreationDubbingEffectsDefaults';
import CanvasMediaControls from './CanvasMediaControls';
import { showGlobalToast } from '../../stores/toastStore';

const NO_FILES = [];

export default function CanvasAudioCreationPanel({ nodeId, prompt = '', controls, draft, onDraftChange, onPromptChange, onGenerate }) {
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [prefillData] = useState(() => ({ prompt, promptHTML: draft?.snapshot?.html }));
  const { zoom } = useViewport();
  const showToast = useCallback((_type, message) => setFeedback(message), []);
  const editor = useCreationPromptInteraction({
    files: NO_FILES, genType: 'dubbing', dubbingAdvancedEnabled: true,
    prefillVersion: 1,
    prefillData,
    showToast,
    handleFileSelect: () => setFeedback('音频创作输入区仅支持文字，请通过音色按钮选择音色'),
  });
  const { editorRef, getPromptSnapshot } = editor;
  const effects = draft?.effects ?? DEFAULT_DUBBING_EFFECTS;
  const voice = draft?.voice;
  const latest = useRef(null);
  useEffect(() => { latest.current = { onDraftChange, onPromptChange }; });

  const syncDraft = useCallback(() => {
    const snapshot = getPromptSnapshot();
    latest.current.onDraftChange((current) => current?.snapshot?.html === snapshot.html
      ? current : { ...current, snapshot });
    latest.current.onPromptChange?.(snapshot.requestText);
  }, [getPromptSnapshot]);

  useEffect(() => {
    const element = editorRef.current;
    const observer = new MutationObserver(syncDraft);
    observer.observe(element, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [editorRef, syncDraft]);

  const updateEffects = (patch) => onDraftChange((current) => ({ ...current, effects: { ...effects, ...patch } }));
  const send = () => {
    setFeedback('');
    if (!voice?.id) { setVoiceOpen(true); return; }
    const snapshot = getPromptSnapshot();
    if (!snapshot.requestText?.trim()) { showGlobalToast('warning', '请先输入台词'); return; }
    if (!controls.model) { setFeedback('请先选择模型'); return; }
    onGenerate?.({ nodeId, prompt: snapshot.requestText, model: controls.model, params: {
      speed: controls.dubbingSpeed, pitch: controls.dubbingPitch, volume: controls.dubbingVolume,
      voiceId: voice.id, voiceName: voice.name, voiceSource: voice.source,
      advancedEnabled: true, effects,
    } });
  };
  // 旧编辑器的内联菜单坐标是屏幕像素，换算为画布缩放前的局部坐标。
  const localPosition = (position) => {
    if (!position) return position;
    return { top: position.top / zoom, left: position.left / zoom };
  };

  return <section className="canvas-creation-panel canvas-audio-creation-panel nodrag nowheel" aria-label="音频节点创作输入" onKeyDown={(event) => event.stopPropagation()}>
    <ComposerSurface width="100%" focused={editor.focused} toolbar={<>
      <CanvasMediaControls nodeType="audio" controls={controls} />
      <div className="canvas-audio-creation-panel__advanced-row">
        <CreationDubbingAdvancedToolbar
          hasTextSelection={editor.hasTextSelection}
          onEmotionClick={editor.openEmotionMenu}
          onPauseClick={() => editor.openInlineMenu('pause')}
          onInterjectionClick={() => editor.openInlineMenu('interjection')}
          effects={effects}
          onEffectToneChange={(key, value) => updateEffects({ toneValues: { ...effects.toneValues, [key]: value } })}
          onEffectToggle={(selectedEffects) => updateEffects({ selectedEffects })}
        />
        <CreationSendButton onClick={send} />
      </div>
    </>}>
      <CreationPromptEditor
        voiceWrapGap={12}
        editorRef={editorRef} files={NO_FILES} genType="dubbing" dubbingAdvancedEnabled
        hasContent={editor.hasContent} allowDocumentUpload={false}
        onInput={() => { editor.handleInput(); syncDraft(); }}
        onBeforeInput={editor.handleBeforeInput} onPaste={editor.handlePaste}
        onKeyDown={(event) => editor.handleKeyDown(event, send)}
        onFocus={editor.handleEditorFocus} onBlur={() => { editor.handleEditorBlur(); syncDraft(); }}
        emotionMenuPosition={editor.emotionMenuPosition} emotionMenuSelectedEmotion={editor.emotionMenuSelectedEmotion}
        onEmotionSelect={editor.applyEmotion}
        pauseMenuPosition={localPosition(editor.pauseMenuPosition)} interjectionMenuPosition={localPosition(editor.interjectionMenuPosition)}
        onPauseSelect={(value) => editor.insertInlineTag(`#${value.replace('s', '')}#`, 'pause')}
        onPauseCustomInput={(value) => editor.insertInlineTag(`#${value}#`, 'pause')}
        onInterjectionSelect={(value) => editor.insertInlineTag(value, 'interjection')}
        voiceControl={{ voiceId: voice?.id, voiceName: voice?.name, onOpen: () => setVoiceOpen(true),
          onRemove: () => onDraftChange((current) => ({ ...current, voice: null })) }}
      />
    </ComposerSurface>
    {feedback && <div role="status" className="canvas-audio-creation-panel__feedback">{feedback}</div>}
    <DubbingVoiceModal open={voiceOpen} onClose={() => setVoiceOpen(false)} currentVoice={voice?.id} showToast={showToast}
      onConfirm={(id, name, _tab, source) => {
        onDraftChange((current) => ({ ...current, voice: { id, name, source } }));
        setVoiceOpen(false);
      }} />
  </section>;
}
