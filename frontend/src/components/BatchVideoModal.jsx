import { useState, memo } from 'react';
import ModalOverlay from './ModalOverlay';
import ModalCloseBtn from './ModalCloseBtn';
import GhostBtn from './GhostBtn';
import PrimaryBtn from './PrimaryBtn';
import ModalGhostBtn from './ModalGhostBtn';

function BatchVideoModal({ shotCount, onClose, onConfirm }) {
  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ width: '480px', borderRadius: '16px', backgroundColor: '#1D1E1E', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '18px', lineHeight: '24px', color: '#FFFFFF', fontFamily: "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif", fontWeight: 500 }}>批量生视频</span>
          <ModalCloseBtn onClick={onClose} />
        </div>
        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif" }}>本次将给 {shotCount || 'N'} 个镜头各生成 1 段视频。确定要继续吗？</span>
        </div>
        <div style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <ModalGhostBtn onClick={onClose}>取消</ModalGhostBtn>
          <PrimaryBtn onClick={() => onConfirm?.()}>开始生成</PrimaryBtn>
        </div>
      </div>
    </ModalOverlay>
  );
}
export default memo(BatchVideoModal);
