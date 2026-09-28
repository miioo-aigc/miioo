/** 创作与画布共用的素材来源菜单；文件处理与资产选择由调用方负责。 */
import { useEffect, useRef, useState } from 'react';

export function UploadMenuItem({ label, icon, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px', width: '100%', height: '32px',
        paddingLeft: '10px', paddingRight: '10px', borderRadius: '6px', cursor: 'pointer',
        border: 'none', textAlign: 'left', fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif", fontSize: '12px', lineHeight: '16px',
        color: '#FFFFFFCC', background: hovered ? '#FFFFFF0A' : 'transparent', transition: 'background 0.15s',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export default function CreationUploadMenu({ onAssetPick, onLocalUpload, onClose }) {
  const menuRef = useRef(null);
  useEffect(() => {
    const handlePointer = (event) => {
      if (!menuRef.current?.parentElement?.contains(event.target)) onClose?.();
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose?.(); }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div ref={menuRef} style={{ position: 'absolute', zIndex: 50, left: 0, bottom: 'calc(100% + 8px)', borderRadius: '8px', background: '#1D1E1E', border: '1px solid #FFFFFF0D', boxShadow: '0px 4px 16px #00000066', padding: '4px', minWidth: '140px', display: 'flex', flexDirection: 'column' }}>
      <UploadMenuItem
        label="从资产库选择"
        icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}><path d="M1.66663 2.66667C1.66663 2.29848 1.9651 2 2.33329 2H6.33329L7.99996 4H13.6666C14.0348 4 14.3333 4.29847 14.3333 4.66667V13.3333C14.3333 13.7015 14.0348 14 13.6666 14H2.33329C1.9651 14 1.66663 13.7015 1.66663 13.3333V2.66667Z" stroke="#FFFFFFCC" strokeLinejoin="round" /><path d="M8.00003 6.66663L8.7477 8.30423L10.5362 8.50926L9.20977 9.72636L9.56747 11.4907L8.00003 10.6053L6.4326 11.4907L6.7903 9.72636L5.46387 8.50926L7.25237 8.30423L8.00003 6.66663Z" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        onClick={() => { onClose?.(); onAssetPick?.(); }}
      />
      <UploadMenuItem
        label="从本地上传"
        icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}><path d="M8 10.667V3.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /><path d="M5.333 6L8 3.333L10.667 6" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /><path d="M2.667 12H13.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        onClick={() => { onClose?.(); onLocalUpload?.(); }}
      />
    </div>
  );
}
