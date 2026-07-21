/**
 * @file ScriptCreationEntry.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   组合剧本模式、分镜脚本和 AI 直接创作三种初始入口
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-21  新增剧本页三种创作入口组合
 */
import InputCard from './InputCard';
import ScriptUploadCard from './ScriptUploadCard';

function ScriptCreationEntry({ onSend, onScriptFileSelect, scriptFile, onRemoveScriptFile, onStoryboardFileSelect, storyboardFile, onRemoveStoryboardFile, onDownloadTemplate, selectedModel, onModelChange, episodeCount, onEpisodeCountChange, episodeDuration, onEpisodeDurationChange, restoreText = '', projectId = '', showToast }) {
  return (
    <div style={{ position: 'relative', display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
      <div className="script-creation-upload-cards" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', width: '100%', minHeight: '280px', position: 'relative', top: '-40px' }}>
        <ScriptUploadCard
          title="剧本模式"
          accept=".txt,.md,.pdf,.docx,.doc"
          file={scriptFile}
          onFileSelect={onScriptFileSelect}
          onRemove={onRemoveScriptFile}
          layer={2}
        />
        <ScriptUploadCard
          title="分镜脚本"
          accept=".xlsx"
          file={storyboardFile}
          onFileSelect={onStoryboardFileSelect}
          onRemove={onRemoveStoryboardFile}
          layer={1}
          variant="storyboard"
          extraAction={{ label: '查看分镜模板.xlsx', onClick: onDownloadTemplate }}
        />
      </div>
      <div style={{ position: 'absolute', left: '50%', bottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: 'min(700px, 100%)', transform: 'translateX(-50%)' }}>
        <InputCard
          onSend={onSend}
          projectId={projectId}
          showToast={showToast}
          width="700px"
          selectedModel={selectedModel}
          onModelChange={onModelChange}
          episodeCount={episodeCount}
          onEpisodeCountChange={onEpisodeCountChange}
          episodeDuration={episodeDuration}
          onEpisodeDurationChange={onEpisodeDurationChange}
          restoreText={restoreText}
        />
      </div>
    </div>
  );
}

export default ScriptCreationEntry;
