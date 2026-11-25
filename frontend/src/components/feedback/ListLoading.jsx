import DotsLoading from '../DotsLoading';

// 首屏占据列表可用区域；追加加载保留在列表底部。
export default function ListLoading({ more = false, style }) {
  return <div role="status" aria-label="正在加载列表" style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', flex: more ? '0 0 auto' : '1 1 0%',
    minHeight: more ? '40px' : '120px', gridColumn: '1 / -1', ...style,
  }}><DotsLoading size={6} gap={4} color="var(--color-brand-main)" /></div>;
}
