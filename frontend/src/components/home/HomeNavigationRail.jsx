/**
 * @file HomeNavigationRail.jsx
 * @structure-index
 *
 * ─── 组件职责 ─────────────────────────────────────────────────────
 *   首页主导航与底部快捷导航的布局组合
 *
 * ─── 依赖边界 ─────────────────────────────────────────────────────
 *   只接收导航数据、当前选中项和显式变更回调；不读取 Home 页面状态、API 或 Store。
 *   具体导航项配置仍由 HomeNavigationConfig 提供，导航行为仍由 Home 页面编排。
 *
 * ─── 更新记录 ─────────────────────────────────────────────────────
 *   2026-07-17  从 Home.jsx 抽离导航栏布局，保持导航顺序和样式不变
 */
import PrimaryNav from '../PrimaryNav';

export default function HomeNavigationRail({
  items,
  activeKey,
  onChange,
  bottomItems,
  bottomActiveKey,
  onBottomChange,
}) {
  return (
    <div className="flex flex-col items-start gap-0 px-[16px] self-stretch w-auto" style={{ position: 'relative', zIndex: 10 }}>
      <div
        className="flex flex-col items-start justify-center py-24 flex-1"
        style={{
          paddingLeft: '0px',
          paddingRight: '0px',
          transition: 'padding-left 320ms cubic-bezier(0.4, 0, 0.2, 1), padding-right 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <PrimaryNav items={items} activeKey={activeKey} onChange={onChange} variant="vertical" />
      </div>

      <div
        className="py-24"
        style={{
          paddingLeft: '0px',
          paddingRight: '0px',
          alignSelf: 'stretch',
          transition: 'padding-left 320ms cubic-bezier(0.4, 0, 0.2, 1), padding-right 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <PrimaryNav items={bottomItems} activeKey={bottomActiveKey} onChange={onBottomChange} variant="compact" />
      </div>
    </div>
  );
}
