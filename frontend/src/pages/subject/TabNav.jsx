import { useState } from "react";
import { FONT, FONT_MEDIUM } from "../../utils/fonts";

export default 
function TabNav({ activeTab, counts, onChange }) {
  return (
    <div className="flex items-center self-stretch shrink-0" style={{ marginTop: '16px', marginBottom: '4px' }}>
      <div className="flex items-start gap-[24px]">
        {TABS.map(({ key, label }) => {
          const isActive = activeTab === key;
          return (
            <div
              key={key}
              className="flex flex-col items-center gap-[4px] cursor-pointer"
              onClick={() => onChange(key)}
            >
              <div className="flex items-center gap-[4px]">
                <span
                  style={{
                    fontFamily: isActive ? FONT_MEDIUM : FONT,
                    fontWeight: isActive ? 500 : 400,
                    fontSize: '14px',
                    lineHeight: '18px',
                    color: isActive ? '#FFFFFF' : '#FFFFFF99',
                    width: 'fit-content',
                    flexShrink: 0,
                  }}
                >
                  {label}
                </span>
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{
                    minWidth: '18px',
                    width: '16px',
                    height: '16px',
                    borderRadius: 'calc(infinity * 1px)',
                    paddingInline: '5px',
                    backgroundColor: isActive ? '#2DC3E1' : '#FFFFFF1A',
                  }}
                >
                  <span
                    style={{
                      fontFamily: isActive ? 'AlibabaPuHuiTi_2_65_Medium, "Alibaba PuHuiTi 2.0", system-ui, sans-serif' : 'AlibabaPuHuiTi_2_55_Regular, "Alibaba PuHuiTi 2.0", system-ui, sans-serif',
                      fontWeight: isActive ? 600 : 400,
                      fontSize: '12px',
                      lineHeight: '100%',
                      color: isActive ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.6)',
                    }}
                  >
                    {counts[key] ?? 0}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
