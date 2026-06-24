import { memo } from 'react';
import { FONT } from '../utils/fonts';

const MENTION_TYPE_COLOR = { character: '#E2E24B', scene: '#71C4FF', prop: '#C084FC' };

function SubjectTag({ name, type }) {
  const color = MENTION_TYPE_COLOR[type] ?? '#E2E24B';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', paddingInline: '5px', borderRadius: '4px', fontSize: '14px', lineHeight: '18px', backgroundColor: `${color}26`, color, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)', fontFamily: FONT, flexShrink: 0 }}>
      {name}
    </span>
  );
}
export default memo(SubjectTag);
