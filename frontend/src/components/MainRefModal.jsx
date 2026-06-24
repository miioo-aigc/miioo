import { useState } from 'react';
import AssetPickerModal from './AssetPickerModal';
import { IconClose } from './StoryboardIcons';

export default function MainRefModal({ shot, onChange, onClose, projectId }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  function handleAssetConfirm(assets) {
    const newRefs = assets.map(a => ({ id: a.id, assetId: a.id, url: (a.fileUrl || a.url) ?? null, name: a.name, type: a.type ?? 'image' }));
    onChange({ ...shot, mainRefs: [...shot.mainRefs, ...newRefs] });
  }

  function handleDelete(idx) {
    onChange({ ...shot, mainRefs: shot.mainRefs.filter((_, i) => i !== idx) });
  }

  return (
    <>
      <AssetPickerModal
        accept="image"
        projectId={projectId}
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        preSelectedIds={shot.mainRefs.map(r => r.assetId).filter(Boolean)}
        preSelectedUrls={shot.mainRefs.map(r => r.url).filter(Boolean)}
        preSelectedSubjectIds={shot.mainRefs.map(r => r.id).filter(Boolean)}
        onConfirm={handleAssetConfirm}
      />
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          backgroundColor: 'rgba(0,0,0,0.50)',
          backdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onClick={onClose}
      >
        <div
          style={{
            width: '800px',
            maxHeight: '600px',
            backgroundColor: '#161616',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px' }}>
            <span style={{ fontSize: '16px', fontWeight: 500, color: '#FFFFFF', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif' }}>
              主体参考
            </span>
            <div onClick={onClose} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
              <IconClose />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
            {shot.mainRefs.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'rgba(255,255,255,0.30)', fontSize: '14px', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif' }}>
                暂无图片
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {shot.mainRefs.map((img, idx) => (
                  <div
                    key={img.id}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    style={{
                      width: '160px',
                      height: '120px',
                      borderRadius: '8px',
                      position: 'relative',
                      overflow: 'hidden',
                      border: hoveredIdx === idx ? '1px solid #2DC3E1' : '1px solid rgba(255,255,255,0.06)',
                      transition: 'border-color 150ms',
                    }}
                  >
                    <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {hoveredIdx === idx && (
                      <div
                        onClick={() => handleDelete(idx)}
                        style={{
                          position: 'absolute', top: '6px', right: '6px',
                          width: '24px', height: '24px',
                          backgroundColor: 'rgba(0,0,0,0.70)',
                          borderRadius: '4px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <IconClose />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 24px 20px' }}>
            <div
              onClick={() => setAssetPickerOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                height: '36px',
                paddingInline: '16px',
                gap: '4px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.12)',
                backgroundColor: 'rgba(255,255,255,0.04)',
                cursor: 'pointer',
                fontSize: '14px',
                color: 'rgba(255,255,255,0.60)',
                fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
              }}
            >
              从资产库添加
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
