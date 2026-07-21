/**
 * @file ScriptPanel.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   编排剧本思考、流式、查看和编辑状态，并提供页面动作区
 *   ScriptEditor / AiStreamingContent / ScriptRendered 按当前状态动态加载
 *
 * ─── 状态边界 ───────────────────────────────────────────────────────
 *   不持有页面业务状态；通过 props 接收内容、状态、ref 和动作回调
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 ScriptPage 抽离，保持展示状态和动作区行为不变
 *   2026-07-15  增加 hasScript 显式 props，修复编辑按钮禁用判断
 */
import { lazy, Suspense } from 'react';
import { Button } from '../ui';
import AiThinkingMessage from './AiThinkingMessage';

const AiStreamingContent = lazy(() => import('./AiStreamingContent'));
const ScriptRendered = lazy(() => import('./ScriptRendered'));

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

export default function ScriptPanel({
  phase,
  scriptContent,
  draftContent,
  onEdit,
  onSave,
  onCancelEdit,
  onExtractRequest,
  isSubjectUnlocked,
  hasScript,
  onStreamingDone,
  isSseActive,
  onStreamingPause,
  streamingPaused,
  renderedContentRef,
  isSaving,
}) {
  // 兼容页面层既有 props 契约；主体解锁判断仍由页面的提取请求回调负责。
  void isSubjectUnlocked;

  const isThinking = phase === 'thinking';
  const isStreaming = phase === 'streaming';
  const isEditing = phase === 'edit';
  const displayContent = isEditing ? draftContent : scriptContent;
  const showActions = phase === 'view' || phase === 'edit';
  const isExtractDisabled = !scriptContent;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignSelf: 'stretch', minHeight: 0, flex: 1 }}>
      <div
        style={{
          background: '#161616',
          border: `1px solid ${isEditing ? '#2DC3E1' : '#FFFFFF14'}`,
          borderRadius: '16px',
          paddingTop: '16px',
          paddingBottom: '16px',
          paddingLeft: '12px',
          paddingRight: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          alignSelf: 'stretch',
          overflow: 'hidden',
          transition: 'border-color 0.2s',
          flex: 1,
          minHeight: '0px',
        }}
      >
        {isThinking ? (
          <div style={{ display: 'flex', flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' }}>
            <AiThinkingMessage />
          </div>
        ) : (
          <Suspense
            fallback={
              <div style={{ display: 'flex', flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' }}>
                <AiThinkingMessage />
              </div>
            }
          >
            {isStreaming ? (
              <AiStreamingContent content={scriptContent} onDone={onStreamingDone} paused={streamingPaused} onPause={onStreamingPause} sseActive={isSseActive} />
            ) : (
              <ScriptRendered content={displayContent} contentRef={renderedContentRef} />
            )}
          </Suspense>
        )}
      </div>

      {showActions && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            alignSelf: 'stretch',
            minHeight: '36px',
            flexShrink: 0,
          }}
        >
          {isEditing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Button variant="primary" onClick={onSave} disabled={isSaving}>
                {isSaving ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'btn-spin 0.75s linear infinite', transformOrigin: '50% 50%' }}>
                    <circle cx="8" cy="8" r="6" stroke="#FFFFFF33" strokeWidth="1.5" />
                    <path d="M14 8a6 6 0 0 0-6-6" stroke="#FFFFFFCC" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M13 4.5L6 11.5L3 8.5" stroke="#FFFFFF" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFFCC' }}>定稿</span>
              </Button>
              <Button variant="primary" onClick={onCancelEdit}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4.667 4.667L11.333 11.333" stroke="#FFFFFF" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4.667 11.333L11.333 4.667" stroke="#FFFFFF" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFFCC' }}>取消</span>
              </Button>
            </div>
          ) : (
            <Button variant="primary" onClick={onEdit} disabled={!hasScript}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M11.333 2a1.886 1.886 0 0 1 2.667 2.667L4.667 14H2v-2.667L11.333 2z" stroke="#FFFFFF" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFFCC' }}>编辑</span>
            </Button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button variant="accent" onClick={isExtractDisabled ? undefined : onExtractRequest} disabled={isExtractDisabled}>
              <span style={{ fontFamily: FONT_MEDIUM, fontSize: '14px', lineHeight: '18px', color: '#090909', whiteSpace: 'nowrap' }}>
                开始提取主体
              </span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M14 8H2" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 4L14 8L10 12" stroke="#090909" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
