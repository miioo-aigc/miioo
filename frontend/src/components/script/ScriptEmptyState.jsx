/**
 * @file ScriptEmptyState.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   无剧本时的三种创作入口布局和输入卡接线
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 ScriptPage 抽离，保持空状态布局和输入参数不变
 *   2026-07-21  增加剧本模式、分镜脚本和 AI 直接创作入口
 */
import ScriptCreationEntry from './ScriptCreationEntry';

function ScriptEmptyState({ onSend, onScriptFileSelect, scriptFile, onRemoveScriptFile, onStoryboardFileSelect, storyboardFile, onRemoveStoryboardFile, onDownloadTemplate, selectedModel, onModelChange, episodeCount, onEpisodeCountChange, episodeDuration, onEpisodeDurationChange, restoreText = '', projectId = '', showToast }) {
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'stretch',
        paddingBottom: 0,
      }}
    >
      <ScriptCreationEntry
        onSend={onSend}
        onScriptFileSelect={onScriptFileSelect}
        scriptFile={scriptFile}
        onRemoveScriptFile={onRemoveScriptFile}
        onStoryboardFileSelect={onStoryboardFileSelect}
        storyboardFile={storyboardFile}
        onRemoveStoryboardFile={onRemoveStoryboardFile}
        onDownloadTemplate={onDownloadTemplate}
        projectId={projectId}
        showToast={showToast}
        selectedModel={selectedModel}
        onModelChange={onModelChange}
        episodeCount={episodeCount}
        onEpisodeCountChange={onEpisodeCountChange}
        episodeDuration={episodeDuration}
        onEpisodeDurationChange={onEpisodeDurationChange}
        restoreText={restoreText}
      />
    </div>
  );
}

export default ScriptEmptyState;
