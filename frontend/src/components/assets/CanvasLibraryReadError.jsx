import { Button } from '../ui';
import { EmptyAssetState } from './AssetsEmptyState';

export default function CanvasLibraryReadError({ busy, onRetry }) {
  return <div role="alert" className="pointer-events-none absolute inset-0 flex items-center justify-center px-[24px] py-[24px] text-center">
    <div className="pointer-events-auto flex flex-col items-center gap-[12px]">
    <div aria-hidden="true"><EmptyAssetState /></div>
    <p className="text-[14px] text-text-secondary">画布资产加载失败，请稍后重试</p>
    <Button variant="link" disabled={busy} onClick={onRetry}>重试</Button>
    </div>
  </div>;
}
