import { useRef, useState } from 'react';
import wechatQR from '../../assets/wechat.jpg';
import bizQrCodeImg from '../../assets/biz-qr-code.png';

function MenuPopupItem({ label, onClick, showExternalIcon = false }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      className="flex items-center w-full rounded-[6px] border-0 bg-transparent text-left cursor-pointer"
      style={{
        padding: '8px 12px',
        gap: '4px',
        justifyContent: showExternalIcon ? 'space-between' : 'flex-start',
        backgroundColor: pressed ? '#FFFFFF14' : hovered ? '#FFFFFF0D' : 'transparent',
        transition: 'background-color 120ms ease, color 120ms ease',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      <div
        className="w-fit shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif]"
        style={{ fontSize: '14px', lineHeight: '18px', color: pressed || hovered ? '#FFFFFF' : '#FFFFFFCC' }}
      >
        {label}
      </div>
      {showExternalIcon && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <path d="M4.5 11.5L11.5 4.5" stroke="#FFFFFF80" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 4.5H11.5V9" stroke="#FFFFFF80" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

const COMMUNITY_QR_CODE_URL = wechatQR;
const BIZ_QR_CODE_URL = bizQrCodeImg;

const CREATION_MANUAL_URL = 'https://gcn0je6sgrhe.feishu.cn/wiki/QaKLwOx0ii2qWakn4cXcybbMnrf?from=from_copylink';

function QRCodePopup({ anchorLeft }) {
  return (
    <div className="qr-popup" style={{ left: anchorLeft ?? 40, bottom: 24, translate: '0 -50%' }} role="dialog" aria-label="官方社群二维码">
      <div className="qr-popup-code" style={{ backgroundImage: `url(${COMMUNITY_QR_CODE_URL})` }} />
      <div className="qr-popup-caption font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif]">
        扫码加入用户交流群
      </div>
    </div>
  );
}

function MoreOptionsMenu({ close, setWatermarkSettingsOpen }) {
  const [bizQrVisible, setBizQrVisible] = useState(false);
  const [bizQrLeft, setBizQrLeft] = useState(0);
  const bizItemRef = useRef(null);
  const containerRef = useRef(null);

  const handleMenuClick = (label) => {
    if (label === '创作手册') {
      window.open(CREATION_MANUAL_URL, '_blank');
    } else if (label === '更新日志') {
      // 链接待补充
    } else if (label === '开源社区') {
      window.open('https://github.com/miioo-aigc/miioo', '_blank');
    } else if (label === '用户协议') {
      window.open('https://gcn0je6sgrhe.feishu.cn/wiki/FIspwGURtikxiwk28svc4thOn9c?from=from_copylink', '_blank');
    } else if (label === '隐私政策') {
      window.open('https://gcn0je6sgrhe.feishu.cn/wiki/LKlewdQJ0iaYVmkOPXVc4PWgnoc?from=from_copylink', '_blank');
    } else if (label === '商务合作') {
      const nextVisible = !bizQrVisible;
      if (nextVisible && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        setBizQrLeft(containerRect.right + 4);
      }
      setBizQrVisible(nextVisible);
    } else if (label === 'AI生成水印设置') {
      close();
      setWatermarkSettingsOpen(true);
    }
  };

  const FONT = "'AlibabaPuHuiTi_2_55_Regular', 'Alibaba PuHuiTi 2.0', system-ui, sans-serif";

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: '40px',
        bottom: '0',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        width: '178px',
        borderRadius: '8px',
        boxShadow: '#00000066 0px 4px 16px',
        backgroundColor: '#161616',
        border: '1px solid #FFFFFF0D',
        padding: '4px',
      }}
    >
      {/* 外链类：创作手册、更新日志、开源社区 */}
      {['创作手册', '更新日志', '开源社区'].map((label) => (
        <MenuPopupItem key={label} label={label} showExternalIcon onClick={() => handleMenuClick(label)} />
      ))}

      {/* 内页类：用户协议、隐私政策、商务合作 */}
      {['用户协议', '隐私政策'].map((label) => (
        <MenuPopupItem key={label} label={label} onClick={() => handleMenuClick(label)} />
      ))}
      <div ref={bizItemRef} style={{ width: '100%' }}>
        <MenuPopupItem label="商务合作" onClick={() => handleMenuClick('商务合作')} />
      </div>

      {/* AI生成水印设置 */}
      <MenuPopupItem label="AI生成水印设置" onClick={() => handleMenuClick('AI生成水印设置')} />

      {/* 备案信息 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '4px',
          padding: '8px 12px',
          borderRadius: '6px',
        }}
      >
        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', color: '#FFFFFF80' }}>
          ©2026 Miioo AI
        </span>
        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', color: '#FFFFFF80' }}>
          济南三脚猫科技有限公司
        </span>
        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', color: '#FFFFFF80' }}>
          鲁ICP备2026030778号
        </span>
      </div>

      {/* 商务合作二维码浮层 */}
      {bizQrVisible && (
        <div
          style={{
            position: 'fixed',
            left: bizQrLeft,
            bottom: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '9px',
            borderRadius: '8px',
            boxShadow: '#00000066 0px 4px 16px',
            backgroundColor: '#161616',
            border: '1px solid #FFFFFF14',
            padding: '16px',
            zIndex: 60,
          }}
        >
          <div
            style={{
              width: '120px',
              height: '120px',
              backgroundImage: `url(${BIZ_QR_CODE_URL})`,
              backgroundSize: 'cover',
              backgroundPosition: '50%',
              flexShrink: 0,
            }}
          />
          <div style={{ fontFamily: FONT, color: '#FFFFFFCC', fontSize: '12px', lineHeight: '16px' }}>
            扫码添加客服
          </div>
        </div>
      )}
    </div>
  );
}

export { QRCodePopup, MoreOptionsMenu };
