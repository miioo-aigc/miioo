import { useState, memo } from 'react';
import ModalOverlay from './ModalOverlay';
import ModalCloseBtn from './ModalCloseBtn';
import GhostBtn from './GhostBtn';
import PrimaryBtn from './PrimaryBtn';
import ModalSelect from './ModalSelect';
import ModalGhostBtn from './ModalGhostBtn';

function BatchImageModal({ shotCount, onClose, onConfirm }) {
  const [imageCount, setImageCount] = useState('1');
  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ width: '480px', borderRadius: '16px', backgroundColor: '#1D1E1E', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '18px', lineHeight: '24px', color: '#FFFFFF', fontFamily: "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif", fontWeight: 500 }}>批量生图</span>
          <ModalCloseBtn onClick={onClose} />
        </div>
        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', flexShrink: 0, fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif" }}>本次将给 {shotCount || 'N'} 个镜头各生成</span>
            <input value={imageCount} onChange={(e) => setImageCount(e.target.value.replace(/\D/g, ''))}
              style={{ width: '48px', height: '36px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#161616', color: '#FFFFFF', textAlign: 'center', fontSize: '14px', fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif", outline: 'none' }} />
            <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif" }}>张图片</span>
          </div>
          <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.40)', fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif" }}>共 {shotCount || 0} 个镜头，总计 {Number(imageCount || 0) * (shotCount || 0)} 张</span>
        </div>
        <div style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <ModalGhostBtn onClick={onClose}>取消</ModalGhostBtn>
          <PrimaryBtn onClick={() => onConfirm?.(Math.max(1, Number(imageCount) || 1))}>开始生成</PrimaryBtn>
        </div>
      </div>
    </ModalOverlay>
  );
}
export default memo(BatchImageModal);
