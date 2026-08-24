/**
 * @file SubjectCertificationBanner.jsx
 * @structure-index
 *
 * ─── 组件职责 ─────────────────────────────────────────────────────
 *   角色 Tab 图片列表上方的真人素材认证提示，可由用户手动关闭。
 *
 * ─── 依赖边界 ─────────────────────────────────────────────────────
 *   只负责提示文案、关闭按钮视觉和关闭回调，不读取本地缓存或页面状态。
 */
const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4.667 4.667L11.333 11.333" stroke="var(--color-white-80)" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.667 11.333L11.333 4.667" stroke="var(--color-white-80)" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SubjectCertificationBanner({ onClose }) {
  return (
    <div
      className="[font-synthesis:none] flex items-start gap-[4px] py-[8px] justify-center self-stretch rounded-[6px] px-[16px] antialiased"
      style={{ backgroundColor: 'var(--color-tag-bg-blue)' }}
    >
      <div
        className="flex-1 text-center flex justify-center flex-wrap"
        style={{ color: 'var(--color-tag-text-blue)', fontFamily: FONT, fontSize: '14px', lineHeight: '18px' }}
      >
        如果角色资产使用了真人人像作为参考，请点击右上角【seedance真人素材认证】按钮进行认证，否则可能无法使用Seedance系列模型创作视频。
      </div>
      <button
        type="button"
        aria-label="关闭真人素材认证提示"
        onClick={onClose}
        className="flex items-center justify-center shrink-0 rounded-full border-0 p-0"
        style={{ width: '16px', height: '16px', backgroundColor: 'var(--color-white-10)', cursor: 'pointer' }}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
