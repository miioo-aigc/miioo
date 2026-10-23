import { Button } from '../ui';

// 请求归属和重试策略由调用方负责，此组件只呈现读取反馈。
export default function RemoteReadStatus({ loading, error, onRetry }) {
  if (!loading && !error) return null;
  return (
    <div role={loading ? 'status' : 'alert'} className="flex shrink-0 flex-wrap items-center gap-spacing-8 p-spacing-16 text-text-secondary text-font-size-14">
      <span>{loading ? '正在读取，请稍候…' : error}</span>
      {!loading && onRetry && <Button onClick={onRetry}>重试</Button>}
    </div>
  );
}
