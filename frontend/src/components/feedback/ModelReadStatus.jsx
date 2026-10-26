import RemoteReadStatus from './RemoteReadStatus';

export default function ModelReadStatus({ loading, error, empty, onRetry }) {
  return <RemoteReadStatus loading={loading} error={error || (empty ? '暂无可用模型，请前往首页 API 配置启用服务商和模型，然后重试。' : '')} onRetry={onRetry} />;
}
