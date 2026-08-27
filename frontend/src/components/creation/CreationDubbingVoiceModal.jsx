/**
 * @file CreationDubbingVoiceModal.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   创作配音的选择音色弹窗，以及输入区已选音频参考卡片。
 *   官方音色、展示字段和收藏状态以后端接口返回为准；收藏 Tab 只展示官方收藏音色。
 *
 * ─── 数据流 ─────────────────────────────────────────────────────────
 *   弹窗通过 open、onClose、onConfirm 接入 CreationInputCard；
 *   音频参考卡片通过 voiceName、onRemove、onOpenModal 接入输入区。
 *
 * ─── 组件结构 ───────────────────────────────────────────────────────
 *   DubbingVoiceFileCard / ModalCloseIcon / SearchIcon / FilterIcon /
 *   DubbingVoiceFilters / DubbingVoiceCard / DubbingVoiceModal
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-16  从 pages 迁入创作域组件目录，保持音色选择行为不变
 *   2026-08-07  无试听地址的官方音色隐藏耳机按钮，名称和情绪增加中文展示适配
 *   2026-08-07  官方音色 Tab 改为 minimax 官方音色库，移除性别/年龄筛选和情绪副标题
 *   2026-08-07  官方音色卡片名称统一使用 minimax 音色 name 的中文翻译，提交仍使用原始 voice_id
 *   2026-08-11  已选音频参考卡片移除播放按钮，仅保留名称和类型文字
 *   2026-08-11  自定义音色上传复用统一鉴权 API，修复空 Bearer 导致的上传失败
 *   2026-08-11  自定义音色上传失败和格式错误改用创作页 Toast 反馈
 *   2026-08-18  创作配音选择音色弹窗隐藏自定义音色 Tab，保留官方音色和收藏入口
 *   2026-08-18  按新设计稿重构选择音色弹窗，暂以静态音色卡片呈现视觉结构
 *   2026-08-18  按新版设计稿将弹窗尺寸调整为 800 × 600，并收紧内容区控制栏布局
 *   2026-08-18  补齐弹窗按钮、搜索框、Tab 和筛选按钮的本地交互状态
 *   2026-08-18  Tab 切换真实展示官方静态音色与收藏入口，移除设计稿外的列表分页器
 *   2026-08-18  音色卡片抽离为 DubbingVoiceCard
 *   2026-08-18  官方音色接入查询接口，并以官网采集元数据补全展示名称、标签和描述
 *   2026-08-18  新增固定音色筛选区，并使用官网元数据兜底筛选字段
 *   2026-08-18  官方语言筛选优先使用官网元数据，避免接口语言格式差异导致漏查
 *   2026-08-25  官方音色展示字段改为完全使用后端返回值，移除 voice_id 本地静态元数据匹配
 *   2026-08-25  音色筛选项改为根据后端返回字段动态生成
 *   2026-08-25  官方音色收藏接入后端接口，收藏状态和能力以后端返回值为准
 *   2026-08-25  收藏 Tab 改为只筛选展示已收藏的官方音色，不再读取创作音频
 *   2026-08-25  按接口文档统一通过 voice_id 调用官方音色 favorite 接口
 *   2026-08-26  音色试听改为单例播放，关闭弹窗时停止并释放音频
 *   2026-08-27  官方音色弹窗打开时跳过旧缓存，避免收藏 Tab 使用过期收藏状态
 */
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { apiAddVoiceFavorite, apiGetOfficialVoices, apiRemoveVoiceFavorite } from "../../api/voices";
import { stopVoicePreview } from "../../utils/voicePreviewPlayer";
import { Button } from "../ui/Button";
import { CreationEmptyIconDubbing } from "./CreationEmptyState";
import DubbingVoiceCard from "./DubbingVoiceCard";
import DubbingVoiceFilters from "./DubbingVoiceFilters";

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function ModalCloseIcon({ color = "#FFFFFF" }) {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.667 2.667L13.333 13.333M2.667 13.333L13.333 2.667" stroke={color} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function SearchIcon({ color = "#FFFFFF99" }) {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M7 12.667A5.667 5.667 0 1 0 7 1.333a5.667 5.667 0 0 0 0 11.334Z" stroke={color} strokeLinejoin="round" /><path d="m11.074 11.074 2.828 2.828" stroke={color} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function FilterIcon({ color = "#FFFFFF" }) {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 3h12L9.2 8.606V12.8L6.8 14V8.606L2 3Z" stroke={color} strokeLinejoin="round" /></svg>;
}

