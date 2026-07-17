/**
 * @file SubjectGenerationAction.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   SubjectGenerationAction  主体编辑面板底部的生成图片动作区
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只负责底部布局和生成按钮视觉
 *   不调用 API、不读取 Store、不决定生成参数或任务状态
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 SubjectPage 的 EditSubjectPanel 抽离生成动作区
 *   2026-07-15  生成按钮统一复用 components/ui/Button
 */
import { Button } from '../ui';

function GenerateImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 5V3.188C3 2.891 3.029 2.783 3.083 2.674C3.138 2.566 3.218 2.481 3.32 2.422C3.422 2.364 3.523 2.333 3.801 2.333H12.199C12.477 2.333 12.578 2.364 12.68 2.422C12.782 2.481 12.862 2.566 12.916 2.674C12.971 2.783 13 2.891 13 3.188V5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.667 5H14.333V13.667H1.667V5Z" stroke="currentColor" strokeLinejoin="round" />
      <path fillRule="evenodd" clipRule="evenodd" d="M4.333 8.667C4.886 8.667 5.333 8.219 5.333 7.667C5.333 7.114 4.886 6.667 4.333 6.667C3.781 6.667 3.333 7.114 3.333 7.667C3.333 8.219 3.781 8.667 4.333 8.667Z" fill="currentColor" />
      <path d="M1.856 13.463L5 10L6.667 11.333L8.667 9L14.131 13.463" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SubjectGenerationAction({ onGenerate }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        bottom: 0,
        width: 'round(70%, 1px)',
        padding: '16px 24px',
        background: '#161616',
        borderBottomLeftRadius: '16px',
        borderBottomRightRadius: '0',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Button
        type="button"
        variant="accent"
        size="large"
        icon={<GenerateImageIcon />}
        className="!gap-[4px]"
        contentClassName="!text-[14px] !leading-[18px] !text-[#090909] !whitespace-nowrap"
        style={{
          backgroundImage: 'linear-gradient(in oklab 107.51deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)',
        }}
        onClick={onGenerate}
      >
        生成图片
      </Button>
    </div>
  );
}
