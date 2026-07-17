/**
 * @file AiThinkingMessage.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   展示剧本生成阶段的思考文案和点状加载动画
 *
 * ─── 状态与副作用 ───────────────────────────────────────────────────
 *   idx / phase：循环切换思考文案和进出场动画
 *   ensureScriptDisplayStyles：挂载时注入展示区域动画样式
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 ScriptPage 抽离，保持思考动画行为不变
 */
import { useEffect, useState } from 'react';
import DotsLoading from '../DotsLoading';
import { ensureScriptDisplayStyles } from './ScriptDisplayStyles';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const THINKING_LABELS = ['分析剧情结构', '构建人物关系', '生成剧本内容', '润色台词细节'];

export default function AiThinkingMessage() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('in');

  useEffect(() => {
    ensureScriptDisplayStyles();
  }, []);

  useEffect(() => {
    const outTimer = setTimeout(() => setPhase('out'), 1500);
    const switchTimer = setTimeout(() => {
      setIdx((value) => (value + 1) % THINKING_LABELS.length);
      setPhase('in');
    }, 1800);

    return () => {
      clearTimeout(outTimer);
      clearTimeout(switchTimer);
    };
  }, [idx]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', alignSelf: 'stretch', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '20px' }}>
        <DotsLoading size={5} color="#2DC3E1" gap={5} />
      </div>
      <div style={{ position: 'relative', height: '20px', minWidth: '120px', overflow: 'hidden' }}>
        <span
          key={idx}
          className={phase === 'in' ? 'thinking-label-in' : 'thinking-label-out'}
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            translate: '0 -50%',
            fontFamily: FONT,
            fontSize: '13px',
            lineHeight: '20px',
            color: '#FFFFFF66',
            whiteSpace: 'nowrap',
          }}
        >
          {THINKING_LABELS[idx]}
        </span>
      </div>
    </div>
  );
}
