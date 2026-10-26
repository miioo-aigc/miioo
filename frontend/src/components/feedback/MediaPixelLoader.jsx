import { Component, lazy, Suspense } from 'react';
import './media-pixel-loader.css';

const ImageGeneration = lazy(() => import('img-fx').then(module => ({ default: module.ImageGeneration })));

/** 动效不读取媒体地址，也不自行揭晓；生命周期由真实加载状态控制。 */
export default function MediaPixelLoader() {
  return <div className="media-pixel-loader" role="status" aria-label="媒体加载中">
    <LoaderBoundary>
      <Suspense fallback={<div className="media-pixel-loader__fallback" />}>
        <ImageGeneration preset="pixels-organic" theme="dark" autoReveal={false} style={{ width: '100%', height: '100%', display: 'block' }}>
          <div style={{ width: '100%', height: '100%', minHeight: '32px', borderRadius: 'inherit' }} />
        </ImageGeneration>
      </Suspense>
    </LoaderBoundary>
  </div>;
}

/** 不支持 WebGL 或动效模块加载失败时，仍保留无文字的加载反馈。 */
class LoaderBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="media-pixel-loader__fallback" /> : this.props.children; }
}
