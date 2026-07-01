import { apiListCreationAudios } from "../api/creation";
import { apiGetOfficialVoices, apiGetVoices } from "../api/voices";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import AudioPlayer from "../components/AudioPlayer";
import { normalizeImageUrl } from "../utils/imageUrl";
const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
  </svg>
);

const HeadphoneIcon = ({ color = "#2DC3E1" }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 18v-6a9 9 0 0118 0v6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" />
  </svg>
);

const PlayingWaveIcon = ({ color = "#2DC3E1", size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="6" width="2" height="4" rx="1" fill={color}>
      <animate attributeName="height" values="4;10;4" dur="0.8s" repeatCount="indefinite" />
      <animate attributeName="y" values="6;3;6" dur="0.8s" repeatCount="indefinite" />
    </rect>
    <rect x="5" y="4" width="2" height="8" rx="1" fill={color}>
      <animate attributeName="height" values="8;14;8" dur="0.8s" begin="0.15s" repeatCount="indefinite" />
      <animate attributeName="y" values="4;1;4" dur="0.8s" begin="0.15s" repeatCount="indefinite" />
    </rect>
    <rect x="9" y="3" width="2" height="10" rx="1" fill={color}>
      <animate attributeName="height" values="10;16;10" dur="0.8s" begin="0.3s" repeatCount="indefinite" />
      <animate attributeName="y" values="3;0;3" dur="0.8s" begin="0.3s" repeatCount="indefinite" />
    </rect>
    <rect x="13" y="5" width="2" height="6" rx="1" fill={color}>
      <animate attributeName="height" values="6;12;6" dur="0.8s" begin="0.45s" repeatCount="indefinite" />
      <animate attributeName="y" values="5;2;5" dur="0.8s" begin="0.45s" repeatCount="indefinite" />
    </rect>
  </svg>
);

function normalizeAudioUrl(url) {
  return normalizeImageUrl(url) || url || "";
}

function resolveVoicePreviewUrl(voice) {
  const rawUrl =
    voice?.preview_url ||
    voice?.source_audio_url ||
    voice?.sample_url ||
    voice?.audio_url ||
    voice?.url ||
    "";
  return normalizeAudioUrl(rawUrl);
}

function resolveAudioItemUrl(audio) {
  const rawUrl =
    audio?.audio_url ||
    audio?.audioUrl ||
    audio?.file_url ||
    audio?.fileUrl ||
    audio?.original_url ||
    audio?.url ||
    "";
  return normalizeAudioUrl(rawUrl);
}

function DotsLoading({ size = 6, color = "#2DC3E1", gap = 4 }) {
  return (
    <div style={{ display: "flex", gap: gap + "px", alignItems: "center" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: size + "px", height: size + "px", borderRadius: "50%", background: color, animation: "dotPulse 1.2s ease-in-out " + (i * 0.2) + "s infinite" }} />
      ))}
    </div>
  );
}

