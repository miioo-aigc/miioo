/**
 * @file DubbingVoiceCard.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   配音选择弹窗中的单张音色卡片，负责选中、试听与收藏的展示及交互。
 *
 * ─── 数据流 ─────────────────────────────────────────────────────────
 *   通过 props 接收音色数据、选中与收藏状态，以及选择和收藏回调。
 *   音频播放生命周期由卡片自身管理，不读取页面状态、Store 或 API。
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-08-18  从 CreationDubbingVoiceModal 抽离音色卡片交互
 *   2026-08-18  优化横向滚动、表面 radio 与标题优先级
 */
import { useEffect, useRef, useState } from "react";

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function PlayIcon() {
  return <svg width="20" height="20" viewBox="0 0 102.4 102.4" fill="none" aria-hidden="true"><path d="M83.2 47.572 33.706 16.852c-2.774-1.706-6.4.426-6.4 3.626v61.44c0 3.2 3.626 5.334 6.4 3.627l49.28-30.72c2.986-1.494 2.986-5.76.214-7.253Z" fill="#FFFFFFCC" /></svg>;
}

function PauseIcon() {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="5" y="4" width="3" height="12" rx="1" fill="#FFFFFFCC" /><rect x="12" y="4" width="3" height="12" rx="1" fill="#FFFFFFCC" /></svg>;
}

function StarIcon({ active = false }) {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m8 1.714 1.829 3.657 4 .572-2.858 2.857.686 4L8 10.857l-3.657 1.943.686-4-2.858-2.857 4-.572L8 1.714Z" fill={active ? "#F0B429" : "none"} stroke={active ? "#F0B429" : "#FFFFFF99"} strokeLinejoin="round" /></svg>;
}

function RadioIcon({ selected, hovered }) {
  return <span style={{ width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", borderRadius: "50%", border: `1px solid ${selected ? "#2DC3E1" : hovered ? "#FFFFFF99" : "#FFFFFF33"}`, outline: "1px solid #00000080", background: selected ? "#2DC3E1" : "#090909", transition: "background 120ms, border-color 120ms" }}>{selected && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0A0A0A" }} />}</span>;
}

export default function DubbingVoiceCard({ voice, selected = false, favorited = false, favoriteLoading = false, onSelect, onFavoriteToggle }) {
  const [hovered, setHovered] = useState(false);
  const [playerHovered, setPlayerHovered] = useState(false);
  const [radioHovered, setRadioHovered] = useState(false);
  const [starHovered, setStarHovered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);
  const audioUrl = voice.audioUrl || voice.audio_url || voice.previewUrl || voice.preview_url || voice.url;

  useEffect(() => () => audioRef.current?.pause(), []);

  const handlePlayerClick = (event) => {
    event.stopPropagation();
    if (!audioUrl) {
      setPlaying((current) => !current);
      return;
    }
    if (playing) {
      audioRef.current?.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      return;
    }
    audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  const handleHorizontalWheel = (event) => {
    const container = event.currentTarget;
    const scrollAmount = event.deltaX || event.deltaY;
    if (container.scrollWidth <= container.clientWidth || scrollAmount === 0) return;

    container.scrollLeft += scrollAmount;
  };

  const showRadio = selected || hovered;

  return (
    <div role="radio" aria-checked={selected} tabIndex={0} onClick={() => onSelect?.(voice)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect?.(voice); } }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setRadioHovered(false); setPlayerHovered(false); setStarHovered(false); }} style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: "12px", minWidth: 0, padding: "12px 16px", border: 0, borderRadius: "8px", outline: selected ? "1px solid #2DC3E1" : "none", outlineOffset: "-1px", background: selected ? "linear-gradient(rgba(45,195,225,0.05), rgba(45,195,225,0.05)), #FFFFFF0D" : hovered ? "#FFFFFF1A" : "#FFFFFF0D", boxSizing: "border-box", cursor: "pointer", transition: "background 120ms, outline-color 120ms" }}>
      <button type="button" aria-label={playing ? "暂停试听" : "播放试听"} onClick={handlePlayerClick} onMouseEnter={() => setPlayerHovered(true)} onMouseLeave={() => setPlayerHovered(false)} style={{ alignSelf: "center", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, border: 0, borderRadius: "50%", flexShrink: 0, background: playerHovered ? "#FFFFFF14" : "#FFFFFF0D", cursor: "pointer", transition: "background 120ms" }}>{playing ? <PauseIcon /> : <PlayIcon />}</button>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "6px", flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", alignSelf: "stretch", minWidth: 0 }}>
          <span style={{ flex: "0 1 auto", minWidth: 0, overflow: "hidden", color: "#FFFFFF", fontFamily: FONT_MEDIUM, fontSize: "14px", fontWeight: 500, lineHeight: "17px", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{voice.name}</span>
          <span style={{ flex: "0 1 auto", minWidth: 0, overflow: "hidden", color: "#FFFFFFCC", fontFamily: FONT, fontSize: "14px", fontWeight: 300, lineHeight: "17px", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{voice.mood}</span>
          <button type="button" aria-label={favorited ? "取消收藏" : "收藏音色"} aria-pressed={favorited} disabled={favoriteLoading} onClick={(event) => { event.stopPropagation(); if (!favoriteLoading) onFavoriteToggle?.(voice); }} onMouseEnter={() => setStarHovered(true)} onMouseLeave={() => setStarHovered(false)} style={{ width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, border: 0, borderRadius: "4px", flexShrink: 0, background: starHovered ? "#FFFFFF0D" : "transparent", cursor: favoriteLoading ? "wait" : "pointer", opacity: favoriteLoading ? 0.6 : 1, transition: "background 120ms, opacity 120ms" }}><StarIcon active={favorited} /></button>
          <span aria-hidden="true" style={{ flex: 1, minWidth: 0 }} />
        </div>
        <div aria-label="音色标签" onWheel={handleHorizontalWheel} style={{ display: "flex", alignItems: "flex-start", gap: "6px", alignSelf: "stretch", overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", msOverflowStyle: "none", whiteSpace: "nowrap" }}>{voice.tags.map((tag) => <span key={tag} style={{ display: "flex", alignItems: "center", height: "18px", padding: "0 6px", borderRadius: "4px", flexShrink: 0, background: "#FFFFFF0D", color: "#FFFFFF99", fontFamily: FONT, fontSize: "12px", lineHeight: "16px", whiteSpace: "nowrap" }}>{tag}</span>)}</div>
        <div aria-label="音色描述" onWheel={handleHorizontalWheel} style={{ alignSelf: "stretch", minWidth: 0, overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", msOverflowStyle: "none", color: "#FFFFFF66", cursor: "default", fontFamily: FONT, fontSize: "12px", lineHeight: "17px", whiteSpace: "nowrap" }}>{voice.description}</div>
      </div>
      {showRadio && <button type="button" aria-label={selected ? "取消选择音色" : "选择音色"} onClick={(event) => { event.stopPropagation(); onSelect?.(voice); }} onMouseEnter={() => setRadioHovered(true)} onMouseLeave={() => setRadioHovered(false)} style={{ position: "absolute", top: "12px", right: "12px", display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", padding: "2px", border: 0, borderRadius: "50%", background: "transparent", cursor: "pointer" }}><RadioIcon selected={selected} hovered={radioHovered} /></button>}
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" onEnded={() => setPlaying(false)} onError={() => setPlaying(false)} style={{ display: "none" }} />}
    </div>
  );
}
