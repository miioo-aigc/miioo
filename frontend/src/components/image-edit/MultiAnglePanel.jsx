import { ANGLE_PRESETS } from '../../utils/MultiAngle';

export default function MultiAnglePanel({ angles, onChange, disabled }) {
  return <div className="angle-panel">
    <fieldset disabled={disabled}><legend>摄像机方位</legend><div className="angle-presets">
      {ANGLE_PRESETS.map(([label, horizontal, vertical], index) => <button key={label} type="button" className="angle-preset" aria-pressed={angles.horizontal % 360 === horizontal && angles.vertical === vertical} onClick={() => onChange({ horizontal, vertical })}>
        <span className="angle-preset-icon"><i style={{ left: 1.5 + index % 3 * 5, top: 1.5 + Math.floor(index / 3) * 5 }} /></span>{label}
      </button>)}
    </div></fieldset>
    {[["horizontal", '水平角度', 0, 360], ['vertical', '垂直角度', -30, 60]].map(([key, label, min, max]) => <div key={key} className="angle-slider">
      <label htmlFor={`angle-${key}`}>{label}</label><div className="angle-slider-row">
        <input id={`angle-${key}`} type="range" min={min} max={max} step="0.1" value={angles[key]} disabled={disabled} onChange={(event) => onChange({ ...angles, [key]: Number(event.target.value) })} style={{ background: `linear-gradient(to right,#2dc3e1 ${(angles[key] - min) / (max - min) * 100}%,#ffffff1a 0)` }} />
        <output htmlFor={`angle-${key}`}>{Number(angles[key].toFixed(1))}°</output>
      </div>
    </div>)}
  </div>;
}