function SelectField({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  const hasOptions = options.length > 0;
  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: "8px", flex: "0 0 23.4%", position: "relative" }}>
      <span style={{ fontFamily: FONT, fontSize: "14px", lineHeight: "18px", color: "#FFFFFF99" }}>{label}</span>
      <button type="button" onClick={() => hasOptions && setOpen((v) => !v)}
        style={{ display: "flex", alignItems: "center", height: "36px", width: "100%", borderRadius: "8px", padding: "0 12px", gap: "8px", background: open ? "#252525" : "#1D1E1E", border: "1px solid " + (open ? "#FFFFFF33" : "#FFFFFF14"), outline: "1px solid " + (open ? "#2DC3E180" : "#00000080"), cursor: hasOptions ? "pointer" : "default", transition: "background 0.2s, border-color 0.2s" }}>
        <span style={{ flex: 1, fontFamily: FONT, fontSize: "14px", lineHeight: "18px", color: "#FFFFFF", textAlign: "left" }}>{value}</span>
        <ChevronDownIcon />
      </button>
      {open && hasOptions && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 60, width: "100%", borderRadius: "8px", padding: "4px", background: "#1D1E1E", border: "1px solid #FFFFFF14", outline: "1px solid #00000080", boxShadow: "0px 4px 16px rgba(0,0,0,0.6)" }}>
          {options.map((opt) => {
            const isSelected = opt === value;
            return (
              <button key={opt} type="button" onClick={() => { onChange?.(opt); setOpen(false); }}
                style={{ display: "flex", width: "100%", alignItems: "center", borderRadius: "6px", padding: "8px 12px", textAlign: "left", border: "none", background: isSelected ? "#FFFFFF14" : "transparent", color: isSelected ? "#FFFFFF" : "#FFFFFFCC", fontFamily: FONT, fontSize: "14px", lineHeight: "18px", cursor: "pointer" }}>
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VoiceCard({ label, active, onClick, previewUrl }) {
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);
  const audioRef = useRef(null);
  useEffect(() => {
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } };
  }, []);
  const handlePlay = (e) => {
    e.stopPropagation();
    if (!previewUrl) return;
    if (playing) { audioRef.current?.pause(); audioRef.current = null; setPlaying(false); }
    else {
      const audio = new Audio(previewUrl);
      audioRef.current = audio;
      audio.play().catch(() => setPlaying(false));
      audio.onended = () => { audioRef.current = null; setPlaying(false); };
      audio.onerror = () => { audioRef.current = null; setPlaying(false); };
      setPlaying(true);
    }
  };
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ flex: "0 0 calc((100% - 56px) / 5)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", borderRadius: "8px", padding: "7px 6px", minHeight: "68px", cursor: "pointer", background: active ? "#1D1E1E" : hovered ? "#252525" : "#1D1E1E", border: "1px solid " + (active ? "#2DC3E1" : hovered ? "#FFFFFF3D" : "#FFFFFF14"), transition: "background 0.15s, border-color 0.15s" }}>
      <button type="button" onClick={handlePlay} disabled={!previewUrl} style={{ background: "transparent", border: "none", padding: 0, cursor: previewUrl ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", opacity: previewUrl ? 1 : 0.3 }}>
        {playing ? <PlayingWaveIcon color="#2DC3E1" size={16} /> : <HeadphoneIcon color={previewUrl ? "#2DC3E1" : "#FFFFFF99"} />}
      </button>
      <span style={{ fontFamily: FONT, fontSize: "13px", lineHeight: "16px", color: active ? "#2DC3E1" : "#FFFFFF99", textAlign: "center", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}

function CustomVoiceCard({ voice, selected, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const name = voice.name || voice.voice_name || voice.id || "未命名音色";
  const previewUrl = resolveVoicePreviewUrl(voice);
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "12px", borderRadius: "8px", background: selected ? "#1D1E1E" : hovered ? "#252525" : "#1D1E1E", border: selected ? "1px solid #2DC3E1" : hovered ? "1px solid #FFFFFF14" : "1px solid transparent", cursor: "pointer", outline: "none", width: "100%", textAlign: "left", transition: "background 0.15s, border-color 0.15s" }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.(event);
        }
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: selected ? "rgba(45,195,225,0.14)" : "#FFFFFF0D", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: selected ? "0 0 16px rgba(45,195,225,0.14)" : "none" }}>
          {previewUrl ? <HeadphoneIcon color={selected ? "#2DC3E1" : "#FFFFFF99"} /> : <HeadphoneIcon color="#FFFFFF40" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT, fontSize: "14px", lineHeight: "18px", color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
          <div style={{ fontFamily: FONT, fontSize: "12px", lineHeight: "16px", color: selected ? "#2DC3E1" : "#FFFFFF66", marginTop: "2px" }}>{previewUrl ? "可试听音色" : "暂无试听音频"}</div>
        </div>
      </div>
      <AudioPlayer src={previewUrl} label="试听" size="compact" />
    </div>
  );
}

export function DubbingVoiceFileCard({ voiceName, voiceId, previewUrl, onRemove, onOpenModal }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: "relative", flexShrink: 0 }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div
        onClick={onOpenModal}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenModal?.();
          }
        }}
        style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "240px", padding: "12px", borderRadius: "8px", background: "#1D1E1E", border: "1px solid #FFFFFF14", cursor: "pointer", outline: "none", position: "relative" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: previewUrl ? "rgba(45,195,225,0.12)" : "#FFFFFF0D", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: previewUrl ? "0 0 16px rgba(45,195,225,0.12)" : "none" }}>
            <HeadphoneIcon color={previewUrl ? "#2DC3E1" : "#FFFFFF66"} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0, flex: 1 }}>
            <span style={{ fontFamily: FONT, fontSize: "14px", lineHeight: "18px", color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "180px" }}>{voiceName}</span>
            <span style={{ fontFamily: FONT, fontSize: "12px", lineHeight: "16px", color: previewUrl ? "#2DC3E1" : "#FFFFFF66", marginTop: "2px" }}>{previewUrl ? "已附带试听音频" : "音频参考"}</span>
          </div>
        </div>
        {previewUrl ? <AudioPlayer src={previewUrl} label="预览" size="compact" /> : null}
      </div>
      {hovered && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onRemove?.(); }} style={{ position: "absolute", top: "-6px", right: "-6px", width: "18px", height: "18px", borderRadius: "50%", background: "#2D2D2D", border: "1px solid #FFFFFF14", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, zIndex: 2 }}>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5" stroke="#FFFFFF99" strokeWidth="1.2" strokeLinecap="round" /></svg>
        </button>
      )}
    </div>
  );
}

