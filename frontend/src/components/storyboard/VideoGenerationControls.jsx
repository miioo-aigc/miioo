/**
 * @file VideoGenerationControls.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   VideoGenerationTabs  视频生成模式 Tab 展示和切换回调
 *   VideoSoundToggle     音效标签与开关展示
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收当前值和显式回调，不处理模型、参考素材或生成状态
 */
import Toggle from '../Toggle';
import { Tabs } from '../ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export function VideoGenerationTabs({ value, onChange }) {
  const tabs = [
    { value: 'all', label: '全能参考', icon: <AllReferenceIcon /> },
    { value: 'frame', label: '首尾帧', icon: <FrameIcon /> },
  ];
  return <Tabs options={tabs} value={value} onChange={onChange} gap="16px" variant="resplit" />;
}

function FrameIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9.446 1.733C9.888 1.733 10.246 2.092 10.246 2.533V21.855C10.246 22.297 9.888 22.655 9.447 22.655C9.005 22.655 8.646 22.297 8.646 21.855V2.533C8.646 2.092 9.005 1.733 9.447 1.733H9.446Z" fill="#FFFFFF" /><path d="M9.194 3.483V5.083H4.706C4.411 5.083 4.172 5.322 4.172 5.617V18.946C4.172 19.241 4.411 19.479 4.706 19.479H9.194V21.079H4.706C3.527 21.079 2.572 20.124 2.572 18.946V5.617C2.572 4.438 3.527 3.483 4.706 3.483H9.194Z" fill="#FFFFFF" /><path d="M3.814 8.787H9.446V7.187H3.814V8.787ZM3.814 17.402H9.446V15.802H3.814V17.402ZM14.706 1.733C14.264 1.733 13.906 2.092 13.906 2.533V21.855C13.906 22.297 14.264 22.655 14.706 22.655C15.148 22.655 15.506 22.297 15.506 21.855V2.533C15.506 2.092 15.148 1.733 14.706 1.733Z" fill="#FFFFFF" /><path d="M14.957 3.483V5.083H19.446C19.74 5.083 19.979 5.322 19.979 5.617V18.946C19.979 19.241 19.74 19.479 19.446 19.479H14.957V21.079H19.446C20.624 21.079 21.579 20.124 21.579 18.946V5.617C21.579 4.438 20.624 3.483 19.446 3.483H14.957Z" fill="#FFFFFF" /><path d="M20.339 8.787H14.707V7.187H20.339V8.787ZM20.339 17.402H14.707V15.802H20.339V17.402Z" fill="#FFFFFF" /></svg>;
}

function AllReferenceIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12.619 6.667V8V9.333M9.155 12.667L10.309 12L11.464 11.333M6.845 12.667L5.69 12L4.536 11.333M3.381 6.667V8V9.333M4.536 4.667L5.69 4L6.845 3.333M9.155 3.333L10.309 4L11.464 4.667" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><circle cx="8" cy="13.333" r="1.333" fill="none" stroke="#FFFFFF" /><circle cx="8" cy="2.667" r="1.333" fill="none" stroke="#FFFFFF" /><circle cx="12.667" cy="5.333" r="1.333" fill="none" stroke="#FFFFFF" /><circle cx="12.667" cy="10.667" r="1.333" fill="none" stroke="#FFFFFF" /><circle cx="3.333" cy="5.333" r="1.333" fill="none" stroke="#FFFFFF" /><circle cx="3.333" cy="10.667" r="1.333" fill="none" stroke="#FFFFFF" /></svg>;
}

export function VideoSoundToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
      <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT, flexShrink: 0 }}>音效</span>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}
