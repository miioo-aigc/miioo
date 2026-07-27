/**
 * @file StoryboardCreationPanel.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────
 *   弹窗布局           固定 600px 宽，组织 54px header、457px 表单区和 141px 候选区
 *   候选媒体           统一展示图片/视频候选，并提供上传与资产库入口
 *   页签状态           维护图片/视频页签并通知页面记忆最近使用的页签
 *
 * ─── 更新记录 ───────────────────────────────────────────────
 *   2026-07-23         按 Paper 设计稿重写创作弹窗布局和候选区样式
 */

import { useRef, useState } from 'react';
import AssetPickerModal from '../AssetPickerModal';
import { apiUploadCreationImage } from '../../api/creation';
import { apiUploadStoryboardVideo } from '../../api/storyboard';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { ModalCloseBtn } from './StoryboardControls';
import FileUploadButton from '../ui/FileUploadButton';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function CandidateItem({ item }) {
  const isVideo = item.media_type === 'video' || item.type?.startsWith('video');
  const source = normalizeImageUrl(item.thumbnail_url || item.poster_url || item.url);
  return (
    <div style={{ width: '100px', height: '100px', position: 'relative', overflow: 'hidden', flexShrink: 0, borderRadius: '6px', border: `1px solid ${item.is_finalized ? '#2DC3E1' : 'rgba(255,255,255,0.12)'}`, background: '#1D1E1E' }}>
      {isVideo ? <video src={normalizeImageUrl(item.url)} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={source} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      <span style={{ position: 'absolute', left: '4px', bottom: '4px', padding: '1px 4px', borderRadius: '2px', background: '#00000099', color: '#FFFFFFCC', fontFamily: FONT, fontSize: '10px', lineHeight: '14px' }}>{isVideo ? '视频' : '图片'}</span>
      {item.is_finalized && <span style={{ position: 'absolute', right: '4px', top: '4px', padding: '1px 4px', borderRadius: '2px', background: '#2DC3E1', color: '#090909', fontFamily: FONT, fontSize: '10px', lineHeight: '14px' }}>定稿</span>}
    </div>
  );
}

function UploadEntry({ type, onUpload, onOpenAssets }) {
  const inputRef = useRef(null);
  return (
    <div style={{ width: '100px', height: '100px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.08)', background: '#1D1E1E' }}>
      <input ref={inputRef} type="file" accept={type === 'video' ? 'video/*' : 'image/*'} style={{ display: 'none' }} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = ''; }} />
      <FileUploadButton onClick={() => inputRef.current?.click()}>本地上传</FileUploadButton>
      <FileUploadButton onClick={onOpenAssets}>从资产库选择</FileUploadButton>
    </div>
  );
}

export default function StoryboardCreationPanel({ initialTab = 'image', onTabChange, onClose, candidates = [], projectId, storyboardId, onCandidateMedia, children }) {
  const [tab, setTab] = useState(initialTab);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [uploadType, setUploadType] = useState(initialTab === 'video' ? 'video' : 'image');
  const changeTab = (next) => { setTab(next); setUploadType(next); onTabChange?.(next); };

  async function handleUpload(file) {
    try {
      const isVideo = uploadType === 'video';
      const result = isVideo
        ? await apiUploadStoryboardVideo(projectId, storyboardId, file)
        : await apiUploadCreationImage({ file, category: 'storyboard', project_id: projectId });
      const url = normalizeImageUrl(result?.uploaded_url || result?.uploadedUrl || result?.video_url || result?.videoUrl || result?.url || result?.file_url || '');
      if (url) onCandidateMedia?.({ id: result?.id || result?.asset_id || url, url, media_type: isVideo ? 'video' : 'image', source: 'local-upload' });
    } catch {
      // 具体错误由页面统一提示；上传入口不能阻塞弹窗布局。
    }
  }

  function handleAssets(assets) {
    (assets || []).forEach((asset) => {
      const url = normalizeImageUrl(asset.fileUrl || asset.originalUrl || asset.original_url || asset.thumbnailUrl || asset.thumbnail_url || asset.url || asset.file_url);
      if (url) onCandidateMedia?.({ id: asset.id || url, asset_id: asset.asset_id || asset.assetId || asset.id || null, url, media_type: uploadType, source: 'asset-library' });
    });
    setAssetPickerOpen(false);
  }

  return (
    <div style={{ position: 'fixed', right: '24px', top: '60px', bottom: '24px', width: '600px', height: 'auto', maxHeight: 'calc(100vh - 84px)', zIndex: 901, display: 'flex', flexDirection: 'column', background: '#161616', borderRadius: '16px', border: '1px solid #FFFFFF14', boxShadow: '-10px 24px 64px #00000099', overflow: 'hidden' }}>
      <header style={{ height: '54px', flexShrink: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 24px', background: '#161616', borderBottom: '1px solid #FFFFFF14', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', height: '100%' }}>
          {['video', 'image'].map((value) => <button key={value} type="button" onClick={() => changeTab(value)} style={{ height: '40px', padding: '10px', border: 0, borderBottom: `2px solid ${tab === value ? '#2DC3E1' : 'transparent'}`, background: 'transparent', color: tab === value ? '#2DC3E1' : '#FFFFFF99', fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '20px', cursor: 'pointer' }}>{value === 'video' ? '创作视频' : '创作图片'}</button>)}
        </div>
        <div style={{ paddingBottom: '18px' }}><ModalCloseBtn onClick={onClose} /></div>
      </header>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        <section style={{ width: '457px', minWidth: 0, minHeight: 0, overflow: 'hidden', background: '#161616' }}>{children}</section>
        <aside style={{ width: '141px', flex: '0 0 141px', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px 24px 8px 16px', boxSizing: 'border-box', overflowY: 'auto', background: '#161616', borderLeft: '1px solid #FFFFFF14' }}>
          <div style={{ flexShrink: 0, color: '#FFFFFF99', fontFamily: FONT, fontSize: '14px', lineHeight: '18px' }}>分镜候选</div>
          <UploadEntry type={uploadType} onUpload={handleUpload} onOpenAssets={() => setAssetPickerOpen(true)} />
          {candidates.map((item, index) => <CandidateItem key={item.id || item.url || index} item={item} />)}
        </aside>
        <AssetPickerModal accept={uploadType} open={assetPickerOpen} onClose={() => setAssetPickerOpen(false)} projectId={projectId} onConfirm={handleAssets} />
      </div>
      <footer aria-hidden="true" style={{ position: 'absolute', left: 0, bottom: 0, width: '457px', height: '68px', pointerEvents: 'none', boxSizing: 'border-box' }} />
    </div>
  );
}