export default function DubbingVoiceModal({ open, onClose, onConfirm }) {
  const [tab, setTab] = useState("miioo");
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [gender, setGender] = useState("不限");
  const [age, setAge] = useState("不限");
  const [customVoices, setCustomVoices] = useState([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [favAudios, setFavAudios] = useState([]);
  const [favLoading, setFavLoading] = useState(false);
  const fileInputRef = useRef(null);

  const GENDER_OPTIONS = ["不限", "男", "女"];
  const AGE_OPTIONS = ["不限", "青少年", "青年", "中年", "老年"];

  useEffect(() => {
    if (!open || tab !== "miioo") return;
    if (voices.length > 0) return;
    setLoading(true);
    const fallback = () => {
      apiGetVoices({ tab: "all" })
        .then((data) => {
          const list = Array.isArray(data) ? data : data?.items ?? data?.voices ?? [];
          setVoices(list);
        })
        .catch(() => setVoices([]))
        .finally(() => setLoading(false));
    };
    // 优先尝试官方音色接口
    apiGetOfficialVoices()
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.items ?? data?.voices ?? [];
        if (list.length > 0) { setVoices(list); setLoading(false); }
        else { fallback(); }
      })
      .catch(() => { fallback(); });
  }, [open, tab]);

  useEffect(() => {
    if (!open || tab !== "custom") return;
    if (customVoices.length > 0) return;
    setCustomLoading(true);
    apiGetVoices({ tab: "custom" })
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.items ?? data?.voices ?? [];
        setCustomVoices(list);
      })
      .catch(() => setCustomVoices([]))
      .finally(() => setCustomLoading(false));
  }, [open, tab]);

  useEffect(() => {
    if (!open || tab !== "fav") return;
    setFavLoading(true);
    apiListCreationAudios({ is_favorite: true, page: 1, page_size: 100 })
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.list ?? data?.items ?? data?.audios ?? [];
        setFavAudios(list);
      })
      .catch(() => setFavAudios([]))
      .finally(() => setFavLoading(false));
  }, [open, tab]);

  if (!open) return null;

  const filteredVoices = voices.filter((v) => {
    if (gender !== "不限" && v.gender !== gender) return false;
    if (age !== "不限" && v.age_group !== age) return false;
    return true;
  });

  const rows = [];
  for (let i = 0; i < filteredVoices.length; i += 5) rows.push(filteredVoices.slice(i, i + 5));

  const handleCreateVoice = () => { fileInputRef.current?.click(); };

  const handleFileForCustomVoice = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const audioFile = files[0];
    const ext = "." + audioFile.name.split(".").pop().toLowerCase();
    const allowed = [".mp3", ".wav", ".aac", ".ogg", ".flac", ".m4a", ".wma"];
    if (!allowed.includes(ext)) { alert("仅支持音频格式：mp3, wav, aac, ogg, flac, m4a, wma"); e.target.value = ""; return; }
    const formData = new FormData();
    formData.append("file", audioFile);
    formData.append("name", audioFile.name.replace(/\.[^.]+$/, ""));
    fetch(import.meta.env.VITE_API_BASE_URL + "/api/voices/custom", {
      method: "POST",
      headers: { Authorization: "Bearer " + (localStorage.getItem("access_token") || "") },
      body: formData,
    })
      .then(r => {
        if (!r.ok) throw new Error("Upload failed: " + r.status);
        return r.json();
      })
      .then((raw) => {
        const voice = raw?.voice ?? raw?.data ?? raw;
        setCustomVoices((prev) => [voice, ...prev]);
        const vid = voice.id || voice.voice_id || voice.name;
        if (vid) setSelectedVoice(vid);
      })
     .catch((err) => { console.error("Failed to create custom voice:", err); alert("创建音色失败，请重试"); });
    e.target.value = "";
  };

  const handleConfirm = () => {
    let voiceId = selectedVoice;
    let voiceName = "";
    let referenceAudioUrl = "";
    if (tab === "miioo") {
      const v = voices.find((x) => x.voice_id === selectedVoice);
      if (v) {
        voiceName = v.name;
        voiceId = v.voice_id;
        referenceAudioUrl = resolveVoicePreviewUrl(v);
      }
    } else if (tab === "custom") {
      const v = customVoices.find((x) => (x.id || x.voice_id || x.name) === selectedVoice);
      if (v) {
        voiceName = v.name || v.voice_name || v.id || "未命名音色";
        voiceId = v.id || v.voice_id || voiceId;
        referenceAudioUrl = resolveVoicePreviewUrl(v);
      }
    } else if (tab === "fav") {
      const a = favAudios.find((x) => (x.id || x.audio_id) === selectedVoice);
      if (a) {
        voiceName = a.name || a.audio_name || "未命名音频";
        voiceId = a.id || a.audio_id || voiceId;
        referenceAudioUrl = resolveAudioItemUrl(a);
      }
    }
    onConfirm?.(voiceId, voiceName, referenceAudioUrl, tab);
    onClose();
  };

  const tabItems = [
    { key: "miioo", label: "miioo音色库" },
    { key: "custom", label: "自定义音色" },
    { key: "fav", label: "收藏" },
  ];

  const tabBtns = tabItems.map(({ key, label }) => (
    <button key={key} type="button" onClick={() => setTab(key)}
      style={{ fontFamily: tab === key ? FONT_MEDIUM : FONT, fontSize: "14px", lineHeight: "20px", fontWeight: tab === key ? 500 : 400, color: tab === key ? "#FFFFFF" : "#FFFFFF66", padding: "4px 0px", background: "transparent", border: "none", cursor: "pointer", transition: "color 0.15s" }}>
      {label}
    </button>
  ));

  const footerContent = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "16px", padding: "16px 24px", background: "#161616", flexShrink: 0, borderTop: "1px solid #FFFFFF0D" }}>
      <button type="button" onClick={onClose}
        style={{ height: "36px", borderRadius: "8px", padding: "0 16px", background: "#161616", border: "1px solid #FFFFFF0D", boxShadow: "#00000066 3px 3px 8px", outline: "1px solid #00000080", cursor: "pointer", fontFamily: FONT, fontSize: "14px", lineHeight: "18px", color: "#FFFFFF99" }}>
        取消
      </button>
      <div style={{ height: "36px", borderRadius: "8px", padding: "1px", backgroundImage: "linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)", boxShadow: "#00000066 3px 3px 8px", outline: "1px solid #00000080", cursor: selectedVoice ? "pointer" : "not-allowed", opacity: selectedVoice ? 1 : 0.5, display: "flex" }} onClick={handleConfirm}>
        <div style={{ display: "flex", alignItems: "center", flex: 1, borderRadius: "7px", padding: "0 15px", background: "#161616" }}>
          <span style={{ fontFamily: FONT, fontSize: "14px", lineHeight: "18px", color: "#FFFFFF", whiteSpace: "nowrap" }}>确认</span>
        </div>
      </div>
    </div>
  );

  const miiooTab = (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingTop: "12px", paddingBottom: "16px" }} onClick={() => setSelectedVoice("")}>
      <div style={{ display: "flex", gap: "16px" }}>
        <SelectField label="性别" value={gender} options={GENDER_OPTIONS} onChange={setGender} />
        <SelectField label="年龄" value={age} options={AGE_OPTIONS} onChange={setAge} />
      </div>
      {loading ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, minHeight: 200 }}><DotsLoading size={6} color="#2DC3E1" gap={4} /></div>
      : !loading && filteredVoices.length === 0 ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}><span style={{ fontFamily: FONT, fontSize: "14px", color: "#FFFFFF66" }}>暂无匹配音色</span></div>
      : rows.map((row, ri) => (
        <div key={ri} style={{ display: "flex", gap: "14px" }}>
          {row.map((v) => (
            <VoiceCard key={v.voice_id} label={v.name} active={selectedVoice === v.voice_id} onClick={(e) => { e.stopPropagation(); setSelectedVoice(selectedVoice === v.voice_id ? "" : v.voice_id); }} previewUrl={resolveVoicePreviewUrl(v)} />
          ))}
        </div>
      ))}
    </div>
  );

  const customTab = (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "12px", paddingBottom: "16px" }} onClick={() => setSelectedVoice("")}>
      <input ref={fileInputRef} type="file" accept=".mp3,.wav,.aac,.ogg,.flac,.m4a,.wma" className="hidden" onChange={handleFileForCustomVoice} />
      <button type="button" onClick={handleCreateVoice} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", height: "56px", padding: "0 24px", borderRadius: "8px", border: "1px dashed #FFFFFF3D", background: "transparent", cursor: "pointer", transition: "border-color 0.15s, background 0.15s", outline: "none", width: "100%" }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#2DC3E1"; e.currentTarget.style.background = "rgba(45,195,225,0.06)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#FFFFFF3D"; e.currentTarget.style.background = "transparent"; }}
        onMouseDown={(e) => { e.currentTarget.style.background = "rgba(45,195,225,0.12)"; }}
        onMouseUp={(e) => { e.currentTarget.style.background = "rgba(45,195,225,0.06)"; }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 6v12M6 12h12" stroke="#2DC3E1" strokeWidth="1.5" strokeLinecap="round" /></svg>
          <span style={{ fontFamily: FONT_MEDIUM, fontSize: "14px", lineHeight: "18px", color: "#2DC3E1" }}>创建音色</span>
        </div>
        <span style={{ fontFamily: FONT, fontSize: "12px", lineHeight: "16px", color: "#FFFFFF66" }}>上传大于5s的清晰人声音频，自动克隆声音。</span>
      </button>
      {customLoading ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}><DotsLoading size={6} color="#2DC3E1" gap={4} /></div>
      : customVoices.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>{customVoices.map((v) => <CustomVoiceCard key={v.id || v.voice_id || v.name} voice={v} selected={selectedVoice === (v.id || v.voice_id || v.name)} onSelect={(e) => { e.stopPropagation(); const vid = v.id || v.voice_id || v.name; setSelectedVoice(selectedVoice === vid ? "" : vid); }} />)}</div>}
    </div>
  );

  const favTab = (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "12px", paddingBottom: "16px" }} onClick={() => setSelectedVoice("")}>
      {favLoading ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}><DotsLoading size={6} color="#2DC3E1" gap={4} /></div>
      : favAudios.length === 0 ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", padding: "48px 24px", flex: 1 }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="32" height="32" rx="6" stroke="#FFFFFF1A" strokeWidth="1.5" /><path d="M20 24H28M24 20V28" stroke="#FFFFFF33" strokeWidth="1.5" strokeLinecap="round" /></svg>
        <span style={{ fontFamily: FONT, fontSize: "14px", lineHeight: "18px", color: "#FFFFFF66" }}>暂无收藏的音频</span>
      </div>
      : favAudios.map((audio) => {
        const aid = audio.id || audio.audio_id;
        const previewUrl = resolveAudioItemUrl(audio);
        const isSelected = selectedVoice === aid;
        return (
          <div
            key={aid}
            onClick={(e) => { e.stopPropagation(); setSelectedVoice(isSelected ? "" : aid); }}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedVoice(isSelected ? "" : aid);
              }
            }}
            style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "12px", borderRadius: "8px", background: isSelected ? "#FFFFFF14" : "#1D1E1E", border: isSelected ? "1px solid #2DC3E199" : "1px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: "background 0.15s, border-color 0.15s", outline: "none", width: "100%", textAlign: "left" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: previewUrl ? "rgba(45,195,225,0.12)" : "#FFFFFF0D", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: isSelected ? "0 0 16px rgba(45,195,225,0.12)" : "none" }}>
                <HeadphoneIcon color={previewUrl ? (isSelected ? "#2DC3E1" : "#FFFFFF99") : "#FFFFFF40"} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONT, fontSize: "14px", lineHeight: "18px", color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{audio.name || audio.audio_name || "未命名音频"}</div>
                <div style={{ fontFamily: FONT, fontSize: "12px", lineHeight: "16px", color: isSelected ? "#2DC3E1" : "#FFFFFF66", marginTop: "2px" }}>{audio.created_at ? new Date(audio.created_at).toLocaleDateString("zh-CN") : "音频作品"}</div>
              </div>
            </div>
            <AudioPlayer src={previewUrl} label="作品" size="compact" />
          </div>
        );
      })}
    </div>
  );

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }} onClick={onClose}>
      <div style={{ width: "800px", height: "600px", background: "#161616", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", background: "#161616", flexShrink: 0 }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: "16px", lineHeight: "20px", color: "#FFFFFF", flex: 1 }}>选择音色</span>
          <button type="button" onClick={onClose} style={{ width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        <div style={{ display: "flex", gap: "24px", padding: "0 24px", background: "#161616", flexShrink: 0 }}>{tabBtns}</div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 24px", background: "#161616" }}>
          {tab === "miioo" && miiooTab}
          {tab === "custom" && customTab}
          {tab === "fav" && favTab}
        </div>
        {footerContent}
      </div>
    </div>
  , document.body);
}
