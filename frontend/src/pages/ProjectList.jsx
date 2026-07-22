/**
 * @file ProjectList.jsx
 * @structure-index
 *
 * ─── 全局常量 & 工具函数 ────────────────────────────────────────────
 *   FONT / FONT_MEDIUM              页面字体常量                         L36
 *
 * ─── 图标组件 ───────────────────────────────────────────────────────
 *   SearchIcon / PlusIcon / MoreIcon / PencilIcon / CopyIcon / TrashIcon / CloseIcon
 *                                                                        L41–L98
 *
 * ─── 菜单与弹窗组件 ────────────────────────────────────────────────
 *   MoreMenu                         项目操作菜单                         L115
 *   RenameModal                      项目重命名弹窗                       L130
 *   ConfirmDialog                    删除确认弹窗                         页面底部组合
 *
 * ─── 结果/状态展示组件 ─────────────────────────────────────────────
 *   NewProjectCard                   新建项目卡片                         L319
 *   ProjectCard                      项目卡片与更多操作                   L359
 *
 * ─── 主页面入口 ─────────────────────────────────────────────────────
 *   export default ProjectList()     搜索、项目筛选和弹窗编排             L488
 *     ├─ [状态] searchValue / searchFocused / searchHovered              L489–L491
 *     ├─ [状态] renameTarget / deleteTarget                               L492–L493
 *     └─ [函数] filtered             根据项目名称过滤列表                  L495
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-22  项目删除二次确认改用标准 ConfirmDialog
 *   2026-07-22  移除更多操作下拉菜单选项的黑色描边
 *   2026-07-22  按标准元素修正更多操作菜单项内边距和高度
 *   2026-07-22  按反馈将项目卡片标题信息列间距调整为 4px
 *   2026-07-15  抽离通用按钮组件并迁移弹窗操作按钮
 *   2026-07-15  将项目操作菜单项迁移到 Button 基础能力
 *   2026-07-15  按当前代码补齐结构索引行号
 */
import { useState, useRef, useEffect } from 'react';
import defaultCover from '../assets/project-default-cover.png';
import { formatRelativeTime } from '../utils/formatTime';
import { normalizeImageUrl } from '../utils/imageUrl';
import { Button, ButtonGroup, DropdownMenu, IconButton, TextButton } from '../components/ui';
import ConfirmDialog from '../components/ConfirmDialog';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

// ── Icons ──────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M7 12.667C10.13 12.667 12.667 10.13 12.667 7C12.667 3.87 10.13 1.333 7 1.333C3.87 1.333 1.333 3.87 1.333 7C1.333 10.13 3.87 12.667 7 12.667Z" stroke="#FFFFFF" strokeLinejoin="round" />
      <path d="M11.074 11.074L13.902 13.902" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <line x1="10" y1="4" x2="10" y2="16" stroke="#FFFFFF33" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="4" y1="10" x2="16" y2="10" stroke="#FFFFFF33" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M8 5C8.552 5 9 4.552 9 4C9 3.448 8.552 3 8 3C7.448 3 7 3.448 7 4C7 4.552 7.448 5 8 5Z" fill="#FFFFFF" />
      <path d="M8 9C8.552 9 9 8.552 9 8C9 7.448 8.552 7 8 7C7.448 7 7 7.448 7 8C7 8.552 7.448 9 8 9Z" fill="#FFFFFF" />
      <path d="M8 12.667C8.552 12.667 9 12.219 9 11.667C9 11.114 8.552 10.667 8 10.667C7.448 10.667 7 11.114 7 11.667C7 12.219 7.448 12.667 8 12.667Z" fill="#FFFFFF" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M9.625 2.625L11.375 4.375L4.375 11.375H2.625V9.625L9.625 2.625Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <rect x="5" y="5" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M9 5V3.5C9 2.672 8.328 2 7.5 2H3.5C2.672 2 2 2.672 2 3.5V7.5C2 8.328 2.672 9 3.5 9H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M3 3.33337V14.6667H13V3.33337H3Z" stroke="currentColor" strokeLinejoin="round"/>
      <path d="M6.66663 6.66663V11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9.33337 6.66663V11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1.33337 3.33337H14.6667" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.33337 3.33337L6.42971 1.33337H9.59241L10.6667 3.33337H5.33337Z" stroke="currentColor" strokeLinejoin="round"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── More Menu Dropdown ─────────────────────────────────────────────────────

