import { useState } from "react";
import { FONT, FONT_MEDIUM } from "../../utils/fonts";
import GhostBtn from "../../components/GhostBtn";
import MoreMenu from "./MoreMenu";
 import PrimaryButton from './PrimaryButton';

export default 
function Toolbar({ projectName, onBack, onAddChar, onBatchGen, onStartStoryboard, addLabel = '添加角色', tabLabel = '角色' }) {
  const [arrowHovered, setArrowHovered] = useState(false);
  return (
    <div className="flex items-center justify-between self-stretch shrink-0">
      {/* breadcrumb */}
      <div className="flex items-center gap-[6px]">
        <svg
          width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0, cursor: 'pointer', opacity: arrowHovered ? 1 : 0.7, transition: 'opacity 0.15s' }}
          onMouseEnter={() => setArrowHovered(true)}
          onMouseLeave={() => setArrowHovered(false)}
          onClick={onBack}
        >
          <path d="M15 5L9 12L15 19" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '22px', color: '#FFFFFF', fontWeight: 500 }}>
          {projectName}
        </span>
      </div>

      {/* actions */}
      <div className="flex items-center gap-[8px]">
       <GhostBtn onClick={onAddChar} icon={
         <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
           <path d="M8 3v10M3 8h10" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
         </svg>
        }>
        {addLabel}
       </GhostBtn>
       <GhostBtn fontSize={13} onClick={onBatchGen} icon={
         <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
           <rect x="2" y="3" width="4" height="5" rx="1" stroke="#FFFFFF" strokeWidth="1.2" />
           <rect x="8" y="3" width="4" height="5" rx="1" stroke="#FFFFFF" strokeWidth="1.2" />
           <path d="M2 10.5H12" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
         </svg>
        }>
        批量生成{tabLabel}
       </GhostBtn>
        <PrimaryButton
          label="开始智能分镜"
          onClick={onStartStoryboard}
          disabled={false}
          loading={false}
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M5.333 2H2.667C2.298 2 2 2.298 2 2.667V5.333" stroke="#090909" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.333 14H2.667C2.298 14 2 13.701 2 13.333V10.667" stroke="#090909" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10.667 14H13.333C13.701 14 14 13.701 14 13.333V10.667" stroke="#090909" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10.667 2H13.333C13.701 2 14 2.298 14 2.667V5.333" stroke="#090909" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M11.333 8C11.333 6.159 9.841 4.667 8 4.667C6.159 4.667 4.667 6.159 4.667 8C4.667 9.841 6.159 11.333 8 11.333C9.841 11.333 11.333 9.841 11.333 8Z" stroke="#090909" strokeWidth="1.3" />
              <path d="M8 9C7.448 9 7 8.552 7 8C7 7.448 7.448 7 8 7C8.552 7 9 7.448 9 8C9 8.552 8.552 9 8 9Z" fill="#090909" />
            </svg>
          }
        />
      </div>
    </div>
  );
}
