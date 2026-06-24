import { memo } from "react";

function FavFilterCheckbox({ checked, onChange }) {
  return (
    <div onClick={onChange}
      style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", flexShrink: 0 }}>
      <div style={{ width: "18px", height: "18px", borderRadius: "4px", border: checked ? "1px solid #2DC3E1" : "1px solid rgba(255,255,255,0.3)", backgroundColor: checked ? "#2DC3E1" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>
      <span style={{ fontSize: "12px", lineHeight: "16px", color: checked ? "#FFFFFF" : "rgba(255,255,255,0.6)", fontFamily: "\"Alibaba PuHuiTi 2.0\", system-ui, sans-serif" }}>仅显示收藏</span>
    </div>
  );
}
export default memo(FavFilterCheckbox);