function MoreMenu({ onRename, onCopy, onDelete, onClose }) {
  return (
    <DropdownMenu
      width="178px"
      onClose={onClose}
      items={[
        { key: 'rename', icon: <PencilIcon />, label: '重命名', onClick: onRename },
        { key: 'copy', icon: <CopyIcon />, label: '复制项目', onClick: onCopy },
        { key: 'delete', icon: <TrashIcon />, label: '删除', danger: true, onClick: onDelete },
      ]}
    />
  );
}

// ── Rename Modal ───────────────────────────────────────────────────────────

function RenameModal({ initialName, onConfirm, onCancel }) {
  const [value, setValue] = useState(initialName || '');
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleConfirm() {
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: '400px',
          background: '#161616',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            background: '#161616',
          }}
        >
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>
            重命名
          </span>
          <IconButton
            icon={<CloseIcon />}
            aria-label="关闭重命名弹窗"
            variant="secondary"
            size="small"
            onClick={onCancel}
            className="size-7 rounded-[6px] border-0 bg-transparent p-0 shadow-none hover:bg-white-5 active:bg-white-10"
          />
        </div>

        {/* Input area */}
        <div style={{ padding: '8px 24px', background: '#161616' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.6)' }}>
              项目名称
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                height: '36px',
                paddingLeft: '12px',
                paddingRight: '6px',
                borderRadius: '8px',
                background: '#1D1E1E',
                border: `1px solid ${focused ? 'rgba(45,195,225,0.6)' : 'rgba(255,255,255,0.08)'}`,
                outline: '1px solid #00000080',
                outlineOffset: '0',
                boxShadow: focused ? '0 0 0 3px rgba(45,195,225,0.08)' : 'none',
                transition: 'border-color 120ms, box-shadow 120ms',
              }}
            >
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontFamily: FONT,
                  fontSize: '14px',
                  lineHeight: '18px',
                  color: '#FFFFFF',
                  caretColor: '#2DC3E1',
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <ButtonGroup
          className="gap-[16px] px-[24px] py-[16px]"
          style={{ background: '#161616' }}
        >
          <TextButton onClick={onCancel}>取消</TextButton>
          <Button variant="primary" onClick={handleConfirm} disabled={!value.trim()}>确认</Button>
        </ButtonGroup>
      </div>
    </div>
  );
}

// ── Project Card ───────────────────────────────────────────────────────────

function NewProjectCard({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        aspectRatio: '3/2',
        borderRadius: '8px',
        background: hovered ? '#252626' : '#1D1E1E',
        border: '1.5px dashed #FFFFFF33',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        cursor: 'pointer',
        transition: 'background 150ms',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: '#FFFFFF14',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PlusIcon />
      </div>
      <span style={{ fontFamily: FONT, fontSize: '13px', color: '#FFFFFF66' }}>新建项目</span>
    </div>
  );
}

