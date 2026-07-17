/**
 * @file CreationWorkspace.jsx
 * @structure-index
 *
 * ─── 组件职责 ─────────────────────────────────────────────────────
 *   创作页主体卡片的布局、工具栏和结果/空态分支组合
 *
 * ─── 依赖边界 ─────────────────────────────────────────────────────
 *   只接收页面显式传入的数据和回调；不读取 CreationPage 闭包、不调用 API、Store 或缓存
 *   生成、历史、收藏、删除、模型加载和任务轮询仍由 CreationPage 编排
 *
 * ─── 更新记录 ─────────────────────────────────────────────────────
 *   2026-07-17  从 CreationPage 抽离主体卡片组合，保持行为和页面级副作用边界不变
 */
import CreationToolbar from './CreationToolbar';
import CreationResultState from './CreationResultState';
import CreationEmptyState from './CreationEmptyState';
import CreationLoginEmptyState from './CreationLoginEmptyState';
import { CREATION_TABS } from './CreationTabs';

export default function CreationWorkspace({
  isLoggedIn, onLoginClick, activeTab, onTabChange, batchMode, selectedCount,
  onEnterBatch, onSelectAll, onDownload, onDelete, onCancelBatch, onClearHistory,
  font, fontMedium, generations, onGenerate, genType, isGenerating,
  onGenTypeChange, model, onModelChange, modelOptions, creationParams,
  capabilitiesMap, onDeleteCard, selected, onToggleSelect, onSwitchToFrameMode,
  onVideoCardClick, favorites, toggleFavorite, showToast, historyLoading,
  historyHasMore, onLoadMore, autoFillLimit, activeCount, onBeforeModelOpen,
  renderInputCard,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, flexBasis: '0%', minHeight: 0, height: '100%', overflow: 'clip', alignSelf: 'stretch', paddingBottom: '24px', paddingRight: '24px', fontSize: '12px', lineHeight: '16px', WebkitFontSmoothing: 'antialiased' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minHeight: 0, borderRadius: '16px', overflow: 'clip', alignSelf: 'stretch', backgroundColor: '#161616', border: '1px solid #FFFFFF14' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'stretch', flexShrink: 0 }}>
          <CreationToolbar tabs={CREATION_TABS} activeTab={activeTab} onTabChange={onTabChange} batchMode={batchMode} selectedCount={selectedCount} onEnterBatch={onEnterBatch} onSelectAll={onSelectAll} onDownload={onDownload} onDelete={onDelete} onCancelBatch={onCancelBatch} onClearHistory={onClearHistory} font={font} fontMedium={fontMedium} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0%', minHeight: 0, padding: '0px', overflow: 'clip', alignSelf: 'stretch', position: 'relative' }}>
          {isLoggedIn === false ? (
            <CreationLoginEmptyState onLoginClick={onLoginClick} />
          ) : generations.length > 0 || historyLoading ? (
            <CreationResultState generations={generations} onGenerate={onGenerate} genType={genType} isGenerating={isGenerating} onGenTypeChange={onGenTypeChange} model={model} onModelChange={onModelChange} modelOptions={modelOptions} creationParams={creationParams} capabilitiesMap={capabilitiesMap} onDeleteCard={onDeleteCard} batchMode={batchMode} selected={selected} onToggleSelect={onToggleSelect} onSwitchToFrameMode={onSwitchToFrameMode} onVideoCardClick={onVideoCardClick} favorites={favorites} toggleFavorite={toggleFavorite} showToast={showToast} historyLoading={historyLoading} historyHasMore={historyHasMore} onLoadMore={onLoadMore} autoFillLimit={autoFillLimit} activeCount={activeCount} onBeforeModelOpen={onBeforeModelOpen} renderInputCard={renderInputCard} />
          ) : (
            <CreationEmptyState onGenerate={onGenerate} genType={genType} onGenTypeChange={onGenTypeChange} showToast={showToast} activeCount={activeCount} model={model} onModelChange={onModelChange} modelOptions={modelOptions} creationParams={creationParams} capabilitiesMap={capabilitiesMap} onBeforeModelOpen={onBeforeModelOpen} renderInputCard={renderInputCard} />
          )}
        </div>
      </div>
    </div>
  );
}
