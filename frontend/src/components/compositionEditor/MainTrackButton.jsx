import { TextButton, Tooltip } from '../ui';

export default function MainTrackButton({ track, active, onChange }) {
  return <Tooltip label={active ? '取消主轨道' : '设置为主轨道'} delay={250}>
    <TextButton variant="link" size="small" aria-label={`${track} ${active ? '取消主轨道' : '设置为主轨道'}`} aria-pressed={active}
      onClick={() => onChange(track)} className="hover:bg-white-10"
      style={{ width: 28, height: 24, padding: 0, border: 'none', borderRadius: 'var(--radius-small)', boxShadow: 'none' }}>
      <span className={active ? 'text-brand-main' : 'text-white-60'}>{track}</span>
    </TextButton>
  </Tooltip>;
}