function ProjectCard({ project, onRename, onCopy, onDelete, onOpen }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const moreRef = useRef(null);

  function handleMoreClick(e) {
    e.stopPropagation();
    setMenuOpen((v) => !v);
  }

  function handleCardClick() {
    if (!menuOpen) onOpen?.(project);
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={handleCardClick}
      style={{
        width: '100%',
        aspectRatio: '3/2',
        borderRadius: '8px',
        background: '#1D1E1E',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.22)' : '#FFFFFF14'}`,
        position: 'relative',
        overflow: 'visible',
        cursor: 'pointer',
        transform: pressed ? 'scale(0.985)' : 'scale(1)',
        transition: 'border-color 150ms, transform 120ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '8px',
          overflow: 'hidden',
          background: project.cover ? 'transparent' : '#2A2B2B',
        }}
      >
        <img
          src={normalizeImageUrl(project.cover) || defaultCover}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
      {hovered && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.04)',
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '80px',
          background: 'linear-gradient(to top, #000000CC, transparent)',
          borderRadius: '0 0 8px 8px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          padding: '12px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontSize: '14px', color: '#FFFFFF', lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name}
          </span>
          <span style={{ fontFamily: FONT, fontSize: '12px', color: '#FFFFFF66' }}>
            {formatRelativeTime(project.created_at || project.updated_at || project.date)}
          </span>
        </div>
        {(hovered || menuOpen) && (
          <div ref={moreRef} style={{ position: 'relative', flexShrink: 0, marginLeft: '8px' }}>
            <div
              onClick={handleMoreClick}
              onMouseEnter={(e) => { if (!menuOpen) e.currentTarget.style.background = 'rgba(0,0,0,0.55)'; }}
              onMouseLeave={(e) => { if (!menuOpen) e.currentTarget.style.background = 'rgba(0,0,0,0.40)'; }}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: menuOpen ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.40)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 120ms',
              }}
            >
              <MoreIcon />
            </div>
            {menuOpen && (
              <MoreMenu
                onRename={() => { setMenuOpen(false); onRename?.(project); }}
                onCopy={() => { setMenuOpen(false); onCopy?.(project); }}
                onDelete={() => { setMenuOpen(false); onDelete?.(project); }}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function ProjectList({ projects = [], onNewProject, onRenameProject, onCopyProject, onDeleteProject, onOpenProject }) {
  const [searchValue, setSearchValue] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchHovered, setSearchHovered] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const searchBorderColor = searchFocused
    ? 'var(--color-input-border-focus)'
    : searchHovered
    ? 'var(--color-input-border-hover)'
    : '#FFFFFF14';

  return (
    <div style={{ flex: '1 1 0%', overflow: 'auto', padding: '0px 24px 24px 0px', height: '100%', boxSizing: 'border-box' }}>
      <div
        style={{
          borderRadius: '16px',
          padding: '16px 24px',
          background: 'rgb(22, 22, 22)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          minHeight: '100%',
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <span style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', color: '#FFFFFF' }}>所有项目</span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              height: '36px',
              width: '232px',
              paddingLeft: '12px',
              paddingRight: '6px',
              borderRadius: '8px',
              background: '#1D1E1E',
              border: `1px solid ${searchBorderColor}`,
              outline: '1px solid #00000080',
              outlineOffset: '0',
              transition: 'border-color 150ms',
            }}
            onMouseEnter={() => setSearchHovered(true)}
            onMouseLeave={() => setSearchHovered(false)}
          >
            <SearchIcon />
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="搜索项目"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontFamily: FONT,
                fontSize: '14px',
                color: '#FFFFFF',
                caretColor: '#2DC3E1',
              }}
            />
          </div>
        </div>

        {/* Card grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(240px, 16vw, 288px), 1fr))', gap: '16px' }}>
          <NewProjectCard onClick={onNewProject} />
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onRename={(p) => setRenameTarget(p)}
              onCopy={(p) => onCopyProject?.(p)}
              onDelete={(p) => setDeleteTarget(p)}
              onOpen={(p) => onOpenProject?.(p)}
            />
          ))}
        </div>
      </div>

      {renameTarget && (
        <RenameModal
          initialName={renameTarget.name}
          onConfirm={(newName) => {
            onRenameProject?.(renameTarget.id, newName);
            setRenameTarget(null);
          }}
          onCancel={() => setRenameTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="确定要删除吗？"
          description={`「${deleteTarget.name}」将被永久删除，无法恢复。`}
          confirmText="删除"
          onConfirm={() => {
            onDeleteProject?.(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
