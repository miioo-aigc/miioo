import { Eye, EyeOff, Volume2, VolumeX } from 'lucide-react';
import { IconButton, Tooltip } from '../ui';
import trackSnapIcon from '../../assets/TrackSnap.svg';

export default function TrackControls({ track, settings, onChange, showToast }) {
  const safeSettings = settings || { hidden: false, volume: 1, excludeGaps: false };
  const name = track.startsWith('S') ? '字幕' : track.startsWith('A') ? '音频' : '视频';
  const actions = [
    { label: `${safeSettings.hidden ? '显示' : '隐藏'}${name}轨道`, active: safeSettings.hidden, icon: safeSettings.hidden ? <EyeOff size={16} /> : <Eye size={16} />, patch: { hidden: !safeSettings.hidden }, message: safeSettings.hidden ? '取消轨道隐藏' : '轨道已隐藏' },
    { label: `${safeSettings.volume > 0 ? '静音' : '取消静音'}${name}轨道`, active: safeSettings.volume <= 0, icon: safeSettings.volume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} />, patch: { volume: safeSettings.volume > 0 ? 0 : 1 }, message: safeSettings.volume > 0 ? '轨道已静音' : '已取消轨道静音' },
    { label: '轨道吸附', active: safeSettings.excludeGaps, icon: <span className="block h-[16px] w-[16px]" style={{ backgroundColor: 'currentColor', mask: `url("${trackSnapIcon}") center / contain no-repeat`, WebkitMask: `url("${trackSnapIcon}") center / contain no-repeat` }} />, patch: { excludeGaps: !safeSettings.excludeGaps }, message: safeSettings.excludeGaps ? '轨道吸附已关闭' : '轨道吸附已开启' },
  ];
  return (
    <span className="flex items-center gap-[4px]">
      {actions.filter((action) => !track.startsWith('S') || !Object.hasOwn(action.patch, 'volume')).map(({ label, active, icon, patch, message }) => (
        <Tooltip key={label} label={label} delay={250}>
          <IconButton aria-label={label} aria-pressed={Boolean(active)} className="hover:bg-white-10" variant="link" size="small"
            onClick={() => { onChange(track, patch); showToast?.(message, 'success'); }}
            icon={<span aria-hidden="true" className={active ? 'text-brand-main' : 'text-white-60'}>{icon}</span>}
            style={{ width: 24, height: 24, padding: 0, border: 'none', borderRadius: 'var(--radius-small)', boxShadow: 'none' }} />
        </Tooltip>
      ))}
    </span>
  );
}
