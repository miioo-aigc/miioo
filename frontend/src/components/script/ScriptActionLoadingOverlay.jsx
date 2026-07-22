/**
 * @file ScriptActionLoadingOverlay.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   展示剧本 AI 操作期间保留的模糊遮罩和品牌加载动画
 *   不管理请求、不调用 API，只负责反馈层视觉
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-22  新增分集重排和本集重写共用的加载遮罩
 */
import LoadingAnimation from '../LoadingAnimation';

export default function ScriptActionLoadingOverlay() {
  return (
    <div
      role="status"
      aria-label="正在处理"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <LoadingAnimation width={200} />
    </div>
  );
}
