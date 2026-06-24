import { FONT, FONT_MEDIUM } from '../../../utils/fonts';
import EpisodeSelector from '../../../components/EpisodeSelector';
import GhostBtn from '../../../components/GhostBtn';
import PrimaryBtn from '../../../components/PrimaryBtn';
import SecondaryBtn from '../../../components/SecondaryBtn';
import { IconDownload, IconBatchImage, IconBatchVideo, IconEdit } from '../../../components/StoryboardIcons';
import GeneratingProgressBar from './GeneratingProgressBar';

export default function StoryboardToolbar({
  projectName,
  activeEpisodes,
  episode,
  setEpisode,
  homeIsGenerating,
  shotsLength,
  completedEpisodesCount,
  totalEpisodes,
  batchBtnRef,
  downloadMode,
  selectedShotIds,
  toggleSelectAll,
  handleDownloadImages,
  handleDownloadVideos,
  exitDownloadMode,
  batchExpanded,
  setBatchExpanded,
  setShowImageModal,
  setShowVideoModal,
  generatingImages,
  generatingVideos,
  enterDownloadMode,
  handleStartEdit,
}) {
  return (
    <>
      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)', fontFamily: FONT }}>
            {projectName}
          </span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <path d="M5.5 3.5L9 7L5.5 10.5" stroke="#FFFFFF40" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <EpisodeSelector episodes={activeEpisodes} value={episode} onChange={setEpisode} />
        </div>
        {/* 后台分镜生成中提示：有数据时不全屏 loading，改用居中 inline 状态条 */}
        {homeIsGenerating && shotsLength > 0 && (
          <GeneratingProgressBar completedEpisodesCount={completedEpisodesCount} totalEpisodes={totalEpisodes} />
        )}
        <div ref={batchBtnRef} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {downloadMode ? (
            <>
              {/* 已选数量 / 总数 */}
              <span style={{
                fontFamily: FONT,
                fontSize: '14px',
                lineHeight: '18px',
                color: 'rgba(255,255,255,0.45)',
                whiteSpace: 'nowrap',
                userSelect: 'none',
              }}>
                已选 {selectedShotIds.size} / {shotsLength}
              </span>

              {/* 全选 / 取消全选 — checkbox + 文字 */}
              <label
                onClick={toggleSelectAll}
                className="flex items-center gap-[4px] h-[36px] px-[16px] cursor-pointer select-none shrink-0"
              >
                {/* checkbox — 按组件规范，p-[2px] 外层 + token 类名 + border-solid + outline */}
                <div className="flex items-center gap-0 p-[2px] cursor-pointer">
                  <div className={
                    "relative rounded-sm shrink-0 border border-solid w-[16px] h-[16px] [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0 " +
                    (selectedShotIds.size === shotsLength
                      ? "bg-checkbox-bg-active border-checkbox-border-active"
                      : "bg-checkbox-bg-normal border-checkbox-border-normal")
                  }>
                    {selectedShotIds.size === shotsLength && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ position: "absolute", left: "50%", top: "50%", translate: "-50% -50%" }}>
                        <path d="M3.333 8L6.667 11.333L13.333 4.667"
                          stroke="#FFFFFF"
                          strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                {/* 文字 */}
                <span style={{
                  fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
                  fontSize: '14px',
                  lineHeight: '18px',
                  color: '#FFFFFF',
                  whiteSpace: 'nowrap',
                }}>
                  {selectedShotIds.size === shotsLength ? '取消全选' : '全选'}
                </span>
              </label>

              {/* 下载图片 */}
              <GhostBtn icon={<IconDownload />} onClick={handleDownloadImages}>
                下载图片
              </GhostBtn>

              {/* 下载视频 */}
              <GhostBtn icon={<IconDownload />} onClick={handleDownloadVideos}>
                下载视频
              </GhostBtn>

              {/* 取消 — Secondary 按钮 */}
              <SecondaryBtn onClick={exitDownloadMode}>
                取消
              </SecondaryBtn>
            </>
          ) : (
            <>
              {batchExpanded ? (
                <>
                  <GhostBtn icon={<IconBatchImage />} onClick={() => { setBatchExpanded(false); setShowImageModal(true); }} loading={generatingImages || generatingVideos} disabled={generatingImages || generatingVideos}>批量生成分镜图</GhostBtn>
                  <GhostBtn icon={<IconBatchVideo />} onClick={() => { setBatchExpanded(false); setShowVideoModal(true); }} loading={generatingImages || generatingVideos} disabled={generatingImages || generatingVideos}>批量生成分镜视频</GhostBtn>
                </>
              ) : (
                <GhostBtn icon={<IconBatchImage />} onClick={() => setBatchExpanded(true)} loading={generatingImages || generatingVideos} disabled={generatingImages || generatingVideos}>批量生成</GhostBtn>
              )}
              <GhostBtn icon={<IconDownload />} onClick={enterDownloadMode} disabled={generatingImages || generatingVideos}>批量下载</GhostBtn>
              <PrimaryBtn icon={<IconEdit />} onClick={handleStartEdit}>开始剪辑</PrimaryBtn>
            </>
          )}
        </div>
      </div>

      {/* 分镜标题 + 镜头数 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <span style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF', fontWeight: 500 }}>
          分镜
        </span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '18px', height: '16px', borderRadius: '999px', padding: '0 5px', backgroundColor: 'rgba(255,255,255,0.10)' }}>
          <span style={{ fontSize: '12px', lineHeight: '100%', color: 'rgba(255,255,255,0.80)', fontFamily: 'AlibabaPuHuiTi_2_55_Regular, "Alibaba PuHuiTi 2.0", system-ui, sans-serif' }}>{shotsLength}</span>
        </div>
      </div>
    </>
  );
}
