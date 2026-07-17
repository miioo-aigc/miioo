/**
 * 资产列表的滚动展示壳。
 * 只负责空态、滚动容器、分页哨兵和加载提示，不触碰分页请求或筛选状态。
 */
export default function AssetsScrollableContent({
  items = [],
  activeCategory,
  subjectCardCategories,
  scrollContainerRef,
  sentinelRef,
  loading = false,
  emptyState,
  children,
}) {
  const isEmpty = items.length === 0;
  const isAudio = activeCategory === 'audio';
  const isSubjectGrid = subjectCardCategories.has(activeCategory)
    && !['storyboard_img', 'storyboard_video'].includes(activeCategory);

  const layoutStyle = isEmpty
    ? {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }
    : isAudio
      ? {
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }
      : {
          display: 'grid',
          gridTemplateColumns: isSubjectGrid
            ? 'repeat(auto-fill, minmax(clamp(160px, 10.67vw, 192px), 1fr))'
            : 'repeat(auto-fill, minmax(clamp(240px, 16vw, 288px), 1fr))',
          gap: '8px',
          alignContent: 'flex-start',
        };

  return (
    <div
      ref={scrollContainerRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        paddingTop: '16px',
        paddingBottom: '24px',
        paddingLeft: '24px',
        paddingRight: '24px',
        ...layoutStyle,
      }}
    >
      {isEmpty ? emptyState : children}
      <div ref={sentinelRef} style={{ width: '100%', height: '1px', flexShrink: 0 }} />
      {loading && (
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '16px 0', flexShrink: 0 }}>
          <span style={{ fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif", fontSize: '13px', color: '#FFFFFF40' }}>加载中…</span>
        </div>
      )}
    </div>
  );
}
