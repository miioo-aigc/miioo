import { useState, useRef, useEffect, memo } from 'react';
import { FONT } from '../utils/fonts';
import ModalSelectItem from './ModalSelectItem';

const PARAM_OPTIONS = {
  framing: ['全景', '中景', '近景', '特写'],
  cameraMotion: ['固定机位', '跟拍镜头', '环绕镜头', '缓推镜头', '缓拉镜头', '左摇镜头', '右摇镜头', '左移镜头', '右移镜头', '上升镜头', '下降镜头'],
  angle: ['平视拍摄', '仰视拍摄', '俯视拍摄', '左侧45度拍摄', '右侧45度拍摄', '正面视角拍摄', '背面视角拍摄', '侧面视角拍摄', '过肩镜头拍摄', '主观镜头拍摄'],
  composition: ['三分法构图', '中心构图', '前景构图', '对角线构图', '对称构图', '框架构图', '三角形构图', '留白构图', '引导线构图'],
  ratio:    ['16:9', '9:16', '1:1', '4:3', '3:4'],
  duration: ['3s', '5s', '8s', '10s', '15s'],
  size:     ['1080p', '720p', '480p'],
};
const PARAM_LABELS = { framing: '景别', cameraMotion: '运镜', angle: '拍摄角度', composition: '构图', ratio: '比例', size: '大小', duration: '时长' };

function ParamSelect({ field, value, onChange, onClose, triggerRef }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, visibility: 'hidden' });
  useEffect(() => {
    if (triggerRef?.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left, visibility: 'visible' });
    }
  }, [triggerRef]);
  useEffect(() => {
    if (!onClose) return;
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  const opts = PARAM_OPTIONS[field] || [];
  return (
    <div ref={ref} style={{ position: 'fixed', top: pos.top, left: pos.left, visibility: pos.visibility, zIndex: 100, backgroundColor: '#1D1E1E', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '8px', padding: '4px', boxShadow: '0 4px 16px rgba(0,0,0,0.40)' }}>
      <div style={{ padding: '4px 8px', fontSize: '11px', lineHeight: '14px', color: 'rgba(255,255,255,0.40)', fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{PARAM_LABELS[field] || field}</div>
      {opts.map((opt) => (
        <ModalSelectItem key={opt} label={opt} active={opt === value} onSelect={() => { onChange?.(opt); onClose?.(); }} />
      ))}
    </div>
  );
}
export default memo(ParamSelect);
