/**
 * @file ScriptEmptyState.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   无剧本时的输入区布局壳，向 InputCard 透传页面回调和恢复数据
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 ScriptPage 抽离，保持空状态布局和输入参数不变
 */
import InputCard from './InputCard';

function ScriptEmptyState({ onSend, selectedModel, onModelChange, episodeCount, onEpisodeCountChange, restoreText = '', restoreFiles = [], projectId = '', showToast }) {
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        alignSelf: 'stretch',
        paddingBottom: '24px',
      }}
    >
      <InputCard
        onSend={onSend}
        projectId={projectId}
        showToast={showToast}
        width="700px"
        selectedModel={selectedModel}
        onModelChange={onModelChange}
        episodeCount={episodeCount}
        onEpisodeCountChange={onEpisodeCountChange}
        restoreText={restoreText}
        restoreFiles={restoreFiles}
      />
    </div>
  );
}

export default ScriptEmptyState;