function normalizeOfficialVoice(voice) {
  const voiceId = voice.voice_id || voice.voiceId || voice.provider_voice_id || voice.providerVoiceId || voice.id;
  const tags = Array.isArray(voice.tags) ? voice.tags.filter(Boolean) : [];

  return {
    id: voiceId,
    name: voice.display_name || voice.displayName || voice.name || "未命名音色",
    mood: voice.style || "官方系统音色",
    tags,
    description: voice.description || "暂无音色描述",
    language: voice.language || "",
    accent: voice.accent || "",
    gender: voice.gender || "",
    ageGroup: voice.age_group || voice.ageGroup || "",
    audioUrl: voice.preview_url || voice.previewUrl || voice.source_audio_url || voice.sourceAudioUrl,
    sortOrder: Number(voice.sort_order ?? voice.sortOrder ?? 0),
    source: voice.source_label || voice.sourceLabel || voice.source || voice.provider || voice.provider_name || "MiniMax 官方音色库",
    isFavorite: Boolean(voice.is_favorite ?? voice.isFavorite),
    supportsFavorite: voice.supports_favorite ?? voice.supportsFavorite ?? false,
  };
}

function getUniqueValues(voices, getValue) {
  return [...new Set(voices.flatMap((voice) => {
    const value = getValue(voice);
    return Array.isArray(value) ? value : [value];
  }).filter(Boolean))].sort((first, second) => String(first).localeCompare(String(second), "zh-CN"));
}

