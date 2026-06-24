 import { useState, memo } from "react";
 
 function BatchActionBtn({ children, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", height: "36px", borderRadius: "8px", paddingInline: "16px", gap: "4px", backgroundColor: hov ? "#2DC3E1" : "#2DC3E1", cursor: "pointer", transition: "background-color 0.12s" }}>
      <span style={{ fontSize: "14px", lineHeight: "18px", color: "#090909", fontFamily: "\"Alibaba PuHuiTi 2.0\", system-ui, sans-serif", whiteSpace: "nowrap" }}>{children}</span>
    </div>
  );
}
export default memo(BatchActionBtn);
