import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

const SPEED_OPTIONS = [0.5,0.6,0.7,0.8,0.9,1.0,1.1,1.2,1.3,1.4,1.5,1.6,1.7,1.8,1.9,2.0];

function VoiceDubModal({ open, onClose, chars = [], initialData = {}, onSaveGlobal, onSaveCurrent }) {
  const [role, setRole] = useState(initialData.role ?? '旁白');
  const [speed, setSpeed] = useState(initialData.speed ?? 1.0);
  const [volume, setVolume] = useState(initialData.volume ?? 70);
  const [lines, setLines] = useState(initialData.lines ?? '');
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleHov, setRoleHov] = useState(null);
  const roleDropdownRef = useRef(null);
  const [closeBtnHov, setCloseBtnHov] = useState(false);
  const [globalBtnHov, setGlobalBtnHov] = useState(false);
  const [globalBtnPress, setGlobalBtnPress] = useState(false);
  const [saveBtnHov, setSaveBtnHov] = useState(false);
  const [saveBtnPress, setSaveBtnPress] = useState(false);
  const [textareaFocus, setTextareaFocus] = useState(false);
  const volTrackRef = useRef(null);
  const draggingVol = useRef(false);
  const speedTrackRef = useRef(null);
  const draggingSpeed = useRef(false);

  useEffect(() => {
    if (!open) return;
    const frameId = requestAnimationFrame(() => {
      setRole(initialData.role ?? '旁白');
      setSpeed(initialData.speed ?? 1.0);
      setVolume(initialData.volume ?? 70);
      setLines(initialData.lines ?? '');
      setRoleOpen(false);
      setGlobalBtnHov(false);
      setGlobalBtnPress(false);
      setSaveBtnHov(false);
      setSaveBtnPress(false);
    });
    return () => cancelAnimationFrame(frameId);
  }, [open, initialData.role, initialData.speed, initialData.volume, initialData.lines]);

  function calcSpeedFromX(clientX) {
    const track = speedTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const idx = Math.round(pct * (SPEED_OPTIONS.length - 1));
    setSpeed(SPEED_OPTIONS[idx]);
  }

  function calcVolFromX(clientX) {
    const track = volTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.min(100, Math.max(0, Math.round(((clientX - rect.left) / rect.width) * 100)));
    setVolume(pct);
  }

  useEffect(() => {
    if (!open) return;
    function onMove(e) {
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      if (draggingVol.current) calcVolFromX(x);
      if (draggingSpeed.current) calcSpeedFromX(x);
    }
    function onUp() { draggingVol.current = false; draggingSpeed.current = false; }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [open]);

  // 点击下拉框外部时收起
  useEffect(() => {
    if (!roleOpen) return;
    function onDown(e) {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target)) {
        setRoleOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [roleOpen]);

  if (!open) return null;

  // 语速 thumb 位置：基于 SPEED_OPTIONS 索引精确对齐
  const speedIdx = SPEED_OPTIONS.indexOf(speed);
  const speedPct = speedIdx >= 0 ? (speedIdx / (SPEED_OPTIONS.length - 1)) * 100 : ((speed - 0.5) / 1.5) * 100;

  // 坐标轴刻度：0.5 / 0.875 / 1.25 / 1.625 / 2.0 → 均匀 5 点
  const SPEED_TICKS = [
    { label: '0.5×', pct: 0 },
    { label: '1.0×', pct: ((1.0 - 0.5) / 1.5) * 100 },
    { label: '1.5×', pct: ((1.5 - 0.5) / 1.5) * 100 },
    { label: '2.0×', pct: 100 },
  ];

  const labelStyle = { fontSize: '13px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT };
  const fieldWrap = { display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' };
  const inputBoxBase = { display: 'flex', alignItems: 'center', height: '36px', width: '100%', borderRadius: '8px', padding: '0 12px', gap: '8px', boxSizing: 'border-box', backgroundColor: '#1D1E1E', outline: '1px solid rgba(0,0,0,0.5)', position: 'relative' };

  // 按钮外层（渐变边框壳）— hover 时边框加强，press 时整体降透明度
  const btnShell = (hov, press) => ({
    display: 'flex', flexDirection: 'column', height: '36px', flexShrink: 0,
    borderRadius: '8px', padding: '1px',
    boxShadow: '3px 3px 8px rgba(0,0,0,0.4)',
    backgroundImage: hov
      ? 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 45%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF1E, #FFFFFF1E)'
      : 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)',
    outline: '1px solid rgba(0,0,0,0.5)',
    opacity: press ? 0.75 : 1,
    cursor: 'pointer',
    transition: 'opacity 0.08s',
  });
  // 按钮内层
  const btnInner = () => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexGrow: 1, flexShrink: 1, flexBasis: '0%',
    borderRadius: '7px', paddingInline: '15px', gap: '4px',
    backgroundColor: '#161616',
  });

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        style={{ width: '400px', borderRadius: '16px', overflow: 'visible', display: 'flex', flexDirection: 'column', background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', background: '#161616', flexShrink: 0 }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>台词分配</span>
          <button type="button" onClick={onClose}
            onMouseEnter={() => setCloseBtnHov(true)} onMouseLeave={() => setCloseBtnHov(false)}
            style={{ background: closeBtnHov ? 'rgba(255,255,255,0.08)' : 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', transition: 'background 0.1s' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke={closeBtnHov ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)'} strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 24px', background: '#161616' }}>

          {/* 配音角色 */}
          <div style={fieldWrap}>
            <span style={labelStyle}>配音角色</span>
            <div ref={roleDropdownRef} style={{ ...inputBoxBase, border: `1px solid ${roleOpen ? 'rgba(45,195,225,0.6)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer' }}
              onClick={() => setRoleOpen((v) => !v)}>
              <span style={{ flex: 1, fontSize: '14px', lineHeight: '18px', color: role ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.25)', fontFamily: FONT }}>{role || '请选择角色'}</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: roleOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}><path d="M4 6l4 4 4-4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {roleOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#1D1E1E', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '8px', zIndex: 20, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                  onClick={(e) => e.stopPropagation()}>
                  {/* 置顶固定选项：旁白 */}
                  <div
                    onMouseEnter={() => setRoleHov('旁白')} onMouseLeave={() => setRoleHov(null)}
                    onClick={() => { setRole('旁白'); setRoleOpen(false); }}
                    style={{ padding: '9px 12px', fontSize: '14px', lineHeight: '18px', color: role === '旁白' ? '#2DC3E1' : 'rgba(255,255,255,0.80)', fontFamily: FONT, cursor: 'pointer', background: role === '旁白' ? 'rgba(45,195,225,0.08)' : roleHov === '旁白' ? 'rgba(255,255,255,0.05)' : 'transparent', transition: 'background 0.1s' }}>
                    旁白
                  </div>
                  {chars.length === 0 && (
                    <div style={{ padding: '10px 12px', fontSize: '13px', color: 'rgba(255,255,255,0.30)', fontFamily: FONT }}>暂无角色</div>
                  )}
                  {chars.map((c) => (
                    <div key={c.id ?? c.name}
                      onMouseEnter={() => setRoleHov(c.name)} onMouseLeave={() => setRoleHov(null)}
                      onClick={() => { setRole(c.name); setRoleOpen(false); }}
                      style={{ padding: '9px 12px', fontSize: '14px', lineHeight: '18px', color: c.name === role ? '#2DC3E1' : 'rgba(255,255,255,0.80)', fontFamily: FONT, cursor: 'pointer', background: c.name === role ? 'rgba(45,195,225,0.08)' : roleHov === c.name ? 'rgba(255,255,255,0.05)' : 'transparent', transition: 'background 0.1s' }}>
                      {c.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 语速 */}
          <div style={fieldWrap}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={labelStyle}>语速</span>
              <span style={{ fontSize: '12px', lineHeight: '18px', color: '#2DC3E1', fontFamily: FONT }}>{speed.toFixed(1)}×</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', borderRadius: '8px', padding: '10px 12px', boxSizing: 'border-box', backgroundColor: '#1D1E1E', border: '1px solid rgba(255,255,255,0.08)', outline: '1px solid rgba(0,0,0,0.5)' }}>
              {/* track 区域，左右各留 7px 让 thumb 不超出 */}
              <div ref={speedTrackRef} style={{ position: 'relative', height: '14px', margin: '0 7px', cursor: 'pointer' }}
                onMouseDown={(e) => { e.preventDefault(); draggingSpeed.current = true; calcSpeedFromX(e.clientX); }}>
                {/* 底轨 */}
                <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.10)' }} />
                {/* 已填充 */}
                <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', height: '3px', borderRadius: '2px', background: '#2DC3E1', width: `${speedPct}%` }} />
                {/* thumb */}
                <div style={{ position: 'absolute', left: `${speedPct}%`, top: '50%', transform: 'translate(-50%,-50%)', width: '14px', height: '14px', borderRadius: '50%', background: '#FFFFFF', boxShadow: '0 0 0 2px #2DC3E1, 0 2px 6px rgba(0,0,0,0.4)', zIndex: 1, pointerEvents: 'none' }} />
              </div>
              {/* 刻度轴：相对于 track 区域（含 7px 边距）精确对齐 */}
              <div style={{ position: 'relative', height: '16px', margin: '0 7px' }}>
                {SPEED_TICKS.map(({ label, pct }) => (
                  <span key={label} style={{ position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)', fontSize: '11px', lineHeight: '16px', color: 'rgba(255,255,255,0.25)', fontFamily: FONT, whiteSpace: 'nowrap' }}>{label}</span>
                ))}
              </div>
            </div>
          </div>

          {/* 音量 */}
          <div style={fieldWrap}>
            <span style={labelStyle}>音量</span>
            <div style={{ ...inputBoxBase, border: '1px solid rgba(255,255,255,0.08)', cursor: 'default', userSelect: 'none' }}>
              <div
                ref={volTrackRef}
                style={{ flex: 1, height: '20px', display: 'flex', alignItems: 'center', position: 'relative', cursor: 'pointer' }}
                onMouseDown={(e) => { e.preventDefault(); draggingVol.current = true; calcVolFromX(e.clientX); }}>
                {/* 底轨 */}
                <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }} />
                {/* 填充段 */}
                <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', height: '4px', borderRadius: '2px', background: '#2DC3E1', width: `${volume}%`, pointerEvents: 'none' }} />
                {/* thumb */}
                <div style={{ position: 'absolute', left: `${volume}%`, top: '50%', transform: 'translate(-50%,-50%)', width: '12px', height: '12px', borderRadius: '50%', background: '#FFFFFF', boxShadow: '0 0 0 2px #2DC3E1, 0 2px 6px rgba(0,0,0,0.4)', pointerEvents: 'none' }} />
              </div>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)', fontFamily: FONT, flexShrink: 0, minWidth: '30px', textAlign: 'right' }}>{volume}%</span>
            </div>
          </div>

          {/* 台词 */}
          <div style={fieldWrap}>
            <span style={labelStyle}>台词</span>
            <textarea
              value={lines}
              onChange={(e) => setLines(e.target.value)}
              onFocus={() => setTextareaFocus(true)}
              onBlur={() => setTextareaFocus(false)}
              placeholder="输入台词内容…"
              style={{ width: '100%', minHeight: '100px', borderRadius: '8px', padding: '10px 12px', boxSizing: 'border-box', background: '#1D1E1E', border: `1px solid ${textareaFocus ? 'rgba(45,195,225,0.6)' : 'rgba(255,255,255,0.08)'}`, outline: '1px solid rgba(0,0,0,0.5)', resize: 'vertical', fontSize: '14px', lineHeight: '20px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT, caretColor: 'rgba(255,255,255,0.80)', transition: 'border-color 0.1s' }}
              className="placeholder:text-[rgba(255,255,255,0.25)]"
            />
          </div>
        </div>

        {/* footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', background: '#161616' }}>
          {/* 全局应用 */}
          <div role="button" style={{ position: 'relative' }}
            onMouseEnter={() => setGlobalBtnHov(true)} onMouseLeave={() => { setGlobalBtnHov(false); setGlobalBtnPress(false); }}
            onMouseDown={() => setGlobalBtnPress(true)} onMouseUp={() => setGlobalBtnPress(false)}
            onClick={() => { onSaveGlobal?.({ role, speed, volume, lines }); onClose(); }}>
            <div style={btnShell(globalBtnHov, globalBtnPress)}>
              <div style={btnInner()}>
                <span style={{ fontSize: '13px', lineHeight: '18px', color: '#FFFFFF', fontFamily: FONT, whiteSpace: 'nowrap' }}>全局应用</span>
              </div>
            </div>
            {globalBtnHov && !globalBtnPress && (
              <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', background: '#2A2A2A', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px', padding: '6px 10px', whiteSpace: 'nowrap', fontSize: '12px', lineHeight: '18px', color: 'rgba(255,255,255,0.70)', fontFamily: FONT, pointerEvents: 'none', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                把该角色的语速和音量应用到全局
              </div>
            )}
          </div>
          {/* 保存到当前分镜 */}
          <div role="button" style={{ position: 'relative' }}
            onMouseEnter={() => setSaveBtnHov(true)} onMouseLeave={() => { setSaveBtnHov(false); setSaveBtnPress(false); }}
            onMouseDown={() => setSaveBtnPress(true)} onMouseUp={() => setSaveBtnPress(false)}
            onClick={() => { onSaveCurrent?.({ role, speed, volume, lines }); onClose(); }}>
            <div style={btnShell(saveBtnHov, saveBtnPress)}>
              <div style={btnInner()}>
                <span style={{ fontSize: '13px', lineHeight: '18px', color: '#FFFFFF', fontFamily: FONT, whiteSpace: 'nowrap' }}>保存到当前分镜</span>
              </div>
            </div>
            {saveBtnHov && !saveBtnPress && (
              <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', background: '#2A2A2A', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px', padding: '6px 10px', whiteSpace: 'nowrap', fontSize: '12px', lineHeight: '18px', color: 'rgba(255,255,255,0.70)', fontFamily: FONT, pointerEvents: 'none', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                仅在当前分镜使用该角色的语速和音量
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}


export default VoiceDubModal;
