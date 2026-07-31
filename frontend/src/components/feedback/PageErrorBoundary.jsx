import { Component } from 'react';

export default class PageErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[页面] 项目内容渲染失败:', error, info);
  }

  handleRetry = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', color: '#FFFFFF' }}>
        <div style={{ width: 'min(460px, 100%)', padding: '28px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', background: '#161717', textAlign: 'center' }}>
          <div style={{ marginBottom: '10px', fontSize: '16px', fontWeight: 600 }}>项目页面加载失败</div>
          <div style={{ marginBottom: '20px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', lineHeight: 1.6 }}>
            页面数据或组件出现异常，请重试。项目内容不会因此被删除。
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{ height: '36px', padding: '0 18px', border: 0, borderRadius: '6px', background: '#2DC3E1', color: '#071014', cursor: 'pointer', fontSize: '14px' }}
          >
            重试
          </button>
        </div>
      </div>
    );
  }
}
