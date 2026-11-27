import { Component } from 'react';

/** 画布装饰效果失败时只关闭当前效果，不能影响节点、连线与生成任务。 */
export default class CanvasEffectBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('[画布] 视觉效果运行失败，已自动降级:', error, info);
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