function VoiceListEmptyState({ message }) {
  return (
    <div style={{ gridColumn: "1 / -1", alignSelf: "stretch", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", minHeight: "100%" }}>
      <CreationEmptyIconDubbing />
      <span style={{ color: "#FFFFFF66", fontFamily: FONT, fontSize: "14px", lineHeight: "18px", textAlign: "center" }}>{message}</span>
    </div>
  );
}

export function DubbingVoiceFileCard({ voiceName, onRemove, onOpenModal }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ position: "relative", flexShrink: 0 }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button type="button" onClick={onOpenModal} style={{ display: "flex", alignItems: "center", height: "60px", padding: "0 16px", borderRadius: "8px", background: "#1D1E1E", border: "1px solid #FFFFFF14", cursor: "pointer", outline: "none" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}><span style={{ overflow: "hidden", color: "#FFFFFF", fontFamily: FONT, fontSize: "14px", lineHeight: "18px", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{voiceName}</span><span style={{ marginTop: "2px", color: "#FFFFFF66", fontFamily: FONT, fontSize: "12px", lineHeight: "16px" }}>音频参考</span></div>
      </button>
      {hovered && onRemove && <button type="button" onClick={(event) => { event.stopPropagation(); onRemove(); }} aria-label="移除音频参考" style={{ position: "absolute", top: "-6px", right: "-6px", width: "18px", height: "18px", padding: 0, border: "1px solid #FFFFFF14", borderRadius: "50%", background: "#2D2D2D", color: "#FFFFFF99", cursor: "pointer" }}>×</button>}
    </div>
  );
}

export default function DubbingVoiceModal({ open, onClose, onConfirm, showToast }) {
  const [activeTab, setActiveTab] = useState("official");
  const [hoveredTab, setHoveredTab] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [officialVoices, setOfficialVoices] = useState([]);
  const [officialLoading, setOfficialLoading] = useState(false);
  const [officialError, setOfficialError] = useState("");
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [officialFavoriteIds, setOfficialFavoriteIds] = useState(new Set());
  const [favoriteUpdatingId, setFavoriteUpdatingId] = useState("");
  const [searchHovered, setSearchHovered] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [voiceFilters, setVoiceFilters] = useState({ language: "不限", accent: "不限", gender: "不限", ageGroup: "不限" });
  const [closeHovered, setCloseHovered] = useState(false);
  const [closePressed, setClosePressed] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    return () => stopVoicePreview();
  }, [open]);

  const handleConfirm = () => {
    const selectedVoice = visibleVoices.find((voice) => voice.id === selectedVoiceId);
    if (selectedVoice) onConfirm?.(selectedVoice.id, selectedVoice.name, activeTab, selectedVoice.source);
    onClose?.();
  };

  const isSearchActive = searchHovered || searchFocused;
  const tabs = [
    { id: "official", label: "minimax官方音色库" },
    { id: "favorites", label: "收藏" },
  ];

  const normalizedSearchValue = searchValue.trim().toLocaleLowerCase("zh-CN");
  const filteredOfficialVoices = officialVoices.filter((voice) => {
    const matchesSearch = !normalizedSearchValue || [voice.name, voice.mood, ...voice.tags, voice.description]
      .join(" ")
      .toLocaleLowerCase("zh-CN")
      .includes(normalizedSearchValue);
    const matchesLanguage = voiceFilters.language === "不限"
      || voice.language === voiceFilters.language
      || voice.tags.includes(voiceFilters.language);
    const matchesFilters = matchesLanguage
      && (voiceFilters.accent === "不限" || voice.accent === voiceFilters.accent)
      && (voiceFilters.gender === "不限" || voice.gender === voiceFilters.gender)
      && (voiceFilters.ageGroup === "不限" || voice.ageGroup === voiceFilters.ageGroup);

    return matchesSearch && matchesFilters;
  });
  const isFavoritesTab = activeTab === "favorites";
  const visibleVoices = isFavoritesTab ? filteredOfficialVoices.filter((voice) => officialFavoriteIds.has(voice.id)) : filteredOfficialVoices;
  const officialFilterOptions = {
    languages: getUniqueValues(officialVoices, (voice) => voice.language),
    accents: getUniqueValues(officialVoices, (voice) => voice.accent),
    genders: getUniqueValues(officialVoices, (voice) => voice.gender),
    ageGroups: getUniqueValues(officialVoices, (voice) => voice.age_group || voice.ageGroup),
  };

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setOfficialLoading(true);
        setOfficialError("");
      }
    });

    apiGetOfficialVoices({ provider: "minimax", skipCache: true })
      .then((voices) => {
        if (cancelled) return;
        const normalizedVoices = voices
          .filter((voice) => voice.voice_id || voice.voiceId || voice.id)
          .filter((voice) => voice.is_enabled !== false && voice.isEnabled !== false && voice.supports_generate !== false && voice.supportsGenerate !== false)
          .map(normalizeOfficialVoice)
          .sort((first, second) => first.sortOrder - second.sortOrder);
        setOfficialVoices(normalizedVoices);
        setOfficialFavoriteIds(new Set(normalizedVoices.filter((voice) => voice.isFavorite).map((voice) => voice.id)));
      })
      .catch((error) => {
        if (!cancelled) {
          setOfficialVoices([]);
          setOfficialError(error?.message || "官方音色加载失败，请稍后重试");
        }
      })
      .finally(() => {
        if (!cancelled) setOfficialLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchValue("");
  };

  const handleVoiceSelect = (voice) => {
    setSelectedVoiceId((current) => current === voice.id ? "" : voice.id);
  };

  const handleFilterChange = (filterKey, value) => {
    setVoiceFilters((current) => ({ ...current, [filterKey]: value }));
  };

  const handleFavoriteToggle = async (voice) => {
    if (favoriteUpdatingId === voice.id) return;

    const isFavorited = officialFavoriteIds.has(voice.id);
    setFavoriteUpdatingId(voice.id);
    try {
      if (isFavorited) await apiRemoveVoiceFavorite(voice.id);
      else await apiAddVoiceFavorite(voice.id);

      setOfficialFavoriteIds((current) => {
        const next = new Set(current);
        if (isFavorited) next.delete(voice.id);
        else next.add(voice.id);
        return next;
      });
      setOfficialVoices((current) => current.map((item) => (
        item.id === voice.id ? { ...item, isFavorite: !isFavorited } : item
      )));
      if (isFavorited && isFavoritesTab) {
        setSelectedVoiceId((current) => current === voice.id ? "" : current);
      }
      showToast?.("success", isFavorited ? "已取消收藏" : "收藏成功");
    } catch (error) {
      showToast?.("error", error?.message || (isFavorited ? "取消收藏失败，请稍后重试" : "收藏失败，请稍后重试"));
    } finally {
      setFavoriteUpdatingId("");
    }
  };

  if (!open) return null;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
      <div role="dialog" aria-modal="true" aria-labelledby="dubbing-voice-modal-title" style={{ width: "min(800px, calc(100vw - 48px))", height: "min(600px, calc(100vh - 48px))", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid #FFFFFF14", borderRadius: "8px", background: "#161616", boxSizing: "border-box" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "16px 24px", flexShrink: 0, background: "#161616" }}>
          <h2 id="dubbing-voice-modal-title" style={{ flex: 1, margin: 0, color: "#FFFFFF", fontFamily: FONT_MEDIUM, fontSize: "16px", fontWeight: 500, lineHeight: "20px" }}>选择音色</h2>
          <button type="button" onClick={onClose} onMouseEnter={() => setCloseHovered(true)} onMouseLeave={() => { setCloseHovered(false); setClosePressed(false); }} onMouseDown={() => setClosePressed(true)} onMouseUp={() => setClosePressed(false)} aria-label="关闭选择音色弹窗" style={{ width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, border: 0, background: "transparent", cursor: "pointer", opacity: closePressed ? 0.6 : 1, transition: "opacity 120ms" }}><ModalCloseIcon color={closeHovered ? "#FFFFFF" : "#FFFFFF99"} /></button>
        </header>
        <main style={{ display: "flex", flexDirection: "column", gap: "16px", minHeight: 0, padding: "8px 24px", flex: 1, background: "#161616", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexShrink: 0 }}>
            <div role="tablist" aria-label="音色来源" style={{ display: "flex", alignItems: "center", gap: "24px", height: "36px", flex: 1, minWidth: 0 }}>
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const isHovered = hoveredTab === tab.id;

                return <button key={tab.id} type="button" role="tab" aria-selected={isActive} onClick={() => handleTabChange(tab.id)} onMouseEnter={() => setHoveredTab(tab.id)} onMouseLeave={() => setHoveredTab("")} style={{ height: "36px", padding: 0, border: 0, background: "transparent", color: isActive ? "#FFFFFF" : isHovered ? "#FFFFFFCC" : "#FFFFFF99", cursor: "pointer", fontFamily: isActive ? FONT_MEDIUM : FONT, fontSize: "16px", fontWeight: isActive ? 500 : 400, lineHeight: isActive ? "20px" : "18px", transition: "color 120ms" }}>{tab.label}</button>;
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "16px", flex: 1, minWidth: 0 }}>
              <div onMouseEnter={() => setSearchHovered(true)} onMouseLeave={() => setSearchHovered(false)} style={{ flex: 1, minWidth: 0, height: "36px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "0 12px", border: `1px solid ${searchFocused ? "rgba(45,195,225,0.6)" : isSearchActive ? "#FFFFFF33" : "#FFFFFF14"}`, outline: searchFocused ? "3px solid rgba(45,195,225,0.08)" : "1px solid #00000080", borderRadius: "8px", background: searchFocused ? "rgba(45,195,225,0.04)" : isSearchActive ? "#222222" : "#1D1E1E", boxSizing: "border-box", transition: "background 120ms, border-color 120ms, outline 120ms" }}>
                <input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} placeholder="输入关键词，搜索音色库" aria-label="搜索音色库" style={{ flex: 1, minWidth: 0, padding: 0, border: 0, outline: "none", background: "transparent", color: "#FFFFFF", caretColor: "#2DC3E1", fontFamily: FONT, fontSize: "14px", lineHeight: "18px" }} className="placeholder:text-[#FFFFFF66]" />
                <span style={{ display: "flex", flexShrink: 0 }}><SearchIcon color={searchFocused ? "#FFFFFF" : isSearchActive ? "#FFFFFFCC" : "#FFFFFF99"} /></span>
              </div>
              <Button variant="primary" icon={<span style={{ display: "flex", width: "16px", height: "16px", flexShrink: 0 }}><FilterIcon color={filtersVisible ? "#2DC3E1" : "#FFFFFF"} /></span>} iconOnly aria-label={filtersVisible ? "收起音色筛选" : "展开音色筛选"} aria-pressed={filtersVisible} onClick={() => setFiltersVisible((current) => !current)} style={{ width: "36px", height: "36px" }} />
            </div>
          </div>
          {filtersVisible && <DubbingVoiceFilters filters={voiceFilters} options={officialFilterOptions} onChange={handleFilterChange} />}
          <div style={{ minHeight: 0, flex: 1 }}>
            {officialLoading && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}><span style={{ color: "#FFFFFF66", fontFamily: FONT, fontSize: "14px", lineHeight: "18px", textAlign: "center" }}>官方音色加载中</span></div>}
            {!officialLoading && officialError && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}><span style={{ color: "#FFFFFF66", fontFamily: FONT, fontSize: "14px", lineHeight: "18px", textAlign: "center" }}>{officialError}</span></div>}
            {!officialLoading && !officialError && visibleVoices.length === 0 && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}><VoiceListEmptyState message={searchValue.trim() ? "没有匹配的音色" : isFavoritesTab ? "暂无收藏音色" : "暂无音色"} /></div>}
            {!officialLoading && !officialError && visibleVoices.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", alignContent: "start", gap: "12px", minHeight: 0, height: "100%", overflowY: "auto", overflowX: "hidden", paddingRight: "4px" }}>{visibleVoices.map((voice) => <DubbingVoiceCard key={voice.id} voice={voice} selected={selectedVoiceId === voice.id} favorited={officialFavoriteIds.has(voice.id)} favoriteLoading={favoriteUpdatingId === voice.id} onSelect={handleVoiceSelect} onFavoriteToggle={handleFavoriteToggle} />)}</div>}
          </div>
        </main>
        <footer style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "16px", padding: "16px 24px", flexShrink: 0, borderTop: "1px solid #FFFFFF0D", background: "#161616" }}><Button variant="secondary" onClick={onClose}>取消</Button><Button variant="primary" onClick={handleConfirm}>确认</Button></footer>
      </div>
    </div>,
    document.body,
  );
}
