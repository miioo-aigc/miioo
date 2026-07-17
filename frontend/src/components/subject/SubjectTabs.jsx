/**
 * @file SubjectTabs.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   SubjectTabs  角色、场景、道具标签和数量展示
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收当前标签、数量和切换回调
 *   不读取页面状态、不调用 API、不处理主体选择清理
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 SubjectPage 抽离主体标签导航
 */

import { SUBJECT_TABS } from './SubjectTabsConstants';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export default function SubjectTabs({ activeTab, counts = {}, onChange }) {
  return (
    <div className="flex items-center self-stretch shrink-0" style={{ marginTop: '16px', marginBottom: '4px' }}>
      <div className="flex items-start gap-[24px]">
        {SUBJECT_TABS.map(({ key, label }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              className="flex flex-col items-center gap-[4px] cursor-pointer border-0 bg-transparent p-0"
              onClick={() => onChange?.(key)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="flex items-center gap-[4px]">
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
                <span
                  className="flex items-center justify-center shrink-0"
                  style={{
                    minWidth: '18px',
                    maxWidth: '30px',
                    height: '16px',
                    borderRadius: 'calc(infinity * 1px)',
                    paddingInline: '5px',
                    backgroundColor: isActive ? '#2DC3E1' : '#FFFFFF1A',
                  }}
                >
                  <span
                    style={{
                      fontFamily: isActive ? FONT_MEDIUM : FONT,
                      fontWeight: isActive ? 600 : 400,
                      fontSize: '12px',
                      lineHeight: '100%',
                      color: isActive ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.6)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {counts[key] ?? 0}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
