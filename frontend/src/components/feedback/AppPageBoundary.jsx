import { Suspense } from 'react';
import PageErrorBoundary from './PageErrorBoundary';

// 静态导入轻量反馈，避免反馈本身依赖尚未下载的页面或动画资源。
export default function AppPageBoundary({ children }) {
  return (
    <PageErrorBoundary
      reloadOnRetry
      title="页面加载失败"
      description="页面加载或运行出现异常，请检查网络后重新加载。重新加载可能丢失未保存的内容。"
    >
      <Suspense fallback={
        <div role="status" className="flex min-h-screen items-center justify-center p-spacing-32 text-text-secondary text-font-size-14">
          加载中…
        </div>
      }>
        {children}
      </Suspense>
    </PageErrorBoundary>
  );
}
