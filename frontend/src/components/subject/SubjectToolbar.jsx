/**
 * @file SubjectToolbar.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   SubjectToolbar  主体页面包屑和顶部动作按钮
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只负责工具栏视觉、按钮交互和回调透传
 *   不调用 API、不读取 Store、不处理 Toast 或页面状态
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 SubjectPage 抽离页面工具栏
 *   2026-07-15  清理页面级按钮样式覆盖，主体常规动作统一复用全局 Button 的 Primary/Accent 结构
 *   2026-08-03  右上角新增按钮默认文案统一使用「新增」
 *   2026-08-21  角色 Tab 新增 Seedance 真人素材认证入口和认证模式退出按钮
 */
import { Button } from '../ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M15 5L9 12L15 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BatchGenerateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="3" width="4" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="8" y="3" width="4" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 10.5H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function StoryboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5.333 2H2.667C2.298 2 2 2.298 2 2.667V5.333" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.333 14H2.667C2.298 14 2 13.701 2 13.333V10.667" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.667 14H13.333C13.701 14 14 13.701 14 13.333V10.667" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.667 2H13.333C13.701 2 14 2.298 14 2.667V5.333" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.333 8C11.333 6.159 9.841 4.667 8 4.667C6.159 4.667 4.667 6.159 4.667 8C4.667 9.841 6.159 11.333 8 11.333C9.841 11.333 11.333 9.841 11.333 8Z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 9C7.448 9 7 8.552 7 8C7 7.448 7.448 7 8 7C8.552 7 9 7.448 9 8C9 8.552 8.552 9 8 9Z" fill="currentColor" />
    </svg>
  );
}

function CertificationIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5.333 2H3.667C2.746 2 2 2.746 2 3.667V5.333M10.667 2H12.333C13.254 2 14 2.746 14 3.667V5.333M14 10.667V12.333C14 13.254 13.254 14 12.333 14H10.667M5.333 14H3.667C2.746 14 2 13.254 2 12.333V10.667" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="6.333" r="1.667" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.333 11.333C5.333 9.861 6.527 8.667 8 8.667C9.473 8.667 10.667 9.861 10.667 11.333" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ExitCertificationIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 4L2.667 7.333L6 10.667" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 7.333H10.333C12.174 7.333 13.667 8.826 13.667 10.667C13.667 12.508 12.174 14 10.333 14H8.667" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SubjectToolbarButton({ children, icon, fontSize = 14, onClick }) {
  return (
    <Button
      type="button"
      variant="primary"
      size="large"
      icon={icon}
      onClick={onClick}
      style={{ fontFamily: FONT, fontSize: `${fontSize}px`, lineHeight: '18px' }}
    >
      {children}
    </Button>
  );
}

export default function SubjectToolbar({
  projectName,
  addLabel = '新增角色',
  tabLabel = '角色',
  onBack,
  onAddSubject,
  onBatchGenerate,
  onStartStoryboard,
  isCharacterTab = false,
  isSeedanceCertificationMode = false,
  onEnterSeedanceCertification,
  onExitSeedanceCertification,
}) {
  return (
    <div className="flex items-center justify-between self-stretch shrink-0">
      <div className="flex items-center gap-[6px]">
        <Button
          type="button"
          variant="secondary"
          size="large"
          icon={<BackIcon />}
          iconOnly
          aria-label="返回项目"
          onClick={onBack}
          className="!size-6 !rounded-none !border-0 !bg-transparent !p-0 !shadow-none hover:!bg-transparent active:!bg-transparent"
          contentClassName="!text-white/70 hover:!text-white"
        />
        <span style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '22px', color: '#FFFFFF', fontWeight: 500 }}>
          {projectName}
        </span>
      </div>

      <div className="flex items-center gap-[8px]">
        {isCharacterTab && isSeedanceCertificationMode ? (
          <Button
            type="button"
            variant="secondary"
            size="large"
            icon={<ExitCertificationIcon />}
            onClick={onExitSeedanceCertification}
          >
            退出认证模式
          </Button>
        ) : (
          <>
            <SubjectToolbarButton icon={<AddIcon />} onClick={onAddSubject}>
              {addLabel}
            </SubjectToolbarButton>
            <SubjectToolbarButton icon={<BatchGenerateIcon />} fontSize={13} onClick={onBatchGenerate}>
              批量生成{tabLabel}
            </SubjectToolbarButton>
            {isCharacterTab && (
              <Button
                type="button"
                variant="primary"
                size="large"
                icon={<CertificationIcon />}
                onClick={onEnterSeedanceCertification}
              >
                seedance真人素材认证
              </Button>
            )}
            <Button
              type="button"
              variant="accent"
              size="large"
              icon={<StoryboardIcon />}
              onClick={onStartStoryboard}
            >
              开始智能分镜
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
