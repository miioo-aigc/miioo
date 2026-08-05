/**
 * @file PanelPromptPrimitives.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   提示词展示标签和字符计数
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收展示数据，不调用 API、不读取 Store、不处理编辑器状态
 */
import { MENTION_TYPE_COLOR } from './PanelPromptConstants';

function truncateMentionName(name, maxLength = 10) {
  const text = String(name ?? '');
  return Array.from(text).length > maxLength
    ? `${Array.from(text).slice(0, maxLength).join('')}…`
    : text;
}

export function SubjectTag({ name, type }) {
  const color = MENTION_TYPE_COLOR[type] ?? '#E2E24B';
  return (
    <span title={`@${name}`} style={{ display: 'inline-flex', alignItems: 'center', paddingInline: '4px', borderRadius: '4px', fontSize: '14px', lineHeight: '21px', backgroundColor: `${color}26`, color, boxShadow: `inset 0 0 0 1px ${color}33`, fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif', flexShrink: 0, verticalAlign: 'middle' }}>
      @{truncateMentionName(name)}
    </span>
  );
}

export function PromptCharacterCount({ value = '', maxLength }) {
  return <div style={{ alignSelf: 'stretch', textAlign: 'right', fontSize: '12px', lineHeight: '18px', color: 'rgba(255,255,255,0.40)', fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif", flexShrink: 0 }}>{value.length}/{maxLength}</div>;
}
